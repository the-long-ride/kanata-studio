use std::{mem, ptr};

use windows_sys::Win32::{
    Devices::{
        DeviceAndDriverInstallation::{
            SP_DEVICE_INTERFACE_DATA, SP_DEVICE_INTERFACE_DETAIL_DATA_W, SP_DEVINFO_DATA,
            SetupDiCreateDeviceInfoList, SetupDiDestroyDeviceInfoList,
            SetupDiGetDeviceInterfaceDetailW, SetupDiGetDevicePropertyW,
            SetupDiOpenDeviceInterfaceW,
        },
        Properties::DEVPKEY_Device_ContainerId,
    },
    Foundation::INVALID_HANDLE_VALUE,
};

use super::super::PlatformError;

struct DeviceInfoSet(isize);

impl Drop for DeviceInfoSet {
    fn drop(&mut self) {
        unsafe {
            SetupDiDestroyDeviceInfoList(self.0);
        }
    }
}

pub(crate) fn container_id_for_interface(path: &str) -> Result<Option<String>, PlatformError> {
    let wide = path.encode_utf16().chain(std::iter::once(0)).collect::<Vec<_>>();
    unsafe {
        let set = SetupDiCreateDeviceInfoList(ptr::null(), 0);
        if set == INVALID_HANDLE_VALUE {
            return Err(PlatformError::Other(
                "SetupDiCreateDeviceInfoList failed".into(),
            ));
        }
        let set = DeviceInfoSet(set);

        let mut interface_data = mem::zeroed::<SP_DEVICE_INTERFACE_DATA>();
        interface_data.cbSize = mem::size_of::<SP_DEVICE_INTERFACE_DATA>() as u32;
        if SetupDiOpenDeviceInterfaceW(set.0, wide.as_ptr(), 0, &mut interface_data) == 0 {
            return Ok(None);
        }

        let mut required = 0u32;
        SetupDiGetDeviceInterfaceDetailW(
            set.0,
            &interface_data,
            ptr::null_mut(),
            0,
            &mut required,
            ptr::null_mut(),
        );
        if required == 0 {
            return Ok(None);
        }

        let mut detail_buffer = vec![0u8; required as usize];
        let detail = detail_buffer
            .as_mut_ptr()
            .cast::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>();
        (*detail).cbSize = mem::size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32;
        let mut device_info = mem::zeroed::<SP_DEVINFO_DATA>();
        device_info.cbSize = mem::size_of::<SP_DEVINFO_DATA>() as u32;
        if SetupDiGetDeviceInterfaceDetailW(
            set.0,
            &interface_data,
            detail,
            required,
            ptr::null_mut(),
            &mut device_info,
        ) == 0
        {
            return Ok(None);
        }

        let mut property_type = 0u32;
        let mut container_bytes = [0u8; 16];
        let mut property_size = 0u32;
        if SetupDiGetDevicePropertyW(
            set.0,
            &device_info,
            &DEVPKEY_Device_ContainerId,
            &mut property_type,
            container_bytes.as_mut_ptr(),
            container_bytes.len() as u32,
            &mut property_size,
            0,
        ) == 0
            || property_size < container_bytes.len() as u32
        {
            return Ok(None);
        }

        Ok(Some(format_guid_bytes(container_bytes)))
    }
}

pub(crate) fn physical_id_from_container(container_id: &str) -> String {
    format!(
        "windows-container-{}",
        container_id
            .trim()
            .trim_matches(['{', '}'])
            .to_ascii_lowercase()
    )
}

fn format_guid_bytes(bytes: [u8; 16]) -> String {
    let data1 = u32::from_le_bytes(bytes[0..4].try_into().expect("four bytes"));
    let data2 = u16::from_le_bytes(bytes[4..6].try_into().expect("two bytes"));
    let data3 = u16::from_le_bytes(bytes[6..8].try_into().expect("two bytes"));
    format!(
        "{data1:08x}-{data2:04x}-{data3:04x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15],
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn physical_id_normalizes_container_guid_text() {
        assert_eq!(
            physical_id_from_container("{ABCDEF01-2345-6789-ABCD-EF0123456789}"),
            "windows-container-abcdef01-2345-6789-abcd-ef0123456789"
        );
    }

    #[test]
    fn guid_property_bytes_format_canonically() {
        let bytes = [
            0x01, 0xef, 0xcd, 0xab, 0x45, 0x23, 0x89, 0x67, 0xab, 0xcd, 0xef, 0x01, 0x23,
            0x45, 0x67, 0x89,
        ];
        assert_eq!(
            format_guid_bytes(bytes),
            "abcdef01-2345-6789-abcd-ef0123456789"
        );
    }
}
