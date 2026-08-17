use std::{
    fs::OpenOptions,
    io::Write,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::commands::keyboard_identity::{
    KeyboardIdentityMigration, KeyboardIdentityMigrationReason,
};

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

pub fn format_identity_migration(migration: &KeyboardIdentityMigration) -> String {
    format!(
        "identity-migration old={} new={} reason={}",
        migration.old_id,
        migration.new_id,
        migration_reason_label(migration.reason),
    )
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

fn migration_reason_label(reason: KeyboardIdentityMigrationReason) -> &'static str {
    match reason {
        KeyboardIdentityMigrationReason::LegacyInterfacePath => "legacy-interface-path",
        KeyboardIdentityMigrationReason::UniqueVidPid => "unique-vid-pid",
    }
}
