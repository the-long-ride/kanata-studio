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

fn default_left_rail_width() -> u16 {
    260
}

fn default_right_pane_width() -> u16 {
    340
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
    #[serde(default = "default_left_rail_width")]
    pub left_rail_width: u16,
    #[serde(default = "default_right_pane_width")]
    pub right_pane_width: u16,
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
            left_rail_width: default_left_rail_width(),
            right_pane_width: default_right_pane_width(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::StudioSettings;

    #[test]
    fn legacy_settings_use_default_pane_widths() {
        let settings: StudioSettings = serde_json::from_value(serde_json::json!({
            "onboardingCompleted": true,
            "startWithSystem": true,
            "remappingEnabled": true,
            "stopKanataOnQuit": true,
            "deviceLayoutOverrides": {},
            "uiMode": "Beginner"
        }))
        .expect("legacy settings should deserialize");

        assert_eq!(settings.left_rail_width, 260);
        assert_eq!(settings.right_pane_width, 340);
    }
}
