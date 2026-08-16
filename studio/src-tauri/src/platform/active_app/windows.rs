use std::{ffi::OsString, os::windows::ffi::OsStringExt};

use windows_sys::Win32::{
    Foundation::{CloseHandle, MAX_PATH},
    System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
    },
    UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    },
};

use crate::platform::PlatformError;

use super::{ActiveApp, ActiveAppProvider};

pub struct WindowsActiveApp;

impl ActiveAppProvider for WindowsActiveApp {
    fn current(&self) -> Result<ActiveApp, PlatformError> {
        unsafe {
            let window = GetForegroundWindow();
            if window == 0 {
                return Err(PlatformError::Unavailable(
                    "no foreground window".to_string(),
                ));
            }

            let mut pid = 0;
            GetWindowThreadProcessId(window, &mut pid);
            if pid == 0 {
                return Err(PlatformError::Unavailable(
                    "foreground PID unavailable".to_string(),
                ));
            }

            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if process == 0 {
                return Err(PlatformError::Unavailable(
                    "cannot query foreground process".to_string(),
                ));
            }

            let mut buffer = vec![0u16; MAX_PATH as usize * 4];
            let mut len = buffer.len() as u32;
            let ok = QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut len);
            CloseHandle(process);
            if ok == 0 {
                return Err(PlatformError::Unavailable(
                    "cannot read process path".to_string(),
                ));
            }
            buffer.truncate(len as usize);
            let path = OsString::from_wide(&buffer);
            let executable = std::path::Path::new(&path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_string();

            let title_length = GetWindowTextLengthW(window);
            let window_title = if title_length > 0 {
                let mut title = vec![0u16; title_length as usize + 1];
                let copied = GetWindowTextW(window, title.as_mut_ptr(), title.len() as i32);
                (copied > 0).then(|| String::from_utf16_lossy(&title[..copied as usize]))
            } else {
                None
            };

            Ok(ActiveApp {
                executable,
                window_title,
            })
        }
    }
}
