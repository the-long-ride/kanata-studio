use std::path::Path;

use thiserror::Error;

use crate::{
    app_state::AppState,
    compiler::{
        CompileContext, CompiledConfig, compile_resolved,
        device_scope::EngineDeviceScope,
        mac_device::{DeviceResolved, compile_device_aware},
    },
    domain::{ProfileSource, ResolutionContext, resolve_profile},
    engine::{
        EngineId, EngineSpec, EngineState, EngineSupervisor, EngineTopology, plan_engine_topology,
    },
    storage::{StorageError, profile_store::write_atomic},
    validation::validate_kbd,
};

#[derive(Debug, Error)]
pub enum RuntimeApplyError {
    #[error("profile resolution: {0}")]
    Profile(String),
    #[error("topology: {0}")]
    Topology(String),
    #[error("compile: {0}")]
    Compile(String),
    #[error("invalid generated Kanata config for {0}: {1}")]
    InvalidConfig(String, String),
    #[error("runtime storage: {0}")]
    Storage(#[from] StorageError),
    #[error("engine: {0}")]
    Engine(String),
}

struct PreparedEngine {
    spec: EngineSpec,
    compiled: CompiledConfig,
    profile_label: Option<String>,
    device_label: Option<String>,
}

pub fn apply_current_context(state: &AppState) -> Result<(), RuntimeApplyError> {
    if !state.settings.read().remapping_enabled {
        return pause_all(state);
    }

    let profiles = state.profiles.read().clone();
    let devices = state.devices.read().clone();
    let capabilities = state.capabilities.read().clone();
    let topology = plan_engine_topology(&profiles, &devices, &capabilities)
        .map_err(|error| RuntimeApplyError::Topology(error.to_string()))?;
    let prepared = prepare_engines(state, topology, &profiles)?;

    let signature = topology_signature(&prepared);
    let topology_changed = state.topology_signature.read().as_deref() != Some(signature.as_str());
    let statuses = state.supervisor.status();

    if topology_changed {
        for status in statuses
            .iter()
            .filter(|status| status.state != EngineState::Stopped)
        {
            let _ = state.supervisor.stop(&EngineId(status.id.clone()));
        }
    }

    for item in &prepared {
        write_atomic(&item.spec.config_path, &item.compiled.text)?;
        let running = !topology_changed
            && statuses
                .iter()
                .any(|status| status.id == item.spec.id.0 && status.state == EngineState::Running);
        let result = if running {
            state
                .supervisor
                .reload(&item.spec.id, &item.spec.config_path)
        } else {
            state.supervisor.start(item.spec.clone()).map(|_| ())
        };

        if let Err(error) = result {
            restore_last_known_good(state, &item.spec.id, &item.spec.config_path);
            return Err(RuntimeApplyError::Engine(error.to_string()));
        }
        state
            .supervisor
            .set_action_bindings(&item.spec.id, item.compiled.action_bindings.clone())
            .map_err(|error| RuntimeApplyError::Engine(error.to_string()))?;
        state.supervisor.set_status_context(
            &item.spec.id,
            item.profile_label.clone(),
            item.device_label.clone(),
        );
        state
            .recovery
            .write_last_known_good(&item.spec.id.0, &item.compiled.text)?;
    }

    *state.topology_signature.write() = Some(signature);
    Ok(())
}

pub fn pause_all(state: &AppState) -> Result<(), RuntimeApplyError> {
    for status in state.supervisor.status() {
        if status.state != EngineState::Stopped {
            state
                .supervisor
                .stop(&EngineId(status.id))
                .map_err(|error| RuntimeApplyError::Engine(error.to_string()))?;
        }
    }
    Ok(())
}

pub fn resume_all(state: &AppState) -> Result<(), RuntimeApplyError> {
    apply_current_context(state)
}

fn prepare_engines(
    state: &AppState,
    topology: EngineTopology,
    profiles: &[crate::domain::StudioProfile],
) -> Result<Vec<PreparedEngine>, RuntimeApplyError> {
    let app = effective_app_context(state, profiles);
    let settings = state.settings.read().clone();
    let capabilities = state.capabilities.read().clone();
    let mut prepared = Vec::new();

    for mut spec in topology.engines {
        spec.config_path = state.paths.runtime(&spec.id.0);
        let compiled = if matches!(spec.device_scope, EngineDeviceScope::MacDeviceAware(_)) {
            compile_mac(
                state,
                profiles,
                &spec.device_scope,
                app.as_ref(),
                settings.ui_mode.clone(),
            )?
        } else {
            let device_id = included_device_id(&spec.device_scope);
            let resolved = resolve_profile(
                profiles,
                ResolutionContext {
                    executable: app.as_ref().map(|value| value.executable.as_str()),
                    window_title: app.as_ref().and_then(|value| value.window_title.as_deref()),
                    device_id,
                    ui_mode: settings.ui_mode.clone(),
                },
            )
            .map_err(|error| RuntimeApplyError::Profile(error.to_string()))?;
            compile_resolved(
                &resolved,
                CompileContext {
                    platform: capabilities.platform,
                    device_scope: &spec.device_scope,
                },
            )
            .map_err(|error| RuntimeApplyError::Compile(error.to_string()))?
        };

        let validation = validate_kbd(&compiled.text);
        if !validation.ok {
            return Err(RuntimeApplyError::InvalidConfig(
                spec.id.0.clone(),
                validation
                    .message
                    .unwrap_or_else(|| "unknown parser error".into()),
            ));
        }
        let profile_label = app.as_ref().map(|active| active.executable.clone());
        let device_label = included_device_id(&spec.device_scope).map(str::to_string);
        prepared.push(PreparedEngine {
            spec,
            compiled,
            profile_label,
            device_label,
        });
    }
    Ok(prepared)
}

fn effective_app_context(
    state: &AppState,
    profiles: &[crate::domain::StudioProfile],
) -> Option<crate::platform::active_app::ActiveApp> {
    if let Some(id) = state.manual_profile_id.read().clone() {
        let profile = profiles.iter().find(|profile| profile.id == id)?;
        return profile.app_matcher.as_ref().map(|matcher| {
            crate::platform::active_app::ActiveApp {
                executable: matcher.executable.clone(),
                window_title: matcher.window_title_contains.clone(),
            }
        });
    }
    state.active_app.read().clone()
}

fn compile_mac(
    _state: &AppState,
    profiles: &[crate::domain::StudioProfile],
    scope: &EngineDeviceScope,
    app: Option<&crate::platform::active_app::ActiveApp>,
    ui_mode: crate::domain::UiMode,
) -> Result<CompiledConfig, RuntimeApplyError> {
    let EngineDeviceScope::MacDeviceAware(devices) = scope else {
        unreachable!();
    };
    if profiles.iter().any(|profile| {
        matches!(profile.source, ProfileSource::Raw { .. })
            && !matches!(profile.device_target, crate::domain::DeviceTarget::All)
    }) {
        return Err(RuntimeApplyError::Compile(
            "device-specific Raw Kanata profiles cannot be merged on macOS".into(),
        ));
    }

    let fallback = resolve_profile(
        profiles,
        ResolutionContext {
            executable: app.map(|value| value.executable.as_str()),
            window_title: app.and_then(|value| value.window_title.as_deref()),
            device_id: None,
            ui_mode: ui_mode.clone(),
        },
    )
    .map_err(|error| RuntimeApplyError::Profile(error.to_string()))?;
    let resolved_devices = devices
        .iter()
        .map(|device| {
            resolve_profile(
                profiles,
                ResolutionContext {
                    executable: app.map(|value| value.executable.as_str()),
                    window_title: app.and_then(|value| value.window_title.as_deref()),
                    device_id: Some(&device.id),
                    ui_mode: ui_mode.clone(),
                },
            )
        })
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| RuntimeApplyError::Profile(error.to_string()))?;
    let entries = devices
        .iter()
        .zip(resolved_devices.iter())
        .map(|(device, profile)| DeviceResolved { device, profile })
        .collect::<Vec<_>>();
    compile_device_aware(&fallback, &entries)
        .map_err(|error| RuntimeApplyError::Compile(error.to_string()))
}

fn included_device_id(scope: &EngineDeviceScope) -> Option<&str> {
    match scope {
        EngineDeviceScope::IncludeDevice(device) => Some(device.id.as_str()),
        _ => None,
    }
}

fn topology_signature(prepared: &[PreparedEngine]) -> String {
    prepared
        .iter()
        .map(|item| {
            format!(
                "{}:{:?}:{:?}",
                item.spec.id.0, item.spec.backend, item.spec.device_scope
            )
        })
        .collect::<Vec<_>>()
        .join("|")
}

fn restore_last_known_good(state: &AppState, id: &EngineId, runtime_path: &Path) {
    if let Ok(Some(text)) = state.recovery.read_last_known_good(&id.0)
        && write_atomic(runtime_path, &text).is_ok()
    {
        let _ = state.supervisor.reload(id, runtime_path);
    }
}
