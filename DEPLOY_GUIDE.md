# 🚀 日本旅遊雙幣分帳 App：24/7 免費雲端永久部署指引

本專案已完成**單一服務整合架構**（Express 同時提供前端 Vite 靜態網頁 + 後端 WebSocket 即時分帳同步）。
部署到免費雲端平台後，**即使關閉本機電腦或程式，手機與旅伴仍能 24 小時隨時連線記帳**！

---

## ⭐️ 推薦部署方式一：Render.com（完全免費、自動 HTTPS）

### 步驟 1：建立 GitHub 儲存庫並推送程式碼
1. 開啟 [GitHub.com](https://github.com/) 並登入你的帳號。
2. 點擊右上角的 **+** 號 ➡️ **New repository**。
3. Repository name 填寫：japan-trip-split（可選 Private 私人或 Public 公開）。
4. **不要勾選** Initialize with README，直接點擊 **Create repository**。
5. 在本機專案目錄的終端機或 PowerShell 中執行下列兩行指令（請將 <你的GitHub帳號> 替換為你的帳號）：
   `ash
   git remote add origin https://github.com/<你的GitHub帳號>/japan-trip-split.git
   git push -u origin main
   `

---

### 步驟 2：在 Render 一鍵免費部署
1. 開啟 [Render.com](https://render.com/)，點擊 **Sign Up** 並選擇 **GitHub** 登入。
2. 點擊右上角 **New +** ➡️ **Web Service**。
3. 在專案清單中找到剛才推送的 japan-trip-split，點擊 **Connect**。
4. 設定確認（通常 Render 會自動透過專案內的 ender.yaml 偵測完畢）：
   - **Name**: japan-trip-split（或你自訂的名稱）
   - **Region**: 建議選擇 Singapore（新加坡，對台灣與日本連線速度最快）
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: 
pm install && npm run build
   - **Start Command**: 
pm start
   - **Instance Type**: 選擇 **Free**（/月）
5. 點擊最下方的 **Create Web Service**！
6. 等待約 1~2 分鐘，看到綠色 Live 後，上方就會出現專屬的永久 HTTPS 網址（例如：https://japan-trip-split.onrender.com）。
7. 將此網址分享給旅伴，所有人的電腦與手機都能 24 小時永久連線分帳，電腦關機完全不影響！

---

## ⭐️ 推薦部署方式二：Zeabur（台灣團隊開發，支援中文介面，極速部署）

1. 開啟 [Zeabur.com](https://zeabur.com/) 並使用 GitHub 登入。
2. 點擊 **建立新專案 (Create Project)**。
3. 點擊 **部署服務 (Deploy Service)** ➡️ **Git** ➡️ 選擇 japan-trip-split。
4. Zeabur 會全自動偵測並執行 build 與 start。
5. 部署完成後，在該服務的 **網域名稱 (Networking)** 區塊點擊 **產生網域 (Generate Domain)**，即可取得免費且永久的 *.zeabur.app 網址！
