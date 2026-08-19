use std::{collections::BTreeMap, mem, ptr};

use sha2::{Digest, Sha256};
use winapi::{
    shared::minwindef::{PUINT, UINT},
    um::winuser::{
        GetRawInputDeviceInfoW, GetRawInputDeviceList, RAWINPUTDEVICELIST, RID_DEVICE_INFO,
        RIDI_DEVICEINFO, RIDI_DEVICENAME, RIM_TYPEKEYBOARD,
    },
};

use crate::domain::{KeyboardDevice, KeyboardLayout};

use super::{
    super::PlatformError,
    windows_identity::{container_id_for_interface, physical_id_from_container},
};

#[derive(Debug, Clone)]
struct RawKeyboardInterface {
    path: String,
    container_id: Option<String>,
    vendor_id: Option<u16>,
    product_id: Option<u16>,
    layout: KeyboardLayout,
    reported_key_count: Option<u32>,
    function_key_count: Option<u32>,
    keyboard_type: Option<u32>,
}

#[derive(Debug, Clone)]
struct KeyboardMetadata {
    layout: KeyboardLayout,
    reported_key_count: Option<u32>,
    function_key_count: Option<u32>,
    keyboard_type: Option<u32>,
}

pub fn list() -> Result<Vec<KeyboardDevice>, PlatformError> {
    unsafe {
        let mut count: UINT = 0;
        if GetRawInputDeviceList(
            ptr::null_mut(),
            &mut count as PUINT,
            mem::size_of::<RAWINPUTDEVICELIST>() as UINT,
        ) == u32::MAX
        {
            return Err(PlatformError::Other(
                "GetRawInputDeviceList could not count devices".into(),
            ));
        }
        if count == 0 {
            return Ok(Vec::new());
        }

        let mut raw_devices = vec![mem::zeroed::<RAWINPUTDEVICELIST>(); count as usize];
        if GetRawInputDeviceList(
            raw_devices.as_mut_ptr(),
            &mut count as PUINT,
            mem::size_of::<RAWINPUTDEVICELIST>() as UINT,
        ) == u32::MAX
        {
            return Err(PlatformError::Other(
                "GetRawInputDeviceList could not read devices".into(),
            ));
        }

        let mut interfaces = Vec::new();
        for raw in raw_devices
            .iter()
            .filter(|device| device.dwType == RIM_TYPEKEYBOARD)
        {
            if let Some(path) = device_path(raw) {
                let (vendor_id, product_id) = parse_vid_pid(&path);
                let container_id = container_id_for_interface(&path).ok().flatten();
                let metadata = detected_metadata(raw);
                interfaces.push(RawKeyboardInterface {
                    path,
                    container_id,
                    vendor_id,
                    product_id,
                    layout: metadata.layout,
                    reported_key_count: metadata.reported_key_count,
                    function_key_count: metadata.function_key_count,
                    keyboard_type: metadata.keyboard_type,
                });
            }
        }
        Ok(group_interfaces(interfaces))
    }
}

fn group_interfaces(rows: Vec<RawKeyboardInterface>) -> Vec<KeyboardDevice> {
    let mut groups = BTreeMap::<String, Vec<RawKeyboardInterface>>::new();
    for row in rows {
        let id = row
            .container_id
            .as_deref()
            .map(physical_id_from_container)
            .unwrap_or_else(|| stable_id(&row.path));
        groups.entry(id).or_default().push(row);
    }

    groups
        .into_iter()
        .map(|(id, rows)| {
            let mut interface_paths = rows.iter().map(|row| row.path.clone()).collect::<Vec<_>>();
            interface_paths.sort();
            interface_paths.dedup();
            let first = &rows[0];
            let vendor_id = rows.iter().find_map(|row| row.vendor_id);
            let product_id = rows.iter().find_map(|row| row.product_id);
            let layout = rows
                .iter()
                .map(|row| row.layout.clone())
                .find(|layout| *layout != KeyboardLayout::Unknown)
                .unwrap_or_else(|| first.layout.clone());
            let name = match (vendor_id, product_id) {
                (Some(vid), Some(pid)) => format!("Keyboard {vid:04X}:{pid:04X}"),
                _ => friendly_name(&first.path),
            };
            KeyboardDevice {
                id,
                name,
                vendor_id,
                product_id,
                path: interface_paths.first().cloned(),
                interface_paths,
                layout,
                manual_layout: None,
                reported_key_count: rows.iter().find_map(|row| row.reported_key_count),
                function_key_count: rows.iter().find_map(|row| row.function_key_count),
                keyboard_type: rows.iter().find_map(|row| row.keyboard_type),
            }
        })
        .collect()
}

fn detected_metadata(device: &RAWINPUTDEVICELIST) -> KeyboardMetadata {
    unsafe {
        let mut info = mem::zeroed::<RID_DEVICE_INFO>();
        info.cbSize = mem::size_of::<RID_DEVICE_INFO>() as u32;
        let mut size = mem::size_of::<RID_DEVICE_INFO>() as UINT;
        let result = GetRawInputDeviceInfoW(
            device.hDevice,
            RIDI_DEVICEINFO,
            (&mut info as *mut RID_DEVICE_INFO).cast(),
            &mut size as PUINT,
        );
        if result == u32::MAX {
            return KeyboardMetadata {
                layout: KeyboardLayout::Unknown,
                reported_key_count: None,
                function_key_count: None,
                keyboard_type: None,
            };
        }
        let keyboard = info.u.keyboard();
        let layout = if keyboard.dwType == 0x7 {
            KeyboardLayout::Jis
        } else {
            match keyboard.dwNumberOfKeysTotal {
                101 | 104 => KeyboardLayout::Ansi,
                102 | 105 => KeyboardLayout::Iso,
                _ => KeyboardLayout::Unknown,
            }
        };
        KeyboardMetadata {
            layout,
            reported_key_count: Some(keyboard.dwNumberOfKeysTotal),
            function_key_count: Some(keyboard.dwNumberOfFunctionKeys),
            keyboard_type: Some(keyboard.dwType),
        }
    }
}

fn device_path(device: &RAWINPUTDEVICELIST) -> Option<String> {
    unsafe {
        let mut chars: UINT = 0;
        GetRawInputDeviceInfoW(
            device.hDevice,
            RIDI_DEVICENAME,
            ptr::null_mut(),
            &mut chars as PUINT,
        );
        if chars == 0 {
            return None;
        }
        let mut buffer = vec![0u16; chars as usize + 1];
        let result = GetRawInputDeviceInfoW(
            device.hDevice,
            RIDI_DEVICENAME,
            buffer.as_mut_ptr().cast(),
            &mut chars as PUINT,
        );
        if result == u32::MAX {
            return None;
        }
        let end = buffer
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(buffer.len());
        Some(String::from_utf16_lossy(&buffer[..end]))
    }
}

pub(crate) fn stable_id(path: &str) -> String {
    let digest = Sha256::digest(path.as_bytes());
    format!("windows-{}", &hex::encode(digest)[..16])
}

fn friendly_name(path: &str) -> String {
    let (vid, pid) = parse_vid_pid(path);
    match (vid, pid) {
        (Some(vid), Some(pid)) => format!("Keyboard {vid:04X}:{pid:04X}"),
        _ => "Windows keyboard".into(),
    }
}

fn parse_vid_pid(path: &str) -> (Option<u16>, Option<u16>) {
    let upper = path.to_ascii_uppercase();
    (
        parse_hex_after(&upper, "VID_"),
        parse_hex_after(&upper, "PID_"),
    )
}

fn parse_hex_after(value: &str, marker: &str) -> Option<u16> {
    let start = value.find(marker)? + marker.len();
    u16::from_str_radix(value.get(start..start + 4)?, 16).ok()
}

#[cfg(test)]
mod tests {
    include!("windows_test.rs");
}
