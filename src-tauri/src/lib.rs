use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::sync::Mutex;
use tauri::Emitter;

const BRIDGE_PORT: u16 = 18920;

/// Shared API config between bridge thread and Tauri commands
type SharedConfig = std::sync::Arc<Mutex<String>>;

struct WatcherState {
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

#[tauri::command]
fn scan_cloud_workspace() -> Option<String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();

    let candidates: Vec<String> = if cfg!(target_os = "windows") {
        vec![
            format!("{}\\OneDrive\\SmartLex\\workspace.lex", home),
            format!("{}\\Dropbox\\SmartLex\\workspace.lex", home),
            format!("{}\\Google Drive\\SmartLex\\workspace.lex", home),
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            format!("{}/Library/CloudStorage/OneDrive/SmartLex/workspace.lex", home),
            format!("{}/Dropbox/SmartLex/workspace.lex", home),
            format!("{}/Google Drive/SmartLex/workspace.lex", home),
        ]
    } else {
        vec![
            format!("{}/OneDrive/SmartLex/workspace.lex", home),
            format!("{}/Dropbox/SmartLex/workspace.lex", home),
        ]
    };

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            log::info!("[SmartLex] Found cloud workspace at: {}", path);
            return Some(path.clone());
        }
    }
    log::info!("[SmartLex] No cloud workspace found");
    None
}

#[tauri::command]
fn read_workspace_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read: {}", e))
}

#[tauri::command]
fn write_workspace_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
    }
    std::fs::write(&path, &content).map_err(|e| format!("write: {}", e))
}

#[tauri::command]
fn create_cloud_workspace() -> Result<String, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();

    let (dir, path) = if cfg!(target_os = "windows") {
        (format!("{}\\OneDrive\\SmartLex", home), format!("{}\\OneDrive\\SmartLex\\workspace.lex", home))
    } else {
        (format!("{}/OneDrive/SmartLex", home), format!("{}/OneDrive/SmartLex/workspace.lex", home))
    };

    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {}", e))?;
    if !std::path::Path::new(&path).exists() {
        let empty = r#"{"version":"1.2.0","library":[],"history":[],"inbox":[],"reviewQueue":[],"lastSynced":""}"#;
        std::fs::write(&path, empty).map_err(|e| format!("write: {}", e))?;
        log::info!("[SmartLex] Created cloud workspace at: {}", path);
    }
    Ok(path)
}

#[tauri::command]
fn push_api_config(json: String, config: tauri::State<'_, SharedConfig>) {
    *config.lock().unwrap() = json;
    log::info!("[SmartLex] API config pushed to bridge");
}

#[tauri::command]
fn start_watching(
    app: tauri::AppHandle,
    path: String,
    state: tauri::State<'_, WatcherState>,
) -> Result<(), String> {
    *state.watcher.lock().map_err(|e| e.to_string())? = None;
    let app_handle = app.clone();
    let path_for_event = path.clone();

    let mut watcher = notify::recommended_watcher(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                    log::info!("[SmartLex] External change: {}", path_for_event);
                    let _ = app_handle.emit("workspace-file-changed", &path_for_event);
                }
            }
        },
    ).map_err(|e| format!("watcher: {}", e))?;

    watcher.watch(std::path::Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| format!("watch: {}", e))?;

    *state.watcher.lock().map_err(|e| e.to_string())? = Some(watcher);
    log::info!("[SmartLex] Watching: {}", path);
    Ok(())
}

#[tauri::command]
fn stop_watching(state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    *state.watcher.lock().map_err(|e| e.to_string())? = None;
    log::info!("[SmartLex] Stopped watcher");
    Ok(())
}

// ═══ Local HTTP bridge ═══

fn start_local_bridge(app_handle: tauri::AppHandle, api_config: SharedConfig) {
    std::thread::spawn(move || {
        let addr = format!("127.0.0.1:{}", BRIDGE_PORT);
        let server = match tiny_http::Server::http(&addr) {
            Ok(s) => s,
            Err(e) => {
                log::warn!("[SmartLex] Bridge failed to start on {}: {}", addr, e);
                return;
            }
        };
        log::info!("[SmartLex] Bridge listening on {}", addr);

        fn header(s: &str) -> tiny_http::Header {
            s.parse::<tiny_http::Header>().unwrap()
        }
        fn cors() -> Vec<tiny_http::Header> {
            vec![
                header("Access-Control-Allow-Origin: *"),
                header("Access-Control-Allow-Methods: GET, POST, OPTIONS"),
                header("Access-Control-Allow-Headers: Content-Type"),
            ]
        }

        for mut request in server.incoming_requests() {
            let url = request.url().to_string();
            let is_capture = url == "/capture" && request.method() == &tiny_http::Method::Post;
            let is_config = url == "/config" && request.method() == &tiny_http::Method::Get;

            let response = if is_capture {
                let mut body = String::new();
                if request.as_reader().read_to_string(&mut body).is_ok() && !body.is_empty() {
                    log::info!("[SmartLex] Bridge capture: {} chars", body.len());
                    let _ = app_handle.emit("inbox-captured", &body);
                }
                let config = api_config.lock().unwrap().clone();
                let mut r = tiny_http::Response::from_string(config);
                r.add_header(header("Content-Type: application/json"));
                for h in cors() { r.add_header(h); }
                r
            } else if is_config {
                let config = api_config.lock().unwrap().clone();
                let mut r = tiny_http::Response::from_string(config);
                r.add_header(header("Content-Type: application/json"));
                for h in cors() { r.add_header(h); }
                r
            } else if request.method() == &tiny_http::Method::Options {
                let mut r = tiny_http::Response::from_string("").with_status_code(204);
                for h in cors() { r.add_header(h); }
                r
            } else {
                let mut r = tiny_http::Response::from_string("smartlex-bridge");
                r.add_header(header("Content-Type: text/plain"));
                for h in cors() { r.add_header(h); }
                r
            };
            let _ = request.respond(response);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let api_config: SharedConfig = std::sync::Arc::new(Mutex::new(String::from("{}")));
    let api_config_for_setup = api_config.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .manage(WatcherState { watcher: Mutex::new(None) })
        .manage(api_config)
        .invoke_handler(tauri::generate_handler![
            scan_cloud_workspace,
            create_cloud_workspace,
            read_workspace_file,
            write_workspace_file,
            push_api_config,
            start_watching,
            stop_watching,
        ])
        .setup(move |app| {
            start_local_bridge(app.handle().clone(), api_config_for_setup);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
