use tauri::State;

use crate::{
    app_state::AppState,
    domain::KeyboardDevice,
    engine::RuntimeHealth,
    platform::devices::{DeviceProvider, SystemDeviceProvider, apply_saved_layouts},
    runtime::apply_current_context,
    storage::ProfileRepository,
};

use super::keyboard_identity::reconcile_keyboard_identities;

#[tauri::command(async)]
pub fn list_keyboards(state: State<'_, AppState>) -> Result<Vec<KeyboardDevice>, String> {
    let mut devices = SystemDeviceProvider
        .list_keyboards()
        .map_err(|error| error.to_string())?;
    let current_keyboards = state.configured_keyboards.read().clone();
    let current_profiles = state.profiles.read().clone();
    let reconciled =
        reconcile_keyboard_identities(&current_keyboards, &current_profiles, &devices)?;
    let migrations = reconciled.migrations.clone();

    if reconciled.changed {
        state
            .profile_store
            .save_all(&reconciled.profiles)
            .map_err(|error| error.to_string())?;
        if let Err(error) = state.keyboard_store.save_all(&reconciled.keyboards) {
            let _ = state.profile_store.save_all(&current_profiles);
            return Err(error.to_string());
        }
    }

    let overrides = state.settings.read().device_layout_overrides.clone();
    apply_saved_layouts(&mut devices, &overrides, &reconciled.keyboards);

    if reconciled.changed {
        *state.profiles.write() = reconciled.profiles;
        *state.configured_keyboards.write() = reconciled.keyboards;
        state.identity_migrations.write().extend(migrations);
    }
    *state.devices.write() = devices.clone();

    let mut capabilities = crate::platform::capabilities::current_capabilities(
        crate::platform::capabilities::windows_interception_available(),
    );
    capabilities.permissions = crate::platform::permissions::status();
    *state.capabilities.write() = capabilities;

    let settings = state.settings.read().clone();
    if reconciled.changed && settings.remapping_enabled && settings.onboarding_completed {
        if let Err(error) = apply_current_context(&state) {
            let message = error.to_string();
            *state.health.write() = RuntimeHealth::RecoveryRequired {
                message: message.clone(),
            };
            *state.last_runtime_error.write() = Some(message.clone());
            return Err(message);
        }
        *state.health.write() = RuntimeHealth::Running;
        *state.last_runtime_error.write() = None;
    }

    Ok(devices)
}
