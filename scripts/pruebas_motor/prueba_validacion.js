'use strict';
// Matriz de validacion (a)-(h) del archivo de lactancia, por la capa readSheet con FILA DE TITULO
// y filas en blanco, en los dos archivos y con tres variantes de encabezado.
const { cargar, FILES } = require('./lib.js');
const serial = iso => { const [y, m, d] = iso.split('-').map(Number); return String((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5); };

const HEADERS = {
  A: ['ID_empleado', 'Inicio_lactancia_6m', 'Fin_lactancia_6m', 'Inicio_lactancia_24m', 'Fin_lactancia_24m'],
  B: ['Empleado ID', 'Fecha inicio 6 meses', 'Fecha fin 6 meses', 'Fecha inicio 24 meses', 'Fecha fin 24 meses'],
  C: ['Código', 'Desde 6M', 'Hasta 6M', 'Desde 24M', 'Hasta 24M'],
};
// filas de datos (la primera queda en la fila 3 de la hoja: titulo=1, encabezado=2)
const DATOS = [
  ['9001', '2026-01-15', '2026-07-14', '2026-07-15', '2027-01-14'],        // 3  valida, ambas
  ['9002', '2026-01-15', '2026-07-14', '', ''],                            // 4  valida, solo 6M
  ['9003', '', '', '2026-07-15', '2027-01-14'],                            // 5  valida, solo 24M
  ['', '2026-01-15', '2026-07-14', '', ''],                                // 6  (a) id vacio
  ['99999', '2026-01-15', '2026-07-14', '', ''],                           // 7  (b) id desconocido
  [],                                                                      // 8  fila en blanco (no cuenta, pero ocupa fila)
  ['9004', '2026-01-15', '2026-07-14', '', ''],                            // 9  (c) repetido
  ['9004', '2026-03-01', '2026-08-30', '', ''],                            // 10 (c) repetido
  ['9005', '2026-01-15', '', '2026-07-15', '2027-01-14'],                  // 11 (d) 6M sin fin; 24M valida
  ['9006', '2026-07-14', '2026-01-15', '', ''],                            // 12 (e) fin < inicio, solo esa etapa -> + (h)
  ['9007', '2026-01-15', '2026-08-01', '2026-07-15', '2027-01-14'],        // 13 (f) Fin6 > Ini24 -> fila ignorada
  ['9008', '2026-01-15', '2026-07-15', '2026-07-15', '2027-01-14'],        // 14 Fin6 == Ini24 -> valida, sin problema
  ['9009', '2026-01-15', '31/02/2026', '2026-07-15', '2027-01-14'],        // 15 (g) fecha imposible; 24M valida
  ['9010', '', '', '', ''],                                                // 16 (h) sin ninguna fecha
  ['9011', serial('2026-01-15'), '14/07/2026', '2026-07-15', serial('2027-01-14')], // 17 formatos mixtos: serial, DD/MM/AAAA, ISO
  ['9012', 'abc', 'xyz', '', ''],                                          // 18 (g) ilegibles + (h)
  ['9013', '2026-01-15', '2026-07-14', '2026-07-15', ''],                  // 19 (d) 24M sin fin; 6M valida
];
const CONOCIDOS = new Set(['9001', '9002', '9003', '9004', '9005', '9006', '9007', '9008', '9009', '9010', '9011', '9012', '9013']);

// esperado: fila -> [[sev, subcadena], ...] (en orden) ; y fases validas por id
const ESP = {
  6: [['ERROR', 'ID vacío o ilegible']],
  7: [['AVISO', 'no figura en el maestro']],
  9: [['ERROR', 'ID repetido en las filas 9, 10']],
  10: [['ERROR', 'ID repetido en las filas 9, 10']],
  11: [['ERROR', 'etapa de 6 meses está incompleta: falta la fecha de fin']],
  12: [['ERROR', 'fecha de fin (2026-01-15) es anterior a la de inicio (2026-07-14)']],   // el error ya explica que la fila no tiene etapa válida: no se repite como aviso
  13: [['ERROR', 'termina el 2026-08-01, después de que empieza la de 24 meses (2026-07-15). Se ignora toda la fila']],
  15: [['ERROR', 'Fecha ilegible en la etapa de 6 meses (fin «31/02/2026»)']],
  16: [['AVISO', 'ninguna etapa válida']],
  18: [['ERROR', 'Fecha ilegible en la etapa de 6 meses (inicio «abc» y fin «xyz»)']],
  19: [['ERROR', 'etapa de 24 meses está incompleta: falta la fecha de fin']],
};
const FASES = {
  '9001': ['6M 2026-01-15..2026-07-14', '24M 2026-07-15..2027-01-14'],
  '9002': ['6M 2026-01-15..2026-07-14'],
  '9003': ['24M 2026-07-15..2027-01-14'],
  '9005': ['24M 2026-07-15..2027-01-14'],
  '9008': ['6M 2026-01-15..2026-07-15', '24M 2026-07-15..2027-01-14'],
  '9009': ['24M 2026-07-15..2027-01-14'],
  '9011': ['6M 2026-01-15..2026-07-14', '24M 2026-07-15..2027-01-14'],
  '9013': ['6M 2026-01-15..2026-07-14'],
};
const NO_APLICAN = ['9004', '9006', '9007', '9010', '9012'];   // ids sin ninguna etapa con efecto

let fallos = 0;
const ok = (n, c, extra = '') => { if (!c) { fallos++; console.log('FALLA ' + n + ' ' + extra); } return c; };
const resumen = {};
for (const [nombre, html] of Object.entries(FILES)) {
  const firmas = [];
  for (const [hv, hdr] of Object.entries(HEADERS)) {
    const api = cargar(html);
    const aoa = [['Lactancia'], hdr, ...DATOS];
    const orig = global.XLSX.utils.sheet_to_json;
    global.XLSX.utils.sheet_to_json = () => aoa;
    const lac = api.readSheet(null, true);
    global.XLSX.utils.sheet_to_json = orig;
    let L;
    try { L = api.leerLactancia(lac, CONOCIDOS); } catch (e) { ok(`${nombre}/${hv} no lanza`, false, e.message); continue; }
    ok(`${nombre}/${hv} 17 filas leidas (la vacia se descarta)`, lac.rows.length === 16 && L.total === 16, String(lac.rows.length));
    // problemas por fila
    const porFila = {};
    L.problemas.forEach(p => (porFila[p.fila] = porFila[p.fila] || []).push([p.sev, p.msg]));
    Object.entries(ESP).forEach(([f, lista]) => {
      const got = porFila[f] || [];
      ok(`${nombre}/${hv} fila ${f}: ${lista.length} problema(s)`, got.length === lista.length, JSON.stringify(got));
      lista.forEach(([sev, sub], i) => ok(`${nombre}/${hv} fila ${f} #${i}: ${sev} "${sub}"`, got[i] && got[i][0] === sev && got[i][1].includes(sub), JSON.stringify(got[i])));
    });
    const sinEsperar = Object.keys(porFila).filter(f => !ESP[f]);
    ok(`${nombre}/${hv} sin problemas inesperados`, sinEsperar.length === 0, JSON.stringify(sinEsperar.map(f => [f, porFila[f]])));
    Object.entries(FASES).forEach(([id, esp]) => {
      const got = ((L.porId.get(id) || {}).fases || []).map(f => `${f.etapa} ${f.ini}..${f.fin}`);
      ok(`${nombre}/${hv} fases de ${id}`, JSON.stringify(got) === JSON.stringify(esp), JSON.stringify(got));
    });
    NO_APLICAN.forEach(id => ok(`${nombre}/${hv} ${id} sin efecto`, !L.porId.has(id)));
    ok(`${nombre}/${hv} 99999 ignorado`, !L.porId.has('99999'));
    // conteos de la tira de encabezado
    ok(`${nombre}/${hv} validas=8`, L.validas === 8, String(L.validas));
    // filas con error: 6,9,10,11,12,13,15,18,19 = 9 ; solo aviso: 7,16 = 2
    ok(`${nombre}/${hv} conError=9`, L.conError === 9, String(L.conError));
    ok(`${nombre}/${hv} soloAviso=2`, L.soloAviso === 2, String(L.soloAviso));
    // el numero de fila es el de la HOJA (con titulo y fila en blanco)
    ok(`${nombre}/${hv} fila de hoja de la primera fila de datos = 3`, lac.rows[0].__fila === 3);
    ok(`${nombre}/${hv} la fila posterior al blanco es la 9`, lac.rows.find(r => r.__fila === 9) !== undefined);
    // el estado por fila alimenta la hoja Lactancia
    const est = Object.fromEntries(L.filas.map(x => [x.fila, x.estado]));
    ok(`${nombre}/${hv} estados`, est[3] === 'VALIDA' && est[11] === 'VALIDA CON ERRORES' && est[13] === 'IGNORADA' && est[14] === 'VALIDA' && est[16] === 'IGNORADA', JSON.stringify(est));
    firmas.push(JSON.stringify([L.problemas, [...L.porId.entries()]]));
    resumen[nombre + '/' + hv] = { validas: L.validas, conError: L.conError, soloAviso: L.soloAviso, problemas: L.problemas.length };
  }
  ok(`${nombre}: las 3 variantes de encabezado dan el MISMO resultado`, new Set(firmas).size === 1);
}
// ── W1: la regla (f) Fin_6m > Inicio_24m solo rige entre dos etapas VALIDAS ──
// Una etapa incompleta o al reves se ignora sola (con su propio error) y la otra sobrevive.
for (const [nombre, html] of Object.entries(FILES)) {
  const api = cargar(html);
  const o = global.XLSX.utils.sheet_to_json;
  const W = [
    ['9201', '2026-01-15', '2026-07-14', '2026-03-01', ''],            // 3: 6M valida + 24M solo inicio (< Fin6)
    ['9202', '2026-01-15', '2026-07-14', '2026-03-01', '2026-02-01'],  // 4: 6M valida + 24M con fin < inicio (inicio < Fin6)
    ['9203', '2026-01-15', '2026-08-01', '2026-07-15', '2027-01-14'],  // 5: dos validas con Fin6 > Ini24 -> toda la fila
    ['9204', '2026-07-14', '2026-01-15', '2026-03-01', '2027-01-14'],  // 6: 6M al reves + 24M valida (Ini24 < Fin6 "declarado")
    ['9205', '2026-08-01', '', '2026-07-15', '2027-01-14'],            // 7: 6M solo inicio + 24M valida
    ['9206', '2026-01-15', '2026-07-15', '2026-07-15', '2027-01-14'],  // 8: Fin6 == Ini24 permitido
    ['9207', '2026-08-01', 'xyz', '2026-07-15', '2027-01-14'],         // 9: 6M ilegible + 24M valida
  ];
  global.XLSX.utils.sheet_to_json = () => [['Lactancia'], HEADERS.A, ...W];
  const lac = api.readSheet(null, true);
  global.XLSX.utils.sheet_to_json = o;
  const L = api.leerLactancia(lac, new Set(W.map(r => r[0])));
  const prob = f => L.problemas.filter(p => p.fila === f);
  const fases = id => ((L.porId.get(id) || {}).fases || []).map(f => f.etapa + ' ' + f.ini + '..' + f.fin);
  ok(nombre + ' W1a 6M valida + 24M solo inicio: sobrevive la 6M', JSON.stringify(fases('9201')) === '["6M 2026-01-15..2026-07-14"]', JSON.stringify(fases('9201')));
  ok(nombre + ' W1a un solo error (incompleta), sin el de la regla f', prob(3).length === 1 && /incompleta/.test(prob(3)[0].msg), JSON.stringify(prob(3)));
  ok(nombre + ' W1b 6M valida + 24M con fin < inicio: sobrevive la 6M', JSON.stringify(fases('9202')) === '["6M 2026-01-15..2026-07-14"]', JSON.stringify(fases('9202')));
  ok(nombre + ' W1b un solo error (fin anterior al inicio)', prob(4).length === 1 && /anterior a la de inicio/.test(prob(4)[0].msg), JSON.stringify(prob(4)));
  ok(nombre + ' W1c dos etapas validas con Fin6 > Ini24: se ignora TODA la fila', !L.porId.has('9203') && prob(5).length === 1 && /Se ignora toda la fila/.test(prob(5)[0].msg), JSON.stringify(prob(5)));
  ok(nombre + ' W1d 6M al reves + 24M valida: sobrevive la 24M, un solo error', JSON.stringify(fases('9204')) === '["24M 2026-03-01..2027-01-14"]' && prob(6).length === 1 && /anterior a la de inicio/.test(prob(6)[0].msg), JSON.stringify([fases('9204'), prob(6)]));
  ok(nombre + ' W1e 6M solo inicio + 24M valida: sobrevive la 24M, un solo error', JSON.stringify(fases('9205')) === '["24M 2026-07-15..2027-01-14"]' && prob(7).length === 1, JSON.stringify([fases('9205'), prob(7)]));
  ok(nombre + ' W1f Fin6 == Ini24: ambas etapas, sin problemas', fases('9206').length === 2 && prob(8).length === 0, JSON.stringify(fases('9206')));
  ok(nombre + ' W1g 6M ilegible + 24M valida: sobrevive la 24M, un solo error', fases('9207').length === 1 && fases('9207')[0].startsWith('24M') && prob(9).length === 1, JSON.stringify([fases('9207'), prob(9)]));
}

// Casos extra: sin columnas reconocibles / archivo vacio / solo encabezado: no deben lanzar
for (const html of Object.values(FILES)) {
  const api = cargar(html);
  const prueba = aoa => { const o = global.XLSX.utils.sheet_to_json; global.XLSX.utils.sheet_to_json = () => aoa;
    try { const l = api.readSheet(null, true); return api.leerLactancia(l, CONOCIDOS); } finally { global.XLSX.utils.sheet_to_json = o; } };
  let r1, r2, r3;
  try { r1 = prueba([['Lactancia'], ['Columna X', 'Columna Y'], ['1', '2']]); } catch (e) { ok('columnas irreconocibles no lanza', false, e.message); }
  try { r2 = prueba([['Lactancia'], HEADERS.A]); } catch (e) { ok('solo encabezado no lanza', false, e.message); }
  let r3lanza = false; try { r3 = prueba([]); } catch (e) { r3lanza = true; }
  ok('columnas irreconocibles: fila con id ilegible (ERROR)', r1 && r1.problemas.length === 1 && r1.problemas[0].sev === 'ERROR');
  ok('solo encabezado: 0 filas', r2 && r2.total === 0 && r2.validas === 0);
  ok('hoja totalmente vacia: readSheet falla como con los otros 5 archivos (lo atrapa el hook, ver abajo)', r3lanza);
}

// ── hook real del archivo de lactancia + tira del encabezado (capa de carga) ──
(async () => {
  for (const html of Object.values(FILES)) {
    const api = cargar(html);
    let h = null; api.__mk('#fLac').addEventListener = (ev, fn) => { h = fn; };
    api.hookLact();
    const setAoa = aoa => { global.XLSX.utils.sheet_to_json = () => aoa; };
    const leer = aoa => { setAoa(aoa); return api.readSheet(null); };
    // hoja vacia: el hook atrapa el error y deja DATA.lac en null
    setAoa([]);
    await h({ target: { files: [{ name: 'vacia.xlsx', arrayBuffer: async () => new ArrayBuffer(0) }] } });
    ok('hook: hoja vacia no lanza y deja DATA.lac=null', api.DATA.lac === null);
    // archivo bueno + maestro y programacion cargados -> validacion al cargar (sin calcular)
    api.DATA.emp = leer([['Empleado'], ['Empleado ID','Nombres','Apellidos','Fecha de contratación','Departamento','Compañía','Cargo'], ['9001','A','B','2020-01-01','D','PLASTITECSA','C'], ['9002','A','B','2020-01-01','D','PLASTITECSA','C']]);
    api.DATA.hor = leer([['Horario'], ['Empleado ID','Nombres','Apellidos','Código','Fecha Inicial','Fecha Final'], ['9003','A','B','T1','2026-01-01','2026-12-31']]);
    setAoa([['Lactancia'], HEADERS.A, ['9001','2026-01-15','2026-07-14','2026-07-15','2027-01-14'], ['9002','2026-07-14','2026-01-15','',''], ['777','2026-01-15','2026-07-14','',''], ['9003','2026-01-15','2026-07-14','','']]);
    await h({ target: { files: [{ name: 'lac.xlsx', arrayBuffer: async () => new ArrayBuffer(0) }] } });
    const hdr = api.__mk('#hdrCarga').innerHTML, L = api.__ev('LACT_CARGA');
    ok('hook: carga y valida al cargar (sin calcular)', L && L.total === 4 && L.validas === 2 && L.conError === 1 && L.soloAviso === 1, JSON.stringify(L && [L.total, L.validas, L.conError, L.soloAviso]));
    ok('tira del encabezado: filas, validas, errores y avisos', /Lactancia: 4/.test(hdr) && /2 válida/.test(hdr) && /1 con error/.test(hdr) && /1 aviso/.test(hdr) && /data-lact-val/.test(hdr), hdr.slice(-330));
    ok('boton de validacion visible cuando hay problemas', api.__mk('#btnLactVal').style.display === '');
    api.renderLactVal();
    const tb = api.__mk('#tLact tbody').innerHTML;
    ok('panel: lista fila, ID, tipo y motivo (solo ID, sin nombres)', tb.includes('<td class="num">4</td>') && /Error/.test(tb) && /Aviso/.test(tb) && !/>A<|>B</.test(tb));
    // retirar el archivo: vuelve a no haber lactancia
    await h({ target: { files: [] } });
    ok('quitar el archivo: DATA.lac=null, tira sin lactancia, boton oculto', api.DATA.lac === null && !/Lactancia/.test(api.__mk('#hdrCarga').innerHTML) && api.__mk('#btnLactVal').style.display === 'none');
    ok('sin errores de consola', api.__errores.length === 0, api.__errores.join('|'));
  }
  console.log(JSON.stringify(resumen));
console.log(fallos ? 'FALLOS: ' + fallos : 'MATRIZ DE VALIDACION OK');
process.exit(fallos ? 1 : 0);
})();
