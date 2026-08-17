use std::path::PathBuf;

use thiserror::Error;

use crate::{
    compiler::device_scope::EngineDeviceScope,
    domain::{
        CapabilitySet, DeviceMappingCapability, DeviceTarget, KeyboardDevice, Platform,
        StudioProfile,
    },
};

use super::{EngineBackend, EngineId, EngineSpec};

#[derive(Debug)]
pub struct EngineTopology {
    pub engines: Vec<EngineSpec>,
    pub requires_restart: bool,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum CapabilityError {
    #[error("Windows Interception is required for specific-device profiles")]
    WindowsInterceptionRequired,
    #[error("specific-device mapping unavailable")]
    Unavailable,
    #[error("profile targets an unknown keyboard: {0}")]
    UnknownDevice(String),
}

pub fn plan_engine_topology(
    profiles: &[StudioProfile],
    devices: &[KeyboardDevice],
    capabilities: &CapabilitySet,
) -> Result<EngineTopology, CapabilityError> {
    let target_ids = profiles
        .iter()
        .filter(|profile| profile.enabled)
        .filter_map(|profile| match &profile.device_target {
            DeviceTarget::Device { id } => Some(id.clone()),
            DeviceTarget::All => None,
        })
        .filter(|id| devices.iter().any(|device| device.id == *id))
        .collect::<std::collections::BTreeSet<_>>();

    if target_ids.is_empty() {
        return Ok(EngineTopology {
            engines: vec![spec("all", EngineBackend::Standard, EngineDeviceScope::All)],
            requires_restart: false,
        });
    }

    match capabilities.per_device_mapping {
        DeviceMappingCapability::RequiresWindowsInterception => {
            return Err(CapabilityError::WindowsInterceptionRequired);
        }
        DeviceMappingCapability::Unavailable => return Err(CapabilityError::Unavailable),
        DeviceMappingCapability::Available => {}
    }

    let targets = target_ids
        .iter()
        .filter_map(|id| devices.iter().find(|device| device.id == *id).cloned())
        .collect::<Vec<_>>();

    let engines = match capabilities.platform {
        Platform::Macos => vec![spec(
            "mac-device-aware",
            EngineBackend::Standard,
            EngineDeviceScope::MacDeviceAware(targets),
        )],
        Platform::Windows => filtered_engines(EngineBackend::WindowsInterception, targets),
        Platform::Linux => filtered_engines(EngineBackend::Standard, targets),
    };

    Ok(EngineTopology {
        engines,
        requires_restart: true,
    })
}

fn filtered_engines(backend: EngineBackend, targets: Vec<KeyboardDevice>) -> Vec<EngineSpec> {
    let mut engines = targets
        .iter()
        .map(|device| {
            spec(
                &format!("device-{}", device.id),
                backend.clone(),
                EngineDeviceScope::IncludeDevice(device.clone()),
            )
        })
        .collect::<Vec<_>>();
    engines.push(spec(
        "fallback",
        backend,
        EngineDeviceScope::ExcludeDevices(targets),
    ));
    engines
}

fn spec(id: &str, backend: EngineBackend, scope: EngineDeviceScope) -> EngineSpec {
    EngineSpec {
        id: EngineId(id.into()),
        backend,
        config_path: PathBuf::from(format!("runtime/{id}.kbd")),
        device_scope: scope,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{KeyboardLayout, global_profile};
    use std::collections::BTreeMap;

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

    fn keyboard() -> KeyboardDevice {
        KeyboardDevice {
            id: "kbd".into(),
            name: "Keyboard".into(),
            vendor_id: Some(1),
            product_id: Some(2),
            path: Some("/dev/input/event0".into()),
            interface_paths: Vec::new(),
            layout: KeyboardLayout::Unknown,
            manual_layout: None,
        }
    }

    #[test]
    fn no_device_profiles_use_one_standard_engine() {
        let topology = plan_engine_topology(
            &[global_profile()],
            &[],
            &capabilities(
                Platform::Windows,
                DeviceMappingCapability::RequiresWindowsInterception,
            ),
        )
        .unwrap();
        assert_eq!(topology.engines.len(), 1);
        assert_eq!(topology.engines[0].backend, EngineBackend::Standard);
    }

    #[test]
    fn windows_never_silently_expands_specific_device_to_all() {
        let mut profile = global_profile();
        profile.device_target = DeviceTarget::Device { id: "kbd".into() };
        profile.id = "specific".into();
        profile.name = "Specific".into();
        profile.app_matcher = Some(crate::domain::AppMatcher {
            executable: "Code.exe".into(),
            window_title_contains: None,
        });
        let error = plan_engine_topology(
            &[global_profile(), profile],
            &[keyboard()],
            &capabilities(
                Platform::Windows,
                DeviceMappingCapability::RequiresWindowsInterception,
            ),
        )
        .unwrap_err();
        assert_eq!(error, CapabilityError::WindowsInterceptionRequired);
    }
}
