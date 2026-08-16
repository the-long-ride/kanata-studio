use super::{ActionError, clipboard::with_clipboard_text};

pub fn type_text(
    text: &str,
    trigger_paste: impl FnOnce() -> Result<(), ActionError>,
) -> Result<(), ActionError> {
    with_clipboard_text(text, trigger_paste)
}
