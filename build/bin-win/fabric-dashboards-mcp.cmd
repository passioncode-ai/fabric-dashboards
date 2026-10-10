@echo off
rem fabric-dashboards-mcp - the Fabric Dashboards MCP server over stdio (docs/adr/0004-deep-links-and-mcp.md).
rem Runs the app's own binary as Node (the RunAsNode fuse), so nothing beyond the app is installed.
rem Register it once (Claude Code on Windows): claude mcp add fabric-dashboards -- cmd /c "%LOCALAPPDATA%\Programs\fabric-dashboards\resources\bin\fabric-dashboards-mcp.cmd"
setlocal
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\Fabric Dashboards.exe" "%~dp0..\app.asar\out\main\mcp\server.js" %*
