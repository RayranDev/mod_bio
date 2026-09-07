# MOD_BIO — Reporte de Horas, Extras y Recargos

Herramientas locales de nómina para Plastitec / SIRH: calculan horas trabajadas, horas extra y
recargos a partir de exportaciones de BioTime, sin backend, sin base de datos, sin conexión a
internet salvo la librería de Excel (SheetJS, cargada desde `cdnjs.cloudflare.com`). Todo el cálculo
corre en el navegador del usuario, sobre los cuatro archivos Excel que él mismo carga.

El diseño de negocio completo (137 condiciones, bloques A a J) está en
**[CATALOGO-CONDICIONES.md](CATALOGO-CONDICIONES.md)**. Ese documento es la intención original; este
archivo (`CLAUDE.md`) es el estado real de lo que existe en código, y la única fuente de verdad sobre
qué convención seguir al modificarlo.

## Archivos del proyecto

| Archivo | Qué es |
|---|---|
| `reporte-horas.html` | Herramienta completa: 7 pestañas (Consolidado, Detalle, Calendario, Excepciones, Asistencia, KPI Cumplimiento, Glosario). Para análisis, auditoría de datos y seguimiento del proceso de implementación. |
| `reporte-horas-rrhh.html` | Versión lite para RRHH: 4 pestañas (Consolidado, Detalle, Calendario, Excepciones). Sin Asistencia/KPI/Glosario. Parametrización avanzada detrás de un botón de engranaje (`⚙`) en vez de siempre visible. |
| `CATALOGO-CONDICIONES.md` | Las 137 condiciones de diseño original, con sus códigos (A-01, D-14, I-03, etc.) usados como referencia cruzada en el código. |
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
DATA, OVERRIDES, PERFILES, AUTOR                        (estado global persistido en localStorage)
autorFor, readSheet, pick, normId                       (parseo de Excel)
buildModel                                              (construye el modelo desde los 4 Excel)
marcarIngresosMasivos                                   (detección de fecha de ingreso masiva)
shiftFor, segmentFor                                    (turno vigente por fecha)
round05, dayType, classify, atomize                     (clasificación y redondeo)
escalera, quitarDescanso, tramosAcreditados             (jornada fija + escalera de sobretiempo)
readConfig                                              (lee los parámetros del formulario)
limpiarMarcaciones                                      (dedupe A-06 + agrupación A-07)
compute                                                 (el motor de horas y conceptos, ~490 líneas)
celdaPendiente                                          (celda de horas no cumplidas)
tipHTML, chip, initPop                                  (sistema de tooltips — ver nota abajo)
toast, conceptCols, renderMatriz
filtroActivo, filtroHay, filtroSlug, consFiltrado, fillFiltros
renderCons, celdaHora, celdaSemana, renderAutor, addAutor, renderDet, renderExc
DOW_CAL, renderCal
fillSelects, buscarEmp, showTab, save
aoaCons, aoaDet, aoaExc, aoaCal, sinergyTxt
checkReady, hook, runCalc
```

### Funciones exclusivas de `reporte-horas.html` (NO existen en la versión RRHH, a propósito)

```
ASISTENCIA (global), KPI_EXCL, KPI_EXCLUIDOS_ULTIMO, AS_LABEL
computeAsistencia, asisFiltrado, renderAsistencia, aoaAsistencia
kpiCalcular, pct, kpiPorDepto, kpiFiltrarEmpleados, barPath, svgKpiChart,
  renderKpi, aoaKpiDep, aoaKpiEmp
renderGlosario
```

Si una tarea futura toca **solo** una de estas funciones (por ejemplo, un ajuste al gráfico de KPI),
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

**Lección aplicada de ahora en más: un chequeo de sintaxis nunca es suficiente para validar un cambio
al motor. Hay que ejecutar `buildModel()` → `compute()` → cada función de render/export contra datos
reales y comprobar que no lance excepciones**, además de los invariantes I-01/I-02/I-03 (ver sección
de validación más abajo).

---

## Fuentes de datos

Cuatro archivos Excel exportados desde BioTime/SIRH. Se cargan una vez por sesión (nunca se suben a
git — ver `.gitignore`). Nombres típicos (el prefijo/timestamp varía en cada exportación real):

| Archivo | Contenido | Columnas usadas |
|---|---|---|
| `Empleado_*.xlsx` | Maestro de empleados | Empleado ID, Nombres, Apellidos, Fecha de contratación, Departamento, Compañía, Cargo, Estado |
| `Turno_*.xlsx` | Catálogo de turnos | Código, Hora Entrada, Hora Salida, Dom..Sáb (día de semana), Descanso, **Descontar descansso en** (sic, con doble "s" — typo real de BioTime, ver abajo) |
| `Horario_*.xlsx` | Asignación de turno por empleado y rango de fechas | Empleado ID, Código, Fecha Inicial, Fecha Final |
| `Reporte de Marcaciones_*.xlsx` | Marcaciones crudas del reloj biométrico | Employee ID, Fecha, Hora, Tipo de Marcación, Origen del registro |

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
  datos, no evidencia de incumplimiento.** El KPI Cumplimiento (solo en `reporte-horas.html`) tiene un
  aviso automático para esto (`#kpiCobertura`, columnas "Con marca" / "Con turno").
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
  riesgo era que aparecieran en la lista de "peor cumplimiento" del KPI. Se resolvió con un campo de
  exclusión por departamento en la pestaña KPI (`#fExclDeptos`, persistido en
  `localStorage.mb_kpi_excl`), no filtrando estos ids a nivel de motor — si aparecen más cuentas de
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
- **Ventana de validación real acordada con el usuario: agosto 2026 en adelante.** El uso cuidadoso de
  BioTime empezó junio–julio 2026; los datos de marzo a mayo son ruido esperado de una implementación
  que recién arrancaba (turnos no cargados, marcaciones erráticas). No tratar esos meses como bugs a
  perseguir.

---

## Arquitectura del motor

Pipeline de una corrida (`runCalc()`):

```
buildModel()              → MODEL   { employees, shifts, sched, punches, orphan, ingresoMasivo }
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
como si lo hiciera"*. En agosto 2026 hay ~6.400 h pendientes en 10.187 días; el grueso son atrasos de
11 a 30 minutos, pero hay 735 días con más de 2 h.

**Un efecto de este modelo que conviene conocer:** alguien puede llegar 3 h tarde y quedarse 4 h
después del fin de turno; el sistema le acredita la jornada fija **y** las extras de la escalera, y
deja las 3 h en pendientes. Si algún día se quiere que no se paguen extras en días con pendientes,
eso es una regla nueva que hay que pedir — hoy no existe.

**Segmentación temporal (`atomize`).** Parte un intervalo `[a,b)` en tramos atómicos cortando en cada
medianoche, en el inicio/fin de la franja nocturna, y en cualquier frontera adicional que se le pase
(típicamente el inicio/fin de la jornada programada, para separar "dentro de turno" de "fuera de
turno"). El invariante I-01 (suma de tramos = tiempo trabajado) se verifica contra esto en cada sesión
de pruebas.

**Perfil laboral (ROTATIVO vs ADMINISTRATIVO, B-06).** Se infiere automáticamente por el prefijo del
código de turno (`cfg.adminPref`, default `T_ADM`): si todos los turnos de un empleado en el ciclo
empiezan con ese prefijo, es ADMINISTRATIVO (D-23, cálculo diario contra jornada programada); si no,
es ROTATIVO (D-17/D-18, umbral semanal). Esta inferencia es una heurística, no un dato real del
maestro de empleados (el campo "Cargo" existe pero no trae una columna de perfil) — por eso existe un
override manual persistido en `localStorage.mb_perfiles`, seleccionable en la pestaña Detalle, que
levanta la advertencia B-06 cuando se usa.

---

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
| `cAnclaje` | Anclaje de redondeo: relativo/absoluto | D-14 — **ver nota de gap abajo** |
| `cDoble` | Ventana de agrupación de marcaciones consecutivas, minutos | A-07 |
| `cImpar` | Resolución de marcaciones impares: sugerir / no resolver | A-04 |
| `cTolIni` / `cTolFin` | Tolerancia antes/después del turno para emparejar marcaciones, minutos | — |
| `cAdmin` | Prefijo de turnos administrativos | B-06/D-23 |
| `cCorte` | Fecha de corte 0253→0252 / 0259→0258 | H-06 |
| `cDesc` | Horas mínimas de descanso para descontarlo como almuerzo | B-10/B-12 |
| `cDom` | ¿El domingo genera recargo dominical? | — |
| `cDescRec` | ¿El descanso propio (no dominical) genera recargo? | — |
| `cInfer` | ¿Inferir la marcación faltante desde el turno programado? | A-02/A-03 |
| `cTolPunt` | Tolerancia de puntualidad, minutos | — |
| `cIngMasivo` | Umbral de empleados para considerar una fecha de ingreso "masiva" | (hallazgo de esta sesión, no está en el catálogo original) |
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

**Resuelto como decisión de diseño documentada, no como código pendiente:** D-05 a D-08 (la matriz de
concurrencia festivo × dentro/fuera de jornada) se implementó como **mutuamente excluyente por
minuto** — un minuto nocturno en festivo genera `0259` solo, nunca `0253+0220` — documentado en el
`<details>` "Matriz de clasificación aplicada" de la interfaz. Es una postura tomada para satisfacer el
invariante I-02, discutible por RRHH si la política real de la empresa acumula en vez de excluir.

**Genuinamente sin implementar — y no por descuido, sino porque son flujos de proceso humano o
integraciones externas que una herramienta local de un solo archivo no puede automatizar:**

- **Bloque D.4** (contador mensual ocasional/habitual de descanso trabajado, D-25 a D-27) — no existe
  ningún conteo mensual en el código.
- **E-04** (lactancia), **E-06/E-07** (temporales Granservicios, practicantes SENA — aunque el filtro
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

## Cómo validar un cambio (no hay navegador ni captura de pantalla en este entorno)

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
6. Para cambios de interfaz que el usuario deba juzgar visualmente (un gráfico, un color, un layout),
   decirlo explícitamente: la verificación hecha fue lógica y estructural, no visual.

---

## Convenciones de trabajo con este proyecto

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
