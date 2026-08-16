use std::collections::{BTreeMap, BTreeSet};

use sha2::{Digest, Sha256};

use crate::domain::{
    ActionSpec, KeyboardDevice, Platform, ResolvedProfile,
};

use super::{
    basic::action_expression, device_scope::mac_device_blocks, CompiledConfig, CompileError,
    StudioExternalAction,
};

pub struct DeviceResolved<'a> {
    pub device: &'a KeyboardDevice,
    pub profile: &'a ResolvedProfile,
}

pub fn compile_device_aware(
    fallback: &ResolvedProfile,
    device_profiles: &[DeviceResolved<'_>],
) -> Result<CompiledConfig, CompileError> {
    let devices = device_profiles
        .iter()
        .map(|entry| entry.device.clone())
        .collect::<Vec<_>>();
    let mut keys = fallback.mappings.keys().cloned().collect::<BTreeSet<_>>();
    for entry in device_profiles {
        keys.extend(entry.profile.mappings.keys().cloned());
    }

    let mut external = Vec::<(String, StudioExternalAction)>::new();
    let mut text = String::from("(defcfg\n  process-unmapped-keys yes\n)\n\n");
    text.push_str(&mac_device_blocks(&devices));
    text.push_str("(defsrc)\n\n(deflayermap (base)\n");

    for key in keys {
        let fallback_action = fallback.mappings.get(&key);
        let fallback_expr = expression(
            &format!("{key}:fallback"),
            fallback_action,
            &mut external,
        )?;
        let mut cases = Vec::new();
        for (index, entry) in device_profiles.iter().enumerate() {
            let action = entry.profile.mappings.get(&key).or(fallback_action);
            let expr = expression(
                &format!("{key}:{}", entry.device.id),
                action,
                &mut external,
            )?;
            if expr != fallback_expr {
                cases.push(format!("((device-history {} 1)) {expr} break", index + 1));
            }
        }

        if cases.is_empty() {
            text.push_str(&format!("  {key} {fallback_expr}\n"));
        } else {
            cases.push(format!("() {fallback_expr} break"));
            text.push_str(&format!("  {key} (switch {})\n", cases.join(" ")));
        }
    }
    text.push_str(")\n");

    if external
        .iter()
        .any(|(_, action)| matches!(action, StudioExternalAction::Text { .. }))
    {
        text.push_str("\n(defvirtualkeys\n  studio-paste M-v\n)\n");
    }

    let sha256 = hex::encode(Sha256::digest(text.as_bytes()));
    Ok(CompiledConfig {
        text,
        action_bindings: external.into_iter().collect::<BTreeMap<_, _>>(),
        sha256,
    })
}

fn expression(
    seed: &str,
    action: Option<&ActionSpec>,
    external: &mut Vec<(String, StudioExternalAction)>,
) -> Result<String, CompileError> {
    match action {
        Some(action) => action_expression(seed, action, Platform::Macos, external, 0),
        None => Ok("_".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{KeyboardLayout, ResolvedProfile};

    fn resolved(key: &str, output: &str) -> ResolvedProfile {
        ResolvedProfile {
            contributing_profile_ids: vec![],
            mappings: BTreeMap::from([(
                key.to_string(),
                ActionSpec::Key { key: output.to_string() },
            )]),
            layers: vec![],
            raw_kbd: None,
        }
    }

    #[test]
    fn emits_device_history_switch_only_for_different_mapping() {
        let device = KeyboardDevice {
            id: "external".into(),
            name: "External".into(),
            vendor_id: Some(1),
            product_id: Some(2),
            path: None,
            layout: KeyboardLayout::Ansi,
            manual_layout: None,
        };
        let fallback = resolved("caps", "esc");
        let special = resolved("caps", "tab");
        let compiled = compile_device_aware(
            &fallback,
            &[DeviceResolved { device: &device, profile: &special }],
        )
        .unwrap();
        assert!(compiled.text.contains("device-history 1 1"));
        assert!(compiled.text.contains("tab break"));
        assert!(compiled.text.contains("esc break"));
    }
}
