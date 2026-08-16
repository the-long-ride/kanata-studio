use std::collections::BTreeMap;

pub fn status() -> BTreeMap<String, bool> {
    let mut permissions = BTreeMap::new();

    #[cfg(target_os = "linux")]
    {
        permissions.insert(
            "input devices".into(),
            std::fs::read_dir("/dev/input").is_ok(),
        );
        permissions.insert(
            "uinput".into(),
            std::fs::OpenOptions::new()
                .write(true)
                .open("/dev/uinput")
                .is_ok(),
        );
    }

    #[cfg(target_os = "macos")]
    {
        let accessibility = std::process::Command::new("osascript")
            .args([
                "-e",
                "tell application \"System Events\" to get name of first process whose frontmost is true",
            ])
            .output()
            .is_ok_and(|output| output.status.success());
        permissions.insert("Accessibility".into(), accessibility);
        permissions.insert(
            "Karabiner VirtualHID".into(),
            !karabiner_driverkit::fetch_devices().is_empty(),
        );
    }

    #[cfg(target_os = "windows")]
    permissions.insert("standard backend".into(), true);

    permissions
}
