use tauri::State;

use crate::{
    app_state::AppState,
    engine::{EngineId, EngineStatus, EngineSupervisor, RuntimeHealth},
    runtime::{apply_current_context, pause_all, resume_all},
};

#[tauri::command]
pub fn set_remapping_enabled(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<Vec<EngineStatus>, String> {
    {
        let mut settings = state.settings.write();
        settings.remapping_enabled = enabled;
        state
            .settings_store
            .save(&settings)
            .map_err(|error| error.to_string())?;
    }

    let result = if enabled {
        resume_all(&state)
    } else {
        pause_all(&state)
    };
    match result {
        Ok(()) => {
            *state.health.write() = if enabled {
                RuntimeHealth::Running
            } else {
                RuntimeHealth::Paused
            };
            *state.last_runtime_error.write() = None;
        }
        Err(error) => {
            *state.health.write() = RuntimeHealth::RecoveryRequired {
                message: error.to_string(),
            };
            *state.last_runtime_error.write() = Some(error.to_string());
            return Err(error.to_string());
        }
    }
    Ok(state.engine_statuses())
}

#[tauri::command]
pub fn restart_engines(state: State<'_, AppState>) -> Result<Vec<EngineStatus>, String> {
    let ids = state
        .engine_statuses()
        .into_iter()
        .map(|status| EngineId(status.id))
        .collect::<Vec<_>>();
    for id in ids {
        state
            .supervisor
            .restart(&id)
            .map_err(|error| error.to_string())?;
    }
    Ok(state.engine_statuses())
}

#[tauri::command]
pub fn set_manual_profile(
    state: State<'_, AppState>,
    id: Option<String>,
) -> Result<Vec<EngineStatus>, String> {
    if let Some(profile_id) = &id {
        if !state.profiles.read().iter().any(|profile| &profile.id == profile_id) {
            return Err("profile not found".into());
        }
    }
    *state.manual_profile_id.write() = id;
    apply_current_context(&state).map_err(|error| error.to_string())?;
    Ok(state.engine_statuses())
}
