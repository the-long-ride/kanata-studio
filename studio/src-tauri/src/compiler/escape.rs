use super::CompileError;

pub fn validate_atom(value: &str) -> Result<&str, CompileError> {
    if value.is_empty()
        || value
            .chars()
            .any(|ch| ch.is_whitespace() || matches!(ch, '(' | ')' | '"' | ';'))
    {
        return Err(CompileError::InvalidAtom(value.into()));
    }
    Ok(value)
}

pub fn quote(value: &str) -> String {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}
