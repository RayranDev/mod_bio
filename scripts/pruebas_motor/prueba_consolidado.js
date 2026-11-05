'use strict';
// Consolidado: filtro de CARGO (dependiente del departamento), columna Cargo y selector de columnas, en los DOS
// archivos, con datos 100% ficticios (ids 94xx). Comprueba la cascada departamento -> cargo, la semantica del
// filtro (Y con el resto, "(sin cargo)"), que la pantalla y los Excel/Sinergy respetan el filtro, que el Excel
// sin filtro conserva su orden de columnas (CARGO ya estaba), que cada fila tiene las mismas celdas que el
// encabezado (con y sin conceptos), el selector de columnas, y que nada revienta si el HTML no declara
// #fCargo ni #btnColsCons (mock que devuelve null).
const fs = require('fs'), os = require('os'), path = require('path');
const { cargar, invariantes, FILES } = require('./lib.js');

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fl = lista => DIAS.map(d => lista.includes(d) ? 'True' : '');
const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
const pad = n => String(n).padStart(2, '0');
const habiles = [];
for (let d = 1; d <= 30; d++) { const dt = new Date(Date.UTC(2026, 8, d)); const w = dt.getUTCDay(); if (w >= 1 && w <= 5) habiles.push(`2026-09-${pad(d)}`); }

// id, departamento, cargo ('' = sin cargo), dias con extra (para que tengan conceptos o no)
const PERSONAS = [
  ['9401', 'DEPTO A', 'OPERARIO', 4], ['9402', 'DEPTO A', 'OPERARIO', 0], ['9403', 'DEPTO A', 'SUPERVISOR', 2],
  ['9411', 'DEPTO B', 'OPERARIO', 3], ['9412', 'DEPTO B', 'ANALISTA', 0],
  ['9421', 'GERENCIA X', '', 1], ['9422', 'GERENCIA X', 'GERENTE', 0],
];

function construir() {
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  tur.push(['T_DIA', 'T_DIA', '1', '07:00:00', '15:00:00', ...fl(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']), '', '0', '']);
  PERSONAS.forEach(([id, dep, cargo, nExtra]) => {
    emp.push([id, 'PRUEBA', 'CON' + id, '2020-01-01', dep, 'PLASTITECSA', cargo, 'Habilitado']);
    hor.push([id, 'PRUEBA', 'CON' + id, 'T_DIA', 'T_DIA', '2026-08-01', '2026-12-31']);
    habiles.forEach((iso, i) => {
      const extra = i >= habiles.length - nExtra;
      const push = (d, hm) => mar.push([id, 'PRUEBA', 'CON' + id, 'PLASTITECSA', dep, cargo, f2(d), hm, '255', 'Dispositivo-PORTERIA PLANTA 1']);
      push(iso, '07:00'); push(iso, extra ? '17:00' : '15:00');
    });
  });
  return { emp, tur, hor, mar };
}

let fallos = 0;
const ok = (n, c, extra = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!c) fallos++; };
const mala = s => /NaN|undefined|\[object|Infinity/.test(s);

function preparar(htmlPath) {
  const api = cargar(htmlPath, { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' } });
  const D = construir();
  api.DATA.emp = api.__leer(D.emp); api.DATA.tur = api.__leer(D.tur); api.DATA.hor = api.__leer(D.hor); api.DATA.mar = api.__leer(D.mar);
  api.DATA.ren = null; api.DATA.lac = null;
  api.__set('cIni', '2026-09-01'); api.__set('cFin', '2026-09-30');
  api.runCalc();
  return api;
}
const ids = api => api.consFiltrado().map(e => e.emp.id).sort().join(',');
const opciones = api => [...api.__mk('#fCargo').innerHTML.matchAll(/<option(?: value="([^"]*)")?>([^<]*)/g)].map(m => m[1] !== undefined ? m[1] : m[2]);
const celdas = (html, tag) => (html.match(new RegExp('<' + tag + '\\b', 'g')) || []).length;
const salida = {};

for (const [nombre, html] of Object.entries(FILES)) {
  const api = preparar(html);
  const R = api.__ev('RESULT');
  console.log(`── ${nombre}`);
  ok('sin errores de consola al calcular', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  ok('invariantes I-01/I-02/I-03 en cero', JSON.stringify(invariantes(R)) === '{"i1":0,"i2":0,"i3":0}');

  // sin filtros
  api.__set('fSinConc', ''); api.__mk('#fSinConc').checked = true;     // ver todos, con y sin conceptos
  ok('sin filtros entran las 7 personas', ids(api) === '9401,9402,9403,9411,9412,9421,9422', ids(api));
  api.__mk('#fSinConc').checked = false;
  ok('sin filtros (ver sin conceptos apagado) filtroHay es falso', api.filtroHay() === false);

  // lista de cargos: todos los departamentos
  api.fillCargos();
  let op = opciones(api);
  ok('sin departamento: todos los cargos + "(sin cargo)", ordenados', JSON.stringify(op) === JSON.stringify(['', 'ANALISTA', 'GERENTE', 'OPERARIO', 'SUPERVISOR', '(sin cargo)']), JSON.stringify(op));

  // cascada: departamento -> cargos de ese departamento
  api.__set('fDepto', 'DEPTO A'); api.fillCargos();
  op = opciones(api);
  ok('DEPTO A: solo OPERARIO y SUPERVISOR (sin "(sin cargo)")', JSON.stringify(op) === JSON.stringify(['', 'OPERARIO', 'SUPERVISOR']), JSON.stringify(op));
  api.__set('fDepto', 'GERENCIA X'); api.fillCargos();
  op = opciones(api);
  ok('GERENCIA X: GERENTE y "(sin cargo)"', JSON.stringify(op) === JSON.stringify(['', 'GERENTE', '(sin cargo)']), JSON.stringify(op));

  // la seleccion se conserva si sigue valida y se reinicia si no
  api.__set('fDepto', ''); api.fillCargos(); api.__set('fCargo', 'OPERARIO');
  api.__set('fDepto', 'DEPTO A'); api.fillCargos();
  ok('OPERARIO existe tambien en DEPTO A: la seleccion se conserva', api.__mk('#fCargo').value === 'OPERARIO');
  api.__set('fDepto', 'GERENCIA X'); api.fillCargos();
  ok('OPERARIO no existe en GERENCIA X: la seleccion vuelve a "todos"', api.__mk('#fCargo').value === '');
  api.__set('fDepto', ''); api.fillCargos(); api.__set('fCargo', '(sin cargo)');
  api.__set('fDepto', 'DEPTO A'); api.fillCargos();
  ok('"(sin cargo)" no existe en DEPTO A: se reinicia', api.__mk('#fCargo').value === '');

  // semantica del filtro
  api.__set('fDepto', ''); api.fillCargos();
  api.__set('fCargo', 'OPERARIO');
  ok('cargo OPERARIO (sin departamento): solo los que tienen conceptos, 9401 y 9411', ids(api) === '9401,9411', ids(api));
  api.__mk('#fSinConc').checked = true;
  ok('cargo OPERARIO con «ver sin conceptos»: 9401, 9402, 9411', ids(api) === '9401,9402,9411', ids(api));
  api.__mk('#fSinConc').checked = false;
  ok('con cargo elegido el filtro esta activo', api.filtroHay() === true);
  api.__set('fDepto', 'DEPTO B');
  ok('DEPTO B + OPERARIO (Y): solo 9411', ids(api) === '9411', ids(api));
  api.__set('fDepto', ''); api.__set('fCargo', '(sin cargo)');
  api.__mk('#fSinConc').checked = true;
  ok('"(sin cargo)": solo la persona sin cargo (9421)', ids(api) === '9421', ids(api));
  api.__mk('#fSinConc').checked = false;
  api.__set('fCargo', 'SUPERVISOR'); api.__set('qCons', '9403');
  ok('cargo + buscador (Y): 9403', ids(api) === '9403', ids(api));
  api.__set('qCons', '9499');
  ok('cargo + buscador sin coincidencia: vacio', ids(api) === '');
  api.__set('qCons', '');
  ok('filtroSlug incluye el cargo', /SUPERVISOR/.test(api.filtroSlug()), api.filtroSlug());

  // pantalla == Excel == Sinergy respetan el filtro
  api.__set('fCargo', 'OPERARIO');
  const A = api.aoaCons();
  const idsAoa = A.slice(1).map(f => f[0]).sort().join(',');
  ok('Excel del consolidado con cargo: mismas personas que la pantalla', idsAoa === ids(api), idsAoa);
  const iCargo = A[0].indexOf('CARGO');
  ok('el Excel ya traia CARGO (una sola vez) y todas las filas filtradas tienen ese cargo', A[0].filter(h => h === 'CARGO').length === 1 && A.slice(1).every(f => f[iCargo] === 'OPERARIO'));
  let sinergy = null;
  const BlobOrig = global.Blob;
  global.Blob = function (p) { sinergy = p.join(''); };
  global.document.createElement = () => ({ click() {}, set href(v) {}, set download(v) {}, remove() {} });
  api.sinergyTxt();
  global.Blob = BlobOrig;
  const idsTxt = [...new Set((sinergy || '').split('\n').filter(Boolean).map(l => l.split('\t')[0]))].sort().join(',');
  ok('Sinergy con cargo: solo ids del filtro', sinergy !== null && idsTxt !== '' && idsTxt.split(',').every(i => ['9401', '9402', '9411'].includes(i)), idsTxt);

  // filtro vacio: Excel y Sinergy completos y con el mismo orden de columnas de siempre
  api.__set('fCargo', '');
  const A0 = api.aoaCons();
  ok('sin filtro el Excel trae a las 4 personas con conceptos (las otras 3 no tienen ninguno)', A0.length === 5, String(A0.length));
  const cabecera = A0[0];
  const pos = n => cabecera.indexOf(n);
  ok('orden de columnas del Excel intacto (PERFIL, CARGO, DEPARTAMENTO, COMPANIA seguidas)', pos('CARGO') === pos('PERFIL') + 1 && pos('DEPARTAMENTO') === pos('CARGO') + 1 && pos('COMPANIA') === pos('DEPARTAMENTO') + 1);
  ok('sin filtro el Excel de excepciones no se recorta', api.aoaExc(api.filtroHay() ? new Set() : null).length === R.exc.length + 1);

  // tabla: cada fila tiene tantas celdas como el encabezado, con y sin conceptos
  api.__mk('#fSinConc').checked = true;
  api.renderCons();
  const thead = api.__mk('#tCons thead').innerHTML, tbody = api.__mk('#tCons tbody').innerHTML;
  const nth = celdas(thead, 'th');
  const filas = tbody.split('<tr').slice(1);
  ok(`encabezado con data-col en cada columna que se puede ocultar (${nth} columnas)`, (thead.match(/data-col="/g) || []).length === nth - 2, `${(thead.match(/data-col="/g) || []).length} de ${nth - 2}`);
  ok('cada fila tiene tantas celdas como el encabezado (7 filas, con y sin conceptos)', filas.length === 7 && filas.every(f => celdas(f, 'td') === nth), filas.map(f => celdas(f, 'td')).join(',') + ' vs ' + nth);
  ok('la columna CARGO esta entre DEPARTAMENTO y COMPAÑÍA', /DEPARTAMENTO<\/th><th data-col="cargo">CARGO<\/th><th data-col="cia">COMPAÑÍA/.test(thead));
  ok('el cargo vacio se muestra como "—" y los demas con su nombre', /data-col="cargo">—<\/td>/.test(tbody) && /data-col="cargo">GERENTE<\/td>/.test(tbody));
  ok('hay una fila sin conceptos y se marca igual', /Sin conceptos/.test(tbody));
  ok('la tabla no pinta NaN/undefined', !mala(thead + tbody));
  api.__set('fCargo', 'NO EXISTE');
  api.renderCons();
  const vacio = api.__mk('#tCons tbody').innerHTML;
  const col = /colspan="(\d+)"/.exec(vacio);
  ok('estado vacio: el colspan cubre exactamente todas las columnas', col && +col[1] === nth, col ? col[1] + ' vs ' + nth : vacio);
  api.__set('fCargo', ''); api.__mk('#fSinConc').checked = false;

  // selector de columnas
  api.renderColsCons();
  const caja = api.__mk('#colsConsBox').innerHTML;
  ok('el selector ofrece Departamento, Cargo, Compañía, los conceptos, las horas y los otros', ['dep', 'cargo', 'cia', 'hrs', 'ord', 'pend', 'extra', 'perfil', 'aut', 'estado'].every(k => caja.includes(`data-col-chk="${k}"`)) && /data-col-chk="c-/.test(caja));
  ok('no ofrece ocultar el codigo ni el nombre, ni la lactancia sin archivo', !/data-col-chk="(id|cod|nombre)"/.test(caja) && !caja.includes('data-col-chk="lact"'));
  ok('todo marcado por defecto (nada oculto)', (caja.match(/data-col-chk/g) || []).length > 0 && (caja.match(/data-col-chk/g) || []).length === (caja.match(/ checked>/g) || []).length);
  api.__ev("COLS_CONS_OCULTAS.add('cargo'); COLS_CONS_OCULTAS.add('c-0220'); aplicarColsCons()");
  const css = api.__mk('#colConsStyle').textContent;
  ok('ocultar columnas genera el CSS de #tCons', css.includes('#tCons [data-col="cargo"]{display:none}') && css.includes('#tCons [data-col="c-0220"]{display:none}'), css);
  api.renderColsCons();
  ok('lo oculto aparece sin marcar en el selector', !/data-col-chk="cargo"[^>]* checked/.test(api.__mk('#colsConsBox').innerHTML));
  api.aoaCons();
  ok('ocultar columnas NO cambia el Excel', api.aoaCons()[0].includes('CARGO'));
  // cableado (DOMContentLoaded) y "Mostrar todas"
  api.__dom();
  ok('DOMContentLoaded sin errores de consola', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  api.__mk('#btnColsConsAll').onclick();
  ok('"Mostrar todas": vacia el conjunto, guarda [] y limpia el CSS', api.__ev('COLS_CONS_OCULTAS.size') === 0 && api.__ev("localStorage.getItem('mb_colsCons')") === '[]' && api.__mk('#colConsStyle').textContent === '');
  // el cambio de departamento repuebla los cargos (cableado real)
  api.__set('fDepto', 'GERENCIA X'); api.__mk('#fDepto').onchange();
  ok('onchange de #fDepto repuebla los cargos', JSON.stringify(opciones(api)) === JSON.stringify(['', 'GERENTE', '(sin cargo)']));
  // Limpiar deja todo en blanco y repuebla
  api.__set('fCargo', 'GERENTE'); api.__mk('#fClear').onclick();
  ok('Limpiar: cargo, departamento vacios y lista completa de cargos', api.__mk('#fCargo').value === '' && api.__mk('#fDepto').value === '' && opciones(api).length === 6, JSON.stringify(opciones(api)));
  salida[nombre] = { thead: api.__mk('#tCons thead').innerHTML, tbody: api.__mk('#tCons tbody').innerHTML, kpis: api.__mk('#kpis').innerHTML };
  ok('toda la sesion sin errores de consola', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
}
const [a, b] = Object.values(salida);
ok('los dos archivos pintan exactamente lo mismo (encabezado, filas y tarjetas)', a.thead === b.thead && a.tbody === b.tbody && a.kpis === b.kpis);

// Version sin #fCargo / #btnColsCons: el mock devuelve null y nada debe reventar
for (const [nombre, html] of Object.entries(FILES)) {
  const tmp = path.join(os.tmpdir(), 'prueba_consolidado_' + nombre + '.html');
  let fuente = fs.readFileSync(html, 'utf8');
  fuente = fuente.replace(/id="fCargo"/g, 'id="xxCargo"').replace(/id="btnColsCons"/g, 'id="xxBtnColsCons"').replace(/id="colConsStyle"/g, 'id="xxColConsStyle"');
  fs.writeFileSync(tmp, fuente);
  try {
    const api = preparar(tmp);
    api.__dom();
    api.fillFiltros(); api.renderCons(); api.renderColsCons(); api.aplicarColsCons();
    ok(`${nombre} sin #fCargo ni #btnColsCons: calcula, pinta y cablea sin errores`, api.__errores.length === 0 && api.consFiltrado().length === 4, api.__errores.slice(0, 2).join(' | ') + ' / filas: ' + api.consFiltrado().length);
  } catch (e) { ok(`${nombre} sin #fCargo ni #btnColsCons`, false, e.message.slice(0, 160)); }
  finally { fs.unlinkSync(tmp); }
}
console.log(fallos ? 'FALLOS: ' + fallos : 'CONSOLIDADO OK');
process.exit(fallos ? 1 : 0);
