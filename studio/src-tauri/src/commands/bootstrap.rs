use serde::Serialize;
use tauri::State;

use crate::{
    app_state::AppState,
    domain::{resolve_profile, CapabilitySet, KeyboardDevice, ResolutionContext, StudioProfile, StudioSettings},
    engine::{EngineStatus, RuntimeHealth},
    updates::{KANATA_BASE_SHA, KANATA_VERSION},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub studio: String,
    pub kanata: String,
    pub sha: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapState {
    profiles: Vec<StudioProfile>,
    settings: StudioSettings,
    devices: Vec<KeyboardDevice>,
    capabilities: CapabilitySet,
    engine_statuses: Vec<EngineStatus>,
    active_profile_id: String,
    health: RuntimeHealth,
    version: VersionInfo,
}

#[tauri::command]
pub fn get_bootstrap_state(state: State<'_, AppState>) -> BootstrapState {
    let profiles = state.profiles.read().clone();
    let settings = state.settings.read().clone();
    let active = state.active_app.read().clone();
    let active_profile_id = state.manual_profile_id.read().clone().or_else(|| resolve_profile(
        &profiles,
        ResolutionContext {
            executable: active.as_ref().map(|value| value.executable.as_str()),
            window_title: active.as_ref().and_then(|value| value.window_title.as_deref()),
            device_id: None,
            ui_mode: settings.ui_mode.clone(),
        },
    )
    .ok()
    .and_then(|resolved| resolved.contributing_profile_ids.last().cloned()))
    .unwrap_or_else(|| "global".into());

    BootstrapState {
        profiles,
        settings,
        devices: state.devices.read().clone(),
        capabilities: state.capabilities.read().clone(),
        engine_statuses: state.engine_statuses(),
        active_profile_id,
        health: state.health.read().clone(),
        version: VersionInfo {
            studio: env!("CARGO_PKG_VERSION").into(),
            kanata: KANATA_VERSION.into(),
            sha: KANATA_BASE_SHA.into(),
        },
    }
}
