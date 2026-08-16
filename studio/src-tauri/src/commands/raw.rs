use serde::Deserialize;
use tauri::State;

use crate::{
    app_state::AppState,
    compiler::{compile_resolved, CompileContext},
    domain::{resolve_profile, DeviceTarget, ProfileSource, ResolutionContext},
    validation::{validate_kbd, ValidationResult},
};

use super::profiles::{commit_profile_set, ApplyResult};

#[derive(Deserialize)]
pub struct ValidateRawInput {
    pub text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRawInput {
    pub id: String,
    pub text: String,
    pub expected_revision: u64,
}

#[tauri::command]
pub fn validate_raw_profile(input: ValidateRawInput) -> ValidationResult {
    validate_kbd(&input.text)
}

#[tauri::command]
pub fn set_raw_profile_text(
    state: State<'_, AppState>,
    input: SaveRawInput,
) -> Result<ApplyResult, String> {
    let validation = validate_kbd(&input.text);
    let current = state.profiles.read().clone();
    let old = current
        .iter()
        .find(|profile| profile.id == input.id)
        .cloned()
        .ok_or("profile not found")?;
    if !validation.ok {
        return Ok(ApplyResult {
            profile: old,
            validation,
            engine_statuses: state.engine_statuses(),
            applied: false,
        });
    }
    if old.revision != input.expected_revision {
        return Err("stale revision; reload the profile before saving".into());
    }

    let mut next = current;
    let target = next
        .iter_mut()
        .find(|profile| profile.id == input.id)
        .expect("profile exists");
    target.revision += 1;
    target.source = ProfileSource::Raw {
        kbd: input.text.clone(),
    };
    let saved = target.clone();
    commit_profile_set(&state, next)?;

    Ok(ApplyResult {
        profile: saved,
        validation,
        engine_statuses: state.engine_statuses(),
        applied: true,
    })
}

#[tauri::command]
pub fn convert_profile_to_raw(
    state: State<'_, AppState>,
    id: String,
    expected_revision: u64,
) -> Result<ApplyResult, String> {
    let profiles = state.profiles.read().clone();
    let profile = profiles
        .iter()
        .find(|profile| profile.id == id)
        .cloned()
        .ok_or("profile not found")?;
    if profile.revision != expected_revision {
        return Err("stale revision; reload the profile before converting".into());
    }
    if let ProfileSource::Raw { kbd } = profile.source {
        return set_raw_profile_text(
            state,
            SaveRawInput {
                id,
                text: kbd,
                expected_revision,
            },
        );
    }

    let device_id = match &profile.device_target {
        DeviceTarget::All => None,
        DeviceTarget::Device { id } => Some(id.as_str()),
    };
    let resolved = resolve_profile(
        &profiles,
        ResolutionContext {
            executable: profile.app_matcher.as_ref().map(|matcher| matcher.executable.as_str()),
            window_title: profile
                .app_matcher
                .as_ref()
                .and_then(|matcher| matcher.window_title_contains.as_deref()),
            device_id,
            ui_mode: crate::domain::UiMode::Advanced,
        },
    )
    .map_err(|error| error.to_string())?;
    let capabilities = state.capabilities.read().clone();
    let compiled = compile_resolved(
        &resolved,
        CompileContext {
            platform: capabilities.platform,
            device_scope: &crate::compiler::device_scope::EngineDeviceScope::All,
        },
    )
    .map_err(|error| error.to_string())?;

    set_raw_profile_text(
        state,
        SaveRawInput {
            id,
            text: compiled.text,
            expected_revision,
        },
    )
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResult {
    pub text: String,
    pub validation: ValidationResult,
}

#[tauri::command]
pub fn preview_profile(
    state: State<'_, AppState>,
    id: String,
) -> Result<PreviewResult, String> {
    let profiles = state.profiles.read().clone();
    let profile = profiles
        .iter()
        .find(|profile| profile.id == id)
        .ok_or("profile not found")?;
    let text = match &profile.source {
        ProfileSource::Raw { kbd } => kbd.clone(),
        ProfileSource::Visual { .. } => {
            let device_id = match &profile.device_target {
                DeviceTarget::All => None,
                DeviceTarget::Device { id } => Some(id.as_str()),
            };
            let resolved = resolve_profile(
                &profiles,
                ResolutionContext {
                    executable: profile.app_matcher.as_ref().map(|matcher| matcher.executable.as_str()),
                    window_title: profile
                        .app_matcher
                        .as_ref()
                        .and_then(|matcher| matcher.window_title_contains.as_deref()),
                    device_id,
                    ui_mode: crate::domain::UiMode::Advanced,
                },
            )
            .map_err(|error| error.to_string())?;
            let capabilities = state.capabilities.read().clone();
            compile_resolved(
                &resolved,
                CompileContext {
                    platform: capabilities.platform,
                    device_scope: &crate::compiler::device_scope::EngineDeviceScope::All,
                },
            )
            .map_err(|error| error.to_string())?
            .text
        }
    };
    Ok(PreviewResult {
        validation: validate_kbd(&text),
        text,
    })
}

#[tauri::command]
pub fn read_runtime_config(
    state: State<'_, AppState>,
    engine_id: String,
) -> Result<String, String> {
    std::fs::read_to_string(state.paths.runtime(&engine_id)).map_err(|error| error.to_string())
}
