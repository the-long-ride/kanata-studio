use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::compiler::device_scope::EngineDeviceScope;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct EngineId(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EngineBackend {
    Standard,
    WindowsInterception,
}

impl EngineBackend {
    pub fn sidecar_name(&self) -> &'static str {
        match self {
            Self::Standard => "kanata-engine",
            Self::WindowsInterception => "kanata-engine-interception",
        }
    }
}

#[derive(Debug, Clone)]
pub struct EngineSpec {
    pub id: EngineId,
    pub backend: EngineBackend,
    pub config_path: PathBuf,
    pub device_scope: EngineDeviceScope,
}

#[derive(Debug, Clone)]
pub struct EngineHandle {
    pub id: EngineId,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStatus {
    pub id: String,
    pub state: EngineState,
    pub profile: Option<String>,
    pub device: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EngineState {
    Starting,
    Running,
    Stopped,
    Crashed,
    RecoveryRequired,
}
