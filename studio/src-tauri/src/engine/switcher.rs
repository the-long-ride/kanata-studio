use std::time::{Duration, Instant};

#[derive(Debug)]
pub struct ProfileSwitcher {
    last_hash: Option<String>,
    pending_hash: Option<String>,
    changed_at: Option<Instant>,
    settle_time: Duration,
}

impl Default for ProfileSwitcher {
    fn default() -> Self {
        Self {
            last_hash: None,
            pending_hash: None,
            changed_at: None,
            settle_time: Duration::from_millis(180),
        }
    }
}

impl ProfileSwitcher {
    pub fn observe(&mut self, hash: &str, now: Instant) -> bool {
        if self.last_hash.as_deref() == Some(hash) {
            self.pending_hash = None;
            return false;
        }
        if self.pending_hash.as_deref() != Some(hash) {
            self.pending_hash = Some(hash.into());
            self.changed_at = Some(now);
            return false;
        }
        if self
            .changed_at
            .is_some_and(|changed| now.duration_since(changed) < self.settle_time)
        {
            return false;
        }
        self.last_hash = self.pending_hash.take();
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coalesces_rapid_context_changes() {
        let start = Instant::now();
        let mut switcher = ProfileSwitcher::default();
        assert!(!switcher.observe("a", start));
        assert!(!switcher.observe("b", start + Duration::from_millis(50)));
        assert!(!switcher.observe("b", start + Duration::from_millis(100)));
        assert!(switcher.observe("b", start + Duration::from_millis(250)));
        assert!(!switcher.observe("b", start + Duration::from_millis(500)));
    }
}
