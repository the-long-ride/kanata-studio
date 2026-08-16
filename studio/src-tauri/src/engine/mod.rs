pub mod logs;
pub mod model;
pub mod ports;
pub(crate) mod process;
pub mod recovery;
pub mod supervisor;
pub mod switcher;
pub mod tcp;
pub mod topology;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("engine request timed out")]
    Timeout,
    #[error("server error: {0}")]
    Server(String),
    #[error("protocol error: {0}")]
    Protocol(String),
    #[error("unknown engine: {0}")]
    UnknownEngine(String),
    #[error("process error: {0}")]
    Process(String),
}

pub use model::*;
pub use recovery::RuntimeHealth;
pub use supervisor::*;
pub use tcp::KanataTcpClient;
pub use topology::{EngineTopology, plan_engine_topology};
