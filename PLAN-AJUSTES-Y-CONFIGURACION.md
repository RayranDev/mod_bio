# Plan: ajustes de horario auditados y archivo de configuración

Estado: **diseño acordado con el usuario el 2026-11-17, pendiente de implementar.**
Lector: el agente que lo implementa. Leer `CLAUDE.md` completo ANTES de empezar: todas sus convenciones
aplican (motor duplicado idéntico en los dos HTML, validación ejecutando de verdad, mock de DOM que
devuelve `null` para lo no declarado, LF, commits convencionales sin atribución de IA, nunca subir datos).

---

## 1. Qué se pidió y por qué

1. **Corregir el turno de una persona** cuando BioTime lo cargó mal o no lo cargó, desde el **Detalle del
   empleado** con una lista desplegable, dejando **auditoría visual** (como las marcaciones impares: lo
   original sigue visible, tachado).
2. **Exportar e importar un archivo de configuración** con toda la parametrización de la herramienta.
   Motivo real: `localStorage` sobrevive a recargas y apagados, pero vive en un solo navegador de un solo
   PC (se pierde al borrar caché, al cambiar de equipo, no se comparte con otra persona de RRHH). Además,
   **los parámetros del formulario hoy NO se guardan en ningún lado**: una recarga los devuelve al default.

### Decisiones del usuario (no reabrir)

| Tema | Decisión |
|---|---|
| Dónde se edita | En el Detalle, una lista desplegable por día. El día ajustado queda con un **color propio** |
| Calidad de marcación | Usa el turno **ajustado**: un turno mal cargado no es culpa de quien marca |
| Adopción («¿tenía turno cargado?») | Sigue midiendo **BioTime original**, y suma la columna **«Días ajustados»** por departamento/persona |
| Indicador de turnos mal cargados | **Sin pestaña propia**: vive en Adopción (días ajustados) y en Calidad (cuánto cambió la calidad por los ajustes) |
| Nómina (Consolidado, Detalle, Sinergy, Resumen, Asistencia) | Usa el turno **ajustado** |

### Principio que no se rompe

El motor sigue siendo una **función pura**: Excel + parámetros + ajustes = mismo resultado. Un ajuste es un
**insumo corregido**, nunca una hora editada. El turno de BioTime **nunca se pisa**: se resuelve día por día.

---

## 2. Estado actual verificado (2026-11-17)

- `OVERRIDES` (`localStorage.mb_overrides`, `"id|fecha" → código|""`) ya existe y `shiftFor()` lo respeta
  (`source:'OVERRIDE'`). **Ninguna pantalla lo escribe**: solo se lee y se borra con `#btnClrOvr`
  («Limpiar cambios puntuales», en la barra del Calendario). Sin motivo, autor ni turno original.
  El Calendario pinta `.cal .d.ovr` con borde `--warn`.
- `shiftFor()` se llama en `compute` (~2089), `computeAsistencia` (~2607, ~2661), `estadoCob` (~3672),
  `renderCal` (~5780) y `aoaCal` (~5980) — números de línea de `reporte-horas.html`, verificar.
- `readConfig()` lee estos ids: `cIni cFin cNocIni cNocFin cUmbral cAnclaje cDoble cImpar cTolIni cTolFin
  cAdmin cCorte cDesc cDom cDescRec cInfer cRedon cTolPunt cAutor cAusAviso cAusGrave cIngMasivo cRetMasivo
  cEscPrimer cEscGracia cCafeAdm cLactMin6 cLactMin24 cTransAviso cExtraPref cExtraPaso cMinDias cSemIni
  cSemHora`. **Ojo:** la lista de `change → runCalc` del final del archivo completo NO incluye todos
  (faltan `cEscPrimer`, `cEscGracia`, `cSemIni`, `cSemHora`, `cCafeAdm`, `cLactMin6/24`, `cTransAviso`,
  `cExtraPref`, `cExtraPaso`, `cMinDias`). Unificar en una constante `PARAM_IDS` (ver Fase A).
- Persistido hoy en `localStorage`: `mb_overrides`, `mb_perfiles`, `mb_autor`, `mb_confianza`,
  `mb_dispositivos`, `mb_kpi_excl`, `mb_rot_meses`, `mb_colsDet`, `mb_colsCons`, `mb_colsAsis`.

Verificar todo esto contra el archivo antes de tocarlo: `CLAUDE.md` prohíbe trabajar de memoria.

---

## 3. Entrega en tres PR encadenados

Cada fase es un PR revisable por separado. Base: `main` si el PR #1 (Rotación) ya se fusionó; si no,
partir de `feat/rotation-tab` y apuntar el PR a esa rama. Preguntar al usuario si hay duda.

| Fase | Rama sugerida | Contenido |
|---|---|---|
| A | `feat/config-file` | Persistir parámetros + exportar/importar configuración |
| B | `feat/schedule-adjustments` | Ajustes de horario: motor, Detalle, Calendario, historial, excepciones, Excel |
| C | `feat/adjustment-indicators` | Calidad con delta por ajustes, Adopción con días ajustados, Consolidado |

---

## 4. Fase A — Parámetros persistentes y archivo de configuración

### A.1 Parámetros persistentes

- Constante compartida `PARAM_IDS` con **todos** los ids que lee `readConfig()`. La lista de `change →
  runCalc` del archivo completo pasa a usarla (en RRHH los parámetros se aplican con «Aplicar y
  recalcular»: respetar esa diferencia, no es divergencia).
- Al cargar la página (antes de cualquier render): capturar los **valores por defecto** del HTML en
  `PARAM_DEFAULTS` y luego aplicar los guardados en `localStorage.mb_params` (`{id: valor}`). Un id
  guardado que ya no existe en el HTML se ignora sin error.
- Guardar `mb_params` cada vez que cambia un parámetro (completo) o al «Aplicar» (RRHH).
- Botón **«Restaurar parámetros por defecto»** (con `confirm`) que vuelve a `PARAM_DEFAULTS`.

### A.2 Formato del archivo

Nombre: `mod_bio_config_AAAA-MM-DD_HHmm.json`. Un solo formato para las dos versiones.

```json
{
  "formato": "mod_bio-config",
  "version": 1,
  "generado": "2026-11-17T10:30:00",
  "herramienta": "completa | rrhh",
  "parametros":     { "cUmbral": "42", "cEscPrimer": "25", "...": "..." },
  "perfiles":       { "385": "ADMINISTRATIVO" },
  "confianza":      ["3956"],
  "autorizaciones": { "385": [{ "ini": "...", "fin": "...", "estado": "...", "motivo": "..." }] },
  "dispositivos":   { "Dispositivo-...": "INTERIOR" },
  "ajustesHorario": [],
  "alcance":        { "deptosExcluidos": ["TARJETA", "SNAPIT"] },
  "rotacion":       { "mesesNoConfiables": ["2026-04"] },
  "columnas":       { "detalle": [], "consolidado": [], "asistencia": [] }
}
```

- **NO incluye** los Excel ni la lactancia (datos personales, cambian cada mes, no se persisten por diseño).
- **Solo ids, nunca nombres.** Los textos libres (motivos) son del usuario; el placeholder del campo debe
  decir «No escribas datos personales».
- `ajustesHorario` queda como `[]` en la Fase A y se llena en la Fase B (misma `version: 1`: la clave es
  opcional al leer).

### A.3 Exportar

Botón **«Exportar configuración»** en el encabezado de los dos archivos (en RRHH, junto al `⚙`). Arma el
objeto desde el estado en memoria (no desde `localStorage` crudo) y lo descarga con `Blob`.

### A.4 Importar

Botón **«Importar configuración»** → `<input type="file" accept=".json">` → diálogo `#dlgImportCfg`:

1. **Validar todo antes de aplicar nada** (atómico): JSON legible, `formato === 'mod_bio-config'`,
   `version` soportada, cada sección con el tipo correcto. Claves desconocidas → aviso, se ignoran. Si
   algo falla, mostrar el error y no tocar ningún estado.
2. **Vista previa**: conteo por sección («3 perfiles, 1 confianza, 4 dispositivos, 12 ajustes…») y la
   lista de parámetros que **cambian** (`valor actual → valor nuevo`).
3. **«Reemplazar»** (único modo en esta versión; la fusión queda para después): escribe cada clave en
   `localStorage`, **muta en sitio** los globales (`PERFILES`, `AUTOR`, `DISPOSITIVOS` son `const`:
   vaciar y `Object.assign`; `CONFIANZA`, `KPI_EXCL`, etc. se reasignan si son `let`), pone los valores
   del formulario, re-aplica columnas, y si hay `RESULT` llama `runCalc()`. **Nunca recargar la página**:
   se perderían los Excel cargados.

### A.5 Pruebas (`scripts/pruebas_motor/prueba_config.js`)

- Ida y vuelta: estado → exportar → limpiar → importar → estado idéntico (las 9 secciones).
- Archivo inválido (JSON roto, formato ajeno, versión futura, tipo erróneo en una sección) → no se aplica
  nada, ni parcialmente.
- `mb_params` se aplica al arrancar; id desconocido ignorado; «Restaurar» vuelve a los defaults del HTML.
- Los dos archivos exportan el mismo formato y cada uno importa el del otro.
- Mock de DOM con `null` para lo no declarado (versión RRHH).
- Sin tocar nada: huella de nómina y exportaciones idénticas a antes.

---

## 5. Fase B — Ajustes de horario

### B.1 Modelo de datos

`localStorage.mb_ajustes_horario` → `AJ_HORARIO` (array), y una entrada por ajuste:

```js
{
  id: 'aj-<timestamp>-<rand>',
  emp: '385',
  desde: '2026-09-14', hasta: '2026-09-20',      // rango inclusivo; por defecto desde = hasta = el día
  turno: 'T_NORMAL1',                            // '' = «sin turno (descanso)»
  motivo: 'NO_CARGADO' | 'EQUIVOCADO' | 'CAMBIO_NO_REGISTRADO' | 'OTRO',
  nota: 'texto libre',                           // obligatoria si motivo = OTRO
  autor: 'texto libre',                          // se recuerda en localStorage.mb_ajuste_autor
  creado: '2026-11-17T10:30:00',
  anulado: null | { autor, en, motivo }          // anular NO borra: queda en el historial
}
```

Etiquetas de los motivos: «Turno no cargado en BioTime», «Turno equivocado», «Cambio de turno no
registrado en BioTime», «Otro».

**Migración:** al arrancar, cada entrada de `mb_overrides` se convierte en un ajuste de un día con
`motivo:'OTRO'`, `nota:'Migrado de un cambio puntual anterior'`, `autor:'(migrado)'`; luego se borra
`mb_overrides`. `OVERRIDES` desaparece del código (actualizar la lista de `CLAUDE.md` y `prueba_identidad.js`).

### B.2 Motor

- `buildModel()` copia los ajustes **vigentes** (no anulados) a `MODEL.ajustes`, indexados por
  `emp → [ajustes]`. El motor lee **`M.ajustes`, nunca el global**: así se puede calcular la línea base
  pasando un modelo sin ajustes y `compute()` sigue siendo pura.
- `shiftFor(M, id, iso)`: si algún ajuste vigente cubre `iso`, **gana el de `creado` más reciente** y
  devuelve `{ code: turno||null, source:'AJUSTE', ajuste, original: <lo que daría BioTime> }`. Si no,
  la lógica de hoy (`PLAN` / `MULTI` / `NONE`).
- **Ajuste con código de turno inexistente** en el archivo de Turno cargado: **no se aplica** (manda
  BioTime) y se emite una excepción ADV. Nunca inventar un turno.
- **Ajuste redundante** (el turno ajustado coincide con el de BioTime): se aplica (no cambia nada) y se
  marca «ya coincide con BioTime: se puede anular» en el historial. Es la señal de que BioTime ya se
  corrigió.
- Los días fuera de la vigencia de la persona (antes del ingreso real, después de `vigFin`) siguen fuera:
  un ajuste no los revive.
- Cada fila del ciclo lleva `r.ajuste` (id) y `r.turnoOriginal` cuando el turno salió de un ajuste.
- **Línea base** para medir el impacto: `computeBase(M, cfg)` corre `compute()` sobre un modelo **sin
  ajustes y solo con las personas que tienen ajustes** (la bolsa semanal es por persona, así que es
  correcto). Verificar en el código cómo `compute()` arma su universo; si no se puede recortar limpio,
  calcular la base completa y medir el tiempo (si pasa de ~2 s con datos reales, avisar al usuario).
  `RESULT.base` guarda esas filas.

### B.3 Excepción

Código nuevo `AJ-H` (INFO), **una por ajuste**, no por día (lección de A-16/A-18): «Turno ajustado del
14-sep al 20-sep: T_NORMAL1 (antes: sin turno). Motivo… Autor…». El turno inexistente sale como ADV con
el mismo código. Agregar `AJ-H` a `NOV`/`CONC_DESC` si corresponde y al `CATALOGO-CONDICIONES.md`.

### B.4 Interfaz — Detalle (los dos archivos)

- La celda del turno de cada día pasa a ser un `<select>` con los turnos del archivo de Turno, más
  «Sin turno (descanso)». El valor mostrado es el turno **aplicado**.
- Cambiar el valor **no aplica directo**: abre `#dlgAjuste`, prellenado con persona, día, turno elegido y
  `hasta = ese día`. Campos: **motivo (obligatorio)**, nota (obligatoria si «Otro»), hasta, autor.
  «Cancelar» devuelve el `<select>` a su valor anterior. «Guardar» agrega el ajuste, persiste,
  `runCalc()` y **vuelve a la misma persona y al mismo día** (no perder la posición de la tabla).
- Día con ajuste: clase `aj`, color **propio** con un token nuevo `--adj` (violeta), definido en `:root`
  claro y oscuro **idéntico en los dos archivos** (ver la lección de las barras negras en `CLAUDE.md`).
  **No usar `--warn`**: un ajuste es una decisión, no una alerta.
- El turno original se muestra **tachado** (`<s>`) junto al aplicado, igual que las marcaciones impares.
- Chip `AJ-H` en el día con `data-tip`: motivo, nota, autor, fecha y **el impacto en el día** (ordinarias,
  extras, recargos, pendientes: antes → ahora, desde `RESULT.base`). Aviso en el tooltip: con bolsa
  semanal, el efecto puede caer en otro día de la misma semana.
- Tarjeta en el encabezado del Detalle: «Ajustes de horario: N días · impacto en el ciclo: extras −2 h,
  recargos +1 h, pendientes −8 h» (diferencia total de la persona contra la base).
- Botón «Quitar ajuste» en el día ajustado → pide motivo y **anula** (no borra).
- **Días sin fila:** verificar si el Detalle muestra los días sin turno y sin marcaciones. Si no, el campo
  «hasta» del diálogo los cubre; no inventar filas nuevas sin preguntar.

### B.5 Calendario e historial

- El Calendario pinta los días ajustados con `--adj` (reemplaza `.ovr` con `--warn`). Solo lectura.
- `#btnClrOvr` («Limpiar cambios puntuales») se reemplaza por **«Ajustes de horario»**, que abre
  `#dlgAjustes`: lista de todos los ajustes (vigentes, anulados, redundantes, con turno inexistente),
  filtro por persona, enlace al día en el Detalle y botón «Anular» con motivo. **No hay borrado masivo**:
  romperías la auditoría.

### B.6 Exportaciones

- **Regla de oro: sin ajustes, todas las exportaciones son idénticas byte a byte a las de antes.** Las
  columnas nuevas aparecen **solo si hay al menos un ajuste**, y siempre **al final** (misma convención
  que `ETAPA LACTANCIA`) para que ninguna columna se corra.
- Excel del Detalle: `TURNO ORIGINAL`, `AJUSTE MOTIVO`, `AJUSTE AUTOR`.
- «Exportar detalle completo»: hoja **«Ajustes de horario»** con todos los ajustes (también anulados),
  respetando los filtros del Consolidado como la hoja de Excepciones (`consFiltrado()`). Solo ids.
- Archivo de configuración: la sección `ajustesHorario` ahora sí se llena e importa.
- El TXT de Sinergy no cambia de formato: lleva lo ajustado porque es la nómina.

### B.7 Pruebas (`scripts/pruebas_motor/prueba_ajustes.js`)

- Sin ajustes: huella de nómina y todas las exportaciones idénticas a la copia previa, en los dos archivos.
- Día trabajado sin turno → ajuste a un turno: las horas que salían como extra pasan a ordinarias según el
  turno; I-01/I-02/I-03 = 0.
- Turno equivocado (diurno ↔ nocturno): los recargos se reclasifican; la suma de conceptos se explica.
- Rango de varios días, gana el más reciente, el anulado no se aplica, el redundante se marca, el código
  inexistente no se aplica y emite ADV, fuera de vigencia no revive el día.
- `computeBase()` == `compute()` sin ajustes para esas personas.
- Migración de `mb_overrides`.
- Interfaz: el diálogo exige motivo; «Cancelar» revierte el `<select>`; tras guardar se vuelve al mismo día.
- RRHH con mock `null` para lo no declarado.

---

## 6. Fase C — Indicadores

### C.1 Calidad de marcación (`cal2`)

- La calidad principal se calcula sobre el resultado **ajustado** (como hoy sobre `RESULT`).
- Nueva lectura: la misma calidad con la **plantilla original** (`computeCalidad` sobre el resultado base
  para las personas con ajustes y el actual para el resto). Tarjeta: «Calidad 81,2 % · con la plantilla
  original 76,0 % · +5,2 pts por N días ajustados».
- Tabla por departamento: columna **«Δ por ajustes (pts)»**. Clic sigue abriendo las personas, que
  también muestran su delta. Excel: las mismas columnas.

### C.2 Adopción (`cob`)

- **Sigue midiendo BioTime original**: `computeCobertura` debe recibir el modelo **sin ajustes** (y el
  resultado base para las filas), porque `estadoCob()` llama `shiftFor()` y, si no, el turno corregido
  se filtraría al indicador. Verificar con una prueba que los ajustes **no** cambian ninguna cifra de
  Adopción.
- Columna nueva **«Días ajustados»** por departamento y por persona, y una tarjeta con el total. Se puede
  ordenar por ella (lo accionable: dónde se carga mal la programación). Excel: la misma columna.

### C.3 Consolidado

Columna «Ajustes» (días ajustados de la persona) con `data-col="aj"` en el selector de columnas, y al
final del Excel `DIAS CON AJUSTE DE HORARIO` (solo si hay ajustes).

### C.4 Pruebas

Ampliar `prueba_ajustes.js` (o `prueba_indicadores_ajustes.js`): Adopción invariable ante ajustes, Calidad
sube cuando el ajuste corrige días que antes eran «sin turno», delta por departamento correcto a mano,
los dos archivos pintan igual, exportaciones rectangulares.

---

## 7. Cierre de cada fase

1. Correr **todas** las pruebas de `scripts/pruebas_motor/` en los dos archivos.
2. Revisión con contexto fresco del diff antes del commit (regla de `CLAUDE.md`).
3. Actualizar `CLAUDE.md`: la lista de funciones compartidas, una sección «Ajustes de horario» y otra
   «Archivo de configuración» con lo verificado (cifras reales solo si las dio el usuario).
4. Agregar `mod_bio_config_*.json` al `.gitignore` (puede traer ids y motivos).
5. Decirle al usuario qué **no** se pudo verificar: datos reales (huella con ~1.000 empleados) y lo
   visual (color `--adj` en claro y oscuro, el diálogo, el tachado). Eso lo revisa él en el navegador.
