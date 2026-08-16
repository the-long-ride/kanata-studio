pub mod linux;
pub mod macos;
pub mod windows;

use crate::domain::{KeyboardDevice, KeyboardLayout};

#[derive(Debug, Clone)]
pub enum DetectionConfidence {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone)]
pub struct LayoutDetection {
    pub layout: KeyboardLayout,
    pub confidence: DetectionConfidence,
    pub reason: String,
}

pub fn detect_generic(device: &KeyboardDevice) -> LayoutDetection {
    if let Some(layout) = &device.manual_layout {
        return LayoutDetection {
            layout: layout.clone(),
            confidence: DetectionConfidence::High,
            reason: "manual override".into(),
        };
    }

    if device.layout != KeyboardLayout::Unknown {
        return LayoutDetection {
            layout: device.layout.clone(),
            confidence: DetectionConfidence::Medium,
            reason: "device capabilities".into(),
        };
    }

    let name = device.name.to_lowercase();
    if name.contains("jis") || name.contains("japanese") {
        LayoutDetection {
            layout: KeyboardLayout::Jis,
            confidence: DetectionConfidence::Medium,
            reason: "device name".into(),
        }
    } else if name.contains("iso") {
        LayoutDetection {
            layout: KeyboardLayout::Iso,
            confidence: DetectionConfidence::Medium,
            reason: "device name".into(),
        }
    } else {
        LayoutDetection {
            layout: KeyboardLayout::Unknown,
            confidence: DetectionConfidence::Low,
            reason: "insufficient evidence".into(),
        }
    }
}
