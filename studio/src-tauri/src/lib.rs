pub mod actions;
pub mod app_state;
pub mod commands;
pub mod compiler;
pub mod domain;
pub mod engine;
pub mod platform;
pub mod runtime;
pub mod startup;
pub mod storage;
pub mod tray;
pub mod updates;
pub mod validation;

use std::sync::Arc;

use tauri::{Manager, WindowEvent};
use storage::{JsonProfileStore, ProfileRepository, RecoveryStore, SettingsStore, StudioPaths};

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            tray::events::show_main(app)
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--background"]),
        ))
        .setup(|app| {
            let root = app
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?
                .join("kanata-studio");
            let paths = StudioPaths::new(root);
            std::fs::create_dir_all(paths.logs()).map_err(|error| error.to_string())?;

            let profile_store = JsonProfileStore::new(paths.clone());
            let settings_store = SettingsStore::new(paths.clone());
            let profiles = profile_store.load_all().map_err(|error| error.to_string())?;
            let settings = settings_store.load().map_err(|error| error.to_string())?;
            let mut devices = platform::devices::DeviceProvider::list_keyboards(
                &platform::devices::SystemDeviceProvider,
            )
            .unwrap_or_default();
            platform::devices::apply_layouts(
                &mut devices,
                &settings.device_layout_overrides,
            );
            let mut capabilities = platform::capabilities::current_capabilities(
                platform::capabilities::windows_interception_available(),
            );
            capabilities.permissions = platform::permissions::status();
            let supervisor = engine::LocalSupervisor::new(app.handle().clone(), paths.logs());

            app.manage(app_state::AppState {
                profiles: parking_lot::RwLock::new(profiles),
                settings: parking_lot::RwLock::new(settings.clone()),
                devices: parking_lot::RwLock::new(devices),
                capabilities: parking_lot::RwLock::new(capabilities),
                supervisor: Arc::clone(&supervisor),
                paths: paths.clone(),
                profile_store,
                settings_store,
                recovery: RecoveryStore::new(paths),
                health: parking_lot::RwLock::new(if settings.remapping_enabled {
                    engine::RuntimeHealth::Running
                } else {
                    engine::RuntimeHealth::Paused
                }),
                active_app: parking_lot::RwLock::new(None),
                manual_profile_id: parking_lot::RwLock::new(None),
                topology_signature: parking_lot::RwLock::new(None),
                last_runtime_error: parking_lot::RwLock::new(None),
            });

            tray::build(app.handle())?;
            if settings.remapping_enabled {
                let state = app.state::<app_state::AppState>();
                if let Err(error) = runtime::apply_current_context(&state) {
                    *state.last_runtime_error.write() = Some(error.to_string());
                    *state.health.write() = engine::RuntimeHealth::RecoveryRequired {
                        message: error.to_string(),
                    };
                }
            }
            runtime::start_watchers(app.handle().clone());

            if startup::is_background_launch() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_bootstrap_state,
            commands::create_profile,
            commands::update_profile,
            commands::delete_profile,
            commands::validate_raw_profile,
            commands::set_raw_profile_text,
            commands::convert_profile_to_raw,
            commands::preview_profile,
            commands::read_runtime_config,
            commands::list_keyboards,
            commands::set_remapping_enabled,
            commands::restart_engines,
            commands::set_manual_profile,
            commands::update_settings,
            commands::open_logs,
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("Kanata Studio failed");
}
