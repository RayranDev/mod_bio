'use strict';
// Casos sinteticos de lactancia, en los DOS archivos. Datos 100% ficticios (ids 91xx, sin datos reales).
const { cargar, invariantes, FILES } = require('./lib.js');

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fl = lista => DIAS.map(d => lista.includes(d) ? 'True' : '');
const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };

// ── catalogo de turnos ficticios ──
const TURNOS = [
  // codigo, entrada, salida, dias, descanso(h), descontar en
  ['S_NOCHE_MA', '22:00:00', '06:00:00', ['Mar'], '0', ''],
  ['S_NOCHE_MAMI', '22:00:00', '06:00:00', ['Mar', 'Mié'], '0', ''],
  ['S_NOCHE_6D', '22:00:00', '06:00:00', ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], '0', ''],
  ['T_ADM_NOCHE', '22:00:00', '06:00:00', ['Mar'], '0', ''],
  ['T_EXTRA_N', '22:00:00', '06:00:00', ['Mar'], '0', ''],
  ['S_DOM', '06:00:00', '14:00:00', ['Dom'], '0', ''],
  ['S_LUN', '06:00:00', '14:00:00', ['Lun'], '0', ''],
  ['S_NOCHE_LUN', '22:00:00', '06:00:00', ['Lun'], '0', ''],
];

// casos: [id, turno, ficha lactancia (o null), marcas, opciones]
// marca = 'YYYY-MM-DD HH:MM' o 'YYYY-MM-DD HH:MM@ORIGEN'
const PORT = '@Dispositivo-PORTERIA PLANTA 1', VEST = '@Dispositivo-VESTIER HOMBRES';
const t = (iso, hm, o = PORT) => `${iso} ${hm}${o}`;
const L6 = ['2026-09-01', '2026-12-31', '', ''];       // lactancia 6M cubre todo el mes
const L24 = ['', '', '2026-09-01', '2026-12-31'];      // lactancia 24M
const N = '2026-09-15', N2 = '2026-09-16';              // martes noche / madrugada del miercoles
const CASOS = [
  // id, turno, lac, marcas, extra
  ['9101', 'S_NOCHE_MA', L6, [t(N, '22:00'), t(N2, '05:00')], { etq: 'N1 6M sale 1h antes (05:00)' }],
  ['9102', 'S_NOCHE_MA', L6, [t(N, '22:00'), t(N2, '02:00')], { etq: 'N2 6M sale a las 02:00' }],
  ['9103', 'S_NOCHE_MA', L6, [t(N, '23:00'), t(N2, '06:00')], { etq: 'N3 6M llega 1h tarde' }],
  ['9104', 'S_NOCHE_MA', L24, [t(N, '23:00'), t(N2, '06:00')], { etq: 'N4 24M llega 1h tarde' }],
  ['9105', 'S_NOCHE_MA', L6, [t(N, '22:00'), t(N2, '01:00'), t(N2, '02:00'), t(N2, '06:00')], { etq: 'N5 6M hueco 60 por porteria' }],
  ['9106', 'S_NOCHE_MA', L6, [t(N, '22:00'), t(N2, '00:00', VEST), t(N2, '01:20', VEST), t(N2, '06:00')], { etq: 'N6 6M hueco 80 vestier (cafe+lact)' }],
  ['9107', 'S_NOCHE_MA', L6, [t(N, '22:00'), t(N2, '00:00', VEST), t(N2, '02:00', VEST), t(N2, '06:00')], { etq: 'N7 6M hueco 120 vestier' }],
  ['9108', 'S_NOCHE_MA', L6, [t(N, '22:00'), t(N2, '05:30')], { etq: 'N8 6M toma solo 30 de 60' }],
  ['9109', 'S_NOCHE_MA', L6, [], { etq: 'N9 6M sin marcaciones' }],
  ['9110', 'S_NOCHE_MA', L6, [t(N, '22:00'), t(N2, '05:00')], { etq: 'N10 6M CONFIANZA', confianza: true }],
  ['9111', 'T_ADM_NOCHE', L6, [t(N, '22:00'), t(N2, '05:00')], { etq: 'N11 ADMINISTRATIVO 6M sale 05:00' }],
  ['9112', 'S_NOCHE_MA', null, [t(N, '22:00'), t(N2, '05:00')], { etq: 'N12 control: no esta en el archivo' }],
  ['9113', 'S_NOCHE_MA', L6, [t(N, '22:00'), t(N2, '06:00')], { etq: 'N13 6M trabaja completo' }],
  ['9114', 'S_NOCHE_MA', ['2026-01-01', '2026-06-30', '', ''], [t(N, '22:00'), t(N2, '05:00')], { etq: 'N14 etapa fuera de fechas' }],
  ['9115', 'S_NOCHE_MA', ['', '', '2026-09-01', '2026-12-31'], [t(N, '23:00'), t(N2, '06:00')], { etq: 'N15 solo 24M llega tarde' }],
  ['9116', 'T_EXTRA_N', L6, [t(N, '22:00'), t(N2, '04:00')], { etq: 'N16 turno T-EXTRA' }],
  // borde Fin6 == Inicio24 el martes 15: martes 6M, miercoles 24M
  ['9117', 'S_NOCHE_MAMI', ['2026-09-01', '2026-09-15', '2026-09-15', '2026-12-31'], [t(N, '23:00'), t(N2, '06:00'), t(N2, '23:00'), t('2026-09-17', '06:00')],
    { etq: 'B1 borde Fin6==Ini24: mar 6M, mie 24M', ok: true }],
  // domingo y festivo (turno de dia 06-14)
  ['9121', 'S_DOM', L6, [t('2026-09-20', '06:00'), t('2026-09-20', '13:00')], { etq: 'D1 domingo sale 13:00' }],
  ['9122', 'S_LUN', ['2026-08-01', '2026-12-31', '', ''], [t('2026-08-17', '06:00'), t('2026-08-17', '13:00')], { etq: 'D2 festivo (lun 17-ago) sale 13:00' }],
  ['9123', 'S_NOCHE_LUN', ['2026-08-01', '2026-12-31', '', ''], [t('2026-08-17', '22:00'), t('2026-08-18', '05:00')], { etq: 'D3 noche festivo->ordinario sale 05:00' }],
  // bolsa semanal: 6 noches lunes a sabado (semana arranca domingo 22:00)
  ['9131', 'S_NOCHE_6D', L6, ['14', '15', '16', '17', '18'].flatMap(d => [t(`2026-09-${d}`, '22:00'), t(`2026-09-${+d + 1}`, '06:00')]).concat([t('2026-09-19', '23:00'), t('2026-09-20', '06:00')]),
    { etq: 'B2 bolsa 6 noches; sabado llega 1h tarde (lact dentro de la bolsa)' }],
  ['9132', 'S_NOCHE_6D', L6, ['14', '15', '16', '17', '18'].flatMap(d => [t(`2026-09-${d}`, '22:00'), t(`2026-09-${+d + 1}`, '06:00')]).concat([t('2026-09-19', '22:00'), t('2026-09-20', '05:00')]),
    { etq: 'B3 bolsa 6 noches; sabado sale 05:00 (lact tras agotar la bolsa)' }],
];
// administrativo con sobretiempo: llega 1h tarde (lact) y se queda 1h despues del fin
CASOS.push(['9141', 'T_ADM_NOCHE', L6, [t(N, '23:00'), t(N2, '07:00')], { etq: 'B4 ADMIN llega 1h tarde y se queda 1h extra' }]);
CASOS.push(['9142', 'S_NOCHE_MA', L6, [t(N, '23:00'), t(N2, '07:00')], { etq: 'B5 ROTATIVO llega 1h tarde y se queda 1h extra' }]);
// W1: una etapa incompleta o al reves se ignora SOLA; la otra etapa valida sobrevive
CASOS.push(['9151', 'S_NOCHE_MA', ['2026-09-01', '2026-12-31', '2026-08-15', ''], [t(N, '22:00'), t(N2, '05:00')], { etq: 'W1a 6M valida + 24M solo con inicio (anterior a Fin6)' }]);
CASOS.push(['9152', 'S_NOCHE_MA', ['2026-09-01', '2026-12-31', '2026-10-01', '2026-09-02'], [t(N, '22:00'), t(N2, '05:00')], { etq: 'W1b 6M valida + 24M con fin anterior al inicio' }]);
CASOS.push(['9153', 'S_NOCHE_MA', ['2026-09-01', '2026-12-31', '2026-09-20', '2027-03-01'], [t(N, '22:00'), t(N2, '05:00')], { etq: 'W1c 6M y 24M validas con Fin6 > Ini24: fila ignorada' }]);
CASOS.push(['9154', 'S_NOCHE_MA', ['2026-12-31', '2026-09-01', '2026-09-01', '2026-12-31'], [t(N, '22:00'), t(N2, '05:00')], { etq: 'W1d 6M al reves + 24M valida: sobrevive la 24M' }]);

function construir(conLact) {
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  TURNOS.forEach(([c, e, s, d, desc, en]) => tur.push([c, c, '1', e, s, ...fl(d), '', desc, en]));
  const lac = [['Lactancia'], ['ID_empleado', 'Inicio_lactancia_6m', 'Fin_lactancia_6m', 'Inicio_lactancia_24m', 'Fin_lactancia_24m']];
  CASOS.forEach(([id, turno, l, marcas]) => {
    emp.push([id, 'PRUEBA', 'CASO' + id, '2020-01-01', 'DEPTO PRUEBA', 'PLASTITECSA', 'CARGO PRUEBA', 'Habilitado']);
    hor.push([id, 'PRUEBA', 'CASO' + id, turno, turno, '2026-08-01', '2026-12-31']);
    marcas.forEach(m => {
      const [fh, org] = m.split('@'); const [iso, hm] = fh.split(' ');
      mar.push([id, 'PRUEBA', 'CASO' + id, 'PLASTITECSA', 'DEPTO PRUEBA', 'CARGO PRUEBA', f2(iso), hm, '255', org || 'Dispositivo-PORTERIA PLANTA 1']);
    });
    if (l) lac.push([id, ...l]);
  });
  return { emp, tur, hor, mar, ren: null, lac: conLact ? lac : null };
}

// lectura del archivo de lactancia por la capa real, con conFila (fila de hoja)
function leerLac(api, aoa) {
  const orig = global.XLSX.utils.sheet_to_json;
  global.XLSX.utils.sheet_to_json = () => aoa;
  const r = api.readSheet(null, true);
  global.XLSX.utils.sheet_to_json = orig;
  return r;
}

const cicloIni = '2026-08-10', cicloFin = '2026-09-20';
function ejecutar(html, conLact) {
  const api = cargar(html, { inputs: { cIni: cicloIni, cFin: cicloFin } });
  const D = construir(conLact);
  api.DATA.emp = api.__leer(D.emp); api.DATA.tur = api.__leer(D.tur); api.DATA.hor = api.__leer(D.hor); api.DATA.mar = api.__leer(D.mar);
  api.DATA.ren = null;
  api.DATA.lac = D.lac ? leerLac(api, D.lac) : null;
  api.__set('cIni', cicloIni); api.__set('cFin', cicloFin);
  CASOS.filter(c => c[4].confianza).forEach(c => api.__ev('CONFIANZA').add(c[0]));
  api.runCalc();
  return { api, R: api.__ev('RESULT'), M: api.__ev('MODEL') };
}

const out = {};
let fallos = 0;
const h = n => +(n / 60).toFixed(2);
for (const [nombre, html] of Object.entries(FILES)) {
  const con = ejecutar(html, true), sin = ejecutar(html, false);
  if (con.api.__errores.length || sin.api.__errores.length) { console.log(nombre, 'ERRORES', con.api.__errores.concat(sin.api.__errores)); fallos++; }
  const inv = invariantes(con.R), inv2 = invariantes(sin.R);
  console.log(`${nombre}: invariantes con lactancia I01/02/03=${inv.i1}/${inv.i2}/${inv.i3}; sin lactancia=${inv2.i1}/${inv2.i2}/${inv2.i3}`);
  if (inv.i1 + inv.i2 + inv.i3 + inv2.i1 + inv2.i2 + inv2.i3) fallos++;
  const fila = (X, id, iso) => (X.R.byEmp.get(id) || { rows: [] }).rows.find(r => r.iso === iso);
  const concs = r => Object.fromEntries(Object.entries(r.conc).filter(([, v]) => v).map(([k, v]) => [k, v]));
  const filas = [];
  const dia = { '9117': N, '9121': '2026-09-20', '9122': '2026-08-17', '9123': '2026-08-17', '9131': '2026-09-19', '9132': '2026-09-19' };
  CASOS.forEach(([id, , , , x]) => {
    const iso = dia[id] || N;
    const a = fila(con, id, iso), b = fila(sin, id, iso);
    filas.push({ id, etq: x.etq, iso, a, b });
  });
  out[nombre] = { con, sin, filas, fila, concs };
}

// ── imprime y verifica ──
const esperado = {
  // id: funcion(a=con,b=sin) -> lista de [descripcion, ok]
  '9101': (a, b) => [['credito 60', a.lactPagadoMin === 60], ['pendiente 0 (control 60)', a.pendienteMin === 0 && b.pendienteMin === 60], ['etapa 6M', a.lactEtapa === '6M'], ['REC_N 7h (control 8h)', a.conc.REC_N === 7 && b.conc.REC_N === 8], ['ord 480', a.ordMin === 480 && b.ordMin === 480], ['extra 0', a.extraMin === 0]],
  '9102': (a, b) => [['credito 60', a.lactPagadoMin === 60], ['pendiente 180 (240-60)', a.pendienteMin === 180 && b.pendienteMin === 240], ['REC_N 7h', a.conc.REC_N === 7]],
  '9103': (a, b) => [['credito 60', a.lactPagadoMin === 60], ['pendiente 0', a.pendienteMin === 0 && b.pendienteMin === 60], ['REC_N 7h', a.conc.REC_N === 7]],
  '9104': (a, b) => [['credito 30 (24M)', a.lactPagadoMin === 30 && a.lactEtapa === '24M'], ['pendiente 30', a.pendienteMin === 30], ['REC_N 7.5h', a.conc.REC_N === 7.5]],
  '9105': (a, b) => [['credito 60 por hueco de porteria', a.lactPagadoMin === 60 && a.cafePagadoMin === 0], ['pendiente 0 (control 60)', a.pendienteMin === 0 && b.pendienteMin === 60], ['ausenciaMin 60', a.ausenciaMin === 60]],
  '9106': (a, b) => [['cafe 20 + lact 60', a.cafePagadoMin === 20 && a.lactPagadoMin === 60], ['pendiente 0 (control 60)', a.pendienteMin === 0 && b.pendienteMin === 60 && b.cafePagadoMin === 20]],
  '9107': (a, b) => [['cafe 20 + lact 60', a.cafePagadoMin === 20 && a.lactPagadoMin === 60], ['pendiente 40 (control 100)', a.pendienteMin === 40 && b.pendienteMin === 100]],
  '9108': (a, b) => [['credito 30 (solo lo que falto)', a.lactPagadoMin === 30], ['pendiente 0 (control 30)', a.pendienteMin === 0 && b.pendienteMin === 30], ['REC_N 7.5h', a.conc.REC_N === 7.5]],
  '9109': (a, b) => [['sin credito', a.lactPagadoMin === undefined || a.lactPagadoMin === 0 || a.lactPagadoMin == null], ['flag A-18', a.flags.includes('A-18')], ['etapa 6M conocida', a.lactEtapa === '6M']],
  '9110': (a, b) => [['CONFIANZA sin credito', (a.lactPagadoMin || 0) === 0 && a.pendienteMin === 0 && a.confianza === true]],
  '9111': (a, b) => [['admin credito 60', a.lactPagadoMin === 60], ['pendiente 0 (control 60)', a.pendienteMin === 0 && b.pendienteMin === 60], ['REC_N 7h (control 8)', a.conc.REC_N === 7 && b.conc.REC_N === 8]],
  '9112': (a, b) => [['no esta en el archivo: igual que control', JSON.stringify(a.conc) === JSON.stringify(b.conc) && a.pendienteMin === 60 && !a.lactEtapa]],
  '9113': (a, b) => [['trabaja completo: sin credito', (a.lactPagadoMin || 0) === 0], ['REC_N 8h', a.conc.REC_N === 8]],
  '9114': (a, b) => [['etapa fuera de fechas: sin credito', (a.lactPagadoMin || 0) === 0 && !a.lactEtapa && a.pendienteMin === 60]],
  '9115': (a, b) => [['24M solo: credito 30', a.lactPagadoMin === 30 && a.lactEtapa === '24M'], ['pendiente 30', a.pendienteMin === 30]],
  '9116': (a, b) => [['T-EXTRA sin credito', (a.lactPagadoMin || 0) === 0 && a.pendienteMin === 0 && a.turnoExtra === true]],
  '9117': (a, b) => [['martes 6M credito 60', a.lactEtapa === '6M' && a.lactPagadoMin === 60], ['miercoles 24M credito 30', true]],
  '9121': (a, b) => [['domingo credito 60', a.lactPagadoMin === 60], ['REC_F 7h (control 8h)', a.conc.REC_F === 7 && b.conc.REC_F === 8], ['ord 480', a.ordMin === 480]],
  '9122': (a, b) => [['festivo credito 60', a.lactPagadoMin === 60], ['REC_F 7h (control 8h)', a.conc.REC_F === 7 && b.conc.REC_F === 8]],
  '9123': (a, b) => [['noche festivo: REC_FN 2h', a.conc.REC_FN === 2], ['REC_N 5h (control 6h)', a.conc.REC_N === 5 && b.conc.REC_N === 6], ['control REC_FN 2', b.conc.REC_FN === 2], ['pendiente 0', a.pendienteMin === 0]],
  '9131': (a, b) => [['sabado credito 60', a.lactPagadoMin === 60], ['ord 120 / extra 360 igual que control', a.ordMin === b.ordMin && a.extraMin === b.extraMin && a.extraMin === 360], ['REC_N 1h (control 2h)', a.conc.REC_N === 1 && b.conc.REC_N === 2], ['x', a.conc.EXT_FN === 6 && b.conc.EXT_FN === 6]],
  '9132': (a, b) => [['sabado credito 60', a.lactPagadoMin === 60], ['lact cae en extra: clasifica como EXT_FN (domingo)', a.conc.EXT_FN === 6 && b.conc.EXT_FN === 6], ['REC_N igual que control', a.conc.REC_N === b.conc.REC_N && a.conc.REC_N === 2], ['pendiente 0 (control 60)', a.pendienteMin === 0 && b.pendienteMin === 60]],
  '9151': (a, b) => [['6M sobrevive: credito 60', a.lactPagadoMin === 60 && a.lactEtapa === '6M'], ['pendiente 0 (control 60)', a.pendienteMin === 0 && b.pendienteMin === 60]],
  '9152': (a, b) => [['6M sobrevive: credito 60', a.lactPagadoMin === 60 && a.lactEtapa === '6M'], ['pendiente 0 (control 60)', a.pendienteMin === 0 && b.pendienteMin === 60]],
  '9153': (a, b) => [['fila ignorada: sin credito', (a.lactPagadoMin || 0) === 0 && !a.lactEtapa], ['igual que el control', a.pendienteMin === 60 && JSON.stringify(a.conc) === JSON.stringify(b.conc)]],
  '9154': (a, b) => [['24M sobrevive: credito 30', a.lactPagadoMin === 30 && a.lactEtapa === '24M'], ['pendiente 30 (control 60)', a.pendienteMin === 30 && b.pendienteMin === 60]],
  '9141': (a, b) => [['admin credito 60', a.lactPagadoMin === 60], ['extra 60 igual que control', a.extraMin === 60 && b.extraMin === 60], ['ord 480 igual', a.ordMin === 480 && b.ordMin === 480], ['REC_N 7h (control 8h)', a.conc.REC_N === 7 && b.conc.REC_N === 8]],
  '9142': (a, b) => [['rotativo credito 60', a.lactPagadoMin === 60], ['extra 60 igual que control', a.extraMin === 60 && b.extraMin === 60], ['REC_N 7h (control 8h)', a.conc.REC_N === 7 && b.conc.REC_N === 8]],
};

for (const nombre of Object.keys(out)) {
  const { filas, con, sin, fila, concs } = out[nombre];
  console.log(`\n=== ${nombre} ===`);
  console.log('caso | credito | cafe | pend (ctrl) | etapa | conceptos con (h) | conceptos sin (h) | ord/extra | verificaciones');
  filas.forEach(({ id, etq, iso, a, b }) => {
    if (!a || !b) { console.log(id, etq, 'FILA AUSENTE'); fallos++; return; }
    const chk = esperado[id](a, b);
    // caso B1: tambien el miercoles
    if (id === '9117') {
      const a2 = fila(con, id, N2), b2 = fila(sin, id, N2);
      chk[1] = ['miercoles 24M credito 30', a2.lactEtapa === '24M' && a2.lactPagadoMin === 30 && b2.pendienteMin === 60];
    }
    const bad = chk.filter(([, ok]) => !ok);
    if (bad.length) fallos++;
    console.log(`${etq} | ${a.lactPagadoMin || 0} | ${a.cafePagadoMin || 0} | ${h(a.pendienteMin || 0)} (${h(b.pendienteMin || 0)}) | ${a.lactEtapa || '-'} | ${JSON.stringify(concs(a))} | ${JSON.stringify(concs(b))} | ${h(a.ordMin)}/${h(a.extraMin)} | ${bad.length ? 'FALLA: ' + bad.map(x => x[0]).join('; ') : chk.map(x => x[0]).join(', ') + ' -> OK'}`);
  });
  // la suma de TODOS los conceptos solo debe cambiar para quienes estan en el archivo
  const enArchivo = new Set(CASOS.filter(c => c[2]).map(c => c[0]));
  const sumaDe = (X, id) => Object.values(X.R.byEmp.get(id).rawMin).reduce((s, v) => s + v, 0);
  let cambios = 0, noEnArchivoCambia = 0;
  CASOS.forEach(([id]) => { const d = Math.abs(sumaDe(con, id) - sumaDe(sin, id)); if (d > 1e-9) { cambios++; if (!enArchivo.has(id)) noEnArchivoCambia++; } });
  console.log(`conceptos (minutos exactos) distintos entre con/sin archivo: ${cambios} empleados; de esos fuera del archivo: ${noEnArchivoCambia}`);
  if (noEnArchivoCambia) fallos++;
}
console.log(fallos ? '\nFALLOS: ' + fallos : '\nSINTETICOS OK');
process.exit(fallos ? 1 : 0);
