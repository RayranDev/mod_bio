'use strict';
// Fuzz de leerLactancia() contra un oraculo independiente, en los DOS archivos. Datos 100% sinteticos.
// Regla que se comprueba (R3): una etapa es VALIDA si trae las dos fechas, ambas legibles y fin >= inicio.
// Una etapa invalida se ignora sola. Solo si las DOS son validas y Fin6 > Ini24 se ignora toda la fila.
const { cargar, FILES } = require('./lib.js');

let semilla = 20260615;
const rnd = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
const elige = a => a[Math.floor(rnd() * a.length)];
const serial = iso => { const [y, m, d] = iso.split('-').map(Number); return String((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5); };
const base = Date.UTC(2026, 0, 1);
const isoDe = n => new Date(base + n * 864e5).toISOString().slice(0, 10);
// valor de celda: vacio, fecha ISO, fecha DD/MM/AAAA, serial de Excel, basura o fecha imposible
const celda = () => {
  const r = rnd();
  if (r < 0.15) return '';
  const iso = isoDe(Math.floor(rnd() * 500));
  if (r < 0.60) return iso;
  if (r < 0.75) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  if (r < 0.88) return serial(iso);
  return elige(['abc', '31/02/2026', '2026-13-40', '0', '99999999']);
};

let fallos = 0;
const ok = (n, c, extra = '') => { if (!c) { fallos++; console.log('FALLA ' + n + ' ' + extra); } };
const N = 4000;
for (const [nombre, html] of Object.entries(FILES)) {
  const api = cargar(html);
  const filas = Array.from({ length: N }, (_, i) => ['F' + i, celda(), celda(), celda(), celda()]);
  const aoa = [['Lactancia'], ['ID_empleado', 'Inicio_lactancia_6m', 'Fin_lactancia_6m', 'Inicio_lactancia_24m', 'Fin_lactancia_24m'], ...filas];
  const o = global.XLSX.utils.sheet_to_json;
  global.XLSX.utils.sheet_to_json = () => aoa;
  const lac = api.readSheet(null, true);
  global.XLSX.utils.sheet_to_json = o;
  let L;
  try { L = api.leerLactancia(lac, new Set(filas.map(f => f[0]))); } catch (e) { ok(nombre + ' no lanza', false, e.message); continue; }
  ok(nombre + ' lee todas las filas', L.total === N, String(L.total));
  const hay = v => v !== '';
  let dentro = 0, rechazadasF = 0, soloUna = 0;
  filas.forEach(([id, i6, f6, i24, f24]) => {
    const fase = (a, b) => {
      if (!hay(a) && !hay(b)) return null;
      if (hay(a) !== hay(b)) return false;
      const x = api.fechaLact(a), y = api.fechaLact(b);
      return x && y && y >= x ? { ini: x, fin: y } : false;
    };
    const p6 = fase(i6, f6), p24 = fase(i24, f24);
    const exp = [];
    const ambas = p6 && p24;
    const rechazo = ambas && p6.fin > p24.ini;
    if (rechazo) rechazadasF++;
    if (!rechazo) { if (p6) exp.push('6M ' + p6.ini + '..' + p6.fin); if (p24) exp.push('24M ' + p24.ini + '..' + p24.fin); }
    if (exp.length === 1 && ((p6 === false) || (p24 === false) || (!p6 !== !p24))) soloUna++;
    const got = ((L.porId.get(id) || {}).fases || []).map(f => f.etapa + ' ' + f.ini + '..' + f.fin);
    if (JSON.stringify(got) !== JSON.stringify(exp)) ok(nombre + ' fila ' + id, false, JSON.stringify({ i6, f6, i24, f24, got, exp }));
    if (got.length) dentro++;
    // invariantes de lo aceptado
    const fs = (L.porId.get(id) || {}).fases || [];
    fs.forEach(f => ok(nombre + ' ' + id + ' ini<=fin', f.ini <= f.fin));
    if (fs.length === 2) ok(nombre + ' ' + id + ' Fin6<=Ini24', fs[0].fin <= fs[1].ini);
    // nunca se acumulan dos errores por la misma causa: una etapa invalida no dispara ademas la regla (f)
    const msgs = L.problemas.filter(p => p.id === id).map(p => p.msg);
    if (!rechazo) ok(nombre + ' ' + id + ' sin regla (f) si no hubo dos etapas validas', !msgs.some(m => /Se ignora toda la fila/.test(m)), msgs.join(' | '));
  });
  console.log(`${nombre}: ${N} filas, ${dentro} con alguna etapa valida, ${rechazadasF} rechazadas por Fin6 > Ini24, ${soloUna} con una sola etapa sobreviviente`);
  ok(nombre + ' hubo casos de cada tipo', rechazadasF > 20 && soloUna > 200 && dentro > 500);
}
console.log(fallos ? 'FALLOS: ' + fallos : 'FUZZ OK');
process.exit(fallos ? 1 : 0);
