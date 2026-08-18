use std::collections::BTreeMap;

use super::{
    ActionSpec, ChordSet, DeviceTarget, DomainError, ProfileSource, StudioProfile, UiMode,
    VisualLayer, validate_profile_set,
};

pub struct ResolutionContext<'a> {
    pub executable: Option<&'a str>,
    pub window_title: Option<&'a str>,
    pub device_id: Option<&'a str>,
    pub ui_mode: UiMode,
}

#[derive(Debug, Clone)]
pub struct ResolvedProfile {
    pub contributing_profile_ids: Vec<String>,
    pub mappings: BTreeMap<String, ActionSpec>,
    pub layers: Vec<VisualLayer>,
    pub chord_sets: Vec<ChordSet>,
    pub raw_kbd: Option<String>,
}

fn executable_matches(expected: &str, actual: &str) -> bool {
    if cfg!(windows) {
        expected.eq_ignore_ascii_case(actual)
    } else {
        expected == actual
    }
}

fn app_matches(profile: &StudioProfile, context: &ResolutionContext<'_>) -> bool {
    let Some(matcher) = &profile.app_matcher else {
        return true;
    };
    let Some(executable) = context.executable else {
        return false;
    };
    if !executable_matches(&matcher.executable, executable) {
        return false;
    }
    match &matcher.window_title_contains {
        Some(fragment) if context.ui_mode == UiMode::Advanced => context
            .window_title
            .is_some_and(|title| title.contains(fragment)),
        Some(_) => false,
        None => true,
    }
}

fn device_rank(target: &DeviceTarget, active_device: Option<&str>) -> Option<u8> {
    match target {
        DeviceTarget::All => Some(0),
        DeviceTarget::Device { id } if Some(id.as_str()) == active_device => Some(1),
        DeviceTarget::Device { .. } => None,
    }
}

pub fn resolve_profile(
    profiles: &[StudioProfile],
    context: ResolutionContext<'_>,
) -> Result<ResolvedProfile, DomainError> {
    validate_profile_set(profiles)?;

    let mut candidates: Vec<(u8, u8, &StudioProfile)> = profiles
        .iter()
        .filter(|profile| profile.enabled && app_matches(profile, &context))
        .filter_map(|profile| {
            device_rank(&profile.device_target, context.device_id).map(|device| {
                let app = u8::from(profile.app_matcher.is_some());
                (app, device, profile)
            })
        })
        .collect();
    candidates.sort_by_key(|(app, device, profile)| (*app, *device, profile.id.clone()));

    if let Some((_, _, top)) = candidates.last()
        && let ProfileSource::Raw { kbd } = &top.source
    {
        return Ok(ResolvedProfile {
            contributing_profile_ids: vec![top.id.clone()],
            mappings: BTreeMap::new(),
            layers: Vec::new(),
            chord_sets: Vec::new(),
            raw_kbd: Some(kbd.clone()),
        });
    }

    let mut mappings = BTreeMap::new();
    let mut layer_map = BTreeMap::<String, VisualLayer>::new();
    let mut chord_sets = Vec::new();
    let mut ids = Vec::new();
    for (_, _, profile) in candidates {
        if let ProfileSource::Visual {
            mappings: current,
            advanced,
        } = &profile.source
        {
            mappings.extend(current.clone());
            for layer in &advanced.layers {
                layer_map.insert(layer.name.clone(), layer.clone());
            }
            chord_sets.extend(advanced.chord_sets.clone());
            ids.push(profile.id.clone());
        }
    }

    Ok(ResolvedProfile {
        contributing_profile_ids: ids,
        mappings,
        layers: layer_map.into_values().collect(),
        chord_sets,
        raw_kbd: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{AppMatcher, ChordEntry, ProfileSource, global_profile};

    fn chord_set(name: &str, output: &str) -> ChordSet {
        ChordSet {
            name: name.into(),
            timeout_ms: 50,
            layers: vec![],
            chords: vec![ChordEntry {
                keys: vec!["j".into(), "k".into()],
                action: ActionSpec::Key { key: output.into() },
            }],
        }
    }

    #[test]
    fn app_profile_overrides_global_mapping() {
        let mut global = global_profile();
        if let ProfileSource::Visual { mappings, .. } = &mut global.source {
            mappings.insert("caps".into(), ActionSpec::Key { key: "esc".into() });
        }

        let mut app = global_profile();
        app.id = "app".into();
        app.name = "App".into();
        app.app_matcher = Some(AppMatcher {
            executable: "code".into(),
            window_title_contains: None,
        });
        if let ProfileSource::Visual { mappings, .. } = &mut app.source {
            mappings.insert("caps".into(), ActionSpec::Key { key: "tab".into() });
        }

        let resolved = resolve_profile(
            &[global, app],
            ResolutionContext {
                executable: Some("code"),
                window_title: None,
                device_id: None,
                ui_mode: UiMode::Beginner,
            },
        )
        .unwrap();
        assert_eq!(
            resolved.mappings.get("caps"),
            Some(&ActionSpec::Key { key: "tab".into() })
        );
    }

    #[test]
    fn chord_sets_preserve_profile_precedence_order() {
        let mut global = global_profile();
        if let ProfileSource::Visual { advanced, .. } = &mut global.source {
            advanced.chord_sets.push(chord_set("Global chord", "esc"));
        }

        let mut app = global_profile();
        app.id = "app".into();
        app.name = "App".into();
        app.app_matcher = Some(AppMatcher {
            executable: "code".into(),
            window_title_contains: None,
        });
        if let ProfileSource::Visual { advanced, .. } = &mut app.source {
            advanced.chord_sets.push(chord_set("App chord", "p"));
        }

        let resolved = resolve_profile(
            &[global, app],
            ResolutionContext {
                executable: Some("code"),
                window_title: None,
                device_id: None,
                ui_mode: UiMode::Advanced,
            },
        )
        .unwrap();
        assert_eq!(resolved.chord_sets.len(), 2);
        assert_eq!(resolved.chord_sets[0].name, "Global chord");
        assert_eq!(resolved.chord_sets[1].name, "App chord");
    }

    #[test]
    fn highest_priority_raw_profile_becomes_source_of_truth() {
        let global = global_profile();
        let mut app = global_profile();
        app.id = "raw-app".into();
        app.name = "Raw App".into();
        app.app_matcher = Some(AppMatcher {
            executable: "code".into(),
            window_title_contains: None,
        });
        app.source = ProfileSource::Raw {
            kbd: "(defsrc)\n(deflayer base)".into(),
        };

        let resolved = resolve_profile(
            &[global, app],
            ResolutionContext {
                executable: Some("code"),
                window_title: None,
                device_id: None,
                ui_mode: UiMode::Advanced,
            },
        )
        .unwrap();
        assert!(resolved.raw_kbd.is_some());
        assert!(resolved.chord_sets.is_empty());
        assert_eq!(resolved.contributing_profile_ids, vec!["raw-app"]);
    }
}
