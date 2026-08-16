pub mod paths;
pub mod profile_store;
pub mod recovery;
pub mod settings_store;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("unsupported schema {0}")]
    UnsupportedSchema(u32),
    #[error("stale revision")]
    StaleRevision,
}

pub use paths::*;
pub use profile_store::*;
pub use recovery::*;
pub use settings_store::*;
