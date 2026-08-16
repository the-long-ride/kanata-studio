use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSpan {
    pub line: usize,
    pub column: usize,
    pub length: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub ok: bool,
    pub message: Option<String>,
    pub span: Option<DiagnosticSpan>,
}

impl ValidationResult {
    pub fn ok() -> Self {
        Self {
            ok: true,
            message: None,
            span: None,
        }
    }
}

pub fn validate_kbd(text: &str) -> ValidationResult {
    match kanata_parser::cfg::new_from_str(text, rustc_hash::FxHashMap::default()) {
        Ok(_) => ValidationResult {
            ok: true,
            message: None,
            span: None,
        },
        Err(error) => ValidationResult {
            ok: false,
            message: Some(format!("{error:?}")),
            span: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_minimal_valid_config() {
        let result = validate_kbd("(defsrc)\n(deflayermap (base) caps esc)");
        assert!(result.ok, "{:?}", result.message);
    }

    #[test]
    fn rejects_invalid_config() {
        let result = validate_kbd("(defsrc caps");
        assert!(!result.ok);
    }
}
