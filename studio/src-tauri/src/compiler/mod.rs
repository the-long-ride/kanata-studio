pub mod advanced;
pub mod basic;
pub mod chords;
pub mod device_scope;
pub mod escape;
pub mod mac_device;
#[cfg(test)]
mod chords_test;

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::domain::{Platform, ResolvedProfile};
use device_scope::EngineDeviceScope;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StudioExternalAction {
    Text { text: String },
    LaunchApp { path: String, args: Vec<String> },
    OpenUrl { url: String },
}

pub struct CompileContext<'a> {
    pub platform: Platform,
    pub device_scope: &'a EngineDeviceScope,
}

pub struct CompiledConfig {
    pub text: String,
    pub action_bindings: BTreeMap<String, StudioExternalAction>,
    pub sha256: String,
}

#[derive(Debug, Error)]
pub enum CompileError {
    #[error("invalid key atom: {0}")]
    InvalidAtom(String),
    #[error("invalid expression: {0}")]
    InvalidExpression(String),
    #[error("advanced action nesting too deep")]
    TooDeep,
}

pub(crate) fn register_external(
    seed: &str,
    action: StudioExternalAction,
    external: &mut Vec<(String, StudioExternalAction)>,
) -> String {
    let encoded = serde_json::to_vec(&action).unwrap_or_default();
    let digest = Sha256::digest([seed.as_bytes(), &encoded].concat());
    let id = format!("a-{}", &hex::encode(digest)[..16]);
    external.push((id.clone(), action));
    format!("(push-msg (kanata-studio action {id}))")
}

pub fn compile_resolved(
    profile: &ResolvedProfile,
    context: CompileContext<'_>,
) -> Result<CompiledConfig, CompileError> {
    if let Some(raw) = &profile.raw_kbd {
        let sha256 = hex::encode(Sha256::digest(raw.as_bytes()));
        return Ok(CompiledConfig {
            text: raw.clone(),
            action_bindings: BTreeMap::new(),
            sha256,
        });
    }
    compile_visual(profile, context)
}

pub fn compile_visual(
    profile: &ResolvedProfile,
    context: CompileContext<'_>,
) -> Result<CompiledConfig, CompileError> {
    let mut external = Vec::new();
    let mut base_rows = Vec::new();
    for (key, action) in &profile.mappings {
        base_rows.push(basic::action_to_kbd(
            key,
            action,
            context.platform,
            &mut external,
        )?);
    }

    let mut text = device_scope::defcfg_for_scope(context.platform, context.device_scope);
    if let EngineDeviceScope::MacDeviceAware(devices) = context.device_scope {
        text.push_str(&device_scope::mac_device_blocks(devices));
    }
    text.push_str("(defsrc)\n\n(deflayermap (base)\n");
    text.push_str(&base_rows.join("\n"));
    text.push_str("\n)\n");

    for layer in &profile.layers {
        escape::validate_atom(&layer.name)?;
        text.push_str(&format!("\n(deflayermap ({})\n", layer.name));
        for (key, action) in &layer.mappings {
            text.push_str(&basic::action_to_kbd(
                key,
                action,
                context.platform,
                &mut external,
            )?);
            text.push('\n');
        }
        text.push_str(")\n");
    }

    let mut chord_layers = vec!["base".to_string()];
    chord_layers.extend(profile.layers.iter().map(|layer| layer.name.clone()));
    text.push_str(&chords::compile_chords(
        &profile.chord_sets,
        &chord_layers,
        context.platform,
        &mut external,
    )?);

    if external
        .iter()
        .any(|(_, action)| matches!(action, StudioExternalAction::Text { .. }))
    {
        let paste = if matches!(context.platform, Platform::Macos) {
            "M-v"
        } else {
            "C-v"
        };
        text.push_str(&format!("\n(defvirtualkeys\n  studio-paste {paste}\n)\n"));
    }

    let sha256 = hex::encode(Sha256::digest(text.as_bytes()));
    Ok(CompiledConfig {
        text,
        action_bindings: external.into_iter().collect(),
        sha256,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{ActionSpec, ResolvedProfile};

    fn visual(mappings: BTreeMap<String, ActionSpec>) -> ResolvedProfile {
        ResolvedProfile {
            contributing_profile_ids: Vec::new(),
            mappings,
            layers: Vec::new(),
            chord_sets: Vec::new(),
            raw_kbd: None,
        }
    }

    #[test]
    fn emits_sparse_deflayermap() {
        let mut mappings = BTreeMap::new();
        mappings.insert("caps".into(), ActionSpec::Key { key: "esc".into() });
        let compiled = compile_visual(
            &visual(mappings),
            CompileContext {
                platform: Platform::Linux,
                device_scope: &EngineDeviceScope::All,
            },
        )
        .unwrap();
        assert!(compiled.text.contains("caps esc"));
        assert!(compiled.text.contains("deflayermap (base)"));
    }

    #[test]
    fn beginner_external_action_uses_push_msg_not_cmd() {
        let mut mappings = BTreeMap::new();
        mappings.insert(
            "f8".into(),
            ActionSpec::OpenUrl {
                url: "https://example.com".into(),
            },
        );
        let compiled = compile_visual(
            &visual(mappings),
            CompileContext {
                platform: Platform::Windows,
                device_scope: &EngineDeviceScope::All,
            },
        )
        .unwrap();
        assert!(compiled.text.contains("push-msg"));
        assert!(!compiled.text.contains("(cmd "));
        assert_eq!(compiled.action_bindings.len(), 1);
    }
}
