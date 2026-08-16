#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;

use std::collections::BTreeMap;

use crate::domain::{KeyboardDevice, KeyboardLayout};

use super::PlatformError;

pub trait DeviceProvider {
    fn list_keyboards(&self) -> Result<Vec<KeyboardDevice>, PlatformError>;
}

pub struct SystemDeviceProvider;

impl DeviceProvider for SystemDeviceProvider {
    fn list_keyboards(&self) -> Result<Vec<KeyboardDevice>, PlatformError> {
        #[cfg(target_os = "windows")]
        return windows::list();
        #[cfg(target_os = "macos")]
        return macos::list();
        #[cfg(target_os = "linux")]
        return linux::list();
        #[allow(unreachable_code)]
        Ok(Vec::new())
    }
}

pub fn apply_layouts(
    devices: &mut [KeyboardDevice],
    overrides: &BTreeMap<String, KeyboardLayout>,
) {
    for device in devices {
        if let Some(layout) = overrides.get(&device.id) {
            device.manual_layout = Some(layout.clone());
        }

        #[cfg(target_os = "windows")]
        let detected = super::layout::windows::detect(device);
        #[cfg(target_os = "macos")]
        let detected = super::layout::macos::detect(device);
        #[cfg(target_os = "linux")]
        let detected = super::layout::linux::detect(device);

        device.layout = detected.layout;
    }
}
