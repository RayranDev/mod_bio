# MOD_BIO — Reporte de Horas, Extras y Recargos

Herramientas locales de nómina para Plastitec / SIRH: calculan horas trabajadas, horas extra y
recargos a partir de exportaciones de BioTime, sin backend, sin base de datos, sin conexión a
internet salvo la librería de Excel (SheetJS, cargada desde `cdnjs.cloudflare.com`). Todo el cálculo
corre en el navegador del usuario, sobre los seis archivos Excel que él mismo carga (cuatro
obligatorios más dos opcionales: `Renuncia_*.xlsx` y el de **Lactancia**).

El catálogo de condiciones de negocio (167 condiciones, bloques A a K, v2.1) está en
**[CATALOGO-CONDICIONES.md](CATALOGO-CONDICIONES.md)**. Ese documento es hoy el catálogo de
condiciones **vigente**: cada condición trae su estado real de implementación (Implementada / Parcial
/ Decisión de diseño / Reemplazada / No implementada), verificado contra el código. Este archivo
(`CLAUDE.md`) sigue siendo la fuente sobre el razonamiento de ingeniería — por qué se tomó cada
decisión, qué se probó y se descartó, qué convención seguir al modificar el código.

## Archivos del proyecto

| Archivo | Qué es |
|---|---|
| `reporte-horas.html` | Herramienta completa: 10 pestañas (Consolidado, Detalle, Calendario, Excepciones, Asistencia, **Resumen del ciclo**, **Adopción**, Calidad de marcación, **Rotación**, Glosario). Para análisis, auditoría de datos y seguimiento del proceso de implementación. |
| `reporte-horas-rrhh.html` | Versión lite para RRHH: 8 pestañas (Consolidado, Detalle, Calendario, Asistencia, **Resumen del ciclo**, **Adopción**, Calidad de marcación, **Rotación**). Sin Excepciones ni Glosario. Parametrización avanzada detrás de un botón de engranaje (`⚙`) en vez de siempre visible. |
| `CATALOGO-CONDICIONES.md` | Las 137 condiciones de diseño original, con sus códigos (A-01, D-14, I-03, etc.) usados como referencia cruzada en el código. |
| `scripts/pruebas_motor/` | Pruebas sintéticas del motor y de la lactancia en Node (`node scripts/pruebas_motor/<archivo>.js`); sin datos reales ni dependencias. Ver su `README.md`. |
| `CLAUDE.md` | Este archivo. |
| `.gitignore` | Excluye `*.xlsx`, `*.xls` y `.atl/` — los datos de empleados **nunca** se suben al repo. |

No hay archivo de motor compartido. Es una decisión explícita del usuario (ver más abajo), no un
descuido.

---

## LA CONVENCIÓN OBLIGATORIA: el motor está duplicado

**`reporte-horas.html` y `reporte-horas-rrhh.html` NO comparten código.** Cada uno es un archivo HTML
autocontenido con su propia copia completa del motor de cálculo. Esto fue una decisión explícita del
usuario (se le preguntó "archivo de motor compartido" vs "copia independiente", y eligió copia
independiente) a cambio de que cada archivo pueda moverse solo y seguir funcionando.

**Consecuencia práctica: todo cambio a la lógica de cálculo debe aplicarse a mano en los dos
archivos.** No hay excepción a esto. Si se corrige un bug en `compute()`, en `buildModel()`, en
`classify()`, en el algoritmo de resolución de marcaciones impares, en la detección de fecha de
ingreso masiva — lo que sea que viva en la lista de abajo — **se edita en `reporte-horas.html` y en
`reporte-horas-rrhh.html`, en el mismo turno de trabajo.** Nunca se corrige en uno solo "para
después portarlo" — eso es exactamente cómo se generan las divergencias silenciosas entre los dos
archivos.

### Funciones que son el motor compartido (deben estar idénticas en ambos archivos)

Verificado línea por línea contra el código actual (no es una lista de memoria):

```
CONCEPTS, CKEYS, DOW_ES, NOV, CONC_DESC, MATRIZ        (diccionarios de datos)
toISO, toMin, addDays, rangeDays, weekStart             (utilidades de fecha)
easter, nextMonday, holidaysCO                          (festivos de Colombia)
DATA, OVERRIDES, PERFILES, AUTOR, CONFIANZA, DISPOSITIVOS (estado global en localStorage)
autorFor, readSheet, pick, normId                       (parseo de Excel)
buildModel                                              (construye el modelo desde los Excel cargados)
marcarIngresosMasivos                                   (detección de fecha de ingreso masiva)
shiftFor, segmentFor                                    (turno vigente por fecha)
round05, dayType, classify, atomize                     (clasificación y redondeo)
escalera, quitarDescanso, tramosAcreditados             (jornada fija + escalera de sobretiempo)
clasificarHuecos, topeCafe                              (huecos por rol de dispositivo, B-12/B-16)
rolAuto, rolDisp, rolEfectivo, renderDisp, guardarDisp   (rol de cada biométrico)
LACT_ETAPAS, LACT_PATS, fechaLact, idsConocidos, leerLactancia   (archivo de lactancia: lectura y validación, E-04)
faseLactancia, minLactancia, ubicarLactancia, textoLact, resumenLactancia   (crédito de lactancia en compute)
LACT_CARGA (global), validarLactCarga, htmlCargaLact, renderLactVal, abrirLactVal, renderLactBtn, hookLact   (carga y validación visible)
lactChips, tagLact, cardLactDet, cardsLactCons, filaLactCons, lactCoincide   (marcas, tarjetas y filtro de lactancia)
aoaLactancia, descargarPlantillaLact                    (hoja «Lactancia» del Excel y plantilla)
readConfig                                              (lee los parámetros del formulario)
limpiarMarcaciones                                      (dedupe A-06 + agrupación A-07)
compute                                                 (el motor de horas y conceptos, ~490 líneas)
celdaPendiente                                          (celda de horas no cumplidas)
tagRetiro                                               (marca de empleado retirado, A-16)
AS_LABEL, ASISTENCIA (global)                           (reporte de asistencia general)
computeAsistencia, asisFiltrado, renderAsistencia, aoaAsistencia
sinTildes, coincideEmp                                  (busqueda de empleados en todos los filtros)
AS_VISTA, AS_IDENT, AS_RES_HEAD, asIdent, asisResFila    (resumen de asistencia)
asisResumenFilas, aoaAsisResumen, renderAsisResumen, habilesEntre
COLS_ASIS, COLS_ASIS_OCULTAS, aplicarColsAsis, renderColsAsis, tagVinculo, estadoAsis
celdaIngreso                                            (fecha de ingreso en el resumen, marca las compartidas)
guardarXLS, colorAsisCal, colorAsisRes, nivelPct, nivelSil (exportacion con colores)
computeCalidad, calidadFiltrada, renderCalidad, nivelQ, Q_DEP   (Calidad de marcación)
aoaCalidad, aoaCalidadEmp, calidadDeEmpleado, hookCalidad
KPI_EXCL                                                (departamentos excluidos, guardados: ahora parte del Alcance)
barPath, fmtPct, fmtN                                   (helpers de gráficos y porcentajes)
ALC, ALC_TABS, ALC_SUCIO, SIN_DEP, depKey, sinTurnoAsignado   (Alcance: estado)
alcanceOk, alcanceOkEmp, alcanceR, alcanceUnDepto, alcanceHay, alcanceInfo, alcanceLista, alcanceTexto, aoaAlcance   (Alcance: qué personas entran)
alcCargos, alcSetCargo                                  (Alcance: cargo, dependiente de compañía/departamentos)
ROT_MESES, ROT_TIPOS, ROT_UMBRAL, ROT_COL, ROT_HEAD, ROT   (Rotación: constantes y estado)
rotSumaMes, rotListaMeses, rotEtqMes, rotUltimoDia, rotTipo, rotTiposDisponibles, rotTiposSel, rotTiposTexto   (Rotación: meses y tipos)
retirosMasivos, marcarRetirosMasivos, rotRango, rotPersonas, rotMes, rotSuma, rotGrupos, computeRot, rotOpt, rotCalc   (Rotación: cálculo)
svgRotMeses, rotTablaMes, rotTablaCia, rotMesesChips, renderRot, hookRot   (Rotación: pantalla y cableado)
rotEstado, rotFila, aoaRotAlcance, aoaRotMes, aoaRotGrupo, aoaRotDetalle, aoaRotFechas   (Rotación: Excel)
alcSetCia, alcSetModoDep, alcToggleDep, alcAddPers, alcQuitarPers, alcSetModoPer, alcSetPerfil, alcSetVinc, alcSetSinTurno, alcLimpiar
tabActiva, renderTab, alcCambio, alcResumen, alcPanel, alcSugerir, hookAlcance   (Alcance: pantalla y cableado)
esTurnoExtra, pasoExtra                                 (turnos de solo extras, T-EXTRA)
semanaDeTs, inicioSemanaTs, partirPorSemana            (semana del umbral por instante)
activoEnCiclo                                           (universo del reporte segun el rango, recortado a la vigencia)
estadoCob, computeCobertura, cobFiltrado, cobCalc, cobAgregar, nivelCob   (Adopción)
COB_EMP, COB_DEP, COB_ORD, COB_PERD, COB_SIG, COB_TIP, cobOrden, cobConcentra   (navegación general → detalle)
renderCob, aoaCobertura, aoaCoberturaDep, hookCob
modo, irADetalle, marcarCol, aplicarCols, renderCols     (interfaz: modos, salto y columnas)
tipHTML, chip, initPop                                  (sistema de tooltips — ver nota abajo)
toast, conceptCols, renderMatriz
filtroActivo, filtroHay, filtroSlug, consFiltrado, fillFiltros, SIN_CARGO, cargoDe, fillCargos   (filtros del Consolidado, con cargo)
COLS_CONS_OCULTAS, COLS_CONS_DATOS, COLS_CONS_HORAS, COLS_CONS_OTROS, aplicarColsCons, renderColsCons   (columnas visibles del Consolidado)
renderCons, celdaHora, celdaSemana, renderAutor, addAutor, renderDet, renderExc
DOW_CAL, renderCal
fillSelects, buscarEmp, showTab, save
IND_UMBRAL, IND_RAMPA, IND_DIAS, IND_DIA_NOM, IND_METS, IND_DEP, IND_MET, IND_PP, IND_SEM   (Resumen del ciclo: constantes y estado)
fmtH, computeInd, indBarras, indEscala, indColPath, indTrunc, indOpt   (Resumen: cálculo y escalas)
svgIndBarras, svgIndSemana, svgIndPareto, svgIndApilada, indTabla   (Resumen: gráficos y tabla gemela)
renderInd, indAbrir, indDiaLargo, aoaIndRes, aoaInd, aoaIndEmp, aoaIndSem, aoaIndAlert, hookInd   (Resumen: pantalla y Excel)
aoaCons, aoaDet, aoaExc, aoaCal, sinergyTxt
checkReady, hook, runCalc
```

> **El KPI Cumplimiento se retiró (nov-2026) y Excepciones salió de RRHH (sept-2026).**
> Se borraron `kpiCalcular`, `kpiPorDepto`, `kpiFiltrarEmpleados`, `svgKpiChart`, `renderCobertura`,
> `renderKpi`, `aoaKpiDep`, `aoaKpiEmp`, `pct` y `KPI_EXCLUIDOS_ULTIMO`; se conservan `barPath`, `fmtPct`,
> `fmtN` y `KPI_EXCL` (la llave `mb_kpi_excl`, ahora parte del Alcance). Solo `renderGlosario` sigue
> siendo exclusiva del archivo completo. `prueba_identidad.js` comprueba que ni esas funciones ni sus
> elementos HTML queden en ningún archivo.
>
> **`renderExc` y `aoaExc` SIGUEN en los dos archivos** aunque RRHH ya no tenga la pestaña: la
> exportación combinada de RRHH escribe igual la hoja de Excepciones, y es la única vía por la que
> RRHH las ve. `renderExc()` se protege sola con `if(!$('#tExc')) return;`.
>
> **Al quitar una pestaña hay que blindar primero lo compartido.** Esta operación rompió el proyecto
> dos veces (borró ocho helpers, después los duplicó). Las guardas —`keep()` con select ausente,
> `renderExc()` sin tabla, el salto del chip de novedad, el cableado de los filtros— van **idénticas
> en los dos archivos**, nunca solo en el que perdió la pestaña: eso sería abrir una divergencia.
>
> **El mock de DOM debe devolver `null` para lo que el archivo no declara.** Un stub permisivo que
> devuelve un elemento falso para todo enmascara exactamente el error que se está buscando. Ver la
> sección de validación.

> **Asistencia pasó a ser compartida (sept-2026).** El usuario la pidió también en la versión
> RRHH, así que `AS_LABEL`, `ASISTENCIA`, `computeAsistencia`, `asisFiltrado`, `renderAsistencia` y
> `aoaAsistencia` viven ahora en los DOS archivos y entran en la lista de arriba. Solo el Glosario
> sigue siendo exclusivo del archivo completo.

### Funciones exclusivas de `reporte-horas.html` (NO existen en la versión RRHH, a propósito)

```
renderGlosario
```

Si una tarea futura toca **solo** una de estas funciones (por ejemplo, un ajuste a la tabla del Glosario),
el cambio va **solo** en `reporte-horas.html` — no existe equivalente que actualizar en el archivo
RRHH. Si la tarea toca algo de la primera lista (el motor), va en los dos.

### Advertencia real de esta sesión — por qué esta convención importa

Al crear `reporte-horas-rrhh.html` como copia y luego borrar la pestaña de Asistencia, un borrado por
rango de líneas se llevó por delante ocho funciones del motor compartido (`$`, `$$`, `esc`, `fmt`,
`sevCls`, `tipHTML`, `chip`, `initPop`) porque estaban físicamente intercaladas en el archivo original
entre `computeAsistencia()` y `aoaAsistencia()` — un artefacto de cómo había crecido el archivo en
sesiones anteriores, no una relación lógica real. **El chequeo de sintaxis de JavaScript pasó** (el
archivo seguía siendo JS válido) pero cualquier pantalla habría fallado en tiempo de ejecución. Se
encontró recién al ejecutar de verdad cada función de render contra datos reales, no al revisar la
sintaxis. La corrección quedó documentada como un commit aparte (`c7121a8`) en vez de reescribir el
commit roto — la historia de git cuenta la verdad de lo que pasó.

**Y volvió a morder, en la dirección contraria (sept-2026).** Al copiar la pestaña de Asistencia
*hacia* la versión RRHH, extraer el rango completo entre `computeAsistencia()` y `aoaAsistencia()`
arrastró esos mismos ocho helpers y los duplicó: el archivo murió con
`Identifier '$' has already been declared`. **El código de Asistencia son DOS PIEZAS DISJUNTAS**, y la
frontera es el banner `/* RENDER */`:

| Pieza | Contenido |
|---|---|
| A | banner `ASISTENCIA GENERAL` + `AS_LABEL` + `computeAsistencia()` |
| — | *(helpers compartidos: `$`, `$$`, `esc`, `fmt`, `sevCls`, `tipHTML`, `chip`, `initPop`)* |
| B | `asisFiltrado()` + `renderAsistencia()` + `aoaAsistencia()` |

Cualquier script que mueva código entre los dos archivos debe respetar esa frontera y **afirmar que
ningún helper compartido quedó duplicado** antes de escribir. Lo detectó la ejecución en Node, no la
lectura del diff.

**Al mover bloques entre los dos archivos, extraerlos por script en vez de transcribirlos.** Es la
única forma de garantizar que queden byte a byte idénticos. La prueba correspondiente compara cada
función carácter a carácter, delimitándolas por su primer `
}
` — **no** por la función siguiente,
porque lo que viene después difiere entre archivos (el full sigue con el Glosario) y eso da una diferencia
falsa. Dos bloques salen distintos por esa misma razón y **no son divergencias**: `rolEfectivo` (es una
sola línea, así que su "primer `}`" arrastra la línea `let KPI_EXCL`, que en RRHH está antes) y `runCalc`
(el full llama además a `renderGlosario()`). Idénticos también en las copias previas a la lactancia.

**Ojo con `core.autocrlf=true`:** un `git checkout` deja el working copy en CRLF mientras el otro
archivo sigue en LF, y entonces ningún anclaje de texto coincide. El repo guarda LF; normalizar a LF
antes de parchear.

**Lección aplicada de ahora en más: un chequeo de sintaxis nunca es suficiente para validar un cambio
al motor. Hay que ejecutar `buildModel()` → `compute()` → cada función de render/export contra datos
reales y comprobar que no lance excepciones**, además de los invariantes I-01/I-02/I-03 (ver sección
de validación más abajo).

---

## Fuentes de datos

Cuatro archivos Excel exportados desde BioTime/SIRH, más dos opcionales (Renuncia, que también sale de
BioTime, y Lactancia, que arma RRHH con una plantilla propia). Se cargan una vez por sesión (nunca se
suben a git — ver `.gitignore`). Nombres típicos (el prefijo/timestamp varía en cada exportación real):

| Archivo | Contenido | Columnas usadas |
|---|---|---|
| `Empleado_*.xlsx` | Maestro de empleados | Empleado ID, Nombres, Apellidos, Fecha de contratación, Departamento, Compañía, Cargo, Estado |
| `Turno_*.xlsx` | Catálogo de turnos | Código, Hora Entrada, Hora Salida, Dom..Sáb (día de semana), Descanso, **Descontar descansso en** (sic, con doble "s" — typo real de BioTime, ver abajo) |
| `Horario_*.xlsx` | Asignación de turno por empleado y rango de fechas | Empleado ID, Código, Fecha Inicial, Fecha Final |
| `Reporte de Marcaciones_*.xlsx` | Marcaciones crudas del reloj biométrico | Employee ID, Fecha, Hora, Tipo de Marcación, Origen del registro, **Branch** |
| `Renuncia_*.xlsx` | **Opcional.** Personal que ya no está en la empresa | Empleado (id + nombre pegados), Departamento, Cargo, Tipo de renuncia, Fecha de retiro |
| Lactancia (plantilla propia, `DATA.lac`) | **Opcional.** Empleadas con derecho a lactancia y las fechas de cada etapa. No viene de BioTime: RRHH la arma (botón *Descargar plantilla de lactancia*) | `ID_empleado`, `Inicio_lactancia_6m`, `Fin_lactancia_6m`, `Inicio_lactancia_24m`, `Fin_lactancia_24m` (una fila por empleada; ver «Lactancia por archivo» más abajo) |

### Hallazgos reales sobre estos datos (no hipotéticos — confirmados contra exportaciones reales)

- **BioTime nunca envía `punch_state`.** La columna `Tipo de Marcación` viene con el valor `255` en el
  100% de las marcaciones observadas, en dos exportaciones distintas. El emparejamiento entrada/salida
  se hace por orden cronológico, nunca por ese campo (condición A-12 del catálogo, confirmada como
  hecho, no como duda).
- **La columna de descuento de almuerzo del Excel de Turno tiene un typo:** se llama
  `Descontar descansso en` (doble "s"), no `descanso`. El código busca ese patrón exacto en
  `buildModel()` — si BioTime corrige el typo en una futura exportación, la búsqueda por regex deja de
  encontrar la columna y el almuerzo deja de descontarse silenciosamente. Buscar `descontar +descans`
  en el código si esto vuelve a fallar.
- **La cobertura de fechas de los archivos no es uniforme entre sí.** En la exportación de referencia
  usada para probar: `Reporte de Marcaciones` cubre 2026-03-01 a 2026-08-31 (280.857 filas), pero
  `Horario` solo cubre 2026-07-01 a 2026-10-01 (cero filas antes de julio). Cualquier ciclo anterior a
  julio 2026 mostrará "sin turno programado" para prácticamente todo el mundo — **eso es un hueco de
  datos, no evidencia de incumplimiento.** Adopción (en los dos archivos) muestra un aviso automático cuando
  hay personas sin ninguna marcación o sin ninguna programación cargada (`#cobAviso`).
- **Fechas de ingreso masivas = migración del sistema, no contratación real.** En los datos de
  referencia, 879 de 1.273 empleados comparten exactamente `2026-04-08` como fecha de ingreso, y
  ninguno de esos 879 tiene turno programado antes de esa fecha tampoco. Eso es la fecha en que se
  empezó a usar BioTime, no un día de contratación masiva. `marcarIngresosMasivos()` detecta
  automáticamente cualquier fecha de ingreso compartida por más de `cfg.ingMasivo` empleados
  (parámetro `cIngMasivo`, default 15) y deja de usarla como límite duro de vigencia — solo las fechas
  de ingreso genuinamente individuales siguen bloqueando (A-15).
- **Hay cuentas que no son empleados reales.** `TARJETA` (departamento `TARJETA`, ids `11240791` y
  `11418687`) es una tarjeta de marcación manual que usan los técnicos para registrar a otras personas
  — sus marcaciones no representan la asistencia de un individuo. Los ids `123456` y `1234567`
  (departamento `SNAPIT`) son cuentas de prueba del proveedor/integrador. Ninguna de las dos genera
  concepto alguno en Consolidado (0 horas extra, 0 recargos), así que no hay riesgo de nómina — el
  riesgo era que aparecieran en las listas de "peor cumplimiento". Se resolvió con la exclusión por
  departamento del filtro **Alcance** (guardada en `localStorage.mb_kpi_excl`, la misma llave que usaba la
  pestaña KPI), no filtrando estos ids a nivel de motor — si aparecen más cuentas de
  prueba en el futuro, agregar su departamento ahí, no hardcodear el id en el código.
- **El catálogo de turnos es dinámico: hoy son estos 13, mañana serán otros.** Nada en el motor debe
  depender de un código de turno concreto. Todo sale del Excel de Turno (horas, días de la semana,
  descanso) o de parámetros del formulario. El único texto con nombre de turno en el código es
  `cfg.adminPref` (default `T_ADM`), y es un parámetro editable, no una constante.
- **Solo 3 de los 13 turnos suman 42 h semanales, y eso NO es necesariamente un error.** Al validar
  turno por turno (segmentos por día, netos de almuerzo): cumplen exacto `T_NORMAL1` (8+7+7+7+7+6),
  `T_NORMAL2` (8+8,5×4) y `T_ADM1` (47 brutas − 5 de almuerzo). Quedan por encima `T_NORMAL3` = 50 h
  (trabaja domingo) y `TP` = 60 h netas (turnos de 13 h brutas — es el turno de 12 h del B-13). Quedan
  en 40 h `T3_AGO`, `T2_AGO`, `T1_AGO`, `T_FESTIVO1/2/3` y `T_12H_NOCHE`. Importa porque el umbral
  semanal **sí se activa** para T_NORMAL3 y TP: no es decorativo. Verificar estos números en cada
  ciclo nuevo, no darlos por fijos.
- **Turnos que declaran su fin más temprano a propósito: `T_12H_NOCHE` es el ejemplo.** Se llama
  "6PM A 6AM" y la gente efectivamente trabaja 18:00→06:00, pero está configurado 18:00→**03:00**.
  **No es un error de datos** (se confirmó con el usuario): al declarar el fin a las 03:00, las
  últimas 3 horas quedan fuera de la ventana del turno y el motor las calcula como **extra del mismo
  día**, en vez de entrar como ordinarias a la bolsa semanal y esperar a cruzar las 42 h. Es la
  palanca que tiene RRHH para elegir, turno por turno, entre "extras el mismo día" y "extras por
  bolsa semanal". El modelo de jornada fija + escalera **respeta este mecanismo**: verificado con un
  caso sintético de 5 noches, da 8 h fijas + 3 h de extra diaria por noche (40 h ordinarias + 15 h
  extra en la semana, sin tocar nunca el umbral). Si alguien "corrige" ese turno a 06:00 en BioTime,
  las extras se mueven solas a la bolsa semanal — que es justamente lo que se quería evitar.
- **Las marcaciones intermedias del día son el descanso de café, y los turnos ya lo declaran.** Un
  día con 4 marcaciones (`07:17 10:05 10:28 17:00`) no es un error: la persona salió a tomar café y
  volvió. Se analizaron los 12.376 huecos de 60 minutos o menos dentro del turno en agosto 2026: el
  90,7% ocurre en los biométricos de **VESTIER** (mujeres y hombres), la duración tiene un pico marcado
  entre 19 y 25 minutos, se concentra en las franjas 08:00–09:59 y 16:00–18:59, afecta a 11.505
  empleado-día y el **96,6% de esos días tiene exactamente un hueco**. Es un patrón de descanso, no de
  ausentismo. El resto de los huecos cae en porterías y recepción, que son salidas reales de la
  empresa. **En su momento se decidió no distinguir por dispositivo; esa decisión se revirtió en
  sept-2026** al aparecer el caso 8456 (ver abajo): el tope diario acotaba el daño pero no evitaba que
  a un técnico que recorre la planta se le cargaran horas pendientes que nunca debió.
- **El tope del café sale del propio turno, no de una constante.** Todos los turnos de planta declaran
  `Descanso 0.333` (20 min) en el Excel de Turno, además de su almuerzo. Ese valor es el tope. Solo
  `T_ADM1` declara únicamente la hora de almuerzo, y para esos casos existe el parámetro `cCafeAdm`
  (default 20) como respaldo. Si mañana un turno declara 15 o 30 minutos de café, el motor lo respeta
  solo — no hay que tocar código.
- **El turno `TP` es de un jefe, no un turno de producción.** Se creó para que el tiempo empezara a
  contar desde la primera marcación de la persona. Es un cargo de dirección y confianza, y por eso
  existe la marca `CONFIANZA` (ver abajo) en vez de un tratamiento especial del código de turno: el
  turno puede cambiar de nombre, la condición del cargo no.
- **El maestro de Empleados solo exporta a los Habilitados.** En la exportación del 2026-09-07 son
  1.063 (antes eran 1.273: se depuraron 210). Los **483 renunciantes no están ahí, ninguno** — se
  verificó el cruce completo, la intersección es cero. De esos 483, **151 tienen marcaciones en el
  período**, así que sin el archivo de Renuncia se pierden: 64 caían enteros en huérfanos (A-10,
  **1.196 marcaciones descartadas**) y 88 entraban a medias por el archivo de Horario, sin
  departamento ni cargo — de los cuales 47 aparecían en Consolidado **con horas reales y el filtro de
  departamento vacío**, o sea invisibles al filtrar. Con el archivo leído: huérfanos → 0, sin
  departamento → 0, y las 52 excepciones bloqueantes B-14 ("empleado sin cargo") desaparecen porque
  Renuncia sí trae el cargo.
- **La llave del archivo de Renuncia viene pegada:** la columna `Empleado` trae el id y el nombre en
  una sola celda (`"9999 NOMBRE APELLIDO"`). **No hay columna de id limpia.** Se separa con
  `/^(\d+)\s+(.*)$/`; los 483 registros parsean bien hoy, pero es frágil: un id con letras rompe el
  regex silenciosamente (la fila se ignora, no lanza error).
- **`Branch` en las marcaciones ES la `Compañía` del maestro.** Verificado sobre los 1.039 activos con
  marcación: **1.039 coincidencias exactas, 0 discrepancias, 0 empleados con dos valores distintos.**
  Es la única forma de saber si un retirado era PLASTITECSA o GRANSERVICIOS, porque el archivo de
  Renuncia no trae compañía. Y esa distinción **no es cosmética**: `Compañía` vale PLASTITECSA (619) o
  GRANSERVICIOS (444), y GRANSERVICIOS son los temporales del E-06, que van a otro archivo de nómina.
  De los 151 renunciantes recuperables, **135 son GRANSERVICIOS**. Por eso el vínculo activo/retirado
  es una dimensión propia (`emp.vinculo`) y **nunca** se estampa dentro de `Compañía`: se evaluó esa
  opción y habría borrado justamente la separación que más importa.
- **`Centro de costos` está inservible y se eliminó del modelo.** 972 de 1.063 filas traen el literal
  `"Centro de costos"` como valor — la cabecera se coló como dato en BioTime. Solo hay 12 valores
  distintos en todo el maestro. El campo `emp.centro` se leía y no se usaba en ningún filtro, render
  ni exportación; se quitó.
- **`Motivo de renuncia` no sirve hoy.** De 483 registros: **207 traen una fecha** en vez de un motivo,
  260 están vacíos y solo 16 tienen texto real. No se lee.
- **Las fechas de retiro todavía no son confiables.** Hay **218 marcaciones posteriores a la fecha de
  retiro en 31 personas**, y un caso grosero: el empleado **8592, retiro 2026-05-22, última marcación
  2026-09-05 — 163 marcaciones después**. El usuario lo está investigando (sospecha de registro mal
  hecho o de alguien marcando con esa credencial). Por eso A-16 **no bloquea** (ver abajo).
- **La programación de turnos llega hasta 2027-01-31.** Un retirado sigue teniendo turno asignado
  meses después de irse, así que sin un corte de vigencia cada día posterior a su salida contaría como
  ausencia y hundiría el KPI. De ahí `emp.vigFin`.
- **Ventana de validación real acordada con el usuario: agosto 2026 en adelante.** El uso cuidadoso de
  BioTime empezó junio–julio 2026; los datos de marzo a mayo son ruido esperado de una implementación
  que recién arrancaba (turnos no cargados, marcaciones erráticas). No tratar esos meses como bugs a
  perseguir.

---

## Arquitectura del motor

Pipeline de una corrida (`runCalc()`):

```
buildModel()              → MODEL   { employees, shifts, sched, punches, orphan, ingresoMasivo }
                                    (cada employee lleva vinculo ACTIVO/RETIRADO y vigFin)
marcarIngresosMasivos(MODEL, cfg)  → agrega MODEL.ingresoMasivo (Map fecha→conteo)
compute(MODEL, cfg)       → RESULT  { byEmp, cons, todos, exc, cfg, days }
computeAsistencia(MODEL, cfg)      → ASISTENCIA (Map)   [solo reporte-horas.html]
render*()                 → pintan cada pestaña a partir de RESULT / ASISTENCIA
```

`MODEL` se construye una vez por corrida y es de solo lectura para el resto del pipeline.
`readConfig()` lee los ~20 campos del formulario (ver tabla de parámetros) en un objeto `cfg` plano
que se pasa explícitamente a cada función — no hay estado de configuración implícito.

### Algoritmos no triviales (documentados aquí porque no son obvios leyendo el código una sola vez)

**Resolución de marcaciones impares (A-04, `impar:'sugerir'`).** Cuando un día tiene un número impar
de marcaciones, se prueba quitar cada una por turno y se conserva la combinación cuya entrada queda
más cerca del inicio del turno programado y cuya salida más cerca del fin. Nunca se inventa una hora:
todas las horas usadas son marcaciones reales. El día queda marcado `SUGERIDO` y la marcación
descartada se muestra tachada en Detalle. Si no hay ningún emparejamiento válido (por ejemplo, salidas
antes que entradas en cualquier combinación), se declara bloqueante y no se calcula.

**Detección de jornada nocturna sin turno que cruza medianoche (dentro de `computeAsistencia`, solo en
`reporte-horas.html`).** La primera versión de este algoritmo agrupaba marcaciones sueltas por
cercanía cronológica (menos de N horas de diferencia = misma sesión) y tenía un bug real: fundía dos
días de trabajo normal en uno solo, porque el descanso nocturno entre dos jornadas ordinarias
consecutivas dura casi lo mismo que una jornada nocturna real. La señal correcta, ya implementada, es
la **paridad**: un día solo puede "adoptar" la primera marcación del día siguiente como su cierre si
(a) ese día queda con un número **impar** de marcaciones sueltas (una entrada sin su salida) y (b) esa
última marca cae en la franja nocturna (`cfg.nocIni`) y (c) la marca del día siguiente cae dentro de
las ~4 horas después del fin de la franja nocturna (`cfg.nocFin + 240`). Solo se reasigna esa marcación
puntual, nunca el día completo — así un día con jornada normal (par, completa) nunca se confunde con
el inicio de un turno nocturno no programado.

**Jornada fija del turno + escalera de sobretiempo (reemplazó al redondeo plano en sept-2026).**
Este es el corazón del cálculo y el cambio más importante que ha tenido el motor. Antes se sumaban los
minutos del reloj y se redondeaba el total del día con `round05()`; eso producía un error real: un
T_ADM1 de 07:30 a 17:00 con salida 17:21 daba 8,85 h trabajadas y el redondeo lo empujaba a **9 h**,
cuando los 21 minutos de más nunca alcanzaron el umbral de 25. Hoy el modelo es:

- **La base del día son las horas fijas del turno**, calculadas como `salida − entrada − almuerzo`.
  Para T_ADM1 lunes a jueves son 8,5 h. Se acreditan **completas** aunque la persona haya trabajado
  algunos minutos menos: el faltante no se descuenta, se registra en `pendienteMin` (ver abajo).
  Ojo: la base sale del **cálculo**, no de las columnas "Horas hábiles" / "Horas por día" del Excel de
  Turno, que están desactualizadas en al menos 4 turnos (ver hallazgos de datos).
- **El sobretiempo se cuenta desde el fin del turno**, con la escalera de `escalera(min, cfg)`: la
  primera media hora exige `cfg.escPrimer` minutos (default 25) y cada media hora siguiente se
  acredita `cfg.escGracia` minutos antes de completarse (default 10). Con los defaults:
  `+25 → 0,5 h · +50 → 1,0 h · +80 → 1,5 h · +110 → 2,0 h · +140 → 2,5 h`. Un turno que acaba 16:30
  acredita media hora a las 16:55 y la hora completa a las 17:20. **Los dos números son parámetros del
  formulario, no constantes** — se pidió explícitamente que fueran cambiables.
- **`round05()` sigue existiendo** y se usa solo como normalizador final por concepto. Es idempotente
  sobre los valores limpios que produce el modelo nuevo (8,5 h sigue siendo 8,5 h), y protege contra
  turnos definidos con minutos raros. **No volver a usarlo sobre el total del día: ese era el bug.**

**Horas pendientes (`pendienteMin`).** Diferencia entre las horas fijas del turno y lo que la persona
realmente trabajó dentro de la ventana del turno. No descuenta nada — se le paga la jornada completa
igual — pero queda registrada por día, sumada por empleado (`pendH`) y exportada a Excel. Es el
sustento para un reclamo: *"vea, usted no me está cumpliendo el turno, y aun así le estoy pagando
como si lo hiciera"*. En agosto 2026, ya con el café pagado descontado, quedan ~3.974 h pendientes; el
grueso son atrasos de 11 a 30 minutos, pero hay 735 días con más de 2 h. Antes de reconocer el café
eran ~6.396 h en 10.187 días — la diferencia no era incumplimiento, era el descanso de las 10 de la
mañana.

**Un efecto de este modelo que conviene conocer:** alguien puede llegar 3 h tarde y quedarse 4 h
después del fin de turno; el sistema le acredita la jornada fija **y** las extras de la escalera, y
deja las 3 h en pendientes. Si algún día se quiere que no se paguen extras en días con pendientes,
eso es una regla nueva que hay que pedir — hoy no existe.

**`HRS` y `ORDIN.` son cosas distintas y esto ya generó una confusión real.** En la pestaña Detalle,
`HRS` es el tiempo de reloj efectivamente trabajado y `ORDIN.` es lo que se acredita (la jornada
fija). Un caso real: el empleado 385 el 2026-08-06 marcó `07:17 10:05 10:28 17:00` — cuatro
marcaciones, porque salió 23 minutos a media mañana. `HRS` mostró 8,12 h (reloj real) y `ORDIN.`
mostró 8,50 h (lo que se paga). Antes del café pagado, `PEND.` marcaba 0,38 h = esos 23 minutos;
hoy 20 de esos 23 se reconocen como café y solo quedan **3 minutos** pendientes. **No era un error de
cálculo,**
pero el orden de las columnas invita a leer `HRS` como si fuera el resultado. Si el reporte se sigue
malinterpretando, conviene renombrar las columnas antes que tocar el motor.

**Descanso de café pagado (B-12, `huecosInternos` + `topeCafe`).** El café lo paga la empresa, así
que los minutos en que la persona **salió y volvió a marcar dentro de su turno** se perdonan hasta un
tope diario, en vez de convertirse en horas pendientes. Los tres puntos que hacen que esto no se
preste a abuso:

- **La señal es el hueco interno, nunca la llegada tarde.** `huecosInternos()` solo mira el espacio
  entre un par de marcaciones y el siguiente, recortado a la ventana del turno. Alguien que llega 3 h
  tarde y no vuelve a salir tiene café = 0 y conserva las 3 h completas en pendientes. Verificado
  contra el empleado 74, que llegó entre 261 y 313 minutos tarde en varios días y no perdió un solo
  minuto de pendiente.
- **La ventana del almuerzo se excluye del cálculo.** El almuerzo ya viene restado de la jornada fija
  por `quitarDescanso()`; si no se excluyera, se descontaría dos veces. Por eso `quitarDescanso()`
  ahora devuelve también `ventana:{ini,fin}` — ese es todo el motivo del campo.
- **El tope es diario y sale del turno.** `topeCafe(W,cfg)` devuelve el `Descanso` declarado por el
  propio turno cuando es menor al umbral de almuerzo (`cfg.descMin`), y si no, `cfg.cafeAdm`. Un hueco
  de 71 minutos perdona 20 y deja 51 pendientes; uno de 172 perdona 20 y deja 152.

Efecto medido en agosto 2026: 8.357 días con café reconocido, 2.671 h pagadas, y las horas pendientes
del ciclo bajaron de **6.395,8 h a 3.973,6 h**. Los minutos reconocidos se ven en el tooltip de la
celda `PEND.` y se exportan en la columna `MIN CAFE RECONOCIDO` del Detalle.

**Rol de cada biométrico (`clasificarHuecos`, B-12/B-16).** Un hueco entre marcaciones significaba
una sola cosa: la persona salió. Eso lee mal a quien trabaja recorriendo la planta. El caso que lo
destapó, empleado **8456** (técnico de sistemas), el 2026-08-05:

```
05:31 PORTERIA PLANTA 2 · 08:02 ALMACEN PP · 12:55 EXTRUSION PP · 14:16 RECEPCION PLANTA 2
```

Cuatro dispositivos distintos, nunca cruzó una portería entre medio. El motor leía el hueco
08:02→12:55 como salida y le cargaba **4,55 h de pendiente en un día que trabajó completo**.

Los 7.871 huecos de agosto 2026 se separan solos por dónde abre y dónde cierra el hueco:

| Sale → vuelve | Huecos | Mediana | ≤60 min | Qué es |
|---|---|---|---|---|
| VESTIER → VESTIER | 7.254 | 24 min | 73% | el café |
| INTERIOR → INTERIOR | 543 | 23 min | 73% | tránsito dentro de planta |
| PORTERÍA → PORTERÍA | 53 | **196 min** | **15%** | salida real de la empresa |

Cada dispositivo tiene ahora un **rol**, y el hueco se clasifica por el rol de los dos extremos:

- **`PORTERIA`** — salió de la empresa: el hueco **pesa completo** como pendiente.
- **`DESCANSO`** — café: se perdona **hasta el tope diario** (B-12).
- **`INTERIOR`** — nunca cruzó el perímetro: **no genera pendiente**, sin tope, pero se marca `B-16`
  si supera `cfg.transAviso` para que nadie perdone horas a ciegas.

**La prioridad es deliberada: si CUALQUIER extremo es portería, el hueco es ausencia.** Ante la duda
se cobra al empleado, no a la empresa.

**El rol se sugiere por el nombre y lo confirma una persona** (botón *Dispositivos*, persistido en
`localStorage.mb_dispositivos`). La sugerencia cubre **solo lo que el nombre realmente prueba**: un
vestier es descanso, una portería es salida. Todo lo demás queda **sin clasificar** y se trata como
`DESCANSO`, que acota el error al tope del café en las dos direcciones hasta que un humano decida.

> **Un error que estuvo a punto de entrar, y por qué importa.** La primera versión de `rolAuto()` tenía
> un tercer patrón, `/DISPOSITIVO|LECTOR/ → INTERIOR`. Como **los 13 dispositivos reales empiezan por
> "Dispositivo-"**, ese cajón de sastre convertía cualquier lector nuevo y desconocido en tránsito de
> perdón **libre y sin tope**. Acertaba en los 13 de hoy por casualidad, no por evidencia. Lo detectó
> un caso sintético con un dispositivo inventado. Marcar un área de planta como interior es una
> decisión de nómina; no se adivina de un nombre.

**Este cambio no mueve un peso de nómina.** Ordinarias y extras son idénticas en los tres escenarios;
solo se mueve el reporte de horas pendientes:

| | HEAD | recién abierto | ya clasificado |
|---|---|---|---|
| horas ordinarias | 130.040,0 | 130.040,0 | 130.040,0 |
| horas extra | 16.426,5 | 16.426,5 | 16.426,5 |
| **horas pendientes** | 3.755,1 | **3.767,6** | **3.665,0** |
| pendientes del 8456 | 15,00 | 15,00 | **8,98** |

Sin clasificar nada, los pendientes **suben** 12,5 h: los huecos de portería dejan de recibir el
perdón del café, que es la dirección correcta. Con los cuatro interiores clasificados, bajan 90,2 h.
Y el 8456 pasa de 15 h a 8,98 h — **no a cero**: las horas que sí debe siguen ahí. Eso es lo que se
buscaba, no un perdón general.

**Lactancia por archivo (E-04 / C-09, `leerLactancia` + `ubicarLactancia`).** Reemplazó al esquema
anterior de turnos `T_LACT*` (`esLactancia`/`topeLactancia`, parámetros `cLactPref`/`cLactMin`: **todo
eliminado**). Se descartó porque obligaba a crear en BioTime un turno por cada combinación de horario ×
etapa × empleada —una cantidad absurda de turnos, que además habría que reasignar cada vez que una
empleada pasa de la etapa de 6 meses a la de 24—. Ahora la lactancia es un dato de la persona, no del turno.

*El archivo.* Sexta fuente, **opcional** (como Renuncia: `checkReady()` no la exige, no se guarda en
`localStorage`, se carga en cada corrida). Una fila por empleada, cinco columnas que se ubican por nombre
tolerante con `pick()` (`ID_empleado`/`Empleado ID`/`Código`; `Inicio_lactancia_6m`/`Fecha inicio 6
meses`/`Desde 6M`; etc.), con o sin fila de título. Cada etapa es opcional, pero sus dos fechas van juntas:

| Etapa | Fechas | Tope diario (parámetro) |
|---|---|---|
| `6M` | `Inicio_lactancia_6m` … `Fin_lactancia_6m` | `cLactMin6` = 60 min |
| `24M` | `Inicio_lactancia_24m` … `Fin_lactancia_24m` | `cLactMin24` = 30 min |

La etapa de un día es la de su **fecha de jornada** (la del inicio del turno). Si caen las dos —solo
pasa cuando `Fin_6m == Inicio_24m`, igualdad permitida— manda la de 6 meses.

*Validación (`leerLactancia`, nunca lanza; todo queda en pantalla).* Se hace **al cargar los archivos**
(`validarLactCarga()` desde `checkReady()`, con `idsConocidos()`, que replica los patrones de id de
`buildModel()`) y otra vez dentro de `buildModel()` (`MODEL.lactancia`, que es lo que usa el cálculo);
una prueba comprueba que dan exactamente lo mismo y que `idsConocidos()` == ids del modelo en datos
reales. El resumen sale en la tira del encabezado (`#hdrCarga`: filas, válidas, "N con error" en rojo,
"N aviso(s)" en ámbar) y el botón *Validación de lactancia* (y un clic en la tira) abre el panel con
fila de la hoja, ID, tipo y motivo. El panel imprime solo el ID, nunca el nombre.

| | Caso | Severidad | Efecto |
|---|---|---|---|
| a | ID vacío o ilegible | Error | se ignora la fila |
| b | ID que no está en el maestro ni en renuncias | Aviso | se ignora la fila |
| c | ID repetido | Error | se ignoran **todas** las filas con ese ID |
| d | etapa con una sola de sus dos fechas | Error | se ignora esa etapa |
| e | fin anterior al inicio | Error | se ignora esa etapa |
| f | `Fin_6m` posterior a `Inicio_24m` | Error | se ignora **toda** la fila (igual es válido). **Solo se evalúa si AMBAS etapas son válidas** |
| g | fecha ilegible (30 de febrero, texto) | Error | se ignora esa etapa |
| h | fila sin ninguna etapa válida | Aviso | sin efecto |

**La regla f solo corre entre dos etapas VÁLIDAS (sept-2026, corrige un bug real).** `fase()` devuelve
`ini`/`fin` también para una etapa inválida, y la primera versión comparaba esas fechas sin mirar `valida`:
una etapa de 24 meses incompleta o al revés (un `Inicio_24m` suelto anterior a `Fin_6m`, o fin < inicio) tiraba
abajo una etapa de 6 meses correcta y encima emitía un segundo error engañoso. Ahora una etapa incompleta,
al revés o ilegible se ignora **sola** (con su propio error) y la otra sobrevive; solo un `Fin_6m >
Inicio_24m` real entre dos etapas válidas descarta toda la fila.

*Lectura de fechas: `readSheet(buf, true)` lee en BRUTO (`raw:true`).* Una fecha escrita a mano en Excel
trae el formato corto del sistema, y SheetJS con `raw:false` la devuelve como `1/15/26` (verificado con
SheetJS 0.18.5 real, no es hipótesis): `toISO()` no la entiende y **todas** las fechas habrían salido como
"ilegibles". En bruto llega como `Date` o como serial y `toISO()` las resuelve; el texto `AAAA-MM-DD` y
`DD/MM/AAAA` también. `fechaLact()` además rechaza lo que `toISO()` deja pasar (mes 13, 30 de febrero,
años absurdos). Con `conFila` también se conservan las filas en blanco, para que el "Fila" del panel sea
el número REAL de la hoja de Excel. Sin `conFila`, `readSheet` queda exactamente como antes.

*Crédito (en `compute()`, solo en la rama de jornada con turno).* Después del café (B-12, intacto):

```
pendCafe        = max(0, jornadaFija − dentro − café − tránsito)
lactPagadoMin   = min(tope de la etapa de ese día, pendCafe)
pendienteMin    = pendCafe − lactPagadoMin
```

Es un **derecho, no una obligación**: se acredita solo lo que la persona realmente no trabajó dentro de
su turno, sea llegada tarde, salida temprana o un hueco interno **de cualquier rol de biométrico**
(incluida portería: está topado y es opt-in). Si toma menos que el tope, se acredita lo que faltó. Sin
crédito en días sin marcaciones (A-18), para `CONFIANZA` ni en turnos `T-EXTRA` (no tienen pendientes).
Café y lactancia siguen siendo separados y acumulables y juntos nunca superan los minutos pendientes.

*Cómo se pagan: ordinarios SIN recargo (decisión del usuario).* La base del día es la jornada fija
completa, y los minutos pendientes **no están ubicados en el tiempo** (son una métrica). Para poder quitarles
el recargo hay que ponerlos en la línea de tiempo: `ubicarLactancia()` resta lo realmente trabajado
(`r.iv`) de los intervalos de la jornada fija (`alm.iv`, ya sin almuerzo) y reparte los minutos
acreditados sobre los **minutos sin trabajar, en orden cronológico**. La elección solo importa para el
recargo y es una convención estable, no una adivinanza de cuándo la tomó. La base se vuelve a partir con
`atomize()` en esas fronteras (la suma no cambia: I-01) y los tramos resultantes llevan **`lact:true`**. En la
clasificación (`classify`), un tramo `lact && !extra` se paga como **ordinario sin concepto** —ni 0220, ni
0252/0253, ni 0258— aunque caiga de noche, domingo o festivo; solo lleva recargo lo que realmente trabajó.
`partirPorSemana()` y la bolsa conservan la marca (se copia con `{...t}`). Consecuencias, probadas:

- **Cuentan en la bolsa semanal (ROTATIVO) y en la jornada diaria (ADMINISTRATIVO) como cualquier minuto
  ordinario**, así que por sí solos no generan extras. Las extras de la escalera (25/10) no cambian.
- Si la bolsa ya estaba agotada, el tramo `lact` se reclasifica como `extra:true` (igual que cualquier otro
  minuto acreditado sin trabajar) y se paga como extra normal: el sobretiempo solo aparece después de la
  bolsa, como antes. El pendiente igual baja.
- La suma de TODOS los conceptos solo puede bajar, y solo para quienes figuran en el archivo.

*Identificación y estadísticas.* `byEmp.lact` (`resumenLactancia()`) trae etapas dentro del ciclo, días
calendario en lactancia por etapa (recortados a su vigencia), días con crédito y minutos por etapa.
Consolidado: columna con la marca `LACT 6M`/`LACT 24M`, filtro «Lactancia» (todas / solo en lactancia /
6 meses / 24 meses), tarjetas *Empleadas en lactancia* y *Horas de lactancia acreditadas* y, en el Excel,
`ETAPA LACTANCIA`, `DIAS EN LACTANCIA`, `DIAS CON CREDITO LACTANCIA`, `MIN LACTANCIA 6M`, `MIN LACTANCIA
24M`. Detalle: tarjeta *Lactancia*, chip `E-04 · 6M · 45 min` en cada día (el tooltip dice etapa y minutos;
el chip lleva también `data-nov="E-04"`, así que un clic salta a la excepción como las demás novedades, y en
`initPop` el `data-tip` manda sobre el `data-nov` para que el tooltip siga siendo el texto del día),
excepción INFO `E-04` por día y, en el Excel del Detalle, `ETAPA LACTANCIA` como **última columna**
(después de `EXPLICACION`, igual que en el Consolidado) para que ninguna columna se corra al cargar el archivo;
sin archivo el orden es el de siempre. Asistencia
(resumen): la marca junto al vínculo, solo en pantalla. «Exportar detalle completo» agrega la hoja
**Lactancia**: una fila por **cada fila del archivo** (también las ignoradas, con su estado `VALIDA`/`VALIDA
CON ERRORES`/`IGNORADA` y los motivos). **La hoja respeta los filtros activos del Consolidado** (empresa,
departamento, perfil, activos/retirados, filtro de lactancia y búsqueda), con el mismo criterio que la hoja de
Excepciones: `aoaLactancia(ids)` con los ids de `consFiltrado()`; sin filtro trae todas las filas, con filtro solo
las de esos empleados (las filas ignoradas sin empleado, como un ID desconocido, no aparecen). Antes ignoraba
los filtros y filtraba datos de otra empresa, que es justo lo que el filtro de compañía busca evitar. Las fechas
que llegan como serial de Excel se exportan como fecha ISO, no como `46037`. **Nada de esto se pinta ni se exporta sin archivo
cargado.** El botón *Descargar plantilla de lactancia* baja un `.xlsx` con los cinco encabezados y dos filas
**ficticias** con IDs no numéricos (`EJEMPLO-1` y `EJEMPLO-2`, para que nunca puedan chocar con el ID de una
persona real: antes eran 9991 y 9992, que están dentro del rango real); cargada sin modificar solo produce
avisos «ID desconocido», sin errores y sin acreditar nada a nadie. Es la única descarga que crea esta función y solo la
dispara el usuario.

*Verificación.* Sin archivo: huella completa (empleado × conceptos × ordinarias × extras × pendientes) y
todas las exportaciones idénticas a la copia previa, en los dos archivos, con 1.074 empleados (ciclo
11-sep a 10-oct) y 1.148 (1-ago a 14-oct), I-01/I-02/I-03 = 0. Con un archivo sintético de ~20 ids reales:
quienes no están en el archivo quedan idénticos; en los que sí, ordinarias y extras idénticas, los recargos
solo bajan y los pendientes bajan exactamente los minutos acreditados. Casos sintéticos (turno nocturno
22:00–06:00, jornada fija 480 min; rotativo salvo que se diga):

| caso | crédito | pendiente (control sin archivo) | recargo nocturno (control) |
|---|---|---|---|
| etapa 6M, sale 05:00 | 60 | **0** (60) | 7 h (8 h) |
| 6M, sale 02:00 | 60 | **180** (240) | 7 h (8 h) |
| 6M, llega 60 tarde | 60 | **0** (60) | 7 h (8 h) |
| 24M, llega 60 tarde | 30 | **30** (60) | 7,5 h (8 h) |
| 6M, hueco de 60 por portería | 60 | **0** (60) | 7 h (8 h) |
| 6M, hueco de 80 por vestier | 60 (+20 café) | **0** (60) | 7 h (8 h) |
| 6M, toma solo 30 de 60 (sale 05:30) | 30 | **0** (30) | 7,5 h (8 h) |
| 6M, sin marcaciones / CONFIANZA / T-EXTRA | 0 | sin cambio | sin cambio |
| ADMINISTRATIVO, sale 05:00 | 60 | **0** (60) | 7 h (8 h) |
| domingo / festivo, sale 1 h antes | 60 | **0** (60) | dominical 7 h (8 h) |
| 6 noches, la 6.ª llega 1 h tarde | 60 | **0** (60) | 1 h (2 h); extras 6 h iguales |

**Ojo con un ejemplo que se prestó a confusión:** si sale a las 02:00 de un turno 22:00–06:00 faltan 4 h;
el tope de la etapa de 6 meses cubre 60 min, así que **quedan 3 h pendientes**, no 4.

**Dirección, confianza y manejo (Art. 162 CST, `CONFIANZA`).** Marca por empleado —checkbox en la
barra de Detalle, persistida en `localStorage.mb_confianza`— para los cargos que la ley excluye de la
jornada máxima legal. Un empleado marcado:

- **no tiene jornada fija**: se le acredita el tiempo efectivamente trabajado (`dentroMin = workMin`),
- **no genera horas extra** (`extraCredMin = 0`, la escalera no corre) **ni horas pendientes**,
- **queda fuera del umbral semanal** — la rama es `if(perfil==='ROTATIVO' && !esConfianza)`,
- **sigue generando los recargos** nocturno, dominical y festivo, que no dependen de la jornada máxima.

Es una marca por persona y no por código de turno a propósito: el turno `TP` existe hoy para un solo
jefe, pero el turno puede renombrarse o reasignarse y la condición del cargo no viaja con él. Caso
real de verificación, empleado 3956: pasó de (ordinarias 180 h, extras 24 h, pendientes 72,9 h) a
**(ordinarias 131,1 h, extras 0, pendientes 0)**. La novedad `CONFIANZA` explica la marca en el
tooltip de cada día afectado.

**Vigencia real de un retirado (`emp.vigFin`, A-16).** Se calcula una sola vez en `buildModel()` y es
la única fuente de verdad para `compute()` y para `computeAsistencia()` — no se duplica la regla:

```js
e.vigFin = (ultimaMarcacion && ultimaMarcacion > e.retiro) ? ultimaMarcacion : e.retiro;
```

**La última marcación manda sobre la fecha de retiro.** Es una decisión explícita del usuario
(sept-2026) tomada con las fechas de retiro actuales a la vista: se prefiere no perder tiempo
realmente trabajado por un dato mal registrado en BioTime. Consecuencias:

- Los días entre el retiro y esa última marca **se calculan normal** y quedan marcados `A-16`.
- Los días posteriores a `vigFin` salen del cálculo (igual que A-15 antes del ingreso) — eso es lo que
  impide que el KPI cuente como ausencia cada día programado de alguien que ya se fue.
- **A-16 dejó de ser bloqueante** (`BLOQ` → `ADV`) y se emite **una sola vez por empleado** con el
  conteo de días, no una fila por día: el caso real que motivó esto tenía 163 marcaciones posteriores
  al retiro y habría inundado Excepciones (misma lección que A-18/B-03).

Cuando RRHH termine de corregir las fechas de retiro en BioTime, se puede endurecer esto; hoy sería
prematuro y perdería horas legítimas.

**El tipo de día se evalúa POR TRAMO, no por turno (bug real, sept-2026).** `atomize()` corta en
cada medianoche y le estampa a cada tramo su propia fecha (`t.iso`), pero la clasificación hacía
`const festivo = esFestivo(r.tipoDia)` **una sola vez por fila** y se lo aplicaba a todos los tramos.
Consecuencia: un turno nocturno que arranca un festivo arrastraba el recargo festivo hasta el final,
aunque a las 00:00 ya fuera otro día.

Caso real reportado por el usuario — lunes **2026-08-17** (Asunción), turno `T_12H_NOCHE` 18:00–06:00,
almuerzo 22:00–23:00:

| Tramo | Fecha real | Antes | Ahora |
|---|---|---|---|
| 18:00–19:00 diurno | 17 (festivo) | `REC_F` 1 h | `REC_F` 1 h |
| 19:00–22:00 nocturno | 17 (festivo) | `REC_FN` | `REC_FN` |
| 23:00–00:00 nocturno | 17 (festivo) | `REC_FN` | `REC_FN` |
| 00:00–06:00 nocturno | **18 (ordinario)** | `REC_FN` | **`REC_N` 6 h** |

Resultado: `REC_F=1 · REC_FN=10` pasó a `REC_F=1 · REC_FN=4 · REC_N=6`. La hora que separa el 4 del 5
que uno esperaría a ojo es el **almuerzo 22:00–23:00**, que cae del lado del lunes.

**El bug estaba en las dos direcciones, y la otra le costaba al empleado:** 235 días *ganaron* recargo
festivo que nunca se les pagó (1.421 h) — gente que trabajó la noche del 6 de agosto y cruzó al
festivo del 7, facturada como noche común. La dirección reportada son 424 días y 2.555 h.

**No es un recálculo, es una reclasificación:** la suma de todos los conceptos es idéntica antes y
después (70.662,5 h). Si un cambio futuro en esta zona mueve esa suma, es un bug.

El `festivo` por fecha se memoiza en un `Map` por fila (`fesPorDia`): un día son pocos tramos, pero el
ciclo entero son decenas de miles.

**La semana del umbral arranca con el primer turno, no a medianoche (regla del usuario, sept-2026).**
Para los rotativos la semana empieza el **domingo a las 22:00**, cuando entra el turno 3; lo trabajado
el domingo antes de esa hora cuenta en la bolsa de la semana que termina. Antes el motor asignaba la
semana por la **fecha de la jornada** (`weekStart(r.iso)`), así que un domingo de tarde caía en la
semana nueva. Ahora se asigna **por tramo y por instante** (`semanaDeTs(t.ini, cfg)`), y los tramos
que cruzan el borde se parten con `partirPorSemana()` antes de acumular (conserva I-01/I-02).

Caso sintético que distingue la regla: lunes a sábado 7 h diarias (42 h) más un domingo de 14:00 a
21:00 → **antes 49 ordinarias y 0 extra; ahora 42 ordinarias y 7 extra**. El turno 3 que arranca el
domingo 22:00 abre la semana nueva igual que antes (control: 42 + 6 en ambos casos).

Sobre agosto 2026 (datos del 11-09) el impacto es **cero**: los únicos turnos programados en domingo
(`T_NORMAL3`, `T3_AGO`) arrancan justo a las 22:00, y `T_EXTRAS` es todo sobretiempo, que no entra a
la bolsa. La regla protege los turnos que se programen a futuro. Día y hora son parámetros
(`cSemIni` + `cSemHora`).

**Segmentación temporal (`atomize`).** Parte un intervalo `[a,b)` en tramos atómicos cortando en cada
medianoche, en el inicio/fin de la franja nocturna, y en cualquier frontera adicional que se le pase
(típicamente el inicio/fin de la jornada programada, para separar "dentro de turno" de "fuera de
turno"). El invariante I-01 (suma de tramos = tiempo trabajado) se verifica contra esto en cada sesión
de pruebas.

**Perfil laboral (ROTATIVO vs ADMINISTRATIVO, B-06).** Se infiere por el prefijo del código de turno
(`cfg.adminPref`, default `T_ADM`): si todos los turnos de un empleado en el ciclo empiezan con ese
prefijo, es ADMINISTRATIVO (D-23, cálculo diario contra jornada programada); si no, es ROTATIVO
(D-17/D-18, umbral semanal). Es una heurística, no un dato del maestro — por eso existe el override
manual por empleado (`localStorage.mb_perfiles`, en la pestaña Detalle), que levanta la advertencia
B-06 cuando se usa. **Decisión del usuario (sept-2026): se queda con el prefijo.**

*Alternativas evaluadas contra datos reales y descartadas — no volver a proponerlas sin datos nuevos:*

- **"Los administrativos no rotan de turno durante el mes."** Dirección correcta pero el converso es
  falso, y ahí está la trampa: de 1.036 empleados con turno en agosto, 142 no rotan, pero solo 80 son
  T_ADM1. Los otros **62 son de planta** con un único turno ese mes (22 en T_NORMAL1, 18 en
  T_NORMAL3, 11 en T_NORMAL2, y sueltos en T1/T2/T3_AGO, TP, T_FESTIVO1/2). Clasificarlos como
  administrativos les quitaría el umbral semanal — y los 18 de T_NORMAL3 están en el turno de 50 h,
  así que **perderían 8 h extra por semana cada uno.**
- **Por cargo (lo que pide B-06).** Es la señal más limpia de las tres: 78 cargos distintos con turno
  en agosto, de los cuales solo 11 son ambiguos, y casi toda la ambigüedad son casos sueltos contra
  decenas (`OPERARIA AREA FARMACEUTICA`: 442 en planta contra 1 en T_ADM). Queda como el camino
  natural si algún día se quiere resolver B-06 de verdad, pero requiere que RRHH clasifique los 78
  cargos una vez. El nombre del cargo ya se lee bien desde el fix de columnas duplicadas.

---

**Adopción (pestaña `cob`, antes «Cobertura y calidad»; en los dos archivos).** Dos porcentajes por persona,
departamento y alcance, **prorrateados por la vigencia de cada persona**: los días antes de su ingreso real
(las fechas de ingreso masivas no cuentan como límite) y después de `vigFin` no entran al denominador, así que
quien entró o se fue a mitad de ciclo no queda penalizado.

- **Turno cargado** = días con turno asignado / **días vigentes** (el denominador va en el rótulo).
- **Marcó cuando tenía jornada** = (jornadas programadas − faltas) / jornadas programadas, donde «marcó» se decide
  **por jornada** (`r.marcas` de la fila de esa jornada; A-18 = turno y ninguna marca), no por fecha de calendario.
- La calidad de lo marcado **ya no vive aquí**: está en Calidad de marcación (una sola definición). Se quitaron
  del Excel las columnas de calidad de Adopción.
- Los días perdidos de asignación son `vig − asig`, no `sinasig`: a `sinasig` le faltan los días en que la
  persona marcó sin tener turno.

**Navegación de lo general al detalle.** Alcance → departamento → persona → día → Detalle. El nivel se deriva del
estado: `COB_EMP` (persona abierta) o si no `COB_DEP` (departamento abierto con un clic) o el **único departamento
que queda en el alcance** (`cobCalc`) o si no todo el alcance. La tabla del medio cambia según el nivel (cinco
columnas), y una ruta (`#cobRuta`) permite subir. **La matriz día por día solo aparece con un departamento (o una
persona) abierto**: a nivel alcance son miles de filas que nadie lee. Se ordena por **días perdidos**, no por
porcentaje (clic en una tarjeta o en el encabezado ordena por esa métrica). Cada indicador dice cuántas unidades
concentran el 80% del problema (`cobConcentra`). Al abrir un día en Detalle aparece `#btnDetVolver`.

Cada celda de la matriz tiene un estado (`ok`, `dud`, `falta`, `sinturno`, `sinasig`, `desc`, `fuera`) calculado por
`estadoCob()`. Exporta a Excel dos hojas (por persona y por departamento con fila TOTAL) precedidas por la hoja
«Alcance». **`renderCobertura(rows)` (el aviso del KPI) ya no existe**; el aviso de cobertura de datos es `#cobAviso`.

**`activoEnCiclo()` respeta la vigencia (sept-2026).** Antes miraba si había un turno asignado en el
ciclo sin recortarlo a ingreso/`vigFin`. Como en BioTime nadie le quita la asignación de turno a quien
renuncia, en agosto 2026 entraban **14 retirados de julio con 0 marcaciones y 0 días vigentes**: filas
vacías en Asistencia y en Cobertura. Ahora el rango se recorta a la vigencia de la persona antes de
buscar marcaciones o turnos. **Nómina idéntica:** el Consolidado es igual byte a byte que el anterior
(132.218,5 ordinarias y 14.066,5 extra en agosto); el universo pasa de 1.107 a 1.093 empleados.

**Resumen de asistencia por empleado (pestaña Asistencia, conmutador `#asisVista`).** La pestaña
tiene dos vistas sobre los mismos filtros: el **calendario** día por día y el **resumen por
empleado**, que responde "¿cuánto marcó contra cuánto debía?" y "¿hace cuánto no aparece?":
marcaciones del rango, `días que marcó / días programados`, % de asistencia, días sin asistir, días
que marcó sin turno, última marcación y **días hábiles sin marcar** hasta hoy. Los días hábiles
descuentan festivos y van de lunes a sábado para los rotativos y de lunes a viernes para los
administrativos (`habilesEntre`), porque el mismo silencio pesa distinto según el perfil. Se ordena
por quien lleva más días sin marcar —lo accionable— y **pantalla y Excel salen de la misma función**
(`asisResumenFilas`), para que no puedan divergir. Clic en una fila abre a esa persona en el Detalle,
en su última marcación, con el botón de volver.

El resumen tiene **selector de columnas** (botón *Columnas* → `#dlgColsAs`, persistido en
`localStorage.mb_colsAsis`, aplicado por CSS desde `#colAsisStyle`). El código nunca se puede ocultar:
identifica la fila. Ocultar columnas **no afecta el Excel**, que sale completo — igual que en Detalle.

**El vínculo es obligatorio para leer este reporte.** Un retirado hace meses no marca, y eso no es
ausentismo: es alguien que ya no está. Por eso hay columna `Vínculo` (`tagVinculo`), etiqueta de
retirado también en el calendario, y filtro `#fVincAs` (activos / retirados / los dos). En agosto 2026
el reporte trae 1.093 personas: 1.022 activas y 71 retiradas.

**Estado de asistencia con semáforo (`estadoAsis`), y el bug que lo motivó.** El usuario detectó que
el resumen medía el silencio **contra la fecha de hoy**, no contra el fin del rango consultado:
mirando agosto en septiembre, todo el mundo arrastraba las tres semanas transcurridas desde el corte
y **1.086 de 1.093 personas salían en rojo**. Ahora se mide contra `min(cfg.fin, hoy)` —el fin del
rango, y nunca contra días que todavía no pasaron—. Sobre agosto 2026 el reporte pasa de 1.086
alarmas a **24 personas que de verdad hay que mirar**: 984 al día, 14 con 1-2 días, 6 a revisar, 11 en
alerta y 7 sin marcar en todo el rango.

Cada persona recibe un estado, y la distinción es el punto entero del reporte:

| Estado | Cuándo | Color |
|---|---|---|
| `Retirado` | ya no está: su período laborado termina en su última marcación | gris, **nunca es alarma** |
| `Sin turno` | no tenía jornada programada ni marcaciones: no hay asistencia que exigir | gris |
| `Al día` | marcó hasta el cierre del rango | verde |
| `N días sin venir` | menos de `cfg.ausAviso` días hábiles | azul |
| `Revisar · N días` | entre `ausAviso` y `ausGrave` | ámbar |
| `Alerta · N días` | `ausGrave` o más | rojo |
| `Sin marcar en el rango` | tenía jornada programada y ningún día contó como asistencia | rojo |

Los dos umbrales son parámetros (`cAusAviso` default 3, `cAusGrave` default 6), no constantes. El
tooltip de los estados de alarma dice explícitamente que **puede ser incapacidad, calamidad o permiso**:
la herramienta avisa, no juzga.

**Resumen de lo cargado en el encabezado (`#hdrCarga`), y por qué existe.** El usuario vio 13
personas ACTIVAS, con turno y sin marcar nunca, y preguntó si no estaban renunciadas. En los datos que
había aquí, **12 de las 13 sí figuran en el archivo de Renuncia** (retiros de julio). La primera
hipótesis —que no había cargado el archivo— **era falsa**: él lo había cargado (480 filas). Y el motor
sí marca `RETIRADO` aunque la persona esté en el maestro y en Renuncia a la vez (`buildModel`: el
maestro manda para los datos personales, la renuncia aporta el retiro). O sea que la explicación
queda en el archivo concreto de esa corrida, y **la herramienta no daba forma de saberlo**.

Por eso el encabezado muestra ahora, siempre y también en modo reportes: filas de cada archivo
cargado, aviso ámbar si **falta** el de Renuncias, aviso rojo si hay **filas de Renuncia sin id
legible**, y después de calcular, **cuántos retirados reconoció el motor**. Con eso se contesta en un
vistazo si una persona está o no en el archivo de esa corrida. Además, el estado
`Sin marcar en el rango` dice en su tooltip que esa persona **no figura en el archivo de Renuncias
cargado**.

*Hallazgo del propio diagnóstico:* de las 483 filas de Renuncia del archivo de referencia, **una no se
puede leer**: trae `"1 "` como empleado y el literal `"Departamento"` como departamento — una cabecera
que se coló como dato, igual que en `Centro de costos`. Son 482 renuncias reales. Antes esa fila se
ignoraba en silencio.

**BUG REAL encontrado así (sept-2026): `readSheet()` perdía TODO el archivo de Renuncia.**
Las exportaciones de BioTime traen una **fila de título** antes del encabezado (`Renuncia`,
`Empleado`, `Horario`…). La detección de encabezado buscaba `empleado id`, `employee id` o
`código`, y **la llave del archivo de Renuncia se llama solo `Empleado`**: no coincidía con ningún
patrón, así que se tomaba el título como encabezado y las 480 filas quedaban sin ninguna columna
reconocible. Efecto: **cero retirados, todos los que ya salieron reaparecen como ACTIVOS con turno y
sin marcar**, y 2.954 excepciones bloqueantes de más. El aviso nuevo del encabezado fue el que lo
delató: *"Renuncias: 480 (480 sin id legible) · retirados: 0"*.

Corregido con dos reglas: se acepta también `^empleado$` como llave, y **una fila de título nunca
puede ser encabezado porque trae una sola celda** (sin esa segunda condición se rompía el maestro,
cuyo título dice literalmente "Empleado"). Si ningún patrón coincide, se usa la primera fila con dos
o más celdas con texto. Con los archivos del 2026-09-22: 478 retirados reconocidos, y los casos que
el usuario reportó (8977, 9087) salen del reporte porque su vigencia terminó antes del rango,
mientras 8924 aparece correctamente como `Retirado`.

> **La lección de método, que es la más importante:** este bug vivió oculto porque **las pruebas
> alimentaban el motor con JSON ya parseado**, saltándose `readSheet()` por completo. La capa de
> parseo nunca se ejecutó en una prueba. Desde ahora, al tocar parseo hay que construir el `aoa`
> **con la fila de título incluida** y llamar `readSheet()` de verdad, apilando un `XLSX` falso:
> `global.XLSX = {read:()=>({SheetNames:['s'],Sheets:{s:{}}}), utils:{sheet_to_json:()=>aoa}}`.

**Lo que ya estaba bien y se verificó al revisar esto:** 57 retirados tienen turno programado dentro
del ciclo (en BioTime nadie les quita la asignación al irse) y suman 122 días-persona de turno
posteriores a su vigencia; el motor **no cuenta ni uno solo como ausencia**, porque `vigFin` ya corta
(A-16). El retirado tampoco acumula silencio: su reloj se detiene en `vigFin`, no en el fin del rango.

*Caso encontrado de paso, que no se había considerado:* alguien puede tener una marcación en el rango
y aun así no tener ni un día de asistencia — la marca fue el **cierre de una jornada que empezó el día
anterior**, o quedó fuera de la tolerancia del turno. Es el empleado 8709. Por eso el estado se llama
`Sin marcar en el rango` y no "nunca marcó", y el tooltip lo explica.

**Las DOS calidades de marcación (sept-2026), con dueños distintos.** El usuario lo planteó así:
*"la calidad ideal se basa en cruzar el turno asignado contra si lo cumplió según las marcaciones; y
está la otra, donde el empleado marcó bien pero infortunadamente no se le cargó el turno"*. Antes
había un solo número (`limpio / días`) que mezclaba las dos cosas y no dejaba actuar. Ahora se
calculan por **empleado, departamento y empresa**:

- **`calidadTurno` — "Cumplió su turno"** = `okTurno / conTurno`. Denominador: los días con turno
  asignado. Numerador: los días en que marcó completo y sin que el motor tuviera que interpretar.
  Los días interpretados, los que no se pudieron calcular y las ausencias restan. **Es del empleado y
  su jefe.**
- **`calidadProg` — "Tenía turno cargado"** = `(conTurno − sinMarcaTurno) / diasVino`. De los días en
  que la persona **sí vino y marcó**, en cuántos había turno cargado. Lo que falta aquí no es culpa de
  quien marca: **es programación que no se cargó en BioTime.**

Sobre los archivos del 2026-09-22 (01-ago a 22-sep): **74,2% cumplió su turno** (26.791 de 36.108
días con turno; 6.286 interpretados y 3.031 sin marcar) y **91,6% tenía turno cargado** (3.039 días
trabajados sin turno). La calidad global vieja (73,5%) se conserva como columna para no perder la
comparación histórica.

> **Trampa real al implementarlo: `r.W` NO está en todas las filas.** Se asigna recién en el
> emparejamiento (`row.W = W`), así que un día con turno y **cero marcaciones** (A-18) o un día
> bloqueado sale antes por `return` y llega sin `W`. Contar "días con turno" por `r.W` dejaba las
> 3.031 ausencias fuera del denominador y la calidad salía inflada (79,8% en vez de 74,2%). El turno
> asignado se lee de **`r.turno`**, que se estampa siempre. La misma regla vale en
> `calidadDeEmpleado()`.

**Detalle por empleado y tabla por persona.** *(Reemplazado en nov-2026: ver «Resumen del ciclo, Adopción y Calidad».)*
La pestaña muestra solo las **15 personas con más días interpretados** (`#tQEmp`), cada una con enlace al Detalle en su
primer día interpretado (`P.diaDud`); la lista completa de personas sigue en el Excel (`aoaCalidadEmp`). En el
encabezado del **Detalle** siguen las dos tarjetas «Cumplió su turno» y «Tenía turno cargado» (`calidadDeEmpleado`).

**Búsqueda de empleados (`coincideEmp`).** El nombre se guarda como `APELLIDOS NOMBRES`, así que
comparar la frase completa hacía fallar "juan perez" contra "PEREZ JUAN" — el usuario lo reportó como
"no deja buscar por apellido". Ahora se compara **por palabras sueltas, en cualquier orden y sin
tildes**, contra el código y el nombre. Lo usan Consolidado, Asistencia, el filtro Alcance y Excepciones.

**Los `.xlsx` NO pueden llevar color: es un límite de la librería, no una omisión.** La versión libre
de SheetJS (0.18.5, la que carga el HTML) escribe datos y ancho de columna, nunca formato de celda;
el estilo es de la versión paga. Por eso existe `guardarXLS()`, que genera un **HTML con extensión
`.xls`** que Excel abre con los mismos colores de la pantalla. Excel avisa que el formato no coincide
con la extensión; se acepta y abre normal, y desde ahí se puede guardar como `.xlsx`. Está probado
solo en la pestaña Asistencia (botón *Exportar con colores*, exporta la vista activa): **el usuario lo
está evaluando** antes de decidir si se extiende a los demás reportes o se descarta. No propagarlo
hasta que lo confirme.

---

## Resumen del ciclo, Adopción y Calidad de marcación — la consolidación (nov-2026)

**Por qué.** La auditoría de nov-2026 contó **cuatro pestañas (Indicadores, KPI, Calidad, Cobertura), unos 30 bloques y 7 gráficos**,
con el mismo hecho contado con tres números («turno sin marca»: 1.475 / 1.483 / 1.411), tres nombres para la calidad y dos
definiciones de «turno cargado» (81,2% y 97,1%). Pedido del usuario: *algo completo pero sencillo para decidir*, pocos gráficos y
claros, y poder **limitar los indicadores a ciertos departamentos o personas** (Gerencia General no tiene turno individual, así que
todas sus horas salen como extra y distorsionan). Quedan **tres pestañas, cada una con una pregunta**, y el KPI se retiró.
Todo en horas y personas: la herramienta no tiene salarios.

**Resumen del ciclo (`ind`)** — ¿dónde está el tiempo que se paga y a cuántas personas toca? Sale de `RESULT.byEmp` recortado al alcance;
`computeInd(R, {depto})` es pura. De arriba abajo:

- Línea de **salud de los datos**: % de las horas acreditadas que descansa en días interpretados (la misma cifra de Calidad).
- Cuatro **tarjetas** (extras, recargos, pendientes, días sin marcar), cada una con *«N de M personas»*; **sirven de selector** del gráfico principal.
- **Gráfico principal**: barras por departamento (o por persona al abrir uno) de la métrica elegida, **Total / Por persona**, con
  «horas · personas» en cada barra. Un solo color; **rojo solo si la tasa de esa unidad pasa `IND_UMBRAL.rojoVeces` (2) veces el
  promedio del alcance** (con un mínimo de horas pagadas o de días con turno). Los recargos nunca se pintan en rojo: son estructurales.
  Con 1,5 veces casi todas las barras salían rojas y el rojo dejaba de decir algo. La tabla de calor concepto × departamento queda
  dentro de «Ver todas las horas por concepto y departamento».
- **Dónde mirar primero**: unidades con más extras **y** más días sin marcar **por persona** que la mediana del alcance (sustituye al
  gráfico de puntos, que no se entendía en 3 segundos). Es una pista, no un diagnóstico.
- **Concentración (Pareto)** de las extras: «N de M personas suman el 80%».
- **De cada 100 h pagadas**: UNA barra apilada que es una partición exacta (ordinarias sin recargo + ordinarias con recargo + extras;
  el recargo está dentro de las ordinarias). Las **pendientes van aparte, debajo, y no se apilan**: están dentro de las ordinarias.
- **Día de la semana**: un solo gráfico con selector (extras / días sin marcar).
- Cada gráfico tiene su tabla gemela (`indTabla`); eje con escala redonda (`indEscala`).

**Adopción (`cob`)** — ¿tiene turno cargado? y ¿marcó cuando tenía jornada? (ver arriba, «Adopción»). **Calidad de marcación (`cal2`)** —
¿qué tan bien se marca? Dos números grandes: **Calidad de marcación** = días con marcación completa e inequívoca / **días con marcación**
(`calidadMarca = limpio / (dias − sinMarca)`), y **horas apoyadas en días interpretados**; una tabla por departamento de cinco columnas
(clic abre sus personas), las 15 personas con más días interpretados y la tarjeta «Tiempo fuera del turno». Se quitaron de pantalla el
embudo, las cajas de «dueños» y la tabla de 400 filas (todo sigue en el Excel). **Calidad = cómo marcó; Adopción = si había turno cargado:
dos preguntas con dueños distintos que no se mezclan.** «Cumplió su turno» y «Tenía turno cargado» siguen en el Detalle de cada persona.

**El filtro Alcance (una sola barra para las tres pestañas).** Estado `ALC` (+ `KPI_EXCL` para las exclusiones). Filtros, todos con Y:
compañía; departamentos con modo **«solo estos»** (`ALC.depIn`) o **«todos menos estos»** (`KPI_EXCL`, **persistido en `mb_kpi_excl`**, así que lo
que estaba configurado en el KPI no se pierde; al arrancar con exclusiones guardadas el modo es «todos menos estos»); personas con chips
(buscador con `coincideEmp`; modo «solo estas» o «excluir estas»); perfil; vínculo; y el interruptor **«Ocultar personas sin turno asignado»**.
`alcanceR(R)` devuelve un R con la misma forma pero solo con las personas del alcance, así que **`computeCalidad`, `computeCobertura` y
`computeInd` no cambian: solo reciben un R recortado**. Pantalla y Excel salen de las mismas funciones, y **cada Excel lleva primero la hoja
«Alcance»**. El resumen dice *«Alcance: 22 de 23 departamentos · 1.066 de 1.074 personas»* y la nota *«N personas sin turno asignado: todas sus
horas salen como extra»* (con botón «Ocultarlas»). La persona «sin turno» es la que no tiene **ni un día** con turno en el ciclo (`sinTurnoAsignado`).
Un cambio de alcance repinta solo la pestaña visible y deja las otras sucias (`ALC_SUCIO`); `showTab` las repinta al abrirlas. «Quitar filtros»
borra todo, también la exclusión guardada. Si el alcance deja un solo departamento, Resumen y Adopción abren directamente el nivel persona.

**Definiciones únicas (el cambio de cifras que hay que conocer).** Con los archivos del 2026-10-15, ciclo 11-sep a 10-oct (antes → después):

| Cifra | Antes | Después |
|---|---|---|
| Turno sin marca: KPI / Calidad / Resumen / Adopción | 1.475 / 1.483 / 1.483 / **1.411** | **1.483** en las tres pestañas (A-18, por jornada) |
| Días interpretados: Calidad / Adopción | 4.019 / 4.017 | 4.019 / 4.019 |
| Adopción · «Marcó cuando tenía jornada» | 93,64% | 93,32% (jornadas sin marcar 1.411 → 1.483) |
| Adopción · «marcó sin turno» (S) | 442 | 411 (una marca del cierre de un turno nocturno ya no cuenta como «marcó sin turno») |
| Calidad · % de calidad | 75,94% (sobre todos los días) y 76,06% «cumplió su turno» | **81,21%** (limpios / días con marcación) |
| «Turno cargado» | 81,23% (Adopción, sobre días vigentes) y 97,13% (Calidad, sobre días trabajados) | solo el primero, con el denominador en el rótulo |

La definición de «marcó» en Adopción pasó de *«hay una marca con esa fecha de calendario»* a *«la fila de esa jornada tiene marcas»*
(`estadoCob`: `!!(r && r.marcas)`): un turno nocturno cierra al día siguiente y mirar el calendario contaba como asistencia lo que no lo era.
**Nómina idéntica**: la huella (empleado × conceptos × ordinarias × extras × pendientes) es la misma antes y después, I-01/I-02/I-03 = 0.
**La pestaña Asistencia conserva su propia regla** (ventana del turno ± tolerancia, `computeAsistencia`: 1.475) porque mide otra cosa: el
silencio contra la fecha de corte. No se tocó.

**Qué pasó con lo exclusivo del KPI:** el filtro por tipo de incidencia → clic en las tarjetas o en los encabezados de Adopción ordena por
esa métrica; `KPI_EXCL` → parte del Alcance; el aviso de cobertura de datos → `#cobAviso` en Adopción; los PDF/Excel del KPI desaparecen
(los de las tres pestañas siguen). Las listas nominales de 988 y 400 filas quedan solo en el Excel.

**Reglas de dataviz aplicadas** (skill `dataviz`): un solo tono por gráfico, rojo solo sobre un umbral, énfasis en vez de categorías, sin doble
eje, marcas finas con extremo de 4 px, etiquetas directas, tabla gemela y `data-tip`/`<title>` en cada marca. **Lección de legibilidad:** el SVG
se escala al ancho de su tarjeta; con `viewBox` de 560 px en una tarjeta de 370 px el texto de 10,5 px queda en 6,6 px. Por eso las barras
usan `viewBox` de 720 y `max-width:900px`. **Barras negras del KPI (corregido antes):** `reporte-horas-rrhh.html` no definía `--cat-1..3`,
`--chart-grid` ni `--chart-axis`; un `fill="var(--cat-1)"` sin variable definida se pinta negro. Ahora los dos archivos tienen el mismo bloque `:root`.

**Cómo se validó:** las pruebas de `scripts/pruebas_motor/` (la nueva `prueba_alcance.js` cubre la semántica de cada filtro, la persistencia,
las exportaciones y que los dos archivos pintan igual; `prueba_indicadores.js` se reescribió para el Resumen), datos reales (huella de
nómina idéntica, las tres pestañas con 1.074 personas y con cada filtro, exportaciones rectangulares) y revisión en Chrome con datos
anonimizados (ids 50001+). Los HTML previos a la consolidación están en `informes/respaldo-previo-consolidacion/`.

### Consolidado: filtro por cargo y columnas visibles (nov-2026)

Pedido del usuario: poder filtrar el Consolidado por **departamento y por cargo** y quitar o poner columnas.

- **Filtro de cargo (`#fCargo`).** Es **dependiente del departamento**: con un departamento elegido, la lista trae solo los cargos de ese
  departamento (`fillCargos()`, desde `fillFiltros()` y desde el `onchange` de `#fDepto`); la selección se conserva si sigue siendo válida
  y si no vuelve a «Todos los cargos». «(sin cargo)» (`SIN_CARGO`) aparece solo si hay alguien sin cargo en ese alcance. Entra en
  `filtroActivo`/`filtroHay`/`filtroSlug`/`consFiltrado` y **por eso lo respetan solos** `aoaCons`, la hoja de Excepciones y de Lactancia del
  «detalle completo» y el `.txt` de Sinergy (el mismo `consFiltrado()`; el aviso de «hay un filtro activo» ya existía). El departamento sigue
  siendo de **una sola** opción: el filtro de varios departamentos vive en la barra de **Alcance** de las otras pestañas, que no se tocó.
- **Columna Cargo** entre Departamento y Compañía. **El Excel no cambió:** `aoaCons` ya traía `CARGO` (entre `PERFIL` y `DEPARTAMENTO`); se
  verificó con datos reales que el Excel, el `.txt` de Sinergy, la hoja de Excepciones y la huella de nómina son idénticos a los de antes.
- **Selector de columnas (`#btnColsCons` → `#dlgColsCons`).** Mismo patrón de Detalle y Asistencia: se guarda la lista de **ocultas**
  (`localStorage.mb_colsCons`) y se aplica por CSS (`#colConsStyle`, `#tCons [data-col="k"]{display:none}`). Cada `th`/`td` de `renderCons`
  lleva `data-col` (`dep`, `cargo`, `cia`, `c-<código>`, `hrs`, `ord`, `pend`, `extra`, `perfil`, `lact`, `aut`, `estado`), también la fila
  «sin conceptos». `COD_EMPLEADO` y `NOMBRE` nunca se ocultan. Ocultar es **solo de pantalla**: el Excel sigue completo. El `colspan` de la fila
  vacía se calcula con las columnas reales (antes era un `16` fijo).
- **Pruebas:** `prueba_consolidado.js` (cascada, semántica Y con el buscador, `(sin cargo)`, pantalla = Excel = Sinergy, cada fila con las mismas
  celdas que el encabezado con y sin conceptos, selector y CSS, y una corrida con `#fCargo`/`#btnColsCons` renombrados para comprobar que nada
  revienta cuando el HTML no los declara); `prueba_identidad.js` suma las funciones y constantes nuevas.

### Rotación de personal (nov-2026)

Pedido del usuario: un indicador de **rotación** (quién entra y quién sale), que se pueda cortar por **compañía, departamento y cargo**, y
mirarlo **por meses**. Confirmó que los picos grandes de retiros de BioTime (abril y julio de 2026) son **limpiezas masivas del sistema, no
salidas reales**, y que BioTime se corregirá: su mitigación fue «verlo por meses y poder generar el reporte por meses». Añadió después que
el **tipo de retiro** (renuncia / despedido / otro) debe ser un **filtro de verdad**, combinable con todo lo demás.

- **Pestaña `rot` (`#tab-rot`) en los dos archivos**, después de *Calidad de marcación*. Es **independiente del ciclo**: tiene su propia ventana
  «Desde / Hasta» (por defecto los últimos 6 meses con datos, desde el primer retiro hasta el mes de la última marcación), porque un ciclo de
  30 días trae muy pocos retiros y la tasa sale con demasiado ruido. Lee **`MODEL.employees`** (todos los empleados y todos los
  renunciados, no solo los del ciclo) y no recalcula nada del motor: la nómina es idéntica (huella verificada con datos reales).
- **Fórmula:** `tasa mensual = retiros del mes ÷ plantilla promedio del mes`, con plantilla promedio = (inicio + fin) ÷ 2. En varios meses es
  Σ retiros ÷ Σ plantillas promedio. También se muestran ingresos, saldo neto y la mezcla renuncia / despedido / otro.
- **Plantilla (`rotMes`).** Presente al inicio del mes = `ini < d0` y (`ret` nulo o `ret ≥ d0`); al final = `ini ≤ d1` y (`ret` nulo o
  `ret > d1`). Se verificó contra un oráculo diario independiente en la prueba. `ini = null` significa «ya estaba antes de la ventana».
- **Aproximaciones (dichas en pantalla y en el Excel):** (1) **el archivo de Renuncias no trae fecha de ingreso**, así que quien se fue se
  asume presente desde antes de la ventana (sobrestima algo la plantilla de los primeros meses); no se puede medir antigüedad ni rotación
  temprana; (2) **la compañía del retirado no viene en ese archivo**: solo se recupera de `Branch` si marcó. En los datos reales casi
  todos los retiros quedan como **«Sin dato»** (`p.cia`), que se cuentan pero **no llevan tasa** (su plantilla no es comparable y saldría
  de 134% o 200%). Con una compañía elegida en Alcance esos retiros **no se cuentan** y la tasa de esa compañía sale subestimada; la
  pantalla lo avisa con el porcentaje de retiros sin compañía.
- **Fechas masivas (mitigación de las depuraciones).** Parámetro **`cRetMasivo`** (default 15, junto a `cIngMasivo`; `readConfig` lo acota a
  ≥ 1): una fecha de retiro compartida por **más** de ese número de personas es una **depuración masiva** (`retirosMasivos`,
  `marcarRetirosMasivos` → `MODEL.retiroMasivo`, que se llama en `runCalc`). Esas personas se sacan **del numerador y de la plantilla** y se
  dibujan aparte en gris con su cantidad. El interruptor **«Incluir depuraciones masivas»** las cuenta como retiros normales (y entonces sí
  están en la plantilla). Igual con las **fechas de ingreso masivas** (`cIngMasivo`, ya existía) e **«Incluir ingresos masivos»**.
- **Mes no confiable.** Cada mes se puede marcar con un clic (`mb_rot_meses` en `localStorage`): queda en gris y **sale de todos los
  promedios y tarjetas**. El **mes en curso** (el de la última marcación, si no está completo) también queda fuera automáticamente. La
  pantalla además avisa de un **pico** (un mes con ≥ 20 retiros y ≥ 3 veces la mediana) para que se decida.
- **Filtro de tipo de retiro (`ROT.tiposOff`, casillas `#rotTipos`).** Solo hay casillas para los tipos que existen en los datos
  (`rotTiposDisponibles`: *Renuncia (voluntaria)*, *Despedido*, *Otro / sin tipo*); por defecto todas marcadas. **Semántica, probada:**
  **el numerador cuenta solo los tipos marcados; la plantilla NO se reduce** (la tasa de «solo despedidos» es despedidos ÷ plantilla
  total: quien renunció igual salió de la plantilla). Con un solo tipo marcado el gráfico apilado muestra solo ese. También filtra la
  depuración aparte, el detalle y todas las hojas del Excel. La línea del **Alcance** lo muestra («Tipo de retiro: Despedido») solo en esta
  pestaña. `rotTipo()` clasifica por texto (`desped|despid|justa causa` → despedido; `renunci|voluntari|mutuo` → renuncia; lo demás, otro).
  **Ojo con el regex:** «Despedido» se escribe d-e-s-p-e-d-i-d-o; la primera versión buscaba solo `despid` y clasificaba a todos como «otro».
- **Alcance en Rotación.** Se usa la misma barra, pero con `alcanceOkEmp(m)` (nivel **persona**, sin el cálculo del ciclo): compañía,
  departamentos, **cargo** y personas. **Perfil, vínculo y «sin turno» no aplican** (el vínculo es lo que se mide): la pantalla lo dice.
  El **cargo** se agregó al Alcance (`ALC.cargo`, `#alcCargo`, dependiente de compañía/departamentos/personas vía `alcCargos()`) y recorta
  también las otras tres pestañas. En esta pestaña el resumen del Alcance cuenta a **toda la gente del modelo** y no ofrece «ocultar sin turno».
- **Pantalla:** tarjetas (retiros del período, rotación mensual promedio, % renuncia, ingresos, saldo neto), columnas apiladas por mes con
  el % de rotación encima (rojo si pasa 1,5 veces el promedio con ≥ 3 retiros), ranking por **tasa** (no por cantidad) por departamento o,
  si hay uno solo, por cargo (solo con plantilla promedio ≥ 5), y una tabla mes × compañía. Cada gráfico tiene su tabla gemela.
  Clic en un departamento del ranking abre sus cargos (`ROT.dep`).
- **Excel (`#expRot`):** `Alcance` (con tipos incluidos, ventana, interruptores, meses no confiables y la aproximación), `Por mes` (mes ×
  compañía), `Por departamento y mes`, `Por cargo y mes`, `Detalle de retiros` y `Fechas masivas`. **Solo ids, nunca nombres.**
- **Renuncias sigue siendo OPCIONAL.** Sin el archivo (y sin fechas de retiro en el maestro) la pestaña dice «Cargá el archivo de
  Renuncias» y oculta el cuerpo; el resto de las pestañas calcula igual.
- **Datos reales (archivos del 15-oct, solo agregados):** 501 retiros leídos, de 2025-11 a 2026-10. Fechas masivas detectadas con el
  límite 15: **2026-04-16 (139 personas), 2026-07-21 (110) y 2026-08-28 (17)**; ingresos masivos: 8 fechas (2026-04-08 con 446, 2026-09-07
  con 73…). Retiros por mes **sin** depuración: may 39 · jun 42 · **jul 69 (+110)** · **ago 41 (+17)** · sep 27 (18 renuncias, 9 despidos)
  · oct 1 (en curso); abr 8 (+139). Tasa mensual: may 3,4 % · jun 3,6 % · jul 6,2 % · ago 3,8 % · sep 2,5 %; promedio 3,9 %.
  Todavía **no es un buen indicador antes de marzo de 2026** (el archivo casi no trae retiros). Julio sigue alto aun sin la depuración
  del 21 (69): conviene que RRHH diga si el resto fue real.
- **Pruebas:** `prueba_rotacion.js` (cifras calculadas a mano mes a mes; oráculo diario; depuración, ingresos masivos, mes no
  confiable y mes en curso; el filtro de tipo con plantilla intacta; el caso combinado tipo + departamento + cargo + ventana +
  interruptor de depuración, por el modelo y por la interfaz; casos borde: alcance vacío, una sola persona, retiro anterior a la
  ventana, sin fecha, retiro anterior al ingreso, cargo ausente, sin Renuncias; exportación a Excel; los dos archivos pintan lo mismo).
  `prueba_alcance.js` y `prueba_identidad.js` se actualizaron (cargo, 4 pestañas sucias, constantes nuevas) y la comparación entre archivos
  ya no depende de la hora de generación (quitaba un fallo intermitente que existía desde antes).
- **Sin verificar:** la impresión a PDF (`#pdfRot`, mismo CSS de impresión que Resumen) y el ancho de 1280 px reales (solo se emuló).
  Los HTML previos a este cambio están en `informes/respaldo-previo-consolidacion/` (sufijo `_antes-de-rotacion`).

## Parámetros de configuración (`readConfig()`)

Los 20 campos que lee el motor, con su id de HTML. En `reporte-horas.html` viven todos en el panel "2
· Parámetros del cálculo", siempre visible. En `reporte-horas-rrhh.html`, `cIni`/`cFin` quedan visibles
en la barra principal y los otros 18 viven dentro del `<dialog id="dlgConfig">` (el botón de
engranaje), con un botón explícito "Aplicar y recalcular" en vez de recalcular en cada tecla.

| id | Parámetro | Condición del catálogo |
|---|---|---|
| `cIni` / `cFin` | Rango de fechas del ciclo | — |
| `cNocIni` / `cNocFin` | Franja nocturna (default 19:00–06:00) | C-02/C-03 |
| `cUmbral` | Umbral semanal rotativos en horas (default 42) | D-17/D-18 |
| `cEscPrimer` | Minutos después del fin de turno para la primera media hora (default 25) | D-10/D-11 |
| `cEscGracia` | Minutos de gracia antes de cada media hora siguiente (default 10) | D-12/D-13 |
| `cSemIni` | Día en que arranca la semana del umbral: domingo (default) o lunes | D-17 |
| `cSemHora` | Hora en que arranca esa semana (default 22:00, entrada del turno 3) | D-17 |
| `cAnclaje` | Anclaje de redondeo: relativo/absoluto | D-14 — **ver nota de gap abajo** |
| `cDoble` | Ventana de agrupación de marcaciones consecutivas, minutos | A-07 |
| `cImpar` | Resolución de marcaciones impares: sugerir / no resolver | A-04 |
| `cTolIni` / `cTolFin` | Tolerancia antes/después del turno para emparejar marcaciones, minutos | — |
| `cAdmin` | Prefijo de turnos administrativos | B-06/D-23 |
| `cCorte` | Fecha de corte 0253→0252 / 0259→0258 | H-06 |
| `cDesc` | Horas mínimas de descanso para descontarlo como almuerzo | B-10/B-12 |
| `cCafeAdm` | Café para turnos que no lo declaran, minutos (default 20). Solo se usa cuando el turno no trae un `Descanso` menor al umbral de almuerzo | B-12 |
| `cLactMin6` | Tope diario de lactancia de la etapa de 6 meses, minutos (default 60; nunca negativo: `readConfig` lo acota a 0). Lo decide RRHH, no el motor | E-04 / C-09 |
| `cLactMin24` | Tope diario de lactancia de la etapa de 24 meses, minutos (default 30; acotado a 0 como el anterior) | E-04 / C-09 |
| `cTransAviso` | Avisar (B-16) si un tránsito interior supera estos minutos (default 120). No lo topa: solo lo señala para revisión | B-16 |

El **rol de cada biométrico** no es un campo del formulario: se edita en el botón *Dispositivos* y se
guarda en `localStorage.mb_dispositivos`. Es la configuración que más pesa sobre las horas pendientes.
| `cDom` | ¿El domingo genera recargo dominical? | — |
| `cDescRec` | ¿El descanso propio (no dominical) genera recargo? | — |
| `cInfer` | ¿Inferir la marcación faltante desde el turno programado? | A-02/A-03 |
| `cTolPunt` | Tolerancia de puntualidad, minutos | — |
| `cAusAviso` | Días hábiles sin marcar para marcar **Revisar** en Asistencia (default 3) | — |
| `cAusGrave` | Días hábiles sin marcar para marcar **Alerta** (default 6) | — |
| `cIngMasivo` | Umbral de empleados para considerar una fecha de ingreso "masiva" | (hallazgo de esta sesión, no está en el catálogo original) |
| `cRetMasivo` | Una fecha de **retiro** compartida por más de este número de personas es una depuración masiva de BioTime (default 15; mínimo 1). Solo afecta a la pestaña Rotación | (Rotación, nov-2026) |
| `cAutor` | Política de extras sin autorización: calcular y marcar / exigir autorización | F-09 |
| `cRedon` | Redondeo por día y concepto, o solo al total del ciclo | D-10 a D-13 |

**Gap conocido y honesto: `cAnclaje` no hace nada.** El dropdown existe en la interfaz (D-14: ¿el
redondeo ancla contra el reloj absoluto o contra el fin de turno?) pero `cfg.anclaje` nunca se lee en
ninguna otra parte del motor — se guarda y no se usa. Con el modelo nuevo la pregunta de D-14 quedó
respondida de hecho: **la escalera se mide siempre desde el fin del turno asignado**, que es la opción
"relativo". El `<option>` de "reloj absoluto" no tiene implementación detrás. Lo honesto sería quitar
el dropdown; se dejó por ahora para no cambiar la interfaz sin pedirlo, pero **no confiar en él**.

---

## Estado de implementación frente al catálogo

Ver [CATALOGO-CONDICIONES.md](CATALOGO-CONDICIONES.md) para las 137 condiciones completas. Resumen
honesto de qué existe en código, verificado por búsqueda directa (no de memoria):

**Implementado con solidez:** bloques A (marcaciones — incluyendo A-04/A-07 con algoritmos propios
más estrictos que lo que pedía el catálogo original), B (jornada programada), C (segmentación), D.1-D.3
(clasificación y redondeo, salvo D-14 y el contador mensual D.4), e I (los 12 invariantes —
verificados en cada sesión de pruebas contra datos reales, siempre en cero violaciones).

**E-04/C-09 (lactancia) está implementada por archivo:** motor, validación y reportes completos y probados;
se activa cuando RRHH carga el archivo opcional de Lactancia (sin él, la salida es idéntica a la de
siempre). El tope diario quedó parametrizado por etapa (60 min en la de 6 meses, 30 en la de 24), que era
el "⚠️ definir duración" del catálogo original. Ver «Lactancia por archivo».

**Resuelto como decisión de diseño documentada, no como código pendiente:** D-05 a D-08 (la matriz de
concurrencia festivo × dentro/fuera de jornada) se implementó como **mutuamente excluyente por
minuto** — un minuto nocturno en festivo genera `0259` solo, nunca `0253+0220` — documentado en el
`<details>` "Matriz de clasificación aplicada" de la interfaz. Es una postura tomada para satisfacer el
invariante I-02, discutible por RRHH si la política real de la empresa acumula en vez de excluir.

**Genuinamente sin implementar — y no por descuido, sino porque son flujos de proceso humano o
integraciones externas que una herramienta local de un solo archivo no puede automatizar:**

- **Bloque D.4** (contador mensual ocasional/habitual de descanso trabajado, D-25 a D-27) — no existe
  ningún conteo mensual en el código.
- **E-06/E-07** (temporales Granservicios, practicantes SENA — aunque el filtro
  de compañía en Consolidado ayuda a *ver* la separación, no *decide* si entran al archivo), **E-09**
  (códigos de Sinergy duplicados — no hay ninguna pasada de detección de duplicados), **E-11**
  (convención colectiva) — ninguno tiene lógica propia.
- **Bloque F casi completo** (F-01, F-02, F-04 a F-08) — no hay bandeja de aprobación, no hay roles de
  jefe/RRHH, no hay estado "pendiente/aprobado/rechazado/ajustado" persistente. Lo único implementado
  del bloque F es **F-03/F-09**: el panel de autorización de horas extra por rango de fechas
  (AUTORIZADO/NO AUTORIZADO), que es una versión simplificada sin flujo de roles.
- **Bloque G completo** (período y cierre: G-01 a G-10) — no existe el concepto de "cerrar" un
  período, no hay `calculo_id`, no hay reapertura, no hay bloqueo de modificaciones. Cada corrida de
  `runCalc()` es independiente y no dialoga con ninguna corrida anterior. Cambiar cualquier parámetro
  y recalcular simplemente reemplaza el `RESULT` en memoria.
- **Bloque J completo** (conciliación contra `dailyHourReport` de BioTime) — esta herramienta no tiene
  ninguna conexión a la API de BioTime; solo lee las exportaciones Excel que el usuario carga a mano.
- **H-14/H-15** (registro de auditoría de exportaciones, comportamiento de Sinergy al recargar un
  archivo) — no hay bitácora de qué se exportó, cuándo, ni por quién; eso queda en quien administre los
  archivos generados fuera de la herramienta.
- **I-06/I-09/I-10** dependen de F y E-09 respectivamente, así que heredan esos mismos huecos: como no
  hay estado de aprobación, el archivo de Sinergy exporta *todo lo calculado*, no *todo lo aprobado*.

Si una tarea futura toca alguno de estos bloques, es trabajo nuevo genuino, no una corrección de algo
que ya debería funcionar.

---

## Ajustes, aprobaciones y cierre — diseño acordado, PENDIENTE (sept-2026)

Conversado con el usuario el 2026-09-22/23. **No hay nada de esto en código**; queda escrito para
cuando se decida hacerlo. El objetivo que él planteó: *poder ajustar horas, aprobar las extras y, solo
cuando quede bien "sin cometer injusticias ni errores", generar el archivo de Sinergy.*

### El principio que no se debe romper

Hoy el motor es una **función pura**: mismos Excel + mismos parámetros = mismo resultado. Es lo más
valioso del proyecto. Entonces una base de datos **no guarda las horas calculadas como verdad**:
guarda insumos, ajustes y una **foto congelada** al cerrar el período.

- **Se guarda:** marcaciones, turnos, horarios, empleados, parámetros del ciclo, ajustes, aprobaciones.
- **No se guarda como verdad:** las horas. Se recalculan; se congelan solo al cerrar.
- **Nada se edita encima.** Un ajuste es una fila nueva con autor, fecha y motivo, para poder decir
  "el motor calculó 4 h y Fulano dejó 3,5 el martes porque tal cosa".

### Modelo de datos (Postgres alcanza: 280.000 marcaciones en 6 meses no es volumen)

```
empleado       id_biotime, cedula, cod_siner, compania, cargo, depto, ingreso, retiro
importacion    id, tipo, archivo, hash, cargado_por, cargado_en     ← de dónde salió cada dato
marcacion      empleado, instante, dispositivo, importacion, origen (biotime|manual)
turno          codigo, dia_semana, entrada, salida, descanso, vigente_desde/hasta
horario        empleado, turno, desde, hasta
parametros     id, valores (jsonb: los ~20 del formulario), vigente_desde
calculo        id, periodo_ini, periodo_fin, parametros_id, version_motor,
               estado (borrador|cerrado), cerrado_por, cerrado_en
ajuste         id, calculo, empleado, fecha, concepto, tipo (agregar|quitar|reemplazar),
               horas, motivo, creado_por, creado_en,
               estado (pendiente|aprobado|rechazado), aprobado_por, aprobado_en
resultado      calculo, empleado, fecha, concepto, horas, origen (motor|ajuste)
               ← SOLO se escribe al cerrar: es la foto, es inmutable
exportacion    calculo, compania, archivo, hash, filas, generado_por, generado_en
```

Las tres decisiones que lo sostienen:

1. **`parametros_id` y `version_motor` viajan con cada cálculo.** Sin eso, agosto no se puede
   reproducir en diciembre (bloque G, hoy inexistente).
2. **`ajuste` es un libro contable, no una edición.** Total final = motor + ajustes aprobados. Un
   ajuste rechazado queda registrado igual.
3. **`exportacion` guarda el hash del archivo enviado**, y contesta "¿esto ya se subió?" sin adivinar
   (H-14).

### Qué se aprueba y qué NO

- **Las horas extra sí:** son trabajo suplementario, alguien las autorizó antes de que ocurrieran.
- **Los recargos NO** (0220, 0252, 0258): no son trabajo adicional, son una **sobretasa sobre tiempo
  ya trabajado** que la ley reconoce. Ponerlos a esperar aprobación es exponerse a que un olvido le
  quite a alguien una plata que le corresponde.
- **Las ordinarias tampoco:** ya están cubiertas por el salario.

### Ciclo de vida de una fila

```
calculado → pendiente → aprobado                 → sale al archivo
                      → ajustado (+motivo, quién) → sale con el valor nuevo
                      → rechazado (+motivo)       → NO sale, pero queda registrado
```

**Asimetría deliberada: quitarle horas a alguien exige motivo obligatorio; aprobar tal cual, no.**
El motivo es la defensa de la empresa y del empleado a la vez.

### Las dos puertas antes de exportar

1. **Puerta de datos:** no sale el archivo con excepciones bloqueantes sin resolver (A-02, A-17, A-04
   sin resolución). Eso no son horas aprobables: son horas **mal medidas**, y aprobar sobre un dato
   roto es la peor injusticia porque nadie se entera.
2. **Puerta de aprobación:** solo salen extras aprobadas o ajustadas. Al exportar, el período **se
   congela** con quién aprobó qué; reabrir es un `calculo_id` nuevo, no una edición del anterior.

**La bandeja debe mostrar las dos direcciones, no solo lo que le cuesta plata a la empresa.** El bug
del festivo por tramo es la prueba: 235 días habían *perdido* recargo festivo. Una revisión que solo
busca sobrepagos nunca encuentra ese error.

### Orden de implementación sugerido

1. **Sacar el motor a un módulo con pruebas doradas** (agosto 2026 como caso de referencia). Esto de
   paso **elimina la convención del motor duplicado**, que es el riesgo número uno del proyecto.
2. Base de datos e importación de los Excel, con la trazabilidad de arriba.
3. Ajustes y aprobaciones (bloque F).
4. Cierre de período y exportación desde la foto, no desde un recálculo en vivo.

**El motor no se reescribe:** es lo único ya validado contra datos reales.

### El límite de la herramienta actual

Una aprobación sin identidad no es una aprobación. Hoy todo vive en `localStorage` del navegador de
quien la usa: cualquiera puede aprobar como si fuera otro y se pierde al borrar la caché. Eso no se
arregla con más código en el HTML — es justo el punto donde se necesita backend con usuarios y roles
(jefe / RRHH / administrador). El usuario tiene pendiente elegir entre una **versión liviana** dentro
del HTML (fila por fila con motivo, firma por confianza) o **esperar a la app**.

---

## Exportación a Sinergy — diseño acordado, PENDIENTE de implementar (sept-2026)

**Este es el objetivo final de toda la herramienta.** Todo lo demás (Consolidado, Detalle, Resumen del ciclo,
Adopción, Calidad) existe para que RRHH valide el cálculo y dé el OK. Después de ese OK se exporta el TXT
plano que se sube a **Sinergy**, el programa que liquida la nómina. Junto con el TXT se entrega un
consolidado de las horas reportadas. El usuario confirmó que esto **se va a implementar**; esta sección
es el insumo para cuando lo pida.

### Antecedente: la herramienta anterior

El usuario ya había construido `Consolidado_SINERGY_offline_8.html` (una sola página, SheetJS
incrustado). Tomaba las horas **ya calculadas por BioTime** (una columna por concepto), las cruzaba
con un catálogo de empleados y generaba el TXT, un Excel para Sinergy y una tabla por empleado.
**Nunca salió a producción, porque el cálculo de horas de BioTime estaba mal**: no aplica la jornada
fija, la escalera, el café, la bolsa semanal ni el resto de lo que hace este motor. De esa herramienta
se reutilizan la **idea del catálogo** y los **chequeos previos a la exportación**, no el cálculo.

Lecciones de esa herramienta que siguen valiendo:

- Localizar las columnas del Excel **por nombre, nunca por posición**.
- Dos normalizaciones distintas. El **id de empleado** pierde los ceros a la izquierda (y un `.0`
  final), pero solo si es 100% numérico. El **código de concepto** nunca se toca: `0200` sigue siendo
  `0200` (H-05). Si el código viene como celda numérica de Excel, el cero ya se perdió en el origen.
- Una columna que llega **completamente vacía** apunta al sistema de origen, no al cruce: BioTime
  dejaba vacío un concepto cuyo nombre tenía un punto (`1.25%`).
- Si algo no cruza, **no lanzar un error duro**: mostrarlo y bloquear el botón con un mensaje concreto.

### Hallazgos verificados contra los datos reales

- **El código de BioTime NO es la cédula.** Los 1.064 `Empleado ID` tienen entre 1 y 4 dígitos. La
  cédula aparece en la columna `Código de nómina` del maestro, pero solo en 329 de 1.064 personas: no
  sirve como llave.
- **La llave correcta es el código de BioTime.** El catálogo de prueba (`DATOS EMPLEADOS.xlsx`:
  `CC | COD_EMPLEADO | COD_SINER | NOMBRE`) usa `COD_EMPLEADO` = `Empleado ID`. Cruce limpio: 0
  duplicados, 0 nombres que no coinciden con BioTime.
- **Ese catálogo era solo una PRUEBA parcial** (437 personas, todas de GRANSERVICIOS), no el
  definitivo. En esa muestra `COD_SINER` es la cédula seguida de un dígito; **no asumir que la regla
  valga para todos**: el código sale del catálogo, nunca se construye.
- **Hay DOS nóminas separadas: PLASTITECSA y GRANSERVICIOS.** Hoy `sinergyTxt()` genera un solo
  archivo con todos, salvo que alguien filtre la compañía a mano en el Consolidado; si se olvida, a
  Sinergy le llega un archivo mezclado. La compañía está bien resuelta para todos, incluidos los
  retirados (sale del `Branch` de las marcaciones; ver Fuentes de datos).

### Diferencias abiertas — resolver ANTES de tocar el código

1. **El orden de las columnas no coincide.** Ninguno de los dos está validado contra Sinergy, y
   H-03 a H-10 del catálogo no fijan posiciones.

   | | 1 | 2 | 3 | 4 | 5 | 6 | 7–12 |
   |---|---|---|---|---|---|---|---|
   | herramienta anterior | COD_SINER | concepto | `+` | **fecha inicio** | **horas** | fecha fin | vacías |
   | MOD_BIO hoy (`sinergyTxt`) | Empleado ID | concepto | `+` | **horas** | **fecha inicio** | fecha fin | vacías |

   **Se necesita un TXT que Sinergy haya aceptado de verdad** para decidir cuál es el correcto.
2. **Hoy se imprime el `Empleado ID` de BioTime, no el `COD_SINER`.** Tal como está, el archivo
   cargaría horas a códigos que Sinergy no conoce, o a otra persona.

### Diseño acordado

1. **Un archivo más, el catálogo Sinergy, opcional para calcular y obligatorio para exportar.** Mismo
   trato que Renuncia: sin él se calcula y se valida igual, solo el botón de Sinergy lo exige. Puede
   venir en uno o dos archivos (uno por nómina); cada persona se ubica por su compañía.
2. **Cruce por `Empleado ID` → `COD_SINER`.** La cédula queda solo como dato de control.
3. **Un archivo por compañía**: `FINAL_SINER_<COMPANIA>_<inicio>_<fin>.txt`, más su consolidado.
4. **Chequeos que bloquean la exportación** (un error aquí paga horas a otra persona):
   - alguien con conceptos de nómina y **sin `COD_SINER`** → lista y bloqueo;
   - **un `COD_SINER` en dos personas, o una persona con dos códigos** (E-09) → bloqueo;
   - **el nombre del catálogo no coincide con el de BioTime** → aviso: es la mejor alarma de un cruce
     mal hecho.
5. **El catálogo no se guarda en el navegador.** Lo mantiene nómina y cambia con cada ingreso: se carga
   en cada corrida, como los demás archivos.
6. **El rango del ciclo debe ser el corte de nómina**, que puede no coincidir con el mes calendario
   (por ejemplo, del 10 al 11). Aquí el rango sí filtra, porque se calcula desde las marcaciones; en la
   herramienta anterior era solo un rótulo porque BioTime ya entregaba el período cortado.

### Insumos que hay que pedir antes de implementar

- El **catálogo completo** con `COD_SINER` de las dos compañías.
- **Un TXT aceptado por Sinergy**, para cerrar el orden de las columnas.

### Oportunidad aparte (no es parte de esta tarea)

El export `Horas Trabajadas` de BioTime permite comparar su cálculo contra el nuestro, empleado por
empleado: eso es el **bloque J** (conciliación), que hoy no está implementado.

---

## Cómo validar un cambio (no hay navegador ni captura de pantalla en este entorno)

> **Novedad (lactancia): se puede probar la capa de parseo con la librería REAL.** `npm i xlsx@0.18.5`
> en un directorio de trabajo (la misma versión que carga el HTML) permite fabricar un `.xlsx` con
> `openpyxl` —fila de título, filas en blanco, fechas con formato `mm-dd-yy`/`dd/mm/yyyy`, serial en
> General— y pasarlo por `readSheet(buf, true)` de verdad. Así se descubrió que `raw:false` devuelve las
> fechas nativas de Excel como `1/15/26` (ilegibles); ver «Lactancia por archivo». Además, el mock de DOM
> puede **capturar el `DOMContentLoaded`** y ejecutarlo: así se prueba el cableado de botones y filtros
> contra `null` en la versión RRHH, que es donde se rompe lo que no se guardó.

El patrón usado en toda la sesión, y el que hay que seguir para cualquier cambio futuro al motor:

1. **Nunca confiar solo en el chequeo de sintaxis.** `new Function(src)` solo confirma que el
   JavaScript parsea — no que las funciones usadas estén definidas ni que la lógica sea correcta (ver
   la advertencia real de esta sesión, arriba).
2. **Ejecutar de verdad contra datos reales**, con un mock mínimo de DOM en Node:
   ```js
   global.document = { addEventListener(){}, querySelector:()=>mkEl(...), querySelectorAll:()=>[], createElement:()=>mkEl(...) };
   global.localStorage = { getItem:()=>null, setItem(){} };
   global.XLSX = {};
   const api = new Function(src + `;return { buildModel, compute, ... };`)();
   ```
   Extraer los archivos Excel reales a JSON con `openpyxl` (Python) una sola vez, y reusar ese JSON en
   las pruebas de Node — evita reabrir el `.xlsx` en cada corrida.
3. **Llamar cada función de render y export**, no solo `compute()` — un `ReferenceError` en
   `renderCal()` no aparece si solo se prueba `compute()`.
4. **Verificar los invariantes I-01/I-02/I-03 en cada corrida de prueba.** Ojo: desde el cambio al
   modelo de jornada fija, **I-01 compara contra el tiempo ACREDITADO (`creditMin`), no contra los
   minutos del reloj (`workMin`)** — son cosas distintas a propósito, y su diferencia es justamente
   `pendienteMin` más el redondeo de la escalera.
   ```js
   let i1=0,i2=0,i3=0;
   R.byEmp.forEach(x=>x.ciclo.forEach(r=>{
     const T=r.tramos||[];
     if(Math.abs(T.reduce((s,t)=>s+t.min,0)-(r.creditMin||0))>0.001) i1++;   // I-01
     if(T.some((t,i)=>T.some((u,j)=>j>i&&t.ini<u.fin&&u.ini<t.fin))) i2++;   // I-02/I-03
     if(Math.abs((r.ordMin||0)+(r.extraMin||0)-(r.creditMin||0))>0.001) i3++;
   }));
   // los tres deben dar 0 siempre
   ```
5. **Si el cambio toca el motor compartido, repetir los pasos 1 a 4 en los dos archivos.**
6. **El mock debe devolver `null` para los elementos que el archivo NO declara.** Un stub que
   devuelve un elemento falso para cualquier selector enmascara justo el fallo que se busca cuando
   una versión no tiene una pestaña. El patrón usado:
   ```js
   const existe = sel => { const id=/^#([\w-]+)/.exec(sel.trim());
     return id ? fuente.includes(`id="${id[1]}"`) : true; };
   querySelector: s => existe(s) ? mkEl(s) : null
   ```
7. Para cambios de interfaz que el usuario deba juzgar visualmente (un gráfico, un color, un layout),
   decirlo explícitamente: la verificación hecha fue lógica y estructural, no visual.

---

## Convenciones de trabajo con este proyecto

- **El archivo de Renuncia es OPCIONAL y debe seguir siéndolo.** `checkReady()` NO lo exige: quien no
  lo tenga calcula exactamente igual que antes. Verificado comparando la huella de salida completa
  (empleado × conceptos × ordinarias × extras × pendientes) contra el commit anterior: **idéntica en
  los dos archivos** cuando no se carga Renuncia. Si algún cambio futuro hace que el motor dependa de
  ese archivo, se rompe esta garantía.
- **El archivo de Lactancia también es OPCIONAL, no se persiste y se carga en cada corrida.**
  `checkReady()` no lo exige y no se guarda nada en `localStorage` (son datos personales y
  cambian cada mes). Sin archivo, la salida es idéntica byte a byte a la de antes: verificado con la
  huella completa y con todas las exportaciones en los dos archivos.
- **Nunca subir los `.xlsx`/`.xls` a git** — contienen datos personales reales de empleados (nombres,
  marcaciones, cargos). Ya están en `.gitignore`; si se agrega un nuevo tipo de exportación, agregar su
  patrón también.
- **Un commit por modificación revisable**, cuando se está reestructurando o recortando un archivo
  (como al crear la versión RRHH) — así un error se puede aislar y revertir sin perder el resto del
  trabajo. Mensajes de commit en formato convencional (`feat:`, `fix:`, `refactor:`, `chore:`), sin
  atribución de IA, en inglés para el mensaje técnico salvo que el usuario pida lo contrario.
- **Nunca inferir de memoria el estado del código.** Esta sesión encontró dos discrepancias reales
  entre lo que se asumía y lo que el código realmente hacía (`cfg.anclaje` sin uso, y el borrado
  accidental de `esc`/`fmt`/etc.) precisamente por confiar en el recuerdo de una edición anterior en
  vez de volver a grep-ear el archivo. Antes de documentar o modificar algo, verificar contra el
  archivo actual.
