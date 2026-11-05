# CATÁLOGO DE CONDICIONES · Reporte de horas y conceptos

### Alcance acotado: **extras y recargos**, más los reportes de asistencia, calidad y cumplimiento que se construyeron alrededor
### SIRH Plastitec · v2.1 — 2026-11-04

Este catálogo documentaba originalmente (v1.0) solo el **diseño de intención** entregado por el
usuario al inicio del proyecto. Esta versión (v2.0) es distinta en su función: es el **catálogo de
condiciones vigente**, verificado línea por línea contra `reporte-horas.html` (3.845 líneas) y
`reporte-horas-rrhh.html` (3.851 líneas) el 2026-09-18. La v2.1 (2026-11-04) actualiza la lactancia
(C-09, E-04, la nueva E-15 y los parámetros `cLactMin6`/`cLactMin24`), contrastada contra las
versiones actuales de los archivos (4.946 y 4.951 líneas). Cada condición indica su **estado real de
implementación** y, cuando aplica, en qué difiere de la intención original — que se conserva citada
como "Diseño original" para no perder la historia de por qué existe cada regla.

`CLAUDE.md` sigue siendo la fuente sobre el **razonamiento de ingeniería** (por qué se tomó cada
decisión, qué se probó y se descartó, qué incidentes reales ocurrieron). Este archivo es la fuente
sobre **qué condición existe, con qué código, y qué hace exactamente hoy el motor**. Los códigos
(`A-01`, `D-14`, `I-03`, `T-EXTRA`, `CONFIANZA`, etc.) son la referencia cruzada real: aparecen
literalmente en el código fuente (el diccionario `NOV`, comentarios, columnas de exportación,
tooltips) de ambos archivos HTML.

**No se edita este archivo para "marcar como resuelto" a mano.** Cuando el código cambie, se vuelve a
verificar contra el código — nunca se actualiza un estado de memoria.

---

## CÓMO LEER ESTE CATÁLOGO

**Estado de implementación** (una sola etiqueta por condición):

| Estado | Significa |
|---|---|
| **Implementada** | El código hace exactamente lo que describe la fila, verificado contra una función y/o parámetro concretos. |
| **Parcial** | Existe una parte real del comportamiento, pero le falta una pieza que el diseño original exigía (normalmente: falta persistir una aprobación humana). |
| **Reemplazada** | El código resuelve el mismo problema con un mecanismo distinto al que describía el diseño original. Se explica la diferencia. |
| **Decisión de diseño** | Se decidió conscientemente no automatizar esto porque excede lo que una herramienta local de un archivo puede o debe juzgar (p. ej. sustento jurídico de un turno). |
| **No implementada** | No hay código para esto. No es descuido: estos casos están agrupados y explicados en el resumen de cada bloque. |
| **Por verificar** | No se pudo confirmar con certeza contra el código disponible; se explica la duda puntual. |

**Severidad de excepción** (cuando la condición emite una fila en la pestaña Excepciones):
`BLOQ` = detiene el cálculo de ese día/semana/empleado · `ADV` = calcula igual, requiere revisión o
autorización · `INFO` = informativo, no requiere acción. Están definidas todas en el diccionario
`NOV` (una sola copia idéntica en los dos archivos HTML).

**Motor compartido.** Todo lo que describe este catálogo vive en funciones que `CLAUDE.md` lista como
motor compartido: están **byte a byte idénticas** en `reporte-horas.html` y `reporte-horas-rrhh.html`
(verificado programáticamente el 2026-09-18 sobre 42 funciones del motor). Cuando una condición solo
existe en un archivo (por ejemplo, el Glosario), se indica explícitamente.

---

## ALCANCE

**Dentro:** producir, para un ciclo de fechas cargado por el usuario, el reporte de horas trabajadas
y sus conceptos de nómina de **extras y recargos**; además, reportes de **asistencia**, **calidad de
marcación**, **cobertura de datos** y **cumplimiento (KPI)** construidos sobre el mismo modelo de
datos. Exportación a Excel de todo lo anterior y a un archivo plano para Sinergy.

**Fuera:** ausentismos con causal (permisos, incapacidades, vacaciones, licencias), salario,
prestaciones, dotación, cualquier concepto que no sea extra, recargo o los reportes de proceso
mencionados arriba. La herramienta no tiene backend, base de datos, ni conexión a ningún sistema
externo (ni BioTime ni Sinergy): todo el cálculo corre en el navegador sobre los archivos Excel que
el usuario carga, salvo la librería SheetJS servida desde `cdnjs.cloudflare.com`.

**Los 7 conceptos del alcance** (sin cambios desde v1.0, confirmados contra `CONCEPTS`/`CONC_DESC` en
el código):

| Concepto | Código Sinergy | Clave interna |
|---|---|---|
| Hora extra diurna ordinaria | `0200` | `EXT_D` |
| Hora extra nocturna ordinaria | `0210` | `EXT_N` |
| Hora extra festiva diurna | `0250` | `EXT_FD` |
| Hora extra festiva nocturna | `0260` | `EXT_FN` |
| Recargo nocturno | `0220` | `REC_N` |
| Recargo dominical o festivo | `0253` / `0252` según fecha (`cfg.corteOn`, H-06) | `REC_F` |
| Recargo nocturno festivo | `0259` / `0258` según fecha | `REC_FN` |

La matriz de asignación (`MATRIZ` en el código, mostrada en el `<details>` "Matriz de clasificación
aplicada" de la interfaz) es la usada por `classify()`: cada minuto es festivo o no, dentro o fuera de
jornada, diurno o nocturno — nunca dos cosas a la vez (invariante I-02).

---

# BLOQUE A · CONDICIONES DE ENTRADA — MARCACIONES

| ID | Diseño original | Estado | Implementación real y diferencias |
|---|---|---|---|
| **A-01** | Par completo entrada + salida: caso normal | Implementada | `compute()`, bucle `for(i+=2)` sobre la lista emparejada cronológicamente. |
| **A-02** | Entrada sin salida → excepción, permite cálculo automático con justificación humana, marcado `INFERIDO` | Implementada | Una sola marcación en el día (`list.length===1`) con turno programado. Severidad `BLOQ` en el diccionario `NOV`, pero si `cfg.inferir` (`cInfer`) está activo el día **sí se calcula** usando la hora del turno más cercana (`INFERIDO`); si no, el día queda sin calcular. `BLOQ` aquí significa "requiere resolución/aprobación", no "el motor se detiene". |
| **A-03** | Salida sin entrada → mismo tratamiento que A-02 | Reemplazada | No existe un camino de código separado para "falta entrada" vs "falta salida": el caso de una sola marcación (`A-02`/`A-04` según haya turno) decide cuál falta comparando distancia al inicio o al fin del turno (`cerca = |p.ts-W.ini| <= |p.ts-W.fin|`). No hay entrada `A-03` en el diccionario `NOV`. |
| **A-04** | Número impar de marcaciones → excepción, no se adivina, se escala a resolución humana | Implementada | Algoritmo de "mejor combinación": prueba quitar cada marcación y conserva la que deja la entrada más cerca del inicio de turno y la salida más cerca del fin (`reporte-horas.html:1644-1671`). Parámetro `cImpar` (`sugerir`/`no`). Severidad `ADV` si hay resolución sugerida (día queda `SUGERIDO`), `BLOQ` si no hay ninguna combinación válida o si `cImpar=no`. |
| **SUGERIDO** *(código nuevo, ya usado en el motor)* | — | Implementada | Flag que acompaña a la resolución de A-04. Tooltip propio en `NOV`: explica cuál marcación se descartó y exige aprobación humana. Nunca inventa una hora: todas las usadas son marcaciones reales. |
| **A-05** | Duplicada exacta, mismo `id` → se ignora la segunda | Reemplazada | No existe un `id` de registro que distinguir: `limpiarMarcaciones()` deduplica únicamente por clave `iso+minuto` (`p.iso+'\|'+p.min`), sin importar el origen del registro. En la práctica A-05 y A-06 son el **mismo camino de código** (`motivo:'A-06'`); no hay una condición A-05 diferenciada. |
| **A-06** | Duplicada lógica, distinto `id`, mismo minuto → se conserva la primera | Implementada | `limpiarMarcaciones()`, severidad `INFO`. Ambas marcaciones quedan en la marcación cruda; la segunda se marca `dup:true`. |
| **A-07** | Doble toque, ventana configurable (sugerido 60 s) | Implementada | Parámetro `cDoble` (`clusterMin`), **en minutos, no segundos** — default real **5 min**, no 60 s como sugería el diseño original. Severidad `INFO`. |
| **A-08** | Marcación fuera de todo turno programado → se captura y clasifica, no genera extra sin autorización | Parcial | Cada marcación se asigna a la ventana de turno más cercana dentro de tolerancia (`cTolIni`/`cTolFin`, default 120/360 min). Las que no entran en ninguna ventana ("sueltas") se agrupan por día y, **solo si ese día no tiene ya una ventana de turno**, se procesan como A-19. **Gap verificado:** si el día SÍ tiene una ventana de turno (aunque sea con otras marcaciones ya emparejadas), las marcaciones sueltas de ese mismo día se descartan silenciosamente — no aparecen en Detalle, Excepciones ni Asistencia (`reporte-horas.html:1563-1584`, idéntico en la versión RRHH). Es un caso de borde: una marcación aislada muy lejos del turno, en un día que igual tiene marcaciones válidas dentro de tolerancia. |
| **A-09** | Empleado sin turno asignado ese día → excepción bloqueante de ese día | Reemplazada | El código actual usa A-09 para un caso más angosto y distinto: **el empleado no tiene NINGUNA fila de programación en todo el archivo de Horario** (`!M.sched.has(id) && punches.length`, severidad `BLOQ`, se evalúa una vez por empleado, no por día). El caso "sin turno asignado ESE día en particular" (con programación para otros días) lo cubre **A-19**, que no bloquea: calcula el día como sobretiempo puro. |
| **A-10** | Empleado en BioTime pero no en SIRH → excepción de reconciliación | Implementada | `M.orphan`, severidad `BLOQ`. La marcación se conserva pero no se calcula. Antes de descartar, si el empleado SÍ existe pero le faltan `Compañía`/`Departamento`/`Cargo`, esos campos se completan desde la propia marcación — ver **A-22**. |
| **A-11** | Marcación de terminal desconocida → se captura, se alerta, se calcula igual | Implementada | El campo `origen` se captura siempre y alimenta el conteo de `dispositivos`. La "alerta" no es una fila de Excepciones: es la pestaña **Dispositivos**, que lista todo origen sin rol clasificado (ver **DISPOSITIVO**, bloque B). |
| **A-12** | `punch_state` ausente o ambiguo → excepción, el emparejamiento depende de ese campo | Reemplazada | El campo se llama `tipo` en el código, se parsea (`Tipo de Marcación`) y **nunca se vuelve a leer**: BioTime envía `255` en el 100% de los casos observados, así que el emparejamiento es puramente cronológico (A-01/A-04), no depende de este campo en absoluto. |
| **A-13** | Marcación rezagada (`upload_time` ≫ `punch_time`) | No implementada | Las exportaciones de BioTime usadas no traen una columna de `upload_time` distinta de la hora de marcación; no hay campo que parsear. |
| **A-14** | Marcación con fecha futura (reloj de terminal desfasado) | No implementada | No existe validación que compare la fecha de una marcación contra "hoy" ni que la rechace. |
| **A-15** | Marcación anterior a la fecha de ingreso → excepción de reconciliación | Implementada | Severidad `BLOQ`. **No aplica** cuando la fecha de ingreso es una fecha de migración masiva — ver **ING-MASIVO**. |
| **A-16** | Marcación posterior a la fecha de retiro → excepción de reconciliación | Reemplazada | Severidad cambiada de `BLOQ` a **`ADV`**: el día **sí se calcula** (no se pierde tiempo trabajado por una fecha de retiro mal registrada). Se reporta **una sola vez por empleado** con el conteo de días, no una fila por día. Depende de **`vigFin`** — ver **RETIRADO** y E-02. |
| **A-17** | Salida anterior o igual a la entrada, sin cruce de medianoche → nunca tiempo negativo | Implementada | Severidad `BLOQ`. |
| **A-18** | Ninguna marcación en día con turno programado → ausencia, sin conceptos | Implementada | Severidad `INFO`. Solo se reporta si el empleado tiene alguna marcación en algún otro día del ciclo (evita listar ausencias de quien nunca fue importado). |
| **A-19** | Marcación en día de descanso/festivo sin turno programado → sí genera conceptos, requiere autorización | Implementada | Severidad `ADV`. El día se acredita como sobretiempo puro (escalera desde cero, sin jornada fija). La "autorización requerida" del diseño original la cubre el mecanismo general **F-09/F-03**, que aplica a cualquier día con `extraMin>=25`, incluidos estos. |
| **A-20** | Marcación modificada/borrada en BioTime después de ingerida | No implementada | La herramienta no mantiene versión de los archivos entre corridas; cada `runCalc()` es independiente. |
| **A-21** | Zona horaria de `punch_time` distinta de la esperada | No implementada | No hay normalización de zona horaria; las horas se parsean literalmente como texto local (`toMin()`). |
| **A-22** *(nuevo)* | — | Implementada | `buildModel()` completa `empresa`/`depto`/`cargo` del empleado **solo si el maestro los trae vacíos**, tomándolos de la propia marcación: `Branch`→`Compañía` (verificado 1.039/1.039 sin discrepancias), `Departamento`→`Departamento`, `Position`→`Cargo` (1.036/1.036). Nunca pisa un dato ya presente en el maestro. Es lo que permite que un retirado sin archivo de Renuncia cargado igual tenga departamento (y no quede invisible al filtrar). |
| **INFERIDO** *(código ya usado en el motor)* | — | Parcial | Marca cualquier día cuya hora venga de una deducción del turno, no de una marcación real (A-02 con `cInfer` activo). Exige "aprobación humana identificada" según el invariante I-11 — pero esa aprobación no se persiste en ningún lado del código: ver **I-11**. |

---

# BLOQUE B · CONDICIONES DE LA JORNADA PROGRAMADA

| ID | Diseño original | Estado | Implementación real y diferencias |
|---|---|---|---|
| **B-01** | Turno estándar dentro del mismo día | Implementada | `segmentFor()` por día de semana declarado en el Excel de Turno. |
| **B-02** | Turno que cruza medianoche → se imputa al día de inicio y se segmenta | Implementada | `seg.cross = sal<=ent`; la ventana se extiende `+1440` min. **Nota real confirmada con el usuario:** un turno puede declarar su **fin antes** de la hora en que la gente realmente sale, a propósito — `T_12H_NOCHE` se llama "6PM a 6AM" pero está configurado 18:00→**03:00**. Esas últimas 3 horas quedan fuera de la ventana y se calculan como extra del mismo día en vez de entrar a la bolsa semanal (D-28). Es una palanca real de configuración, no un error de dato. |
| **B-03** | Dos turnos el mismo día → excepción, no se calcula hasta resolver | Implementada | Severidad `BLOQ`; mientras tanto se usa la asignación más reciente (`asg[asg.length-1]`). |
| **B-04** | Cambio puntual de turno (`tempschedule`) prevalece sobre la programación regular | Implementada | `OVERRIDES` (`localStorage.mb_overrides`, clave `id|fecha`), editable desde la pestaña Calendario. |
| **B-05** | Cambio de turno permanente a mitad de ciclo → cada día usa el turno vigente a esa fecha | Implementada | `shiftFor()` filtra asignaciones de `M.sched` por rango de vigencia (`ini`/`fin`) para cada fecha. |
| **B-06** | Cambio de cargo a mitad de ciclo → cambia el perfil laboral, cada día usa el perfil vigente | Reemplazada | El perfil (ROTATIVO/ADMINISTRATIVO) se calcula **una sola vez para todo el ciclo por empleado**, no día a día: `esAdmin = codes.every(c=>c.startsWith(cfg.adminPref))` sobre **todos** los turnos que el empleado tuvo en el ciclo completo. Un cambio de cargo a mitad de ciclo no reclasifica los días ya pasados de forma independiente — ver también **E-05**. El override manual (`mb_perfiles`, selector "Perfil" en Detalle) sigue existiendo y emite `ADV` cuando difiere del detectado automáticamente. |
| **B-07** | Día de descanso obligatorio programado → sin trabajo, sin conceptos | Implementada | Trivial: sin marcaciones, la fila queda en cero. |
| **B-08** | Festivo nacional → requiere calendario oficial cargado y versionado | Implementada (mejor de lo previsto) | `holidaysCO(y)` calcula los festivos de Colombia **algorítmicamente** para cualquier año (Pascua vía algoritmo de Gauss + Ley Emiliani para los que se trasladan al lunes siguiente), sin tabla cargada a mano ni versión que mantener. |
| **B-09** | Festivo que coincide con descanso del empleado → matriz de precedencia pendiente | Decisión de diseño | `dayType()` resuelve la precedencia con un `if/else` lineal: festivo siempre gana primero, luego domingo, luego descanso programado. No hay una "matriz" separada — es una prioridad fija de tres niveles. |
| **B-10** | Turno con descuento de almuerzo habilitado → se descuentan 60 min | Implementada | `quitarDescanso()`; el umbral para considerarlo almuerzo (no café) es `cfg.descMin` (`cDesc`, default 1 h = 60 min), comparado contra el `Descanso` declarado por el turno. |
| **B-11** | Turno con descuento de almuerzo deshabilitado → no se descuenta | Implementada | Si `W.seg.breakH*60 < cfg.descMin`, `quitarDescanso()` no recorta nada (ese tiempo se trata como café, ver B-12). |
| **B-12** | Descanso de café, 20 min, no se descuenta, la empresa lo paga | Implementada (mecanismo reemplazado) | Ya no es un descuento fijo de 20 min: `topeCafe(W,cfg)` toma el `Descanso` que el propio turno declara si es menor al umbral de almuerzo (`cfg.descMin`); si no, usa `cCafeAdm` (default 20 min) como respaldo — hoy solo aplica a `T_ADM1`, que no declara descanso corto. El perdón se calcula sobre huecos **clasificados por rol de dispositivo** (`clasificarHuecos()`), no sobre cualquier hueco: ver **DISPOSITIVO** y **B-16**. Efecto medido en agosto 2026: 8.357 días con café reconocido, 2.671 h pagadas. |
| **B-13** | Turno de 12 horas, sustento legal pendiente | Decisión de diseño | El motor no evalúa sustento jurídico de ningún turno: procesa cualquier duración declarada en el Excel de Turno igual que las demás. El único efecto operativo es que D-20 (más de 2 h extra en el día) no dispara para turnos de duración programada ≥ 11 h. |
| **B-14** | Empleado sin cargo asignado → excepción bloqueante | Implementada | Severidad `BLOQ`, solo si además tiene horas trabajadas en el ciclo (`ciclo.some(r=>r.workMin>0)`). |
| **B-16** *(código nuevo, ya usado en el motor — el catálogo original no llegaba a B-15/B-16)* | — | Implementada | "Tránsito interior prolongado": se emite `ADV` cuando un hueco entre marcaciones que abre y cierra en biométricos `INTERIOR` supera `cfg.transAviso` (`cTransAviso`, default 120 min). No topa el perdón — solo avisa, para que un humano confirme si de verdad fue tránsito interno. |
| **DISPOSITIVO** *(código nuevo, ya usado en el motor)* | — | Implementada | Cada biométrico tiene un rol: `PORTERIA` (salió de la empresa, el hueco pesa completo), `DESCANSO` (café, se perdona hasta el tope), `INTERIOR` (nunca salió, no genera pendiente). `rolAuto()` sugiere por nombre (`VESTIER/CAFETERIA/CASINO`→`DESCANSO`, `PORTERIA/RECEPCION/INGRESO/SALIDA/TORNIQUETE`→`PORTERIA`); todo lo demás queda **sin clasificar** y se trata como `DESCANSO` (el punto medio, con tope) hasta que un humano lo confirme en el botón *Dispositivos* (`localStorage.mb_dispositivos`). **Prioridad ante huecos con extremos de rol distinto:** si cualquiera de los dos extremos es `PORTERIA`, el hueco completo es ausencia — ante la duda se cobra al empleado, nunca a la empresa. |
| **T-EXTRA** *(código nuevo, ya usado en el motor)* | — | Implementada | Turno de solo extras: código con el prefijo `cExtraPref` (default `T_EXTRA`). No tiene jornada fija ni horas pendientes ni escalera de 25 min: se toma la primera y la última marcación del día, cada una llevada a la media hora más cercana (`pasoExtra()`, paso `cExtraPaso`, default 30 min, redondeo simétrico). Un hueco intermedio no se descuenta — solo importan los dos extremos. Si el resultado da menos de un cuarto de hora, el día no acredita nada. |

---

# BLOQUE C · SEGMENTACIÓN TEMPORAL

El tiempo trabajado se parte en tramos atómicos con `atomize()`. Invariante: la suma de minutos de
todos los tramos = tiempo acreditado (`creditMin`), verificado cada sesión de pruebas (I-01).

| ID | Diseño original | Estado | Implementación real y diferencias |
|---|---|---|---|
| **C-01** | Medianoche (cambio de día calendario) | Implementada | Corte fijo en `atomize()`: `cuts.add(d*1440)`. |
| **C-02** | Inicio de franja nocturna — fijo a 19:00 desde dic-2025 | Implementada | Totalmente parametrizable (`cNocIni`, default 19:00), sin versión fija por fecha. |
| **C-03** | Fin de franja nocturna — fijo a 06:00 | Implementada | Parametrizable (`cNocFin`, default 06:00). |
| **C-04** | Frontera nocturna histórica 21:00, para períodos anteriores a dic-2025, versionada | Reemplazada | No existe versión histórica por fecha: hoy es un único parámetro global (`cNocIni`/`cNocFin`) sin variación automática en el tiempo. Si un ciclo histórico necesita otra franja, hay que cambiar el parámetro a mano antes de calcular ese ciclo. |
| **C-05** | Cambio de tipo de día: ordinario ↔ descanso ↔ festivo | Implementada | `dayType()` — y evaluado **por tramo**, no por turno completo: ver **D-29**. |
| **C-06** | Inicio de la jornada programada | Implementada | Frontera de corte en `atomize(..., extraCuts=[W.ini, W.fin])`. |
| **C-07** | Fin de la jornada programada | Implementada | Ídem C-06. |
| **C-08** | Inicio y fin de descanso de almuerzo, cuando aplica | Implementada | `quitarDescanso()` devuelve `ventana:{ini,fin}`, usada también para excluir el almuerzo del cálculo de huecos de café (evita descontarlo dos veces). |
| **C-09** | Inicio y fin de una condición especial con hora (lactancia) | Reemplazada | La lactancia no se implementó como una frontera de segmento explícita en `atomize()`: se resuelve como un **crédito de minutos** sobre los minutos del turno que la persona no trabajó (`compute()`, ver **E-04**). Los minutos acreditados se marcan sobre la línea de tiempo de la jornada fija con `lact:true` (`ubicarLactancia()`) y se pagan como ordinarios sin recargo; no hay un corte C-09 físico, solo un tramo marcado. |
| **C-10** | Cambio de vigencia de cualquier regla dentro del turno | Implementada | `atomize()` acepta un arreglo abierto de `extraCuts`; se usa para turno (C-06/C-07) y para el borde de semana (`partirPorSemana()`, ver **D-30**). |

---

# BLOQUE D · CLASIFICACIÓN — QUÉ CONCEPTO SE GENERA

## D.1 Reglas base (matriz D-01 a D-08)

Confirmado contra `CONC_DESC`/`MATRIZ` y `classify()`: la asignación es **mutuamente excluyente por
minuto** (invariante I-02) — un minuto nocturno en festivo genera `0259`/`0258` solamente, nunca
`0253+0220` a la vez. Esta fue la resolución tomada para los cinco casos de concurrencia que el
diseño original dejaba pendientes (D-05 a D-08); es una postura de política de nómina discutible por
RRHH, no una limitación técnica.

| ID | Diseño original | Estado | Implementación real |
|---|---|---|---|
| **D-01** | Dentro de jornada, ordinario, diurno → ninguno | Implementada | `classify(false,false,false) = null`. |
| **D-02** | Dentro de jornada, ordinario, nocturno → recargo nocturno `0220` | Implementada | `classify(false,false,true) = 'REC_N'`. |
| **D-03** | Fuera de jornada, ordinario, diurno → extra diurna `0200` | Implementada | `classify(false,true,false) = 'EXT_D'`. |
| **D-04** | Fuera de jornada, ordinario, nocturno → extra nocturna `0210` | Implementada | `classify(false,true,true) = 'EXT_N'`. |
| **D-05** | Dentro de jornada, festivo → recargo dominical/festivo + nocturno si aplica | Implementada | `classify(true,false,false)='REC_F'`, `classify(true,false,true)='REC_FN'`. Resuelto como exclusión mutua, no como suma de dos conceptos. |
| **D-06** | Fuera de jornada, festivo, diurno → extra festiva diurna `0250` | Implementada | `classify(true,true,false)='EXT_FD'`. |
| **D-07** | Fuera de jornada, festivo, nocturno → extra festiva nocturna `0260` | Implementada | `classify(true,true,true)='EXT_FN'`. |
| **D-08** | Trabajo nocturno en festivo → recargo nocturno festivo `0259`/`0258` | Implementada | Mismo camino que D-05 nocturno (`REC_FN`). |
| **D-09** | Sin trabajo no hay concepto | Implementada | `if(!ps.length){ rows.push(row); return; }` — fila en cero, sin tramos. |

## D.2 Jornada fija, escalera de sobretiempo y redondeo

**Este subbloque cambió de fondo respecto al diseño original.** El redondeo plano D-10 a D-13
(cortes fijos `:00–:24→0h`, `:25–:49→0,5h`, `:50–:24 sig.→1h`, aplicado sobre el **total del día**)
tenía un bug real: un turno `T_ADM1` de 8,5 h con 21 minutos de más se redondeaba a 9 h, cuando 21 min
nunca alcanzó el umbral de 25. El modelo vigente separa dos cosas que antes se mezclaban: la
**jornada fija del turno** (siempre se acredita completa) y el **sobretiempo** (se mide con una
escalera desde el fin del turno, nunca redondeando el total del día).

| ID | Diseño original | Estado | Implementación real |
|---|---|---|---|
| **D-10** | Posterior al fin de turno, `:00`–`:24` → 0 h | Reemplazada | Ver **D-28**. `round05()` sigue existiendo pero solo como normalizador final por concepto (idempotente sobre valores ya limpios), nunca sobre el total del día. |
| **D-11** | `:25`–`:49` → 0,5 h | Reemplazada | Ver **D-28**. |
| **D-12** | `:50`–`:24` de la hora siguiente → 1,0 h | Reemplazada | Ver **D-28**. |
| **D-13** | Incremento en pasos de 0,5 h | Reemplazada | El paso de 0,5 h se conserva, pero dentro de la escalera de D-28, no de cortes fijos de reloj. |
| **D-28** *(nuevo — reemplaza D-10 a D-13)* | — | Implementada | **Jornada fija:** `salida − entrada − almuerzo` del turno, acreditada completa aunque falten minutos (el faltante va a `pendienteMin`, ver D-31). **Escalera de sobretiempo** (`escalera(min,cfg)`): la primera media hora exige `cfg.escPrimer` minutos (default 25); cada media hora siguiente se acredita con `cfg.escGracia` minutos de gracia (default 10) — con los defaults: `+25→0,5h · +50→1,0h · +80→1,5h · +110→2,0h · +140→2,5h`. Medida siempre desde el **fin del turno asignado**. Ambos parámetros son campos del formulario. |
| **D-14** | Anclaje de los cortes: ¿reloj absoluto o relativo al fin de turno? | No implementada | `cfg.anclaje` (`cAnclaje`) se lee del formulario y se guarda en `cfg`, pero **nunca se vuelve a leer en ninguna otra parte del motor** (confirmado por búsqueda exhaustiva). El modelo D-28 respondió la pregunta de hecho: siempre es "relativo al fin de turno". El `<option>` de "reloj absoluto" no tiene comportamiento detrás — no confiar en él. |
| **D-15** | Tiempo antes del inicio del turno no cuenta | Implementada | `if(W) iv.forEach(p=>{ if(p.ini < W.ini) p.ini = Math.min(W.ini, p.fin); })`. Se reporta como "presente antes de que arranque su turno" en la pestaña Calidad de marcación. |
| **D-16** | Redondeo sobre valor inferido, solo con aprobación humana registrada | Parcial | Se marca (`F-10`/`INFERIDO`) pero no existe una acción de "aprobar" que persista una decisión humana — ver **I-11**. |
| **D-31** *(nuevo)* | — | Implementada | **Horas pendientes** (`pendienteMin`): diferencia entre la jornada fija y lo efectivamente trabajado dentro del turno, **neta** del café y la lactancia reconocidos y del tránsito interior. No se descuenta del pago — se reporta aparte, por día, empleado y en Excel (`HORAS PENDIENTES`), como sustento de incumplimiento sin dejar de pagar la jornada completa. En agosto 2026 (ya con el café reconocido): ~3.974 h. |
| **TARDE** *(código nuevo, ya usado en el motor)* | — | Implementada | Se marca cuando la primera marcación llega después del inicio del turno o la última sale antes del fin, por encima de `cfg.tolPunt` (`cTolPunt`, default 5 min). Es puramente informativo: no cambia ningún cálculo (D-15 sigue aplicando igual). |

## D.3 Umbral semanal — personal rotativo

**La semana del umbral ya no arranca a medianoche del lunes.** Arranca con el primer turno de la
semana operativa (domingo, hora configurable) porque así lo pidió el usuario para los turnos
rotativos reales.

| ID | Diseño original | Estado | Implementación real |
|---|---|---|---|
| **D-17** | Semana &lt; 42 h → todo ordinario | Implementada | Acumulador `accW` por clave de semana (ver D-30); si la jornada fija acreditada no alcanza `cfg.umbral*60`, no hay reclasificación. Emite `INFO` cuando ≥25 min quedaron fuera de jornada sin pagarse como extra por estar bajo el umbral. |
| **D-18** | Semana &gt; 42 h → el excedente es extra | Implementada | El tramo que cruza el umbral se parte en dos (`reemplazo.set(t, [...])`): la porción bajo el umbral queda ordinaria, la que excede se reclasifica `extra:true`. |
| **D-19** | Excedente &gt; 12 h semanales → se calcula igual, con alerta obligatoria | Implementada | `ADV` cuando `excesoSemH>12`. |
| **D-20** | Más de 2 h extra en un día → alerta, no aplica a turnos de 12 h | Implementada (matiz) | `ADV` cuando `extraDia>2`, **excepto** si la duración programada del turno es ≥ 11 h (no exactamente "12 h" — el corte real en código es 11 h de duración de turno). |
| **D-21** | Semana que cruza el cierre del ciclo → no se puede clasificar sin la semana completa, bloqueante crítico | Implementada (ya no bloqueante) | Severidad `ADV`, no `BLOQ`: el umbral se evalúa con los días disponibles del ciclo cargado. Si se necesita exactitud, hay que cargar la semana completa aunque exceda el ciclo. |
| **D-22** | Semana que cruza el 15-jul-2026 (44 h → 42 h), umbral versionado por fecha | No implementada | `cfg.umbral` es un único parámetro plano (default 42) sin versión histórica por fecha. Un ciclo anterior al cambio legal necesitaría que RRHH ajuste el parámetro a mano antes de calcularlo. |
| **D-23** | Personal administrativo → no aplica umbral semanal, cálculo diario | Implementada | `if(perfil==='ROTATIVO' && !esConfianza)` es la única rama que aplica el umbral; administrativo y confianza quedan fuera. |
| **D-24** | Reclasificación de la pasada 1 por la pasada 2 | Implementada | El reemplazo de tramos (`reemplazo` Map) ocurre después de acumular toda la semana, así que un tramo marcado ordinario en un primer paso puede terminar reclasificado extra al cerrar la semana. |
| **D-29** *(nuevo)* | — | Implementada | **Tipo de día evaluado por tramo, no por turno completo.** `fesDe(iso)` memoiza el tipo de día por la fecha real de cada tramo (`t.iso`, que `atomize()` ya calculaba). Corrige un bug real: un turno nocturno que arranca festivo ya no arrastra el recargo festivo hasta el fin del turno si cruza a un día ordinario a medianoche. Caso real 2026-08-17 (`T_12H_NOCHE`, 18:00–06:00): antes `REC_F=1·REC_FN=10`, ahora `REC_F=1·REC_FN=4·REC_N=6`. La corrección es bidireccional: 235 días *ganaron* recargo festivo que nunca se pagó (1.421 h) además de los 424 días que lo perdían indebidamente (2.555 h). La suma total de conceptos del ciclo no cambia — es reclasificación, no recálculo. |
| **D-30** *(nuevo)* | — | Implementada | **Inicio de la semana del umbral por instante, no por fecha de jornada.** `semanaDeTs(ts,cfg)` asigna cada tramo a su semana según el instante exacto, no la fecha calendario de la fila; `partirPorSemana()` corta los tramos que cruzan el borde. Parámetros `cSemIni` (día, default domingo) y `cSemHora` (hora, default 22:00 — entrada del turno 3). Caso sintético: lunes a sábado 7h/día (42h) + domingo 14:00–21:00 → antes 49 ordinarias/0 extra, ahora 42 ordinarias/7 extra. Sin impacto medido en agosto 2026 porque los turnos programados en domingo ya arrancaban justo a las 22:00. |

## D.4 Contador mensual

| ID | Diseño original | Estado | Implementación real |
|---|---|---|---|
| **D-25** | Hasta 2 días de descanso trabajado en el mes → modalidad ocasional | No implementada | No existe ningún conteo mensual en el código. |
| **D-26** | 3 o más en el mes → modalidad habitual | No implementada | Ídem. |
| **D-27** | Base de conteo: domingos + festivos + descanso propio | No implementada | Ídem. |

---

# BLOQUE E · CONDICIONES DEL EMPLEADO

| ID | Diseño original | Estado | Implementación real y diferencias |
|---|---|---|---|
| **E-01** | Ingreso a mitad de ciclo → se calcula solo desde la fecha de ingreso | Implementada | `activoEnCiclo()` recorta `ini` a `emp.ingreso` si es posterior al inicio del ciclo, salvo fecha de ingreso masiva (ver **ING-MASIVO**). |
| **E-02** | Retiro a mitad de ciclo → se calcula hasta la fecha de retiro | Reemplazada | El límite real no es la fecha de retiro sino **`vigFin`**: `máx(fecha de retiro, última marcación)`. Si hay marcaciones posteriores al retiro, esos días **sí se calculan** (marcados A-16) porque las fechas de retiro en BioTime no siempre son confiables (caso real: retiro 2026-05-22, 163 marcaciones posteriores). |
| **E-03** | Activo sin marcaciones en el ciclo → no genera filas, excepción informativa | Implementada | `INFO`, solo si el empleado tenía turnos programados en el ciclo. |
| **E-04** | Lactancia vigente → tiempo pagado como trabajado, duración por definir | Implementada | **Por archivo, no por turno** (el esquema `T_LACT*` se descartó: obligaba a crear un turno por cada combinación de horario y etapa de cada empleada). Archivo **opcional** de Lactancia: una fila por empleada, `ID_empleado` + etapa de 6 meses (`Inicio`/`Fin`) + etapa de 24 meses (`Inicio`/`Fin`); una fila con una sola etapa es válida. Tope diario por etapa: `cLactMin6` (default 60) y `cLactMin24` (default 30). Es un derecho, no una obligación: se acredita solo lo que la persona **no trabajó** dentro del turno (llegada tarde, salida temprana o hueco interno, con cualquier rol de biométrico), hasta el tope y **después** del café. Esos minutos se pagan como **ordinarios sin recargo** (ni nocturno, ni dominical, ni festivo); cuentan en la bolsa semanal/jornada diaria como cualquier minuto ordinario, así que por sí solos no generan extras. Sin crédito en días sin marcación (A-18), CONFIANZA ni turnos T-EXTRA. Marcas `LACT 6M`/`LACT 24M`, filtro en Consolidado, tarjetas de empleadas y horas acreditadas, columnas de minutos por etapa en el Excel (`ETAPA LACTANCIA`, `DIAS EN LACTANCIA`, `DIAS CON CREDITO LACTANCIA`, `MIN LACTANCIA 6M`, `MIN LACTANCIA 24M`) y hoja «Lactancia» en el Excel (una fila por cada fila del archivo, también las ignoradas, con su estado y motivos; **respeta los filtros activos del Consolidado**). **Validaciones de carga (todas visibles, ninguna lanza):** ID vacío o ilegible (error, se ignora la fila); ID que no está en el maestro ni en renuncias (aviso, se ignora la fila); ID repetido (error, se ignoran todas sus filas); etapa con una sola fecha, con fin anterior al inicio o con fecha ilegible (error, se ignora esa etapa); `Fin_6m` posterior a `Inicio_24m` (error, se ignora toda la fila; igual es válido; **solo se evalúa si las dos etapas son válidas**: una etapa incompleta o al revés se ignora sola y no arrastra a la otra); fila sin ninguna etapa válida (aviso, sin efecto). Si las dos etapas cubren un mismo día (solo ocurre cuando `Fin_6m` = `Inicio_24m`), manda la de 6 meses. Sin archivo cargado la salida es idéntica a la versión anterior. |
| **E-05** | Cambio de perfil por cambio de cargo a mitad de ciclo → cada día usa el perfil vigente | No implementada | El perfil se determina una sola vez por empleado para todo el ciclo (ver **B-06**); no hay versión de `cargo` por fecha en el maestro, así que un cambio de cargo mid-ciclo no se detecta ni reclasifica día por día. |
| **E-06** | Temporal de Granservicios → ¿entra al archivo de Sinergy o solo a control interno? | No implementada | El campo `Compañía` (`PLASTITECSA`/`GRANSERVICIOS`) se exporta y se puede filtrar en Consolidado, lo que **permite ver** la separación, pero el código no decide ni rutea nada distinto según ese valor: todo lo que tiene conceptos sale igual en `sinergyTxt()`. |
| **E-07** | Practicante SENA, con jornada propia | No implementada | Sin tratamiento especial; se calcula como cualquier turno programado. |
| **E-08** | Empleado sin código de Sinergy → excepción bloqueante del cierre | No implementada | Una fila del maestro de Empleados sin `Empleado ID` se **descarta silenciosamente** en `buildModel()` (`if(!id) return;`) — no genera ninguna excepción ni aviso. No es la "excepción bloqueante" que pedía el diseño original: es una pérdida de dato silenciosa. |
| **E-09** | Dos empleados con el mismo código de Sinergy → excepción bloqueante | No implementada | No hay verificación de colisión. Si dos filas del maestro normalizan al mismo `id`, la segunda **pisa silenciosamente** a la primera en el `Map` de empleados (`employees.set(id, ...)`), sin aviso alguno. |
| **E-10** | Empleado suspendido → sin turno, sin conceptos | Implementada | `ADV` cuando el estado contiene "deshab" y tiene horas trabajadas en el ciclo — el caso que sí se puede detectar con los datos disponibles. |
| **E-11** | Convención colectiva con reglas distintas → prevalecen | No implementada | Sin representación de convenciones colectivas en el modelo. |
| **ING-MASIVO** *(código nuevo, ya usado en el motor)* | — | Implementada | `marcarIngresosMasivos()`: cualquier fecha de ingreso compartida por más de `cfg.ingMasivo` empleados (`cIngMasivo`, default 15) se interpreta como fecha de migración del sistema, no de contratación real, y deja de bloquear asistencia u horas de días anteriores para ese grupo. Verificado con datos reales: 879/1.273 empleados comparten `2026-04-08`. |
| **RETIRADO** *(código nuevo, ya usado en el motor)* | — | Implementada | Marca informativa en Detalle para empleados que vienen del archivo de Renuncia (no del maestro). El vínculo (`emp.vinculo`, ACTIVO/RETIRADO) es una **dimensión propia**, deliberadamente separada de `Compañía` (que distingue PLASTITECSA/GRANSERVICIOS). |
| **CONFIANZA** *(código nuevo, ya usado en el motor)* | — | Implementada | Marca manual por empleado (`localStorage.mb_confianza`, checkbox en Detalle) para cargos de dirección, confianza y manejo excluidos de la jornada máxima legal (Art. 162 CST). Efecto: `dentroMin = workMin` (sin jornada fija), `extraCredMin=0`, `pendienteMin=0`, sin umbral semanal — pero **sí** conserva los recargos nocturno/dominical/festivo. Caso real de verificación, empleado 3956: de (180 h ordinarias, 24 h extra, 72,9 h pendientes) a (131,1 h ordinarias, 0 extra, 0 pendientes). |
| **E-12** *(nuevo)* | — | Implementada | El archivo `Renuncia_*.xlsx` es **opcional** (`checkReady()` no lo exige). Su columna `Empleado` trae id y nombre pegados en una celda (`"9999 NOMBRE APELLIDO"`); se separa con `/^(\d+)\s+(.*)$/` — un id con letras rompe el regex silenciosamente (la fila se ignora sin aviso). Si el empleado ya existía en el maestro, este archivo **solo aporta el retiro**; nunca pisa datos personales ya presentes. |
| **E-13** *(nuevo)* | — | Implementada | `emp.vinculo` (ACTIVO/RETIRADO) se mantiene como dimensión propia, nunca mezclada dentro de `Compañía` — evaluado y descartado explícitamente como alternativa, porque borraría la separación PLASTITECSA/GRANSERVICIOS. |
| **E-14** *(nuevo)* | — | Implementada | `activoEnCiclo()`: universo del reporte. Una persona entra al cálculo solo si su vigencia (ingreso→`vigFin`) toca el ciclo consultado **y** tiene marcaciones o programación dentro de esa intersección. Excluye del denominador de cobertura a quien simplemente no trabajó ese período (ingresó después o se retiró antes), sin que eso cuente como incumplimiento. |
| **E-15** *(nuevo)* | — | Implementada | El archivo de **Lactancia** (`DATA.lac`) es **opcional** y **no se persiste** en `localStorage`: son datos personales y cambian cada mes, así que se carga en cada corrida. `checkReady()` no lo exige; sin él la salida es idéntica a la anterior. Las fechas se leen en bruto (`readSheet(buf, true)`) porque con `raw:false` SheetJS devuelve las fechas de Excel como `1/15/26`, que `toISO()` no entiende. La validación corre al cargar (`validarLactCarga()`) y de nuevo dentro de `buildModel()`; el panel de validación muestra solo el ID, nunca el nombre. La plantilla descargable (`Plantilla_lactancia.xlsx`) trae dos filas ficticias con IDs no numéricos (`EJEMPLO-1`, `EJEMPLO-2`) para que nunca choquen con el ID de una persona real. |

---

# BLOQUE F · APROBACIÓN

**Solo dos de las diez condiciones originales tienen implementación real.** El resto exige una
bandeja de aprobación con roles (jefe/RRHH) y estados persistentes que esta herramienta, sin backend,
no tiene.

| ID | Diseño original | Estado | Implementación real |
|---|---|---|---|
| **F-01** | Registro calculado sin revisar → pendiente, bandeja del jefe con notificación | No implementada | No hay bandeja ni notificación. |
| **F-02** | Aprobado por el jefe inmediato → entra al archivo | No implementada | No hay estado de aprobación; todo lo calculado con conceptos > 0 entra al archivo. |
| **F-03** | Rechazado → no entra al archivo, queda trazado con motivo | Implementada (simplificada) | Panel "Autorización de horas extra" (`AUTOR`, `localStorage.mb_autor`, rangos de fechas por empleado). Un rango marcado `NO` hace que `r.extraMin>=25` se excluya del consolidado y del archivo Sinergy — pero **solo el trabajo suplementario**: los recargos (`0220`,`0253`/`0252`,`0259`/`0258`) no se afectan, porque no son horas suplementarias sino sobretasas sobre tiempo ordinario. Sin flujo de roles: cualquiera con acceso al navegador puede marcar el rango. |
| **F-04** | Ajustado por el jefe, justificación obligatoria, se conservan ambos valores | No implementada | Sin mecanismo de ajuste manual de un valor calculado. |
| **F-05** | Aprobado por RRHH en sustitución del jefe, anotación obligatoria | No implementada | Sin roles. |
| **F-06** | Sin aprobar al cierre → bloquea el cierre | No implementada | No existe el concepto de "cierre"; ver bloque G. |
| **F-07** | Jefe de vacaciones o cargo vacante → requiere suplente/escalamiento | No implementada | Sin estructura organizacional en el modelo. |
| **F-08** | Empleado sin jefe asignado → excepción bloqueante | No implementada | Ídem. |
| **F-09** | Extras sin autorización previa → se calculan, se marcan, requieren decisión explícita | Implementada | `ADV` cuando `r.extraMin>=25` y no hay rango de autorización que cubra la fecha (`autorFor()` devuelve `null`). Con `cfg.autor='exigir'` (`cAutor`), el comportamiento sube a rechazo (igual que F-03) en vez de solo marcar. |
| **F-10** | Aprobación de un valor inferido debe hacerse visible al aprobador | Parcial | Se marca `ADV` (`r.inferido`), pero no hay una acción de aprobación que se persista — mismo hueco que **I-11**. |

---

# BLOQUE G · PERÍODO Y CIERRE

**Ninguna de las diez condiciones está implementada.** No es una omisión puntual: la herramienta no
tiene el concepto de "período" con estados propios. Cada `runCalc()` es una corrida independiente y
sin memoria de corridas anteriores; cambiar un parámetro y recalcular simplemente reemplaza `RESULT`
en memoria del navegador. Esto es consistente con que sea una herramienta de un solo archivo, sin
backend ni base de datos.

| ID | Diseño original | Estado |
|---|---|---|
| **G-01** | Período abierto: admite ingesta, cálculo, aprobación, ajuste | No implementada |
| **G-02** | Cierre con aprobaciones pendientes → bloqueado | No implementada |
| **G-03** | Cierre con excepciones sin resolver → bloqueado | No implementada (`sinergyTxt()` genera el archivo igual y solo avisa por `toast` cuántas excepciones `BLOQ` quedaron sin resolver) |
| **G-04** | Cierre con empleados sin código de Sinergy → bloqueado | No implementada |
| **G-05** | RRHH inicia el procesamiento → bloqueo inmediato de modificaciones | No implementada |
| **G-06** | Marcación tras el cierre, con fecha del período cerrado | No implementada |
| **G-07** | Reapertura de período cerrado, con rol elevado | No implementada |
| **G-08** | Recálculo tras reapertura genera `calculo_id` nuevo | No implementada |
| **G-09** | Recálculo histórico usa las reglas vigentes a esa fecha | No implementada (siempre usa los parámetros actuales del formulario) |
| **G-10** | Ajuste retroactivo requiere signo negativo en Sinergy | No implementada |

---

# BLOQUE H · ARCHIVO DE SALIDA

Generado por `sinergyTxt()`. Trece de quince condiciones están implementadas y verificadas contra el
código exacto del archivo plano.

| ID | Diseño original | Estado | Implementación real |
|---|---|---|---|
| **H-01** | Concepto en cero → no se emite fila | Implementada | `if(!v) return;` por cada combinación empleado×concepto. |
| **H-02** | Empleado sin ningún concepto → no aparece | Implementada | `RESULT.cons = todos.filter(e=>e.tieneConceptos)`. |
| **H-03** | Una fila por empleado y por concepto | Implementada | `sel.forEach(e=>cols.forEach(c=>{...}))`. |
| **H-04** | Código de empleado numérico, sin ceros a la izquierda | Implementada | `normId()`: `s.replace(/^0+(?=\d)/,'')`. |
| **H-05** | Código de concepto, 4 dígitos con ceros a la izquierda | Implementada | Códigos literales en `CONCEPTS` (`'0200'`, etc.). |
| **H-06** | Selección del código por fecha del período: `0253→0252`/`0259→0258` desde 15-jul-2026 | Implementada | `cfg.corteOn = cfg.corte && cfg.fin >= cfg.corte` (`cCorte`, default `2026-07-15`, editable). |
| **H-07** | Signo `+` literal, negativos no soportados | Implementada | `'+'` fijo en cada línea. |
| **H-08** | Decimal con punto, máx. 2 decimales, sin ceros de relleno | Implementada | `(Math.round(v*100)/100).toString()`. |
| **H-09** | Fechas `D/MM/AAAA`, día sin cero, mes con cero | Implementada | `f = iso => { const [y,m,d]=iso.split('-'); return \`${+d}/${m}/${y}\`; }`. |
| **H-10** | Campos 7 a 12 vacíos, presentes, separados por tabulación | Implementada | 6 campos vacíos tras la fecha de fin. |
| **H-11** | TAB · UTF-8 · LF · sin encabezado | Implementada | `lines.join('\t')`/`join('\n')`, `Blob(...,{type:'text/plain;charset=utf-8'})`. |
| **H-12** | `FINAL_SINER_<inicio>_<fin>.txt` | Implementada | `FINAL_SINER_${cfg.ini.replace(/-/g,'')}_${cfg.fin.replace(/-/g,'')}.txt`. |
| **H-13** | Regenerar el mismo período produce un archivo idéntico | Por verificar | El cálculo es una función pura de `RESULT`/`cfg` sin aleatoriedad ni timestamps embebidos en las filas — debería ser determinista por construcción, pero no se ejecutó una prueba de regresión que compare dos generaciones byte a byte. |
| **H-14** | Registro de exportaciones: quién, cuándo, con qué `calculo_id` | No implementada | Sin bitácora de exportaciones. |
| **H-15** | Recarga del mismo archivo en Sinergy: ¿duplica o reemplaza? | No implementada | Comportamiento de un sistema externo, fuera del alcance de esta herramienta. |

---

# BLOQUE I · INVARIANTES DE INTEGRIDAD

Verificados en cada sesión de pruebas contra datos reales (Node + mock de DOM), no en un pipeline de
CI automatizado.

| ID | Invariante | Estado | Nota |
|---|---|---|---|
| **I-01** | Suma de tramos = tiempo trabajado calculado | Implementada | Desde el modelo de jornada fija, se compara contra **`creditMin`** (tiempo acreditado), no contra `workMin` (minutos de reloj) — son distintos a propósito; la diferencia es `pendienteMin` más el efecto de la escalera. |
| **I-02** | Ningún minuto queda clasificado en dos conceptos a la vez | Implementada | Garantizado estructuralmente: `classify()` devuelve un único valor o `null` por tramo. |
| **I-03** | Ningún minuto trabajado queda sin clasificar | Implementada | Todo tramo pasa por `classify()`; los que no aplican a ningún concepto (D-01, ordinario diurno dentro de jornada) devuelven `null` a propósito — están contados en `creditMin`, solo no generan concepto de nómina. |
| **I-04** | Ningún empleado supera 24 h de conceptos en un día | Implementada | `BLOQ` explícito: `if(r.workH>24) add('BLOQ','I-04',...)`. |
| **I-05** | Ningún empleado supera 12 h extra semanales sin alerta | Implementada | Cubierto por **D-19**, mismo umbral de 12 h. |
| **I-06** | Toda fila del archivo corresponde a un registro aprobado | No implementada | No existe estado de aprobación (bloque F). El archivo exporta todo lo calculado con conceptos > 0. |
| **I-07** | Todo valor exportado es trazable hasta sus marcaciones crudas y su versión de regla | Parcial | Trazable a nivel de día: Detalle exporta marcaciones, marcación descartada, novedades y su explicación textual (`NOV[f].t — NOV[f].q`). No hay trazabilidad a nivel de tramo individual ni versión de parámetros usada en esa corrida. |
| **I-08** | Todo concepto exportado existe en el catálogo vigente | Implementada | Trivialmente cierto: `CONCEPTS` es la única fuente de códigos, no hay forma de exportar uno que no esté ahí. |
| **I-09** | Todo empleado tiene código de Sinergy válido y único | No implementada | Sin verificación de unicidad — ver **E-09**. |
| **I-10** | Suma del archivo = suma de registros aprobados en el sistema | No implementada | No aplica: no hay "sistema" de aprobación separado del cálculo. |
| **I-11** | Todo valor `INFERIDO` tiene aprobación humana identificada | No implementada | Se marca (`INFERIDO`/`F-10`) pero no se persiste ninguna aprobación humana en ningún `localStorage` ni estructura del código — es la brecha común a **A-02**, **D-16** y **F-10**. |
| **I-12** | Ningún registro proviene de un `calculo_id` invalidado | No implementada | No existe el concepto de `calculo_id` (bloque G). |

---

# BLOQUE J · CONCILIACIÓN Y CONTROL

**Ninguna de las siete condiciones está implementada.** Confirmado por ausencia total de llamadas de
red en el código (`fetch`, `XMLHttpRequest`) salvo la carga del script de SheetJS desde
`cdnjs.cloudflare.com`: la herramienta no tiene ninguna conexión a BioTime más allá de leer los
archivos Excel que el usuario exporta manualmente.

| ID | Diseño original | Estado |
|---|---|---|
| **J-01** | Comparación por empleado y día contra `dailyHourReport` de BioTime | No implementada |
| **J-02** | Diferencias esperadas por diseño (umbral, redondeo) marcadas como tales | No implementada |
| **J-03** | Cualquier otra diferencia se trata como defecto propio | No implementada |
| **J-04** | Reporte de días con valor inferido y su autorizador | No implementada (existe el dato de INFERIDO por día, pero no el reporte de conciliación) |
| **J-05** | Reporte de excepciones abiertas por período | No implementada (existe Excepciones, pero no el concepto de "período abierto/cerrado") |
| **J-06** | Reporte de aprobados fuera de plazo | No implementada |
| **J-07** | Contraste del archivo contra el mes anterior | No implementada |

---

# BLOQUE K · REPORTES Y SALIDAS *(bloque nuevo)*

No son condiciones de "extras y recargos" en sentido estricto, pero son comportamiento real y
verificado de la herramienta, construido sobre el mismo `MODEL`/`RESULT`. Todas están **Implementadas**.
La columna "Dónde" indica en cuál(es) de los dos archivos existe la pestaña o función — el motor que
las alimenta es idéntico en ambos.

| ID | Qué hace | Dónde | Detalle |
|---|---|---|---|
| **K-01** | Pestaña **Asistencia** | Ambos | `computeAsistencia()`: A/S/F por día (Asistió / Asistió sin turno / No asistió). Independiente del motor de horas: agrupa marcaciones sueltas por día calendario, salvo cuando detecta un cruce de medianoche sin turno programado — señal de **paridad**: el día queda con número impar de marcaciones sueltas, la última cae en franja nocturna, y la primera del día siguiente cae dentro de ~4 h después del fin de esa franja (`cfg.nocFin+240`). Solo esa marcación puntual se reasigna, nunca el día completo, para no fundir dos jornadas normales consecutivas. |
| **K-02** | Pestaña **KPI Cumplimiento** | Ambos | `kpiCalcular()`: tres indicadores independientes con denominadores distintos — turno sin marca (% de días programados), turno incompleto (% de días programados), marcó sin turno (% de días evaluables). Exclusión de departamentos completos (`KPI_EXCL`, `localStorage.mb_kpi_excl`, pensada para cuentas no-empleado como `TARJETA`/`SNAPIT`). Aviso automático de cobertura (`#kpiCobertura`) cuando no todos los empleados en pantalla tienen marcación o programación cargada — evita leer huecos de datos como incumplimiento. |
| **K-03** | Pestaña **Calidad de marcación** *(no documentada hasta esta versión)* | Ambos | `computeCalidad()`: por departamento, % de días "limpios" vs. "sugeridos" (A-04 resuelto) vs. "bloqueados" (A-17 o A-04 sin resolución), horas limpias vs. dudosas, tarde/temprano contra tolerancia de puntualidad. Distingue **tasa** (qué tan bien marca ese departamento) de **peso** (cuánto del problema total representa) — un 69,5% sobre 11.507 días no es comparable a un 47,4% sobre 19. Marca `muestraCorta` a los departamentos con menos de `cMinDias` (default 60) días de datos, para no leer un solo día malo como una tendencia. |
| **K-04** | Pestaña **Cobertura y calidad** *(no documentada hasta esta versión)* | Ambos | `computeCobertura()`/`estadoCob()`: por empleado, tres porcentajes con denominadores deliberadamente distintos — `pctAsig` (¿le cargaron turno?, sobre días vigentes), `pctMarca` (¿marcó cuando debía?, sobre días con jornada), `pctCalidad` (cuando marcó, ¿marcó bien?, sobre días con marca). Prorrateado por la vigencia real del empleado (ingreso→`vigFin`), para no contar como hueco un día en que la persona no tenía por qué estar. |
| **K-05** | Pestaña **Calendario de turnos** | Ambos | `renderCal()`: vista mensual por empleado; permite asignar o quitar un cambio puntual de turno (**B-04**, persistido en `mb_overrides`). |
| **K-06** | Pestaña **Excepciones** | Solo completo (`reporte-horas.html`) | `renderExc()`/`aoaExc()`: listado filtrable de toda fila `exc` (BLOQ/ADV/INFO) generada por `compute()`. La versión RRHH no tiene esta pestaña, pero `renderExc()`/`aoaExc()` siguen viviendo en su código (se blindan solas con `if(!$('#tExc')) return;`) porque la **exportación combinada** de RRHH sí escribe la hoja de Excepciones — es la única vía por la que RRHH accede a ellas. |
| **K-07** | Pestaña **Glosario** | Solo completo | `renderGlosario()`: única función del motor que es exclusiva de `reporte-horas.html` a propósito — documentación en vivo de `NOV` y de la matriz D-01/D-08 para quien audite el reporte. |
| **K-08** | Exportaciones a Excel y archivo Sinergy | Ambos | `aoaCons()` (consolidado por empleado), `aoaDet()` (detalle día a día, incluye columnas `MIN CAFE RECONOCIDO`, `MIN LACTANCIA RECONOCIDO`, `MIN TRANSITO INTERIOR`, `MIN AUSENCIA POR PORTERIA`, `VENTANA REDONDEADA (T-EXTRA)`), `aoaExc()` (excepciones), `aoaCal()` (calendario mensual de un empleado), y `sinergyTxt()` (bloque H). |
| **K-09** | Panel de **Autorización de horas extra** | Ambos | UI de `AUTOR`/`mb_autor` — ver **F-03**/**F-09**. |
| **K-10** | Botón **Dispositivos** | Ambos | UI de `DISPOSITIVOS`/`mb_dispositivos`, `renderDisp()`/`guardarDisp()` — ver **DISPOSITIVO**. |
| **K-11** | Marca de **Confianza** y override de **Perfil** por empleado | Ambos | UI en Detalle — ver **CONFIANZA** y **B-06**. |
| **K-12** | Columnas ocultables en Detalle | Ambos | `COLS_OCULTAS`/`mb_colsDet` — preferencia de visualización, sin efecto en el cálculo. |

---

# PARÁMETROS DE CONFIGURACIÓN (`readConfig()`)

Los 31 campos que lee el motor. En `reporte-horas.html` viven todos en el panel "2 · Parámetros del
cálculo", siempre visible. En `reporte-horas-rrhh.html`, `cIni`/`cFin` quedan en la barra principal
("2 · Ciclo a procesar") y los otros 29 detrás del botón de engranaje (`#dlgConfig`), con un botón
explícito "Aplicar y recalcular" en vez de recalcular en cada tecla.

| id | Parámetro | Default | Condiciones que gobierna |
|---|---|---|---|
| `cIni` / `cFin` | Rango de fechas del ciclo | — | Universo de todo el cálculo |
| `cNocIni` / `cNocFin` | Franja nocturna | 19:00 / 06:00 | C-02, C-03 |
| `cUmbral` | Umbral semanal rotativos (h) | 42 | D-17, D-18 |
| `cAnclaje` | Anclaje de redondeo | Relativo | D-14 — **sin efecto real, ver la fila D-14** |
| `cDoble` | Ventana de agrupación de doble toque (min) | 5 | A-07 |
| `cImpar` | Resolución de marcaciones impares | Sugerir | A-04 |
| `cTolIni` / `cTolFin` | Tolerancia antes/después del turno para emparejar (min) | 120 / 360 | A-08 |
| `cAdmin` | Prefijo de turnos administrativos | `T_ADM` | B-06, D-23 |
| `cCorte` | Fecha de corte 0253→0252 / 0259→0258 | 2026-07-15 | H-06 |
| `cDesc` | Horas mínimas de descanso para descontarlo como almuerzo | 1 h | B-10, B-12 |
| `cDom` | ¿El domingo genera recargo dominical? | Sí | `dayType()` |
| `cDescRec` | ¿El descanso propio (no dominical) genera recargo? | No | `dayType()` |
| `cInfer` | ¿Inferir la marcación faltante desde el turno? | No | A-02 |
| `cTolPunt` | Tolerancia de puntualidad (min) | 5 | TARDE |
| `cCafeAdm` | Café para turnos que no lo declaran (min) | 20 | B-12 |
| `cLactMin6` | Tope diario de lactancia, etapa de 6 meses (min) | 60 | E-04 |
| `cLactMin24` | Tope diario de lactancia, etapa de 24 meses (min) | 30 | E-04 |
| `cTransAviso` | Avisar (B-16) si un tránsito interior supera (min) | 120 | B-16 |
| `cExtraPref` | Prefijo de turnos de solo extras | `T_EXTRA` | T-EXTRA |
| `cExtraPaso` | Paso de redondeo en turnos de extras (min) | 30 | T-EXTRA |
| `cMinDias` | Días mínimos para calificar la tasa de un departamento | 60 | K-03 (Calidad de marcación) |
| `cEscPrimer` | Minutos para la primera media hora de sobretiempo | 25 | D-28 |
| `cEscGracia` | Minutos de gracia por cada media hora siguiente | 10 | D-28 |
| `cSemIni` | Día en que arranca la semana del umbral | Domingo | D-30 |
| `cSemHora` | Hora en que arranca esa semana | 22:00 | D-30 |
| `cIngMasivo` | Empleados mínimos para considerar una fecha de ingreso "masiva" | 15 | ING-MASIVO |
| `cAutor` | Política de extras sin autorización | Calcular y marcar | F-09, F-03 |
| `cRedon` | Redondeo por día y concepto, o solo al total del ciclo | Por día | D.2 |

El **rol de cada biométrico** no es un campo de este formulario: se edita en el botón *Dispositivos* y
vive en `localStorage.mb_dispositivos` (ver tabla siguiente). Es, junto con `cEscPrimer`/`cEscGracia`,
lo que más pesa sobre las horas pendientes reportadas.

---

# ESTADO PERSISTENTE (`localStorage`)

Todas las claves usan el prefijo `mb_` y son **idénticas en ambos archivos** — se comparten si se
abren desde el mismo navegador y origen, pero no viajan con el archivo HTML si se copia a otra
máquina.

| Clave | Contenido | Se edita desde |
|---|---|---|
| `mb_overrides` | `"id\|fecha" → código de turno \| ''` (cambios puntuales) | Pestaña Calendario (**B-04**) |
| `mb_perfiles` | `id → 'ROTATIVO' \| 'ADMINISTRATIVO'` (override manual) | Selector "Perfil" en Detalle (**B-06**) |
| `mb_autor` | `id → [{ini, fin, estado, motivo}]` (autorización de extras) | Panel "Autorización de horas extra" (**F-09**/**F-03**) |
| `mb_confianza` | Lista de ids marcados como dirección/confianza/manejo | Checkbox en Detalle (**CONFIANZA**) |
| `mb_dispositivos` | `origen → 'PORTERIA' \| 'DESCANSO' \| 'INTERIOR'` | Botón "Dispositivos" (**DISPOSITIVO**) |
| `mb_kpi_excl` | Lista de departamentos (mayúsculas) excluidos del KPI | Pestaña KPI Cumplimiento (**K-02**) |
| `mb_colsDet` | Lista de claves de columna ocultas en Detalle | Selector de columnas en Detalle (**K-12**) |

---

# RESUMEN RECONCILIADO — estado real de implementación (v2.0)

Reemplaza la tabla "RESUMEN (del diseño original)" de v1.0. Cuenta cada fila de este catálogo,
incluidos los códigos nuevos y los ya usados por el código que no estaban numerados en el diseño
original (`ING-MASIVO`, `RETIRADO`, `CONFIANZA`, `DISPOSITIVO`, `T-EXTRA`, `TARDE`, `INFERIDO`,
`SUGERIDO`).

| Bloque | Total | Implementada | Reemplazada | Decisión de diseño | Parcial | No implementada | Por verificar |
|---|---|---|---|---|---|---|---|
| A · Marcaciones | 24 | 15 | 4 | 0 | 1 | 4 | 0 |
| B · Jornada programada | 17 | 14 | 1 | 2 | 0 | 0 | 0 |
| C · Segmentación | 10 | 8 | 2 | 0 | 0 | 0 | 0 |
| D · Clasificación | 32 | 22 | 4 | 0 | 1 | 5 | 0 |
| E · Empleado | 18 | 11 | 1 | 0 | 0 | 6 | 0 |
| F · Aprobación | 10 | 2 | 0 | 0 | 1 | 7 | 0 |
| G · Período y cierre | 10 | 0 | 0 | 0 | 0 | 10 | 0 |
| H · Archivo de salida | 15 | 12 | 0 | 0 | 0 | 2 | 1 |
| I · Invariantes | 12 | 6 | 0 | 0 | 1 | 5 | 0 |
| J · Conciliación | 7 | 0 | 0 | 0 | 0 | 7 | 0 |
| K · Reportes y salidas *(nuevo)* | 12 | 12 | 0 | 0 | 0 | 0 | 0 |
| **TOTAL** | **167** | **102** | **12** | **2** | **4** | **46** | **1** |

**Lectura honesta de estos números:** los bloques A a D (marcaciones, jornada, segmentación,
clasificación) e I (invariantes, en la parte que sí se puede probar sin backend) son donde vive el
motor real, y ahí la cobertura de "Implementada" + "Reemplazada" + "Decisión de diseño" es alta — el
código hizo casi todo lo que el diseño original pedía, y en varios casos (B-08, D-28/D-29/D-30) fue
más lejos de lo que el diseño original imaginaba posible sin backend. Los bloques F, G y J concentran
casi todo el "No implementada": son, en su enorme mayoría, flujos de proceso humano (bandeja de
aprobación, roles, cierre de período, conciliación con un sistema externo) que una herramienta local
de un solo archivo HTML, sin servidor ni base de datos, no puede ni debe automatizar sola. El bloque K
es enteramente nuevo: documenta funcionalidad que el código ya tenía y que ningún catálogo anterior
había registrado.
