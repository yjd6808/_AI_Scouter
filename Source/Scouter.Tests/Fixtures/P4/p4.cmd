@echo off
REM Fake p4 for P4Util E2E. ztag subset only.
if "%2"=="changes" (
  echo ... change 88123
  echo ... time 1788888888
  echo ... user yoon
  echo ... desc fake one
  echo.
  echo ... change 88101
  echo ... time 1788777777
  echo ... user yoon
  echo ... desc fake two
  echo.
  exit /b 0
)
if "%2"=="describe" (
  echo ... change 88123
  echo ... user yoon
  echo ... desc fake one
  echo ... depotFile0 //fake/main/a.cpp
  echo ... depotFile1 //fake/main/b.h
  echo ... rev0 3
  echo ... rev1 1
  echo ... action0 edit
  echo ... action1 add
  echo ... type0 text
  echo ... type1 text
  echo.
  exit /b 0
)
if "%2"=="login" (
  echo ... User yoon
  echo.
  exit /b 0
)
echo unknown command 1>&2
exit /b 1
