#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;
#[cfg(target_os = "windows")]
mod windows_identity;

use std::collections::BTreeMap;

use crate::domain::{ConfiguredKeyboard, KeyboardDevice, KeyboardLayout};

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

pub fn apply_layouts(devices: &mut [KeyboardDevice], overrides: &BTreeMap<String, KeyboardLayout>) {
    for device in devices.iter_mut() {
        if let Some(layout) = overrides.get(&device.id) {
            device.manual_layout = Some(layout.clone());
        }
    }
    detect_layouts(devices);
}

pub fn detect_layouts(devices: &mut [KeyboardDevice]) {
    for device in devices {
        #[cfg(target_os = "windows")]
        let detected = super::layout::windows::detect(device);
        #[cfg(target_os = "macos")]
        let detected = super::layout::macos::detect(device);
        #[cfg(target_os = "linux")]
        let detected = super::layout::linux::detect(device);

        device.layout = detected.layout;
    }
}

pub fn apply_configured_layouts(devices: &mut [KeyboardDevice], configured: &[ConfiguredKeyboard]) {
    for device in devices {
        if let Some(saved) = configured.iter().find(|saved| saved.id == device.id) {
            device.manual_layout = saved.layout_override.clone();
        }
    }
}
