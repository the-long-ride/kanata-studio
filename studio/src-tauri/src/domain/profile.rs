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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedVisualConfig {
    pub layers: Vec<VisualLayer>,
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
            return Err(DomainError::Invalid("profile id/name cannot be blank".into()));
        }
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
}
