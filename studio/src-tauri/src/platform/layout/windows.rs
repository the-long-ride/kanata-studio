use super::{LayoutDetection, detect_generic};
use crate::domain::KeyboardDevice;

pub fn detect(device: &KeyboardDevice) -> LayoutDetection {
    detect_generic(device)
}
