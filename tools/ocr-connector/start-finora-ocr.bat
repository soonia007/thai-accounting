@echo off
rem FINORA OCR connector - keeps running and restarts after errors.
cd /d "%~dp0"
if exist ".venv\Scripts\activate.bat" call ".venv\Scripts\activate.bat"
:loop
python -m finora_ocr run
echo Connector stopped. Restarting in 30 seconds... (close this window to stop)
timeout /t 30 /nobreak >nul
goto loop
