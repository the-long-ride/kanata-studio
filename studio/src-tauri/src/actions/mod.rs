pub mod clipboard;
pub mod dispatcher;
pub mod launch;
pub mod type_text;

pub use dispatcher::dispatch_message;

use std::sync::Weak;

use thiserror::Error;

use crate::{
    compiler::StudioExternalAction,
    engine::{EngineId, LocalSupervisor},
};

#[derive(Debug, Error)]
pub enum ActionError {
    #[error("malformed Studio action message")]
    Malformed,
    #[error("unknown action: {0}")]
    Unknown(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("clipboard: {0}")]
    Clipboard(String),
    #[error("invalid URL: {0}")]
    InvalidUrl(String),
    #[error("engine unavailable while executing text action")]
    EngineUnavailable,
    #[error("engine action failed: {0}")]
    Engine(String),
}

pub trait ExternalActionExecutor: Send + Sync {
    fn execute(
        &self,
        engine_id: &EngineId,
        action: &StudioExternalAction,
    ) -> Result<(), ActionError>;
}

pub struct DesktopExecutor {
    supervisor: Weak<LocalSupervisor>,
}

impl DesktopExecutor {
    pub fn new(supervisor: Weak<LocalSupervisor>) -> Self {
        Self { supervisor }
    }
}

impl ExternalActionExecutor for DesktopExecutor {
    fn execute(
        &self,
        engine_id: &EngineId,
        action: &StudioExternalAction,
    ) -> Result<(), ActionError> {
        match action {
            StudioExternalAction::LaunchApp { path, args } => launch::launch_app(path, args),
            StudioExternalAction::OpenUrl { url } => launch::open_url(url),
            StudioExternalAction::Text { text } => {
                let supervisor = self
                    .supervisor
                    .upgrade()
                    .ok_or(ActionError::EngineUnavailable)?;
                type_text::type_text(text, || {
                    supervisor
                        .tap_fake_key(engine_id, "studio-paste")
                        .map_err(|error| ActionError::Engine(error.to_string()))
                })
            }
        }
    }
}
