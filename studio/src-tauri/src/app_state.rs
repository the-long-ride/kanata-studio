use std::sync::Arc;

use parking_lot::RwLock;

use crate::{
    domain::{CapabilitySet, KeyboardDevice, StudioProfile, StudioSettings},
    engine::{EngineStatus, LocalSupervisor, RuntimeHealth},
    platform::active_app::ActiveApp,
    storage::{JsonProfileStore, RecoveryStore, SettingsStore, StudioPaths},
};

pub struct AppState {
    pub profiles: RwLock<Vec<StudioProfile>>,
    pub settings: RwLock<StudioSettings>,
    pub devices: RwLock<Vec<KeyboardDevice>>,
    pub capabilities: RwLock<CapabilitySet>,
    pub supervisor: Arc<LocalSupervisor>,
    pub paths: StudioPaths,
    pub profile_store: JsonProfileStore,
    pub settings_store: SettingsStore,
    pub recovery: RecoveryStore,
    pub health: RwLock<RuntimeHealth>,
    pub active_app: RwLock<Option<ActiveApp>>,
    pub manual_profile_id: RwLock<Option<String>>,
    pub topology_signature: RwLock<Option<String>>,
    pub last_runtime_error: RwLock<Option<String>>,
}

impl AppState {
    pub fn engine_statuses(&self) -> Vec<EngineStatus> {
        use crate::engine::EngineSupervisor;
        self.supervisor.status()
    }
}
