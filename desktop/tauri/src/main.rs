// Release builds are GUI-subsystem apps: without this, Windows opens a console window next to the app,
// and closing that console terminates Clario (STATUS_CONTROL_C_EXIT).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    clario_lib::run();
}
