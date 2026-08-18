use std::collections::BTreeMap;

use crate::domain::{
    ActionSpec, ChordEntry, ChordSet, Modifier, Platform, ResolvedProfile, VisualLayer,
};

use super::{CompileContext, compile_visual, device_scope::EngineDeviceScope};

fn chord_set(name: &str, layers: &[&str], chords: Vec<ChordEntry>) -> ChordSet {
    ChordSet {
        name: name.into(),
        timeout_ms: 50,
        layers: layers.iter().map(|layer| (*layer).into()).collect(),
        chords,
    }
}

fn chord(keys: &[&str], action: ActionSpec) -> ChordEntry {
    ChordEntry {
        keys: keys.iter().map(|key| (*key).into()).collect(),
        action,
    }
}

fn visual(chord_sets: Vec<ChordSet>, layers: Vec<VisualLayer>) -> ResolvedProfile {
    ResolvedProfile {
        contributing_profile_ids: Vec::new(),
        mappings: BTreeMap::new(),
        layers,
        chord_sets,
        raw_kbd: None,
    }
}

fn compile(profile: &ResolvedProfile) -> super::CompiledConfig {
    compile_visual(
        profile,
        CompileContext {
            platform: Platform::Linux,
            device_scope: &EngineDeviceScope::All,
        },
    )
    .unwrap()
}

#[test]
fn emits_one_defchordsv2_with_overlapping_sizes() {
    let set = chord_set(
        "Editing",
        &[],
        vec![
            chord(
                &["j", "k"],
                ActionSpec::Key { key: "esc".into() },
            ),
            chord(
                &["j", "k", "l"],
                ActionSpec::Shortcut {
                    modifiers: vec![Modifier::Ctrl, Modifier::Shift],
                    key: "p".into(),
                },
            ),
        ],
    );
    let compiled = compile(&visual(vec![set], vec![]));
    assert_eq!(compiled.text.matches("(defchordsv2").count(), 1);
    assert!(
        compiled
            .text
            .contains("(j k) esc 50 first-release ()")
    );
    assert!(
        compiled
            .text
            .contains("(j k l) C-S-p 50 first-release ()")
    );
}

#[test]
fn selected_layers_compile_to_disabled_layers() {
    let set = chord_set(
        "Base only",
        &["base"],
        vec![chord(
            &["j", "k"],
            ActionSpec::Key { key: "esc".into() },
        )],
    );
    let nav = VisualLayer {
        name: "nav".into(),
        mappings: BTreeMap::new(),
    };
    let compiled = compile(&visual(vec![set], vec![nav]));
    assert!(
        compiled
            .text
            .contains("(j k) esc 50 first-release (nav)")
    );
}

#[test]
fn later_profile_chord_overrides_same_trigger() {
    let global = chord_set(
        "Global",
        &[],
        vec![chord(
            &["j", "k"],
            ActionSpec::Key { key: "esc".into() },
        )],
    );
    let app = chord_set(
        "App",
        &[],
        vec![chord(
            &["k", "j"],
            ActionSpec::Key { key: "p".into() },
        )],
    );
    let compiled = compile(&visual(vec![global, app], vec![]));
    assert_eq!(compiled.text.matches("  (j k) ").count(), 1);
    assert!(compiled.text.contains("(j k) p 50 first-release ()"));
}

#[test]
fn layer_specific_override_uses_switch_action() {
    let global = chord_set(
        "Global",
        &[],
        vec![chord(
            &["j", "k"],
            ActionSpec::Key { key: "esc".into() },
        )],
    );
    let nav_override = chord_set(
        "Navigation",
        &["nav"],
        vec![chord(
            &["j", "k"],
            ActionSpec::Key { key: "tab".into() },
        )],
    );
    let nav = VisualLayer {
        name: "nav".into(),
        mappings: BTreeMap::new(),
    };
    let compiled = compile(&visual(vec![global, nav_override], vec![nav]));
    assert!(compiled.text.contains("(switch"));
    assert!(compiled.text.contains("((layer base)) esc break"));
    assert!(compiled.text.contains("((layer nav)) tab break"));
}

#[test]
fn rejects_malformed_chord_inputs() {
    let too_short = chord_set(
        "Bad",
        &[],
        vec![chord(
            &["j"],
            ActionSpec::Key { key: "esc".into() },
        )],
    );
    assert!(compile_visual(
        &visual(vec![too_short], vec![]),
        CompileContext {
            platform: Platform::Linux,
            device_scope: &EngineDeviceScope::All,
        },
    )
    .is_err());

    let duplicate = chord_set(
        "Bad",
        &[],
        vec![chord(
            &["j", "j"],
            ActionSpec::Key { key: "esc".into() },
        )],
    );
    assert!(compile_visual(
        &visual(vec![duplicate], vec![]),
        CompileContext {
            platform: Platform::Linux,
            device_scope: &EngineDeviceScope::All,
        },
    )
    .is_err());
}

#[test]
fn chord_external_action_registers_binding() {
    let set = chord_set(
        "External",
        &[],
        vec![chord(
            &["j", "k"],
            ActionSpec::OpenUrl {
                url: "https://example.com".into(),
            },
        )],
    );
    let compiled = compile(&visual(vec![set], vec![]));
    assert!(compiled.text.contains("push-msg"));
    assert_eq!(compiled.action_bindings.len(), 1);
}
