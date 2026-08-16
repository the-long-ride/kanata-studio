#[cfg(target_os = "linux")]
pub mod linux_x11;
#[cfg(target_os = "macos")]
pub mod macos;
pub mod unavailable;
#[cfg(target_os = "windows")]
pub mod windows;

use super::PlatformError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActiveApp {
    pub executable: String,
    pub window_title: Option<String>,
}

pub trait ActiveAppProvider: Send + Sync {
    fn current(&self) -> Result<ActiveApp, PlatformError>;
}

pub fn system_provider() -> Box<dyn ActiveAppProvider> {
    #[cfg(target_os = "windows")]
    return Box::new(windows::WindowsActiveApp);
    #[cfg(target_os = "macos")]
    return Box::new(macos::MacActiveApp);
    #[cfg(target_os = "linux")]
    return Box::new(linux_x11::LinuxActiveApp);
    #[allow(unreachable_code)]
    Box::new(unavailable::UnavailableActiveApp)
}
