@echo off
echo Portfolio Tracker - Quality Check Toggle
echo ==========================================

if exist "SKIP_QUALITY_CHECKS" (
    echo Current Status: Quality checks are DISABLED
    echo.
    choice /C YN /M "Do you want to ENABLE quality checks"
    if errorlevel 2 goto :end
    if errorlevel 1 goto :enable
) else (
    echo Current Status: Quality checks are ENABLED
    echo.
    choice /C YN /M "Do you want to DISABLE quality checks"
    if errorlevel 2 goto :end
    if errorlevel 1 goto :disable
)

:disable
echo Creating SKIP_QUALITY_CHECKS file...
echo # Delete this file to enable quality checks > SKIP_QUALITY_CHECKS
echo # Create this file to skip quality checks >> SKIP_QUALITY_CHECKS
echo # >> SKIP_QUALITY_CHECKS
echo # This file tells GitHub Actions to skip quality gate enforcement >> SKIP_QUALITY_CHECKS
echo # Use only for emergencies or hotfixes >> SKIP_QUALITY_CHECKS
echo # >> SKIP_QUALITY_CHECKS
echo # Created: %date% %time% >> SKIP_QUALITY_CHECKS
echo # Reason: Emergency bypass switch >> SKIP_QUALITY_CHECKS
echo.
echo ⚠️  Quality checks are now DISABLED
echo ⚠️  This should only be used for emergencies!
echo 💡 To re-enable: Run this script again or delete SKIP_QUALITY_CHECKS file
goto :end

:enable
echo Deleting SKIP_QUALITY_CHECKS file...
del "SKIP_QUALITY_CHECKS" 2>nul
echo.
echo ✅ Quality checks are now ENABLED
echo 🛡️  Code quality enforcement is active
goto :end

:end
echo.
pause