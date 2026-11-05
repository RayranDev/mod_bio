@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
echo.
echo  Reporte RRHH - Calendario de marcacion
echo  Usa los archivos mas recientes de la carpeta "archivos".
echo.
set /p INI= Fecha inicial (AAAA-MM-DD):
set /p FIN= Fecha final   (AAAA-MM-DD):
set ANT=
set /p ANT= Horario anterior para marcar turnos cargados tarde (Enter para omitir):
echo.
if "%ANT%"=="" (
  python "scripts\reporte_calendario\generar_reporte.py" --ini %INI% --fin %FIN%
) else (
  python "scripts\reporte_calendario\generar_reporte.py" --ini %INI% --fin %FIN% --horario-anterior "%ANT:"=%"
)
echo.
pause
