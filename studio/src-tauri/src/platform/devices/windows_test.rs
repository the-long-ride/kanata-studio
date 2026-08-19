use super::*;

fn raw(
    path: &str,
    container_id: Option<&str>,
    vendor_id: u16,
    product_id: u16,
) -> RawKeyboardInterface {
    RawKeyboardInterface {
        path: path.into(),
        container_id: container_id.map(str::to_string),
        vendor_id: Some(vendor_id),
        product_id: Some(product_id),
        layout: KeyboardLayout::Ansi,
        reported_key_count: None,
        function_key_count: None,
        keyboard_type: None,
    }
}

#[test]
fn parses_usb_ids_from_raw_input_path() {
    let path = r"\\?\HID#VID_046D&PID_C52B&MI_00#7&abc";
    assert_eq!(parse_vid_pid(path), (Some(0x046D), Some(0xC52B)));
}

#[test]
fn groups_two_interfaces_with_same_container_into_one_keyboard() {
    let devices = group_interfaces(vec![
        raw(
            "path-a",
            Some("{11111111-1111-1111-1111-111111111111}"),
            0x1234,
            0x5678,
        ),
        raw(
            "path-b",
            Some("{11111111-1111-1111-1111-111111111111}"),
            0x1234,
            0x5678,
        ),
    ]);
    assert_eq!(devices.len(), 1);
    assert_eq!(devices[0].interface_paths, vec!["path-a", "path-b"]);
}

#[test]
fn identical_vid_pid_different_containers_stay_distinct() {
    let devices = group_interfaces(vec![
        raw(
            "path-a",
            Some("{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}"),
            1,
            2,
        ),
        raw(
            "path-b",
            Some("{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}"),
            1,
            2,
        ),
    ]);
    assert_eq!(devices.len(), 2);
    assert_ne!(devices[0].id, devices[1].id);
}

#[test]
fn missing_container_keeps_legacy_path_identity() {
    let devices = group_interfaces(vec![raw("path-a", None, 1, 2)]);
    assert_eq!(devices.len(), 1);
    assert!(devices[0].id.starts_with("windows-"));
    assert_eq!(devices[0].interface_paths, vec!["path-a"]);
}

#[test]
fn groups_keyboard_hardware_metadata() {
    let rows = vec![RawKeyboardInterface {
        path: "path-a".into(),
        container_id: None,
        vendor_id: Some(1),
        product_id: Some(2),
        layout: KeyboardLayout::Ansi,
        reported_key_count: Some(104),
        function_key_count: Some(12),
        keyboard_type: Some(4),
    }];
    let devices = group_interfaces(rows);
    assert_eq!(devices[0].reported_key_count, Some(104));
    assert_eq!(devices[0].function_key_count, Some(12));
    assert_eq!(devices[0].keyboard_type, Some(4));
}
