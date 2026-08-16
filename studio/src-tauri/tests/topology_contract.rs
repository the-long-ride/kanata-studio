use std::collections::BTreeMap;

use kanata_studio::{
    compiler::device_scope::EngineDeviceScope,
    domain::{
        AppMatcher, CapabilitySet, DeviceMappingCapability, DeviceTarget, KeyboardDevice,
        KeyboardLayout, Platform, global_profile,
    },
    engine::{
        EngineBackend,
        topology::{CapabilityError, plan_engine_topology},
    },
};

fn capabilities(platform: Platform, mapping: DeviceMappingCapability) -> CapabilitySet {
    CapabilitySet {
        platform,
        per_app_auto_switch: true,
        per_device_mapping: mapping,
        window_title_matching: true,
        manual_profile_selection: true,
        permissions: BTreeMap::new(),
    }
}

fn keyboard(id: &str) -> KeyboardDevice {
    KeyboardDevice {
        id: id.into(),
        name: format!("Keyboard {id}"),
        vendor_id: Some(0x1234),
        product_id: Some(0x5678),
        path: Some(format!("/dev/input/{id}")),
        layout: KeyboardLayout::Ansi,
        manual_layout: None,
    }
}

fn targeted(id: &str) -> kanata_studio::domain::StudioProfile {
    let mut profile = global_profile();
    profile.id = format!("app-{id}");
    profile.name = format!("App {id}");
    profile.app_matcher = Some(AppMatcher {
        executable: "code".into(),
        window_title_contains: None,
    });
    profile.device_target = DeviceTarget::Device { id: id.into() };
    profile
}

#[test]
fn all_keyboard_profiles_use_single_standard_engine_without_restart() {
    let topology = plan_engine_topology(
        &[global_profile()],
        &[],
        &capabilities(
            Platform::Windows,
            DeviceMappingCapability::RequiresWindowsInterception,
        ),
    )
    .unwrap();
    assert!(!topology.requires_restart);
    assert_eq!(topology.engines.len(), 1);
    assert_eq!(topology.engines[0].backend, EngineBackend::Standard);
}

#[test]
fn windows_specific_device_requires_interception_when_missing() {
    let error = plan_engine_topology(
        &[global_profile(), targeted("kbd")],
        &[keyboard("kbd")],
        &capabilities(
            Platform::Windows,
            DeviceMappingCapability::RequiresWindowsInterception,
        ),
    )
    .unwrap_err();
    assert_eq!(error, CapabilityError::WindowsInterceptionRequired);
}

#[test]
fn windows_specific_device_creates_interception_engine_and_fallback() {
    let topology = plan_engine_topology(
        &[global_profile(), targeted("kbd")],
        &[keyboard("kbd")],
        &capabilities(Platform::Windows, DeviceMappingCapability::Available),
    )
    .unwrap();
    assert!(topology.requires_restart);
    assert_eq!(topology.engines.len(), 2);
    assert!(
        topology
            .engines
            .iter()
            .all(|engine| engine.backend == EngineBackend::WindowsInterception)
    );
    assert!(matches!(
        topology.engines[0].device_scope,
        EngineDeviceScope::IncludeDevice(_)
    ));
    assert!(matches!(
        topology.engines[1].device_scope,
        EngineDeviceScope::ExcludeDevices(_)
    ));
}

#[test]
fn linux_specific_device_creates_filtered_standard_engines() {
    let topology = plan_engine_topology(
        &[global_profile(), targeted("kbd")],
        &[keyboard("kbd")],
        &capabilities(Platform::Linux, DeviceMappingCapability::Available),
    )
    .unwrap();
    assert_eq!(topology.engines.len(), 2);
    assert!(
        topology
            .engines
            .iter()
            .all(|engine| engine.backend == EngineBackend::Standard)
    );
}

#[test]
fn macos_specific_devices_use_one_device_aware_engine() {
    let topology = plan_engine_topology(
        &[global_profile(), targeted("kbd")],
        &[keyboard("kbd")],
        &capabilities(Platform::Macos, DeviceMappingCapability::Available),
    )
    .unwrap();
    assert_eq!(topology.engines.len(), 1);
    assert!(matches!(
        topology.engines[0].device_scope,
        EngineDeviceScope::MacDeviceAware(_)
    ));
}

#[test]
fn disconnected_target_device_is_ignored() {
    let topology = plan_engine_topology(
        &[global_profile(), targeted("missing")],
        &[keyboard("kbd")],
        &capabilities(Platform::Linux, DeviceMappingCapability::Available),
    )
    .unwrap();
    assert!(!topology.requires_restart);
    assert_eq!(topology.engines.len(), 1);
    assert_eq!(topology.engines[0].backend, EngineBackend::Standard);
    assert!(matches!(
        topology.engines[0].device_scope,
        EngineDeviceScope::All
    ));
}
