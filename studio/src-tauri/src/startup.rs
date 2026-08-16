pub fn is_background_launch() -> bool {
    std::env::args().any(|arg| arg == "--background")
}
