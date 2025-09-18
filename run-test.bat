@echo off
echo ========================================
echo Portfolio Chatbot Test Setup
echo ========================================
echo.

echo Setting up environment variables...
echo.

echo Please enter your API key:
echo.

set /p GEMINI_KEY="Enter your Gemini API Key: "

echo.
echo Setting environment variables...
set GEMINI_API_KEY=%GEMINI_KEY%
echo ✓ Gemini API key set

echo.
echo Installing dependencies...
call npm install

echo.
echo Starting test server...
echo ========================================
echo.
echo Test UI will be available at: http://localhost:3000
echo Health check available at: http://localhost:3000/health
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

call npm run test