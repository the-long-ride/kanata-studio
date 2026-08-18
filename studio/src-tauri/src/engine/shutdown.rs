use super::{EngineId, EngineState, EngineSupervisor, LocalSupervisor};

pub trait QuitEngineController {
    fn engine_ids(&self) -> Vec<EngineId>;
    fn stop_engine(&self, id: &EngineId) -> Result<(), String>;
    fn detach_all(&self);
}

pub fn prepare_true_quit(controller: &dyn QuitEngineController, stop_on_quit: bool) -> Vec<String> {
    if !stop_on_quit {
        controller.detach_all();
        return Vec::new();
    }

    let mut errors = Vec::new();
    for id in controller.engine_ids() {
        if let Err(error) = controller.stop_engine(&id) {
            errors.push(format!("{}: {error}", id.0));
        }
    }
    errors
}

impl QuitEngineController for LocalSupervisor {
    fn engine_ids(&self) -> Vec<EngineId> {
        self.status()
            .into_iter()
            .filter(|status| status.state != EngineState::Stopped)
            .map(|status| EngineId(status.id))
            .collect()
    }

    fn stop_engine(&self, id: &EngineId) -> Result<(), String> {
        self.stop(id).map_err(|error| error.to_string())
    }

    fn detach_all(&self) {
        LocalSupervisor::detach_all(self);
    }
}
