@echo off
title Live ToDo Server
echo Checking dependencies...
if not exist node_modules (
    echo Installing ws module...
    call npm install ws
)
echo Starting ToDo Server on http://localhost:3000 ...
node js/index.js
pause