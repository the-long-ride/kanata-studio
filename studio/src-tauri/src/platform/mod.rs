pub mod active_app;
pub mod capabilities;
pub mod devices;
pub mod layout;
pub mod permissions;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum PlatformError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("platform feature unavailable: {0}")]
    Unavailable(String),
    #[error("platform error: {0}")]
    Other(String),
}
