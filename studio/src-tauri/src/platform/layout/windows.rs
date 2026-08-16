use super::{detect_generic, LayoutDetection};
use crate::domain::KeyboardDevice;

pub fn detect(device: &KeyboardDevice) -> LayoutDetection {
    detect_generic(device)
}
