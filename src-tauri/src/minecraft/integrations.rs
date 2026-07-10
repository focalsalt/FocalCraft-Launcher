use std::fs;
use serde::Deserialize;
use tauri::command;
use crate::minecraft::get_instances_dir;

const CURSEFORGE_API_KEY: &str = match option_env!("CURSEFORGE_API_KEY") {
    Some(key) => key,
    None => "$2a$10$UV61tkObiJ7wMSPb3apjguujEf4KMFhaDnpCam67q6p1o/TU67/rm",
};

#[command]
pub async fn search_modrinth_modpacks(
    query: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<serde_json::Value, String> {
    let client = crate::get_client().clone();
    let offset_val = offset.unwrap_or(0);
    let limit_val = limit.unwrap_or(20);
    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&facets=[[\"project_type:modpack\"]]&offset={}&limit={}",
        query, offset_val, limit_val
    );

    let res = client
        .get(&url)
        .header("User-Agent", "focal-craft-launcher")
        .send()
        .await
        .map_err(|e| format!("搜尋 Modrinth 失敗: {}", e))?;

    let json = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 Modrinth 回應失敗: {}", e))?;

    Ok(json)
}

#[command]
pub async fn search_modrinth(
    query: String,
    project_type: String,
    game_versions: Vec<String>,
    loader: Option<String>,
    category: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<serde_json::Value, String> {
    let client = crate::get_client().clone();
    let offset_val = offset.unwrap_or(0);
    let limit_val = limit.unwrap_or(20);

    let mut facets_list: Vec<Vec<String>> = vec![vec![format!("project_type:{}", project_type)]];

    if !game_versions.is_empty() {
        let gv_facets: Vec<String> = game_versions
            .iter()
            .filter(|gv| !gv.trim().is_empty())
            .map(|gv| format!("versions:{}", gv))
            .collect();
        if !gv_facets.is_empty() {
            facets_list.push(gv_facets);
        }
    }

    if let Some(ref ld) = loader {
        if !ld.trim().is_empty()
            && !ld.eq_ignore_ascii_case("vanilla")
            && !ld.eq_ignore_ascii_case("all")
        {
            facets_list.push(vec![format!("categories:{}", ld.to_ascii_lowercase())]);
        }
    }

    if let Some(ref cat) = category {
        if !cat.trim().is_empty() {
            facets_list.push(vec![format!("categories:{}", cat)]);
        }
    }

    let facets_str =
        serde_json::to_string(&facets_list).map_err(|e| format!("序列化 facets 失敗: {}", e))?;

    let res = client
        .get("https://api.modrinth.com/v2/search")
        .query(&[
            ("query", &query),
            ("facets", &facets_str),
            ("offset", &offset_val.to_string()),
            ("limit", &limit_val.to_string()),
        ])
        .header("User-Agent", "focal-craft-launcher")
        .send()
        .await
        .map_err(|e| format!("搜尋 Modrinth 失敗: {}", e))?;

    let json = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 Modrinth 回應失敗: {}", e))?;

    Ok(json)
}

#[command]
pub async fn search_curseforge(
    query: String,
    class_id: u32,
    game_version: String,
    category_id: Option<u32>,
    search_index: u32,
    page_size: u32,
) -> Result<serde_json::Value, String> {
    let client = crate::get_client().clone();
    let mut query_params = vec![
        ("gameId".to_string(), "432".to_string()),
        ("classId".to_string(), class_id.to_string()),
        ("searchFilter".to_string(), query),
        ("gameVersion".to_string(), game_version),
        ("index".to_string(), search_index.to_string()),
        ("pageSize".to_string(), page_size.to_string()),
    ];

    if let Some(cat_id) = category_id {
        query_params.push(("categoryId".to_string(), cat_id.to_string()));
    }

    let res = client
        .get("https://api.curseforge.com/v1/mods/search")
        .header("x-api-key", CURSEFORGE_API_KEY)
        .query(&query_params)
        .send()
        .await
        .map_err(|e| format!("搜尋 CurseForge 失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("CurseForge API 回應錯誤: {}", res.status()));
    }

    let val = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 CurseForge 搜尋結果失敗: {}", e))?;
    Ok(val)
}

#[command]
pub async fn get_curseforge_project_description(mod_id: u32) -> Result<String, String> {
    let client = crate::get_client().clone();
    let res = client
        .get(format!(
            "https://api.curseforge.com/v1/mods/{}/description",
            mod_id
        ))
        .header("x-api-key", CURSEFORGE_API_KEY)
        .send()
        .await
        .map_err(|e| format!("獲取 CurseForge 說明失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("CurseForge API 回應錯誤: {}", res.status()));
    }

    #[derive(Deserialize)]
    struct DescResponse {
        data: String,
    }
    let val = res
        .json::<DescResponse>()
        .await
        .map_err(|e| format!("解析 CurseForge 說明失敗: {}", e))?;
    Ok(val.data)
}

#[command]
pub async fn get_curseforge_project_files(mod_id: u32) -> Result<serde_json::Value, String> {
    let client = crate::get_client().clone();
    let res = client
        .get(format!(
            "https://api.curseforge.com/v1/mods/{}/files",
            mod_id
        ))
        .header("x-api-key", CURSEFORGE_API_KEY)
        .send()
        .await
        .map_err(|e| format!("獲取 CurseForge 檔案失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("CurseForge API 回應錯誤: {}", res.status()));
    }

    let val = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 CurseForge 檔案列表失敗: {}", e))?;
    Ok(val)
}

#[command]
pub async fn get_curseforge_projects(mod_ids: Vec<u32>) -> Result<serde_json::Value, String> {
    let client = crate::get_client().clone();
    let body = serde_json::json!({
        "modIds": mod_ids
    });
    let res = client
        .post("https://api.curseforge.com/v1/mods")
        .header("x-api-key", CURSEFORGE_API_KEY)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("批次獲取 CurseForge 專案失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("CurseForge API 回應錯誤: {}", res.status()));
    }

    let val = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析 CurseForge 專案結果失敗: {}", e))?;
    Ok(val)
}

#[command]
pub async fn download_curseforge_file(
    instance_id: String,
    folder_name: String,
    download_url: String,
    file_name: String,
) -> Result<(), String> {
    let dest_dir = get_instances_dir()?
        .join(&instance_id)
        .join("minecraft")
        .join(&folder_name);
    fs::create_dir_all(&dest_dir).map_err(|e| format!("無法建立目標資料夾: {}", e))?;

    let temp_dest = dest_dir.join(format!("{}.tmp", file_name));
    let client = crate::get_client().clone();
    let res = client
        .get(&download_url)
        .header("x-api-key", CURSEFORGE_API_KEY)
        .send()
        .await
        .map_err(|e| format!("下載檔案失敗: {}", e))?;

    if !res.status().is_success() {
        if let Ok(res_fallback) = crate::get_client().clone().get(&download_url).send().await {
            if res_fallback.status().is_success() {
                if let Ok(bytes) = res_fallback.bytes().await {
                    fs::write(&temp_dest, &bytes).map_err(|e| format!("寫入暫存檔失敗: {}", e))?;
                    let final_dest = dest_dir.join(&file_name);
                    fs::rename(temp_dest, final_dest)
                        .map_err(|e| format!("重命名檔案失敗: {}", e))?;
                    return Ok(());
                }
            }
        }
        return Err(format!("下載伺服器回應錯誤: {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("讀取下載內容失敗: {}", e))?;
    fs::write(&temp_dest, &bytes).map_err(|e| format!("寫入暫存檔失敗: {}", e))?;

    let final_dest = dest_dir.join(&file_name);
    fs::rename(temp_dest, final_dest).map_err(|e| format!("重命名檔案失敗: {}", e))?;

    Ok(())
}
