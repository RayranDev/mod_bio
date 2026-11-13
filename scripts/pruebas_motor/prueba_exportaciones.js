'use strict';
// Exportaciones y comportamientos de interfaz de la lactancia, en los DOS archivos, con datos 100% ficticios:
//  W2  la hoja «Lactancia» del Excel combinado respeta los filtros activos del Consolidado
//  S1  la columna ETAPA LACTANCIA del Detalle va AL FINAL (sin el archivo, el orden no cambia)
//  S3  las fechas que llegan como serial de Excel se exportan como ISO
//  S4  la plantilla descargable usa ids ficticios no numericos: cargarla tal cual solo da avisos
//  S6  los minutos por etapa nunca son negativos
//  chip E-04 con data-nov (salta a la excepcion) y tooltip del dia con prioridad en initPop
const { cargar, invariantes, FILES } = require('./lib.js');

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fl = lista => DIAS.map(d => lista.includes(d) ? 'True' : '');
const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
const serial = iso => { const [y, m, d] = iso.split('-').map(Number); return String((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5); };
const DIA = '2026-09-15';          // martes
const INI = '2026-09-14', FIN = '2026-09-20';
// id, compania; turno nocturno 22:00-06:00 los martes (genera recargo nocturno, asi entran al Consolidado); todos llegan 1 h tarde
const EMPS = [['9301', 'PLASTITECSA'], ['9302', 'PLASTITECSA'], ['9303', 'GRANSERVICIOS']];

function datos() {
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en'],
    ['S_NOCHE', 'S_NOCHE', '1', '22:00:00', '06:00:00', ...fl(['Mar']), '', '0', '']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  EMPS.forEach(([id, cia]) => {
    emp.push([id, 'PRUEBA', 'CASO' + id, '2020-01-01', 'DEPTO ' + cia.slice(0, 3), cia, 'CARGO PRUEBA', 'Habilitado']);
    hor.push([id, 'PRUEBA', 'CASO' + id, 'S_NOCHE', 'S_NOCHE', '2026-08-01', '2026-12-31']);
    [[DIA, '23:00'], ['2026-09-16', '06:00']].forEach(([iso, hm]) => mar.push([id, 'PRUEBA', 'CASO' + id, cia, 'DEPTO ' + cia.slice(0, 3), 'CARGO PRUEBA', f2(iso), hm, '255', 'Dispositivo-PORTERIA PLANTA 1']));
  });
  return { emp, tur, hor, mar };
}
const LAC_HDR = ['ID_empleado', 'Inicio_lactancia_6m', 'Fin_lactancia_6m', 'Inicio_lactancia_24m', 'Fin_lactancia_24m'];
const lacFilas = () => [
  ['9301', serial('2026-09-01'), '2026-12-31', '', ''],     // fecha como serial de Excel (S3)
  ['9302', '', '', '2026-09-01', '2026-12-31'],
  ['9303', '2026-09-01', '2026-12-31', '', ''],
  ['EJEMPLO-1', '2026-09-01', '2026-12-31', '', ''],         // id desconocido: AVISO
  ['', '2026-09-01', '2026-12-31', '', ''],                  // id vacio: ERROR
];

function ejecutar(html, conLact, filasLac) {
  const api = cargar(html, { inputs: { cIni: INI, cFin: FIN } });
  const D = datos();
  api.DATA.emp = api.__leer(D.emp); api.DATA.tur = api.__leer(D.tur); api.DATA.hor = api.__leer(D.hor); api.DATA.mar = api.__leer(D.mar);
  api.DATA.ren = null;
  if (conLact) {
    const o = global.XLSX.utils.sheet_to_json;
    global.XLSX.utils.sheet_to_json = () => [['Lactancia'], LAC_HDR, ...(filasLac || lacFilas())];
    api.DATA.lac = api.readSheet(null, true);
    global.XLSX.utils.sheet_to_json = o;
  } else api.DATA.lac = null;
  api.__set('cIni', INI); api.__set('cFin', FIN);
  api.__dom();
  api.runCalc();
  return api;
}

let fallos = 0;
const ok = (n, c, extra = '') => { if (!c) { fallos++; console.log('FALLA ' + n + ' ' + extra); } else console.log('OK    ' + n); };
const ids = hoja => hoja.slice(1).map(f => String(f[0]));
const nl = aoa => aoa.length - 1;                    // filas de datos (sin encabezado)

const huella = R_ => [...R_.byEmp.entries()].map(([id, x]) => id + '|' + JSON.stringify(x.tot) + '|' + x.ordH + '|' + x.extraH + '|' + x.pendH.toFixed(6)).sort().join('|');
for (const [nombre, html] of Object.entries(FILES)) {
  console.log('--- ' + nombre + ' ---');
  // Cada cargar() reemplaza document/XLSX globales: primero se calculan los casos secundarios y el api
  // principal se crea AL FINAL, para que sus funciones lean su propio DOM.
  const sin = ejecutar(html, false);
  const hSin = sin.aoaDet(sin.__ev('RESULT').byEmp.get('9301'))[0];
  const huellaSin = huella(sin.__ev('RESULT'));
  sin.descargarPlantillaLact();
  const pl = sin.__escritos[0].wb.sheets[0].aoa;
  const apiAbc = ejecutar(html, true, [['9301', 'abc', 'xyz', '', '']]);
  const fAbc = apiAbc.aoaLactancia().find(f => String(f[0]) === '9301');
  const apiPl = ejecutar(html, true, pl.slice(1));
  const plValidas = apiPl.__ev('MODEL').lactancia.validas, huellaPl = huella(apiPl.__ev('RESULT'));
  const api = ejecutar(html, true);
  const R = api.__ev('RESULT');
  ok('invariantes I-01/I-02/I-03 = 0', (i => i.i1 + i.i2 + i.i3 === 0)(invariantes(R)));
  ok('sin errores de consola', api.__errores.length === 0, api.__errores.join('|'));
  const exportar = () => { api.__escritos.length = 0; api.__mk('#expTodo').onclick(); return api.__escritos.length ? Object.fromEntries(api.__escritos[0].wb.sheets.map(s => [s.n, s.aoa])) : null; };

  // ── W2: hoja Lactancia filtrada como Excepciones ──
  api.__set('fCia', '');
  let libro = exportar();
  ok('W2 sin filtro: la hoja Lactancia trae TODAS las filas del archivo (5, incluidas ignoradas)', libro && nl(libro.Lactancia) === 5, libro && String(nl(libro.Lactancia)));
  api.__set('fCia', 'GRANSERVICIOS');
  libro = exportar();
  ok('W2 fCia=GRANSERVICIOS: Lactancia solo trae a esa empresa (1 fila), igual que el Consolidado', libro && nl(libro.Lactancia) === 1 && ids(libro.Lactancia)[0] === '9303' && nl(libro.Consolidado) === 1, libro && JSON.stringify(ids(libro.Lactancia)));
  ok('W2 las filas ignoradas (id desconocido o vacio) no aparecen con un filtro activo', libro && !ids(libro.Lactancia).some(i => i === 'EJEMPLO-1' || i === ''));
  api.__set('fCia', 'PLASTITECSA');
  libro = exportar();
  const idsCons = new Set(ids(libro.Consolidado));
  ok('W2 fCia=PLASTITECSA: Lactancia = ids de esa empresa y subconjunto del Consolidado', libro && JSON.stringify(ids(libro.Lactancia).sort()) === '["9301","9302"]' && ids(libro.Lactancia).every(i => idsCons.has(i)));
  ok('W2 mismo criterio que Excepciones: ningun id fuera del filtro', libro && libro.Excepciones.slice(1).every(f => idsCons.has(String(f[2]))));
  api.__set('fCia', '');
  api.__set('qCons', '9301'); libro = exportar(); api.__set('qCons', '');
  ok('W2 busqueda por empleado: Lactancia solo 9301', libro && JSON.stringify(ids(libro.Lactancia)) === '["9301"]' && nl(libro.Consolidado) === 1);
  api.__set('fLact', '24M'); libro = exportar(); api.__set('fLact', '');
  ok('W2 filtro de lactancia 24M: Lactancia solo 9302', libro && JSON.stringify(ids(libro.Lactancia)) === '["9302"]');
  api.__set('fCia', 'NO-EXISTE');
  ok('W2 empresa sin filas: Consolidado 0 filas de datos y Lactancia 0 filas de datos',
    nl(api.aoaCons()) === 0 && nl(api.aoaLactancia(new Set(api.consFiltrado().map(e => e.emp.id)))) === 0);
  api.__set('fCia', '');

  // ── S3: fechas serial -> ISO en la hoja Lactancia ──
  const hoja = api.aoaLactancia();
  const f9301 = hoja.find(f => String(f[0]) === '9301');
  ok('S3 fecha serial de Excel se exporta como ISO (no como "46...")', f9301 && f9301[4] === '2026-09-01' && f9301[5] === '2026-12-31', JSON.stringify(f9301 && f9301.slice(4, 6)));
  ok('S3 un texto ilegible se conserva tal cual', fAbc && fAbc[4] === 'abc' && fAbc[5] === 'xyz');

  // ── S1: ETAPA LACTANCIA al final del Detalle ──
  const dCon = api.aoaDet(R.byEmp.get('9301'));
  const hCon = dCon[0];
  ok('S1 sin archivo: el orden de columnas del Detalle sigue igual (TRANSITO tras LACTANCIA RECONOCIDO, sin ETAPA)',
    !hSin.includes('ETAPA LACTANCIA') && hSin.indexOf('MIN TRANSITO INTERIOR') === hSin.indexOf('MIN LACTANCIA RECONOCIDO') + 1 && hSin[hSin.length - 1] === 'EXPLICACION');
  ok('S1 con archivo: ETAPA LACTANCIA es la ULTIMA columna y las demas no se mueven', JSON.stringify(hCon) === JSON.stringify([...hSin, 'ETAPA LACTANCIA']), String(hCon.length - hSin.length));
  ok('S1 con archivo: cada fila tiene el ancho del encabezado y la etapa en la ultima celda', dCon.every(f => f.length === hCon.length) && dCon.slice(1).some(f => f[f.length - 1] === '6M'));

  // ── S4: plantilla con ids ficticios no numericos ──
  api.descargarPlantillaLact();
  ok('S4 plantilla: encabezado + 2 filas de ejemplo', pl.length === 3 && pl[0][0] === 'ID_empleado' && JSON.stringify(api.__escritos.slice(-1)[0].wb.sheets[0].aoa) === JSON.stringify(pl));
  ok('S4 los ids de ejemplo no son numericos (no pueden chocar con un id real)', pl.slice(1).every(f => /^[A-Za-z]/.test(f[0]) && !/^\d+$/.test(f[0])), JSON.stringify(pl.slice(1).map(f => f[0])));
  const o = global.XLSX.utils.sheet_to_json;
  global.XLSX.utils.sheet_to_json = () => pl;
  const lacPl = api.readSheet(null, true);
  global.XLSX.utils.sheet_to_json = o;
  ok('S4 la plantilla leida con readSheet trae 2 filas', lacPl.rows.length === 2);
  const todos = new Set(Array.from({ length: 12000 }, (_, i) => String(i)).concat(['9301', '9302', '9303']));
  const LP = api.leerLactancia(lacPl, todos);
  ok('S4 plantilla sin modificar: solo AVISOS de ID desconocido, ningun error, ninguna fila valida',
    LP.problemas.length === 2 && LP.problemas.every(p => p.sev === 'AVISO' && /no figura/.test(p.msg)) && LP.conError === 0 && LP.validas === 0, JSON.stringify(LP.problemas));
  ok('S4 cargar la plantilla tal cual no acredita lactancia a nadie (resultado identico a no cargar archivo)',
    plValidas === 0 && huellaPl === huellaSin);

  // ── S6: minutos por etapa nunca negativos ──
  api.__set('cLactMin6', '-30'); api.__set('cLactMin24', '-1');
  const cfg = api.readConfig();
  ok('S6 cLactMin6 / cLactMin24 negativos se acotan a 0', cfg.lactMin6 === 0 && cfg.lactMin24 === 0, JSON.stringify([cfg.lactMin6, cfg.lactMin24]));
  api.__set('cLactMin6', '45');
  ok('S6 un valor valido se respeta', api.readConfig().lactMin6 === 45);
  api.__set('cLactMin6', '60'); api.__set('cLactMin24', '30');

  // ── chip E-04: salta a la excepcion y conserva el texto del dia ──
  const r = R.byEmp.get('9301').ciclo.find(x => x.lactEtapa && x.lactPagadoMin > 0);
  const c = r && api.chip('E-04', r);
  ok('chip E-04 con credito lleva data-nov (salto a la excepcion), data-emp, data-fecha y data-tip', c && /data-nov="E-04"/.test(c) && /data-emp="9301"/.test(c) && /data-fecha="/.test(c) && /data-tip="/.test(c), c);
  const c2 = api.chip('A-04', { id: '9301', iso: DIA });
  ok('otros chips siguen igual (data-nov sin data-tip)', /data-nov="A-04"/.test(c2) && !/data-tip/.test(c2));
  // initPop: data-tip manda sobre data-nov en el tooltip; sin data-tip se usa el texto del catalogo
  global.innerWidth = 1000; global.innerHeight = 800;
  api.initPop();
  const pop = api.__mk('#pop');
  const sobre = ds => {
    const el = { dataset: ds, getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 0, width: 0, height: 0 }) };
    api.__escuchas.mouseover.slice(-1)[0]({ target: { closest: () => el } });
    return pop.innerHTML;
  };
  ok('initPop: con data-nov y data-tip muestra el texto del dia', sobre({ nov: 'E-04', tip: 'Texto del dia' }).includes('Texto del dia'));
  ok('initPop: solo data-nov muestra la ficha del catalogo', sobre({ nov: 'A-04' }).includes('Qué pasó'));
  ok('initPop: solo data-tip sigue funcionando', sobre({ tip: 'Solo tip' }).includes('Solo tip'));
}
console.log(fallos ? '\nFALLOS: ' + fallos : '\nEXPORTACIONES OK');
process.exit(fallos ? 1 : 0);
