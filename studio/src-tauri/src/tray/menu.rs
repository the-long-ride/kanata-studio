#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrayMenuModel {
    pub status: String,
    pub profile: String,
    pub keyboard: String,
    pub pause_label: String,
    pub autostart: bool,
}

pub fn model(
    running: bool,
    profile: &str,
    keyboard: &str,
    autostart: bool,
) -> TrayMenuModel {
    TrayMenuModel {
        status: if running {
            "Remapping enabled"
        } else {
            "Remapping paused"
        }
        .into(),
        profile: format!("Profile: {profile}"),
        keyboard: format!("Keyboard: {keyboard}"),
        pause_label: if running {
            "Pause remapping"
        } else {
            "Resume remapping"
        }
        .into(),
        autostart,
    }
}
