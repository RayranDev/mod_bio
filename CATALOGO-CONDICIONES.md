# CATÁLOGO DE CONDICIONES · Reporte de horas y conceptos

### Alcance acotado: **extras y recargos únicamente**
### SIRH Plastitec · v1.0

Este es el documento de diseño original entregado por el usuario al inicio del proyecto. Cada
condición tiene un código (`A-01`, `D-14`, `I-03`, etc.) que se usa como referencia cruzada en el
código fuente (comentarios, mensajes de excepción, tooltips) de `reporte-horas.html` y
`reporte-horas-rrhh.html`. No se edita este archivo para "marcar como resuelto" — el estado real de
implementación (qué se construyó, qué se dejó fuera a propósito, qué falta) vive en `CLAUDE.md`,
sección "Estado de implementación frente a este catálogo".

---

## ALCANCE

**Dentro:** producir, para un ciclo 11→10, el reporte de horas trabajadas y sus conceptos de nómina de **extras y recargos**, aprobado y exportable a Sinergy.

**Fuera:** ausentismos (permisos, incapacidades, vacaciones, licencias), salario, prestaciones, dotación, cualquier concepto que no sea extra o recargo.

**Los 7 conceptos del alcance:**

| Concepto | Código Sinergy |
|---|---|
| Hora extra diurna ordinaria | `0200` |
| Hora extra nocturna ordinaria | `0210` |
| Hora extra festiva diurna | `0250` |
| Hora extra festiva nocturna | `0260` |
| Recargo nocturno | `0220` |
| Recargo dominical o festivo | `0253` / `0252` según fecha |
| Recargo nocturno festivo | `0259` / `0258` según fecha |

**Notación de estado:**
✅ definido · ⚠️ definido pero requiere precisión · ❌ pendiente, bloquea

---

# BLOQUE A · CONDICIONES DE ENTRADA — MARCACIONES

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **A-01** | Par completo entrada + salida | Caso normal. Se procesa | ✅ |
| **A-02** | Entrada sin salida | Excepción visible. Permite cálculo automático por turno, con justificación humana. El valor va marcado `INFERIDO` | ✅ |
| **A-03** | Salida sin entrada | Excepción visible. Mismo tratamiento que A-02 | ✅ |
| **A-04** | Número impar de marcaciones (3, 5, 7) | Excepción. El sistema **no adivina** el emparejamiento: lo escala a resolución humana | ✅ |
| **A-05** | Duplicada exacta, mismo `id` | Idempotencia: se ignora la segunda | ✅ |
| **A-06** | Duplicada lógica, distinto `id`, mismo minuto | Se conserva la primera, se marca la segunda como duplicada. Ambas quedan en marcación cruda | ✅ |
| **A-07** | Dos marcaciones con segundos de diferencia (doble toque) | Ventana de supresión configurable (sugerido 60 s). Parámetro `CONFIG` | ❌ definir ventana |
| **A-08** | Marcación fuera de todo turno programado | Se captura y se clasifica como fuera de programación. No genera extra sin autorización | ✅ |
| **A-09** | Empleado sin turno asignado ese día | Excepción bloqueante del cálculo de ese día. No se puede calcular sin jornada programada | ✅ |
| **A-10** | Empleado que existe en BioTime pero no en SIRH | Excepción de reconciliación. La marcación se conserva, no se calcula | ✅ |
| **A-11** | Marcación de terminal desconocida | Se captura, se alerta, se calcula igual. La terminal es metadato, no condición de validez | ✅ |
| **A-12** | `punch_state` ausente o ambiguo | Excepción. El emparejamiento entrada/salida depende de este campo | ❌ falta conocer los valores posibles |
| **A-13** | Marcación rezagada (`upload_time` ≫ `punch_time`) | Entra por la ventana de `upload_time`, se imputa por `punch_time`. **No duplica** | ✅ |
| **A-14** | Marcación con fecha futura (reloj de terminal desfasado) | Se rechaza al ingresar, se alerta sobre esa terminal | ✅ |
| **A-15** | Marcación anterior a la fecha de ingreso del empleado | Excepción de reconciliación | ✅ |
| **A-16** | Marcación posterior a la fecha de retiro | Excepción de reconciliación | ✅ |
| **A-17** | Salida con hora anterior a la entrada, sin cruce de medianoche | Excepción. Nunca se calcula tiempo negativo | ✅ |
| **A-18** | Ninguna marcación en un día con turno programado | Ausencia. **No genera conceptos.** Se lista como excepción informativa | ✅ |
| **A-19** | Marcación en día de descanso o festivo sin turno programado | Sí se procesa: trabajar el descanso genera conceptos. Requiere autorización | ⚠️ ver D-05 |
| **A-20** | Marcación modificada o borrada en BioTime después de ingerida | La copia local es inmutable. Se detecta la divergencia y se alerta | ❌ confirmar si BioTime lo permite |
| **A-21** | Zona horaria de `punch_time` distinta de la esperada | Todo se normaliza a hora local con zona explícita, en el adaptador | ❌ confirmar zona del servidor |

---

# BLOQUE B · CONDICIONES DE LA JORNADA PROGRAMADA

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **B-01** | Turno estándar dentro del mismo día | Caso normal | ✅ |
| **B-02** | Turno que cruza medianoche | Se **imputa al día de inicio**. Se **segmenta** por medianoche para clasificar | ✅ |
| **B-03** | Empleado con dos turnos asignados el mismo día | Excepción de programación. No se calcula hasta resolver | ✅ |
| **B-04** | Cambio puntual de turno (`tempschedule`) | Prevalece sobre la programación regular de ese día | ✅ |
| **B-05** | Cambio de turno permanente a mitad de ciclo | Cada día usa el turno vigente a esa fecha | ✅ |
| **B-06** | Cambio de cargo a mitad de ciclo | **Cambia el perfil laboral y por tanto la regla de extras.** Cada día usa el perfil vigente a esa fecha | ✅ |
| **B-07** | Día de descanso obligatorio programado | Sin trabajo → sin conceptos | ✅ |
| **B-08** | Festivo nacional | Requiere calendario oficial de festivos por año, cargado y versionado | ❌ cargar calendario |
| **B-09** | Festivo que coincide con el día de descanso del empleado | Concurrencia de dos condiciones. **Matriz de precedencia pendiente** | ❌ bloqueante |
| **B-10** | Turno con descuento de almuerzo habilitado | Se descuentan 60 min | ✅ |
| **B-11** | Turno con descuento de almuerzo deshabilitado | No se descuenta. Es atributo del turno, no global | ✅ |
| **B-12** | Descanso de café, 20 min | **No se descuenta.** La empresa lo paga | ⚠️ falta definir si aplica a administrativos |
| **B-13** | Turno de 12 horas | Configuración habitual del personal rotativo. **Sustento legal pendiente** | ❌ bloqueante jurídico |
| **B-14** | Empleado sin cargo asignado | No se puede determinar perfil → excepción bloqueante | ✅ |

---

# BLOQUE C · SEGMENTACIÓN TEMPORAL

El tiempo trabajado se parte en intervalos atómicos. **Toda condición de este bloque debe producir una frontera de segmento.**

| ID | Frontera | Estado |
|---|---|---|
| **C-01** | Medianoche (cambio de día calendario) | ✅ |
| **C-02** | Inicio de franja nocturna — **19:00** desde dic-2025 | ✅ |
| **C-03** | Fin de franja nocturna — **06:00** | ✅ |
| **C-04** | Frontera nocturna histórica **21:00**, para períodos anteriores a dic-2025 | ✅ versionada |
| **C-05** | Cambio de tipo de día: ordinario ↔ descanso ↔ festivo | ✅ |
| **C-06** | Inicio de la jornada programada | ✅ |
| **C-07** | Fin de la jornada programada | ✅ |
| **C-08** | Inicio y fin de descanso de almuerzo, cuando aplica | ✅ |
| **C-09** | Inicio y fin de una condición especial con hora (lactancia) | ⚠️ definir duración |
| **C-10** | Cambio de vigencia de cualquier regla dentro del turno | ✅ |

**Invariante:** la suma de los minutos de todos los segmentos debe ser **exactamente igual** al tiempo trabajado calculado. Ni un minuto de más ni de menos.

---

# BLOQUE D · CLASIFICACIÓN — QUÉ CONCEPTO SE GENERA

## D.1 Reglas base

| ID | Condición | Concepto | Estado |
|---|---|---|---|
| **D-01** | Segmento dentro de jornada, día ordinario, franja diurna | Ninguno. Es ordinaria, ya está en el salario | ✅ |
| **D-02** | Segmento dentro de jornada, día ordinario, franja nocturna | **Recargo nocturno** `0220`, por las horas efectivamente trabajadas | ✅ |
| **D-03** | Segmento fuera de jornada, día ordinario, diurno | **Extra diurna ordinaria** `0200` | ✅ |
| **D-04** | Segmento fuera de jornada, día ordinario, nocturno | **Extra nocturna ordinaria** `0210` | ✅ |
| **D-05** | Trabajo en día de descanso obligatorio o festivo, dentro de jornada | Recargo dominical/festivo + nocturno si aplica | ❌ **precisar cantidades** |
| **D-06** | Trabajo en día de descanso o festivo, fuera de jornada, diurno | **Extra festiva diurna** `0250` | ⚠️ confirmar concurrencia con recargo |
| **D-07** | Trabajo en día de descanso o festivo, fuera de jornada, nocturno | **Extra festiva nocturna** `0260` | ⚠️ ídem |
| **D-08** | Trabajo nocturno en día de descanso o festivo | **Recargo nocturno festivo** `0259`/`0258` | ⚠️ ídem |
| **D-09** | Principio general | **Sin trabajo no hay concepto.** Si no trabaja, no se calcula nada | ✅ |

⚠️ **D-05 a D-08 son la matriz pendiente.** Cinco casos de concurrencia sin resolver. Es el vacío de clasificación más grande que queda.

## D.2 Redondeo

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **D-10** | Tiempo posterior al fin de turno, minutos `:00`–`:24` | 0 h | ✅ |
| **D-11** | Minutos `:25`–`:49` | 0,5 h | ✅ |
| **D-12** | Minutos `:50`–`:24` de la hora siguiente | 1,0 h | ✅ |
| **D-13** | Incremento en adelante | Siempre en pasos de 0,5 h | ✅ |
| **D-14** | Anclaje de los cortes | ¿Reloj absoluto o relativo al fin de turno? Difiere en turnos que terminan en media hora | ❌ bloqueante |
| **D-15** | Tiempo trabajado **antes** del inicio del turno | No cuenta. El tiempo empieza en la hora programada. Regla global | ✅ |
| **D-16** | Redondeo aplicado sobre valor inferido, no sobre marcación real | Permitido solo con aprobación humana registrada | ✅ |

## D.3 Umbral semanal — personal rotativo

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **D-17** | Semana lunes–domingo con menos de 42 h | Sin extras. Todo ordinario | ✅ |
| **D-18** | Semana con más de 42 h | El excedente es extra | ✅ |
| **D-19** | Excedente mayor a 12 h semanales | Se calcula igual, **con alerta y justificación obligatoria** | ✅ |
| **D-20** | Más de 2 h extra en un día | Alerta y justificación. No aplica a turnos de 12 h | ⚠️ precisar la excepción |
| **D-21** | Semana que cruza el cierre del ciclo (día 10 a mitad de semana) | **No se puede clasificar sin la semana completa** | ❌ **bloqueante crítico** |
| **D-22** | Semana que cruza el **15-jul-2026** (44 h → 42 h) | Umbral versionado por fecha | ✅ |
| **D-23** | Personal administrativo | **No aplica umbral semanal.** Cálculo diario contra jornada programada | ✅ |
| **D-24** | Reclasificación de la pasada 1 por la pasada 2 | Segmentos marcados como extra pueden volver a ordinarios | ✅ |

## D.4 Contador mensual

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **D-25** | Hasta 2 días de descanso obligatorio trabajados en el mes | Modalidad **ocasional** | ❌ definir efecto |
| **D-26** | 3 o más en el mes | Modalidad **habitual** | ❌ definir efecto |
| **D-27** | Base de conteo | Domingos + festivos + día de descanso propio, sumados | ❌ confirmar |

---

# BLOQUE E · CONDICIONES DEL EMPLEADO

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **E-01** | Ingreso a mitad de ciclo | Se calcula solo desde la fecha de ingreso | ✅ |
| **E-02** | Retiro a mitad de ciclo | Se calcula hasta la fecha de retiro. **Debe salir en el archivo del ciclo** | ✅ |
| **E-03** | Empleado activo sin marcaciones en todo el ciclo | No genera filas. Se lista como excepción informativa | ✅ |
| **E-04** | Empleado con lactancia vigente | El tiempo de lactancia **se paga como trabajado** | ⚠️ definir duración |
| **E-05** | Empleado con cambio de perfil por cambio de cargo | Cada día usa el perfil vigente | ✅ |
| **E-06** | Temporal de Granservicios | ¿Entra al archivo de Sinergy o solo al control interno? | ❌ bloqueante de alcance |
| **E-07** | Practicante SENA | Ídem, y con jornada propia | ❌ bloqueante de alcance |
| **E-08** | Empleado sin código de Sinergy | **No puede salir en el archivo.** Excepción bloqueante del cierre | ✅ |
| **E-09** | Dos empleados con el mismo código de Sinergy | Excepción bloqueante. Nunca se resuelve por normalización automática | ✅ |
| **E-10** | Empleado suspendido | Sin turno programado → sin conceptos | ⚠️ confirmar tratamiento |
| **E-11** | Empleado cubierto por convención colectiva con reglas distintas | Las reglas de convención **prevalecen** | ❌ obtener convención |

---

# BLOQUE F · APROBACIÓN

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **F-01** | Registro calculado, sin revisar | Estado *pendiente*. Va a la bandeja del jefe con notificación | ✅ |
| **F-02** | Aprobado por el jefe inmediato | Entra al archivo | ✅ |
| **F-03** | Rechazado | **No entra al archivo.** Queda trazado con motivo | ✅ |
| **F-04** | Ajustado por el jefe | Justificación **obligatoria**. Se conserva el valor calculado original y el ajustado | ✅ |
| **F-05** | Aprobado por RRHH en sustitución del jefe | Permitido, con **anotación obligatoria** | ✅ |
| **F-06** | Sin aprobar al llegar el cierre | **Bloquea el cierre.** Se listan los pendientes con su responsable | ✅ |
| **F-07** | Empleado cuyo jefe está de vacaciones o el cargo está vacante | Debe existir suplente o escalamiento | ❌ definir |
| **F-08** | Empleado sin jefe asignado en la estructura | Excepción bloqueante del cierre | ✅ |
| **F-09** | Extras sin autorización previa del jefe | Se calculan, se marcan como excepción y requieren decisión explícita | ✅ |
| **F-10** | Aprobación de un registro con valor inferido | Debe hacerse visible al aprobador que el valor es inferido | ✅ |

---

# BLOQUE G · PERÍODO Y CIERRE

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **G-01** | Período abierto | Admite ingesta, cálculo, aprobación y ajuste | ✅ |
| **G-02** | Intento de cierre con aprobaciones pendientes | Bloqueado, con la lista de lo que falta | ✅ |
| **G-03** | Intento de cierre con excepciones sin resolver | Bloqueado | ✅ |
| **G-04** | Intento de cierre con empleados sin código de Sinergy | Bloqueado | ✅ |
| **G-05** | RRHH inicia el procesamiento | **Bloqueo inmediato de modificaciones** | ✅ |
| **G-06** | Marcación que llega después del cierre, con fecha del período cerrado | Se ingiere igual, no se calcula, queda listada para ajuste retroactivo | ✅ |
| **G-07** | Reapertura de período cerrado | Posible, con rol elevado y justificación. Deliberadamente difícil | ✅ |
| **G-08** | Recálculo tras reapertura | Genera un `calculo_id` nuevo. **Nunca pisa el anterior** | ✅ |
| **G-09** | Recálculo de un período histórico | Usa las **reglas vigentes a esa fecha**, no las actuales | ✅ |
| **G-10** | Ajuste retroactivo sobre un período ya liquidado en Sinergy | Requiere que Sinergy acepte signo negativo | ❌ confirmar |

---

# BLOQUE H · ARCHIVO DE SALIDA

| ID | Condición | Comportamiento | Estado |
|---|---|---|---|
| **H-01** | Concepto con cantidad cero | **No se emite fila.** Solo se exporta lo que existe | ✅ |
| **H-02** | Empleado sin ningún concepto en el ciclo | No aparece en el archivo | ✅ |
| **H-03** | Una fila por empleado y por concepto | Estructura confirmada | ✅ |
| **H-04** | Código de empleado | Numérico, **sin ceros a la izquierda** | ✅ |
| **H-05** | Código de concepto | 4 dígitos **con** ceros a la izquierda | ✅ |
| **H-06** | Selección del código por fecha del período | `0253`→`0252` y `0259`→`0258` desde el 15-jul-2026 | ✅ |
| **H-07** | Signo | Literal `+`. Negativos aún no soportados | ⚠️ |
| **H-08** | Cantidad | Decimal con **punto**, máximo 2 decimales, sin ceros de relleno | ✅ |
| **H-09** | Fechas | `D/MM/AAAA` — día sin cero a la izquierda, mes con cero | ⚠️ confirmar contra archivo real |
| **H-10** | Campos 7 a 12 | Vacíos, presentes, separados por tabulación | ✅ |
| **H-11** | Delimitador, codificación, fin de línea | TAB · UTF-8 · LF · sin encabezado | ✅ |
| **H-12** | Nombre del archivo | `FINAL_SINER_<inicio>_<fin>.txt` | ✅ |
| **H-13** | Regeneración del mismo período | Debe producir un archivo **idéntico** si nada cambió | ✅ |
| **H-14** | Registro de exportaciones | Cada archivo generado queda registrado: quién, cuándo, con qué `calculo_id` | ✅ |
| **H-15** | Recarga del mismo archivo en Sinergy | ¿Duplica o reemplaza? | ❌ confirmar |

---

# BLOQUE I · INVARIANTES DE INTEGRIDAD

**Verificaciones que el sistema hace sobre sí mismo antes de permitir un cierre.** Si alguna falla, el período no cierra.

| ID | Invariante |
|---|---|
| **I-01** | La suma de minutos de todos los segmentos de una jornada = tiempo trabajado calculado |
| **I-02** | Ningún minuto trabajado queda clasificado en **dos** conceptos a la vez |
| **I-03** | Ningún minuto trabajado queda **sin** clasificar |
| **I-04** | Ningún empleado supera 24 horas de conceptos en un día calendario |
| **I-05** | Ningún empleado supera 12 horas extra en una semana sin su alerta correspondiente registrada |
| **I-06** | Toda fila del archivo corresponde a un registro **aprobado** |
| **I-07** | Todo valor exportado es trazable hasta sus marcaciones crudas y su versión de regla |
| **I-08** | Todo concepto exportado existe en el catálogo vigente a la fecha del período |
| **I-09** | Todo empleado del archivo tiene código de Sinergy válido y único |
| **I-10** | La suma total del archivo coincide con la suma de los registros aprobados en el sistema |
| **I-11** | Todo valor `INFERIDO` que entró al cálculo tiene aprobación humana identificada |
| **I-12** | Ningún registro del archivo proviene de un `calculo_id` invalidado por recálculo posterior |

---

# BLOQUE J · CONCILIACIÓN Y CONTROL

| ID | Condición | Estado |
|---|---|---|
| **J-01** | Comparación por empleado y día contra `dailyHourReport` de BioTime | ✅ obligatorio en paralelo |
| **J-02** | Las diferencias esperadas por diseño —umbral de 42 h y redondeos— se marcan como tales | ✅ |
| **J-03** | Cualquier otra diferencia se trata como **defecto propio** | ✅ |
| **J-04** | Reporte de días cuyo cálculo se apoyó en un valor inferido, con su autorizador | ✅ |
| **J-05** | Reporte de excepciones abiertas por período | ✅ |
| **J-06** | Reporte de registros aprobados fuera del plazo | ⚠️ definir plazo |
| **J-07** | Contraste del archivo generado contra el del mes anterior, por variación anómala | Recomendado |

---

# RESUMEN (del diseño original — ver CLAUDE.md para el estado real de implementación)

| Bloque | Total | ✅ | ⚠️ | ❌ |
|---|---|---|---|---|
| A · Marcaciones | 21 | 15 | 1 | 5 |
| B · Jornada programada | 14 | 10 | 1 | 3 |
| C · Segmentación | 10 | 9 | 1 | 0 |
| D · Clasificación | 27 | 15 | 5 | 7 |
| E · Empleado | 11 | 6 | 2 | 3 |
| F · Aprobación | 10 | 9 | 0 | 1 |
| G · Período | 10 | 9 | 0 | 1 |
| H · Archivo | 15 | 11 | 2 | 2 |
| I · Invariantes | 12 | 12 | 0 | 0 |
| J · Conciliación | 7 | 5 | 1 | 0 |
| **TOTAL** | **137** | **101** | **13** | **23** |

Esta tabla es la **intención de diseño original**, no el estado del código. Muchas condiciones marcadas
✅ aquí describen el comportamiento deseado de un sistema completo (con backend, roles, base de datos)
que **no es lo que se construyó**. `reporte-horas.html` y `reporte-horas-rrhh.html` son herramientas
100% locales, sin backend ni base de datos: implementan fielmente los bloques A a D (marcaciones,
turnos, segmentación, clasificación) e I (invariantes), pero los bloques F (aprobación), G (cierre de
período) y J (conciliación con BioTime) son, en su mayoría, **flujos de proceso humano que este
archivo no automatiza** — ver `CLAUDE.md` para el detalle exacto de qué quedó resuelto en código, qué
se resolvió como decisión de diseño documentada, y qué sigue genuinamente pendiente.
