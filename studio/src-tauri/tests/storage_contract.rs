use std::time::{SystemTime, UNIX_EPOCH};

use kanata_studio::{
    domain::{StudioSettings, UiMode, global_profile},
    storage::{
        JsonProfileStore, ProfileRepository, RecoveryStore, SettingsStore, StudioPaths,
        write_atomic,
    },
};

fn temp_paths(label: &str) -> StudioPaths {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    StudioPaths::new(std::env::temp_dir().join(format!(
        "kanata-studio-test-{label}-{}-{nonce}",
        std::process::id()
    )))
}

#[test]
fn profile_store_bootstraps_global_and_persists_changes() {
    let paths = temp_paths("profiles");
    let store = JsonProfileStore::new(paths.clone());
    let initial = store.load_all().unwrap();
    assert_eq!(initial, vec![global_profile()]);

    let mut changed = initial;
    changed[0].name = "My Global".into();
    store.save_all(&changed).unwrap();
    assert_eq!(store.load_all().unwrap()[0].name, "My Global");
    std::fs::remove_dir_all(paths.root).unwrap();
}

#[test]
fn settings_store_bootstraps_defaults_and_roundtrips() {
    let paths = temp_paths("settings");
    let store = SettingsStore::new(paths.clone());
    let mut settings = store.load().unwrap();
    assert!(settings.start_with_system);
    assert!(settings.stop_kanata_on_quit);
    settings.ui_mode = UiMode::Advanced;
    settings.remapping_enabled = false;
    store.save(&settings).unwrap();
    let loaded = store.load().unwrap();
    assert_eq!(loaded.ui_mode, UiMode::Advanced);
    assert!(!loaded.remapping_enabled);
    assert!(loaded.stop_kanata_on_quit);
    std::fs::remove_dir_all(paths.root).unwrap();
}

#[test]
fn legacy_settings_missing_quit_policy_defaults_to_true() {
    let json = r#"{
      "onboardingCompleted":true,
      "startWithSystem":false,
      "remappingEnabled":true,
      "deviceLayoutOverrides":{},
      "uiMode":"Beginner"
    }"#;
    let settings: StudioSettings = serde_json::from_str(json).unwrap();
    assert!(settings.stop_kanata_on_quit);
    assert!(StudioSettings::default().stop_kanata_on_quit);
}

#[test]
fn recovery_store_is_optional_then_roundtrips_last_known_good() {
    let paths = temp_paths("recovery");
    let store = RecoveryStore::new(paths.clone());
    assert_eq!(store.read_last_known_good("all").unwrap(), None);
    store.write_last_known_good("all", "valid config").unwrap();
    assert_eq!(
        store.read_last_known_good("all").unwrap().as_deref(),
        Some("valid config")
    );
    std::fs::remove_dir_all(paths.root).unwrap();
}

#[test]
fn atomic_write_leaves_no_temp_file_after_replace() {
    let paths = temp_paths("atomic");
    let target = paths.root.join("runtime").join("all.kbd");
    write_atomic(&target, "one").unwrap();
    write_atomic(&target, "two").unwrap();
    assert_eq!(std::fs::read_to_string(&target).unwrap(), "two");
    assert!(!target.with_extension("tmp").exists());
    std::fs::remove_dir_all(paths.root).unwrap();
}

#[test]
fn keyboard_device_without_interface_paths_deserializes_for_backcompat() {
    let json = r#"{
      "id":"legacy",
      "name":"Keyboard",
      "vendorId":1,
      "productId":2,
      "path":"legacy-path",
      "layout":"ansi",
      "manualLayout":null
    }"#;
    let device: kanata_studio::domain::KeyboardDevice = serde_json::from_str(json).unwrap();
    assert!(device.interface_paths.is_empty());
    assert_eq!(device.path.as_deref(), Some("legacy-path"));
}
