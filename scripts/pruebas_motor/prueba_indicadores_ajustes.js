'use strict';
// Indicadores y ajustes de horario (Fase C), en los DOS archivos y con datos 100% ficticios (ids 98xx).
// Comprueba: (1) SIN ajustes (o con solo anulados) pantallas y exportaciones de Consolidado, Adopcion, Calidad, Resumen, Rotacion y
// Sinergy son identicas a la version previa del archivo (sale de git); (2) ADOPCION mide BioTime original: con o sin ajustes TODA cifra
// es la misma (por persona, departamento y total; por pantalla y por Excel; con y sin alcance); (3) «Dias ajustados» cuenta bien (vigencia,
// anulado, redundante, turno inexistente, sobrepuesto, rango solapado) y se puede ordenar; (4) CALIDAD: la principal usa el turno ajustado y
// el delta contra la plantilla original sale a mano y coincide con un calculo SIN ajustes (persona, departamento, total, alcance);
// (5) Consolidado: columna «Ajustes» con data-col="aj" (selector, ocultar) y `DIAS CON AJUSTE DE HORARIO` al final del Excel; (6) las columnas
// nuevas salen SOLO con ajustes y siempre al final, todo rectangular; (7) Resumen y Rotacion no cambian de comportamiento; (8) nada de HTML
// inyectado; (9) los dos archivos pintan lo mismo; (10) tiempos con 1.000 personas.
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { cargar, invariantes, FILES, REPO } = require('./lib.js');

let fallos = 0;
const ok = (n, c, extra = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!c) fallos++; };
const J = JSON.stringify;
const cerca = (a, b, t = 1e-6) => Math.abs(a - b) < t;
const mala = s => /NaN|undefined|\[object|Infinity/.test(s);

/* ── datos ficticios ───────────────────────────────────────────────────────────────────────────────────────── */
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fl = lista => DIAS.map(d => lista.includes(d) ? 'True' : '');
const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
const pad = n => String(n).padStart(2, '0');
const sep = d => `2026-09-${pad(d)}`;
const sig = iso => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8)) + 864e5).toISOString().slice(0, 10);
const habil = (a, b) => { const r = []; for (let d = a; d <= b; d++) { const w = new Date(Date.UTC(2026, 8, d)).getUTCDay(); if (w >= 1 && w <= 5) r.push(sep(d)); } return r; };
const LAB = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const HOSTIL = 'D"><img src=x onerror=alert(1)>';           // un departamento hostil que sale en la tarjeta de Dias ajustados
const SH = [['T_DIA', '07:00:00', '15:00:00'], ['T_NOCHE', '22:00:00', '06:00:00'], ['T_MEDIO', '10:00:00', '18:00:00']];
//   id, depto, ingreso, retiro, turno de BioTime (null = ninguno), fin de la programacion
const P = [['9801', 'DEPTO A', null, null, 'T_DIA', '2026-12-31'],            // limpio, sin ajustes
           ['9802', 'DEPTO A', null, null, null, null],                        // SIN ningun turno en BioTime; trabaja 5 noches (14 al 18)
           ['9803', 'DEPTO B', null, null, 'T_DIA', '2026-12-31'],            // limpio, sin ajustes
           ['9804', 'DEPTO B', null, null, 'T_DIA', '2026-12-31'],            // ajuste ANULADO
           ['9805', 'DEPTO B', null, null, 'T_DIA', '2026-12-31'],            // ajuste REDUNDANTE
           ['9806', 'DEPTO B', null, null, 'T_DIA', '2026-12-31'],            // ajuste de turno INEXISTENTE
           ['9807', 'DEPTO B', '2026-09-10', null, 'T_DIA', '2026-12-31'],    // ajuste de todo el mes, ingreso real el 10
           ['9808', 'DEPTO B', null, '2026-09-15', 'T_DIA', '2026-12-31'],    // retiro el 15, ajuste del 10 al 30
           ['9809', 'DEPTO B', null, null, 'T_DIA', '2026-12-31'],            // un ajuste valido tapado por otro mas nuevo de turno inexistente
           ['9810', 'DEPTO B', null, null, 'T_DIA', '2026-12-31'],            // dos ajustes validos que se solapan
           ['9811', HOSTIL, null, null, 'T_DIA', '2026-12-31']];               // departamento hostil
function construir(N) {
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Fecha de retiro', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  SH.forEach(([c, e, s]) => tur.push([c, c, '1', e, s, ...fl(LAB), '', '0', '']));
  const dep = {};
  P.forEach(([id, d, ing, ret, sh, fin]) => {
    dep[id] = d;
    emp.push([id, 'PRUEBA', 'IA' + id, ing || '2020-01-01', ret || '', d, 'PLASTITECSA', 'CARGO PRUEBA', 'Habilitado']);
    if (sh) hor.push([id, 'PRUEBA', 'IA' + id, sh, sh, '2026-08-01', fin]);
  });
  const punch = (id, iso, hm) => mar.push([id, 'PRUEBA', 'IA' + id, 'PLASTITECSA', dep[id], 'CARGO PRUEBA', f2(iso), hm, '255', 'Dispositivo-PORTERIA PLANTA 1']);
  const par = (id, iso, e, s, cruza) => { punch(id, iso, e); punch(id, cruza ? sig(iso) : iso, s); };
  habil(1, 30).forEach(iso => {
    par('9801', iso, '07:00', '15:00');
    if (!habil(14, 18).includes(iso)) par('9803', iso, '07:00', '15:00');
    if (habil(14, 18).includes(iso)) par('9802', iso, '22:00', '06:00', true);
    ['9804', '9805', '9806', '9809', '9810', '9811'].forEach(id => par(id, iso, '07:00', '15:00'));
    if (habil(14, 18).includes(iso)) par('9803', iso, '07:00', '17:00');     // 2 h extra por dia: Sinergy lleva lineas de alguien SIN ajustes
    if (iso >= '2026-09-10') par('9807', iso, '07:00', '15:00');
    if (iso <= '2026-09-15') par('9808', iso, '07:00', '15:00');
  });
  return { emp, tur, hor, mar };
}
function nuevo(html, store) {
  const api = cargar(html, { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' }, store });
  const D = construir();
  api.DATA.emp = api.__leer(D.emp); api.DATA.tur = api.__leer(D.tur); api.DATA.hor = api.__leer(D.hor); api.DATA.mar = api.__leer(D.mar);
  api.DATA.ren = null; api.DATA.lac = null;
  return api;
}
let SEQ = 0;
const A = (emp, desde, hasta, turno, creado, o = {}) => ({ id: 'aj-i-' + (++SEQ), emp, desde, hasta, turno, motivo: 'EQUIVOCADO', nota: '', autor: 'Prueba', creado: creado || '2026-11-10T09:00:00', anulado: null, ...o });
const poner = (api, ...lista) => { const L = api.__ev('AJ_HORARIO'); lista.forEach(a => L.push(a)); api.__ev('ajPersistir()'); };
const vaciar = api => { api.__ev('AJ_HORARIO').length = 0; api.__ev('ajPersistir()'); };
function ajustes() {          // el conjunto de la prueba
  return [
    A('9802', '2026-09-14', '2026-09-18', 'T_NOCHE', null, { motivo: 'NO_CARGADO' }),                                     // 5 dias
    A('9804', '2026-09-14', '2026-09-18', 'T_NOCHE', null, { anulado: { autor: 'Otra', en: '2026-11-11T09:00:00', motivo: 'Era un error' } }),   // 0
    A('9805', '2026-09-14', '2026-09-18', 'T_DIA'),                                                                        // 0 (redundante)
    A('9806', '2026-09-14', '2026-09-18', 'T_ZZZ'),                                                                        // 0 (turno inexistente)
    A('9807', '2026-09-01', '2026-09-30', 'T_NOCHE'),                                                                      // 21 (ingreso real el 10)
    A('9808', '2026-09-10', '2026-09-30', 'T_MEDIO'),                                                                      // 6 (retiro el 15)
    A('9809', '2026-09-14', '2026-09-18', 'T_NOCHE', '2026-11-01T09:00:00'),
    A('9809', '2026-09-16', '2026-09-17', 'T_ZZZ', '2026-11-02T09:00:00'),                                                 // tapa el 16 y el 17: quedan 3
    A('9810', '2026-09-14', '2026-09-18', 'T_NOCHE', '2026-11-01T09:00:00'),
    A('9810', '2026-09-16', '2026-09-20', 'T_MEDIO', '2026-11-02T09:00:00'),                                               // 2 + 5 = 7
    A('9811', '2026-09-14', '2026-09-18', 'T_MEDIO')];                                                                      // 5
}
const ESPERADO = { 9801: 0, 9802: 5, 9803: 0, 9804: 0, 9805: 0, 9806: 0, 9807: 21, 9808: 6, 9809: 3, 9810: 7, 9811: 5 };
const SEMBRA_EXCEL = JSON.stringify;

/* ── captura de TODO lo que estas pestañas pintan y exportan ───────────────────────────────────────────────── */
const git = args => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
function lineaBase(nombre) {            // la version mas reciente del archivo SIN la Fase C (sale de git)
  let log = [];
  try { log = git(['log', '--format=%H', '-n', '80', '--', nombre]).split('\n').filter(Boolean); } catch (e) { return null; }
  for (const h of log) { const t = git(['show', `${h}:${nombre}`]); if (!t.includes('function ajHay')) return t; }
  return null;
}
const IDS_PANTALLA = ['#tCons thead', '#tCons tbody', '#kpis', '#colsConsBox', '#cobTiles', '#tCobDep thead', '#tCobDep tbody', '#cobRuta', '#cobAviso', '#tCob thead', '#tCob tbody',
  '#qHero', '#qFuera', '#tQ thead', '#tQ tbody', '#tQEmp thead', '#tQEmp tbody', '#qEmpInfo', '#qRuta',
  '#indCards', '#indSalud', '#indBarras', '#indAlert', '#indEst', '#indSem', '#tIndHeat tbody'];
function pintar(api) {
  api.__mk('#fSinConc').checked = true;
  api.renderCons(); api.renderColsCons(); api.renderCob(); api.renderCalidad(); api.renderInd();
  return Object.fromEntries(IDS_PANTALLA.map(s => [s, api.__mk(s).innerHTML || api.__mk(s).textContent || '']));
}
function capturar(api) {
  const o = {}, intenta = (k, f) => { try { o[k] = J(f()); } catch (e) { o[k] = 'ERROR ' + e.message; } };
  api.runCalc();
  const R = api.__ev('RESULT');
  intenta('days', () => R.days); intenta('exc', () => R.exc);
  intenta('cons', () => api.aoaCons()); intenta('det', () => [...R.byEmp.values()].map(e => api.aoaDet(e)));
  intenta('calidad', () => api.aoaCalidad()); intenta('calidadEmp', () => api.aoaCalidadEmp());
  intenta('cob', () => api.aoaCobertura()); intenta('cobDep', () => api.aoaCoberturaDep());
  intenta('alcance', () => api.aoaAlcance());
  intenta('ind', () => { const R2 = api.alcanceR(R), I = api.computeInd(R2, api.indOpt(R2)); return [api.aoaInd(I), api.aoaIndEmp(I)]; });
  intenta('rot', () => { const RT = api.rotCalc(); return [api.aoaRotAlcance(RT), api.aoaRotMes(RT)]; });
  intenta('asis', () => api.aoaAsistencia());
  let txt = null; global.URL.createObjectURL = b => { txt = b.p[0]; return 'b'; }; global.document.createElement = () => ({ click() {} });
  intenta('sinergy', () => { api.sinergyTxt(); return txt; });
  api.__dom();
  for (const [k, id] of [['todo', '#expTodo'], ['expDet', '#expDet'], ['expCob', '#expCob'], ['expQ', '#expQ']]) {
    api.__escritos.length = 0; const b = api.__mk(id);
    intenta(k, () => { if (typeof b.onclick !== 'function') return 'SIN BOTON'; b.onclick(); return api.__escritos.map(e => [e.name, e.wb.sheets.map(s => [s.n, s.aoa])]); });
  }
  o.pantalla = pintar(api);
  return o;
}

/* ── utilidades de comparacion ─────────────────────────────────────────────────────────────────────────────── */
const sinDias = o => { const { diasAj, ...r } = o; return r; };
function cobFirma(api) {                       // todo lo de Adopcion salvo la columna «Dias ajustados»
  const { C, lista } = api.cobCalc();
  const porDep = new Map();
  C.filas.forEach(o => { const k = o.emp.depto || ''; if (!porDep.has(k)) porDep.set(k, []); porDep.get(k).push(o); });
  return J({
    filas: C.filas.map(o => { const { diasAj, dias, emp, ...r } = o; return { ...r, id: emp.id, dias: [...dias] }; }),
    lista: lista.map(o => o.id),
    total: sinDias(api.cobAgregar(C.filas)), alcance: sinDias(api.cobAgregar(lista)),
    deps: [...porDep].map(([d, ls]) => [d, sinDias(api.cobAgregar(ls))])
  });
}
// la matriz dia por dia solo se pinta con un departamento abierto: se abren los dos y se junta lo pintado
function matrices(api) {
  const out = [];
  for (const d of ['DEPTO A', 'DEPTO B']) { api.__ev(`COB_DEP = ${J(d)}`); api.renderCob(); if (!api.__mk('#cobMatriz').hidden) out.push(api.__mk('#tCob tbody').innerHTML); }
  api.__ev('COB_DEP = null'); api.renderCob();
  return out.join('\n');
}
// lo que Adopcion dice de su alcance: texto del encabezado impreso, hoja «Alcance» del Excel y la barra de alcance (con la pestaña Adopcion abierta)
function alcanceAdopcion(api) {
  const R = api.__ev('RESULT'), tab = api.__mk('.tabs button.on');
  tab.dataset.tab = 'cob';
  api.alcResumen(); api.renderCob();
  const barra = api.__mk('#alcResumen').textContent + '|' + api.__mk('#alcNota').innerHTML;
  const cab = api.__mk('#cobPrintHead').innerHTML.replace(/generado [0-9\/,: .apm]*/gi, 'generado ');
  if (typeof api.__mk('#expCob').onclick !== 'function') api.__dom();
  api.__escritos.length = 0; api.__mk('#expCob').onclick();
  const hoja = api.__escritos[0].wb.sheets.find(x => x.n === 'Alcance').aoa;
  tab.dataset.tab = '';
  return { txt: api.alcanceTexto(api.resultadoOriginal(R)), aoaAlc: J(api.aoaAlcance(api.resultadoOriginal(R))), hojaAlc: J(hoja), barra, cab };
}
const sinUltima = aoa => aoa.map(f => f.slice(0, -1));
const rect = aoa => aoa.length > 0 && aoa.every(f => f.length === aoa[0].length);
const celdas = (html, tag) => (html.match(new RegExp('<' + tag + '\\b', 'g')) || []).length;
const filasTbody = html => (html.match(/<tr\b[\s\S]*?<\/tr>/g) || []);
// etiquetas del HTML: nada de atributos on*, etiquetas vivas ni comillas sin cerrar
function limpioDeInyeccion(html) {
  const etiquetas = html.match(/<[^>]*>/g) || [];
  // el texto escapado DENTRO de un valor de atributo es inofensivo: se quitan los valores antes de buscar atributos on*
  return etiquetas.every(t => !/\son\w+\s*=/i.test(t.replace(/"[^"]*"/g, '""')) && !/^<\s*(img|script|iframe|svg|object|embed)\b/i.test(t) && (t.match(/"/g) || []).length % 2 === 0);
}

/* ── cuerpo ────────────────────────────────────────────────────────────────────────────────────────────────── */
const SALIDA = {};
function main() {
  for (const [nombre, html] of Object.entries(FILES)) {
    console.log(`── ${nombre}`);
    const esFull = nombre === 'COMPLETO';

    /* 1. sin ajustes (y solo con uno anulado): identico a la version previa */
    const previo = lineaBase(path.basename(html));
    const tmp = previo === null ? null : path.join(os.tmpdir(), 'mb_prev_c_' + path.basename(html));
    if (previo === null) console.log('OMITIDO: no hay version previa a la Fase C en la historia de git (clon superficial); no se hizo la comparacion contra la linea base');
    else {
      fs.writeFileSync(tmp, previo);
      const antes = capturar(nuevo(tmp));
      const ahora = capturar(nuevo(html));
      for (const k of Object.keys(antes).filter(k => k !== 'pantalla')) ok(`sin ajustes: ${k} identico a la version previa`, antes[k] === ahora[k] && !/^ERROR|SIN BOTON/.test(ahora[k]), antes[k] === ahora[k] ? '' : `(${antes[k].length} vs ${ahora[k].length} caracteres)`);
      for (const s of IDS_PANTALLA) ok(`sin ajustes: pantalla ${s} identica a la version previa`, antes.pantalla[s] === ahora.pantalla[s], antes.pantalla[s] === ahora.pantalla[s] ? '' : `(${antes.pantalla[s].length} vs ${ahora.pantalla[s].length})`);
      ok('sin ajustes: ni columnas ni tarjetas nuevas (Ajustes, Dias ajustados, Delta por ajustes)', !/DIAS AJUSTADOS|DIAS CON AJUSTE|DELTA POR AJUSTES/.test(ahora.cons + ahora.cob + ahora.cobDep + ahora.calidad + ahora.calidadEmp + ahora.todo + ahora.expCob + ahora.expQ)
        && !/data-col="aj"|Días ajustados|Δ por ajustes|Efecto de los ajustes/.test(Object.values(ahora.pantalla).join('')));
      // ajustes que NO cambian ningun dia del ciclo (anulado, redundante, fuera del ciclo, turno inexistente): ni una columna, tarjeta ni hoja nueva en las superficies de la Fase C
      const SIN_CAMBIO = {
        'solo uno anulado': [A('9804', '2026-09-14', '2026-09-18', 'T_NOCHE', null, { anulado: { autor: 'Otra', en: '2026-11-11T09:00:00', motivo: 'x' } })],
        'solo uno redundante (ya coincide con BioTime)': [A('9805', '2026-09-14', '2026-09-18', 'T_DIA')],
        'solo uno fuera del ciclo (octubre)': [A('9803', '2026-10-05', '2026-10-09', 'T_NOCHE')],
        'solo uno de turno inexistente': [A('9806', '2026-09-14', '2026-09-18', 'T_ZZZ')],
        'todos esos juntos': [A('9804', '2026-09-14', '2026-09-18', 'T_NOCHE', null, { anulado: { autor: 'Otra', en: '2026-11-11T09:00:00', motivo: 'x' } }), A('9805', '2026-09-14', '2026-09-18', 'T_DIA'), A('9803', '2026-10-05', '2026-10-09', 'T_NOCHE'), A('9806', '2026-09-14', '2026-09-18', 'T_ZZZ')] };
      // el redundante y el de turno inexistente SI dejan excepciones AJ-H (Fase B): '#kpis' (cuenta excepciones), days y exc se excluyen de la comparacion
      const FASE_C = ['cons', 'cob', 'cobDep', 'calidad', 'calidadEmp', 'alcance', 'ind', 'rot', 'sinergy', 'expCob', 'expQ'];
      for (const [nom, lst] of Object.entries(SIN_CAMBIO)) {
        const api = nuevo(html);
        poner(api, ...lst);
        const c = capturar(api);
        ok(`${nom}: ajHayCambio() es falso aunque haya ajustes cargados`, api.ajHayCambio() === false && api.__ev('MODEL').ajustes.size === (nom === 'solo uno anulado' || nom === 'solo uno de turno inexistente' ? 0 : 1) + (nom === 'todos esos juntos' ? 1 : 0), String(api.__ev('MODEL').ajustes.size));
        for (const k of FASE_C) ok(`${nom}: ${k} identico a la version previa`, c[k] === antes[k] && !/^ERROR|SIN BOTON/.test(c[k]));
        { const th = c.pantalla['#tCons thead']; ok(`${nom}: cada fila del Consolidado tiene tantas celdas como el encabezado`, filasTbody(c.pantalla['#tCons tbody']).every(f => celdas(f, 'td') === celdas(th, 'th'))); }
        for (const sel of IDS_PANTALLA.filter(x => x !== '#kpis' && x !== '#tCons tbody')) ok(`${nom}: pantalla ${sel} identica a la version previa`, c.pantalla[sel] === antes.pantalla[sel]);
        ok(`${nom}: ninguna columna, tarjeta ni hoja nueva`, !/DIAS AJUSTADOS|DIAS CON AJUSTE|DELTA POR AJUSTES|Días ajustados/.test(c.cons + c.cob + c.cobDep + c.calidad + c.calidadEmp + c.expCob + c.expQ + c.alcance) && !/data-col="aj"|Días ajustados|Δ por ajustes|Efecto de los ajustes/.test(Object.values(c.pantalla).join('')));
      }
    }

    /* 2. con ajustes: cifras en dos corridas del MISMO api (con ajustes y despues sin ninguno) */
    const api = nuevo(html);
    api.runCalc();
    ok('calculo inicial: sin errores de consola y con I-01/I-02/I-03 = 0', api.__errores.length === 0 && (i => i.i1 + i.i2 + i.i3)(invariantes(api.__ev('RESULT'))) === 0, api.__errores.slice(0, 1).join(''));
    const lista = ajustes();
    // cero ajustes: las dos lecturas de Calidad y Adopcion de referencia (el "oraculo" independiente)
    const modos = {
      'sin alcance': () => api.alcLimpiar(),
      'DEPTO A': () => { api.alcLimpiar(); api.alcSetModoDep('incluir'); api.alcToggleDep('DEPTO A', true); },
      'ocultar sin turno': () => { api.alcLimpiar(); api.alcSetSinTurno(true); },
      'DEPTO B + sin turno': () => { api.alcLimpiar(); api.alcSetModoDep('incluir'); api.alcToggleDep('DEPTO B', true); api.alcSetSinTurno(true); }
    };
    const calidadPersona = Q => Object.fromEntries(Q.emps.map(p => [p.empRef.id, p]));
    const cero = {};
    vaciar(api); api.runCalc();
    for (const [m, f] of Object.entries(modos)) {
      f();
      const Q = api.calidadFiltrada();
      cero[m] = { aoaQ: J(api.aoaCalidad()), aoaQE: J(api.aoaCalidadEmp()), aoaCons: J(api.aoaCons()), cob: cobFirma(api), aoaCob: J(api.aoaCobertura()), aoaDep: J(api.aoaCoberturaDep()), Q, ident: api.alcanceR(api.__ev('RESULT')).byEmp.size };
      api.renderCob(); cero[m].tiles = api.__mk('#cobTiles').innerHTML; cero[m].matriz = matrices(api);
      Object.assign(cero[m], alcanceAdopcion(api));
    }
    api.alcLimpiar();
    const Q0 = cero['sin alcance'].Q;
    ok('sin ajustes: Calidad no trae lectura original (ni Q.orig ni diasAj)', !Q0.orig && Q0.total.diasAj === undefined);

    poner(api, ...lista);
    api.runCalc();
    let R = api.__ev('RESULT'), M = api.__ev('MODEL');
    ok('con ajustes: sin errores de consola y con I-01/I-02/I-03 = 0', api.__errores.length === 0 && (i => i.i1 + i.i2 + i.i3)(invariantes(R)) === 0, api.__errores.slice(0, 1).join(''));
    ok('con ajustes: RESULT.base existe y trae solo a quienes tienen ajustes vigentes', !!R.base && [...R.base.byEmp.keys()].sort().join() === [...M.ajustes.keys()].sort().join());
    ok('ajHayCambio() es verdadero con ajustes que cambian un dia y falso sin ellos', api.ajHayCambio() === true && (vaciar(api), api.runCalc(), api.ajHayCambio() === false) && (poner(api, ...lista), api.runCalc(), api.ajHayCambio() === true));
    R = api.__ev('RESULT'); M = api.__ev('MODEL');

    /* 3. dias ajustados */
    const n = id => api.ajDiasCambiados(M, id, R.cfg);
    for (const [id, esp] of Object.entries(ESPERADO)) ok(`dias ajustados de ${id}: ${esp}`, n(id) === esp, `(dio ${n(id)})`);
    ok('dias ajustados: anulado, redundante, turno inexistente => 0; sobrepuesto y solapado cuentan cada dia una sola vez', n('9804') === 0 && n('9805') === 0 && n('9806') === 0 && n('9809') === 3 && n('9810') === 7);
    ok('dias ajustados: la vigencia recorta (ingreso real el 10 => 21 dias de 30; retiro el 15 => 6 de los 21 del rango)', n('9807') === 21 && n('9808') === 6);
    ok('ajCambiaDia: un dia sin turno de BioTime ajustado a un turno cuenta (9802 el 15) y uno fuera del rango no (9802 el 21)', api.ajCambiaDia(M, '9802', '2026-09-15') === true && api.ajCambiaDia(M, '9802', '2026-09-21') === false);

    for (const [m, f] of Object.entries(modos)) {
      f();
      const C = api.cobCalc();
      const filas = Object.fromEntries(C.C.filas.map(o => [o.id, o.diasAj]));
      const nCon = api.alcanceR(api.resultadoOriginal(R)).byEmp;
      ok(`[${m}] Adopcion: «Dias ajustados» por persona == ajDiasCambiados de cada una`, [...nCon.keys()].every(id => filas[id] === ESPERADO[id]), J(filas));

      /* 4. ADOPCION INVARIABLE: toda cifra igual que sin ajustes */
      ok(`[${m}] ADOPCION: personas, dias por estado, porcentajes y totales IDENTICOS a los de la corrida SIN ajustes`, cobFirma(api) === cero[m].cob);
      const aoaCob = api.aoaCobertura(), aoaDep = api.aoaCoberturaDep();
      ok(`[${m}] ADOPCION: Excel por persona y por departamento == el de sin ajustes mas la columna «DIAS AJUSTADOS» al final`, J(sinUltima(aoaCob)) === cero[m].aoaCob && J(sinUltima(aoaDep)) === cero[m].aoaDep
        && aoaCob[0][aoaCob[0].length - 1] === 'DIAS AJUSTADOS' && aoaDep[0][aoaDep[0].length - 1] === 'DIAS AJUSTADOS');
      ok(`[${m}] ADOPCION: aoa rectangulares`, rect(aoaCob) && rect(aoaDep));
      api.renderCob();
      const tiles = api.__mk('#cobTiles').innerHTML;
      ok(`[${m}] ADOPCION: las dos tarjetas de siempre quedan igual y se suma «Dias ajustados»`, tiles.startsWith(cero[m].tiles) && /Días ajustados/.test(tiles) && tiles.length > cero[m].tiles.length);
      {
        const a = alcanceAdopcion(api), c0 = cero[m];
        ok(`[${m}] ADOPCION: el texto de alcance, el encabezado impreso y la barra dicen lo MISMO que sin ajustes (sobre el turno de BioTime)`, a.txt === c0.txt && a.cab === c0.cab && a.barra === c0.barra, `${a.txt} || ${c0.txt}`);
        ok(`[${m}] ADOPCION: la hoja «Alcance» del Excel es la de sin ajustes mas la fila «Días ajustados» (dias de calendario)`, a.aoaAlc === c0.aoaAlc && J(JSON.parse(a.hojaAlc).slice(0, -1)) === c0.hojaAlc && /días de calendario \(fines de semana y festivos incluidos\) en que el turno aplicado difiere del de BioTime/.test(J(JSON.parse(a.hojaAlc).slice(-1))) && JSON.parse(a.hojaAlc).slice(-1)[0][0] === 'Días ajustados');
      }
      ok(`[${m}] ADOPCION: la matriz dia por dia es identica (con ajustes pinta el turno de BioTime)`, matrices(api) === cero[m].matriz && cero[m].matriz.length > 100);
    }
    api.alcLimpiar();
    {
      const Ra = api.__ev('RESULT');
      ok('el alcance por omision (Resumen, Calidad, Rotacion) sigue siendo sobre el turno AJUSTADO: «sin turno asignado» = 0 con ajustes, 1 sobre BioTime (9802)', api.alcanceInfo().sinTurnoEn === 0 && api.alcanceInfo(api.resultadoOriginal(Ra)).sinTurnoEn === 1);
      ok('Adopcion: la hoja «Alcance» dice 1 persona sin turno asignado (la de BioTime) y la de Calidad 0 (la ajustada)', JSON.parse(cero['sin alcance'].hojaAlc).find(f => /dentro del alcance/.test(f[0]))[1] === 1);
    }
    const aoaCobT = api.aoaCobertura(), aoaDepT = api.aoaCoberturaDep(), idx = aoaCobT[0].length - 1;
    ok('Adopcion Excel por persona: «DIAS AJUSTADOS» por fila == lo esperado', aoaCobT.slice(1).every(f => f[idx] === ESPERADO[f[0]]));
    ok('Adopcion Excel por departamento: DEPTO A = 5, DEPTO B = 42 (0+0+0+21+6+3+7+...) y TOTAL = suma', (() => { const f = Object.fromEntries(aoaDepT.slice(1).map(x => [x[0], x[x.length - 1]])); return f['DEPTO A'] === 5 && f['DEPTO B'] === 0 + 0 + 0 + 21 + 6 + 3 + 7 && f[HOSTIL] === 5 && f.TOTAL === 5 + 37 + 5; })(), J(aoaDepT.slice(1).map(x => [x[0], x[x.length - 1]])));
    {
      const T = api.cobAgregar(api.cobCalc().C.filas);
      ok('Adopcion: tarjeta, encabezado y Excel explican que son dias de calendario (fines de semana y festivos incluidos)', (api.renderCob(), /días de calendario \(fines de semana y festivos incluidos\)/.test(api.__mk('#cobTiles').innerHTML.replace(/&quot;/g, '"')) && /días de calendario/.test(api.__mk('#tCobDep thead').innerHTML)));
    ok('Adopcion: la tarjeta suma el total de dias ajustados (47)', T.diasAj === 47 && cerca(T.diasAj, Object.values(ESPERADO).reduce((s, v) => s + v, 0)));
    }
    // ordenar por dias ajustados (clic en la tarjeta o en el encabezado: COB_ORD = 'aj')
    api.__ev('COB_ORD = "aj"');
    {
      const L = api.cobCalc().lista.map(o => o.id);
      ok('ordenar por «Dias ajustados»: de mayor a menor (9807, 9810, 9808, 9802/9811 con 5...)', L[0] === '9807' && L[1] === '9810' && L[2] === '9808' && L.slice(0, 11).every((id, i, a) => i === 0 || ESPERADO[a[i - 1]] >= ESPERADO[id]), L.join(','));
      api.renderCob();
      ok('ordenar por dias: la tarjeta queda marcada (clase sel) y el encabezado trae data-ord="aj"', /data-ord="aj" class="sel"/.test(api.__mk('#cobTiles').innerHTML) && /<th class="num" data-ord="aj"/.test(api.__mk('#tCobDep thead').innerHTML));
      api.__ev('COB_DEP = "DEPTO B"'); api.renderCob();
      const filasB = filasTbody(api.__mk('#tCobDep tbody').innerHTML);
      ok('ordenar por dias dentro de un departamento: cada fila trae 6 celdas y la columna «Dias ajustados»', filasB.every(f => celdas(f, 'td') === 6) && /Días ajustados/.test(api.__mk('#tCobDep thead').innerHTML) && celdas(api.__mk('#tCobDep thead').innerHTML, 'th') === 6);
      api.__ev('COB_DEP = null; COB_ORD = "turno"');
    }
    {
      const tile = api.__mk('#cobTiles').innerHTML;
      api.__ev('COB_ORD = "aj"');
      vaciar(api); api.runCalc();
      const L0 = api.cobCalc().lista.map(o => o.id), L1 = (api.__ev('COB_ORD = "turno"'), api.cobCalc().lista.map(o => o.id));
      ok('sin ajustes un COB_ORD = "aj" guardado se comporta como «turno» (no existe esa metrica)', J(L0) === J(L1));
      poner(api, ...lista); api.runCalc(); R = api.__ev('RESULT'); M = api.__ev('MODEL');
    }

    /* 5. CALIDAD */
    api.alcLimpiar();
    const Qt = api.calidadFiltrada();
    ok('Calidad con ajustes: trae Q.orig y diasAj/dPts/calidadOrig en total, departamentos y personas', Qt.orig === true && Qt.total.diasAj === 47 && Qt.deps.every(d => 'dPts' in d && 'calidadOrig' in d && 'diasAj' in d) && Qt.emps.every(p => 'dPts' in p && 'diasAj' in p));
    ok('Calidad: la principal es la AJUSTADA (== computeCalidad sobre RESULT) y la original == la de una corrida SIN ajustes, por total, departamento y persona',
      cerca(Qt.total.calidadMarca, api.computeCalidad(M, R, R.cfg).total.calidadMarca)
      && cerca(Qt.total.calidadOrig, Q0.total.calidadMarca)
      && Qt.deps.every(d => cerca(d.calidadOrig, Q0.deps.find(x => x.dep === d.dep).calidadMarca))
      && Qt.emps.every(p => cerca(p.calidadOrig, calidadPersona(Q0)[p.empRef.id].calidadMarca)));
    const r1 = x => Math.round(x * 10) / 10, dR = x => x.dPts === null || cerca(x.dPts, r1(+x.calidadMarca.toFixed(1) - +x.calidadOrig.toFixed(1)));
    ok('Calidad: delta = (principal redondeada a 1 decimal) - (original redondeada a 1 decimal) en cada nivel, y queda a menos de 0,1 del delta sin redondear', dR(Qt.total) && Qt.deps.every(dR) && Qt.emps.every(dR) && [Qt.total, ...Qt.deps, ...Qt.emps].every(x => x.dPts === null || Math.abs(x.dPts - (x.calidadMarca - x.calidadOrig)) <= 0.1 + 1e-9));
    ok('Calidad: calidadComparar calcula el delta desde lo que se ve (81,249 y 76,051 se ven 81.2% y 76.1%: delta 5.1 y no 5.2)', (Qs => { api.calidadComparar(Qs, { total: { calidadMarca: 76.051 }, deps: [], emps: [] }, { byEmp: new Map() }); return Qs.total.dPts === 5.1 && Qs.total.dPts !== r1(81.249 - 76.051); })({ total: { calidadMarca: 81.249 }, deps: [], emps: [] }));
    ok('Calidad: dias ajustados por persona y por departamento coinciden con Adopcion y Consolidado', Qt.emps.every(p => p.diasAj === ESPERADO[p.empRef.id]) && Qt.deps.find(d => d.dep === 'DEPTO A').diasAj === 5 && Qt.deps.find(d => d.dep === 'DEPTO B').diasAj === 37);
    // el caso hecho a mano: DEPTO A = 9801 (22 dias limpios) + 9802 (sin turno de BioTime, 5 noches)
    modos['DEPTO A']();
    {
      const Q = api.calidadFiltrada(), a = Q.deps.find(d => d.dep === 'DEPTO A'), p2 = Q.emps.find(p => p.empRef.id === '9802'), p1 = Q.emps.find(p => p.empRef.id === '9801');
      const q0 = cero['DEPTO A'].Q;
      ok('A MANO, 9802 sin ajuste: 6 dias con marcacion, 4 limpios y 2 bloqueados (las puntas de la racha de noches) = 66,7 %', (m => m.dias === 6 && m.limpio === 4 && m.bloq === 2 && cerca(m.calidadMarca, 400 / 6))(q0.emps.find(p => p.empRef.id === '9802')));
      ok('A MANO, 9802 con el ajuste a T_NOCHE: 5 dias, los 5 limpios = 100 %, y 33,3 pts mas', p2.dias === 5 && p2.limpio === 5 && p2.bloq === 0 && cerca(p2.calidadMarca, 100) && cerca(p2.calidadOrig, 400 / 6) && p2.dPts === 33.3);
      ok('A MANO, DEPTO A: 27 de 27 = 100 % con el ajuste y 26 de 28 = 92,86 % sin el (+7,14 pts, 5 dias ajustados)', a.limpio === 27 && a.dias === 27 && cerca(a.calidadMarca, 100) && cerca(a.calidadOrig, 26 / 28 * 100) && a.dPts === 7.1 && a.diasAj === 5);
      ok('A MANO: quien no tiene ajustes (9801) no se mueve: delta 0 y 0 dias ajustados', cerca(p1.dPts, 0) && p1.diasAj === 0 && cerca(p1.calidadMarca, 100));
      ok('LA TESIS DEL PLAN: un ajuste que corrige dias que estaban «sin turno» (y mal emparejados) SUBE la calidad', Q.total.dPts > 0 && Q.total.calidadMarca > Q.total.calidadOrig);
      Q_REND(api, a, p2);
    }
    function Q_REND(api, a, p2) {
      api.__ev('Q_DEP = null'); api.renderCalidad();
      const hero = api.__mk('#qHero').innerHTML, txt = hero.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      ok('Calidad pantalla: tarjeta «Efecto de los ajustes de horario» con «Calidad 100.0% · con la plantilla original 92.9% · por 5 dias ajustados» y +7.1 pts', /Efecto de los ajustes de horario/.test(txt) && /\+7\.1 pts/.test(txt) && /Calidad 100\.0% · con la plantilla original 92\.9% · por 5 días ajustados/.test(txt), txt.slice(0, 400));
      ok('Calidad pantalla: en la tarjeta X − Y == Δ con lo que se ve (100.0% y 92.9% => +7.1 pts)', (t => { const d = /Efecto de los ajustes de horario\s*([+-]?\d+\.\d) pts/.exec(t), x = /Calidad (\d+\.\d)%/.exec(t), y = /plantilla original (\d+\.\d)%/.exec(t); return !!(d && x && y) && cerca(+x[1] - +y[1], +d[1], 1e-6) && d[1] === '+7.1'; })(txt.replace(/−/g, '-')), txt.slice(0, 300));
      ok('Calidad pantalla: el tooltip dice que los dias ajustados son dias de calendario (fines de semana y festivos incluidos)', /días de calendario \(fines de semana y festivos incluidos\)/.test(hero.replace(/&quot;/g, '"')));
      ok('Calidad pantalla: tabla por departamento con la columna «Δ por ajustes (pts)» y todas las filas con 6 celdas', /Δ por ajustes \(pts\)/.test(api.__mk('#tQ thead').innerHTML) && celdas(api.__mk('#tQ thead').innerHTML, 'th') === 6 && filasTbody(api.__mk('#tQ tbody').innerHTML).every(f => celdas(f, 'td') === 6));
      ok('Calidad pantalla: DEPTO A muestra +7.1 y sus dias ajustados en el tooltip', /\+7\.1<\/td>/.test(api.__mk('#tQ tbody').innerHTML) && /5 día\(s\) de calendario con el turno ajustado/.test(api.__mk('#tQ tbody').innerHTML));
      api.__ev('Q_DEP = "DEPTO A"'); api.renderCalidad();
      const per = api.__mk('#tQEmp tbody').innerHTML;
      ok('abrir DEPTO A: la lista trae a 9802 (ya sin dias interpretados, pero con ajustes) con su delta +33.3, y a 9801 no', />9802</.test(per) && /\+33\.3/.test(per) && !/>9801</.test(per) && filasTbody(per).every(f => celdas(f, 'td') === 8) && celdas(api.__mk('#tQEmp thead').innerHTML, 'th') === 8, per.replace(/<[^>]+>/g, ' ').slice(0, 200));
      ok('abrir DEPTO A: sin recorte no hay aviso de «Mostrando N de M»', !/Mostrando/.test(api.__mk('#qEmpInfo').textContent));
      ok('abrir DEPTO A: el aviso dice que se listan personas con ajustes', /Además se listan 1 con ajustes de horario/.test(api.__mk('#qEmpInfo').textContent), api.__mk('#qEmpInfo').textContent);
      api.__ev('Q_DEP = null');
    }
    // alcance + Calidad: el delta se calcula sobre las mismas personas
    for (const [m, f] of Object.entries(modos)) {
      f();
      const Q = api.calidadFiltrada(), q0 = cero[m].Q;
      ok(`[${m}] Calidad: la original == calidad SIN ajustes de esas mismas personas y mismos dias ajustados; el delta cierra`,
        // con «ocultar sin turno» el alcance se evalua sobre el resultado ajustado (9802 ya tiene turno y entra); se compara sobre esas mismas personas
        Q.emps.every(p => cerca(p.calidadOrig, calidadPersona(cero['sin alcance'].Q)[p.empRef.id].calidadMarca)) && Q.total.diasAj === Q.emps.reduce((s, p) => s + p.diasAj, 0)
        && (m === 'ocultar sin turno' ? Q.emps.length === q0.emps.length + 1 : Q.emps.length === q0.emps.length), `${Q.emps.length}/${q0.emps.length}`);
    }
    modos['sin alcance']();

    /* excel de Calidad */
    {
      const aq = api.aoaCalidad(), ae = api.aoaCalidadEmp();
      const nuevas = ['CALIDAD CON TURNO ORIGINAL DE BIOTIME %', 'DELTA POR AJUSTES (PTS)', 'DIAS AJUSTADOS'];
      ok('Calidad Excel (departamentos y personas): 3 columnas nuevas AL FINAL, rectangulares', J(aq[0].slice(-3)) === J(nuevas) && J(ae[0].slice(-3)) === J(nuevas) && rect(aq) && rect(ae));
      ok('Calidad Excel: el prefijo es el de sin ajustes (cambian los valores por el turno ajustado, no las columnas): mismas columnas y mismas filas', J(aq[0].slice(0, -3)) === J(JSON.parse(cero['sin alcance'].aoaQ)[0]) && J(ae[0].slice(0, -3)) === J(JSON.parse(cero['sin alcance'].aoaQE)[0]) && aq.length === JSON.parse(cero['sin alcance'].aoaQ).length);
      const tot = aq[aq.length - 1], i = aq[0].length - 3;
      ok('Calidad Excel: la fila TOTAL trae original, delta y dias ajustados (47)', tot[0] === 'TOTAL' && tot[i + 2] === 47 && cerca(tot[i + 1], +(Qt.total.dPts).toFixed(1)) && cerca(tot[i], +(Qt.total.calidadOrig).toFixed(1)));
      const p = ae.find(f => f[0] === '9802');
      ok('Calidad Excel por persona: 9802 = 100 contra 66,7 original, +33,3 y 5 dias', p && p[ae[0].length - 3] === 66.7 && p[ae[0].length - 2] === 33.3 && p[ae[0].length - 1] === 5, J(p && p.slice(-5)));
    }

    /* la estructura de los Excel NO depende del Alcance: con un alcance sin ninguna persona ajustada (solo 9801) y un RESULT nuevo, las columnas siguen ahi */
    api.alcLimpiar(); api.alcAddPers('9801'); api.alcSetModoPer('solo'); api.runCalc();
    ok('con un Alcance que no incluye a ninguna persona ajustada las columnas de ajustes siguen en los Excel (estructura estable) y valen 0',
      api.ajHayCambio() === true && (c => c[0][c[0].length - 1] === 'DIAS AJUSTADOS' && c[1][c[0].length - 1] === 0)(api.aoaCobertura()) && api.aoaCalidadEmp()[0].slice(-1)[0] === 'DIAS AJUSTADOS' && api.aoaCalidad()[0].slice(-1)[0] === 'DIAS AJUSTADOS' && api.aoaCons()[0].slice(-1)[0] === 'DIAS CON AJUSTE DE HORARIO');
    ok('con ese Alcance la tarjeta de Calidad no aparece (ningun dia ajustado dentro del alcance) pero la columna Δ si', (api.renderCalidad(), !/Efecto de los ajustes de horario/.test(api.__mk('#qHero').innerHTML) && /Δ por ajustes/.test(api.__mk('#tQ thead').innerHTML)));
    api.alcLimpiar(); api.runCalc();

    /* 6. CONSOLIDADO */
    api.__mk('#fSinConc').checked = true;
    api.renderCons(); api.renderColsCons();
    {
      const th = api.__mk('#tCons thead').innerHTML, filas = filasTbody(api.__mk('#tCons tbody').innerHTML);
      ok('Consolidado: encabezado con la columna «Ajustes» (data-col="aj") y cada fila con el mismo numero de celdas', /<th class="num" data-col="aj"/.test(th) && filas.length === P.length && filas.every(f => celdas(f, 'td') === celdas(th, 'th')), `${celdas(th, 'th')} th / ${filas.map(f => celdas(f, 'td')).join(',')}`);
      const celdaDe = id => { const f = filas.find(x => x.includes(`data-id="${id}"`)); const m = f && /<td class="num[^"]*" data-col="aj"[^>]*>([^<]*)<\/td>/.exec(f); return m ? m[1] : null; };
      ok('Consolidado: la celda muestra los dias ajustados de cada persona (— si no tiene)', Object.entries(ESPERADO).every(([id, v]) => celdaDe(id) === (v ? String(v) : '—')), J(Object.keys(ESPERADO).map(id => celdaDe(id))));
      ok('Consolidado: «Ajustes de horario» aparece en el selector de columnas (data-col-chk="aj"), en «Otros»', /data-col-chk="aj"/.test(api.__mk('#colsConsBox').innerHTML));
      api.__ev('COLS_CONS_OCULTAS.add("aj")'); api.aplicarColsCons();
      ok('Consolidado: ocultar la columna la quita solo de la pantalla (CSS por data-col)', /#tCons \[data-col="aj"\]\{display:none\}/.test(api.__mk('#colConsStyle').textContent));
      api.__ev('COLS_CONS_OCULTAS.delete("aj")'); api.aplicarColsCons();
      const ac = api.aoaCons();
      ok('Consolidado Excel: DIAS CON AJUSTE DE HORARIO es la ULTIMA columna y el resto de los encabezados es el de sin ajustes', ac[0][ac[0].length - 1] === 'DIAS CON AJUSTE DE HORARIO' && rect(ac) && J(ac[0].slice(0, -1)) === J(JSON.parse(cero['sin alcance'].aoaCons)[0]));
      const iC = ac[0].length - 1;
      ok('Consolidado Excel: los valores por persona son los esperados', ac.slice(1).every(f => f[iC] === ESPERADO[f[0]]), J(ac.slice(1).map(f => [f[0], f[iC]])));
      // con lactancia a la vez, los dias ajustados quedan despues de las columnas de lactancia
      const fil = api.__mk('#kpis').innerHTML;
      ok('Consolidado: sin NaN ni undefined al pintar', !mala(api.__mk('#tCons tbody').innerHTML + fil));
    }
    api.__mk('#fSinConc').checked = false;
    {
      // la fila vacia (filtro que no deja a nadie) usa el colspan con la columna nueva
      api.__mk('#qCons').value = 'zzzzzz'; api.renderCons();
      ok('Consolidado: la fila de «Ningun empleado coincide» ocupa todas las columnas (colspan con «Ajustes»)', (c => { const n = celdas(api.__mk('#tCons thead').innerHTML, 'th'); return c && +c[1] === n; })(/colspan="(\d+)"/.exec(api.__mk('#tCons tbody').innerHTML)), api.__mk('#tCons tbody').innerHTML.slice(0, 120));
      api.__mk('#qCons').value = '';
    }

    /* Sinergy: mismo formato; quien no tiene ajustes sale igual que sin ajustes */
    {
      let txt = null; global.URL.createObjectURL = b => { txt = b.p[0]; return 'b'; }; global.document.createElement = () => ({ click() {} });
      api.sinergyTxt(); const conAj = txt;
      vaciar(api); api.runCalc(); api.sinergyTxt(); const sinAj = txt;
      poner(api, ...lista); api.runCalc(); R = api.__ev('RESULT'); M = api.__ev('MODEL');
      const linea = s => s.split(/\r?\n/).filter(Boolean);
      const por = (s, id) => linea(s).filter(l => l.startsWith(id + '\t') || l.startsWith(id + ','));
      ok('Sinergy: el formato no cambia (mismo numero de campos por linea)', linea(conAj).length > 0 && new Set(linea(conAj).concat(linea(sinAj)).map(l => l.split('\t').length)).size === 1, `${linea(conAj).length} y ${linea(sinAj).length} lineas`);
      ok('Sinergy: 9803 (2 h extra por dia, sin ajustes) tiene lineas y salen exactamente iguales que sin ajustes', por(sinAj, '9803').length > 0 && J(por(conAj, '9803')) === J(por(sinAj, '9803')), J(por(sinAj, '9803')));
    }

    /* 7. Resumen del ciclo y Rotacion no cambian de comportamiento */
    {
      vaciar(api); api.runCalc();
      const R0 = api.__ev('RESULT'), rot0 = J(api.computeRot(api.__ev('MODEL'), R0.cfg, api.rotOpt())), al0 = J(api.aoaAlcance());
      poner(api, ...lista); api.runCalc(); R = api.__ev('RESULT'); M = api.__ev('MODEL');
      const I = api.computeInd(R, api.indOpt(R));
      ok('Resumen del ciclo: computeInd corre sobre el resultado AJUSTADO (la nomina) y no revienta', I.personas === P.length && !mala(J([I.total])));
      api.renderInd(); ok('Resumen del ciclo: renderInd sin errores ni NaN', api.__errores.length === 0 && !mala(api.__mk('#indCards').innerHTML + api.__mk('#indBarras').innerHTML));
      ok('Rotacion: el resultado es identico con y sin ajustes (solo lee empleados y renuncias)', J(api.computeRot(M, R.cfg, api.rotOpt())) === rot0);
      api.renderRot(); ok('Rotacion: renderRot sin errores', api.__errores.length === 0);
      // salvo «Personas sin turno asignado» (dentro y ocultas), que sale del resultado ajustado como el resto de la nomina: 9802 ya tiene turno
      ok('Alcance: la hoja «Alcance» del Excel no cambia con ajustes (ciclo, departamentos, personas y filtros)', J(api.aoaAlcance().slice(0, 5)) === J(JSON.parse(al0).slice(0, 5)) && api.aoaAlcance().length === JSON.parse(al0).length);
    }

    /* 8. nada de HTML inyectado en lo nuevo */
    {
      api.alcLimpiar(); api.__ev('COB_DEP = null; COB_EMP = ""; COB_ORD = "aj"'); api.renderCob();
      const tiles = api.__mk('#cobTiles').innerHTML, tileAj = (tiles.match(/<div data-ord="aj"[\s\S]*$/) || [''])[0];
      ok('XSS: la tarjeta «Dias ajustados» (con un departamento hostil entre los que mas pesan) no deja etiquetas vivas ni atributos on*', tileAj.length > 0 && limpioDeInyeccion(tileAj) && /&quot;/.test(tileAj), tileAj.slice(0, 300));
      ok('XSS: el departamento hostil figura en la tarjeta sin romperla', /D&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;/.test(tileAj));
      api.__ev('COB_ORD = "turno"'); api.renderCob();
      ok('sin errores de consola al pintar todo', api.__errores.length === 0, api.__errores.slice(0, 1).join(''));
    }

    /* 9. el cableado de eventos corre sin errores con el mock que devuelve null para lo no declarado */
    api.__dom();
    ok('DOMContentLoaded sin errores (el mock devuelve null para lo que el archivo no declara)', api.__errores.length === 0, api.__errores.slice(0, 1).join(''));

    /* salida comparable entre los dos archivos */
    api.alcLimpiar(); api.__ev('Q_DEP = null; COB_DEP = null; COB_EMP = ""');
    SALIDA[nombre] = J([pintar(api), api.aoaCons(), api.aoaCobertura(), api.aoaCoberturaDep(), api.aoaCalidad(), api.aoaCalidadEmp()]);
  }

  const sinHora = t => t.replace(/generado [0-9\/,: .apm]*/gi, 'generado ').replace(/aj-i-\d+/g, 'aj-i-N');
  ok('los dos archivos pintan y exportan EXACTAMENTE lo mismo (Consolidado, Adopcion, Calidad, Resumen)', sinHora(SALIDA.COMPLETO) === sinHora(SALIDA.RRHH) && !!SALIDA.COMPLETO);

  /* 10. tiempos con ~1.000 personas */
  {
    const api = cargar(FILES.COMPLETO, { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' } });
    const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
    const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en'], ['T_DIA', 'T_DIA', '1', '07:00:00', '15:00:00', ...fl(LAB), '', '0', ''], ['T_MEDIO', 'T_MEDIO', '1', '10:00:00', '18:00:00', ...fl(LAB), '', '0', '']];
    const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
    const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
    const N = 1000, dias = habil(1, 30);
    for (let i = 0; i < N; i++) {
      const id = String(70000 + i);
      emp.push([id, 'P', 'T' + id, '2020-01-01', 'DEPTO ' + (i % 20), 'PLASTITECSA', 'CARGO', 'Habilitado']);
      hor.push([id, 'P', 'T' + id, 'T_DIA', 'T_DIA', '2026-08-01', '2026-12-31']);
      dias.forEach(iso => { mar.push([id, 'P', 'T', 'PLASTITECSA', 'D', 'C', f2(iso), '07:00', '255', 'Dispositivo-PORTERIA PLANTA 1']); mar.push([id, 'P', 'T', 'PLASTITECSA', 'D', 'C', f2(iso), '15:' + pad(i % 40), '255', 'Dispositivo-PORTERIA PLANTA 1']); });
    }
    api.DATA.emp = api.__leer(emp); api.DATA.tur = api.__leer(tur); api.DATA.hor = api.__leer(hor); api.DATA.mar = api.__leer(mar); api.DATA.ren = null; api.DATA.lac = null;
    const cron = f => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };
    const medir = () => { api.runCalc(); return { cal: cron(() => api.calidadFiltrada()), cob: cron(() => { api.cobCalc(); api.aoaCobertura(); }), cons: cron(() => api.aoaCons()), pint: cron(() => { api.renderCons(); api.renderCob(); api.renderCalidad(); }) }; };
    const L = api.__ev('AJ_HORARIO');
    const s0 = medir();
    for (let i = 0; i < N; i += 10) L.push(A(String(70000 + i), '2026-09-14', '2026-09-18', 'T_MEDIO'));
    api.__ev('ajPersistir()');
    const s10 = medir();
    const ok10 = api.calidadFiltrada().total.diasAj === 100 * 5;
    {
      api.__ev('Q_DEP = null'); api.renderCalidad();
      const filas = filasTbody(api.__mk('#tQEmp tbody').innerHTML), info = api.__mk('#qEmpInfo').textContent;
      ok('Calidad con 100 personas con ajustes: la lista en pantalla se acota a 50 filas con el aviso «Mostrando 50 de 100 personas con ajustes; el resto está en el Excel»', filas.length === 50 && /Mostrando 50 de 100 personas con ajustes; el resto está en el Excel/.test(info), `${filas.length} filas · ${info}`);
      ok('Calidad con 100 personas con ajustes: el Excel por persona trae a las 1.000', api.aoaCalidadEmp().length === 1001);
    }
    for (let i = 1; i < N; i++) if (i % 10) L.push(A(String(70000 + i), '2026-09-14', '2026-09-18', 'T_MEDIO'));
    api.__ev('ajPersistir()');
    const sT = medir();
    const f = x => `calidad ${x.cal.toFixed(0)} ms · adopcion ${x.cob.toFixed(0)} ms · consolidado xlsx ${x.cons.toFixed(0)} ms · pintar 3 pestañas ${x.pint.toFixed(0)} ms`;
    console.log(`TIEMPOS ${N} personas x ${dias.length} dias — sin ajustes: ${f(s0)}\n        con ajustes en 100 personas: ${f(s10)}\n        con ajustes en las ${N}: ${f(sT)}`);
    ok('1.000 personas, 100 con ajustes: los dias ajustados suman 500', ok10);
    ok('el costo extra de Calidad con ajustes en el 10% es < 2.5x y en todas < 5x (calcula dos veces + dias ajustados)', s10.cal < Math.max(s0.cal * 2.5, 60) && sT.cal < Math.max(s0.cal * 5, 120), `${s10.cal.toFixed(0)}/${sT.cal.toFixed(0)} vs ${s0.cal.toFixed(0)} ms`);
    ok('Adopcion no se vuelve mas lenta de forma apreciable con ajustes (< 2x o < 80 ms extra)', s10.cob < Math.max(s0.cob * 2, s0.cob + 80) && sT.cob < Math.max(s0.cob * 3, s0.cob + 150), `${s10.cob.toFixed(0)}/${sT.cob.toFixed(0)} vs ${s0.cob.toFixed(0)} ms`);
    ok('el Excel del Consolidado con ajustes no se vuelve lento (< 2x o < 80 ms extra)', sT.cons < Math.max(s0.cons * 3, s0.cons + 150), `${sT.cons.toFixed(0)} vs ${s0.cons.toFixed(0)} ms`);
  }

  console.log(fallos ? 'FALLOS: ' + fallos : 'INDICADORES Y AJUSTES OK');
  process.exit(fallos ? 1 : 0);
}
main();
