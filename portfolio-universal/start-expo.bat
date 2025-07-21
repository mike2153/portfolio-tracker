@echo off
setlocal enabledelayedexpansion

echo ================================================
echo Portfolio Tracker - Expo Development Server
echo ================================================
echo.

:: Get the local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    set IP=%%a
    set IP=!IP: =!
    goto :found
)

:found
echo Your local IP address is: %IP%
echo.
echo IMPORTANT: Update the .env file with:
echo EXPO_PUBLIC_API_URL=http://%IP%:8000
echo.
echo Make sure your phone and computer are on the same network!
echo.
echo Starting Expo...
echo ================================================

:: Start expo
npx expo start --clear