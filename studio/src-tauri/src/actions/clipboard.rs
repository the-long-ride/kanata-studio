use std::{thread, time::Duration};

use super::ActionError;

pub fn with_clipboard_text<T>(
    text: &str,
    action: impl FnOnce() -> Result<T, ActionError>,
) -> Result<T, ActionError> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|error| ActionError::Clipboard(error.to_string()))?;
    let previous_text = clipboard.get_text().ok();

    clipboard
        .set_text(text)
        .map_err(|error| ActionError::Clipboard(error.to_string()))?;

    let result = action();
    thread::sleep(Duration::from_millis(120));

    // Avoid overwriting content the user copied while the paste was in flight.
    let still_ours = clipboard.get_text().ok().as_deref() == Some(text);
    if still_ours && let Some(previous) = previous_text {
        let _ = clipboard.set_text(previous);
    }

    result
}
