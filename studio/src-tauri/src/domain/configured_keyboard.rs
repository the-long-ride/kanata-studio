use serde::{Deserialize, Serialize};

use super::{KeyboardDevice, KeyboardLayout};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfiguredKeyboard {
    pub id: String,
    pub name: String,
    pub detected_name: String,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
    pub layout_override: Option<KeyboardLayout>,
    #[serde(default)]
    pub visual_preset_override: Option<String>,
}

impl ConfiguredKeyboard {
    pub fn from_device(device: &KeyboardDevice) -> Self {
        Self {
            id: device.id.clone(),
            name: device.name.clone(),
            detected_name: device.name.clone(),
            vendor_id: device.vendor_id,
            product_id: device.product_id,
            layout_override: device.manual_layout.clone(),
            visual_preset_override: None,
        }
    }

    pub fn refresh_metadata(&mut self, device: &KeyboardDevice) {
        self.detected_name = device.name.clone();
        self.vendor_id = device.vendor_id;
        self.product_id = device.product_id;
    }
}

#[cfg(test)]
mod tests {
    use super::ConfiguredKeyboard;

    #[test]
    fn legacy_keyboard_has_no_visual_override() {
        let keyboard: ConfiguredKeyboard = serde_json::from_value(serde_json::json!({
            "id": "keyboard-1",
            "name": "Keyboard",
            "detectedName": "Keyboard",
            "vendorId": null,
            "productId": null,
            "layoutOverride": null
        }))
        .expect("legacy configured keyboard should deserialize");

        assert_eq!(keyboard.visual_preset_override, None);
    }
}
