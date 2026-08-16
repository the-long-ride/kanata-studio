use std::collections::BTreeMap;

use kanata_studio::{
    compiler::{CompileContext, compile_resolved, device_scope::EngineDeviceScope},
    domain::{
        ActionSpec, AdvancedActionSpec, MediaAction, Modifier, Platform, ResolvedProfile,
        VisualLayer,
    },
};

fn resolved(mappings: BTreeMap<String, ActionSpec>) -> ResolvedProfile {
    ResolvedProfile {
        contributing_profile_ids: vec!["global".into()],
        mappings,
        layers: Vec::new(),
        raw_kbd: None,
    }
}

fn compile(
    platform: Platform,
    mappings: BTreeMap<String, ActionSpec>,
) -> kanata_studio::compiler::CompiledConfig {
    compile_resolved(
        &resolved(mappings),
        CompileContext {
            platform,
            device_scope: &EngineDeviceScope::All,
        },
    )
    .unwrap()
}

#[test]
fn compiles_all_beginner_native_actions() {
    let mappings = BTreeMap::from([
        ("a".into(), ActionSpec::Key { key: "b".into() }),
        (
            "c".into(),
            ActionSpec::Shortcut {
                modifiers: vec![Modifier::Ctrl, Modifier::Shift],
                key: "p".into(),
            },
        ),
        (
            "f8".into(),
            ActionSpec::Media {
                action: MediaAction::PlayPause,
            },
        ),
        ("f9".into(), ActionSpec::Disabled),
    ]);
    let compiled = compile(Platform::Linux, mappings);
    assert!(compiled.text.contains("a b"));
    assert!(compiled.text.contains("c C-S-p"));
    assert!(compiled.text.contains("f8 pp"));
    assert!(compiled.text.contains("f9 XX"));
}

#[test]
fn external_beginner_actions_never_emit_shell_commands() {
    let mappings = BTreeMap::from([
        (
            "f1".into(),
            ActionSpec::Text {
                text: "hello".into(),
            },
        ),
        (
            "f2".into(),
            ActionSpec::LaunchApp {
                path: "/usr/bin/code".into(),
                args: vec![".".into()],
            },
        ),
        (
            "f3".into(),
            ActionSpec::OpenUrl {
                url: "https://example.com".into(),
            },
        ),
    ]);
    let compiled = compile(Platform::Linux, mappings);
    assert_eq!(compiled.action_bindings.len(), 3);
    assert!(compiled.text.matches("push-msg").count() >= 3);
    assert!(!compiled.text.contains("(cmd "));
    assert!(compiled.text.contains("studio-paste C-v"));
}

#[test]
fn text_uses_macos_paste_binding_on_macos() {
    let compiled = compile(
        Platform::Macos,
        BTreeMap::from([(
            "f1".into(),
            ActionSpec::Text {
                text: "hello".into(),
            },
        )]),
    );
    assert!(compiled.text.contains("studio-paste M-v"));
}

#[test]
fn raw_profile_is_passed_through_byte_for_byte() {
    let text = "(defsrc)\n(deflayermap (base) caps esc)\n";
    let profile = ResolvedProfile {
        contributing_profile_ids: vec!["raw".into()],
        mappings: BTreeMap::new(),
        layers: Vec::new(),
        raw_kbd: Some(text.into()),
    };
    let compiled = compile_resolved(
        &profile,
        CompileContext {
            platform: Platform::Windows,
            device_scope: &EngineDeviceScope::All,
        },
    )
    .unwrap();
    assert_eq!(compiled.text, text);
    assert!(compiled.action_bindings.is_empty());
}

#[test]
fn visual_hash_is_stable_for_same_input() {
    let mappings = BTreeMap::from([("caps".into(), ActionSpec::Key { key: "esc".into() })]);
    let one = compile(Platform::Linux, mappings.clone());
    let two = compile(Platform::Linux, mappings);
    assert_eq!(one.sha256, two.sha256);
}

#[test]
fn invalid_key_atom_is_rejected() {
    let result = compile_resolved(
        &resolved(BTreeMap::from([(
            "bad key".into(),
            ActionSpec::Key { key: "esc".into() },
        )])),
        CompileContext {
            platform: Platform::Linux,
            device_scope: &EngineDeviceScope::All,
        },
    );
    assert!(result.is_err());
}

#[test]
fn advanced_layers_tap_hold_and_macro_compile() {
    let mut profile = resolved(BTreeMap::from([(
        "caps".into(),
        ActionSpec::Advanced {
            action: AdvancedActionSpec::TapHold {
                tap: Box::new(ActionSpec::Key { key: "esc".into() }),
                hold: Box::new(ActionSpec::Advanced {
                    action: AdvancedActionSpec::LayerMomentary {
                        layer: "nav".into(),
                    },
                }),
                timeout_ms: 180,
            },
        },
    )]));
    profile.layers.push(VisualLayer {
        name: "nav".into(),
        mappings: BTreeMap::from([(
            "h".into(),
            ActionSpec::Advanced {
                action: AdvancedActionSpec::Macro {
                    actions: vec![
                        ActionSpec::Key { key: "left".into() },
                        ActionSpec::Key { key: "left".into() },
                    ],
                },
            },
        )]),
    });
    let compiled = compile_resolved(
        &profile,
        CompileContext {
            platform: Platform::Linux,
            device_scope: &EngineDeviceScope::All,
        },
    )
    .unwrap();
    assert!(
        compiled
            .text
            .contains("tap-hold 180 180 esc (layer-while-held nav)")
    );
    assert!(compiled.text.contains("deflayermap (nav)"));
    assert!(compiled.text.contains("(macro left left)"));
}
