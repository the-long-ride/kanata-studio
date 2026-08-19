use std::{thread, time::Duration};

use tauri::{AppHandle, Manager};

use crate::{
    app_state::AppState,
    engine::switcher::ProfileSwitcher,
    platform::{
        active_app::system_provider,
        devices::{DeviceProvider, SystemDeviceProvider, apply_saved_layouts},
    },
};

pub fn start_watchers(app: AppHandle) {
    start_active_app_watcher(app.clone());
    start_device_watcher(app);
}

fn start_active_app_watcher(app: AppHandle) {
    thread::spawn(move || {
        let provider = system_provider();
        let mut coalescer = ProfileSwitcher::default();
        loop {
            let state = app.state::<AppState>();
            if !state.capabilities.read().per_app_auto_switch {
                thread::sleep(Duration::from_secs(1));
                continue;
            }
            if let Ok(active) = provider.current() {
                let key = format!(
                    "{}\n{}",
                    active.executable,
                    active.window_title.as_deref().unwrap_or("")
                );
                if coalescer.observe(&key, std::time::Instant::now()) {
                    *state.active_app.write() = Some(active);
                    apply_and_record(&state);
                }
            }
            thread::sleep(Duration::from_millis(250));
        }
    });
}

fn start_device_watcher(app: AppHandle) {
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(2));
            let state = app.state::<AppState>();
            let Ok(mut devices) = SystemDeviceProvider.list_keyboards() else {
                continue;
            };
            let overrides = state.settings.read().device_layout_overrides.clone();
            let configured = state.configured_keyboards.read().clone();
            // Keep watcher normalization identical to startup and list_keyboards. Otherwise
            // configured layout overrides disappear every poll and the same device looks changed.
            apply_saved_layouts(&mut devices, &overrides, &configured);
            let mut capabilities = crate::platform::capabilities::current_capabilities(
                crate::platform::capabilities::windows_interception_available(),
            );
            capabilities.permissions = crate::platform::permissions::status();
            if capabilities != *state.capabilities.read() {
                *state.capabilities.write() = capabilities;
            }
            if devices != *state.devices.read() {
                *state.devices.write() = devices;
                apply_and_record(&state);
            }
        }
    });
}

fn apply_and_record(state: &AppState) {
    if let Err(error) = super::apply_current_context(state) {
        *state.last_runtime_error.write() = Some(error.to_string());
    } else {
        *state.last_runtime_error.write() = None;
    }
}
