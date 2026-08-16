use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RuntimeHealth {
    Running,
    Paused,
    Recovering,
    RecoveryRequired { message: String },
}

#[derive(Debug, Default)]
pub struct RestartBudget {
    attempts: u8,
}

impl RestartBudget {
    pub fn take_automatic_restart(&mut self) -> bool {
        if self.attempts >= 1 {
            return false;
        }
        self.attempts += 1;
        true
    }

    pub fn reset(&mut self) {
        self.attempts = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automatic_restart_budget_allows_one_attempt_then_stops() {
        let mut budget = RestartBudget::default();
        assert!(budget.take_automatic_restart());
        assert!(!budget.take_automatic_restart());
        assert!(!budget.take_automatic_restart());
    }

    #[test]
    fn manual_reset_reenables_one_automatic_restart() {
        let mut budget = RestartBudget::default();
        assert!(budget.take_automatic_restart());
        assert!(!budget.take_automatic_restart());
        budget.reset();
        assert!(budget.take_automatic_restart());
    }
}
