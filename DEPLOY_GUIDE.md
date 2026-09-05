# 日本旅遊分帳 App 部署指南

本專案由同一個 Node.js 服務提供 Vite 前端、Express API 與 WebSocket 多人即時同步。正式環境的房間資料必須存放在 PostgreSQL；Render Web Service 的本機檔案系統不是正式資料來源，服務重新啟動或重新部署後不保證保留執行期檔案。

## 架構

- Render：執行網站、API 與 WebSocket。
- Neon PostgreSQL：保存每個房間的標題、成員、支出與伺服器版本。
- 瀏覽器 `localStorage`：只作房間快取；資料庫已有房間時，以伺服器資料為準。
- 未設定 `DATABASE_URL` 的本機開發：使用 `server/data` JSON 備援儲存。

## 1. 建立 Neon PostgreSQL

1. 登入 Neon 並建立一個 PostgreSQL project。
2. 在 Neon 的連線資訊頁選擇 pooled connection string。
3. 複製 PostgreSQL 連線字串，並確認包含 `sslmode=require`。
4. 不要把連線字串貼進程式碼、`render.yaml`、`.env` 範例或 GitHub。

Neon 與 Render 的方案、免費額度及休眠政策可能調整，請以各自帳號儀表板顯示的最新資訊為準。

## 2. 在 Render 設定網站

1. 在 Render 建立或開啟 Web Service `japan-trip-split`。
2. 連接 GitHub repository `dharmachiang48-del/japan-trip-split`，部署分支選擇要上線的分支。
3. 確認建置設定：
   - Runtime：Node
   - Build Command：`npm install && npm run build`
   - Start Command：`npm start`
4. 開啟服務的 Environment 設定。
5. 新增 Secret：
   - Key：`DATABASE_URL`
   - Value：Neon pooled PostgreSQL connection string
6. 儲存後重新部署目前 commit。

`render.yaml` 只宣告 `DATABASE_URL` 必須由部署者提供，不包含實際密碼。

## 3. 確認 PostgreSQL 已啟用

部署完成後開啟：

```text
https://japan-trip-split.onrender.com/api/health
```

回應必須包含：

```json
{
  "status": "ok",
  "storage": "postgresql"
}
```

`time` 欄位會依檢查時間不同。若 `storage` 顯示 `file`，代表 Render 尚未正確設定 `DATABASE_URL`，不可視為持久化部署完成。

## 4. 多人與重啟驗收

1. 使用新的測試房間名稱進入網站。
2. 瀏覽器 A 新增一位成員與一筆支出。
3. 使用瀏覽器 B 或無痕視窗開啟相同房間網址，確認資料一致。
4. 在 Render 重新部署目前 commit，等待服務恢復為 Live。
5. 重新開啟相同房間，確認標題、成員、支出與結算結果仍存在。
6. 再由瀏覽器 B 新增一筆支出，確認瀏覽器 A 即時收到完整更新。

只有上述跨瀏覽器與重新部署驗收都通過，才能確認正式網站的持久化修復完成。

## 5. 本機開發

未設定 `DATABASE_URL` 時執行：

```powershell
npm install
npm run build
npm start
```

本機資料會寫入 `server/data/room_*.json`。這些執行期檔案已由 `.gitignore` 排除，只有 `server/data/.gitkeep` 會保留在 Git。
