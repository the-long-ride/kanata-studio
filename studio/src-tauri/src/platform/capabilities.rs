use std::collections::BTreeMap;

use crate::domain::{CapabilitySet, DeviceMappingCapability, Platform};

pub fn current_capabilities(interception_available: bool) -> CapabilitySet {
    let platform = if cfg!(target_os = "windows") {
        Platform::Windows
    } else if cfg!(target_os = "macos") {
        Platform::Macos
    } else {
        Platform::Linux
    };
    let per_device_mapping = match platform {
        Platform::Windows if interception_available => DeviceMappingCapability::Available,
        Platform::Windows => DeviceMappingCapability::RequiresWindowsInterception,
        Platform::Macos | Platform::Linux => DeviceMappingCapability::Available,
    };
    let active_app = active_app_supported(platform);

    CapabilitySet {
        platform,
        per_app_auto_switch: active_app,
        per_device_mapping,
        window_title_matching: active_app,
        manual_profile_selection: true,
        permissions: BTreeMap::new(),
    }
}

pub fn windows_interception_available() -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::{Foundation::FreeLibrary, System::LibraryLoader::LoadLibraryW};
        let name = "interception.dll\0".encode_utf16().collect::<Vec<_>>();
        let module = LoadLibraryW(name.as_ptr());
        if module == 0 {
            return false;
        }
        FreeLibrary(module);
        true
    }

    #[cfg(not(target_os = "windows"))]
    false
}

fn active_app_supported(platform: Platform) -> bool {
    match platform {
        Platform::Windows | Platform::Macos => true,
        Platform::Linux => std::env::var_os("DISPLAY").is_some(),
    }
}
