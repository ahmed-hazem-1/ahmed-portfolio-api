@echo off
echo ========================================
echo Portfolio Chatbot Test Setup
echo ========================================
echo.

echo Setting up environment variables...
echo.

echo Please enter your API keys:
echo.

set /p GEMINI_KEY="Enter your Gemini API Key: "
set /p OPENAI_KEY="Enter your OpenAI API Key (or press Enter to skip): "

echo.
echo Setting environment variables...
set GEMINI_API_KEY=%GEMINI_KEY%

if not "%OPENAI_KEY%"=="" (
    set OPENAI_API_KEY=%OPENAI_KEY%
    echo ✓ Both API keys set
) else (
    echo ⚠ Only Gemini API key set (will use fallback mode)
)

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