use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Listener, Manager,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to the app.", name)
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(format!(
            "Version {} is available!\n\n{}",
            update.version,
            update.body.unwrap_or_default()
        ))),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_platform() -> String {
    #[cfg(target_os = "ios")]
    return "ios".to_string();
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    #[cfg(not(any(target_os = "ios", target_os = "macos", target_os = "windows", target_os = "linux")))]
    return "unknown".to_string();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Build the application menu
            let app_menu = build_menu(app.handle())?;
            app.set_menu(app_menu)?;

            // Handle app menu events
            app.on_menu_event(|app, event| {
                if let Some(window) = app.get_webview_window("main") {
                    match event.id.as_ref() {
                        "close-window" => {
                            let _ = window.close();
                        }
                        "reload" => {
                            let _ = window.eval("window.location.reload()");
                        }
                        #[cfg(debug_assertions)]
                        "dev-tools" => {
                            if window.is_devtools_open() {
                                window.close_devtools();
                            } else {
                                window.open_devtools();
                            }
                        }
                        _ => {}
                    }
                }
            });

            // Build system tray
            build_tray(app)?;

            // Handle deep links (auth callback, navigation)
            // SWAP: Update the deep link scheme and URL handling for your app
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event: tauri::Event| {
                let payload = event.payload();
                if let Some(window) = handle.get_webview_window("main") {
                    if payload.contains("auth/callback") {
                        // Auth callback from browser — extract token
                        let raw = payload
                            .trim_start_matches('"')
                            .trim_end_matches('"');

                        // Sanitize token to JWT-safe characters only
                        let token: String = raw
                            .split("token=")
                            .nth(1)
                            .unwrap_or("")
                            .split('&')
                            .next()
                            .unwrap_or("")
                            .chars()
                            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
                            .collect();

                        if !token.is_empty() {
                            let url = format!("/auth/desktop-signin?token={}", token);
                            let _ = window.eval(&format!(
                                "window.location.href = '{}'",
                                url
                            ));
                        } else {
                            let _ = window.eval(
                                "window.location.href = '/login?error=missing_token'"
                            );
                        }
                    } else {
                        // Navigation deep link
                        let safe_path: String = payload
                            .trim_start_matches("template-app://")
                            .trim_start_matches("\"")
                            .trim_end_matches("\"")
                            .chars()
                            .filter(|c: &char| c.is_alphanumeric() || *c == '/' || *c == '-' || *c == '_' || *c == '?' || *c == '=' || *c == '%' || *c == '.')
                            .collect();
                        let _ = window.eval(&format!("window.location.href = '/{}'", safe_path));
                    }
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            check_for_updates,
            install_update,
            get_platform,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_menu(
    handle: &tauri::AppHandle,
) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let file_menu = Submenu::with_items(
        handle,
        "File",
        true,
        &[&MenuItem::with_id(
            handle,
            "close-window",
            "Close Window",
            true,
            Some("CmdOrCtrl+W"),
        )?],
    )?;

    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        handle,
        "View",
        true,
        &[
            &MenuItem::with_id(
                handle,
                "reload",
                "Reload",
                true,
                Some("CmdOrCtrl+R"),
            )?,
            &MenuItem::with_id(
                handle,
                "dev-tools",
                "Toggle Developer Tools",
                true,
                Some("CmdOrCtrl+Shift+I"),
            )?,
        ],
    )?;

    let help_menu = Submenu::with_items(
        handle,
        "Help",
        true,
        &[
            &MenuItem::with_id(
                handle,
                "check-updates",
                "Check for Updates...",
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(
                handle,
                "about",
                "About",
                true,
                None::<&str>,
            )?,
        ],
    )?;

    let menu = Menu::with_items(
        handle,
        &[&file_menu, &edit_menu, &view_menu, &help_menu],
    )?;
    Ok(menu)
}

fn build_tray(
    app: &tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    let quit = MenuItem::with_id(
        app,
        "quit",
        "Quit",
        true,
        Some("CmdOrCtrl+Q"),
    )?;
    let show = MenuItem::with_id(
        app,
        "show",
        "Open Dashboard",
        true,
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let tray_menu = Menu::with_items(app, &[&show, &separator, &quit])?;

    TrayIconBuilder::new()
        .menu(&tray_menu)
        .tooltip("Template App")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
