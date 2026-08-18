use std::collections::BTreeSet;

use sha2::{Digest, Sha256};

use crate::domain::{
    ConfiguredKeyboard, DeviceTarget, KeyboardDevice, StudioProfile, validate_profile_set,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyboardIdentityMigrationReason {
    LegacyInterfacePath,
    UniqueVidPid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyboardIdentityMigration {
    pub old_id: String,
    pub new_id: String,
    pub reason: KeyboardIdentityMigrationReason,
}

#[derive(Debug, Clone)]
pub struct ReconciledKeyboardState {
    pub keyboards: Vec<ConfiguredKeyboard>,
    pub profiles: Vec<StudioProfile>,
    pub migrations: Vec<KeyboardIdentityMigration>,
    pub changed: bool,
}

pub fn reconcile_keyboard_identities(
    configured: &[ConfiguredKeyboard],
    profiles: &[StudioProfile],
    detected: &[KeyboardDevice],
) -> Result<ReconciledKeyboardState, String> {
    let detected_ids = detected
        .iter()
        .map(|device| device.id.as_str())
        .collect::<BTreeSet<_>>();
    let mut claimed = configured
        .iter()
        .filter(|saved| detected_ids.contains(saved.id.as_str()))
        .map(|saved| saved.id.clone())
        .collect::<BTreeSet<_>>();
    let mut keyboards = configured.to_vec();
    let mut migrated_profiles = profiles.to_vec();
    let mut migrations = Vec::new();

    for saved in &mut keyboards {
        if detected_ids.contains(saved.id.as_str()) {
            continue;
        }

        let legacy_matches = detected
            .iter()
            .filter(|device| !claimed.contains(&device.id))
            .filter(|device| {
                interface_paths(device)
                    .into_iter()
                    .any(|path| legacy_windows_id(path) == saved.id)
            })
            .collect::<Vec<_>>();

        let selected = match legacy_matches.len() {
            1 => Some((
                legacy_matches[0],
                KeyboardIdentityMigrationReason::LegacyInterfacePath,
            )),
            0 => {
                let (Some(vendor_id), Some(product_id)) = (saved.vendor_id, saved.product_id)
                else {
                    continue;
                };
                let candidates = detected
                    .iter()
                    .filter(|device| {
                        !claimed.contains(&device.id)
                            && device.vendor_id == Some(vendor_id)
                            && device.product_id == Some(product_id)
                    })
                    .collect::<Vec<_>>();
                if candidates.len() == 1 {
                    Some((candidates[0], KeyboardIdentityMigrationReason::UniqueVidPid))
                } else {
                    None
                }
            }
            _ => None,
        };

        let Some((device, reason)) = selected else {
            continue;
        };
        let old_id = saved.id.clone();
        let new_id = device.id.clone();
        saved.id = new_id.clone();
        saved.refresh_metadata(device);
        claimed.insert(new_id.clone());
        migrate_profile_targets(&mut migrated_profiles, &old_id, &new_id);
        migrations.push(KeyboardIdentityMigration {
            old_id,
            new_id,
            reason,
        });
    }

    validate_profile_set(&migrated_profiles).map_err(|error| error.to_string())?;
    Ok(ReconciledKeyboardState {
        keyboards,
        profiles: migrated_profiles,
        changed: !migrations.is_empty(),
        migrations,
    })
}

fn interface_paths(device: &KeyboardDevice) -> Vec<&str> {
    if device.interface_paths.is_empty() {
        device.path.as_deref().into_iter().collect()
    } else {
        device.interface_paths.iter().map(String::as_str).collect()
    }
}

fn legacy_windows_id(path: &str) -> String {
    let digest = Sha256::digest(path.as_bytes());
    format!("windows-{}", &hex::encode(digest)[..16])
}

fn migrate_profile_targets(profiles: &mut [StudioProfile], old_id: &str, new_id: &str) {
    let old_global_id = format!("keyboard-{old_id}-global");
    for profile in profiles {
        let DeviceTarget::Device { id } = &mut profile.device_target else {
            continue;
        };
        if id != old_id {
            continue;
        }
        *id = new_id.into();
        if profile.app_matcher.is_none() && profile.id == old_global_id {
            profile.id = format!("keyboard-{new_id}-global");
        }
    }
}
