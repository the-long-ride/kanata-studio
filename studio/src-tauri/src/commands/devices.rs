use tauri::State;

use crate::{
    app_state::AppState,
    domain::KeyboardDevice,
    platform::devices::{apply_layouts, DeviceProvider, SystemDeviceProvider},
};

#[tauri::command]
pub fn list_keyboards(state: State<'_, AppState>) -> Result<Vec<KeyboardDevice>, String> {
    let mut devices = SystemDeviceProvider
        .list_keyboards()
        .map_err(|error| error.to_string())?;
    let overrides = state.settings.read().device_layout_overrides.clone();
    apply_layouts(&mut devices, &overrides);
    *state.devices.write() = devices.clone();
    let mut capabilities = crate::platform::capabilities::current_capabilities(
        crate::platform::capabilities::windows_interception_available(),
    );
    capabilities.permissions = crate::platform::permissions::status();
    *state.capabilities.write() = capabilities;
    Ok(devices)
}
