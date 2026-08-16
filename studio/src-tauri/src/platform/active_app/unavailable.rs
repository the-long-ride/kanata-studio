use crate::platform::PlatformError;

use super::{ActiveApp, ActiveAppProvider};

pub struct UnavailableActiveApp;

impl ActiveAppProvider for UnavailableActiveApp {
    fn current(&self) -> Result<ActiveApp, PlatformError> {
        Err(PlatformError::Unavailable(
            "active-app detection is unavailable on this platform".to_string(),
        ))
    }
}
