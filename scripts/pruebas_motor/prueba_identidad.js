'use strict';
// Compara cada funcion/constante del motor caracter a caracter entre los dos archivos
// (delimitando cada funcion por su primer "\n}\n", como pide CLAUDE.md) y verifica que ningun
// helper compartido se haya duplicado o perdido.
const fs = require('fs');
const { REPO } = require('./lib.js');
const lee = f => fs.readFileSync(REPO + f, 'utf8').replace(/\r\n/g, '\n');
const script = s => s.match(/<script>\s*"use strict";([\s\S]*?)<\/script>/)[1];
const A = script(lee('reporte-horas.html')), B = script(lee('reporte-horas-rrhh.html'));
function funciones(src) {
  const out = new Map(), dup = [];
  const re = /^(?:async )?function (\w+)\s*\(/gm; let m;
  while ((m = re.exec(src))) {
    const ini = m.index, fin = src.indexOf('\n}\n', ini);
    const cuerpo = src.slice(ini, fin + 3);
    if (out.has(m[1])) dup.push(m[1]);
    out.set(m[1], cuerpo);
  }
  return { out, dup };
}
const fa = funciones(A), fb = funciones(B);
let fallos = 0;
const ok = (n, c, extra = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!c) fallos++; };
ok('ninguna funcion declarada dos veces (completo)', fa.dup.length === 0, fa.dup.join(','));
ok('ninguna funcion declarada dos veces (rrhh)', fb.dup.length === 0, fb.dup.join(','));
const soloA = [...fa.out.keys()].filter(k => !fb.out.has(k)), soloB = [...fb.out.keys()].filter(k => !fa.out.has(k));
ok('funciones exclusivas del completo = [renderGlosario]', JSON.stringify(soloA) === '["renderGlosario"]', soloA.join(','));
ok('funciones exclusivas de rrhh = []', soloB.length === 0, soloB.join(','));
// excepciones PREEXISTENTES y esperadas: el bloque de rolEfectivo arrastra la linea de KPI_EXCL, que en rrhh esta antes; runCalc llama renderGlosario solo en el completo
const PREEXISTENTES = ['rolEfectivo', 'runCalc'];
const difieren = [...fa.out.keys()].filter(k => fb.out.has(k) && !PREEXISTENTES.includes(k) && fa.out.get(k) !== fb.out.get(k));
ok(`funciones compartidas byte a byte (${[...fa.out.keys()].filter(k => fb.out.has(k)).length})`, difieren.length === 0, difieren.join(','));
// constantes y estado del motor
const consts = ['CONCEPTS', 'CKEYS', 'DOW_ES', 'NOV', 'CONC_DESC', 'MATRIZ', 'LACT_ETAPAS', 'LACT_PATS', 'DATA', 'AS_LABEL', 'COLS_FIJAS', 'COLS_ASIS', 'ROLES', 'DOW_CAL', 'IND_UMBRAL', 'IND_RAMPA', 'IND_DIAS', 'IND_DIA_NOM', 'IND_METS', 'ALC_TABS', 'SIN_DEP', 'SIN_CARGO', 'COLS_CONS_DATOS', 'COLS_CONS_HORAS', 'COLS_CONS_OTROS'];
function bloque(src, n) {
  const m = new RegExp('^(?:const|let) ' + n + '\\b', 'm').exec(src); if (!m) return null;
  const rest = src.slice(m.index);
  const fin = rest.search(/;\s*\n(?=\S)/);
  return rest.slice(0, fin + 1);
}
consts.forEach(n => { const a = bloque(A, n), b = bloque(B, n); ok(`constante ${n} identica`, a !== null && a === b); });
// helpers compartidos presentes UNA vez
for (const h of ['$', '$$', 'esc', 'fmt', 'sevCls']) {
  const re = new RegExp('^const ' + h.replace(/\$/g, '\\$') + '\\s*=', 'gm');
  ok(`helper ${h} declarado una vez en cada archivo`, (A.match(re) || []).length === 1 && (B.match(re) || []).length === 1);
}
for (const h of ['tipHTML', 'chip', 'initPop']) ok(`helper ${h} una vez en cada archivo`, fa.out.has(h) && fb.out.has(h) && fa.dup.indexOf(h) < 0);
// removidas
for (const n of ['esLactancia', 'topeLactancia']) ok(`${n} eliminada de ambos`, !A.includes(n) && !B.includes(n));
ok('cLactPref / cLactMin / lactPref ya no existen en ningun archivo', !/cLactPref|cLactMin\b|lactPref|\blactMin\b/.test(lee('reporte-horas.html') + lee('reporte-horas-rrhh.html')));
// nuevas funciones presentes en ambos
const nuevas = ['fechaLact', 'idsConocidos', 'leerLactancia', 'faseLactancia', 'minLactancia', 'ubicarLactancia', 'textoLact', 'resumenLactancia',
  'validarLactCarga', 'htmlCargaLact', 'renderLactVal', 'abrirLactVal', 'renderLactBtn', 'lactChips', 'tagLact', 'cardLactDet', 'cardsLactCons', 'filaLactCons', 'lactCoincide', 'aoaLactancia', 'descargarPlantillaLact', 'hookLact',
  'fmtH', 'computeInd', 'indBarras', 'indEscala', 'indColPath', 'svgIndBarras', 'svgIndSemana', 'svgIndPareto', 'svgIndApilada', 'indTabla', 'indOpt', 'renderInd', 'indAbrir', 'indDiaLargo',
  'aoaIndRes', 'aoaInd', 'aoaIndEmp', 'aoaIndSem', 'aoaIndAlert', 'hookInd',
  'depKey', 'sinTurnoAsignado', 'alcanceOk', 'alcanceR', 'alcanceUnDepto', 'alcanceHay', 'alcanceInfo', 'alcanceLista', 'alcanceTexto', 'aoaAlcance',
  'alcSetCia', 'alcSetModoDep', 'alcToggleDep', 'alcAddPers', 'alcQuitarPers', 'alcSetModoPer', 'alcSetPerfil', 'alcSetVinc', 'alcSetSinTurno', 'alcLimpiar',
  'tabActiva', 'renderTab', 'alcCambio', 'alcResumen', 'alcPanel', 'alcSugerir', 'hookAlcance',
  'cargoDe', 'fillCargos', 'aplicarColsCons', 'renderColsCons',
  'calidadFiltrada', 'renderCalidad', 'aoaCalidad', 'aoaCalidadEmp', 'hookCalidad', 'estadoCob', 'cobFiltrado', 'cobCalc', 'renderCob', 'aoaCobertura', 'aoaCoberturaDep', 'hookCob'];
// retiradas con la pestaña KPI Cumplimiento: no deben quedar ni sus funciones ni sus elementos
for (const n of ['kpiCalcular', 'kpiPorDepto', 'kpiFiltrarEmpleados', 'svgKpiChart', 'renderKpi', 'renderCobertura', 'aoaKpiDep', 'aoaKpiEmp', 'KPI_EXCLUIDOS_ULTIMO', 'indFiltro', 'svgIndDispersion', 'renderCalidadEmp'])
  ok(`${n} retirada de ambos`, !new RegExp('\\b' + n + '\\b').test(A) && !new RegExp('\\b' + n + '\\b').test(B));
for (const n of ['tab-kpi', 'fCiaKpi', 'fExclDeptos', 'kpiChart', 'tKpiDep', 'tKpiEmp', 'fDeptoCob', 'fCiaCob', 'fCiaQ', 'fDeptoInd'])
  ok(`elemento ${n} retirado de los dos HTML`, !lee('reporte-horas.html').includes(n) && !lee('reporte-horas-rrhh.html').includes(n));
ok('KPI_EXCL se conserva (es la llave de las exclusiones guardadas)', /let KPI_EXCL = new Set\(JSON\.parse\(localStorage\.getItem\('mb_kpi_excl'\)/.test(A) && /let KPI_EXCL/.test(B));

nuevas.forEach(n => ok(`nueva funcion ${n} en ambos y identica`, fa.out.has(n) && fb.out.has(n) && fa.out.get(n) === fb.out.get(n)));
// sintaxis
for (const [n, s] of [['completo', A], ['rrhh', B]]) { try { new Function(s); ok(`sintaxis JS ${n}`, true); } catch (e) { ok(`sintaxis JS ${n}`, false, e.message); } }
// ids duplicados en el HTML
for (const f of ['reporte-horas.html', 'reporte-horas-rrhh.html']) {
  const ids = [...lee(f).matchAll(/\bid="([\w-]+)"/g)].map(m => m[1]); const vistos = new Set(), dup = [];
  ids.forEach(i => { if (vistos.has(i)) dup.push(i); vistos.add(i); });
  ok(`ids HTML unicos en ${f}`, dup.length === 0, dup.join(','));
  for (const i of ['fLac', 'btnLactPlantilla', 'btnLactVal', 'dlgLact', 'tLact', 'lactValResumen', 'btnLactValClose', 'fLact', 'cLactMin6', 'cLactMin24', 'fCargo', 'btnColsCons', 'dlgColsCons', 'colsConsBox', 'btnColsConsAll', 'btnColsConsClose', 'colConsStyle'])
    ok(`  ${i} declarado una vez en ${f}`, ids.filter(x => x === i).length === 1);
}
console.log(fallos ? 'FALLOS: ' + fallos : 'IDENTIDAD OK');
process.exit(fallos ? 1 : 0);
