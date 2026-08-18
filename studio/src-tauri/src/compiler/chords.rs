use std::collections::{BTreeMap, BTreeSet};

use crate::domain::{ActionSpec, ChordSet, Platform};

use super::{CompileError, StudioExternalAction, basic, escape::validate_atom};

#[derive(Clone)]
struct LayerBinding {
    action: ActionSpec,
    timeout_ms: u32,
}

type EffectiveChords = BTreeMap<Vec<String>, BTreeMap<String, LayerBinding>>;

fn invalid(message: impl Into<String>) -> CompileError {
    CompileError::InvalidExpression(message.into())
}

fn canonical_keys(keys: &[String]) -> Result<Vec<String>, CompileError> {
    if keys.len() < 2 {
        return Err(invalid("chord requires at least two physical keys"));
    }
    let mut canonical = keys.to_vec();
    for key in &canonical {
        validate_atom(key)?;
    }
    canonical.sort();
    let original_len = canonical.len();
    canonical.dedup();
    if canonical.len() != original_len {
        return Err(invalid("chord contains a duplicate physical key"));
    }
    Ok(canonical)
}

fn active_layers(set: &ChordSet, all_layers: &[String]) -> Result<Vec<String>, CompileError> {
    if set.layers.is_empty() {
        return Ok(all_layers.to_vec());
    }
    let known: BTreeSet<&str> = all_layers.iter().map(String::as_str).collect();
    let mut active = Vec::new();
    let mut seen = BTreeSet::new();
    for layer in &set.layers {
        validate_atom(layer)?;
        if !known.contains(layer.as_str()) {
            return Err(invalid(format!("unknown chord layer: {layer}")));
        }
        if seen.insert(layer.as_str()) {
            active.push(layer.clone());
        }
    }
    Ok(active)
}

fn resolve_effective(
    chord_sets: &[ChordSet],
    all_layers: &[String],
) -> Result<EffectiveChords, CompileError> {
    let mut effective = EffectiveChords::new();
    for set in chord_sets {
        if set.name.trim().is_empty() {
            return Err(invalid("chord set name cannot be blank"));
        }
        if set.timeout_ms == 0 || set.timeout_ms > u16::MAX.into() {
            return Err(invalid(format!(
                "chord set {} timeout must be 1-65535 ms",
                set.name
            )));
        }
        let layers = active_layers(set, all_layers)?;
        for entry in &set.chords {
            let keys = canonical_keys(&entry.keys)?;
            let layer_map = effective.entry(keys).or_default();
            for layer in &layers {
                layer_map.insert(
                    layer.clone(),
                    LayerBinding {
                        action: entry.action.clone(),
                        timeout_ms: set.timeout_ms,
                    },
                );
            }
        }
    }
    Ok(effective)
}

fn compile_action(
    seed: &str,
    action: &ActionSpec,
    platform: Platform,
    external: &mut Vec<(String, StudioExternalAction)>,
) -> Result<String, CompileError> {
    if matches!(action, ActionSpec::Delay { .. }) {
        return Err(invalid("delay is only valid inside a macro"));
    }
    basic::action_expression(seed, action, platform, external, 0)
}

fn action_for_layers(
    keys: &[String],
    bindings: &BTreeMap<String, LayerBinding>,
    all_layers: &[String],
    platform: Platform,
    external: &mut Vec<(String, StudioExternalAction)>,
) -> Result<String, CompileError> {
    let first = bindings
        .values()
        .next()
        .ok_or_else(|| invalid("chord has no active layers"))?;
    if bindings.values().all(|item| item.action == first.action) {
        return compile_action(
            &format!("chord-{}", keys.join("-")),
            &first.action,
            platform,
            external,
        );
    }

    let mut branches = Vec::new();
    for layer in all_layers {
        let Some(binding) = bindings.get(layer) else {
            continue;
        };
        let action = compile_action(
            &format!("chord-{}-{layer}", keys.join("-")),
            &binding.action,
            platform,
            external,
        )?;
        branches.push(format!("((layer {layer})) {action} break"));
    }
    Ok(format!("(switch {})", branches.join(" ")))
}

fn row_for_chord(
    keys: &[String],
    bindings: &BTreeMap<String, LayerBinding>,
    all_layers: &[String],
    platform: Platform,
    external: &mut Vec<(String, StudioExternalAction)>,
) -> Result<String, CompileError> {
    let timeouts: BTreeSet<u32> = bindings.values().map(|item| item.timeout_ms).collect();
    if timeouts.len() != 1 {
        return Err(invalid(format!(
            "chord {} has different timeouts across active layers",
            keys.join("+")
        )));
    }
    let timeout = *timeouts.iter().next().expect("non-empty chord bindings");
    let action = action_for_layers(keys, bindings, all_layers, platform, external)?;
    let disabled = all_layers
        .iter()
        .filter(|layer| !bindings.contains_key(*layer))
        .cloned()
        .collect::<Vec<_>>();
    let disabled = if disabled.is_empty() {
        "()".into()
    } else {
        format!("({})", disabled.join(" "))
    };
    Ok(format!(
        "  ({}) {action} {timeout} first-release {disabled}",
        keys.join(" ")
    ))
}

pub fn compile_chords(
    chord_sets: &[ChordSet],
    all_layers: &[String],
    platform: Platform,
    external: &mut Vec<(String, StudioExternalAction)>,
) -> Result<String, CompileError> {
    if chord_sets.is_empty() {
        return Ok(String::new());
    }
    let effective = resolve_effective(chord_sets, all_layers)?;
    if effective.is_empty() {
        return Ok(String::new());
    }

    let mut items = effective.into_iter().collect::<Vec<_>>();
    items.sort_by(|(left, _), (right, _)| {
        left.len().cmp(&right.len()).then_with(|| left.cmp(right))
    });
    let mut rows = Vec::with_capacity(items.len());
    for (keys, bindings) in items {
        rows.push(row_for_chord(
            &keys,
            &bindings,
            all_layers,
            platform,
            external,
        )?);
    }
    Ok(format!("\n(defchordsv2\n{}\n)\n", rows.join("\n")))
}
