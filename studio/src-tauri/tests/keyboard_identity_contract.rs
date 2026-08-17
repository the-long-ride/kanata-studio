use std::collections::BTreeMap;

use kanata_studio::{
    commands::keyboard_identity::{
        KeyboardIdentityMigrationReason, reconcile_keyboard_identities,
    },
    domain::{
        ActionSpec, ConfiguredKeyboard, DeviceTarget, KeyboardDevice, KeyboardLayout,
        ProfileSource, ResolutionContext, UiMode, device_global_profile, global_profile,
        resolve_profile,
    },
};
use sha2::{Digest, Sha256};

fn device(id: &str, vendor_id: Option<u16>, product_id: Option<u16>) -> KeyboardDevice {
    let path = format!(r"\\?\HID#{id}");
    KeyboardDevice {
        id: id.into(),
        name: format!("Detected {id}"),
        vendor_id,
        product_id,
        path: Some(path.clone()),
        interface_paths: vec![path],
        layout: KeyboardLayout::Ansi,
        manual_layout: None,
    }
}

fn configured(id: &str, vendor_id: Option<u16>, product_id: Option<u16>) -> ConfiguredKeyboard {
    ConfiguredKeyboard {
        id: id.into(),
        name: "My keyboard".into(),
        detected_name: "Old detected name".into(),
        vendor_id,
        product_id,
        layout_override: Some(KeyboardLayout::Iso),
    }
}

fn mapped_profile(id: &str) -> kanata_studio::domain::StudioProfile {
    device_global_profile(
        id,
        ProfileSource::Visual {
            mappings: BTreeMap::from([("caps".into(), ActionSpec::Key { key: "esc".into() })]),
            advanced: Default::default(),
        },
    )
}

fn legacy_windows_id_for_test(path: &str) -> String {
    let digest = Sha256::digest(path.as_bytes());
    format!("windows-{}", &hex::encode(digest)[..16])
}

#[test]
fn legacy_path_hash_matching_member_interface_migrates_to_container_id() {
    let path = r"\\?\HID#VID_1234&PID_5678&MI_01#OLD";
    let old = legacy_windows_id_for_test(path);
    let mut current = device(
        "windows-container-abcdef01-2345-6789-abcd-ef0123456789",
        Some(0x1234),
        Some(0x5678),
    );
    current.path = Some(path.into());
    current.interface_paths = vec![
        path.into(),
        r"\\?\HID#VID_1234&PID_5678&MI_00#OTHER".into(),
    ];

    let result = reconcile_keyboard_identities(
        &[configured(&old, Some(0x1234), Some(0x5678))],
        &[global_profile(), mapped_profile(&old)],
        &[current],
    )
    .unwrap();

    assert_eq!(
        result.keyboards[0].id,
        "windows-container-abcdef01-2345-6789-abcd-ef0123456789"
    );
    assert_eq!(
        result.migrations[0].reason,
        KeyboardIdentityMigrationReason::LegacyInterfacePath
    );
}

#[test]
fn physical_id_survives_interface_path_churn_and_resolves_mapping() {
    let id = "windows-container-abcdef01-2345-6789-abcd-ef0123456789";
    let mut current = device(id, Some(0x1234), Some(0x5678));
    current.path = Some(r"\\?\HID#NEW-PATH".into());
    current.interface_paths = vec![r"\\?\HID#NEW-PATH".into()];

    let result = reconcile_keyboard_identities(
        &[configured(id, Some(0x1234), Some(0x5678))],
        &[global_profile(), mapped_profile(id)],
        &[current],
    )
    .unwrap();
    assert!(!result.changed);

    let resolved = resolve_profile(
        &result.profiles,
        ResolutionContext {
            executable: None,
            window_title: None,
            device_id: Some(id),
            ui_mode: UiMode::Beginner,
        },
    )
    .unwrap();
    assert_eq!(
        resolved.mappings.get("caps"),
        Some(&ActionSpec::Key { key: "esc".into() })
    );
}

#[test]
fn unique_vid_pid_match_migrates_keyboard_and_runtime_mapping() {
    let result = reconcile_keyboard_identities(
        &[configured("old", Some(0x1234), Some(0x5678))],
        &[global_profile(), mapped_profile("old")],
        &[device("new", Some(0x1234), Some(0x5678))],
    )
    .unwrap();

    assert!(result.changed);
    assert_eq!(result.keyboards[0].id, "new");
    assert_eq!(result.keyboards[0].name, "My keyboard");
    assert_eq!(
        result.keyboards[0].layout_override,
        Some(KeyboardLayout::Iso)
    );
    assert_eq!(
        result.migrations[0].reason,
        KeyboardIdentityMigrationReason::UniqueVidPid
    );

    let migrated = result
        .profiles
        .iter()
        .find(|profile| matches!(profile.device_target, DeviceTarget::Device { .. }))
        .unwrap();
    assert_eq!(migrated.id, "keyboard-new-global");
    assert_eq!(
        migrated.device_target,
        DeviceTarget::Device { id: "new".into() }
    );

    let resolved = resolve_profile(
        &result.profiles,
        ResolutionContext {
            executable: None,
            window_title: None,
            device_id: Some("new"),
            ui_mode: UiMode::Beginner,
        },
    )
    .unwrap();
    assert_eq!(
        resolved.mappings.get("caps"),
        Some(&ActionSpec::Key { key: "esc".into() })
    );
}

#[test]
fn ambiguous_identical_devices_are_not_migrated() {
    let result = reconcile_keyboard_identities(
        &[configured("old", Some(1), Some(2))],
        &[global_profile(), mapped_profile("old")],
        &[
            device("new-a", Some(1), Some(2)),
            device("new-b", Some(1), Some(2)),
        ],
    )
    .unwrap();

    assert!(!result.changed);
    assert!(result.migrations.is_empty());
    assert_eq!(result.keyboards[0].id, "old");
    assert!(result.profiles.iter().any(|profile| matches!(
        &profile.device_target,
        DeviceTarget::Device { id } if id == "old"
    )));
}

#[test]
fn missing_vid_pid_is_not_migrated() {
    let result = reconcile_keyboard_identities(
        &[configured("old", None, Some(2))],
        &[global_profile(), mapped_profile("old")],
        &[device("new", Some(1), Some(2))],
    )
    .unwrap();

    assert!(!result.changed);
    assert!(result.migrations.is_empty());
    assert_eq!(result.keyboards[0].id, "old");
}

#[test]
fn already_current_id_is_idempotent() {
    let result = reconcile_keyboard_identities(
        &[configured("same", Some(1), Some(2))],
        &[global_profile(), mapped_profile("same")],
        &[device("same", Some(1), Some(2))],
    )
    .unwrap();

    assert!(!result.changed);
    assert!(result.migrations.is_empty());
    assert_eq!(result.keyboards[0].id, "same");
    assert!(result.profiles.iter().any(|profile| matches!(
        &profile.device_target,
        DeviceTarget::Device { id } if id == "same"
    )));
}
