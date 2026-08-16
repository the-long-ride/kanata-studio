use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Modifier {
    Ctrl,
    Shift,
    Alt,
    Meta,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MediaAction {
    PlayPause,
    Next,
    Previous,
    VolumeUp,
    VolumeDown,
    Mute,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AdvancedActionSpec {
    RawAction {
        expression: String,
    },
    TapHold {
        tap: Box<ActionSpec>,
        hold: Box<ActionSpec>,
        timeout_ms: u16,
    },
    Macro {
        actions: Vec<ActionSpec>,
    },
    Multi {
        actions: Vec<ActionSpec>,
    },
    TapDance {
        timeout_ms: u16,
        actions: Vec<ActionSpec>,
    },
    LayerMomentary {
        layer: String,
    },
    LayerSwitch {
        layer: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ActionSpec {
    Key {
        key: String,
    },
    Shortcut {
        modifiers: Vec<Modifier>,
        key: String,
    },
    Text {
        text: String,
    },
    LaunchApp {
        path: String,
        args: Vec<String>,
    },
    OpenUrl {
        url: String,
    },
    Media {
        action: MediaAction,
    },
    Delay {
        ms: u16,
    },
    Disabled,
    Advanced {
        action: AdvancedActionSpec,
    },
}

impl ActionSpec {
    pub fn is_beginner_safe(&self) -> bool {
        !matches!(self, Self::Advanced { .. })
    }
}
