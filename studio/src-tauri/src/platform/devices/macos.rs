use super::super::PlatformError;
use crate::domain::{KeyboardDevice, KeyboardLayout};

pub fn list() -> Result<Vec<KeyboardDevice>, PlatformError> {
    let devices = karabiner_driverkit::fetch_devices()
        .into_iter()
        .map(|device| KeyboardDevice {
            id: format!("mac-{:x}", device.hash),
            name: device.product_key.clone(),
            vendor_id: Some(device.vendor_id as u16),
            product_id: Some(device.product_id as u16),
            path: None,
            interface_paths: Vec::new(),
            layout: KeyboardLayout::Unknown,
            manual_layout: None,
            reported_key_count: None,
            function_key_count: None,
            keyboard_type: None,
        })
        .collect();

    Ok(devices)
}
