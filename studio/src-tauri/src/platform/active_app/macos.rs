use std::path::Path;
use std::process::Command;

use crate::platform::PlatformError;

use super::{ActiveApp, ActiveAppProvider};

pub struct MacActiveApp;

impl ActiveAppProvider for MacActiveApp {
    fn current(&self) -> Result<ActiveApp, PlatformError> {
        let script = concat!(
            "tell application \"System Events\" to set frontProc to first process whose frontmost is true\n",
            "set procId to unix id of frontProc\n",
            "set procTitle to \"\"\n",
            "try\n",
            "set procTitle to name of front window of frontProc\n",
            "end try\n",
            "return (procId as string) & linefeed & procTitle"
        );
        let output = Command::new("osascript")
            .args(["-e", script])
            .output()
            .map_err(|error| PlatformError::Unavailable(error.to_string()))?;
        if !output.status.success() {
            return Err(PlatformError::Unavailable(
                String::from_utf8_lossy(&output.stderr).trim().to_string(),
            ));
        }

        let text = String::from_utf8_lossy(&output.stdout);
        let mut lines = text.lines();
        let pid = lines
            .next()
            .and_then(|value| value.trim().parse::<u32>().ok())
            .ok_or_else(|| PlatformError::Unavailable("invalid frontmost process id".into()))?;
        let title = lines.collect::<Vec<_>>().join("\n").trim().to_string();
        let executable = executable_name(pid)?;

        Ok(ActiveApp {
            executable,
            window_title: (!title.is_empty()).then_some(title),
        })
    }
}

fn executable_name(pid: u32) -> Result<String, PlatformError> {
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "comm="])
        .output()
        .map_err(|error| PlatformError::Unavailable(error.to_string()))?;
    if !output.status.success() {
        return Err(PlatformError::Unavailable(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }
    let command = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let executable = Path::new(&command)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(command.as_str())
        .to_string();
    if executable.is_empty() {
        Err(PlatformError::Unavailable(
            "macOS process executable was empty".into(),
        ))
    } else {
        Ok(executable)
    }
}
