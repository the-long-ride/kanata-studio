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
    pub layout: KeyboardLayout,
    pub manual_layout: Option<KeyboardLayout>,
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
