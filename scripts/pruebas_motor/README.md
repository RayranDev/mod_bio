# Pruebas del motor (sintéticas)

Pruebas en Node que ejecutan el motor **real** de `reporte-horas.html` y `reporte-horas-rrhh.html`
(extraen el `<script>` y lo corren contra un DOM simulado que devuelve `null` para todo elemento que el
archivo no declara). No necesitan instalar nada: solo Node.

Se ejecutan desde la raíz del repositorio:

```
node scripts/pruebas_motor/<archivo>.js
```

Cada una termina con código 0 si todo pasa y distinto de 0 si algo falla.

| Archivo | Qué comprueba |
|---|---|
| `prueba_sinteticos.js` | Casos de lactancia con turnos y marcaciones ficticios (turno nocturno, domingo, festivo, bolsa semanal, administrativo, CONFIANZA, T-EXTRA, borde `Fin_6m == Inicio_24m`), cada uno contra su control sin archivo. Incluye los casos W1: una etapa incompleta o al revés no tira abajo la otra. Verifica I-01/I-02/I-03 = 0. |
| `prueba_validacion.js` | Matriz de validación (a)-(h) del archivo de lactancia por la capa real `readSheet` (con fila de título y filas en blanco, tres variantes de encabezado), el hook de carga, y los escenarios W1 de la regla `Fin_6m > Inicio_24m` (solo rige entre dos etapas válidas). |
| `prueba_fuzz_lactancia.js` | 4.000 filas aleatorias (semilla fija) de `leerLactancia()` contra un oráculo independiente de las reglas. |
| `prueba_exportaciones.js` | La hoja *Lactancia* del Excel combinado respeta los filtros del Consolidado; `ETAPA LACTANCIA` es la última columna del Detalle; fechas serial a ISO; la plantilla descargable usa IDs no numéricos y cargada tal cual solo da avisos; topes de minutos nunca negativos; el chip `E-04` y el tooltip. |
| `prueba_indicadores.js` | La pestaña *Resumen del ciclo* (`computeInd`, `indBarras`, `renderInd`, `aoaInd*`) con 13 personas ficticias (ids `92xx`) en los dos archivos: los totales salen de `byEmp`, los días sin marcar son los mismos en Resumen, *Calidad de marcación* y *Adopción* (una sola definición: A-18 por jornada), la concentración (Pareto), los días de la semana y la barra «de cada 100 h» suman bien, las barras de cada métrica (total y por persona) salen ordenadas, el alcance vacío no revienta, las exportaciones son rectangulares, nada se pinta con `NaN`/`undefined` y los dos archivos pintan **exactamente lo mismo**. |
| `prueba_alcance.js` | El filtro de **Alcance** compartido por las tres pestañas, con 7 personas ficticias (ids `93xx`, dos sin turno asignado): «solo estos» / «todos menos estos» departamentos (y que solo la exclusión se guarda en `mb_kpi_excl`), chips de personas, «ocultar sin turno» y su aviso, perfil, vínculo y compañía, que los filtros se combinan con Y, que Resumen, Calidad, Adopción y sus Excel respetan el alcance, que sin filtro los totales son los de siempre, el repintado de pestañas sucias en `showTab`, el panel y el buscador, y que los dos archivos pintan lo mismo. Incluye el **cargo** del Alcance (filtro, lista dependiente, `alcanceOkEmp`). |
| `prueba_rotacion.js` | La pestaña **Rotación** (`computeRot`, `rotMes`, `renderRot`, `aoaRot*`) con una población ficticia (ids `95xx`/`96xx`) y cifras calculadas **a mano** mes a mes (plantilla de inicio y fin, ingresos, retiros por tipo) más un oráculo diario independiente; la depuración masiva (`cRetMasivo`) fuera del numerador **y** de la plantilla, el interruptor, los ingresos masivos, el mes no confiable y el mes en curso; el **filtro de tipo de retiro** (el numerador cuenta solo los marcados y la plantilla no se reduce; con un solo tipo el gráfico muestra solo ese); el caso combinado tipo + departamento + cargo + ventana + depuración, por el modelo y por la interfaz; casos borde (alcance vacío, una sola persona, retiro anterior a la ventana, sin fecha, retiro anterior al ingreso, cargo ausente, sin archivo de Renuncias); la exportación a Excel (6 hojas, solo ids, tipos en la hoja Alcance, «Sin dato» sin tasa); y que los dos archivos pintan y exportan lo mismo. |
| `prueba_consolidado.js` | El filtro de **cargo** del Consolidado (dependiente del departamento, `(sin cargo)`, Y con el buscador), la columna Cargo, que pantalla, Excel y Sinergy respetan el filtro y que el Excel conserva su orden de columnas, que cada fila tiene tantas celdas como el encabezado (con y sin conceptos) y el `colspan` del estado vacío, el selector de columnas (CSS, «Mostrar todas», el Excel no cambia) y que nada revienta si el HTML no declara `#fCargo` ni `#btnColsCons`. Personas ficticias `94xx`. |
| `prueba_identidad.js` | El motor compartido es **idéntico carácter a carácter** en los dos archivos (excepciones conocidas: `rolEfectivo`, `runCalc`), sin helpers duplicados ni perdidos, sintaxis JS válida e ids HTML únicos. Correr siempre después de tocar el motor. |
| `prueba_dom.js` | El cableado de `DOMContentLoaded` corre sin errores en los dos archivos. |
| `lib.js` | Utilidades comunes (carga del motor, DOM simulado, invariantes). No es una prueba. |

## Lo que NO está aquí, a propósito

Las pruebas que necesitan los Excel reales de BioTime (huella de nómina contra una versión anterior,
recorrido de todos los renders y exportaciones con 1.000+ empleados, lactancia sobre empleados reales)
**no se incluyen**: usan datos personales de empleados y esos archivos nunca se suben al repositorio
(ver `.gitignore`). Se corren en local, convirtiendo los `.xlsx` a JSON fuera del repo, y solo se
reportan agregados, nunca nombres ni IDs.

Tampoco se incluye la prueba de la capa de parseo con la librería SheetJS real (necesita instalar
`xlsx`); aquí `readSheet` se prueba con la librería simulada, que cubre la lógica propia del proyecto.

Todos los IDs de estas pruebas (`91xx`, `93xx`, `EJEMPLO-n`) son ficticios.
