use std::{mem, ptr};

use sha2::{Digest, Sha256};
use winapi::{
    shared::minwindef::{PUINT, UINT},
    um::winuser::{
        GetRawInputDeviceInfoW, GetRawInputDeviceList, RAWINPUTDEVICELIST, RID_DEVICE_INFO,
        RIDI_DEVICEINFO, RIDI_DEVICENAME, RIM_TYPEKEYBOARD,
    },
};

use crate::domain::{KeyboardDevice, KeyboardLayout};

use super::super::PlatformError;

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

        let mut keyboards = Vec::new();
        for raw in raw_devices
            .iter()
            .filter(|device| device.dwType == RIM_TYPEKEYBOARD)
        {
            if let Some(path) = device_path(raw) {
                let (vendor_id, product_id) = parse_vid_pid(&path);
                keyboards.push(KeyboardDevice {
                    id: stable_id(&path),
                    name: friendly_name(&path),
                    vendor_id,
                    product_id,
                    path: Some(path.clone()),
                    interface_paths: vec![path],
                    layout: detected_layout(raw),
                    manual_layout: None,
                });
            }
        }
        Ok(keyboards)
    }
}

fn detected_layout(device: &RAWINPUTDEVICELIST) -> KeyboardLayout {
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
            return KeyboardLayout::Unknown;
        }
        let keyboard = info.u.keyboard();
        if keyboard.dwType == 0x7 {
            return KeyboardLayout::Jis;
        }
        match keyboard.dwNumberOfKeysTotal {
            101 | 104 => KeyboardLayout::Ansi,
            102 | 105 => KeyboardLayout::Iso,
            _ => KeyboardLayout::Unknown,
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

fn stable_id(path: &str) -> String {
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
    use super::*;

    fn raw(
        path: &str,
        container_id: Option<&str>,
        vendor_id: u16,
        product_id: u16,
    ) -> RawKeyboardInterface {
        RawKeyboardInterface {
            path: path.into(),
            container_id: container_id.map(str::to_string),
            vendor_id: Some(vendor_id),
            product_id: Some(product_id),
            layout: KeyboardLayout::Ansi,
        }
    }

    #[test]
    fn parses_usb_ids_from_raw_input_path() {
        let path = r"\\?\HID#VID_046D&PID_C52B&MI_00#7&abc";
        assert_eq!(parse_vid_pid(path), (Some(0x046D), Some(0xC52B)));
    }

    #[test]
    fn groups_two_interfaces_with_same_container_into_one_keyboard() {
        let devices = group_interfaces(vec![
            raw(
                "path-a",
                Some("{11111111-1111-1111-1111-111111111111}"),
                0x1234,
                0x5678,
            ),
            raw(
                "path-b",
                Some("{11111111-1111-1111-1111-111111111111}"),
                0x1234,
                0x5678,
            ),
        ]);
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].interface_paths, vec!["path-a", "path-b"]);
    }

    #[test]
    fn identical_vid_pid_different_containers_stay_distinct() {
        let devices = group_interfaces(vec![
            raw(
                "path-a",
                Some("{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}"),
                1,
                2,
            ),
            raw(
                "path-b",
                Some("{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}"),
                1,
                2,
            ),
        ]);
        assert_eq!(devices.len(), 2);
        assert_ne!(devices[0].id, devices[1].id);
    }

    #[test]
    fn missing_container_keeps_legacy_path_identity() {
        let devices = group_interfaces(vec![raw("path-a", None, 1, 2)]);
        assert_eq!(devices.len(), 1);
        assert!(devices[0].id.starts_with("windows-"));
        assert_eq!(devices[0].interface_paths, vec!["path-a"]);
    }
}
