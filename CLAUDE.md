# MOD_BIO — Reporte de Horas, Extras y Recargos

Herramientas locales de nómina para Plastitec / SIRH: calculan horas trabajadas, horas extra y
recargos a partir de exportaciones de BioTime, sin backend, sin base de datos, sin conexión a
internet salvo la librería de Excel (SheetJS, cargada desde `cdnjs.cloudflare.com`). Todo el cálculo
corre en el navegador del usuario, sobre los cinco archivos Excel que él mismo carga (cuatro
obligatorios más `Renuncia_*.xlsx`, que es opcional).

El diseño de negocio completo (137 condiciones, bloques A a J) está en
**[CATALOGO-CONDICIONES.md](CATALOGO-CONDICIONES.md)**. Ese documento es la intención original; este
archivo (`CLAUDE.md`) es el estado real de lo que existe en código, y la única fuente de verdad sobre
qué convención seguir al modificarlo.

## Archivos del proyecto

| Archivo | Qué es |
|---|---|
| `reporte-horas.html` | Herramienta completa: 7 pestañas (Consolidado, Detalle, Calendario, Excepciones, Asistencia, KPI Cumplimiento, Glosario). Para análisis, auditoría de datos y seguimiento del proceso de implementación. |
| `reporte-horas-rrhh.html` | Versión lite para RRHH: 5 pestañas (Consolidado, Detalle, Calendario, Asistencia, KPI Cumplimiento). Sin Excepciones ni Glosario. Parametrización avanzada detrás de un botón de engranaje (`⚙`) en vez de siempre visible. |
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
DATA, OVERRIDES, PERFILES, AUTOR, CONFIANZA, DISPOSITIVOS (estado global en localStorage)
autorFor, readSheet, pick, normId                       (parseo de Excel)
buildModel                                              (construye el modelo desde los Excel cargados)
marcarIngresosMasivos                                   (detección de fecha de ingreso masiva)
shiftFor, segmentFor                                    (turno vigente por fecha)
round05, dayType, classify, atomize                     (clasificación y redondeo)
escalera, quitarDescanso, tramosAcreditados             (jornada fija + escalera de sobretiempo)
clasificarHuecos, topeCafe                              (huecos por rol de dispositivo, B-12/B-16)
rolAuto, rolDisp, rolEfectivo, renderDisp, guardarDisp   (rol de cada biométrico)
esLactancia, topeLactancia                              (tiempo de lactancia pagado, E-04)
readConfig                                              (lee los parámetros del formulario)
limpiarMarcaciones                                      (dedupe A-06 + agrupación A-07)
compute                                                 (el motor de horas y conceptos, ~490 líneas)
celdaPendiente                                          (celda de horas no cumplidas)
tagRetiro                                               (marca de empleado retirado, A-16)
AS_LABEL, ASISTENCIA (global)                           (reporte de asistencia general)
computeAsistencia, asisFiltrado, renderAsistencia, aoaAsistencia
KPI_EXCL, KPI_EXCLUIDOS_ULTIMO                          (estado del KPI)
kpiCalcular, pct, kpiPorDepto, kpiFiltrarEmpleados      (KPI de cumplimiento)
barPath, fmtPct, fmtN, svgKpiChart, renderCobertura, renderKpi, aoaKpiDep, aoaKpiEmp
esTurnoExtra, pasoExtra                                 (turnos de solo extras, T-EXTRA)
activoEnCiclo                                           (universo del reporte segun el rango)
modo, irADetalle, marcarCol, aplicarCols, renderCols     (interfaz: modos, salto y columnas)
tipHTML, chip, initPop                                  (sistema de tooltips — ver nota abajo)
toast, conceptCols, renderMatriz
filtroActivo, filtroHay, filtroSlug, consFiltrado, fillFiltros
renderCons, celdaHora, celdaSemana, renderAutor, addAutor, renderDet, renderExc
DOW_CAL, renderCal
fillSelects, buscarEmp, showTab, save
aoaCons, aoaDet, aoaExc, aoaCal, sinergyTxt
checkReady, hook, runCalc
```

> **Asistencia y KPI pasaron a ser compartidos; Excepciones salió de RRHH (sept-2026).**
> Las funciones del KPI (`KPI_EXCL`, `KPI_EXCLUIDOS_ULTIMO`, `kpiCalcular`, `pct`, `kpiPorDepto`,
> `kpiFiltrarEmpleados`, `barPath`, `fmtPct`, `fmtN`, `svgKpiChart`, `renderCobertura`, `renderKpi`,
> `aoaKpiDep`, `aoaKpiEmp`) viven ahora en los DOS archivos. Solo `renderGlosario` sigue siendo
> exclusiva del archivo completo.
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
> `aoaAsistencia` viven ahora en los DOS archivos y entran en la lista de arriba. KPI y Glosario
> siguen siendo exclusivos del archivo completo.

### Funciones exclusivas de `reporte-horas.html` (NO existen en la versión RRHH, a propósito)

```
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
porque lo que viene después difiere entre archivos (el full sigue con el KPI) y eso da una diferencia
falsa.

**Ojo con `core.autocrlf=true`:** un `git checkout` deja el working copy en CRLF mientras el otro
archivo sigue en LF, y entonces ningún anclaje de texto coincide. El repo guarda LF; normalizar a LF
antes de parchear.

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
| `Reporte de Marcaciones_*.xlsx` | Marcaciones crudas del reloj biométrico | Employee ID, Fecha, Hora, Tipo de Marcación, Origen del registro, **Branch** |
| `Renuncia_*.xlsx` | **Opcional.** Personal que ya no está en la empresa | Empleado (id + nombre pegados), Departamento, Cargo, Tipo de renuncia, Fecha de retiro |

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

**Tiempo de lactancia pagado (E-04 / C-09, `esLactancia` + `topeLactancia`).** Mismo mecanismo del
café —minutos perdonados hasta un tope diario, en vez de horas pendientes— pero con dos diferencias
que importan:

- **Se identifica por el código del turno, no por la columna `Descanso`.** El turno se llamará
  `T_LACT*` y el prefijo es un parámetro (`cLactPref`, default `T_LACT`), igual que `cAdminPref`.
  **Esto no es capricho:** una lactancia de 60 minutos choca de frente con el umbral de almuerzo
  (`cfg.descMin`, también 60). Si el tope saliera de la columna `Descanso` como el del café,
  `quitarDescanso()` la trataría como almuerzo y **se la descontaría de la jornada fija** — es decir,
  le quitaría exactamente la hora que la ley le reconoce. Leerlo del código del turno evita esa
  colisión y no depende de cómo BioTime configure el descanso. Si el turno además declara un almuerzo
  real, ese se descuenta normal.
- **Es un derecho, no una obligación.** El usuario fue explícito: *"habrán mujeres que se tomen ese
  tiempo, habrán otras que no"*. El crédito está topado por los huecos que la persona
  **efectivamente** tomó (`Math.min(topeLact, huecos − café)`), así que quien no sale no recibe
  ningún crédito fantasma, y una llegada tarde **nunca** se perdona aunque el turno sea de lactancia.

Café y lactancia son topes **separados y acumulables** (20 + 60 = 80 min/día con los defaults), porque
son dos derechos distintos. Se imputa primero el café y el resto a lactancia, para que el reporte
muestre los dos conceptos por separado: tooltip de la celda `PEND.` y columna
`MIN LACTANCIA RECONOCIDO` en el Detalle. La novedad `E-04` marca solo los días donde de verdad se
reconoció lactancia.

**El código está en producción pero inerte hasta que exista el turno.** Con cero turnos `T_LACT*` en
los datos, la salida es idéntica al commit anterior — verificado sobre agosto 2026 en los dos
archivos. El comportamiento se validó con cinco casos sintéticos (turno `T_LACT1` 08:00–17:00,
almuerzo 12:00, jornada fija 480 min):

| caso | huecos | café | lactancia | pendiente |
|---|---|---|---|---|
| sale 80 min (café + lactancia completa) | 80 | 20 | 60 | **0** |
| no se toma la lactancia, trabaja completo | 0 | 0 | 0 | **0** |
| llega 60 min tarde, no sale en el turno | 0 | 0 | 0 | **60** |
| sale 120 min (excede el tope de 80) | 120 | 20 | 60 | **40** |
| control: mismas marcaciones, turno normal | 80 | 20 | **0** | **60** |

La última fila es la que prueba que el crédito solo aplica al turno de lactancia: mismas marcaciones,
turno normal, y conserva los 60 minutos de pendiente.

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
| `cCafeAdm` | Café para turnos que no lo declaran, minutos (default 20). Solo se usa cuando el turno no trae un `Descanso` menor al umbral de almuerzo | B-12 |
| `cLactPref` | Prefijo de los códigos de turno de lactancia (default `T_LACT`) | E-04 |
| `cLactMin` | Tiempo de lactancia reconocido por día, minutos (default 60). Va de 30 a 60 según el tiempo de gestación; lo decide RRHH, no el motor | E-04 / C-09 |
| `cTransAviso` | Avisar (B-16) si un tránsito interior supera estos minutos (default 120). No lo topa: solo lo señala para revisión | B-16 |

El **rol de cada biométrico** no es un campo del formulario: se edita en el botón *Dispositivos* y se
guarda en `localStorage.mb_dispositivos`. Es la configuración que más pesa sobre las horas pendientes.
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

**Implementado en esta sesión, pendiente solo de que exista el dato en BioTime:** **E-04/C-09**
(lactancia) tiene el motor completo y probado; se activa solo cuando aparezca un turno `T_LACT*`.
La duración quedó parametrizada (30 a 60 min) en vez de fijarse, que era el "⚠️ definir duración"
del catálogo original.

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
