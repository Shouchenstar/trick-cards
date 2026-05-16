use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

/// 把字节写入 app data 目录的 images/ 子目录，返回可被 convertFileSrc 使用的绝对路径。
#[tauri::command]
fn save_image(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    ext: String,
) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("images");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    // 简单去重：纳秒时间戳 + bytes 长度
    let safe_ext = ext
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>();
    let safe_ext = if safe_ext.is_empty() { "png".into() } else { safe_ext };
    let filename = format!("{}_{}.{}", stamp, bytes.len(), safe_ext);
    let path = dir.join(&filename);
    fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// 删除磁盘上的图片文件。失败也不报错（文件可能已不存在）。
#[tauri::command]
fn delete_image(path: String) -> Result<(), String> {
    let _ = fs::remove_file(&path);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![save_image, delete_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
