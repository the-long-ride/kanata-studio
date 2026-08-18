use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use super::{ActionSpec, DomainError};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppMatcher {
    pub executable: String,
    pub window_title_contains: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DeviceTarget {
    All,
    Device { id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChordEntry {
    pub keys: Vec<String>,
    pub action: ActionSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChordSet {
    pub name: String,
    pub timeout_ms: u32,
    #[serde(default)]
    pub layers: Vec<String>,
    #[serde(default)]
    pub chords: Vec<ChordEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedVisualConfig {
    pub layers: Vec<VisualLayer>,
    #[serde(default)]
    pub chord_sets: Vec<ChordSet>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VisualLayer {
    pub name: String,
    pub mappings: BTreeMap<String, ActionSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ProfileSource {
    Visual {
        mappings: BTreeMap<String, ActionSpec>,
        advanced: AdvancedVisualConfig,
    },
    Raw {
        kbd: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioProfile {
    pub id: String,
    pub revision: u64,
    pub name: String,
    pub enabled: bool,
    pub app_matcher: Option<AppMatcher>,
    pub device_target: DeviceTarget,
    pub source: ProfileSource,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct ProfileScopeKey(pub Option<String>, pub DeviceTarget);

impl StudioProfile {
    pub fn scope_key(&self) -> ProfileScopeKey {
        ProfileScopeKey(
            self.app_matcher
                .as_ref()
                .map(|matcher| matcher.executable.to_lowercase()),
            self.device_target.clone(),
        )
    }

    pub fn is_raw(&self) -> bool {
        matches!(self.source, ProfileSource::Raw { .. })
    }

    pub fn visual_mappings(&self) -> Result<&BTreeMap<String, ActionSpec>, DomainError> {
        match &self.source {
            ProfileSource::Visual { mappings, .. } => Ok(mappings),
            ProfileSource::Raw { .. } => Err(DomainError::RawReadOnly),
        }
    }
}

pub fn global_profile() -> StudioProfile {
    StudioProfile {
        id: "global".into(),
        revision: 0,
        name: "Global".into(),
        enabled: true,
        app_matcher: None,
        device_target: DeviceTarget::All,
        source: ProfileSource::Visual {
            mappings: BTreeMap::new(),
            advanced: AdvancedVisualConfig::default(),
        },
    }
}

pub fn device_global_profile(device_id: &str, source: ProfileSource) -> StudioProfile {
    StudioProfile {
        id: format!("keyboard-{device_id}-global"),
        revision: 0,
        name: "Global".into(),
        enabled: true,
        app_matcher: None,
        device_target: DeviceTarget::Device {
            id: device_id.into(),
        },
        source,
    }
}

fn chord_scopes_overlap(left: &[String], right: &[String]) -> bool {
    left.is_empty()
        || right.is_empty()
        || left.iter().any(|layer| right.iter().any(|other| other == layer))
}

fn validate_chord_set_conflicts(profile: &StudioProfile) -> Result<(), DomainError> {
    let ProfileSource::Visual { advanced, .. } = &profile.source else {
        return Ok(());
    };
    let mut seen: BTreeMap<Vec<String>, Vec<&[String]>> = BTreeMap::new();
    for set in &advanced.chord_sets {
        for chord in &set.chords {
            let mut keys = chord.keys.clone();
            keys.sort();
            let scopes = seen.entry(keys.clone()).or_default();
            if scopes
                .iter()
                .any(|scope| chord_scopes_overlap(scope, &set.layers))
            {
                return Err(DomainError::Invalid(format!(
                    "duplicate active chord in profile {}: {}",
                    profile.name,
                    keys.join("+")
                )));
            }
            scopes.push(&set.layers);
        }
    }
    Ok(())
}

pub fn validate_profile_set(profiles: &[StudioProfile]) -> Result<(), DomainError> {
    let global_count = profiles
        .iter()
        .filter(|profile| {
            profile.enabled
                && profile.app_matcher.is_none()
                && profile.device_target == DeviceTarget::All
        })
        .count();
    if global_count != 1 {
        return Err(DomainError::MissingGlobal);
    }

    let mut seen = BTreeSet::new();
    for profile in profiles.iter().filter(|profile| profile.enabled) {
        let key = profile.scope_key();
        if !seen.insert(key.clone()) {
            return Err(DomainError::DuplicateScope(format!("{key:?}")));
        }
        if profile.name.trim().is_empty() || profile.id.trim().is_empty() {
            return Err(DomainError::Invalid(
                "profile id/name cannot be blank".into(),
            ));
        }
        validate_chord_set_conflicts(profile)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_exactly_one_global_profile() {
        assert!(validate_profile_set(&[global_profile()]).is_ok());
        assert!(validate_profile_set(&[]).is_err());
        assert!(validate_profile_set(&[global_profile(), global_profile()]).is_err());
    }

    #[test]
    fn raw_profile_has_no_visual_mappings() {
        let mut profile = global_profile();
        profile.source = ProfileSource::Raw {
            kbd: "(defsrc)".into(),
        };
        assert!(profile.visual_mappings().is_err());
    }

    #[test]
    fn visual_profile_without_chord_sets_deserializes_empty() {
        let json = r#"{
            "id":"global",
            "revision":0,
            "name":"Global",
            "enabled":true,
            "deviceTarget":{"kind":"all"},
            "source":{"kind":"visual","mappings":{},"advanced":{"layers":[]}}
        }"#;
        let profile: StudioProfile = serde_json::from_str(json).unwrap();
        let ProfileSource::Visual { advanced, .. } = profile.source else {
            panic!("expected visual profile");
        };
        assert!(advanced.chord_sets.is_empty());
    }

    #[test]
    fn rejects_equal_precedence_chord_conflicts() {
        let mut profile = global_profile();
        let ProfileSource::Visual { advanced, .. } = &mut profile.source else {
            unreachable!();
        };
        advanced.chord_sets = vec![
            ChordSet {
                name: "One".into(),
                timeout_ms: 50,
                layers: vec![],
                chords: vec![ChordEntry {
                    keys: vec!["j".into(), "k".into()],
                    action: ActionSpec::Key { key: "esc".into() },
                }],
            },
            ChordSet {
                name: "Two".into(),
                timeout_ms: 50,
                layers: vec!["base".into()],
                chords: vec![ChordEntry {
                    keys: vec!["k".into(), "j".into()],
                    action: ActionSpec::Key { key: "tab".into() },
                }],
            },
        ];
        assert!(validate_profile_set(&[profile]).is_err());
    }
}
