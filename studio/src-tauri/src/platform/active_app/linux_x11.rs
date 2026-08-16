use std::{env, fs, process::Command};

use crate::platform::PlatformError;

use super::{ActiveApp, ActiveAppProvider};

pub struct LinuxActiveApp;

impl ActiveAppProvider for LinuxActiveApp {
    fn current(&self) -> Result<ActiveApp, PlatformError> {
        if env::var_os("WAYLAND_DISPLAY").is_some() && env::var_os("DISPLAY").is_none() {
            return Err(PlatformError::Unavailable(
                "Wayland session has no portable active-window API; use manual profile selection"
                    .to_string(),
            ));
        }
        if env::var_os("DISPLAY").is_none() {
            return Err(PlatformError::Unavailable(
                "X11 DISPLAY is not available".to_string(),
            ));
        }

        let root = run_xprop(&["-root", "_NET_ACTIVE_WINDOW"])?;
        let window_id = root
            .split_whitespace()
            .last()
            .filter(|id| *id != "0x0")
            .ok_or_else(|| PlatformError::Unavailable("no active X11 window".to_string()))?;
        let pid_output = run_xprop(&["-id", window_id, "_NET_WM_PID"])?;
        let pid = pid_output
            .split_whitespace()
            .last()
            .and_then(|text| text.parse::<u32>().ok())
            .ok_or_else(|| PlatformError::Unavailable("active window has no PID".to_string()))?;

        let executable_path = fs::read_link(format!("/proc/{pid}/exe"))
            .map_err(|error| PlatformError::Unavailable(error.to_string()))?;
        let executable = executable_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();
        let title_output = run_xprop(&["-id", window_id, "_NET_WM_NAME"]).ok();
        let window_title = title_output.and_then(|line| quoted_value(&line));

        Ok(ActiveApp {
            executable,
            window_title,
        })
    }
}

fn run_xprop(args: &[&str]) -> Result<String, PlatformError> {
    let output = Command::new("xprop")
        .args(args)
        .output()
        .map_err(|error| PlatformError::Unavailable(format!("xprop unavailable: {error}")))?;
    if !output.status.success() {
        return Err(PlatformError::Unavailable(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn quoted_value(line: &str) -> Option<String> {
    let start = line.find('"')? + 1;
    let end = line.rfind('"')?;
    (end >= start).then(|| line[start..end].to_string())
}

#[cfg(test)]
mod tests {
    use super::quoted_value;

    #[test]
    fn parses_xprop_title() {
        assert_eq!(
            quoted_value("_NET_WM_NAME(UTF8_STRING) = \"Editor — file\""),
            Some("Editor — file".to_string())
        );
    }
}
