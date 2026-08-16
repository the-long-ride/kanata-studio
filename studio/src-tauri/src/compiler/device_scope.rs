use crate::domain::{KeyboardDevice, Platform};

use super::escape::quote;

#[derive(Debug, Clone)]
pub enum EngineDeviceScope {
    All,
    IncludeDevice(KeyboardDevice),
    ExcludeDevices(Vec<KeyboardDevice>),
    MacDeviceAware(Vec<KeyboardDevice>),
}

fn linux_path(device: &KeyboardDevice) -> Option<&str> {
    device.path.as_deref()
}

fn windows_hwid_bytes(device: &KeyboardDevice) -> Option<String> {
    let raw = device.path.as_ref()?;
    let bytes = raw
        .encode_utf16()
        .flat_map(u16::to_le_bytes)
        .map(|byte| byte.to_string())
        .collect::<Vec<_>>()
        .join(", ");
    Some(bytes)
}

pub fn defcfg_for_scope(platform: Platform, scope: &EngineDeviceScope) -> String {
    let mut lines = vec!["(defcfg".to_string(), "  process-unmapped-keys yes".into()];
    match (platform, scope) {
        (Platform::Linux, EngineDeviceScope::IncludeDevice(device)) => {
            if let Some(path) = linux_path(device) {
                lines.push(format!("  linux-dev {}", quote(path)));
            }
        }
        (Platform::Linux, EngineDeviceScope::ExcludeDevices(devices)) => {
            let names = devices
                .iter()
                .map(|device| quote(&device.name))
                .collect::<Vec<_>>()
                .join(" ");
            if !names.is_empty() {
                lines.push(format!("  linux-dev-names-exclude ({names})"));
            }
        }
        (Platform::Windows, EngineDeviceScope::IncludeDevice(device)) => {
            if let Some(bytes) = windows_hwid_bytes(device) {
                lines.push(format!(
                    "  windows-interception-keyboard-hwids (\"{bytes}\")"
                ));
            }
        }
        (Platform::Windows, EngineDeviceScope::ExcludeDevices(devices)) => {
            let values = devices
                .iter()
                .filter_map(windows_hwid_bytes)
                .map(|value| format!("\"{value}\""))
                .collect::<Vec<_>>()
                .join(" ");
            if !values.is_empty() {
                lines.push(format!(
                    "  windows-interception-keyboard-hwids-exclude ({values})"
                ));
            }
        }
        _ => {}
    }
    lines.push(")".into());
    lines.push(String::new());
    lines.join("\n")
}

pub fn mac_device_blocks(devices: &[KeyboardDevice]) -> String {
    if devices.is_empty() {
        return String::new();
    }
    let mut out = String::from("(definputdevices\n");
    for (index, device) in devices.iter().enumerate() {
        let id = index + 1;
        let mut matchers = vec![format!("(name {})", quote(&device.name))];
        if let Some(vendor) = device.vendor_id {
            matchers.push(format!("(vendor_id 0x{vendor:04X})"));
        }
        if let Some(product) = device.product_id {
            matchers.push(format!("(product_id 0x{product:04X})"));
        }
        out.push_str(&format!("  {id} ({})\n", matchers.join(" ")));
    }
    out.push_str(")\n\n");
    out
}
