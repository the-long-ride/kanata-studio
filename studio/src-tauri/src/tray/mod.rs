pub mod events;
pub mod menu;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle,
};

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Studio", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause / resume remapping", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Restart engine", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(app, "autostart", "Start with system", true, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[&open, &pause, &restart, &autostart, &separator, &quit],
    )?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| events::handle_menu(app, event.id().as_ref()));
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
