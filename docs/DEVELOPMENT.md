# 開發與維護指南 (Development & Maintenance Guide)

本文件旨在幫助開發者理解「新加坡飯店挑選助手」的程式架構，以及如何擴充功能或進行日常維護。

## 1. 系統架構概要

本專案採用純前端架構 (Vanilla JS + Tailwind CSS + Leaflet)，代碼已進行模組化重構：

- `CONFIG`: 儲存全域設定與標籤定義（如 `ALL_TAGS`）。
- `State`: 儲存執行時期的狀態（如地圖實例、過濾後的飯店列表、座標快取、捷運資料）。
- `Utils`: 共通工具函式（如 延遲、快取存取、距離計算）。
- `DataService`: 負責業務邏輯相關的資料處理，例如將捷運站資料與飯店資料進行關聯（enrich）。
- `MapService`: 處理地圖初始化、標記更新、以及 Nominatim 地理編碼與捷運資料載入邏輯。
- `GitHubService`: 封裝 GitHub API 互動，包含登入驗證與建立 PR。
- `UI`: 處理所有 DOM 操作、事件綁定與頁面渲染。

## 2. 如何新增過濾標籤 (Tags)

1.  **修改 `data.js`**: 在飯店資料中加入新屬性。務必遵循「**True = 正面/良好**」原則。
2.  **修改 `index.html`**: 在過濾器區域新增對應的 `checkbox` filter，並賦予一個唯一的 `id`。
3.  **修改 `script.js`**:
    *   在 `CONFIG.ALL_TAGS` 數組中新增定義物件。
    *   **屬性定義說明**：
        *   `key`: 對應 `data.js` 中的屬性名稱。
        *   `label`: 當資料為 `true` 時，卡片上顯示的文字。
        *   `negativeLabel`: (可選) 當資料為 `false` 時，卡片上顯示的警告文字。若有定義此欄位，卡片會以橘色加粗顯示。
        *   `type`: `positive` (一般良好資訊) 或 `amenity` (便利設施，如 WiFi)。
        *   `filterId`: 對應 `index.html` 中的 `checkbox` ID。
    *   **備註**：系統會根據 `filterId` 自動處理過濾與渲染，無需額外修改過濾邏輯。

## 3. 資料邏輯與命名規範 (Data Logic)

本專案自 2025-12-27 起統一採用「**True = 正向/良好**」邏輯。維護 `data.js` 時請遵守以下規範：

- **命名風格**: 採用駝峰式命名 (CamelCase)，如 `isSafeLocation`, `hasWiFi`。
- **正向原則**: 屬性應代表「好」的情況。
    - ✅ 使用 `isSafeLocation` (環境安全) 而非 `isRedLightDistrict` (靠近紅燈區)。
    - ✅ 使用 `isSoundproof` (隔音好) 而非 `isPoorSoundproofing` (隔音差)。
    - ✅ 使用 `hasPlentyOutlets` (插座足) 而非 `hasFewOutlets` (插座少)。
- **顯示控制**: 若屬性本身是「非不良情況」的描述（如：非靠近紅燈區），請在 `ALL_TAGS` 的 `label` 寫入「非靠近紅燈區」，並在 `negativeLabel` 寫入「靠近紅燈區」。

## 4. GitHub 編輯機制 (PR Workflow)

編輯功能的運作流程如下：
1.  使用者登入 GitHub PAT。
2.  **編輯飯店**: 點擊飯店卡片，修改資料後按儲存。
3.  **新增飯店**: 點擊頁首的「新增飯店」按鈕。
4.  **刪除飯店**: 點擊飯店卡片後，在彈窗左下角按「刪除飯店」。
5.  按下執行後，`GitHubService` 會：
    *   讀取目前 `data.js` 的內容。
    *   透過 `new Function()` 解析內容，根據操作 (add/update/delete) 修改資料數組。
    *   將更新後的資料重新串接回 `export const hotels = ...` 格式。
    *   建立新分支並推送變更。
    *   建立 Pull Request。

### 注意事項：
- **安全性**: GitHub PAT 僅存儲於使用者的瀏覽器 Cookie 中，不會上傳至任何伺服器。
- **資料完整性**: 寫入 `data.js` 時使用了 `new Function()` 解析字串，確保能保留原始檔案中的非 JSON 內容（如註釋），但在維護 `data.js` 時，請確保其語法符合標準 JS 格式。

## 5. 地圖與座標處理

- **快取**: 飯店座標會存存在 `localStorage` 的 `hotel_coords_cache_v1` 中。
- **Nominatim 政策**: 地圖查詢使用 OpenStreetMap 的 Nominatim API，須遵守每秒最多 1 次請求的規範。程式中已內建 `delay(1200)` 以確保合規。
- **手動座標**: 若飯店在 `data.js` 中有提供 `lat` 與 `lon`，系統會優先使用手動座標，跳過 API 查詢。

## 6. 捷運 (MRT) 資料整合

捷運距離功能是此專案的核心功能之一，其運作流程如下：

1.  **資料來源**:
    *   **捷運路線**: `https://raw.githubusercontent.com/cheeaun/sgraildata/master/data/v1/sg-rail.geojson`
    *   **捷運站點**: `https://raw.githubusercontent.com/datagovsg/fare-based-mrt-station-data/main/data/mrt_station_data.json`

2.  **資料載入與處理**:
    *   `DataService.loadMRTStations()`: 在應用程式啟動時非同步地從遠端來源獲取捷運站點資料。
    *   資料被處理成 `State.mrtStations` 陣列，每個站點物件包含 `name`, `coordinates`, `color`。

3.  **資料關聯 (Enrichment)**:
    *   `DataService.enrichHotelData()`: 在所有飯店的地理座標都確定後 (`geocodeAll` 完成後) 執行。
    *   此函式會遍歷所有飯店，使用 `Utils.calculateDistance` 計算每個飯店與所有捷運站的距離。
    *   找到最近的站點後，將 `nearestStationName`、`nearestStationDistance` (單位: 公里)、`nearestStationColor` 三個屬性附加到對應的飯店物件上。

4.  **UI 整合**:
    *   **篩選器**: `index.html` 包含一個 ID 為 `mrtDistanceRange` 的拉桿。`script.js` 中的 `UI.bindEvents` 和 `UI.updateMRTDistantDisplay` 負責監聽其變化並更新顯示。
    *   **過濾邏輯**: `UI.filterHotels()` 會讀取距離拉桿的值，並過濾掉 `nearestStationDistance` 大於設定值的飯店。
    *   **卡片顯示**: `UI.renderList()` 會讀取飯店物件上的捷運相關屬性，並將站點名稱、距離（換算為公尺）和路線顏色動態渲染到飯店卡片上。
    *   **地圖高亮**: 當使用者點擊地圖上的飯店標記時，`MapService.highlightMRTStation()` 會被觸發，在地圖上繪製一個圓點來標示最近的捷運站位置，並在關閉彈出視窗時移除。

## 7. 常見問題與除錯

- **座標查不到**: 某些飯店名稱可能在 OSM 中找不到。開發者可以透過「三連擊標題」開啟偵錯面板，手動測試搜尋路徑或在 `data.js` 直接補上座標。
- **PR 建立失敗**: 通常是因為 GitHub PAT 權限不足（需 Contents: Read & Write, Pull requests: Read & Write）。

---
*最後更新日期: 2024-05-21*
