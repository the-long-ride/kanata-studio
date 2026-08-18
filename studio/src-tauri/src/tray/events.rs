use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::{
    app_state::AppState,
    engine::{EngineId, EngineSupervisor, RuntimeHealth, shutdown::prepare_true_quit},
    runtime::{diagnostics::append_runtime_diagnostic, pause_all, resume_all},
};

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn handle_menu(app: &AppHandle, id: &str) {
    match id {
        "open" => show_main(app),
        "pause" => toggle_remapping(app),
        "restart" => restart(app),
        "autostart" => toggle_autostart(app),
        "quit" => quit(app),
        _ => {}
    }
}

fn quit(app: &AppHandle) {
    let state = app.state::<AppState>();
    let stop_on_quit = state.settings.read().stop_kanata_on_quit;
    for error in prepare_true_quit(state.supervisor.as_ref(), stop_on_quit) {
        let _ = append_runtime_diagnostic(&state.paths.logs(), &format!("shutdown-error {error}"));
    }
    app.exit(0);
}

fn toggle_remapping(app: &AppHandle) {
    let state = app.state::<AppState>();
    let enabled = !state.settings.read().remapping_enabled;
    let result = if enabled {
        resume_all(&state)
    } else {
        pause_all(&state)
    };
    if result.is_ok() {
        state.settings.write().remapping_enabled = enabled;
        let settings = state.settings.read().clone();
        let _ = state.settings_store.save(&settings);
        *state.health.write() = if enabled {
            RuntimeHealth::Running
        } else {
            RuntimeHealth::Paused
        };
    }
}

fn restart(app: &AppHandle) {
    let state = app.state::<AppState>();
    for status in state.engine_statuses() {
        let _ = state.supervisor.restart(&EngineId(status.id));
    }
}

fn toggle_autostart(app: &AppHandle) {
    let manager = app.autolaunch();
    let enabled = manager.is_enabled().unwrap_or(false);
    let _ = if enabled {
        manager.disable()
    } else {
        manager.enable()
    };
    let state = app.state::<AppState>();
    state.settings.write().start_with_system = !enabled;
    let settings = state.settings.read().clone();
    let _ = state.settings_store.save(&settings);
}
