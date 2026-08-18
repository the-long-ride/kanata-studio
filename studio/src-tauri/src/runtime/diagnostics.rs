use std::{
    fs::OpenOptions,
    io::Write,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    app_state::AppState,
    commands::keyboard_identity::{KeyboardIdentityMigration, KeyboardIdentityMigrationReason},
    compiler::device_scope::EngineDeviceScope,
    domain::ResolvedProfile,
};

#[derive(Default)]
pub struct PreparedDiagnostic {
    pub contributing_profile_ids: Vec<String>,
    pub base_mapping_count: usize,
    pub advanced_layer_count: usize,
    pub raw_profile: bool,
    pub interface_count: usize,
}

impl PreparedDiagnostic {
    pub fn for_scope(scope: &EngineDeviceScope) -> Self {
        Self {
            interface_count: interface_count(scope),
            ..Default::default()
        }
    }

    pub fn capture_resolved(&mut self, resolved: &ResolvedProfile) {
        self.contributing_profile_ids = resolved.contributing_profile_ids.clone();
        self.base_mapping_count = resolved.mappings.len();
        self.advanced_layer_count = resolved.layers.len();
        self.raw_profile = resolved.raw_kbd.is_some();
    }
}

pub struct RuntimeResolutionDiagnostic<'a> {
    pub engine_id: &'a str,
    pub device_id: Option<&'a str>,
    pub interface_count: usize,
    pub contributing_profile_ids: &'a [String],
    pub base_mapping_count: usize,
    pub advanced_layer_count: usize,
    pub raw_profile: bool,
}

pub fn format_resolution_diagnostic(diagnostic: &RuntimeResolutionDiagnostic<'_>) -> String {
    let profiles = diagnostic.contributing_profile_ids.join(",");
    format!(
        "resolve engine={} device={} interfaces={} profiles=[{}] baseMappings={} advancedLayers={} raw={}",
        diagnostic.engine_id,
        diagnostic.device_id.unwrap_or("all"),
        diagnostic.interface_count,
        profiles,
        diagnostic.base_mapping_count,
        diagnostic.advanced_layer_count,
        diagnostic.raw_profile,
    )
}

pub fn log_resolution(
    state: &AppState,
    engine_id: &str,
    device_id: Option<&str>,
    diagnostic: &PreparedDiagnostic,
) {
    let line = format_resolution_diagnostic(&RuntimeResolutionDiagnostic {
        engine_id,
        device_id,
        interface_count: diagnostic.interface_count,
        contributing_profile_ids: &diagnostic.contributing_profile_ids,
        base_mapping_count: diagnostic.base_mapping_count,
        advanced_layer_count: diagnostic.advanced_layer_count,
        raw_profile: diagnostic.raw_profile,
    });
    let _ = append_runtime_diagnostic(&state.paths.logs(), &line);
}

pub fn format_identity_migration(migration: &KeyboardIdentityMigration) -> String {
    format!(
        "identity-migration old={} new={} reason={}",
        migration.old_id,
        migration.new_id,
        migration_reason_label(migration.reason),
    )
}

pub fn log_pending_identity_migrations(state: &AppState) {
    let migrations = state.identity_migrations.read().clone();
    if migrations.is_empty() {
        return;
    }
    let all_logged = migrations.iter().all(|migration| {
        append_runtime_diagnostic(&state.paths.logs(), &format_identity_migration(migration))
            .is_ok()
    });
    if all_logged {
        state.identity_migrations.write().clear();
    }
}

pub fn append_runtime_diagnostic(logs_dir: &Path, line: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(logs_dir)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(logs_dir.join("studio-runtime.log"))?;
    writeln!(file, "{timestamp} {line}")
}

fn interface_count(scope: &EngineDeviceScope) -> usize {
    match scope {
        EngineDeviceScope::IncludeDevice(device) if device.interface_paths.is_empty() => {
            usize::from(device.path.is_some())
        }
        EngineDeviceScope::IncludeDevice(device) => device.interface_paths.len(),
        _ => 0,
    }
}

fn migration_reason_label(reason: KeyboardIdentityMigrationReason) -> &'static str {
    match reason {
        KeyboardIdentityMigrationReason::LegacyInterfacePath => "legacy-interface-path",
        KeyboardIdentityMigrationReason::UniqueVidPid => "unique-vid-pid",
    }
}
