use std::{cell::RefCell, collections::BTreeSet};

use kanata_studio::engine::{
    EngineId,
    shutdown::{QuitEngineController, prepare_true_quit},
};

struct FakeController {
    ids: Vec<EngineId>,
    fail: BTreeSet<String>,
    stopped: RefCell<Vec<String>>,
    detached: RefCell<bool>,
}

impl FakeController {
    fn new(ids: &[&str], fail: &[&str]) -> Self {
        Self {
            ids: ids.iter().map(|id| EngineId((*id).into())).collect(),
            fail: fail.iter().map(|id| (*id).to_string()).collect(),
            stopped: RefCell::new(Vec::new()),
            detached: RefCell::new(false),
        }
    }
}

impl QuitEngineController for FakeController {
    fn engine_ids(&self) -> Vec<EngineId> {
        self.ids.clone()
    }

    fn stop_engine(&self, id: &EngineId) -> Result<(), String> {
        self.stopped.borrow_mut().push(id.0.clone());
        if self.fail.contains(&id.0) {
            Err("stop failed".into())
        } else {
            Ok(())
        }
    }

    fn detach_all(&self) {
        *self.detached.borrow_mut() = true;
    }
}

#[test]
fn true_quit_stops_every_engine_when_enabled_even_if_one_fails() {
    let fake = FakeController::new(&["a", "b", "c"], &["b"]);
    let errors = prepare_true_quit(&fake, true);
    assert_eq!(&*fake.stopped.borrow(), &["a", "b", "c"]);
    assert_eq!(errors.len(), 1);
    assert!(errors[0].contains("b"));
    assert!(!*fake.detached.borrow());
}

#[test]
fn true_quit_detaches_and_does_not_stop_when_disabled() {
    let fake = FakeController::new(&["a"], &[]);
    let errors = prepare_true_quit(&fake, false);
    assert!(errors.is_empty());
    assert!(fake.stopped.borrow().is_empty());
    assert!(*fake.detached.borrow());
}
