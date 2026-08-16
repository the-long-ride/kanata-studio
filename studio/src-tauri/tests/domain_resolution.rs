use std::collections::BTreeMap;

use kanata_studio::domain::{
    ActionSpec, AppMatcher, DeviceTarget, ProfileSource, ResolutionContext, StudioProfile, UiMode,
    global_profile, resolve_profile,
};

fn key(value: &str) -> ActionSpec {
    ActionSpec::Key { key: value.into() }
}

fn visual_profile(id: &str, app: Option<&str>, device: DeviceTarget) -> StudioProfile {
    let mut profile = global_profile();
    profile.id = id.into();
    profile.name = id.into();
    profile.app_matcher = app.map(|executable| AppMatcher {
        executable: executable.into(),
        window_title_contains: None,
    });
    profile.device_target = device;
    profile
}

fn map(profile: &mut StudioProfile, key_name: &str, action: ActionSpec) {
    if let ProfileSource::Visual { mappings, .. } = &mut profile.source {
        mappings.insert(key_name.into(), action);
    }
}

#[test]
fn precedence_is_global_then_device_then_app_then_app_device() {
    let mut global = global_profile();
    map(&mut global, "caps", key("esc"));

    let mut device = visual_profile("device", None, DeviceTarget::Device { id: "kbd".into() });
    map(&mut device, "caps", key("tab"));

    let mut app = visual_profile("app", Some("code"), DeviceTarget::All);
    map(&mut app, "caps", key("f1"));

    let mut app_device = visual_profile(
        "app-device",
        Some("code"),
        DeviceTarget::Device { id: "kbd".into() },
    );
    map(&mut app_device, "caps", key("f2"));

    let resolved = resolve_profile(
        &[global, device, app, app_device],
        ResolutionContext {
            executable: Some("code"),
            window_title: None,
            device_id: Some("kbd"),
            ui_mode: UiMode::Advanced,
        },
    )
    .unwrap();

    assert_eq!(resolved.mappings.get("caps"), Some(&key("f2")));
    assert_eq!(
        resolved.contributing_profile_ids,
        vec!["global", "device", "app", "app-device"]
    );
}

#[test]
fn disabled_profiles_do_not_contribute() {
    let global = global_profile();
    let mut app = visual_profile("app", Some("code"), DeviceTarget::All);
    app.enabled = false;
    map(&mut app, "f8", key("f1"));

    let resolved = resolve_profile(
        &[global, app],
        ResolutionContext {
            executable: Some("code"),
            window_title: None,
            device_id: None,
            ui_mode: UiMode::Advanced,
        },
    )
    .unwrap();

    assert!(!resolved.mappings.contains_key("f8"));
}

#[test]
fn title_match_is_advanced_only() {
    let global = global_profile();
    let mut app = visual_profile("app", Some("code"), DeviceTarget::All);
    app.app_matcher.as_mut().unwrap().window_title_contains = Some("Project A".into());
    map(&mut app, "f8", key("f1"));

    let beginner = resolve_profile(
        &[global.clone(), app.clone()],
        ResolutionContext {
            executable: Some("code"),
            window_title: Some("Project A — Code"),
            device_id: None,
            ui_mode: UiMode::Beginner,
        },
    )
    .unwrap();
    assert!(!beginner.mappings.contains_key("f8"));

    let advanced = resolve_profile(
        &[global, app],
        ResolutionContext {
            executable: Some("code"),
            window_title: Some("Project A — Code"),
            device_id: None,
            ui_mode: UiMode::Advanced,
        },
    )
    .unwrap();
    assert_eq!(advanced.mappings.get("f8"), Some(&key("f1")));
}

#[test]
fn highest_priority_raw_profile_replaces_visual_composition() {
    let mut global = global_profile();
    map(&mut global, "caps", key("esc"));
    let mut raw = visual_profile("raw", Some("code"), DeviceTarget::All);
    raw.source = ProfileSource::Raw {
        kbd: "(defsrc)\n(deflayermap (base) caps tab)".into(),
    };

    let resolved = resolve_profile(
        &[global, raw],
        ResolutionContext {
            executable: Some("code"),
            window_title: None,
            device_id: None,
            ui_mode: UiMode::Advanced,
        },
    )
    .unwrap();

    assert_eq!(resolved.contributing_profile_ids, vec!["raw"]);
    assert!(resolved.mappings.is_empty());
    assert!(resolved.raw_kbd.unwrap().contains("caps tab"));
}

#[test]
fn mappings_are_deterministic_regardless_of_insertion_order() {
    let mut mappings = BTreeMap::new();
    mappings.insert("b".to_string(), key("2"));
    mappings.insert("a".to_string(), key("1"));
    assert_eq!(mappings.keys().cloned().collect::<Vec<_>>(), vec!["a", "b"]);
}
