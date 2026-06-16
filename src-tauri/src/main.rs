// 在 Windows 發行版本中隱藏主控台視窗
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    focal_craft_launcher_lib::run()
}
