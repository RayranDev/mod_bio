'use strict';
// Ajustes de horario auditados (Fase B), en los DOS archivos y con datos 100% ficticios (ids 97xx).
// Comprueba: (1) SIN ajustes todo es identico a la version anterior (huella, RESULT.days/exc y TODAS las
// exportaciones, comparadas contra el commit previo que sale de git); (2) el efecto de cada ajuste con
// I-01/I-02/I-03 = 0; (3) rango, el mas reciente gana, anulado, redundante, codigo inexistente, vigencia;
// (4) computeBase == compute sin ajustes; (5) migracion de mb_overrides; (6) el dialogo (motivo obligatorio,
// Cancelar revierte, vuelve al mismo dia, anular); (7) historial y exportaciones; (8) configuracion (ida y
// vuelta, rechazos atomicos); (9) nada de HTML inyectado desde motivo, nota, autor o turno.
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { cargar, invariantes, FILES, REPO } = require('./lib.js');

let fallos = 0;
const ok = (n, c, extra = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!c) fallos++; };
const J = JSON.stringify;
const eq = (a, b) => J(a) === J(b);

/* ── datos ficticios ───────────────────────────────────────────────────────────────────────────────────────── */
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fl = lista => DIAS.map(d => lista.includes(d) ? 'True' : '');
const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
const pad = n => String(n).padStart(2, '0');
const sep = d => `2026-09-${pad(d)}`;
const habil = (a, b) => { const r = []; for (let d = a; d <= b; d++) { const w = new Date(Date.UTC(2026, 8, d)).getUTCDay(); if (w >= 1 && w <= 5) r.push(sep(d)); } return r; };
const sig = iso => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8)) + 864e5).toISOString().slice(0, 10);
const LAB = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const NASTY = 'X"><img src=1 onerror=alert(1)>';       // un codigo de turno hostil que SI esta en el archivo de Turno
const PAYLOAD = '"><img src=x onerror=alert(9)>';
const SH = [['T_DIA', '07:00:00', '15:00:00'], ['T_TARDE', '14:00:00', '22:00:00'], ['T_NOCHE', '22:00:00', '06:00:00'],
            ['T_MEDIO', '10:00:00', '18:00:00'], ['T_18_02', '18:00:00', '02:00:00'], ['T_ADM1', '07:00:00', '15:00:00'], [NASTY, '08:00:00', '16:00:00']];
//   id, depto, ingreso, retiro, turno de BioTime, fin de la programacion
const P = [['9701', 'DEPTO A', null, null, 'T_DIA', '2026-12-31'], ['9702', 'DEPTO A', null, null, 'T_DIA', '2026-09-11'], ['9703', 'DEPTO A', null, null, 'T_DIA', '2026-12-31'],
           ['9704', 'DEPTO B', null, null, 'T_TARDE', '2026-12-31'], ['9705', 'DEPTO B', null, null, 'T_DIA', '2026-12-31'], ['9706', 'DEPTO B', null, null, 'T_DIA', '2026-12-31'],
           ['9707', 'DEPTO A', '2026-09-10', null, 'T_DIA', '2026-12-31'], ['9708', 'DEPTO B', null, '2026-09-15', 'T_DIA', '2026-12-31'],
           ['9709', 'DEPTO A', null, null, null, null],                       // sin NINGUNA programacion cargada (A-09), trabaja del 14 al 18
           ['9710', 'DEPTO B', null, null, 'T_ADM1', '2026-12-31']];           // administrativo (prefijo T_ADM)
const NOCHES = ['2026-09-21', '2026-09-22', '2026-09-23'];
function construir() {
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Fecha de retiro', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  SH.forEach(([c, e, s]) => tur.push([c, c, '1', e, s, ...fl(LAB), '', '0', '']));
  const dep = {};
  P.forEach(([id, d, ing, ret, sh, fin]) => {
    dep[id] = d;
    emp.push([id, 'PRUEBA', 'AJ' + id, ing || '2020-01-01', ret || '', d, 'PLASTITECSA', 'CARGO PRUEBA', 'Habilitado']);
    if (sh) hor.push([id, 'PRUEBA', 'AJ' + id, sh, sh, '2026-08-01', fin]);
  });
  const punch = (id, iso, hm) => mar.push([id, 'PRUEBA', 'AJ' + id, 'PLASTITECSA', dep[id], 'CARGO PRUEBA', f2(iso), hm, '255', 'Dispositivo-PORTERIA PLANTA 1']);
  const par = (id, iso, e, s, cruza) => { punch(id, iso, e); punch(id, cruza ? sig(iso) : iso, s); };
  habil(1, 30).forEach(iso => {
    par('9701', iso, '07:00', '15:00');
    par('9702', iso, '07:00', '15:00');                                              // tras el 11 no tiene turno cargado: A-19
    par('9703', iso, ...(NOCHES.includes(iso) ? ['10:00', '18:00'] : ['07:00', '15:00']));   // trabaja 10-18 con turno T_DIA
    if (NOCHES.includes(iso)) par('9704', iso, '18:00', '02:00', true); else par('9704', iso, '14:00', '22:00');
    par('9705', iso, ...(habil(14, 18).includes(iso) ? ['10:00', '18:00'] : ['07:00', '15:00']));
    par('9706', iso, '07:00', '15:00');
    if (iso >= '2026-09-10') par('9707', iso, '07:00', '15:00');
    if (iso <= '2026-09-15') par('9708', iso, '07:00', '15:00');
    if (habil(14, 18).includes(iso)) par('9709', iso, '07:00', '15:00');
    par('9710', iso, '07:00', '15:00');
  });
  return { emp, tur, hor, mar };
}
function nuevo(html, store, extra) {
  const api = cargar(html, { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' }, store });
  const D = construir();
  api.DATA.emp = api.__leer(D.emp); api.DATA.tur = api.__leer(D.tur); api.DATA.hor = api.__leer(D.hor); api.DATA.mar = api.__leer(D.mar);
  api.DATA.ren = null; api.DATA.lac = extra && extra.lac ? api.__leer(extra.lac) : null;
  return api;
}
let SEQ = 0;
// un ajuste valido y completo; `o` pisa lo que se quiera
const A = (emp, desde, hasta, turno, creado, o = {}) => ({ id: 'aj-t-' + (++SEQ), emp, desde, hasta, turno, motivo: 'EQUIVOCADO', nota: '', autor: 'Prueba', creado: creado || '2026-11-10T09:00:00', anulado: null, ...o });
const poner = (api, ...lista) => { const L = api.__ev('AJ_HORARIO'); lista.forEach(a => L.push(a)); api.__ev('ajPersistir()'); };
const vaciar = api => { api.__ev('AJ_HORARIO').length = 0; api.__ev('ajPersistir()'); };
const fila = (R, id, iso) => R.byEmp.get(id).rows.find(r => r.iso === iso);
const inv = R => { const i = invariantes(R); return i.i1 + i.i2 + i.i3; };
const conc = r => Object.fromEntries(Object.entries(r.conc).filter(([, v]) => v));

/* ── 1. sin ajustes: identico al commit previo ─────────────────────────────────────────────────────────────── */
const git = args => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
function lineaBase(nombre) {
  let log = [];
  try { log = git(['log', '--format=%H', '-n', '60', '--', nombre]).split('\n').filter(Boolean); } catch (e) { return null; }
  for (const h of log) { const t = git(['show', `${h}:${nombre}`]); if (!t.includes('AJ_HORARIO')) return t; }
  return null;                                  // (sin historia previa a los ajustes: clon superficial)
}
function capturar(api) {
  const o = {}, intenta = (k, f) => { try { o[k] = J(f()); } catch (e) { o[k] = 'ERROR ' + e.message; } };
  api.runCalc();
  const R = api.__ev('RESULT');
  intenta('days', () => R.days); intenta('exc', () => R.exc);
  intenta('byEmp', () => [...R.byEmp].map(([id, e]) => [id, e.perfil, e.tot, e.rawMin, e.horas, e.ordH, e.extraH, e.pendH, e.sinAut, e.noAut, e.tardes, e.tieneConceptos]));
  intenta('cons', () => api.aoaCons());
  intenta('det', () => [...R.byEmp.values()].map(e => api.aoaDet(e)));
  intenta('excel', () => api.aoaExc());
  intenta('cal', () => P.map(p => api.aoaCal(p[0], '2026-09')));
  intenta('asis', () => api.aoaAsistencia()); intenta('asisRes', () => api.aoaAsisResumen());
  intenta('calidad', () => api.aoaCalidad()); intenta('calidadEmp', () => api.aoaCalidadEmp());
  intenta('cob', () => api.aoaCobertura()); intenta('cobDep', () => api.aoaCoberturaDep());
  let txt = null; global.URL.createObjectURL = b => { txt = b.p[0]; return 'b'; }; global.document.createElement = () => ({ click() {} });
  intenta('sinergy', () => { api.sinergyTxt(); return txt; });
  api.__dom(); api.__escritos.length = 0; api.__mk('#expTodo').onclick();
  intenta('todo', () => api.__escritos.map(e => [e.name, e.wb.sheets.map(s => [s.n, s.aoa])]));
  api.__escritos.length = 0; api.__mk('#expDet').onclick();
  intenta('expDet', () => api.__escritos.map(e => [e.name, e.wb.sheets.map(s => [s.n, s.aoa])]));
  o.base = R.base;
  return o;
}

/* ── 2. cuerpo ─────────────────────────────────────────────────────────────────────────────────────────────── */
async function main() {
  for (const [nombre, html] of Object.entries(FILES)) {
    console.log(`── ${nombre}`);
    const esFull = nombre === 'COMPLETO';

    /* 1. cero ajustes == version previa */
    const previo = lineaBase(path.basename(html));
    if (previo === null) console.log('OMITIDO: no hay version previa a los ajustes en la historia de git (clon superficial); la comparacion contra la linea base no se hizo');
    else {
      const tmp = path.join(os.tmpdir(), 'mb_prev_' + path.basename(html));
      fs.writeFileSync(tmp, previo);
      const antes = capturar(nuevo(tmp));
      const ahora = capturar(nuevo(html));
      ok('sin ajustes: RESULT.base es null', ahora.base === null);
      for (const k of Object.keys(antes).filter(k => k !== 'base'))
        ok(`sin ajustes: ${k} identico a la version previa`, antes[k] === ahora[k] && !/^ERROR/.test(ahora[k]), antes[k] === ahora[k] ? '' : `(${antes[k].length} vs ${ahora[k].length} caracteres)`);
      ok('sin ajustes: la hoja Consolidado/Detalle/Excepciones del Excel combinado no gana hojas ni columnas', !/Ajustes de horario|TURNO ORIGINAL|AJUSTE MOTIVO/.test(ahora.todo + ahora.expDet));
    }

    /* 2. ajustes: efecto por caso */
    let api = nuevo(html);
    api.runCalc();
    const R0 = api.__ev('RESULT');
    ok('calculo base: sin errores de consola y con I-01/I-02/I-03 = 0', api.__errores.length === 0 && inv(R0) === 0, api.__errores.slice(0, 1).join(''));
    const base = Object.fromEntries([...R0.byEmp].map(([id, e]) => [id, { ord: e.ordH, ext: e.extraH, pend: e.pendH, tot: { ...e.tot } }]));
    const q0 = api.computeCalidad(api.__ev('MODEL'), R0, R0.cfg).emps.find(p => p.empRef.id === '9702');
    const as0 = api.__ev('ASISTENCIA').get('9702').resumen;

    const aA = A('9702', '2026-09-14', '2026-09-18', 'T_DIA', '2026-11-10T09:00:00', { motivo: 'NO_CARGADO' });
    const aB = A('9703', '2026-09-21', '2026-09-23', 'T_MEDIO');
    const aC = A('9704', '2026-09-21', '2026-09-23', 'T_18_02');
    const aD1 = A('9705', '2026-09-14', '2026-09-18', 'T_TARDE', '2026-11-01T09:00:00');
    const aD2 = A('9705', '2026-09-16', '2026-09-17', 'T_MEDIO', '2026-11-02T09:00:00');
    const aD3 = A('9705', '2026-09-14', '2026-09-18', 'T_NOCHE', '2026-11-03T09:00:00', { anulado: { autor: 'Otra', en: '2026-11-04T09:00:00', motivo: 'Era un error' } });
    const aE1 = A('9706', '2026-09-14', '2026-09-18', 'T_DIA', '2026-11-10T09:00:00');
    const aE2 = A('9706', '2026-09-21', '2026-09-25', 'T_ZZZ', '2026-11-10T10:00:00');
    const aF1 = A('9707', '2026-09-01', '2026-09-30', 'T_MEDIO');
    const aF2 = A('9708', '2026-09-10', '2026-09-30', 'T_MEDIO');
    poner(api, aA, aB, aC, aD1, aD2, aD3, aE1, aE2, aF1, aF2);
    api.runCalc();
    let R = api.__ev('RESULT'), M = api.__ev('MODEL');
    ok('con ajustes: sin errores y I-01/I-02/I-03 = 0', api.__errores.length === 0 && inv(R) === 0, api.__errores.slice(0, 1).join(''));

    // a) dia trabajado sin turno -> ajuste a un turno
    let r = fila(R, '9702', '2026-09-14');
    ok('9702 (sin turno cargado, trabajo 07-15): pasa a T_DIA, ordinaria 8 h, sin extra ni A-19', r.turno === 'T_DIA' && r.ordMin === 480 && r.extraMin === 0 && !r.flags.includes('A-19') && r.flags.includes('AJ-H'));
    ok('9702: la fila lleva el id del ajuste y turnoOriginal vacio (BioTime no tenia turno)', r.ajuste === aA.id && r.turnoOriginal === '');
    ok('9702: las 5 filas del rango cambian y las del 21 en adelante (fuera del rango) siguen como A-19', habil(14, 18).every(i => fila(R, '9702', i).turno === 'T_DIA') && fila(R, '9702', '2026-09-21').turno === '—' && fila(R, '9702', '2026-09-21').flags.includes('A-19') && !fila(R, '9702', '2026-09-21').ajuste);
    ok('9702: 40 h pasan de extra a ordinarias (72 -> 112 ord, 104 -> 64 extra)', base['9702'].ord === 72 && R.byEmp.get('9702').ordH === 112 && base['9702'].ext === 104 && R.byEmp.get('9702').extraH === 64);
    // b) turno equivocado, mismo tipo de dia
    r = fila(R, '9703', '2026-09-21');
    ok('9703 (T_DIA pero trabajo 10-18) -> T_MEDIO: extra 3 -> 0 y pendiente 3 -> 0', r.turno === 'T_MEDIO' && r.turnoOriginal === 'T_DIA' && r.extraMin === 0 && r.pendienteMin === 0 && fila(R0, '9703', '2026-09-21').extraMin === 180 && fila(R0, '9703', '2026-09-21').pendienteMin === 180);
    ok('9703: el resto del mes (turno T_DIA normal) queda igual', eq(fila(R, '9703', '2026-09-14').conc, fila(R0, '9703', '2026-09-14').conc) && !fila(R, '9703', '2026-09-14').ajuste);
    // c) diurno <-> nocturno: se reclasifica y la suma se explica
    r = fila(R, '9704', '2026-09-21');
    const r0 = fila(R0, '9704', '2026-09-21');
    ok('9704 (T_TARDE pero trabajo 18-02) antes: REC_N 3 h + EXT_N 4 h, pendiente 4 h', eq(conc(r0), { EXT_N: 4, REC_N: 3 }) && r0.pendienteMin === 240);
    ok('9704 -> T_18_02: todo ordinario, REC_N 7 h, sin extra ni pendiente', r.turno === 'T_18_02' && r.turnoOriginal === 'T_TARDE' && eq(conc(r), { REC_N: 7 }) && r.pendienteMin === 0 && r.extraMin === 0);
    const sumaC = c => Object.values(c).reduce((s, v) => s + v, 0);
    ok('9704: la suma de conceptos se conserva (7 h antes y despues) y la diferencia es exactamente EXT_N -4 / REC_N +4 por dia', sumaC(r.conc) === sumaC(r0.conc) && r.conc.REC_N - r0.conc.REC_N === 4 && r0.conc.EXT_N - r.conc.EXT_N === 4);
    ok('9704 en el ciclo: EXT_N 12 -> 0 y REC_N 66 -> 78 (3 noches)', base['9704'].tot.EXT_N === 12 && R.byEmp.get('9704').tot.EXT_N === 0 && base['9704'].tot.REC_N === 66 && R.byEmp.get('9704').tot.REC_N === 78);
    ok('quien no tiene ajustes queda IDENTICO (9701 y 9703 fuera del rango no cambian)', ['9701'].every(id => R.byEmp.get(id).extraH === base[id].ext && eq(R.byEmp.get(id).tot, base[id].tot)));
    // dias sin fila: el Detalle solo tiene filas para los dias con turno o con marcaciones
    ok('un dia sin turno y sin marcaciones (sabado) NO tiene fila en el Detalle: no hay donde poner la lista; el campo «hasta» del dialogo lo cubre', fila(R0, '9701', '2026-09-19') === undefined
      && (Ms => Ms.ajustes.get('9701').length === 1 && api.shiftFor(Ms, '9701', '2026-09-19').source === 'AJUSTE')({ ...M, ...api.ajIndexar([A('9701', '2026-09-14', '2026-09-20', 'T_MEDIO')], M.shifts) }));
    ok('ajustar un dia CON marcaciones a «sin turno» deja su fila (A-19) con el turno que traia BioTime', (Ms => { const Rs = api.compute(Ms, R.cfg), r2 = Rs.byEmp.get('9701').rows.find(x => x.iso === '2026-09-14'); return r2.turno === '—' && r2.turnoOriginal === 'T_DIA' && r2.flags.includes('A-19') && r2.flags.includes('AJ-H') && r2.extraMin === 480; })({ ...M, ...api.ajIndexar([A('9701', '2026-09-14', '2026-09-14', '')], M.shifts) }));

    // d) rango, el mas reciente gana, el anulado no se aplica
    const sf = iso => api.shiftFor(M, '9705', iso);
    ok('9705: el mas reciente gana (16 y 17 = T_MEDIO) y el resto del rango queda con el primero (T_TARDE)', ['2026-09-14', '2026-09-15', '2026-09-18'].every(i => sf(i).code === 'T_TARDE') && ['2026-09-16', '2026-09-17'].every(i => sf(i).code === 'T_MEDIO'));
    ok('9705: el ajuste ANULADO (el mas nuevo de todos) no se aplica en ningun dia', habil(14, 18).every(i => sf(i).code !== 'T_NOCHE') && !M.ajustes.get('9705').some(a => a.id === aD3.id));
    ok('9705: shiftFor devuelve source AJUSTE, el ajuste y el turno que daria BioTime', sf('2026-09-16').source === 'AJUSTE' && sf('2026-09-16').ajuste.id === aD2.id && eq(sf('2026-09-16').original, { code: 'T_DIA', source: 'PLAN' }));
    ok('9705: fuera del rango manda BioTime (PLAN)', sf('2026-09-21').source === 'PLAN' && sf('2026-09-21').code === 'T_DIA');
    ok('9705: la ultima fila (18) tambien lleva su ajuste y la del 16 el de T_MEDIO', fila(R, '9705', '2026-09-18').ajuste === aD1.id && fila(R, '9705', '2026-09-16').ajuste === aD2.id);
    // e) redundante y codigo inexistente
    ok('redundante: el ajuste a T_DIA sobre quien ya tiene T_DIA se aplica (no cambia nada) y se marca "ya coincide con BioTime"', api.ajEstado(M, aE1).k === 'REDUNDANTE' && /ya coincide con BioTime/i.test(api.ajEstado(M, aE1).txt)
      && eq(fila(R, '9706', '2026-09-14').conc, fila(R0, '9706', '2026-09-14').conc) && fila(R, '9706', '2026-09-14').ajuste === aE1.id);
    ok('codigo inexistente (T_ZZZ): NO se aplica, manda BioTime, y no inventa turno', api.ajEstado(M, aE2).k === 'TURNO_INEXISTENTE' && api.shiftFor(M, '9706', '2026-09-22').source === 'PLAN'
      && fila(R, '9706', '2026-09-22').turno === 'T_DIA' && !fila(R, '9706', '2026-09-22').ajuste && M.ajustesInvalidos.some(a => a.id === aE2.id));
    const e96 = R.exc.filter(x => x.code === 'AJ-H' && x.id === '9706');
    ok('9706: una excepcion por ajuste (INFO redundante + ADV del codigo inexistente), no una por dia', e96.length === 2 && e96.some(x => x.sev === 'INFO' && /ya coincide con BioTime/i.test(x.msg)) && e96.some(x => x.sev === 'ADV' && /NO aplicado/.test(x.msg) && /T_ZZZ/.test(x.msg)));
    ok('9705: dos excepciones AJ-H INFO (una por ajuste vigente, ninguna por el anulado ni por dia)', R.exc.filter(x => x.code === 'AJ-H' && x.id === '9705').length === 2);
    const e92 = R.exc.find(x => x.code === 'AJ-H' && x.id === '9702');
    ok('AJ-H INFO dice rango, turno, antes, motivo y autor', e92.sev === 'INFO' && /del 2026-09-14 al 2026-09-18: T_DIA \(antes: sin turno\)/.test(e92.msg) && /Turno no cargado en BioTime/.test(e92.msg) && /Autor: Prueba/.test(e92.msg));
    ok('AJ-H: ninguna excepcion es BLOQ', R.exc.filter(x => x.code === 'AJ-H').every(x => x.sev !== 'BLOQ'));
    // f) vigencia
    ok('9707 (ingreso real 2026-09-10): antes del ingreso NO se aplica el ajuste, despues si', api.shiftFor(M, '9707', '2026-09-03').source === 'PLAN' && api.shiftFor(M, '9707', '2026-09-03').code === 'T_DIA'
      && api.shiftFor(M, '9707', '2026-09-10').source === 'AJUSTE' && fila(R, '9707', '2026-09-03') && !fila(R, '9707', '2026-09-03').ajuste && fila(R, '9707', '2026-09-03').flags.includes('A-15'));
    ok('9708 (retirado el 15): el ajuste no revive los dias posteriores a vigFin', api.shiftFor(M, '9708', '2026-09-14').source === 'AJUSTE' && api.shiftFor(M, '9708', '2026-09-16').source === 'PLAN'
      && !fila(R, '9708', '2026-09-16').ajuste && fila(R, '9708', '2026-09-16').flags.includes('A-16'));
    ok('un ajuste con todos sus dias fuera de vigencia queda "sin efecto"', api.ajEstado(M, A('9707', '2026-09-01', '2026-09-05', 'T_MEDIO')).k === 'FUERA_VIGENCIA');
    ok('ajuste de una persona que no esta en los archivos: estado SIN_PERSONA', api.ajEstado(M, A('9999', '2026-09-01', '2026-09-05', 'T_MEDIO')).k === 'SIN_PERSONA');

    /* 3. computeBase == compute sin ajustes */
    const cfg = R.cfg;
    const Msin = { ...M, ajustes: new Map(), ajustesInvalidos: [] };
    const Rsin = api.compute(Msin, cfg);
    ok('RESULT.base trae SOLO a las personas con ajustes aplicables', eq([...R.base.byEmp.keys()].sort(), ['9702', '9703', '9704', '9705', '9706', '9707', '9708']));
    ok('computeBase == compute sin ajustes (filas identicas) para cada persona con ajustes', [...R.base.byEmp.keys()].every(id => J(R.base.byEmp.get(id).rows) === J(Rsin.byEmp.get(id).rows)));
    ok('y los totales por concepto de la base son los de compute sin ajustes', [...R.base.byEmp.keys()].every(id => eq(R.base.byEmp.get(id).tot, Rsin.byEmp.get(id).tot)));
    ok('quien NO tiene ajustes: sus filas con ajustes puestos son las de compute sin ajustes (la bolsa semanal es por persona)', J(R.byEmp.get('9701').rows) === J(Rsin.byEmp.get('9701').rows));
    ok('la base tiene I-01/I-02/I-03 = 0', inv(R.base) === 0);
    // (un solo motor vivo a la vez: cada `cargar` reemplaza el DOM y el localStorage globales, asi que se reutiliza `api`)
    const guardados = api.__ev('AJ_HORARIO').slice();
    const baseCon = lista => { const L2 = api.__ev('AJ_HORARIO'); L2.length = 0; lista.forEach(x => L2.push(x)); api.runCalc(); return api.__ev('RESULT').base; };
    ok('computeBase no se pide sin ajustes: base null cuando no hay ninguno', baseCon([]) === null);
    ok('un ajuste ANULADO solo (o de codigo inexistente) no genera linea base', baseCon([aD3, aE2]) === null);
    baseCon(guardados); R = api.__ev('RESULT'); M = api.__ev('MODEL');

    /* impacto antes -> ahora */
    const Id = api.ajImpactoDia(R, '9704', '2026-09-21');
    ok('impacto del dia 9704: ord 8->8, extras 4->0, recargos 3->7, pendientes 4->0', eq(Id.antes, { ord: 8, extra: 4, rec: 3, pend: 4 }) && eq(Id.ahora, { ord: 8, extra: 0, rec: 7, pend: 0 }));
    const Ie = api.ajImpactoEmp(R, '9704');
    ok('impacto en el ciclo 9704: "extras −12 h, recargos +12 h, pendientes −12 h"', api.ajDeltaTxt(Ie) === 'extras −12 h, recargos +12 h, pendientes −12 h', api.ajDeltaTxt(Ie));
    ok('impacto en el ciclo 9702: "ordinarias +40 h, extras −40 h"', api.ajDeltaTxt(api.ajImpactoEmp(R, '9702')) === 'ordinarias +40 h, extras −40 h', api.ajDeltaTxt(api.ajImpactoEmp(R, '9702')));
    ok('sin cambios: 9706 (ajuste redundante) no mueve nada', api.ajDeltaTxt(api.ajImpactoEmp(R, '9706')) === 'sin cambios en horas');

    /* asistencia y calidad usan el turno AJUSTADO */
    const as1 = api.__ev('ASISTENCIA').get('9702').resumen;
    ok('Asistencia usa el turno ajustado: 5 dias pasan de "asistio sin turno" a "asistio"', as0.S - as1.S === 5 && as1.A - as0.A === 5, `S ${as0.S}->${as1.S}, A ${as0.A}->${as1.A}`);
    const q1 = api.computeCalidad(M, R, cfg).emps.find(p => p.empRef.id === '9702');
    ok('Calidad usa el turno ajustado: 5 dias menos "sin turno" y 5 mas con turno', q0.sinTurno - q1.sinTurno === 5 && q1.conTurno - q0.conTurno === 5, `sinTurno ${q0.sinTurno}->${q1.sinTurno}`);

    /* Detalle (pantalla) */
    api.__ev("CUR_EMP='9704'"); api.renderDet();
    const det = api.__mk('#tDet tbody').innerHTML, kpi = api.__mk('#kpiDet').innerHTML;
    const tr = (det.match(/<tr data-iso="2026-09-21"[^>]*>[^]*?<\/tr>/) || [''])[0];
    ok('Detalle: el dia ajustado trae class="aj", el turno original tachado y la lista con el aplicado seleccionado', /<tr data-iso="2026-09-21" class="aj">/.test(tr) && /<s class="aj-orig"[^>]*>T_TARDE<\/s>/.test(tr) && /<option value="T_18_02" selected>/.test(tr));
    ok('Detalle: cada dia ofrece "Sin turno (descanso)" y los turnos del archivo', /<option value="">Sin turno \(descanso\)<\/option>/.test(tr) && ['T_DIA', 'T_TARDE', 'T_NOCHE', 'T_MEDIO', 'T_18_02'].every(c => tr.includes(`<option value="${c}"`)));
    ok('Detalle: un dia sin ajuste tiene la lista pero ni tachado ni "Quitar ajuste"', (m => /<select class="ajsel"/.test(m) && !/aj-orig|aj-quitar/.test(m) && !/class="aj"/.test(m))((det.match(/<tr data-iso="2026-09-14"[^>]*>[^]*?<\/tr>/) || [''])[0]));
    ok('Detalle: el dia ajustado tiene el boton "Quitar ajuste"', /data-aj-quitar="[^"]+"/.test(tr));
    const chipAj = (tr.match(/<span class="tag t-adj"[^>]*>AJ-H<\/span>/) || [''])[0];
    ok('chip AJ-H con el tooltip completo: motivo, autor, fecha, impacto del dia antes -> ahora y el aviso de la bolsa semanal',
      /Turno ajustado a T_18_02 \(BioTime: T_TARDE\)/.test(chipAj) && /Motivo: Turno equivocado/.test(chipAj) && /Autor: Prueba, 2026-11-10 09:00:00/.test(chipAj)
      && /ordinarias 8 → 8, extras 4 → 0, recargos 3 → 7, pendientes 4 → 0/.test(chipAj) && /bolsa semanal/.test(chipAj) && /data-nov="AJ-H"/.test(chipAj));
    ok('tarjeta del encabezado: dias ajustados e impacto en el ciclo', /Ajustes de horario<\/div><div class="v" style="color:var\(--adj\)">3<small>día\(s\) · extras −12 h, recargos \+12 h, pendientes −12 h<\/small>/.test(kpi));
    api.__ev("CUR_EMP='9701'"); api.renderDet();
    ok('una persona sin ajustes no tiene tarjeta de ajustes', !/Ajustes de horario/.test(api.__mk('#kpiDet').innerHTML));
    // un dia fuera de vigencia no ofrece la lista
    api.__ev("CUR_EMP='9707'"); api.renderDet();
    const d7 = api.__mk('#tDet tbody').innerHTML;
    const f3 = (d7.match(/<tr data-iso="2026-09-03"[^>]*>[^]*?<\/tr>/) || [''])[0];
    ok('Detalle: fuera de la vigencia (antes del ingreso) NO ofrece la lista desplegable', f3.length > 0 && !/<select/.test(f3));
    ok('Detalle: el dia 10 (ya vigente) si ofrece la lista', /<tr data-iso="2026-09-10"[^>]*>[^]*?<select class="ajsel"/.test(d7));

    /* Calendario */
    api.__set('selEmpCal', '9704'); api.__set('selMes', '2026-09'); api.renderCal();
    const cal = api.__mk('#calGrid').innerHTML;
    ok('Calendario: pinta los dias ajustados con class "aj" (token --adj), con su tooltip, y ya no existe "ovr"', /<div class="d aj"[^>]*data-iso="2026-09-21"/.test(cal) && /data-tip="Turno ajustado a T_18_02/.test(cal) && !/ovr/.test(cal) && !/\bd aj\b[^>]*data-iso="2026-09-24"/.test(cal));
    ok('aoaCal: ORIGEN dice AJUSTE en el dia ajustado y PLAN en el resto', (rows => rows.find(x => x[2] === '2026-09-21')[9] === 'AJUSTE' && rows.find(x => x[2] === '2026-09-24')[9] === 'PLAN')(api.aoaCal('9704', '2026-09')));
    ok('el CSS define --adj y --adj-soft una sola vez y sin --warn para los ajustes', (api.__fuente.match(/--adj:#[0-9a-f]{6}/g) || []).length === 1 && (api.__fuente.match(/--adj-soft:#[0-9a-f]{6}/g) || []).length === 1 && /\.cal \.d\.aj\{outline:2px solid var\(--adj\)\}/.test(api.__fuente) && !/\.d\.ovr/.test(api.__fuente));
    ok('todo var(--adj...) que usan los ajustes esta definido (un var() sin definir pinta negro; var(--fg) del dialogo ya existia)', (() => {
      const usadas = new Set([...api.__fuente.matchAll(/var\(--(adj[\w-]*)/g)].map(m => m[1])), def = new Set([...api.__fuente.matchAll(/--([\w-]+)\s*:/g)].map(m => m[1])), sin = [...usadas].filter(x => !def.has(x));
      return usadas.size >= 2 && sin.length === 0; })());

    /* exportaciones con ajustes */
    const aoD = api.aoaDet(R.byEmp.get('9704')), hd = aoD[0];
    ok('Excel del Detalle: 3 columnas nuevas, al FINAL (TURNO ORIGINAL, AJUSTE MOTIVO, AJUSTE AUTOR)', J(hd.slice(-3)) === J(['TURNO ORIGINAL', 'AJUSTE MOTIVO', 'AJUSTE AUTOR']) && hd[hd.length - 4] === 'EXPLICACION');
    const fAj = aoD.find(x => x[3] === '2026-09-21'), fNo = aoD.find(x => x[3] === '2026-09-24');
    ok('Excel del Detalle: dia ajustado con turno original, motivo y autor; los demas dias en blanco; todas las filas del mismo ancho', eq(fAj.slice(-3), ['T_TARDE', 'Turno equivocado', 'Prueba']) && eq(fNo.slice(-3), ['', '', '']) && aoD.every(x => x.length === hd.length));
    ok('Excel del Detalle: sin ajuste de esa persona las columnas siguen ahi (rectangular entre personas)', api.aoaDet(R.byEmp.get('9701'))[0].length === hd.length);
    const aoJ = api.aoaAjustes(null), hj = aoJ[0];
    ok('hoja Ajustes de horario: TODOS los ajustes (tambien anulados), solo ids y con su estado', aoJ.length - 1 === 10 && hj[0] === 'COD_EMPLEADO' && !hj.includes('NOMBRE') && aoJ.some(x => x[12] === aD3.id && x[8] === 'Anulado' && x[9] === 'Otra' && x[11] === 'Era un error')
      && aoJ.some(x => x[12] === aE2.id && /no existe en el archivo de Turno/.test(x[8])) && aoJ.some(x => x[12] === aE1.id && /Ya coincide con BioTime/.test(x[8])) && !/PRUEBA|AJ97/.test(J(aoJ)));
    ok('hoja Ajustes de horario respeta el filtro de personas (ids)', eq(api.aoaAjustes(new Set(['9703'])).slice(1).map(x => x[0]), ['9703']));
    api.__dom(); api.__escritos.length = 0;
    api.__set('fDepto', 'DEPTO A'); api.__mk('#expTodo').onclick();
    const wb = api.__escritos[0].wb, hoja = wb.sheets.find(s => s.n === 'Ajustes de horario');
    ok('Excel combinado: trae la hoja Ajustes de horario y con el filtro de departamento solo las personas filtradas', !!hoja && hoja.aoa.length > 1 && hoja.aoa.slice(1).every(x => ['9701', '9702', '9703', '9707'].includes(x[0])), hoja ? hoja.aoa.slice(1).map(x => x[0]).join(',') : 'sin hoja');
    ok('Excel combinado: el Detalle lleva las columnas de ajustes al final', J(wb.sheets.find(s => s.n === 'Detalle').aoa[0].slice(-3)) === J(['TURNO ORIGINAL', 'AJUSTE MOTIVO', 'AJUSTE AUTOR']));
    api.__set('fDepto', '');
    const xl = api.aoaExc().filter(x => x[1] === 'AJ-H');
    ok('hoja Excepciones: las AJ-H salen una por ajuste con su severidad', xl.length === R.exc.filter(x => x.code === 'AJ-H').length && xl.some(x => x[0] === 'ADV'));
    ok('Sinergy: no cambia de formato (nomina con lo ajustado)', (() => { let t = null; global.URL.createObjectURL = b => { t = b.p[0]; return 'b'; }; global.document.createElement = () => ({ click() {} }); api.sinergyTxt(); return t.split('\n').every(l => l.split('\t').length === 12); })());

    /* 6. dialogo */
    api = nuevo(html);
    api.runCalc();
    const hs = {}, hd2 = {}, hh = {};
    api.__mk('#tDet').addEventListener = (t, f) => { hs[t] = f; };
    api.__mk('#dlgAjuste').addEventListener = (t, f) => { hd2[t] = f; };
    api.__mk('#tAjustes').addEventListener = (t, f) => { hh[t] = f; };
    let abre = 0, cierra = 0, abreH = 0;
    api.__mk('#dlgAjuste').showModal = () => abre++; api.__mk('#dlgAjuste').close = () => cierra++; api.__mk('#dlgAjustes').showModal = () => abreH++; api.__mk('#dlgAjustes').close = () => abreH--;
    api.__dom();
    api.__ev("CUR_EMP='9703'"); api.renderDet();
    const N0 = api.__ev('AJ_HORARIO.length'), M0 = api.__ev('RESULT');
    ok('hookAjustes cablea la lista del Detalle (change y click), el cierre del dialogo y el historial', typeof hs.change === 'function' && typeof hs.click === 'function' && typeof hd2.close === 'function' && typeof hh.click === 'function' && typeof api.__mk('#btnAjOk').onclick === 'function' && typeof api.__mk('#btnAjustes').onclick === 'function');
    ok('cambiar «Aplicar hasta» refresca el aviso del dialogo (onchange y oninput cableados)', typeof api.__mk('#ajHasta').onchange === 'function' && typeof api.__mk('#ajHasta').oninput === 'function');
    const mkSel = (iso, prev, valor) => ({ dataset: { ajSel: '1', iso, prev }, value: valor });
    let sel = mkSel('2026-09-21', 'T_DIA', 'T_MEDIO');
    hs.change({ target: sel });
    ok('cambiar la lista NO aplica directo: abre el dialogo y no crea ajuste', abre === 1 && api.__ev('AJ_HORARIO.length') === N0 && api.__ev('RESULT') === M0 && /9703/.test(api.__mk('#ajResumen').textContent) && /2026-09-21/.test(api.__mk('#ajResumen').textContent) && api.__mk('#ajHasta').value === '2026-09-21');
    ok('el dialogo muestra los campos de crear', api.__mk('#ajCamposCrear').hidden === false && /Ajuste de horario/.test(api.__mk('#ajTitulo').textContent));
    const guardar = () => api.__mk('#btnAjOk').onclick();
    const llenar = (m, n, a, h) => { api.__mk('#ajMotivo').value = m; api.__mk('#ajNota').value = n; api.__mk('#ajAutor').value = a; if (h !== undefined) api.__mk('#ajHasta').value = h; };
    llenar('', '', 'Ana P', '2026-09-21'); guardar();
    ok('sin motivo: no guarda, muestra el error y el dialogo sigue abierto', api.__ev('AJ_HORARIO.length') === N0 && /motivo/i.test(api.__mk('#ajError').textContent) && api.__mk('#ajError').hidden === false && cierra === 0);
    llenar('OTRO', '   ', 'Ana P'); guardar();
    ok('motivo "Otro" sin nota: no guarda', api.__ev('AJ_HORARIO.length') === N0 && /nota/i.test(api.__mk('#ajError').textContent) && cierra === 0);
    llenar('EQUIVOCADO', '', ''); guardar();
    ok('sin autor: no guarda', api.__ev('AJ_HORARIO.length') === N0 && /quién/i.test(api.__mk('#ajError').textContent) && cierra === 0);
    llenar('FALSO', '', 'Ana P'); guardar();
    ok('un motivo que no es del enum no se acepta', api.__ev('AJ_HORARIO.length') === N0 && cierra === 0);
    llenar('EQUIVOCADO', '', 'Ana P', '2026-09-20'); guardar();
    ok('hasta anterior a desde: no guarda y lo dice', api.__ev('AJ_HORARIO.length') === N0 && /desde/.test(api.__mk('#ajError').textContent) && cierra === 0);
    api.__mk('#btnAjCancel').onclick();
    ok('Cancelar devuelve la lista al valor anterior y olvida el dialogo (sin ajuste)', sel.value === 'T_DIA' && api.__ev('AJ_DLG') === null && api.__ev('AJ_HORARIO.length') === N0 && cierra === 1);
    sel = mkSel('2026-09-22', 'T_DIA', 'T_NOCHE'); hs.change({ target: sel }); hd2.close();
    ok('cerrar con Esc (evento close) tambien revierte la lista', sel.value === 'T_DIA' && api.__ev('AJ_DLG') === null);
    hs.change({ target: mkSel('2026-09-21', 'T_DIA', 'T_DIA') });
    ok('elegir el mismo valor no abre nada', abre === 2);
    const vuelve = []; api.__mk('#tDet tbody tr[data-iso="2026-09-21"]').scrollIntoView = () => vuelve.push('2026-09-21');
    sel = mkSel('2026-09-21', 'T_DIA', 'T_MEDIO'); hs.change({ target: sel });
    llenar('EQUIVOCADO', 'trabaja 10 a 18', 'Ana P', '2026-09-23'); guardar();
    const L = api.__ev('AJ_HORARIO'), nuevoAj = L[L.length - 1];
    ok('Guardar: crea UN ajuste con persona, rango, turno, motivo, nota, autor, fecha y sin anular', L.length === N0 + 1 && nuevoAj.emp === '9703' && nuevoAj.desde === '2026-09-21' && nuevoAj.hasta === '2026-09-23' && nuevoAj.turno === 'T_MEDIO'
      && nuevoAj.motivo === 'EQUIVOCADO' && nuevoAj.nota === 'trabaja 10 a 18' && nuevoAj.autor === 'Ana P' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(nuevoAj.creado) && nuevoAj.anulado === null && /^aj-[\w-]+$/.test(nuevoAj.id));
    ok('Guardar: persiste en mb_ajustes_horario, recuerda al autor en mb_ajuste_autor y cierra el dialogo', JSON.parse(global.localStorage.getItem('mb_ajustes_horario')).some(a => a.id === nuevoAj.id) && global.localStorage.getItem('mb_ajuste_autor') === 'Ana P' && cierra >= 2);
    ok('Guardar: recalcula (RESULT nuevo con el turno ajustado) y la lista NO se revierte', api.__ev('RESULT') !== M0 && fila(api.__ev('RESULT'), '9703', '2026-09-21').turno === 'T_MEDIO' && sel.value === 'T_MEDIO' && api.__errores.length === 0, api.__errores.slice(0, 1).join(''));
    ok('Guardar: vuelve a la MISMA persona y al MISMO dia (la fila del Detalle recibe el foco)', api.__ev('CUR_EMP') === '9703' && vuelve.length >= 1 && api.__mk('#selEmp').value === '9703');
    llenar('', '', ''); hs.change({ target: mkSel('2026-09-22', 'T_DIA', 'T_NOCHE') });
    ok('el autor recordado se precarga en el dialogo siguiente', api.__mk('#ajAutor').value === 'Ana P' && api.__mk('#ajMotivo').value === '' && api.__mk('#ajNota').value === '');
    api.__mk('#btnAjCancel').onclick();
    // quitar (anular)
    const filaAj = fila(api.__ev('RESULT'), '9703', '2026-09-21');
    ok('el dia ajustado quedo marcado y con boton Quitar', filaAj.ajuste === nuevoAj.id && /data-aj-quitar/.test(api.__mk('#tDet tbody').innerHTML));
    hs.click({ target: { dataset: { ajQuitar: nuevoAj.id, iso: '2026-09-21' } } });
    ok('Quitar abre el dialogo de anulacion (sin campos de crear, avisa que cubre el rango completo)', api.__mk('#ajCamposCrear').hidden === true && /Anular/.test(api.__mk('#ajTitulo').textContent) && /2026-09-21 al 2026-09-23/.test(api.__mk('#ajResumen').textContent));
    llenar('', '', 'Ana P'); guardar();
    ok('anular sin motivo: no anula', api.__ev('AJ_HORARIO').find(a => a.id === nuevoAj.id).anulado === null && /motivo/i.test(api.__mk('#ajError').textContent));
    llenar('', 'BioTime ya lo corrigió', 'Ana P'); guardar();
    const anul = api.__ev('AJ_HORARIO').find(a => a.id === nuevoAj.id);
    ok('anular con motivo: NO borra (sigue en la lista), guarda quien, cuando y por que', api.__ev('AJ_HORARIO.length') === N0 + 1 && anul.anulado && anul.anulado.autor === 'Ana P' && anul.anulado.motivo === 'BioTime ya lo corrigió' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(anul.anulado.en));
    ok('anular: el dia vuelve a BioTime tras recalcular', fila(api.__ev('RESULT'), '9703', '2026-09-21').turno === 'T_DIA' && !fila(api.__ev('RESULT'), '9703', '2026-09-21').ajuste && vuelve.length >= 2);
    hs.click({ target: { dataset: { ajQuitar: nuevoAj.id, iso: '2026-09-21' } } });
    ok('un ajuste ya anulado no se puede anular de nuevo', api.__ev('AJ_DLG') === null);
    ok('no hay forma de borrar masivamente: el boton viejo (btnClrOvr) y el global OVERRIDES ya no existen', !api.__fuente.includes('btnClrOvr') && !/OVERRIDES/.test(api.__fuente));

    // historial
    poner(api, A('9701', '2026-09-14', '2026-09-14', 'T_MEDIO', '2026-11-12T09:00:00', { nota: 'una nota' }));
    api.__mk('#btnAjustes').onclick();
    const hist = api.__mk('#tAjustes tbody').innerHTML;
    ok('historial: abre, lista vigentes y anulados (con quien, cuando y por que) y el conteo', abreH === 1 && /Anulado/.test(hist) && /BioTime ya lo corrigió/.test(hist) && /Vigente/.test(hist) && api.__mk('#ajConteo').textContent === `${N0 + 2} de ${N0 + 2}`);
    ok('historial: Ver día en todas y Anular solo en las que no estan anuladas', (hist.match(/data-aj-ir=/g) || []).length === N0 + 2 && (hist.match(/data-aj-anular=/g) || []).length === N0 + 1);
    api.__set('fAjEmp', '9701'); api.renderAjustes();
    ok('historial: filtra por persona', (api.__mk('#tAjustes tbody').innerHTML.match(/<tr>/g) || []).length === 1 && api.__mk('#ajConteo').textContent === `1 de ${N0 + 2}`);
    api.__set('fAjEmp', '');
    const id1 = api.__ev('AJ_HORARIO')[api.__ev('AJ_HORARIO.length') - 1].id; const sc = []; api.__mk('#tDet tbody tr[data-iso="2026-09-14"]').scrollIntoView = () => sc.push(1);
    hh.click({ target: { dataset: { ajIr: id1 } } });
    ok('historial: "Ver día" cierra el historial y abre ese dia en el Detalle', abreH === 0 && api.__ev('CUR_EMP') === '9701' && sc.length === 1);
    api.__mk('#btnAjustes').onclick(); hh.click({ target: { dataset: { ajAnular: id1 } } });
    ok('historial: Anular abre el dialogo de anulacion', api.__ev('AJ_DLG') && api.__ev('AJ_DLG').modo === 'anular' && api.__ev('AJ_DLG').origen === 'hist');
    llenar('', 'ya no aplica', 'Ana P'); guardar();
    ok('historial: tras anular desde aqui la lista se repinta y el ajuste queda anulado', api.__ev('AJ_HORARIO').find(a => a.id === id1).anulado.motivo === 'ya no aplica' && /ya no aplica/.test(api.__mk('#tAjustes tbody').innerHTML));

    /* 5. migracion de mb_overrides */
    {
      const a5 = nuevo(html, { mb_overrides: J({ '9701|2026-09-14': 'T_MEDIO', '9701|2026-09-15': '', '9701|mal': 'T_DIA', '9702|2026-09-16': 5, '9703|2026-02-30': 'T_DIA' }) });
      const L5 = a5.__ev('AJ_HORARIO');
      ok('migracion: cada cambio puntual valido pasa a un ajuste de un dia (los ilegibles se descartan)', L5.length === 2 && L5.every(a => a.desde === a.hasta && a.motivo === 'OTRO' && a.nota === 'Migrado de un cambio puntual anterior' && a.autor === '(migrado)' && a.anulado === null));
      ok('migracion: el "" (sin turno) se conserva como turno vacio', L5.find(a => a.desde === '2026-09-15').turno === '' && L5.find(a => a.desde === '2026-09-14').turno === 'T_MEDIO');
      ok('migracion: se guarda en mb_ajustes_horario y se BORRA mb_overrides', global.localStorage.getItem('mb_overrides') === null && JSON.parse(global.localStorage.getItem('mb_ajustes_horario')).length === 2);
      a5.runCalc(); const R5 = a5.__ev('RESULT');
      ok('migracion: los ajustes migrados se aplican (9701 el 14 es T_MEDIO y el 15 sin turno)', fila(R5, '9701', '2026-09-14').turno === 'T_MEDIO' && fila(R5, '9701', '2026-09-14').ajuste && a5.shiftFor(a5.__ev('MODEL'), '9701', '2026-09-15').code === null && a5.__errores.length === 0);
      const store2 = { mb_ajustes_horario: global.localStorage.getItem('mb_ajustes_horario') };
      const a6 = nuevo(html, store2);
      ok('abrir de nuevo no duplica ni vuelve a migrar', a6.__ev('AJ_HORARIO.length') === 2);
      const a7 = nuevo(html, { mb_overrides: J({ '9701|2026-09-14': 'T_MEDIO' }), mb_ajustes_horario: store2.mb_ajustes_horario });
      ok('si mb_overrides reaparece, las migraciones ya hechas no se repiten (id determinista)', a7.__ev('AJ_HORARIO.length') === 2 && global.localStorage.getItem('mb_overrides') === null);
      const a8 = nuevo(html, { mb_overrides: '{no es json', mb_ajustes_horario: '[1,{"x":1},null]' });
      ok('localStorage corrupto no rompe la carga y queda sin ajustes', a8.__ev('AJ_HORARIO.length') === 0 && a8.__errores.length === 0);
      const a9 = nuevo(html);
      ok('sin nada guardado NO se escribe ninguna llave nueva al abrir', global.localStorage.getItem('mb_ajustes_horario') === null && a9.__ev('AJ_HORARIO.length') === 0);
    }

    /* 8. configuracion */
    api = nuevo(html); api.runCalc();
    poner(api, aA, aB, aD2, aD3);
    api.runCalc();
    const cfgOut = api.configArmar(new Date(2026, 10, 17, 10, 30, 5));
    ok('configuracion: ajustesHorario se exporta con todos (anulados incluidos), en orden y solo con ids', cfgOut.ajustesHorario.length === 4 && eq(cfgOut.ajustesHorario.map(a => a.id), [aA.id, aB.id, aD2.id, aD3.id]) && !/PRUEBA|AJ97/.test(J(cfgOut)));
    ok('configuracion: cada ajuste exportado trae exactamente las 10 claves en orden', cfgOut.ajustesHorario.every(a => J(Object.keys(a)) === '["id","emp","desde","hasta","turno","motivo","nota","autor","creado","anulado"]'));
    const texto = J(cfgOut), estadoCfg = () => J({ ...api.configArmar(new Date(2026, 0, 1)) });
    const antesCfg = estadoCfg();
    vaciar(api); api.runCalc();
    ok('limpiar deja la lista vacia', api.__ev('AJ_HORARIO.length') === 0 && fila(api.__ev('RESULT'), '9702', '2026-09-14').turno === '—');
    api.abrirImportCfg(texto, 'c.json'); api.confirmarImportCfg();
    ok('ida y vuelta: exportar, limpiar, importar deja los ajustes IDENTICOS (anulado incluido)', estadoCfg() === antesCfg && api.__errores.length === 0, api.__errores.slice(0, 1).join(''));
    ok('importar recalcula con los ajustes importados', fila(api.__ev('RESULT'), '9702', '2026-09-14').turno === 'T_DIA' && JSON.parse(global.localStorage.getItem('mb_ajustes_horario')).length === 4);
    api.abrirImportCfg(texto, 'c.json'); api.confirmarImportCfg();
    ok('importar el mismo archivo dos veces no duplica', api.__ev('AJ_HORARIO.length') === 4);
    // el otro archivo importa este .json
    {
      const otro = nuevo(nombre === 'COMPLETO' ? FILES.RRHH : FILES.COMPLETO); otro.runCalc(); otro.abrirImportCfg(texto, 'x.json'); otro.confirmarImportCfg();
      ok('el otro archivo (completo <-> rrhh) importa estos ajustes', otro.__ev('AJ_HORARIO.length') === 4 && fila(otro.__ev('RESULT'), '9702', '2026-09-14').turno === 'T_DIA');
      // volver a este archivo: sus globales
      api = nuevo(html); api.runCalc();
    }
    // fusion: no se borra nada y una anulacion nueva se adopta
    poner(api, aA, aD1);
    const conAnul = JSON.parse(texto); conAnul.ajustesHorario = [{ ...aA, anulado: { autor: 'Z', en: '2026-11-15T08:00:00', motivo: 'm' } }, { ...aB }];
    api.abrirImportCfg(J(conAnul), 'f.json');
    ok('vista previa de ajustes: 1 nuevo, 1 ya existe, 1 se marca anulado, nunca se borra', /Ajustes de horario: <b>2<\/b> en el archivo → <b>1<\/b> nuevo\(s\), 1 ya existen, 1 se marcan como anulados/.test(api.__mk('#cfgImpBody').innerHTML));
    api.confirmarImportCfg();
    ok('fusion: lo que ya existia se conserva (aD1), se agrega lo nuevo (aB) y la anulacion se adopta (aA)', api.__ev('AJ_HORARIO.length') === 3 && api.__ev('AJ_HORARIO').find(a => a.id === aA.id).anulado.autor === 'Z' && api.__ev('AJ_HORARIO').some(a => a.id === aD1.id));

    // rechazos del validador (atomico)
    const base1 = A('9701', '2026-09-14', '2026-09-14', 'T_MEDIO');
    const v1 = lista => J({ formato: 'mod_bio-config', version: 1, ajustesHorario: lista });
    const MALOS = [
      ['no es objeto: null', [null]], ['no es objeto: texto', ['x']], ['no es objeto: lista', [[]]], ['sin id', [{ ...base1, id: undefined }]], ['id numerico', [{ ...base1, id: 5 }]], ['id vacio', [{ ...base1, id: ' ' }]],
      ['id con comillas', [{ ...base1, id: 'a"b' }]], ['id __proto__', [{ ...base1, id: '__proto__' }]], ['id demasiado largo', [{ ...base1, id: 'a'.repeat(65) }]],
      ['emp numerico', [{ ...base1, emp: 9701 }]], ['emp vacio', [{ ...base1, emp: '' }]], ['emp es un nombre', [{ ...base1, emp: 'JUAN PEREZ' }]], ['emp __proto__', [{ ...base1, emp: '__proto__' }]], ['emp con HTML', [{ ...base1, emp: '<b>1</b>' }]],
      ['desde ausente', [{ ...base1, desde: undefined }]], ['desde mal escrita', [{ ...base1, desde: '14/09/2026' }]], ['desde imposible', [{ ...base1, desde: '2026-02-30' }]], ['hasta ausente', [{ ...base1, hasta: undefined }]],
      ['desde posterior a hasta', [{ ...base1, desde: '2026-09-15', hasta: '2026-09-14' }]], ['rango de mas de 3660 dias', [{ ...base1, desde: '2010-01-01', hasta: '2026-09-14' }]],
      ['turno numerico', [{ ...base1, turno: 5 }]], ['turno con caracteres de control', [{ ...base1, turno: 'T\u0000X' }]], ['turno demasiado largo', [{ ...base1, turno: 'T'.repeat(65) }]],
      ['motivo ausente', [{ ...base1, motivo: undefined }]], ['motivo fuera del enum', [{ ...base1, motivo: 'PORQUE_SI' }]], ['motivo con minusculas', [{ ...base1, motivo: 'otro' }]], ['motivo __proto__', [{ ...base1, motivo: '__proto__' }]], ['motivo toString', [{ ...base1, motivo: 'toString' }]],
      ['OTRO sin nota', [{ ...base1, motivo: 'OTRO', nota: '' }]], ['OTRO con nota en blanco', [{ ...base1, motivo: 'OTRO', nota: '   ' }]], ['nota numerica', [{ ...base1, nota: 7 }]], ['nota demasiado larga', [{ ...base1, nota: 'n'.repeat(501) }]],
      ['autor numerico', [{ ...base1, autor: 7 }]], ['autor demasiado largo', [{ ...base1, autor: 'a'.repeat(81) }]],
      ['creado ausente', [{ ...base1, creado: undefined }]], ['creado sin hora', [{ ...base1, creado: '2026-11-10' }]], ['creado con zona', [{ ...base1, creado: '2026-11-10T09:00:00Z' }]], ['creado imposible', [{ ...base1, creado: '2026-11-31T09:00:00' }]], ['creado hora 25', [{ ...base1, creado: '2026-11-10T25:00:00' }]],
      ['anulado texto', [{ ...base1, anulado: 'si' }]], ['anulado lista', [{ ...base1, anulado: [] }]], ['anulado sin motivo', [{ ...base1, anulado: { autor: 'a', en: '2026-11-10T09:00:00' } }]], ['anulado con motivo vacio', [{ ...base1, anulado: { autor: 'a', en: '2026-11-10T09:00:00', motivo: ' ' } }]],
      ['anulado con fecha mala', [{ ...base1, anulado: { autor: 'a', en: 'ayer', motivo: 'm' } }]], ['anulado con autor numerico', [{ ...base1, anulado: { autor: 4, en: '2026-11-10T09:00:00', motivo: 'm' } }]],
      ['ids repetidos', [base1, { ...base1, emp: '9702' }]],
      ['ATOMICO: un ajuste bueno + uno malo', [A('9701', '2026-09-20', '2026-09-20', 'T_DIA'), { ...base1, id: 'aj-x', motivo: 'NO' }]],
    ];
    const proto = '{"formato":"mod_bio-config","version":1,"ajustesHorario":[{"__proto__":{"x":1},"id":"aj-p","emp":"9701","desde":"2026-09-14","hasta":"2026-09-14","turno":"T_DIA","motivo":"OTRO","nota":"n","autor":"a","creado":"2026-11-10T09:00:00","anulado":null}]}';
    const snap = () => J([api.__ev('AJ_HORARIO'), global.localStorage.getItem('mb_ajustes_horario'), estadoCfg()]);
    const base2 = snap();
    let noRech = [], aplic = [], hab = [];
    for (const [desc, lista] of [...MALOS.map(([d, l]) => [d, v1(l)]), ['la clave __proto__ dentro del ajuste', proto], ['ajustesHorario: objeto', J({ formato: 'mod_bio-config', version: 1, ajustesHorario: {} })], ['ajustesHorario: texto', J({ formato: 'mod_bio-config', version: 1, ajustesHorario: 'a' })]]) {
      const rv = api.configValidar(lista);
      if (rv.ok || !rv.errores.length) noRech.push(desc);
      api.abrirImportCfg(lista, 'malo.json');
      if (api.__mk('#btnCfgImpOk').disabled !== true || api.__ev('CFG_PEND') !== null) hab.push(desc);
      api.confirmarImportCfg();
      if (snap() !== base2) aplic.push(desc);
    }
    ok(`${MALOS.length + 3} archivos con ajustes invalidos: todos rechazados con su motivo`, noRech.length === 0, noRech.join(' | '));
    ok('rechazados: "Reemplazar" deshabilitado y nada pendiente', hab.length === 0, hab.join(' | '));
    ok('rechazados: NO cambia nada (ni la lista ni localStorage), ni parcialmente', aplic.length === 0, aplic.join(' | '));
    api.abrirImportCfg(v1([{ ...base1, motivo: 'NO' }, { ...base1, id: 'aj-2', emp: 'JUAN PEREZ' }]), 'dos.json');
    ok('se listan TODOS los errores con el numero del ajuste', (api.__mk('#cfgImpBody').innerHTML.match(/<li>/g) || []).length >= 2 && /ajuste 1/.test(api.__mk('#cfgImpBody').innerHTML) && /ajuste 2/.test(api.__mk('#cfgImpBody').innerHTML));
    const buenos = api.configValidar(v1([{ ...base1, emp: '0385', nota: '  espacios  ', id: ' aj-ok ' }, { ...A('9701', '2026-09-14', '2026-09-14', ''), id: 'aj-ok2' }]));
    ok('validos: se recortan textos, el emp pasa por normId y el turno vacio (sin turno) es valido', buenos.ok && buenos.datos.ajustesHorario[0].emp === '385' && buenos.datos.ajustesHorario[0].nota === 'espacios' && buenos.datos.ajustesHorario[0].id === 'aj-ok' && buenos.datos.ajustesHorario[1].turno === '');
    ok('claves desconocidas dentro de un ajuste se ignoran (no se copian)', !('extra' in api.configValidar(v1([{ ...base1, id: 'aj-e', extra: 'x' }])).datos.ajustesHorario[0]));

    /* 9. nada de HTML inyectado: ni en texto ni en ATRIBUTOS (comillas dobles y simples, handlers, etiquetas) */
    api = nuevo(html); api.runCalc();
    const P1 = 'x" onmouseover="alert(1)" y="', P2 = "x' onmouseover='alert(2)' y='";
    poner(api,
      A('9701', '2026-09-14', '2026-09-16', 'T_MEDIO', '2026-11-10T09:00:00', { motivo: 'OTRO', nota: P1, autor: P2 }),
      A('9701', '2026-09-17', '2026-09-17', NASTY, '2026-11-10T09:00:00', { nota: PAYLOAD, autor: P1 }),
      A('9701', '2026-09-18', '2026-09-18', 'T_MEDIO', '2026-11-10T09:00:00', { motivo: 'OTRO', nota: P2, autor: PAYLOAD }),
      A('9703', '2026-09-14', '2026-09-14', P1, '2026-11-10T09:00:00', { nota: 'n', autor: 'x' }),                       // turno inexistente y hostil
      A('9703', '2026-09-15', '2026-09-15', P2, '2026-11-10T09:00:00', { nota: 'n', autor: 'x' }),
      A('9702', '2026-09-14', '2026-09-14', 'T_DIA', '2026-11-10T09:00:00', { nota: PAYLOAD, autor: 'x', anulado: { autor: P1, en: '2026-11-11T09:00:00', motivo: P2 } }));
    api.runCalc();
    api.__ev("CUR_EMP='9701'"); api.renderDet(); api.__set('selEmpCal', '9701'); api.__set('selMes', '2026-09'); api.renderCal(); api.renderAjustes(); api.renderExc();
    api.abrirImportCfg(J(api.configArmar()), '<b>x</b>.json');
    const esc = api.__ev('esc'), ajA = api.ajA;
    const superficies = { 'Detalle (filas, chips y tooltips)': api.__mk('#tDet tbody').innerHTML, 'Detalle (tarjetas)': api.__mk('#kpiDet').innerHTML, 'Calendario': api.__mk('#calGrid').innerHTML,
      'Historial': api.__mk('#tAjustes tbody').innerHTML, 'Excepciones': esFull ? api.__mk('#tExc tbody').innerHTML : '', 'Importar': api.__mk('#cfgImpBody').innerHTML };
    // analizador de etiquetas: ningun atributo on*, ninguna etiqueta peligrosa y las comillas de cada etiqueta cierran
    const peligros = h => {
      const malos = [], re = /<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g; let m;
      while ((m = re.exec(h))) {
        const sin = m[2].replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
        if (/^(img|script|iframe|svg|object|embed|style|link)$/i.test(m[1])) malos.push('etiqueta <' + m[1] + '>');
        if (/["']/.test(sin.replace(/=""|=''/g, ''))) malos.push('comillas sin cerrar en <' + m[1] + '>');
        for (const a of sin.matchAll(/(?:^|\s)([^\s=\/>]+)(?==|\s|$)/g)) if (/^on/i.test(a[1])) malos.push('atributo ' + a[1] + ' en <' + m[1] + '>');
      }
      return malos;
    };
    ok('el analizador de etiquetas detecta un atributo inyectado (no es un test que siempre pasa)', peligros('<div data-tip="x" onmouseover="alert(1)" y="">').length > 0 && peligros('<div data-tip="' + ajA(P1) + '">').length === 0 && peligros('<div data-tip="' + esc(P1) + '">').length > 0);
    for (const [k, h] of Object.entries(superficies)) {
      if (!h) continue;
      ok(`sin XSS en ${k}: ninguna etiqueta peligrosa ni atributo on* ni comillas rotas`, peligros(h).length === 0, peligros(h).slice(0, 2).join(' | '));
      ok(`${k}: ninguna etiqueta <img> viva` + (k === 'Importar' || k === 'Detalle (tarjetas)' ? '' : ' y el texto hostil sigue ahi (escapado)'), !/<img/i.test(h) && (k === 'Importar' || k === 'Detalle (tarjetas)' || h.includes('onmouseover') || h.includes('&lt;img')));
    }
    ok('el Calendario (el hallazgo): data-tip con nota/autor con comillas dobles y simples no abre atributos', /data-tip="Turno ajustado a T_MEDIO[^"]*&quot;/.test(superficies.Calendario) && peligros(superficies.Calendario).length === 0);
    const dlg = api.__mk('#ajResumen');
    api.__ev("CUR_EMP='9701'"); api.__mk('#dlgAjuste').showModal = () => {};
    api.ajAbrirDialogo({ modo: 'crear', origen: 'det', emp: '9701', iso: '2026-09-14', turno: P1, prev: P2, sel: null });
    ok('el dialogo escribe con textContent (no innerHTML): sin HTML interpretado', dlg.innerHTML === '' && dlg.textContent.includes(P1) && api.__mk('#ajAvisoSeg').innerHTML === '');
    ok('ajA escapa comillas, y esc no (por eso ajA)', ajA('"\'<>&') === '&quot;&#39;&lt;&gt;&amp;' && esc('"') === '"');
    ok('ids del ajuste validados: nunca llevan comillas ni espacios (van dentro de atributos)', api.ajNormalizar({ ...A('9701', '2026-09-14', '2026-09-14', 'T_DIA'), id: 'a b' }).errores.length > 0 && api.ajNormalizar({ ...A('9701', '2026-09-14', '2026-09-14', 'T_DIA'), id: 'a"b' }).errores.length > 0);

    /* 10. correcciones de la revision adversarial */
    {
      api = nuevo(html); api.runCalc();
      const M2 = api.__ev('MODEL'), R2 = api.__ev('RESULT'), cfg2 = R2.cfg;
      const con = lista => ({ ...M2, ...api.ajIndexar(lista, M2.shifts) });
      const calc = lista => api.compute(con(lista), cfg2);
      // A-09: un ajuste aplicable le da programacion a quien no tenia ninguna
      const a9 = A('9709', '2026-09-14', '2026-09-18', 'T_DIA');
      const nA09 = R => R.exc.filter(x => x.code === 'A-09' && x.id === '9709').length;
      ok('A-09: sin ajuste, quien no tiene NINGUNA programacion sigue con su BLOQ', nA09(R2) === 1);
      ok('A-09: con un ajuste aplicable ya tiene programacion: el BLOQ desaparece', nA09(calc([a9])) === 0);
      ok('A-09: un ajuste anulado o de turno inexistente NO lo quita', nA09(calc([{ ...a9, anulado: { autor: 'a', en: '2026-11-11T09:00:00', motivo: 'm' } }])) === 1 && nA09(calc([A('9709', '2026-09-14', '2026-09-18', 'T_ZZZ')])) === 1);
      ok('A-09 consciente del ciclo: un ajuste FUERA del ciclo (2020) NO lo quita', nA09(calc([A('9709', '2020-01-01', '2020-01-02', 'T_DIA')])) === 1);
      ok('A-09: un ajuste de solo «sin turno» (\'\') dentro del ciclo NO lo quita', nA09(calc([A('9709', '2026-09-14', '2026-09-18', '')])) === 1);
      ok('A-09: un ajuste con turno que solo SE SOLAPA con el ciclo (termina el 2026-09-02) si lo quita; fuera de vigencia no', nA09(calc([A('9709', '2026-08-25', '2026-09-02', 'T_DIA')])) === 0);
      ok('A-09: un ajuste valido TOTALMENTE sobrepuesto por uno mas nuevo de turno inexistente NO lo quita (manda BioTime = nada)', nA09(calc([A('9709', '2026-09-14', '2026-09-18', 'T_DIA', '2026-11-10T09:00:00'), A('9709', '2026-09-01', '2026-09-30', 'T_ZZZ', '2026-11-10T10:00:00')])) === 1
        && nA09(calc([A('9709', '2026-09-14', '2026-09-18', 'T_DIA', '2026-11-10T09:00:00'), A('9709', '2026-09-16', '2026-09-17', 'T_ZZZ', '2026-11-10T10:00:00')])) === 0);
      // estado «sobrepuesto» (un ajuste anterior que un bloqueo mas nuevo deja sin efecto en parte o todos sus dias)
      {
        const o1 = A('9701', '2026-09-14', '2026-09-18', 'T_MEDIO', '2026-11-10T09:00:00'), blq = A('9701', '2026-09-16', '2026-09-17', 'T_ZZZ', '2026-11-10T10:00:00'), todo = { ...blq, id: 'aj-todo', desde: '2026-09-01', hasta: '2026-09-30' };
        const Mp = con([o1, blq]), Mt = con([o1, todo]);
        ok('estado SOBREPUESTO: parcial y total (no dice «Vigente»), con el texto de AJ_ESTADOS', api.ajEstado(Mp, o1).k === 'SOBREPUESTO' && api.ajEstado(Mt, o1).k === 'SOBREPUESTO' && api.ajEstado(Mp, o1).txt === api.__ev('AJ_ESTADOS').SOBREPUESTO && /manda BioTime/.test(api.ajEstado(Mp, o1).txt)
          && api.ajEstado(Mp, blq).k === 'TURNO_INEXISTENTE' && api.ajSobrepuesto(Mp, o1) === 2 && api.ajSobrepuesto(Mt, o1) === 5);
        ok('estado: sin bloqueo sigue «Vigente»; uno MAS ANTIGUO que el valido no lo sobrepone; el anulado tampoco', api.ajEstado(con([o1]), o1).k === 'VIGENTE' && api.ajEstado(con([o1, { ...blq, creado: '2026-11-10T08:00:00' }]), o1).k === 'VIGENTE'
          && api.ajEstado(con([o1, { ...blq, anulado: { autor: 'a', en: '2026-11-11T09:00:00', motivo: 'm' } }]), o1).k === 'VIGENTE');
        const Rp = api.compute(Mp, cfg2), ex = Rp.exc.filter(x => x.code === 'AJ-H' && x.id === '9701');
        const iSob = ex.find(x => x.sev === 'INFO');
        ok('AJ-H INFO de un ajuste sobrepuesto NO dice «Turno ajustado…» sino que esta sobrepuesto, y el ADV del bloqueo se mantiene', iSob && /^Ajuste de turno SOBREPUESTO/.test(iSob.msg) && !/^Turno ajustado/.test(iSob.msg) && iSob.msg.includes(api.__ev('AJ_ESTADOS').SOBREPUESTO) && ex.some(x => x.sev === 'ADV' && /NO aplicado/.test(x.msg)));
        const aS = nuevo(html); poner(aS, o1, blq); aS.runCalc(); aS.__mk('#dlgAjustes').showModal = () => {}; aS.abrirAjustes();
        const hojaS = aS.aoaAjustes(null).find(x => x[12] === o1.id), histS = aS.__mk('#tAjustes tbody').innerHTML;
        const filaH = histS.split('<tr>').find(c => c.includes(`data-aj-ir="${o1.id}"`)) || '';
        ok('el Excel y el historial usan el MISMO texto de estado «sobrepuesto» (y la fila no dice «Vigente»)', filaH.length > 0 && hojaS[8] === aS.__ev('AJ_ESTADOS').SOBREPUESTO && filaH.includes(aS.__ev('AJ_ESTADOS').SOBREPUESTO) && !filaH.includes('>Vigente<'));
        api = nuevo(html); api.runCalc();
      }
      // orden total: el empate por «creado» se resuelve por id, no por el orden de la lista
      const t1 = A('9701', '2026-09-14', '2026-09-14', 'T_MEDIO', '2026-11-10T09:00:00', { id: 'aj-aaa' }), t2 = A('9701', '2026-09-14', '2026-09-14', 'T_TARDE', '2026-11-10T09:00:00', { id: 'aj-zzz' });
      ok('empate de «creado»: gana el id mayor sin importar el orden de la lista (determinista)', api.shiftFor(con([t1, t2]), '9701', '2026-09-14').code === 'T_TARDE' && api.shiftFor(con([t2, t1]), '9701', '2026-09-14').code === 'T_TARDE'
        && eq(api.ajIndexar([t2, t1], M2.shifts).ajustes.get('9701').map(a => a.id), ['aj-aaa', 'aj-zzz']));
      // un ajuste mas reciente con turno inexistente no deja que uno anterior ocupe su lugar
      const v1 = A('9701', '2026-09-14', '2026-09-18', 'T_MEDIO', '2026-11-10T09:00:00'), v2 = A('9701', '2026-09-16', '2026-09-17', 'T_ZZZ', '2026-11-10T10:00:00');
      const Mv = con([v1, v2]);
      ok('el mas reciente con turno inexistente BLOQUEA al anterior: esos dias manda BioTime (y el ADV sigue)', ['2026-09-14', '2026-09-15', '2026-09-18'].every(i => api.shiftFor(Mv, '9701', i).code === 'T_MEDIO')
        && ['2026-09-16', '2026-09-17'].every(i => api.shiftFor(Mv, '9701', i).source === 'PLAN' && api.shiftFor(Mv, '9701', i).code === 'T_DIA') && Mv.ajustesInvalidos.length === 1);
      const Rv = api.compute(Mv, cfg2), f16 = fila(Rv, '9701', '2026-09-16');
      ok('...y el calculo lo respeta (la fila del 16 es T_DIA, sin ajuste) y emite el ADV', f16.turno === 'T_DIA' && !f16.ajuste && fila(Rv, '9701', '2026-09-15').turno === 'T_MEDIO' && Rv.exc.some(x => x.code === 'AJ-H' && x.sev === 'ADV' && x.id === '9701'));
      const Mw = con([{ ...v2, creado: '2026-11-10T08:00:00' }, v1]);
      ok('si el de turno inexistente es MAS ANTIGUO, el valido si manda', api.shiftFor(Mw, '9701', '2026-09-16').code === 'T_MEDIO');
      ok('un ajuste anulado de turno inexistente no bloquea a nadie', api.shiftFor(con([v1, { ...v2, anulado: { autor: 'a', en: '2026-11-11T09:00:00', motivo: 'm' } }]), '9701', '2026-09-16').code === 'T_MEDIO');
      // perfil: se infiere de los turnos EFECTIVOS (los aplicados: BioTime o ajuste); un dia rotativo vuelve ROTATIVO a todo el ciclo
      const perfil = (lista, id) => calc(lista).byEmp.get(id).perfil;
      const anulP = { autor: 'a', en: '2026-11-11T09:00:00', motivo: 'm' };
      const aj1 = A('9710', '2026-09-15', '2026-09-15', 'T_DIA');
      ok('perfil: 9710 (T_ADM1 todo el mes) es ADMINISTRATIVO sin ajustes', R2.byEmp.get('9710').perfil === 'ADMINISTRATIVO'
        && R2.byEmp.get('9710').rows.every(r => r.umbral == null));
      // (a) un solo dia en turno rotativo => ROTATIVO todo el ciclo
      const Ra = calc([aj1]), ea = Ra.byEmp.get('9710');
      ok('perfil (a): un ajuste de UN dia a un turno no administrativo vuelve ROTATIVO a la persona todo el ciclo (aplica el umbral semanal)', ea.perfil === 'ROTATIVO'
        && ea.rows.filter(r => r.inCiclo && r.turno !== '—').every(r => r.umbral != null)
        && !Ra.exc.some(x => x.code === 'B-06' && x.id === '9710'));
      ok('perfil (a): tambien si el ajuste cubre TODO el mes', perfil([A('9710', '2026-09-01', '2026-09-30', 'T_DIA')], '9710') === 'ROTATIVO');
      ok('perfil (a): I-01/I-02/I-03 = 0 con el perfil cambiado', inv(Ra) === 0);
      // la linea base (sin ajustes) conserva el perfil original y el impacto cuadra con compute sin ajustes
      const Rb = api.compute({ ...con([aj1]) }, cfg2);
      ok('perfil: RESULT.base conserva el perfil ORIGINAL (ADMINISTRATIVO) y el cambio de perfil es parte del impacto del ajuste', Rb.base && Rb.base.byEmp.get('9710').perfil === 'ADMINISTRATIVO'
        && eq(Rb.base.byEmp.get('9710').rows, R2.byEmp.get('9710').rows) && inv(Rb.base) === 0);
      const Ie = api.ajImpactoEmp(Rb, '9710'), O = R2.byEmp.get('9710');
      ok('perfil: ajImpactoEmp(antes) == resultado sin ajustes y ajImpactoEmp(ahora) == resultado con el ajuste (extras, ordinarias, pendientes)', Math.abs(Ie.antes.extra - (O.extraH || 0)) < 1e-9 && Math.abs(Ie.antes.ord - (O.ordH || 0)) < 1e-9
        && Math.abs(Ie.antes.pend - (O.pendH || 0)) < 1e-9 && Math.abs(Ie.ahora.extra - (ea.extraH || 0)) < 1e-9 && Math.abs(Ie.ahora.ord - (ea.ordH || 0)) < 1e-9);
      ok('perfil: resultadoOriginal devuelve el perfil original de esa persona', api.resultadoOriginal(Rb).byEmp.get('9710').perfil === 'ADMINISTRATIVO');
      // (b) ajuste anulado => no cuenta
      ok('perfil (b): con el ajuste ANULADO sigue ADMINISTRATIVO', perfil([{ ...aj1, anulado: anulP }], '9710') === 'ADMINISTRATIVO');
      // (c) ajuste a otro turno administrativo (prefijo T_ADM) => sigue ADMINISTRATIVO
      ok('perfil (c): un ajuste a otro turno con prefijo administrativo no cambia el perfil', perfil([A('9710', '2026-09-15', '2026-09-16', 'T_ADM1')], '9710') === 'ADMINISTRATIVO');
      // (d) turno rotativo de BioTime ajustado a «sin turno» algunos dias: sigue ROTATIVO si queda algun turno rotativo
      ok('perfil (d): rotativo de BioTime con algunos dias ajustados a «sin turno» sigue ROTATIVO', R2.byEmp.get('9701').perfil === 'ROTATIVO'
        && perfil([A('9701', '2026-09-14', '2026-09-18', '')], '9701') === 'ROTATIVO');
      ok('perfil (d2): administrativo con dias ajustados a «sin turno» sigue ADMINISTRATIVO (los dias sin turno no cuentan)', perfil([A('9710', '2026-09-14', '2026-09-18', '')], '9710') === 'ADMINISTRATIVO');
      // (e) ajuste con turno inexistente: no se aplica, no cambia el perfil
      ok('perfil (e): un ajuste con codigo de turno inexistente (no aplicado) no cambia el perfil', perfil([A('9710', '2026-09-15', '2026-09-15', 'T_ZZZ')], '9710') === 'ADMINISTRATIVO');
      ok('perfil: un ajuste a turno rotativo TAPADO por uno mas nuevo de turno inexistente no cuenta', perfil([A('9710', '2026-09-15', '2026-09-15', 'T_DIA', '2026-11-10T09:00:00'), A('9710', '2026-09-15', '2026-09-15', 'T_ZZZ', '2026-11-10T10:00:00')], '9710') === 'ADMINISTRATIVO');
      ok('perfil: un ajuste a turno rotativo FUERA de la vigencia de la persona no cuenta', perfil([A('9708', '2026-09-20', '2026-09-20', 'T_NOCHE')], '9708') === R2.byEmp.get('9708').perfil);
      // sin turno de BioTime en el ciclo: se infiere de los ajustados (como siempre)
      ok('perfil: sin ningun turno de BioTime en el ciclo se infiere de los ajustados (T_ADM1 -> ADMINISTRATIVO, T_DIA -> ROTATIVO)', R2.byEmp.get('9709').perfil === 'ROTATIVO'
        && perfil([A('9709', '2026-09-14', '2026-09-18', 'T_ADM1')], '9709') === 'ADMINISTRATIVO' && perfil([A('9709', '2026-09-14', '2026-09-18', 'T_DIA')], '9709') === 'ROTATIVO');
      // (f) override manual
      api.__ev("PERFILES['9710']='ADMINISTRATIVO'");
      ok('perfil (f): el override manual (PERFILES) gana sobre el perfil efectivo (ADMINISTRATIVO forzado con ajuste rotativo) y emite B-06', perfil([aj1], '9710') === 'ADMINISTRATIVO'
        && calc([aj1]).exc.some(x => x.code === 'B-06' && x.id === '9710'));
      api.__ev("delete PERFILES['9710']");
      api.__ev("PERFILES['9701']='ADMINISTRATIVO'");
      ok('perfil (f): el override manual tambien gana en la otra direccion', perfil([A('9701', '2026-09-15', '2026-09-15', 'T_ADM1')], '9701') === 'ADMINISTRATIVO');
      api.__ev("delete PERFILES['9701']");
      api.__ev("PERFILES['9710']='ROTATIVO'");
      ok('perfil (f): el override manual ROTATIVO sigue ganando', perfil([A('9710', '2026-09-15', '2026-09-15', 'T_ADM1')], '9710') === 'ROTATIVO');
      api.__ev("delete PERFILES['9710']");
      // aviso del dialogo: turno sin jornada ese dia de la semana
      api.__mk('#dlgAjuste').showModal = () => {};
      const aviso = (iso, turno, hasta) => { api.__set('ajHasta', hasta || iso); api.ajAbrirDialogo({ modo: 'crear', origen: 'det', emp: '9701', iso, turno, prev: '', sel: null }); api.__set('ajHasta', hasta || iso); api.ajActualizarAviso(); return [api.__mk('#ajAvisoSeg').textContent, api.__mk('#ajAvisoSeg').hidden]; };
      let av = aviso('2026-09-19', 'T_DIA');
      ok('dialogo: un turno sin jornada el dia elegido (sabado) avisa «el dia quedara sin turno» y no bloquea', /Ese turno no tiene jornada el día Sáb 2026-09-19: el día quedará sin turno\./.test(av[0]) && av[1] === false);
      av = aviso('2026-09-18', 'T_DIA', '2026-09-21');
      ok('dialogo: en un rango cuenta los dias sin jornada (vie a lun: sabado y domingo = 2 de 4)', /2 de los 4 días del rango no tienen jornada/.test(av[0]) && !/Ese turno no tiene jornada el día/.test(av[0]), av[0]);
      av = aviso('2026-09-14', 'T_DIA', '2026-09-18');
      ok('dialogo: un turno con jornada todos esos dias no avisa nada', av[0] === '' && av[1] === true);
      av = aviso('2026-09-19', '', '2026-09-19');
      ok('dialogo: «sin turno» no avisa', av[0] === '' && av[1] === true);
      av = aviso('2026-09-14', 'T_DIA', '2026-09-20');
      ok('dialogo: el turno que empieza bien pero tiene dias sin jornada mas adelante lo dice con un ejemplo', /2 de los 7 días del rango/.test(av[0]) && /Sáb 2026-09-19/.test(av[0]) && !/Ese turno no tiene jornada el día/.test(av[0]), av[0]);
      api.__ev("AJ_DLG={modo:'anular',emp:'9701',iso:'2026-09-19',desde:'2026-09-19',hasta:'2026-09-19'}"); api.ajActualizarAviso();
      ok('dialogo: en modo anular no hay aviso', api.__mk('#ajAvisoSeg').hidden === true);
      ok('ajAvisoSegmento es pura: un turno desconocido o fechas invalidas no avisan ni revientan', api.ajAvisoSegmento(M2, 'T_ZZZ', '2026-09-19', '2026-09-19') === '' && api.ajAvisoSegmento(M2, 'T_DIA', 'mal', 'mal') === '' && api.ajAvisoSegmento(null, 'T_DIA', '2026-09-19', '2026-09-19') === '');
      // fusion: un id que ya existe no puede cambiar ni anular un ajuste ya auditado
      const X = A('9701', '2026-09-14', '2026-09-14', 'T_MEDIO', '2026-11-10T09:00:00', { nota: 'orig', autor: 'Ana' });
      const cambios = { turno: 'T_TARDE', desde: '2026-09-15', hasta: '2026-09-16', motivo: 'NO_CARGADO', nota: 'otra', autor: 'Pedro', creado: '2026-11-12T09:00:00', emp: '9702' };
      const anul = { autor: 'Z', en: '2026-11-15T08:00:00', motivo: 'm' };
      ok('fusion: el mismo id con CUALQUIER campo distinto es un conflicto: se ignora y no se anula (turno, fechas, motivo, nota, autor, creado, persona)',
        Object.entries(cambios).every(([k, v]) => { const F = api.ajFusionar([X], [{ ...X, [k]: v, anulado: anul }]); return F.conflictos.length === 1 && F.lista.length === 1 && F.lista[0] === X && F.lista[0].anulado === null && F.existentes === 0 && F.anulados === 0; }));
      const F2 = api.ajFusionar([X], [{ ...X, anulado: anul }]);
      ok('fusion: identico en todo lo demas SI adopta la anulacion; sin diferencias es solo "ya existe"; no pisa una anulacion existente', F2.anulados === 1 && F2.conflictos.length === 0 && F2.lista[0].anulado.autor === 'Z' && X.anulado === null
        && api.ajFusionar([X], [{ ...X }]).existentes === 1 && api.ajFusionar([F2.lista[0]], [{ ...X, anulado: { ...anul, autor: 'Otro' } }]).lista[0].anulado.autor === 'Z');
      poner(api, X);
      const antesLista = J(api.__ev('AJ_HORARIO')), antesLS = global.localStorage.getItem('mb_ajustes_horario');
      api.abrirImportCfg(J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [{ ...X, turno: 'T_TARDE', anulado: anul }, A('9701', '2026-09-20', '2026-09-20', 'T_DIA')] }), 'c.json');
      const vistaC = api.__mk('#cfgImpBody').innerHTML;
      ok('importar: la vista previa lista el conflicto (con el id escapado) y cuenta 1 nuevo y 1 choque', /Ajustes que chocan con uno existente/.test(vistaC) && vistaC.includes(`«${X.id}»`) && /<b>1<\/b> nuevo\(s\)[^]*<b>1<\/b> chocan/.test(vistaC));
      api.confirmarImportCfg();
      const despues = api.__ev('AJ_HORARIO');
      ok('importar: el ajuste existente queda EXACTAMENTE igual (sin anular, mismo turno) y solo se agrega el nuevo', despues.length === 2 && J(despues[0]) === J(JSON.parse(antesLista)[0]) && despues[0].anulado === null && despues[0].turno === 'T_MEDIO');
      // importar con conflictos: se elige UNA vez entre ignorar (por omision) y sobrescribir
      {
        const snap = api.__ev('AJ_HORARIO').slice();
        const restaurar = () => { const L = api.__ev('AJ_HORARIO'); L.splice(0, L.length, ...snap); api.__ev('ajPersistir()'); };
        const Y = A('9702', '2026-09-15', '2026-09-15', 'T_DIA', '2026-11-10T09:00:00', { nota: 'y' });
        const Z = A('9703', '2026-09-16', '2026-09-16', 'T_DIA', '2026-11-10T09:00:00', { nota: 'z' });
        const N1 = A('9704', '2026-09-17', '2026-09-17', 'T_DIA');
        const base = [X, Y, Z];
        const Xn = { ...X, turno: 'T_TARDE', nota: 'nueva', autor: 'Pedro' };
        const Fi = api.ajFusionar(base, [Xn, N1]), Fi2 = api.ajFusionar(base, [Xn, N1], 'ignorar');
        ok('fusion: «ignorar» (por omision y explicito) deja el actual, cuenta el choque y no sobrescribe nada', J(Fi) === J(Fi2) && Fi.lista.length === 4 && Fi.lista[0] === X && Fi.conflictos.length === 1 && Fi.sobrescritos.length === 0 && Fi.agregados === 1);
        const Fs = api.ajFusionar(base, [Xn, N1], 'sobrescribir');
        ok('fusion: «sobrescribir» reemplaza el actual EN LA MISMA POSICION, conserva el orden y la cantidad, no toca los demas y no muta la lista de entrada',
          Fs.lista.length === 4 && Fs.lista[0] === Xn && Fs.lista[1] === Y && Fs.lista[2] === Z && Fs.lista[3] === N1 && J(Fs.conflictos) === J([X.id]) && J(Fs.sobrescritos) === J([X.id]) && Fs.agregados === 1
          && base.length === 3 && base[0] === X && X.turno === 'T_MEDIO');
        ok('fusion: sin conflictos «sobrescribir» es identico a «ignorar»', J(api.ajFusionar(base, [N1], 'sobrescribir')) === J(api.ajFusionar(base, [N1])) && api.ajFusionar(base, [N1], 'sobrescribir').sobrescritos.length === 0);
        const anulB = { autor: 'Z', en: '2026-11-15T08:00:00', motivo: 'm' };
        const Fm = api.ajFusionar(base, [{ ...X, anulado: anulB }, { ...Y, turno: 'T_TARDE' }], 'sobrescribir');
        ok('fusion: un id IDENTICO conserva su comportamiento en los dos modos (ya existe / adopta la anulacion) y solo el que difiere se sobrescribe',
          Fm.existentes === 1 && Fm.anulados === 1 && Fm.lista[0].anulado.autor === 'Z' && Fm.lista[0].turno === 'T_MEDIO' && J(Fm.sobrescritos) === J([Y.id]) && Fm.lista[1].turno === 'T_TARDE' && Fm.lista[2] === Z
          && api.ajFusionar(base, [{ ...X }], 'sobrescribir').existentes === 1 && api.ajFusionar(base, [{ ...X }], 'sobrescribir').sobrescritos.length === 0);
        ok('fusion: sobrescribir nunca borra nada que no este en el archivo', api.ajFusionar(base, [Xn], 'sobrescribir').lista.length === 3 && api.ajFusionar(base, [Xn], 'sobrescribir').lista.includes(Y) && api.ajFusionar(base, [Xn], 'sobrescribir').lista.includes(Z));
        ok('ajDifiere lista en español los campos que cambian (incluida la anulacion) y es vacia si son iguales',
          J(api.ajDifiere(X, Xn)) === J(['turno', 'nota', 'autor']) && api.ajDifiere(X, { ...X }).length === 0 && J(api.ajDifiere(X, { ...X, anulado: anulB, emp: '9702', creado: '2026-11-11T09:00:00' })) === J(['persona', 'creación', 'anulación'])
          && api.ajDifiere({ ...X, anulado: anulB }, { ...X, anulado: { ...anulB } }).length === 0 && J(api.ajDifiere({ ...X, anulado: anulB }, { ...X, anulado: { ...anulB, motivo: 'otro' } })) === J(['anulación']));

        // vista previa
        const Xh = { ...X, turno: NASTY, nota: PAYLOAD, autor: PAYLOAD };
        const peligrosos = h => {
          const malos = [], re = /<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g; let m;
          while ((m = re.exec(h))) {
            const sin = m[2].replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
            if (/^(img|script|iframe|svg|object|embed|style|link)$/i.test(m[1])) malos.push(m[1]);
            if (/["']/.test(sin.replace(/=""|=''/g, ''))) malos.push('comillas ' + m[1]);
            for (const a of sin.matchAll(/(?:^|\s)([^\s=\/>]+)(?==|\s|$)/g)) if (/^on/i.test(a[1])) malos.push(a[1]);
          }
          return malos;
        };
        api.abrirImportCfg(J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [Xh, N1] }), 'c.json');
        const vp = api.__mk('#cfgImpBody').innerHTML;
        const radios = [...vp.matchAll(/<input type="radio"[^>]*>/g)].map(m => m[0]);
        ok('importar: con conflictos aparecen dos opciones (ignorar marcada por omision, sobrescribir) con su texto', radios.length === 2 && /name="cfgConflicto"/.test(radios[0]) && /id="cfgConfIgn"/.test(radios[0]) && /\bchecked\b/.test(radios[0]) && /id="cfgConfSob"/.test(radios[1]) && !/\bchecked\b/.test(radios[1])
          && /Ignorar los del archivo \(se conservan los actuales\)/.test(vp) && /Sobrescribir los actuales con los del archivo/.test(vp));
        ok('importar: el resumen ya no dice que se ignoran sin mas ("chocan: elija abajo qué hacer") y cada choque dice en que campos difiere',
          /<b>1<\/b> chocan: elija abajo qué hacer/.test(vp) && !/chocan y se ignoran/.test(vp) && new RegExp('«' + X.id + '» ya existe con otro contenido; difiere en: turno, nota, autor').test(vp));
        ok('importar: avisa que sobrescribir pierde el contenido anterior y que no se borra ningun otro ajuste', /contenido anterior se pierde/.test(vp) && /no se borra ningún otro ajuste/.test(vp) && !/solo se agregan/i.test(vp));
        ok('importar: con turno/nota/autor hostiles la vista previa no tiene atributos on*, etiquetas vivas ni comillas sin cerrar (solo los dos radios son <input>)',
          peligrosos(vp).length === 0 && (vp.match(/<input\b/g) || []).length === 2 && !vp.includes(PAYLOAD) && !vp.includes(NASTY));
        api.abrirImportCfg(J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [N1] }), 'sin.json');
        const vp0 = api.__mk('#cfgImpBody').innerHTML;
        ok('importar: sin conflictos NO hay opciones ni radios', !/cfgConflicto|cfgConfSob|cfgConfIgn|<input/.test(vp0) && !/Ajustes que chocan con uno existente/.test(vp0));
        api.abrirImportCfg(J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [N1] }), 'sin.json');
        api.__mk('#cfgConfSob').checked = true;          // un radio viejo marcado no puede arrastrarse si esta vista previa no tiene choques
        api.confirmarImportCfg(); api.__mk('#cfgConfSob').checked = false;
        ok('importar: sin choques solo agrega (el radio ausente equivale a ignorar)', api.__ev('AJ_HORARIO').length === snap.length + 1 && api.__ev('AJ_HORARIO')[0].turno === 'T_MEDIO');
        restaurar();

        // de punta a punta: por omision (sin tocar nada) se ignora
        const turnoDe = () => { const r = fila(api.__ev('RESULT'), '9701', '2026-09-14'); return r ? r.turno : null; };
        const archivo = J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [Xn, N1] });
        const Rant = api.__ev('RESULT');
        api.abrirImportCfg(archivo, 'c.json');
        api.confirmarImportCfg();
        const L1 = api.__ev('AJ_HORARIO'), ls1 = JSON.parse(global.localStorage.getItem('mb_ajustes_horario'));
        ok('importar de punta a punta, opcion por omision: se conserva el actual (T_MEDIO), solo se agrega el nuevo y el toast no habla de sobrescritos',
          L1.length === snap.length + 1 && L1[0].turno === 'T_MEDIO' && L1[0].nota === 'orig' && L1.some(a => a.id === N1.id) && ls1.length === L1.length && ls1[0].turno === 'T_MEDIO' && api.__mk('#toast').textContent === 'Configuración importada.');
        restaurar();
        api.__mk('#cfgConfIgn').checked = true; api.__mk('#cfgConfSob').checked = false;
        api.abrirImportCfg(archivo, 'c.json'); api.confirmarImportCfg();
        ok('importar con «ignorar» elegido: igual que la omision', api.__ev('AJ_HORARIO')[0].turno === 'T_MEDIO' && api.__ev('AJ_HORARIO').length === snap.length + 1);
        restaurar();
        // sobrescribir
        api.runCalc();
        const antesT = turnoDe(), Rantes2 = api.__ev('RESULT');
        api.abrirImportCfg(archivo, 'c.json');
        api.__mk('#cfgConfSob').checked = true; api.__mk('#cfgConfIgn').checked = false;
        api.confirmarImportCfg();
        const L2 = api.__ev('AJ_HORARIO'), ls2 = JSON.parse(global.localStorage.getItem('mb_ajustes_horario'));
        ok('importar con «sobrescribir»: el actual se reemplaza en su posicion por el del archivo, el nuevo se agrega al final y nada se pierde ni se duplica',
          L2.length === snap.length + 1 && L2[0].id === X.id && L2[0].turno === 'T_TARDE' && L2[0].nota === 'nueva' && L2[0].autor === 'Pedro' && L2[L2.length - 1].id === N1.id && L2.slice(1, -1).every((a, i) => a === snap[i + 1]) && new Set(L2.map(a => a.id)).size === L2.length);
        ok('importar con «sobrescribir»: queda guardado en localStorage (ajPersistir) y el toast dice cuantos se sobrescribieron', J(ls2) === J(L2) && /Se sobrescribieron 1 ajuste\(s\) de horario/.test(api.__mk('#toast').textContent));
        ok('importar con «sobrescribir»: se recalcula con el ajuste del archivo (RESULT nuevo y el dia 14 pasa a T_TARDE)', api.__ev('RESULT') !== Rantes2 && antesT === 'T_MEDIO' && turnoDe() === 'T_TARDE', antesT + ' -> ' + turnoDe());
        api.__mk('#cfgConfSob').checked = false; api.__mk('#cfgConfIgn').checked = true;
        restaurar(); api.runCalc();
      }
      // fechas en el futuro
      const ahoraIso = d => api.ajAhora(new Date(Date.now() + d));
      const cfgConAj = a => api.configValidar(J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [a] }));
      ok('«creado» en el futuro (mas de 1 dia) es un error; ahora y unas horas adelante (relojes distintos) se toleran', !cfgConAj(A('9701', '2026-09-14', '2026-09-14', 'T_DIA', '2030-01-01T00:00:00')).ok && /futuro/.test(cfgConAj(A('9701', '2026-09-14', '2026-09-14', 'T_DIA', ahoraIso(2 * 864e5))).errores.join())
        && cfgConAj(A('9701', '2026-09-14', '2026-09-14', 'T_DIA', ahoraIso(0))).ok && cfgConAj(A('9701', '2026-09-14', '2026-09-14', 'T_DIA', ahoraIso(6 * 36e5))).ok);
      ok('«anulado.en» en el futuro es un error', !cfgConAj(A('9701', '2026-09-14', '2026-09-14', 'T_DIA', '2026-11-10T09:00:00', { anulado: { autor: 'a', en: '2030-01-01T00:00:00', motivo: 'm' } })).ok
        && /futuro/.test(cfgConAj(A('9701', '2026-09-14', '2026-09-14', 'T_DIA', '2026-11-10T09:00:00', { anulado: { autor: 'a', en: ahoraIso(3 * 864e5), motivo: 'm' } })).errores.join())
        && cfgConAj(A('9701', '2026-09-14', '2026-09-14', 'T_DIA', '2026-11-10T09:00:00', { anulado: { autor: 'a', en: '2026-11-11T09:00:00', motivo: 'm' } })).ok);
      {
        const fut = A('9701', '2026-09-14', '2026-09-14', 'T_MEDIO', '2030-01-01T00:00:00'), futAn = A('9702', '2026-09-14', '2026-09-14', 'T_DIA', '2026-11-10T09:00:00', { anulado: { autor: 'a', en: '2030-01-01T00:00:00', motivo: 'm' } });
        const aF = nuevo(html, { mb_ajustes_horario: J([fut, futAn, A('9703', '2026-09-14', '2026-09-14', 'T_DIA')]) });
        ok('guardado con fecha FUTURA (reloj mal): NO se marca ilegible: se conserva, se aplica y solo se avisa del reloj', aF.__ev('AJ_HORARIO.length') === 3 && aF.__ev('AJ_SIN_LEER.length') === 0 && aF.__ev('AJ_CARGA.relojFuturo') === 2
          && /2 ajuste\(s\) guardado\(s\) tienen fecha de creación o de anulación en el futuro/.test(aF.ajAvisosTxt()));
        aF.runCalc(); aF.__mk('#dlgAjustes').showModal = () => {}; aF.abrirAjustes();
        ok('...se aplica de verdad y el historial muestra el aviso del reloj', aF.shiftFor(aF.__ev('MODEL'), '9701', '2026-09-14').source === 'AJUSTE' && /reloj de este PC/.test(aF.__mk('#ajAviso').textContent) && aF.__mk('#ajAviso').hidden === false);
        ok('...y persistir no lo pierde ni lo reescribe distinto', (() => { aF.__ev('ajPersistir()'); const g = JSON.parse(global.localStorage.getItem('mb_ajustes_horario')); return g.length === 3 && g.some(x => x.id === fut.id && x.creado === '2030-01-01T00:00:00'); })());
        ok('la regla del futuro SIGUE valiendo para el archivo de configuracion y para el dialogo', !aF.configValidar(J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [fut] })).ok && aF.ajNormalizar(fut).errores.length === 1 && aF.ajNormalizar(fut, { futuro: true }).errores.length === 0);
      }
      // copias del almacenamiento ilegible: nunca se pisa la primera
      {
        const a2 = nuevo(html, { mb_ajustes_horario: '{segundo', mb_ajustes_horario_ilegible: '{primero' });
        ok('ilegible otra vez: la primera copia NO se pisa y la segunda va a _2', global.localStorage.getItem('mb_ajustes_horario_ilegible') === '{primero' && global.localStorage.getItem('mb_ajustes_horario_ilegible_2') === '{segundo');
        const a3 = nuevo(html, { mb_ajustes_horario: '{tercero', mb_ajustes_horario_ilegible: '{primero', mb_ajustes_horario_ilegible_2: '{segundo' });
        ok('y la tercera a _3 (nunca se pierde ninguna)', global.localStorage.getItem('mb_ajustes_horario_ilegible') === '{primero' && global.localStorage.getItem('mb_ajustes_horario_ilegible_2') === '{segundo' && global.localStorage.getItem('mb_ajustes_horario_ilegible_3') === '{tercero');
        const a4 = nuevo(html, { mb_ajustes_horario: '{primero', mb_ajustes_horario_ilegible: '{primero' });
        ok('el mismo valor ilegible cargado dos veces no crea copias repetidas', global.localStorage.getItem('mb_ajustes_horario_ilegible_2') === null && a4.__ev('AJ_CARGA.ilegible') === true);
      }
      // lo que no se pudo leer NO se pierde
      const bueno = A('9701', '2026-09-14', '2026-09-14', 'T_MEDIO'), raros = [{ x: 1 }, 'texto', null, { ...bueno, id: 'aj-malo', motivo: 'NO' }, { ...bueno }];     // ultimo: id repetido
      const a10 = nuevo(html, { mb_ajustes_horario: J([bueno, ...raros]) });
      ok('no se pierde nada: las entradas ilegibles y el id repetido quedan en AJ_SIN_LEER y solo la valida en AJ_HORARIO', a10.__ev('AJ_HORARIO.length') === 1 && a10.__ev('AJ_SIN_LEER.length') === 5 && a10.__errores.length === 0);
      a10.runCalc(); a10.__ev('AJ_HORARIO').push(A('9701', '2026-09-15', '2026-09-15', 'T_DIA')); a10.__ev('ajPersistir()');
      const guardado = JSON.parse(global.localStorage.getItem('mb_ajustes_horario'));
      ok('al persistir un ajuste nuevo las entradas ilegibles se reescriben TAL CUAL (sin perdida silenciosa)', guardado.length === 7 && eq(guardado.slice(2), raros));
      a10.__mk('#dlgAjustes').showModal = () => {}; a10.abrirAjustes();
      ok('el historial avisa cuantas entradas no se pudieron leer y que se conservan', /5 entrada\(s\)[^]*se conservan sin tocar/.test(a10.__mk('#ajAviso').textContent) && a10.__mk('#ajAviso').hidden === false);
      const a11 = nuevo(html, { mb_ajustes_horario: '{esto no es json' });
      ok('un almacenamiento ilegible (ni lista) se copia a mb_ajustes_horario_ilegible antes de que nada lo pise y se avisa', a11.__ev('AJ_HORARIO.length') === 0 && global.localStorage.getItem('mb_ajustes_horario_ilegible') === '{esto no es json' && /ilegible/.test(a11.ajAvisosTxt()));
      a11.__ev('AJ_HORARIO').push(A('9701', '2026-09-15', '2026-09-15', 'T_DIA')); a11.__ev('ajPersistir()');
      ok('...y sigue ahi aunque se guarde un ajuste nuevo', global.localStorage.getItem('mb_ajustes_horario_ilegible') === '{esto no es json' && JSON.parse(global.localStorage.getItem('mb_ajustes_horario')).length === 1);
      // migracion: lo que no migra se conserva
      const a12 = nuevo(html, { mb_overrides: J({ '9701|2026-09-14': 'T_MEDIO', '9701|mal': 'T_DIA', '9702|2026-09-16': 5, '9703|2026-02-30': 'T_DIA' }) });
      ok('migracion: lo que no se pudo migrar queda SOLO en mb_overrides_sin_migrar (con su valor) y mb_overrides se borra al final', a12.__ev('AJ_HORARIO.length') === 1 && global.localStorage.getItem('mb_overrides') === null
        && eq(JSON.parse(global.localStorage.getItem('mb_overrides_sin_migrar')), { '9701|mal': 'T_DIA', '9702|2026-09-16': 5, '9703|2026-02-30': 'T_DIA' }));
      a12.__mk('#dlgAjustes').showModal = () => {}; a12.abrirAjustes();
      ok('migracion: el historial dice cuantos cambios antiguos no se migraron y donde quedan', /3 cambio\(s\) puntual\(es\) antiguos no se pudieron migrar[^]*mb_overrides_sin_migrar/.test(a12.__mk('#ajAviso').textContent));
      const a13 = nuevo(html, { mb_overrides_sin_migrar: J({ '9701|mal': 'T_DIA' }), mb_overrides: J({ '9701|2026-09-14': 'T_MEDIO', '9702|otro': 'x' }) });
      ok('migracion: un mb_overrides_sin_migrar previo se conserva y se suma', eq(JSON.parse(global.localStorage.getItem('mb_overrides_sin_migrar')), { '9701|mal': 'T_DIA', '9702|otro': 'x' }) && a13.ajAvisosTxt().includes('2 cambio'));
      const a14 = nuevo(html, { mb_overrides: '{no es json' });
      ok('migracion: un mb_overrides que ni es JSON NO se borra (se deja sin tocar) y se avisa', global.localStorage.getItem('mb_overrides') === '{no es json' && a14.__ev('AJ_HORARIO.length') === 0 && /mb_overrides/.test(a14.ajAvisosTxt()));
      const a15 = nuevo(html);
      ok('sin nada guardado no hay avisos ni llaves nuevas', a15.ajAvisosTxt() === '' && global.localStorage.getItem('mb_overrides_sin_migrar') === null && global.localStorage.getItem('mb_ajustes_horario_ilegible') === null);
    }

    /* 7. el RRHH/completo pintan lo mismo (se compara luego entre archivos) */
    api = nuevo(html); api.runCalc();
    poner(api, aA, aB, aC, aD1, aD2, aD3, aE1, aE2, aF1, aF2); api.runCalc(); api.__ev("CUR_EMP='9704'"); api.renderDet(); api.__set('selEmpCal', '9704'); api.__set('selMes', '2026-09'); api.renderCal(); api.renderAjustes();
    SALIDA[nombre] = J([api.__mk('#tDet tbody').innerHTML, api.__mk('#kpiDet').innerHTML, api.__mk('#calGrid').innerHTML, api.__mk('#tAjustes tbody').innerHTML, api.aoaDet(api.__ev('RESULT').byEmp.get('9704')), api.aoaAjustes(null), api.__ev('RESULT').exc.filter(x => x.code === 'AJ-H')]).replace(/aj-t-\d+/g, 'aj-t-N');
    ok('sin errores de consola al pintar todo', api.__errores.length === 0, api.__errores.slice(0, 1).join(''));
    ok(`la herramienta ${esFull ? 'completa tiene' : 'RRHH no tiene'} la pestana Excepciones, y el chip AJ-H no revienta en ninguna`, api.__fuente.includes('id="tab-exc"') === esFull);
    ok('opciones del motivo del HTML == AJ_MOTIVOS', J([...api.__fuente.match(/<select id="ajMotivo">[^]*?<\/select>/)[0].matchAll(/value="([A-Z_]+)"/g)].map(m => m[1])) === J(Object.keys(api.__ev('AJ_MOTIVOS'))));
  }
  ok('los dos archivos pintan EXACTAMENTE lo mismo (Detalle, tarjeta, Calendario, historial, Excel, excepciones)', SALIDA.COMPLETO === SALIDA.RRHH && !!SALIDA.COMPLETO);

  /* tiempos: ~1.000 personas */
  {
    const api = cargar(FILES.COMPLETO, { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' } });
    const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
    const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en'], ['T_DIA', 'T_DIA', '1', '07:00:00', '15:00:00', ...fl(LAB), '', '0', ''], ['T_MEDIO', 'T_MEDIO', '1', '10:00:00', '18:00:00', ...fl(LAB), '', '0', '']];
    const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
    const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
    const N = 1000, dias = habil(1, 30);
    for (let i = 0; i < N; i++) {
      const id = String(80000 + i);
      emp.push([id, 'P', 'T' + id, '2020-01-01', 'DEPTO ' + (i % 20), 'PLASTITECSA', 'CARGO', 'Habilitado']);
      hor.push([id, 'P', 'T' + id, 'T_DIA', 'T_DIA', '2026-08-01', '2026-12-31']);
      dias.forEach(iso => { mar.push([id, 'P', 'T', 'PLASTITECSA', 'D', 'C', f2(iso), '07:00', '255', 'Dispositivo-PORTERIA PLANTA 1']); mar.push([id, 'P', 'T', 'PLASTITECSA', 'D', 'C', f2(iso), '15:' + pad(i % 40), '255', 'Dispositivo-PORTERIA PLANTA 1']); });
    }
    api.DATA.emp = api.__leer(emp); api.DATA.tur = api.__leer(tur); api.DATA.hor = api.__leer(hor); api.DATA.mar = api.__leer(mar); api.DATA.ren = null; api.DATA.lac = null;
    const cron = f => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };
    // el calculo directo (sin pintar las pestañas): es lo que mide el costo del motor
    const calc = () => { const M = api.buildModel(), c = api.readConfig(); api.marcarIngresosMasivos(M, c); api.marcarRetirosMasivos(M, c); return [M, c, api.compute(M, c)]; };
    const sin = cron(() => { calc(); });
    const cfgG = api.readConfig();
    const L = api.__ev('AJ_HORARIO');
    for (let i = 0; i < N; i += 10) L.push(A(String(80000 + i), '2026-09-14', '2026-09-18', 'T_MEDIO'));          // 100 personas (10%)
    let K10; const con10 = cron(() => { K10 = calc(); });
    const base10 = cron(() => api.computeBase(K10[0], cfgG));
    for (let i = 1; i < N; i++) if (i % 10) L.push(A(String(80000 + i), '2026-09-14', '2026-09-18', 'T_MEDIO'));    // las 1.000
    let KT; const conTodos = cron(() => { KT = calc(); });
    const baseTodos = cron(() => api.computeBase(KT[0], cfgG));
    console.log(`TIEMPOS ${N} personas x ${dias.length} dias: runCalc sin ajustes ${sin.toFixed(0)} ms · con ajustes en 100 personas ${con10.toFixed(0)} ms (computeBase solo: ${base10.toFixed(0)} ms) · con ajustes en las ${N} ${conTodos.toFixed(0)} ms (computeBase solo: ${baseTodos.toFixed(0)} ms)`);
    ok('computeBase para el 10% de las personas cuesta una fraccion del calculo completo', base10 < sin * 0.5, `${base10.toFixed(0)} ms vs ${sin.toFixed(0)} ms`);
    ok('con ajustes en 100 personas el recalculo no se duplica (~+10%)', con10 < sin * 1.6, `${con10.toFixed(0)} ms vs ${sin.toFixed(0)} ms`);
    ok('con ajustes en las 1.000 personas (peor caso) el cálculo no pasa de ~2.5x', conTodos < sin * 3, `${conTodos.toFixed(0)} ms vs ${sin.toFixed(0)} ms`);
  }

  console.log(fallos ? 'FALLOS: ' + fallos : 'AJUSTES OK');
  process.exit(fallos ? 1 : 0);
}
const SALIDA = {};
main().catch(e => { process.stdout.write('EXCEPCION ' + (e && e.stack) + String.fromCharCode(10)); process.exit(1); });
