use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

use crate::{
    app_state::AppState,
    domain::{
        ConfiguredKeyboard, DeviceTarget, KeyboardLayout, ProfileSource, StudioProfile,
        device_global_profile, validate_profile_set,
    },
    storage::ProfileRepository,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardConfigurationResult {
    pub keyboard: ConfiguredKeyboard,
    pub profiles: Vec<StudioProfile>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfiguredKeyboardInput {
    pub id: String,
    pub name: Option<String>,
    pub layout_override: Option<KeyboardLayout>,
    #[serde(default)]
    pub visual_preset_override: Option<String>,
}

#[tauri::command(async)]
pub fn configure_keyboard(
    state: State<'_, AppState>,
    id: String,
) -> Result<KeyboardConfigurationResult, String> {
    let device = state
        .devices
        .read()
        .iter()
        .find(|device| device.id == id)
        .cloned()
        .ok_or("keyboard is not currently connected")?;
    let mut keyboards = state.configured_keyboards.read().clone();
    let keyboard = if let Some(saved) = keyboards.iter_mut().find(|saved| saved.id == id) {
        saved.refresh_metadata(&device);
        saved.clone()
    } else {
        let saved = ConfiguredKeyboard::from_device(&device);
        keyboards.push(saved.clone());
        saved
    };
    let mut profiles = state.profiles.read().clone();
    ensure_keyboard_profile_set(&mut profiles, &id);
    persist_configuration(&state, &keyboards, &profiles)?;
    Ok(result_for(&keyboard, &profiles))
}

#[tauri::command(async)]
pub fn update_configured_keyboard(
    state: State<'_, AppState>,
    input: UpdateConfiguredKeyboardInput,
) -> Result<ConfiguredKeyboard, String> {
    let mut keyboards = state.configured_keyboards.read().clone();
    let keyboard = keyboards
        .iter_mut()
        .find(|keyboard| keyboard.id == input.id)
        .ok_or("configured keyboard not found")?;
    if let Some(name) = input.name {
        let name = name.trim();
        if name.is_empty() {
            return Err("keyboard name cannot be blank".into());
        }
        keyboard.name = name.into();
    }
    if let Some(value) = input.visual_preset_override.as_deref() {
        if !matches!(value, "fullsize" | "tkl" | "75" | "65" | "60") {
            return Err("unknown keyboard visual preset".into());
        }
    }
    keyboard.layout_override = input.layout_override;
    keyboard.visual_preset_override = input.visual_preset_override;
    let saved = keyboard.clone();
    state
        .keyboard_store
        .save_all(&keyboards)
        .map_err(|error| error.to_string())?;
    *state.configured_keyboards.write() = keyboards;
    sync_layout_override(&state, &saved);
    Ok(saved)
}

#[tauri::command(async)]
pub fn copy_keyboard_configuration(
    state: State<'_, AppState>,
    source_id: String,
    target_id: String,
) -> Result<KeyboardConfigurationResult, String> {
    if source_id == target_id {
        return Err("source and destination keyboards must be different".into());
    }
    let mut keyboards = state.configured_keyboards.read().clone();
    let source = keyboards
        .iter()
        .find(|keyboard| keyboard.id == source_id)
        .cloned()
        .ok_or("source keyboard is not configured")?;
    let target_index = keyboards
        .iter()
        .position(|keyboard| keyboard.id == target_id)
        .ok_or("destination keyboard is not configured")?;
    keyboards[target_index].layout_override = source.layout_override.clone();
    keyboards[target_index].visual_preset_override = source.visual_preset_override.clone();
    let target = keyboards[target_index].clone();

    let current = state.profiles.read().clone();
    let source_profiles = profiles_for_device(&current, &source_id);
    if source_profiles.is_empty() {
        return Err("source keyboard has no profiles".into());
    }
    let mut profiles = current
        .into_iter()
        .filter(|profile| !targets_device(profile, &target_id))
        .collect::<Vec<_>>();
    for profile in source_profiles {
        profiles.push(copy_profile(profile, &target_id));
    }
    validate_profile_set(&profiles).map_err(|error| error.to_string())?;
    persist_configuration(&state, &keyboards, &profiles)?;
    sync_layout_override(&state, &target);
    Ok(result_for(&target, &profiles))
}

pub(crate) fn ensure_keyboard_global_profile(profiles: &mut Vec<StudioProfile>, id: &str) {
    if profiles
        .iter()
        .any(|profile| profile.app_matcher.is_none() && targets_device(profile, id))
    {
        return;
    }
    let source = profiles
        .iter()
        .find(|profile| {
            matches!(profile.device_target, DeviceTarget::All) && profile.app_matcher.is_none()
        })
        .map(|profile| profile.source.clone())
        .unwrap_or(ProfileSource::Visual {
            mappings: Default::default(),
            advanced: Default::default(),
        });
    profiles.push(device_global_profile(id, source));
}

fn ensure_keyboard_profile_set(profiles: &mut Vec<StudioProfile>, id: &str) {
    ensure_keyboard_global_profile(profiles, id);
    let shared_apps = profiles
        .iter()
        .filter(|profile| {
            matches!(profile.device_target, DeviceTarget::All) && profile.app_matcher.is_some()
        })
        .cloned()
        .collect::<Vec<_>>();
    for profile in shared_apps {
        let executable = profile
            .app_matcher
            .as_ref()
            .map(|matcher| matcher.executable.as_str())
            .unwrap_or_default();
        let exists = profiles.iter().any(|candidate| {
            targets_device(candidate, id)
                && candidate
                    .app_matcher
                    .as_ref()
                    .is_some_and(|matcher| matcher.executable.eq_ignore_ascii_case(executable))
        });
        if !exists {
            profiles.push(copy_profile(profile, id));
        }
    }
}

fn persist_configuration(
    state: &AppState,
    keyboards: &[ConfiguredKeyboard],
    profiles: &[StudioProfile],
) -> Result<(), String> {
    validate_profile_set(profiles).map_err(|error| error.to_string())?;
    state
        .profile_store
        .save_all(profiles)
        .map_err(|error| error.to_string())?;
    state
        .keyboard_store
        .save_all(keyboards)
        .map_err(|error| error.to_string())?;
    *state.profiles.write() = profiles.to_vec();
    *state.configured_keyboards.write() = keyboards.to_vec();
    Ok(())
}

fn profiles_for_device(profiles: &[StudioProfile], id: &str) -> Vec<StudioProfile> {
    profiles
        .iter()
        .filter(|profile| targets_device(profile, id))
        .cloned()
        .collect()
}

fn targets_device(profile: &StudioProfile, id: &str) -> bool {
    matches!(&profile.device_target, DeviceTarget::Device { id: target } if target == id)
}

fn copy_profile(mut profile: StudioProfile, target: &str) -> StudioProfile {
    profile.id = if profile.app_matcher.is_none() {
        format!("keyboard-{target}-global")
    } else {
        let digest = Sha256::digest(format!("{target}:{}", profile.id).as_bytes());
        format!("profile-{}", &hex::encode(digest)[..16])
    };
    profile.revision = 0;
    profile.device_target = DeviceTarget::Device { id: target.into() };
    profile
}

fn result_for(
    keyboard: &ConfiguredKeyboard,
    profiles: &[StudioProfile],
) -> KeyboardConfigurationResult {
    KeyboardConfigurationResult {
        keyboard: keyboard.clone(),
        profiles: profiles.to_vec(),
    }
}

fn sync_layout_override(state: &AppState, keyboard: &ConfiguredKeyboard) {
    for device in state.devices.write().iter_mut() {
        if device.id == keyboard.id {
            device.manual_layout = keyboard.layout_override.clone();
        }
    }
}
