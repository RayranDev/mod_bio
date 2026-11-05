// Runs the real engine of reporte-horas.html in Node and classifies every employee-day.
// Usage: node motor_calendario.js <reporte-horas.html> <input.json> <output.json>
'use strict';
const fs = require('fs');
const [, , HTML, IN, OUT] = process.argv;
const entrada = JSON.parse(fs.readFileSync(IN, 'utf8'));
const { ini: INI, fin: FIN, archivos: CRUDO, vista: VISTA } = entrada;

const fuente = fs.readFileSync(HTML, 'utf8');
const src = fuente.match(/<script>\s*"use strict";([\s\S]*?)<\/script>/)[1];

// Form defaults straight from the HTML, so readConfig() sees what a user sees on a fresh load.
const defaults = {};
for (const m of fuente.matchAll(/<input\b[^>]*\bid="([\w-]+)"[^>]*>/g)) {
  const v = /\bvalue="([^"]*)"/.exec(m[0]);
  defaults[m[1]] = { value: v ? v[1] : '', checked: /\bchecked\b/.test(m[0]) };
}
for (const m of fuente.matchAll(/<select\b[^>]*\bid="([\w-]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
  const opts = [...m[2].matchAll(/<option\b([^>]*)>([^<]*)/g)].map(o => {
    const v = /\bvalue="([^"]*)"/.exec(o[1]);
    return { sel: /\bselected\b/.test(o[1]), v: v ? v[1] : o[2].trim() };
  });
  const o = opts.find(x => x.sel) || opts[0];
  defaults[m[1]] = { value: o ? o.v : '' };
}

const el = {};
const mk = s => {
  if (!el[s]) {
    const id = /^#([\w-]+)$/.exec(s);
    const d = (id && defaults[id[1]]) || {};
    el[s] = { value: d.value || '', checked: !!d.checked, dataset: {}, innerHTML: '', textContent: '', hidden: false, style: {},
      showModal() {}, close() {}, addEventListener() {}, appendChild() {}, before() {}, click() {}, remove() {}, scrollIntoView() {},
      classList: { add() {}, remove() {}, toggle() {} }, getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 0, width: 0, height: 0 }) };
  }
  return el[s];
};
// Undeclared ids return null, as in a browser: a permissive stub would hide missing elements.
const existe = s => { const id = /^#([\w-]+)/.exec(s.trim()); return id ? fuente.includes(`id="${id[1]}"`) : true; };
global.window = global; global.scrollTo = () => {}; global.addEventListener = () => {};
global.document = { addEventListener() {}, createElement: () => mk('x' + Math.random()),
  querySelector: s => existe(s) ? mk(s.trim()) : null, querySelectorAll: () => [],
  getElementById: i => fuente.includes(`id="${i}"`) ? mk('#' + i) : null,
  body: { classList: { add() {}, remove() {} }, dataset: {} } };
global.localStorage = { getItem: () => null, setItem() {} };
global.Blob = function () {}; global.URL = { createObjectURL: () => 'b', revokeObjectURL() {} };
let AOA = null;
global.XLSX = { read: () => ({ SheetNames: ['s'], Sheets: { s: {} } }), utils: { sheet_to_json: () => AOA } };

const api = new Function(src + `;return {readSheet,buildModel,compute,marcarIngresosMasivos,readConfig,segmentFor,DATA,
  setModel:m=>{MODEL=m;},setResult:r=>{RESULT=r;}};`)();

for (const k of ['emp', 'tur', 'hor', 'mar', 'ren']) {
  if (!CRUDO[k]) { api.DATA[k] = null; continue; }   // Renuncia is optional, as in the tool
  AOA = CRUDO[k];
  api.DATA[k] = api.readSheet(null);
}
const CFG = api.readConfig();
CFG.ini = INI; CFG.fin = FIN; CFG.corteOn = !!(CFG.corte && FIN >= CFG.corte);

const M = api.buildModel(); api.setModel(M); api.marcarIngresosMasivos(M, CFG);
const R = api.compute(M, CFG); api.setResult(R);

const vis = new Map(Object.entries(VISTA || {}).map(([id, dias]) => [id, new Map(Object.entries(dias))]));
const descTurno = cel => String(cel).split('-').slice(2).join('-').trim();
const hm = h => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const sig = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const marcas = r => String(r.marcas || '').trim().split(/\s+/).filter(h => /^\d\d:\d\d$/.test(h));
const DIAS = [];
for (let d = new Date(INI + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= FIN; d.setUTCDate(d.getUTCDate() + 1)) DIAS.push(d.toISOString().slice(0, 10));
const LIMITE_MADRUGADA = CFG.nocFin + 240;

const todas = [];
R.byEmp.forEach((x, id) => {
  const e = M.employees.get(id) || {};
  const vm = vis.get(id) || new Map();
  const fila = new Map(x.ciclo.map(r => [r.iso, r]));
  const masivo = M.ingresoMasivo && M.ingresoMasivo.has(e.ingreso);
  const fueraVig = iso => (e.ingreso && !masivo && iso < e.ingreso) || (e.vigFin && iso > e.vigFin);

  // Days worked without any shift: a day ending in an odd count with a night punch takes the
  // whole next early morning (breaks included); the parity of the full night decides good/bad.
  const sinT = new Map();
  DIAS.forEach(iso => {
    const r = fila.get(iso);
    if (!r || r.inCiclo === false || fueraVig(iso)) return;
    const P = marcas(r);
    if (!(r.turno && r.turno !== '—') && P.length) sinT.set(iso, { P: P.map(hm), txt: P.slice() });
  });
  [...sinT.keys()].sort().forEach(iso => {
    const d = sinT.get(iso), n = sinT.get(sig(iso));
    if (!d || !n) return;
    if (d.P.length % 2 === 1 && d.P[d.P.length - 1] >= CFG.nocIni && n.P[0] <= LIMITE_MADRUGADA) {
      const k = n.P.filter(p => p <= LIMITE_MADRUGADA).length;
      for (let i = 0; i < k; i++) { d.P.push(n.P[0] + 1440); d.txt.push(n.txt[0] + '(+1)'); n.P.shift(); n.txt.shift(); }
      if (!n.P.length) n.vacio = true;
    }
  });

  const cal = {};
  DIAS.forEach(iso => {
    const r = fila.get(iso), bt = vm.get(iso);
    if (fueraVig(iso)) { cal[iso] = { c: '·' }; return; }
    if (!r || r.inCiclo === false) { cal[iso] = bt ? { c: 'F', t: descTurno(bt), m: '' } : { c: '' }; return; }
    const f = r.flags || [];
    if (r.turno && r.turno !== '—') {
      const P = marcas(r);
      if (f.includes('A-18')) {
        // No punch inside the shift window but one at another hour: bad marking, not an absence.
        const otras = (M.punches.get(id) || []).filter(p => p.iso === iso && p.min >= 600).map(p => hhmm(p.min));
        cal[iso] = otras.length ? { c: 'M', t: r.turno, m: otras.join(' ') + ' (fuera del horario del turno)' } : { c: 'F', t: r.turno, m: '' };
        return;
      }
      // Night shift with no punch at night: the engine may pair next-morning punches as a late entry.
      const seg = api.segmentFor(M, r.turno, iso);
      if (seg && seg.cross && P.length && P.every(h => hm(h) < seg.ent - CFG.tolIni && hm(h) < 840)) {
        cal[iso] = { c: 'M', t: r.turno, m: P.join(' ') + ' (del día siguiente: sin marcación de entrada en la noche)' };
        return;
      }
      // computeCalidad counts a single punch (A-02) as clean; here it is bad marking.
      if (f.includes('A-02') || P.length % 2 === 1) { cal[iso] = { c: 'M', t: r.turno, m: P.join(' ') + ' (falta una marcación)' }; return; }
      const bloq = f.includes('A-17') || (f.includes('A-04') && !f.includes('SUGERIDO'));
      const sug = f.includes('SUGERIDO') || r.inferido;
      cal[iso] = { c: (bloq || sug) ? 'M' : 'A', t: r.turno, m: P.join(' ') };
      return;
    }
    const d = sinT.get(iso);
    if (!d || d.vacio) {
      cal[iso] = { c: bt ? 'F' : '', t: bt ? descTurno(bt) : '', m: d && d.vacio ? '(cierre de la noche anterior)' : '' };
      return;
    }
    let ok = d.P.length >= 2 && d.P.length % 2 === 0;
    for (let i = 0; i + 1 < d.P.length; i += 2) { const t = d.P[i + 1] - d.P[i]; if (t <= 0 || t > 960) ok = false; }
    const cubre = (M.sched.get(id) || []).some(a => a.ini <= iso && iso <= a.fin);
    // A shift in BioTime's resolved view counts even if the engine dropped it (complementary assignments).
    const c = bt ? (ok ? 'A' : 'M') : cubre ? 'D' : (ok ? 'S' : 'X');
    cal[iso] = { c, t: bt ? descTurno(bt) : '', m: d.txt.join(' ') };
  });
  const n = {};
  Object.values(cal).forEach(v => { n[v.c] = (n[v.c] || 0) + 1; });
  todas.push({ id, nombre: e.nombre || '', nombres: e.nombres || '', apellidos: e.apellidos || '', cia: e.empresa || '',
    depto: e.depto || '(sin departamento)', cargo: e.cargo || '', vinc: e.vinculo || 'ACTIVO', ingreso: e.ingreso || '', cal, n });
});

fs.writeFileSync(OUT, JSON.stringify({ dias: DIAS, todas, cfg: { nocIni: CFG.nocIni, nocFin: CFG.nocFin, tolIni: CFG.tolIni } }));
console.log(`Motor: ${todas.length} personas, ${DIAS.length} días (${INI} a ${FIN}).`);
