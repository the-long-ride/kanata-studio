use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum KeyboardLayout {
    Ansi,
    Iso,
    Jis,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardDevice {
    pub id: String,
    pub name: String,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
    pub path: Option<String>,
    #[serde(default)]
    pub interface_paths: Vec<String>,
    pub layout: KeyboardLayout,
    pub manual_layout: Option<KeyboardLayout>,
    #[serde(default)]
    pub reported_key_count: Option<u32>,
    #[serde(default)]
    pub function_key_count: Option<u32>,
    #[serde(default)]
    pub keyboard_type: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeviceMappingCapability {
    Unavailable,
    Available,
    RequiresWindowsInterception,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilitySet {
    pub platform: Platform,
    pub per_app_auto_switch: bool,
    pub per_device_mapping: DeviceMappingCapability,
    pub window_title_matching: bool,
    pub manual_profile_selection: bool,
    pub permissions: BTreeMap<String, bool>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Platform {
    Windows,
    Macos,
    Linux,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn old_keyboard_device_json_defaults_new_hardware_metadata() {
        let device: KeyboardDevice = serde_json::from_str(r#"{
            "id":"kbd",
            "name":"Keyboard",
            "vendorId":4660,
            "productId":22136,
            "path":null,
            "interfacePaths":[],
            "layout":"Ansi",
            "manualLayout":null
        }"#).unwrap();
        assert_eq!(device.reported_key_count, None);
        assert_eq!(device.function_key_count, None);
        assert_eq!(device.keyboard_type, None);
    }
}
