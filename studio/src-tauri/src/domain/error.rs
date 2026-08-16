use thiserror::Error;

#[derive(Debug, Error, Clone)]
pub enum DomainError {
    #[error("global all-keyboard profile missing or duplicated")]
    MissingGlobal,
    #[error("duplicate profile scope: {0}")]
    DuplicateScope(String),
    #[error("raw profile has no editable visual mappings")]
    RawReadOnly,
    #[error("invalid profile: {0}")]
    Invalid(String),
}
