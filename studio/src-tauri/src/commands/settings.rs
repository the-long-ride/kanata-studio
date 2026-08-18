use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

use crate::{
    app_state::AppState,
    domain::{KeyboardLayout, StudioSettings, UiMode},
};

#[tauri::command(async)]
pub fn update_settings(
    state: State<'_, AppState>,
    input: serde_json::Value,
) -> Result<StudioSettings, String> {
    let mut settings = state.settings.read().clone();

    if let Some(value) = input
        .get("startWithSystem")
        .and_then(|value| value.as_bool())
    {
        settings.start_with_system = value;
    }
    if let Some(value) = input
        .get("remappingEnabled")
        .and_then(|value| value.as_bool())
    {
        settings.remapping_enabled = value;
    }
    if let Some(value) = input
        .get("stopKanataOnQuit")
        .and_then(|value| value.as_bool())
    {
        settings.stop_kanata_on_quit = value;
    }
    if let Some(value) = input
        .get("onboardingCompleted")
        .and_then(|value| value.as_bool())
    {
        settings.onboarding_completed = value;
    }
    if let Some(value) = input.get("leftRailWidth").and_then(|value| value.as_u64()) {
        settings.left_rail_width = value.clamp(180, 420) as u16;
    }
    if let Some(value) = input.get("rightPaneWidth").and_then(|value| value.as_u64()) {
        settings.right_pane_width = value.clamp(260, 520) as u16;
    }
    if let Some(value) = input.get("uiMode").and_then(|value| value.as_str()) {
        settings.ui_mode = match value {
            "Advanced" => UiMode::Advanced,
            "Beginner" => UiMode::Beginner,
            _ => return Err("unknown UI mode".into()),
        };
    }
    if let Some(overrides) = input
        .get("deviceLayoutOverrides")
        .and_then(|value| value.as_object())
    {
        settings.device_layout_overrides.clear();
        for (id, layout) in overrides {
            let layout = match layout.as_str() {
                Some("Ansi") => KeyboardLayout::Ansi,
                Some("Iso") => KeyboardLayout::Iso,
                Some("Jis") => KeyboardLayout::Jis,
                Some("Unknown") => KeyboardLayout::Unknown,
                _ => return Err(format!("invalid layout override for {id}")),
            };
            settings.device_layout_overrides.insert(id.clone(), layout);
        }
    }

    state
        .settings_store
        .save(&settings)
        .map_err(|error| error.to_string())?;
    *state.settings.write() = settings.clone();
    Ok(settings)
}

#[tauri::command(async)]
pub fn set_start_with_system(app: AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(|error| error.to_string())
}
