use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use parking_lot::{Mutex, RwLock};
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandChild;

use crate::{
    actions::{DesktopExecutor, ExternalActionExecutor, dispatch_message},
    compiler::StudioExternalAction,
};

use super::{
    EngineError, KanataTcpClient,
    model::{EngineHandle, EngineId, EngineSpec, EngineState, EngineStatus},
    process::{spawn_sidecar, start_listener},
    recovery::RestartBudget,
};

pub trait EngineSupervisor: Send + Sync {
    fn start(self: &Arc<Self>, spec: EngineSpec) -> Result<EngineHandle, EngineError>;
    fn reload(&self, id: &EngineId, config_path: &Path) -> Result<(), EngineError>;
    fn stop(&self, id: &EngineId) -> Result<(), EngineError>;
    fn restart(self: &Arc<Self>, id: &EngineId) -> Result<(), EngineError>;
    fn status(&self) -> Vec<EngineStatus>;
}

pub(crate) struct ManagedEngine {
    spec: EngineSpec,
    port: u16,
    child: Option<CommandChild>,
    status: EngineStatus,
    restart_budget: RestartBudget,
    action_bindings: BTreeMap<String, StudioExternalAction>,
}

pub struct LocalSupervisor {
    pub(crate) app: AppHandle,
    pub(crate) logs_dir: PathBuf,
    engines: Arc<Mutex<BTreeMap<String, ManagedEngine>>>,
    action_executor: RwLock<Option<Arc<dyn ExternalActionExecutor>>>,
}

impl LocalSupervisor {
    pub fn new(app: AppHandle, logs_dir: PathBuf) -> Arc<Self> {
        let supervisor = Arc::new(Self {
            app,
            logs_dir,
            engines: Arc::new(Mutex::new(BTreeMap::new())),
            action_executor: RwLock::new(None),
        });
        *supervisor.action_executor.write() =
            Some(Arc::new(DesktopExecutor::new(Arc::downgrade(&supervisor))));
        supervisor
    }

    pub fn set_action_bindings(
        &self,
        id: &EngineId,
        bindings: BTreeMap<String, StudioExternalAction>,
    ) -> Result<(), EngineError> {
        let mut engines = self.engines.lock();
        let engine = engines
            .get_mut(&id.0)
            .ok_or_else(|| EngineError::UnknownEngine(id.0.clone()))?;
        engine.action_bindings = bindings;
        Ok(())
    }

    pub fn set_status_context(
        &self,
        id: &EngineId,
        profile: Option<String>,
        device: Option<String>,
    ) {
        if let Some(engine) = self.engines.lock().get_mut(&id.0) {
            engine.status.profile = profile;
            engine.status.device = device;
        }
    }

    pub fn tap_fake_key(&self, id: &EngineId, name: &str) -> Result<(), EngineError> {
        let port = self
            .engines
            .lock()
            .get(&id.0)
            .map(|engine| engine.port)
            .ok_or_else(|| EngineError::UnknownEngine(id.0.clone()))?;
        KanataTcpClient::connect(port, Duration::from_millis(500))?.tap_fake_key(name)
    }

    pub(crate) fn dispatch_action(&self, id: &EngineId, message: &serde_json::Value) {
        let bindings = self
            .engines
            .lock()
            .get(&id.0)
            .map(|engine| engine.action_bindings.clone())
            .unwrap_or_default();
        if let Some(executor) = self.action_executor.read().as_ref() {
            let _ = dispatch_message(id, message, &bindings, executor.as_ref());
        }
    }

    pub(crate) fn handle_terminated(self: &Arc<Self>, id: &EngineId, pid: u32, code: Option<i32>) {
        let should_restart = {
            let mut engines = self.engines.lock();
            let Some(engine) = engines.get_mut(&id.0) else {
                return;
            };
            if engine.status.state == EngineState::Stopped {
                return;
            }
            if engine.child.as_ref().map(CommandChild::pid) != Some(pid) {
                return;
            }
            engine.child = None;
            engine.status.state = EngineState::Crashed;
            engine.status.message = Some(format!("Kanata exited with code {code:?}"));
            engine.restart_budget.take_automatic_restart()
        };

        if should_restart {
            if let Err(error) = self.restart_internal(id, false) {
                self.mark_recovery_required(id, Some(error.to_string()));
            }
        } else {
            self.mark_recovery_required(id, None);
        }
    }

    fn mark_recovery_required(&self, id: &EngineId, message: Option<String>) {
        if let Some(engine) = self.engines.lock().get_mut(&id.0) {
            engine.status.state = EngineState::RecoveryRequired;
            if message.is_some() {
                engine.status.message = message;
            }
        }
    }

    fn restart_internal(self: &Arc<Self>, id: &EngineId, manual: bool) -> Result<(), EngineError> {
        let spec = {
            let mut engines = self.engines.lock();
            let engine = engines
                .get_mut(&id.0)
                .ok_or_else(|| EngineError::UnknownEngine(id.0.clone()))?;
            if let Some(child) = engine.child.take() {
                let _ = child.kill();
            }
            if manual {
                engine.restart_budget.reset();
            }
            engine.status.state = EngineState::Starting;
            engine.spec.clone()
        };

        let port = super::ports::allocate_loopback_port()?;
        let child = spawn_sidecar(self, &spec, port)?;
        KanataTcpClient::connect_with_retry(port, Duration::from_secs(5))?.hello()?;
        {
            let mut engines = self.engines.lock();
            let engine = engines
                .get_mut(&id.0)
                .ok_or_else(|| EngineError::UnknownEngine(id.0.clone()))?;
            engine.port = port;
            engine.child = Some(child);
            engine.status.state = EngineState::Running;
            engine.status.message = None;
        }
        start_listener(self, id.clone(), port);
        Ok(())
    }
}

impl EngineSupervisor for LocalSupervisor {
    fn start(self: &Arc<Self>, spec: EngineSpec) -> Result<EngineHandle, EngineError> {
        let port = super::ports::allocate_loopback_port()?;
        let child = spawn_sidecar(self, &spec, port)?;
        if let Err(error) =
            KanataTcpClient::connect_with_retry(port, Duration::from_secs(5))?.hello()
        {
            let _ = child.kill();
            return Err(error);
        }

        let id = spec.id.clone();
        self.engines.lock().insert(
            id.0.clone(),
            ManagedEngine {
                spec,
                port,
                child: Some(child),
                status: EngineStatus {
                    id: id.0.clone(),
                    state: EngineState::Running,
                    profile: None,
                    device: None,
                    message: None,
                },
                restart_budget: RestartBudget::default(),
                action_bindings: BTreeMap::new(),
            },
        );
        start_listener(self, id.clone(), port);
        Ok(EngineHandle { id, port })
    }

    fn reload(&self, id: &EngineId, config_path: &Path) -> Result<(), EngineError> {
        let port = self
            .engines
            .lock()
            .get(&id.0)
            .map(|engine| engine.port)
            .ok_or_else(|| EngineError::UnknownEngine(id.0.clone()))?;
        KanataTcpClient::connect(port, Duration::from_millis(500))?.reload_file(config_path)
    }

    fn stop(&self, id: &EngineId) -> Result<(), EngineError> {
        let mut engines = self.engines.lock();
        let engine = engines
            .get_mut(&id.0)
            .ok_or_else(|| EngineError::UnknownEngine(id.0.clone()))?;
        engine.status.state = EngineState::Stopped;
        if let Some(child) = engine.child.take() {
            child
                .kill()
                .map_err(|error| EngineError::Process(error.to_string()))?;
        }
        Ok(())
    }

    fn restart(self: &Arc<Self>, id: &EngineId) -> Result<(), EngineError> {
        self.restart_internal(id, true)
    }

    fn status(&self) -> Vec<EngineStatus> {
        self.engines
            .lock()
            .values()
            .map(|engine| engine.status.clone())
            .collect()
    }
}
