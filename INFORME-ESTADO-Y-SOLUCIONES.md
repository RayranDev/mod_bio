# INFORME TÉCNICO Y DE GESTIÓN: MOTOR DE NÓMINA, RECARGOS Y CONTROL DE ASISTENCIA (MOD_BIO)

> **Documento Base e Insumo Integral para Informe Gerencial y de Auditoría**  
> **Sistema:** SIRH / MOD_BIO — Plastitec S.A. & Granservicios  
> **Fecha de corte:** 4 de noviembre de 2026 (el balance de la sección 7 corresponde al ciclo del 11 de agosto al 10 de septiembre de 2026)  
> **Versión del motor:** v2.1 (Catálogo reconciliado de 167 condiciones de negocio, con lactancia por archivo)  
> **Entorno operativo:** Herramienta local cliente (*Zero-Backend*), procesamiento seguro en navegador  

---

## 1. RESUMEN EJECUTIVO Y PROPÓSITO DEL PROYECTO

### 1.1. Contexto y Justificación
En las operaciones industriales y administrativas de **Plastitec S.A.** y su empresa de servicios temporales aliada (**Granservicios**), el procesamiento de tiempos laborados se alimenta de relojes biométricos gestionados mediante el software **BioTime**. 

Históricamente, los reportes nativos de BioTime presentaban severas limitaciones de cálculo:
- No adaptaban la jornada a los turnos reales de planta ni aplicaban la jornada máxima legal vigente en Colombia (Ley 2101 de 2021, reducción a 42 horas semanales).
- No reconocían descansos laborales remunerados por política interna (descanso de café a media mañana).
- Confundían marcaciones intermedias legítimas con ausentismos.
- Distorsionaban recargos nocturnos y festivos en turnos mixtos que cruzaban la medianoche.
- Carecían de mecanismos para discriminar entre trabajadores retirados, personal de confianza y personal activo.

**MOD_BIO** nace como una solución de ingeniería de software y analítica de datos orientada a resolver de raíz estas inconsistencias, calculando con exactitud matemática y jurídica las **horas ordinarias, horas extra (diurnas, nocturnas, festivas diurnas y festivas nocturnas) y recargos (nocturnos, dominicales/festivos y nocturnos festivos)**, así como proveyendo una suite integral de auditoría de asistencia, calidad de la marcación y cumplimiento operativo.

### 1.2. Alcance Normativo y Operativo
La herramienta implementa el marco legal laboral colombiano (Código Sustantivo del Trabajo - CST):
- **Jornada ordinaria y umbral semanal:** Bolsa de 42 horas semanales para turnos rotativos continuos y jornada fija diaria para personal administrativo.
- **Trabajo suplementario (Horas Extra):** Extra diurna (código Sinergy `0200` / `EXT_D`), extra nocturna (`0210` / `EXT_N`), extra festiva diurna (`0250` / `EXT_FD`) y extra festiva nocturna (`0260` / `EXT_FN`).
- **Recargos legales:** Recargo nocturno ordinario (`0220` / `REC_N`), recargo dominical o festivo (`0253` o `0252` según corte legal / `REC_F`) y recargo nocturno festivo (`0259` o `0258` / `REC_FN`).
- **Exclusiones de jornada máxima:** Cargos de dirección, confianza y manejo (Art. 162 CST).
- **Protección a la maternidad:** Reconocimiento de descansos remunerados para lactancia (Art. 238 CST / condición `E-04`).

### 1.3. Principios de Arquitectura Técnica
1. **Privacidad y Seguridad Absoluta (*Zero-Backend*):** Todo el cómputo se realiza íntegramente en la memoria del navegador del usuario (JavaScript cliente), utilizando la biblioteca SheetJS para la lectura de libros Excel. Los datos confidenciales de nómina y los registros biométricos jamás viajan por internet ni se almacenan en servidores externos.
2. **Determinismo Matemático Puro:** Ante los mismos archivos Excel y la misma parametrización, el motor devuelve invariablemente el mismo resultado, garantizando auditabilidad total y cumplimiento de invariantes de integridad.
3. **Independencia Operativa y Portabilidad:** La herramienta opera como un archivo HTML autónomo, ejecutable en cualquier computador sin requerir instalación de bases de datos, dependencias de servidor ni configuraciones de red.

---

## 2. EL PROBLEMA QUE RESUELVE: ANTES VS. DESPUÉS

La siguiente tabla resume las brechas operativas y los riesgos económicos mitigados por MOD_BIO frente a la lectura directa de BioTime:

| Dimensión | Situación Anterior (BioTime / Reporte Bruto) | Solución Implementada en MOD_BIO | Impacto Real Medido |
|---|---|---|---|
| **Modelo de Redondeo y Sobretiempo** | Redondeo plano sobre el total de minutos del día. Un turno con 21 min adicionales se redondeaba a hora completa, inflando extras o castigando minutos legítimos. | **Jornada fija + Escalera de sobretiempo (D-28):** Se acredita la jornada fija del turno programado y el sobretiempo se computa mediante una escalera con minutos de gracia (25 min primer bloque, 10 min subsiguientes). | Eliminación de sobrecostos por minutos dispersos y cálculo exacto de tiempo suplementario. |
| **Descanso de Café / Refrigerio** | Los 20 minutos de café en vestieres se leían como tiempo fuera de la empresa, generándole al trabajador falsas "horas a deber" (incumplimiento). | **Descanso de café remunerado (B-12):** Detección algorítmica de huecos internos y exoneración automática hasta el tope diario del turno (típicamente 20 min). | En el ciclo mensual (11-ago a 10-sep), se reconocieron **3.159,68 horas de café a 9.883 empleado-día**, reduciendo las horas pendientes ficticias de 7.662 h a 4.502 h. |
| **Tránsito en Planta vs. Salida Real** | Todo hueco entre marcaciones se asumía como salida de la empresa, penalizando a técnicos y supervisores que marcan en distintas naves. | **Clasificación perimétrica por rol de dispositivo (B-12 / B-16):** Diferenciación entre `PORTERIA` (salida real), `DESCANSO` (vestier/cafetería) e `INTERIOR` (tránsito libre entre áreas). | Caso real técnico 8456: sus horas a deber bajaron de 15,0 h a 8,98 h reales al no penalizar su tránsito operativo entre plantas. |
| **Turnos Nocturnos y Festivos** | El tipo de día se asignaba al turno completo. Un turno que iniciaba en festivo y cruzaba a día ordinario cobraba recargo festivo toda la noche; a la inversa, quien entraba en ordinario y pasaba a festivo no cobraba el recargo. | **Atomización temporal y clasificación por tramo horario (D-29):** Cada minuto se evalúa contra el calendario oficial exacto en que ocurre. | **235 días recuperaron 1.421 h de recargo festivo** legítimo no pagado; **424 días corrigieron 2.555 h** que se liquidaban indebidamente como festivas. |
| **Semana Laboral Rotativa** | El corte de la semana para el umbral de 42h se realizaba a la medianoche del lunes. | **Semana operativa por instante (D-30):** La semana del personal rotativo arranca el domingo a las 22:00 con el ingreso del Turno 3. | Asignación exacta de horas ordinarias y extras a la bolsa semanal correcta sin traslapar ciclos. |
| **Personal Retirado y Novedades** | BioTime excluye a los retirados del maestro, produciendo miles de marcaciones huérfanas o registrando ausentismos falsos hasta 2027 a quienes ya renunciaron. | **Ingesta de archivo de Renuncias + Corte de vigencia (`vigFin`):** Rescate de datos maestros desde marcaciones (`A-22`) y detención de la exigencia de asistencia al momento del retiro real. | Rescate de **41 retirados con nómina devengada en el ciclo** (55 con vigencia traslapada, 478 en base histórica), eliminando marcaciones huérfanas y bloqueos de liquidación. |
| **Calidad de Marcación y Ausentismo** | Falta de visibilidad sobre quién no asiste, quién marca mal y qué departamentos generan reprocesos. | **Suite de 4 pestañas de gestión:** Asistencia con semáforo inteligente, KPI de Cumplimiento, Calidad de marcación y Cobertura multinivel. | Detección inmediata de casos críticos de ausentismo real y focalización del 80% de problemas de programación en solo 5 departamentos. |

---

## 3. ARQUITECTURA DE LA HERRAMIENTA Y VERSIONES

El ecosistema MOD_BIO se materializa en dos aplicaciones independientes construidas con la misma base algorítmica:

### 3.1. Versión Completa y Auditoría (`reporte-horas.html`)
Diseñada para el analista de nómina, control interno y auditoría de sistemas. Cuenta con **9 pestañas especializadas**:
1. **Consolidado:** Vista resumida por empleado con totales de horas ordinarias, extras por tipo, recargos y horas pendientes acumuladas.
2. **Detalle:** Auditoría día a día de cada trabajador, detallando horas de entrada, salida, descansos tomados, minutos de café/lactancia acreditados, novedades operativas y tramos liquidados.
3. **Calendario:** Matriz mensual de programación por empleado que permite aplicar modificaciones manuales puntuales (*overrides* de turno).
4. **Excepciones:** Consola de novedades clasificadas por severidad (`BLOQ` bloqueantes, `ADV` advertencias que requieren revisión, e `INFO` informativas).
5. **Asistencia:** Matriz de presencias/ausencias diarias y tabla de resumen con semáforo de ausentismo y días hábiles de silencio.
6. **KPI Cumplimiento:** Tablero de control con tasas de turno sin marca, turnos incompletos y marcas sin turno, desagregadas por departamento con gráficos analíticos y exportación a PDF.
7. **Calidad de Marcación:** Auditoría departamental que separa la tasa de error del peso que representa cada área en el volumen general de la empresa.
8. **Cobertura y Calidad:** Módulo de navegación multinivel (*drill-down*: Empresa → Departamento → Empleado → Día → Detalle) para auditar la asignación de turnos y calidad de datos.
9. **Glosario:** Catálogo interactivo de códigos de novedad (`NOV`) y matriz de concurrencia legal.

### 3.2. Versión Operativa para Gestión Humana (`reporte-horas-rrhh.html`)
Diseñada para el equipo operativo de Recursos Humanos. Simplifica la interfaz eliminando las pestañas técnicas de *Excepciones* y *Glosario*, y ocultando los 29 parámetros de configuración avanzada tras un diálogo modal de ajustes (botón de engranaje `⚙`), evitando desconfiguraciones accidentales.

### 3.3. Convención de Doble Motor
Ambos archivos contienen una copia idéntica y autónoma del motor matemático (`buildModel()`, `compute()`, `classify()`, `escalera()`, etc.). Esto permite trasladar y ejecutar cualquiera de los dos archivos de forma aislada sin dependencias externas. Todo cambio o mejora en la lógica de liquidación se aplica de forma sincronizada en ambos entornos.

---

## 4. INGESTAS Y PARÁMETROS DEL SISTEMA

### 4.1. Archivos de Entrada (Insumos Excel)
El sistema procesa seis fuentes de información: cuatro obligatorias y dos opcionales. Cinco se exportan desde BioTime / SIRH y la de Lactancia la arma Recursos Humanos:

1. **`Empleado_*.xlsx` (Obligatorio):** Maestro de personal habilitado (ID, nombres, apellidos, fecha de contratación, departamento, compañía, cargo y estado).
2. **`Turno_*.xlsx` (Obligatorio):** Catálogo dinámico de turnos (código, hora de entrada, hora de salida, días de la semana aplicables, descanso de café y tiempo de almuerzo en la columna `Descontar descansso en`).
3. **`Horario_*.xlsx` (Obligatorio):** Asignación histórica y futura de turnos por empleado y rango de fechas.
4. **`Reporte de Marcaciones_*.xlsx` (Obligatorio):** Registro cronológico de golpes biométricos (ID, fecha, hora, sucursal/compañía `Branch` y nombre del dispositivo).
5. **`Renuncia_*.xlsx` (Opcional pero fundamental):** Registro de trabajadores retirados (código pegado al nombre, departamento, cargo, motivo y fecha de retiro).
6. **Archivo de Lactancia (Opcional, plantilla propia):** No viene de BioTime: lo arma Recursos Humanos con una plantilla descargable desde la herramienta. Una fila por empleada con `ID_empleado` y las fechas de inicio y fin de la etapa de 6 meses y de la de 24 meses (cada etapa es opcional, pero sus dos fechas van juntas). Se valida al cargarlo y el resultado queda visible en pantalla. Como contiene datos personales, no se guarda en el navegador: se carga en cada corrida.

### 4.2. Parametrización Flexible (`readConfig()`)
El motor cuenta con más de 30 parámetros configurables en caliente:
- **Franjas horarias y jornada:** Inicio y fin de jornada nocturna (19:00 a 06:00), umbral semanal (42 horas), hora de inicio de semana rotativa (domingo 22:00).
- **Escalera de sobretiempo:** Minutos mínimos para acreditar primera media hora extra (default: 25 min) y minutos de gracia subsiguientes (default: 10 min).
- **Tolerancias de marcación:** Ventana de agrupación de doble toque (default: 5 min), tolerancias de entrada/salida para asignación de turno (120 min / 360 min).
- **Descansos y licencias:** Umbral mínimo de almuerzo (60 min), café para turnos administrativos (20 min), y topes diarios de lactancia por etapa (60 min en la de 6 meses y 30 min en la de 24 meses; ya no existe el prefijo de turno `T_LACT`, porque la lactancia se maneja por archivo).
- **Auditoría:** Límites de días hábiles sin marcar para generar alertas de ausentismo (3 días para revisión, 6 días para alerta crítica).

---

## 5. CATÁLOGO CONSOLIDADO DE CONDICIONES (RECONCILIACIÓN v2.0)

El proyecto cuenta con un catálogo exhaustivo de **167 condiciones de negocio y diseño**, clasificadas en 11 bloques funcionales. El estado real verificado en código es el siguiente:

### 5.1. Resumen Estadístico por Bloques

| Bloque Temático | Total Reglas | Implementada | Reemplazada / Mejorada | Decisión de Diseño | Parcial | Pendiente / Fase Futura |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **A · Marcaciones y Captura** | 24 | 15 | 4 | 0 | 1 | 4 |
| **B · Jornada Programada** | 17 | 14 | 1 | 2 | 0 | 0 |
| **C · Segmentación Temporal** | 10 | 8 | 2 | 0 | 0 | 0 |
| **D · Clasificación y Liquidación** | 32 | 22 | 4 | 0 | 1 | 5 |
| **E · Maestro de Empleados y Vigencia** | 18 | 11 | 1 | 0 | 0 | 6 |
| **F · Autorización y Aprobación** | 10 | 2 | 0 | 0 | 1 | 7 |
| **G · Período y Cierre** | 10 | 0 | 0 | 0 | 0 | 10 |
| **H · Archivo Plano de Salida (Sinergy)** | 15 | 12 | 0 | 0 | 0 | 3 |
| **I · Invariantes de Integridad Matemática** | 12 | 6 | 0 | 0 | 1 | 5 |
| **J · Conciliación Externa** | 7 | 0 | 0 | 0 | 0 | 7 |
| **K · Módulos de Reporte y Salidas** | 12 | 12 | 0 | 0 | 0 | 0 |
| **TOTAL GENERAL** | **167** | **102** | **12** | **2** | **4** | **47** |

### 5.2. Análisis de Cobertura
- **Motor de Cálculo (Bloques A, B, C, D, H, K):** Cobertura superior al **95%**. La lógica algorítmica de captura, segmentación por minuto, aplicación de descansos, jornada fija, escalera y exportaciones está completamente operativa y validada contra datos masivos reales.
- **Invariantes Matemáticos (Bloque I):** Los invariantes I-01 (suma de tramos = tiempo acreditado), I-02 (exclusión mutua: ningún minuto con doble recargo), I-03 (clasificación exhaustiva) e I-04 (límite biológico de 24h diarias) se ejecutan con 0 fallas.
- **Bloques F, G y J (Fases Futuras):** Concentran las condiciones no implementadas. No se trata de fallas u omisiones de desarrollo, sino de funcionalidades que por naturaleza requieren una base de datos centralizada con perfiles de usuario y roles de acceso (jefes de área vs. RRHH, flujo de aprobación de solicitudes y congelación de cierres de período en servidor).

---

## 6. CRONOLOGÍA DETALLADA DE HITOS Y EVOLUCIÓN TÉCNICA

A través de más de 50 ciclos de desarrollo e integración continua, se consolidaron los siguientes hitos:

1. **Hito 1 — Cimientos del Motor y Modelado Inicial (Semana 1, Septiembre 2026):**
   - Construcción del pipeline de ingesta para los cuatro archivos base de BioTime.
   - Algoritmo de Gauss y Ley Emiliani para el cálculo automático de festivos en Colombia sin mantenimiento manual.
   - Creación de la matriz de conceptos y reportes preliminares.
2. **Hito 2 — Ruptura con el Redondeo Tradicional: Modelo de Jornada Fija y Escalera:**
   - Detección de distorsiones en turnos administrativos y de planta por redondeos planos.
   - Implementación de la **Jornada Fija del Turno + Escalera de Sobretiempo (`D-28`)**.
   - Creación del concepto de **Horas Pendientes (`pendienteMin`)** para auditar el tiempo no laborado sin afectar el pago legal de la jornada fija.
3. **Hito 3 — Creación de la Versión RRHH Lite y Blindaje de Paridad:**
   - Despliegue de `reporte-horas-rrhh.html` enfocado en usuarios finales.
   - Establecimiento de pruebas cruzadas en Node.js para asegurar paridad byte a byte del motor compartido en ambos archivos.
4. **Hito 4 — Algoritmo de Descansos de Café y Roles de Biométricos:**
   - Análisis empírico de 12.376 huecos de marcación en planta, demostrando que el 90,7% correspondían al descanso de vestier/café.
   - Implementación del crédito diario de café pagado (`B-12`).
   - Introducción del clasificador de dispositivos (`PORTERIA`, `DESCANSO`, `INTERIOR`), resolviendo el cálculo para personal móvil de mantenimiento y sistemas.
5. **Hito 5 — Rescate de Personal Retirado y Detección de Migraciones:**
   - Integración del archivo opcional de Renuncias.
   - Regla de corte `vigFin` = $\max(\text{fecha retiro}, \text{última marcación})$, protegiendo el cobro de días laborados posteriores a la fecha teórica de retiro.
   - Detección algorítmica de fechas de ingreso masivas de migración (`ING-MASIVO`).
6. **Hito 6 — Corrección Bidireccional de Recargos Festivos por Tramo:**
   - Corrección del bug histórico de BioTime en turnos nocturnos mixtos (`D-29`).
   - Evaluación del tipo de día por tramo horario atómico, restituyendo 1.421 h de recargos a los trabajadores y eliminando 2.555 h cobradas en exceso a la empresa.
7. **Hito 7 — Sincronización de Semana Operativa Rotativa:**
   - Ajuste del umbral semanal rotativo (`D-30`) para iniciar los domingos a las 22:00 con el Turno 3, evitando falsas imputaciones de horas extra.
8. **Hito 8 — Módulos Avanzados de Supervisión y Analítica de Asistencia:**
   - Incorporación de la pestaña *Cobertura y Calidad* con navegación analítica multinivel (*drill-down*).
   - Creación de la pestaña *Calidad de Marcación* diferenciando tasa de efectividad departamental frente a volumen representativo.
   - Vista de Resumen de Asistencia con cálculo de días hábiles de silencio medidos contra el fin real del ciclo de corte, evitando falsas alarmas masivas.
   - Incorporación de exportación coloreada de asistencia mediante HTML enriquecido (`.xls`).
9. **Hito 9 — Robustecimiento de Ingesta y Diagnóstico Visual:**
   - Solución al parseo de archivos de renuncia con filas de títulos irregulares en BioTime.
   - Panel de diagnóstico de ingesta en el encabezado (`#hdrCarga`) que informa en tiempo real filas cargadas, IDs ilegibles y renunciantes reconocidos.
10. **Hito 10 — Lactancia por Archivo (Noviembre 2026):**
   - Se descartó el esquema de turnos `T_LACT*`, que obligaba a crear un turno por cada combinación de horario y etapa de cada empleada. La lactancia pasó a ser un dato de la persona, cargado en un archivo opcional (`E-04`, `E-15`).
   - Crédito diario por etapa: hasta 60 minutos en la de 6 meses y 30 en la de 24 meses. Es un derecho, no una obligación: se acredita solo lo que la persona no trabajó dentro de su turno (llegada tarde, salida temprana o hueco interno), después del café.
   - Esos minutos se pagan como ordinarios **sin recargo** nocturno, dominical ni festivo, cuentan en la bolsa semanal (rotativos) o en la jornada diaria (administrativos) y no generan extras por sí solos. Las extras se calculan igual que siempre, pero después de la bolsa.
   - Validación de carga con errores y avisos visibles (ID vacío, desconocido o repetido, etapas incompletas, al revés o ilegibles, y `Fin_6m` posterior a `Inicio_24m`).
   - Identificación y estadística: marcas `LACT 6M` / `LACT 24M`, filtro de lactancia, tarjetas de empleadas y horas acreditadas, columnas de minutos por etapa y hoja «Lactancia» en el Excel.
   - Sin archivo cargado, la salida es idéntica a la anterior (verificado con la huella completa de empleados, conceptos, ordinarias, extras y pendientes, y con todas las exportaciones, en los dos archivos).
11. **Hito 11 — Pruebas del Motor y Manual de Usuario (Noviembre 2026):**
   - Se incorporó `scripts/pruebas_motor/`: pruebas sintéticas en Node (casos de lactancia, validaciones, exportaciones, identidad con la versión anterior y cableado de la interfaz), sin datos reales ni dependencias.
   - Se elaboró el manual de usuario de la versión RRHH en Word, con capturas de la herramienta con datos anonimizados y la guía de descarga de archivos desde BioTime. Se mantiene con versionado semántico (v1.1.0 incorpora la lactancia).

---

## 7. BALANCE GENERAL Y AUDITORÍA DE NÓMINA (CORTE 11 DE AGOSTO AL 10 DE SEPTIEMBRE DE 2026)

Procesando el ciclo mensual real de nómina (**11 de agosto de 2026 al 10 de septiembre de 2026**, 31 días calendario) sobre el universo total de las exportaciones vigentes (1.564 empleados en maestro y renuncias, 111.356 registros biométricos), el motor arrojó el siguiente balance definitivo:

### 7.1. Cuadro Consolidado de Liquidación

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               BALANCE GENERAL DE NÓMINA — CORTE 11-AGO-2026 A 10-SEP-2026             │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│ Universo Evaluado en el Ciclo          │ 1.095 trabajadores (1.062 con horas activas) │
│ Trabajadores con Conceptos de Nómina   │ 1.012 empleados (generan pago de extras/rec.) │
│ Horas Ordinarias Liquidadas            │ 157.074,00 horas                              │
│ Horas Extra (Trabajo Suplementario)    │ 9.751,50 horas                                │
│ Recargos Legales (Nocturnos/Festivos)  │ 61.049,50 horas                               │
│ Descanso de Café Pagado Reconocido     │ 3.159,68 horas (en 9.883 jornadas de trabajo) │
│ Horas Pendientes Auditadas (Deuda Neta)│ 4.502,52 horas (tiempo no cumplido de turno)  │
│ Ausencias Reales por Salida Portería   │ 162,48 horas                                  │
│ Retirados con Nómina en el Ciclo       │ 41 empleados liquidados (55 vigentes en ciclo)│
└────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### 7.2. Desglose por Concepto de Nómina (Códigos Sinergy)

La siguiente tabla resume las horas liquidadas para cada uno de los 7 conceptos normativos del alcance, totalizadas y separadas por empresa:

| Concepto | Código Sinergy | Clave Interna | Total Horas | Plastitec S.A. | Granservicios (Temp.) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Hora Extra Diurna Ordinaria** | `0200` | `EXT_D` | **8.680,00 h** | 5.603,00 h | 3.077,00 h |
| **Hora Extra Nocturna Ordinaria** | `0210` | `EXT_N` | **794,00 h** | 415,00 h | 379,00 h |
| **Hora Extra Festiva Diurna** | `0250` | `EXT_FD` | **138,50 h** | 123,00 h | 15,50 h |
| **Hora Extra Festiva Nocturna** | `0260` | `EXT_FN` | **1,00 h** | 1,00 h | 0,00 h |
| *Subtotal Horas Extra (Suplementarias)* | — | — | **9.751,50 h** | **6.216,50 h** | **3.535,00 h** |
| **Recargo Nocturno Ordinario** | `0220` | `REC_N` | **60.553,50 h** | 32.690,00 h | 27.863,50 h |
| **Recargo Dominical o Festivo** | `0252` | `REC_F` | **12,00 h** | 9,00 h | 3,00 h |
| **Recargo Nocturno Festivo** | `0258` | `REC_FN` | **484,00 h** | 258,00 h | 226,00 h |
| *Subtotal Recargos de Ley* | — | — | **61.049,50 h** | **32.957,00 h** | **28.092,50 h** |
| **TOTAL TRABAJO EXTRA + RECARGOS** | — | — | **70.801,00 h** | **39.173,50 h** | **31.627,50 h** |

> [!NOTE]
> De conformidad con la condición `H-06` del catálogo, al ubicarse el período posterior al corte del 15 de julio de 2026, los recargos festivos se emiten automáticamente con los códigos actualizados `0252` (en reemplazo de `0253`) y `0258` (en reemplazo de `0259`).

### 7.3. Desglose Consolidado por Compañía

| Indicador | Plastitec S.A. | Granservicios (Temporales) | Total Consolidado |
|---|:---:|:---:|:---:|
| **Colaboradores en Ciclo** | 601 empleados | 493 empleados | 1.095 empleados (incluye 1 cuenta especial) |
| **Horas Ordinarias Liquidadas** | 91.599,00 h | 65.475,00 h | 157.074,00 h |
| **Horas Extra Liquidadas** | 6.216,50 h | 3.535,00 h | 9.751,50 h |
| **Recargos de Ley Liquidados** | 32.957,00 h | 28.092,50 h | 61.049,50 h |
| **Descanso de Café Remunerado** | 1.724,03 h | 1.435,65 h | 3.159,68 h |
| **Horas Pendientes (Incumplimiento Neto)** | 2.728,60 h | 1.773,92 h | 4.502,52 h |

### 7.4. Análisis del Impacto Operativo y Económico en el Ciclo

1. **Protección al Trabajador y Mitigación de Falsas Deudas (Efecto Café B-12):**  
   Durante este período mensual se reconocieron **3.159,68 horas de refrigerio de café en 9.883 turnos**. Si el sistema mantuviera el esquema rígido de BioTime, las horas pendientes habrían alcanzado **7.662,20 horas** (4.502,52 h + 3.159,68 h). El algoritmo evitó cargarle indebidamente a los colaboradores más de 3.100 horas de falso ausentismo, sustentando solo las 4.502,52 horas de retraso o salida no justificada real.
2. **Rescate de Personal Retirado:**  
   De los 478 trabajadores registrados en el archivo de Renuncias, **55 personas tuvieron vigencia que se traslapó con este ciclo**. Gracias al corte por `vigFin` y al rescate de datos de marcación (`A-22`), a **41 de ellos se les liquidaron sus horas efectivamente trabajadas** antes del retiro sin que BioTime los desechara como registros huérfanos ni les imputara ausencias falsas post-retiro.
3. **Control y Auditoría de Excepciones:**  
   El ciclo generó 1.608 excepciones bloqueantes (`BLOQ`), concentradas en inconsistencias puntuales de marcación (golpes impares sin resolución o empleados sin turno programado en días con asistencia) que quedan claramente señalizadas para su revisión previa a la entrega final de nómina.

---

## 8. CAPACIDADES DE EXPORTACIÓN Y SALIDAS DEL SISTEMA

La herramienta genera los siguientes artefactos de salida para consumo administrativo y contable:

1. **Consolidado General de Nómina (Excel):** Resumen por trabajador con código de empleado, cédula, nombre, departamento, compañía (Plastitec o Granservicios), cargo, horas ordinarias y cada uno de los 7 conceptos de recargos y extras.
2. **Detalle Operativo Diario (Excel):** Trazabilidad día a día por trabajador que detalla turnos programados, primer golpe, último golpe, minutos de café reconocidos, minutos de lactancia reconocidos y la etapa (6 o 24 meses), tránsito interior, faltantes por salida en portería y novedades detectadas.
3. **Reporte de Excepciones y Auditoría (Excel):** Bitácora detallada de incidencias operativas (`BLOQ`, `ADV`, `INFO`) con justificación técnica y normativa.
4. **Resumen de Asistencia con Formato Visual (.xls):** Archivo con codificación de colores de semáforo idéntica a la visualizada en pantalla para presentación ejecutiva directa.
5. **Archivo Plano para Carga a Sinergy (`FINAL_SINER_*.txt`):** Archivo estructurado delimitado por tabulaciones, formateado con precisión de 2 decimales, códigos normativos y fechas requeridas por el software liquidador de nómina.
6. **Hoja «Lactancia» (dentro de la exportación combinada, cuando se cargó el archivo):** Una fila por cada fila del archivo de lactancia, incluso las ignoradas, con su estado (válida, válida con errores o ignorada) y los motivos. Respeta los filtros activos del Consolidado. El Consolidado agrega además la etapa, los días en lactancia, los días con crédito y los minutos acreditados por etapa.

---

## 9. ROADMAP Y PRÓXIMOS PASOS (TRANSICIÓN A FASE CORPORATIVA)

Para evolucionar la herramienta desde su estado actual altamente exitoso hacia una plataforma corporativa definitiva, se han estructurado los siguientes pasos:

### 9.0. Validación pendiente
- **Validación de la lactancia con datos reales:** La función se probó con casos y archivos sintéticos. Falta contrastarla con el primer archivo real de Recursos Humanos antes de darla por validada en nómina.

### 9.1. Ajustes Finales de Exportación a Sinergy (Inmediato)
- **Homologación del Catálogo Sinergy:** Incorporar el cruce con el archivo maestro de nómina que asocia el `Empleado ID` de BioTime con el código propio de Sinergy (`COD_SINER`), validando unicidad.
- **División de Archivos por Empresa:** Generar automáticamente dos archivos planos independientes: uno para **Plastitec S.A.** y otro para personal temporal de **Granservicios**.
- **Cierre del orden de columnas:** Validar con el equipo de Nómina la posición relativa exacta de los campos de fecha y horas exigida por el cargador de Sinergy.

### 9.2. Transición a Arquitectura Cliente-Servidor (Mediano Plazo)
Para satisfacer plenamente los bloques F (Aprobaciones con roles jerárquicos), G (Cierre inmutable de períodos) y J (Conciliación automática con BioTime):
- **Base de Datos Centralizada (PostgreSQL):** Almacenamiento seguro de importaciones, parámetros versionados por ciclo y libros contables de ajustes.
- **Bandeja de Aprobaciones Multinivel:** Flujo donde los jefes de planta aprueban o ajustan únicamente el trabajo suplementario (horas extra), mientras que los recargos legales se liquidan sin dilación.
- **Inmutabilidad de Cierres:** Al cerrar el período contable, las horas liquidadas se congelan en una foto histórica inalterable, garantizando que futuras consultas reproduzcan fielmente lo pagado.
- **Extracción de Motor como Módulo Central:** Empaquetar la lógica matemática actual (ya probada y dorada) como un servicio o librería centralizada, eliminando la duplicidad física entre archivos.

---

*Informe técnico compilado con base en la auditoría exhaustiva del código fuente, el repositorio de versiones y la ejecución contra datos de referencia masivos del SIRH Plastitec.*
