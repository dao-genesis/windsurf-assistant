@echo off
REM tests/run_all.cmd · 印 131 · 中文路径友好 wrapper · 道法自然
REM   帛书廿二: 圣人执一 · 以为天下牧
REM   Node v24 + Windows + 中文路径 + Junction: realpathSync → ENOENT
REM   双旗经 NODE_OPTIONS 透父→子→孙 · 一旗到底
REM
REM 用:
REM   cd 公网
REM   tests\run_all.cmd
REM
REM 印 132.1 · 中文路径 spawn 治本 (帛书四十三 「天下之至柔 驰骋于至坚」):
REM   chcp 65001 必须 BEFORE setlocal · 否则 cmd 已用 OEM (936) 解析 argv
REM   NODE_NO_WARNINGS=1 抑制 buffer 弃用警告
REM   PYTHONUTF8=1 子进 python (若有) 亦 UTF-8
chcp 65001 >nul 2>&1
setlocal
set "NODE_NO_WARNINGS=1"
set "PYTHONUTF8=1"
if not defined NODE_OPTIONS (
  set "NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main"
) else (
  echo %NODE_OPTIONS% | findstr /C:"--preserve-symlinks-main" >nul || set "NODE_OPTIONS=%NODE_OPTIONS% --preserve-symlinks-main"
  echo %NODE_OPTIONS% | findstr /C:"--preserve-symlinks " >nul || echo %NODE_OPTIONS% | findstr /E /C:"--preserve-symlinks" >nul || set "NODE_OPTIONS=%NODE_OPTIONS% --preserve-symlinks"
)
node "%~dp0run_all.cjs" %*
exit /b %ERRORLEVEL%
