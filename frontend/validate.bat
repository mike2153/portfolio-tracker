@echo off
REM Frontend Validation Script for Windows
REM Run this before committing any frontend changes

echo Running Frontend Validation...
echo ================================
echo.

REM Check if we're in the frontend directory
if not exist "package.json" (
    echo Error: Not in frontend directory
    echo Please run this script from the frontend folder
    exit /b 1
)

REM Run ESLint
echo Running ESLint...
call npm run lint
set LINT_EXIT=%ERRORLEVEL%

if %LINT_EXIT% neq 0 (
    echo ESLint found errors!
    echo Run 'npm run validate:fix' to auto-fix some issues
) else (
    echo ESLint passed!
)

echo.
REM Run TypeScript type checking
echo Running TypeScript type check...
call npm run type-check
set TSC_EXIT=%ERRORLEVEL%

if %TSC_EXIT% neq 0 (
    echo TypeScript found type errors!
) else (
    echo TypeScript check passed!
)

echo.
REM Check for console.log statements
echo Checking for console.log statements...
findstr /S /C:"console.log" src\*.tsx src\*.ts | find /C /V "" > temp.txt
set /p CONSOLE_COUNT=<temp.txt
del temp.txt

if %CONSOLE_COUNT% gtr 0 (
    echo Warning: Found console.log statements
    echo Consider removing or converting to console.error/warn
) else (
    echo No console.log statements found!
)

echo.
REM Final summary
echo ================================
echo Validation Summary:
echo ================================

set TOTAL_ERRORS=0

if %LINT_EXIT% neq 0 (
    echo ESLint: FAILED
    set /a TOTAL_ERRORS+=1
) else (
    echo ESLint: PASSED
)

if %TSC_EXIT% neq 0 (
    echo TypeScript: FAILED
    set /a TOTAL_ERRORS+=1
) else (
    echo TypeScript: PASSED
)

echo.
if %TOTAL_ERRORS% equ 0 (
    echo All checks passed! Ready to commit.
    exit /b 0
) else (
    echo Found issues. Please fix before committing.
    echo.
    echo See FRONTEND_GUIDELINES.md for help
    echo See RECENT_FIXES.md for examples
    exit /b 1
)