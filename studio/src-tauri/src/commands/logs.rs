use crate::app_state::AppState;
use tauri::State;

#[tauri::command]
pub fn open_logs(state: State<'_, AppState>) -> Result<(), String> {
    let path = state.paths.logs();
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;

    Ok(())
}
