'use strict';
// Shared test harness: runs the REAL engine of an html file in Node with a DOM mock that
// returns null for ids the file does not declare (CLAUDE.md, "Como validar un cambio").
const fs = require('fs'), path = require('path');
// Raiz del repositorio: este archivo vive en scripts/pruebas_motor/
const REPO = path.resolve(__dirname, '..', '..') + path.sep;
const FILES = { COMPLETO: REPO + 'reporte-horas.html', RRHH: REPO + 'reporte-horas-rrhh.html' };

function cargar(htmlPath, opciones = {}) {
  const fuente = fs.readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n');
  const src = fuente.match(/<script>\s*"use strict";([\s\S]*?)<\/script>/)[1];
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
  Object.assign(defaults, opciones.inputs ? Object.fromEntries(Object.entries(opciones.inputs).map(([k, v]) => [k, { value: v }])) : {});
  const el = {};
  const errores = [];
  const descargas = [];
  const mk = s => {
    if (!el[s]) {
      const id = /^#([\w-]+)$/.exec(s);
      const d = (id && defaults[id[1]]) || {};
      el[s] = { value: d.value || '', checked: !!d.checked, dataset: {}, innerHTML: '', textContent: '', hidden: false, style: {},
        files: [], disabled: false, showModal() {}, close() {}, addEventListener() {}, appendChild() {}, before() {}, click() {}, remove() {}, scrollIntoView() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 0, width: 0, height: 0 }) };
    }
    return el[s];
  };
  const existe = s => { const id = /^#([\w-]+)/.exec(s.trim()); return id ? fuente.includes(`id="${id[1]}"`) : true; };
  global.window = global; global.scrollTo = () => {}; global.addEventListener = () => {};
  const escuchas = {};
  global.document = { addEventListener(ev, fn) { (escuchas[ev] = escuchas[ev] || []).push(fn); }, createElement: () => mk('x' + Math.random()),
    querySelector: s => existe(s) ? mk(s.trim()) : null, querySelectorAll: () => [],
    getElementById: i => fuente.includes(`id="${i}"`) ? mk('#' + i) : null,
    body: { classList: { add() {}, remove() {} }, dataset: {} } };
  const store = {};
  global.localStorage = { getItem: k => store[k] ?? null, setItem(k, v) { store[k] = v; } };
  global.Blob = function (p) { this.p = p; }; global.URL = { createObjectURL: () => 'b', revokeObjectURL() {} };
  global.confirm = () => true;
  global.console = { ...console, error: (...a) => errores.push(a.map(String).join(' ')) };
  let AOA = null;
  const escritos = [];
  global.XLSX = {
    read: () => ({ SheetNames: ['s'], Sheets: { s: {} } }),
    utils: { sheet_to_json: () => AOA, aoa_to_sheet: a => ({ aoa: a }), book_new: () => ({ sheets: [] }),
             book_append_sheet: (wb, ws, n) => wb.sheets.push({ n, aoa: ws.aoa }) },
    writeFile: (wb, name) => escritos.push({ name, wb }),
  };
  const nombres = [...src.matchAll(/^(?:async )?function (\w+)/gm)].map(m => m[1]);
  const api = new Function(src + `;const __api={${nombres.join(',')}};__api.DATA=DATA;__api.__ev=s=>eval(s);return __api;`)();
  // lector de un aoa crudo por la capa real readSheet (con fila de titulo incluida)
  api.__leer = aoa => { AOA = aoa; return api.readSheet(null); };
  api.__escuchas = escuchas; api.__dom = () => (escuchas.DOMContentLoaded || []).forEach(f => f()); api.__errores = errores; api.__escritos = escritos; api.__mk = mk; api.__fuente = fuente; api.__defaults = defaults;
  api.__set = (id, v) => { mk('#' + id).value = v; };
  return api;
}

function invariantes(R) {
  let i1 = 0, i2 = 0, i3 = 0;
  R.byEmp.forEach(x => x.ciclo.forEach(r => {
    const T = r.tramos || [];
    if (Math.abs(T.reduce((s, t) => s + t.min, 0) - (r.creditMin || 0)) > 0.001) i1++;
    if (T.some((t, i) => T.some((u, j) => j > i && t.ini < u.fin && u.ini < t.fin))) i2++;
    if (Math.abs((r.ordMin || 0) + (r.extraMin || 0) - (r.creditMin || 0)) > 0.001) i3++;
  }));
  return { i1, i2, i3 };
}
module.exports = { cargar, invariantes, REPO, FILES };
