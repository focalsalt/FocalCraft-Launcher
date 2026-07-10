use std::fs;
use notify::Watcher;
use tauri::{AppHandle, State};
use tauri::Emitter;
use crate::minecraft::get_instances_dir;

#[tauri::command]
pub async fn watch_instance_folders(
    app: AppHandle,
    state: State<'_, crate::WatcherState>,
    instance_id: String,
) -> Result<(), String> {
    // 1. 先停止舊的監聽器
    {
        let mut w_lock = state.watcher.lock().map_err(|e| e.to_string())?;
        if let Some((old_id, mut old_watcher)) = w_lock.take() {
            println!("Stopping watcher for instance: {}", old_id);
            let path = get_instances_dir()?.join(&old_id).join("minecraft");
            let _ = old_watcher.unwatch(&path);
        }
    }

    // 2. 啟動新的監聽器
    let instance_dir = get_instances_dir()?.join(&instance_id);
    if !instance_dir.exists() || !instance_dir.join("instance.cfg").exists() {
        return Err("實例資料夾或設定檔不存在，可能已被更名或刪除".to_string());
    }

    let instance_path = instance_dir.join("minecraft");
    if !instance_path.exists() {
        let _ = fs::create_dir_all(&instance_path);
    }

    let app_clone = app.clone();
    let instance_id_clone = instance_id.clone();

    let mut watcher =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| match res {
            Ok(event) => {
                let is_relevant_event = matches!(
                    event.kind,
                    notify::EventKind::Create(_)
                        | notify::EventKind::Modify(_)
                        | notify::EventKind::Remove(_)
                );
                if is_relevant_event {
                    for path in &event.paths {
                        for component in path.components() {
                            if let Some(name) = component.as_os_str().to_str() {
                                if name == "mods"
                                    || name == "saves"
                                    || name == "screenshots"
                                    || name == "datapacks"
                                {
                                    println!(
                                        "Folder watcher event: {} in {}",
                                        name,
                                        path.display()
                                    );
                                    let _ = app_clone.emit(
                                        "folder-change",
                                        serde_json::json!({
                                            "folder": name,
                                            "instanceId": instance_id_clone,
                                        }),
                                    );
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Watcher error: {:?}", e);
            }
        })
        .map_err(|e| format!("無法建立檔案監聽器: {}", e))?;

    watcher
        .watch(&instance_path, notify::RecursiveMode::Recursive)
        .map_err(|e| format!("監聽資料夾失敗: {}", e))?;

    {
        let mut w_lock = state.watcher.lock().map_err(|e| e.to_string())?;
        *w_lock = Some((instance_id, watcher));
    }

    println!("Started folder watcher for instance at {:?}", instance_path);
    Ok(())
}

#[tauri::command]
pub async fn unwatch_instance_folders(state: State<'_, crate::WatcherState>) -> Result<(), String> {
    let mut w_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    if let Some((old_id, mut old_watcher)) = w_lock.take() {
        println!("Unwatching folder for instance: {}", old_id);
        let path = get_instances_dir()?.join(&old_id).join("minecraft");
        let _ = old_watcher.unwatch(&path);
    }
    Ok(())
}

#[tauri::command]
pub async fn watch_instances_dir(
    app: AppHandle,
    state: State<'_, crate::RootWatcherState>,
) -> Result<(), String> {
    let instances_dir = get_instances_dir()?;
    let mut w_lock = state.watcher.lock().map_err(|e| e.to_string())?;

    // 停止舊的監視器
    if let Some(mut old_watcher) = w_lock.take() {
        let _ = old_watcher.unwatch(&instances_dir);
    }

    // 建立新的監視器
    let app_clone = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            let is_dir_change = matches!(
                event.kind,
                notify::EventKind::Create(_) | notify::EventKind::Remove(_) | notify::EventKind::Modify(_)
            );
            if is_dir_change {
                println!("Instances directory changed, emitting instances-changed event");
                let _ = app_clone.emit("instances-changed", ());
            }
        }
    }).map_err(|e| format!("無法建立目錄監聽器: {}", e))?;

    watcher
        .watch(&instances_dir, notify::RecursiveMode::NonRecursive)
        .map_err(|e| format!("監聽實例目錄失敗: {}", e))?;

    *w_lock = Some(watcher);
    println!("Started watching instances directory: {:?}", instances_dir);
    Ok(())
}
