use super::super::PlatformError;
use crate::domain::{KeyboardDevice, KeyboardLayout};

pub fn list() -> Result<Vec<KeyboardDevice>, PlatformError> {
    let mut devices = Vec::new();

    for (path, device) in evdev::enumerate() {
        let input_id = device.input_id();
        let name = device.name().unwrap_or("Unknown keyboard").to_string();
        let is_keyboard = device.supported_keys().is_some_and(|keys| {
            keys.contains(evdev::KeyCode::KEY_A) && keys.contains(evdev::KeyCode::KEY_SPACE)
        });

        if is_keyboard {
            devices.push(KeyboardDevice {
                id: format!(
                    "linux-{:04x}-{:04x}-{}",
                    input_id.vendor(),
                    input_id.product(),
                    name
                ),
                name,
                vendor_id: Some(input_id.vendor()),
                product_id: Some(input_id.product()),
                path: Some(path.display().to_string()),
                layout: KeyboardLayout::Unknown,
                manual_layout: None,
            });
        }
    }

    Ok(devices)
}
