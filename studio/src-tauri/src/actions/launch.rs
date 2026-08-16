use std::process::{Command, Stdio};

use url::Url;

use super::ActionError;

pub fn launch_app(path: &str, args: &[String]) -> Result<(), ActionError> {
    Command::new(path)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(ActionError::Io)
}

pub fn open_url(url: &str) -> Result<(), ActionError> {
    let parsed = Url::parse(url).map_err(|error| ActionError::InvalidUrl(error.to_string()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(ActionError::InvalidUrl(
            "Beginner mode allows only http/https URLs".to_string(),
        ));
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("rundll32");
        command.arg("url.dll,FileProtocolHandler").arg(url);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(url);
        command
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        command
    };

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(ActionError::Io)
}
