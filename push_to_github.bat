@echo off
chcp 65001 >nul
cd /d %~dp0
echo ========================================================
echo   正在將分帳 App 程式碼上傳至您的 GitHub 儲存庫...
echo ========================================================
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo [成功] 程式碼已成功推送至 GitHub！
    echo Render 會在 1~2 分鐘內自動完成編譯與上線。
) else (
    echo [提示] 若剛才有彈出瀏覽器登入 GitHub，請確認已點擊授權後再試一次。
)
echo.
pause
