use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct StudioPaths {
    pub root: PathBuf,
}

impl StudioPaths {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn profiles(&self) -> PathBuf {
        self.root.join("profiles.json")
    }

    pub fn settings(&self) -> PathBuf {
        self.root.join("settings.json")
    }

    pub fn runtime(&self, id: &str) -> PathBuf {
        self.root.join("runtime").join(format!("{id}.kbd"))
    }

    pub fn recovery(&self, id: &str) -> PathBuf {
        self.root.join("recovery").join(format!("{id}.kbd"))
    }

    pub fn raw(&self, id: &str) -> PathBuf {
        self.root.join("profiles").join(format!("{id}.kbd"))
    }

    pub fn logs(&self) -> PathBuf {
        self.root.join("logs")
    }
}

pub fn ensure_parent(path: &Path) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}
