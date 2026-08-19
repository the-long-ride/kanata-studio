use parking_lot::Mutex;

#[derive(Default)]
pub struct RuntimeApplyGate {
    lock: Mutex<()>,
}

impl RuntimeApplyGate {
    pub fn run<T>(&self, operation: impl FnOnce() -> T) -> T {
        let _guard = self.lock.lock();
        operation()
    }
}

#[cfg(test)]
mod tests {
    use std::{
        sync::{
            Arc, Barrier,
            atomic::{AtomicUsize, Ordering},
        },
        thread,
        time::Duration,
    };

    use super::RuntimeApplyGate;

    #[test]
    fn serializes_concurrent_runtime_operations() {
        let gate = Arc::new(RuntimeApplyGate::default());
        let start = Arc::new(Barrier::new(5));
        let active = Arc::new(AtomicUsize::new(0));
        let max_active = Arc::new(AtomicUsize::new(0));
        let mut workers = Vec::new();

        for _ in 0..4 {
            let gate = Arc::clone(&gate);
            let start = Arc::clone(&start);
            let active = Arc::clone(&active);
            let max_active = Arc::clone(&max_active);
            workers.push(thread::spawn(move || {
                start.wait();
                gate.run(|| {
                    let current = active.fetch_add(1, Ordering::SeqCst) + 1;
                    max_active.fetch_max(current, Ordering::SeqCst);
                    thread::sleep(Duration::from_millis(20));
                    active.fetch_sub(1, Ordering::SeqCst);
                });
            }));
        }

        start.wait();
        for worker in workers {
            worker.join().unwrap();
        }

        assert_eq!(max_active.load(Ordering::SeqCst), 1);
    }
}
