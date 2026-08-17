use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::KeyboardLayout;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum UiMode {
    Beginner,
    Advanced,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioSettings {
    pub onboarding_completed: bool,
    pub start_with_system: bool,
    pub remapping_enabled: bool,
    #[serde(default = "default_true")]
    pub stop_kanata_on_quit: bool,
    pub device_layout_overrides: BTreeMap<String, KeyboardLayout>,
    pub ui_mode: UiMode,
}

impl Default for StudioSettings {
    fn default() -> Self {
        Self {
            onboarding_completed: false,
            start_with_system: true,
            remapping_enabled: true,
            stop_kanata_on_quit: true,
            device_layout_overrides: BTreeMap::new(),
            ui_mode: UiMode::Beginner,
        }
    }
}
