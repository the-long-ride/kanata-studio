use kanata_studio::{
    commands::keyboard_identity::{KeyboardIdentityMigration, KeyboardIdentityMigrationReason},
    runtime::diagnostics::{
        RuntimeResolutionDiagnostic, format_identity_migration, format_resolution_diagnostic,
    },
};

#[test]
fn zero_mapping_diagnostic_is_explicit() {
    let line = format_resolution_diagnostic(&RuntimeResolutionDiagnostic {
        engine_id: "all",
        device_id: None,
        interface_count: 0,
        contributing_profile_ids: &[],
        base_mapping_count: 0,
        advanced_layer_count: 0,
        raw_profile: false,
    });
    assert!(line.contains("engine=all"));
    assert!(line.contains("baseMappings=0"));
    assert!(line.contains("profiles=[]"));
    assert!(line.contains("raw=false"));
}

#[test]
fn migration_diagnostic_records_old_new_and_reason() {
    let line = format_identity_migration(&KeyboardIdentityMigration {
        old_id: "windows-old".into(),
        new_id: "windows-container-new".into(),
        reason: KeyboardIdentityMigrationReason::LegacyInterfacePath,
    });
    assert!(line.contains("old=windows-old"));
    assert!(line.contains("new=windows-container-new"));
    assert!(line.contains("reason=legacy-interface-path"));
}
