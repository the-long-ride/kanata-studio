use sha2::{Digest, Sha256};

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
            let layout = device
                .supported_keys()
                .map(detect_layout)
                .unwrap_or(KeyboardLayout::Unknown);
            let identity_hint = device
                .unique_name()
                .filter(|value| !value.is_empty())
                .map(|value| format!("uniq:{value}"))
                .or_else(|| {
                    device
                        .physical_path()
                        .filter(|value| !value.is_empty())
                        .map(|value| format!("phys:{value}"))
                })
                .unwrap_or_else(|| format!("path:{}", path.display()));
            devices.push(KeyboardDevice {
                id: stable_id(input_id.vendor(), input_id.product(), &identity_hint),
                name,
                vendor_id: Some(input_id.vendor()),
                product_id: Some(input_id.product()),
                path: Some(path.display().to_string()),
                interface_paths: Vec::new(),
                layout,
                manual_layout: None,
                reported_key_count: None,
                function_key_count: None,
                keyboard_type: None,
            });
        }
    }

    Ok(devices)
}

fn stable_id(vendor_id: u16, product_id: u16, identity_hint: &str) -> String {
    let digest =
        Sha256::digest(format!("{vendor_id:04x}:{product_id:04x}:{identity_hint}").as_bytes());
    format!("linux-{}", &hex::encode(digest)[..16])
}

fn detect_layout(keys: &evdev::AttributeSetRef<evdev::KeyCode>) -> KeyboardLayout {
    let is_jis = [
        evdev::KeyCode::KEY_RO,
        evdev::KeyCode::KEY_HENKAN,
        evdev::KeyCode::KEY_MUHENKAN,
        evdev::KeyCode::KEY_YEN,
    ]
    .iter()
    .any(|key| keys.contains(*key));
    if is_jis {
        KeyboardLayout::Jis
    } else if keys.contains(evdev::KeyCode::KEY_102ND) {
        KeyboardLayout::Iso
    } else {
        KeyboardLayout::Ansi
    }
}
