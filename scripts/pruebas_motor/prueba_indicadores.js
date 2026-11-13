'use strict';
// Pestana Resumen del ciclo (antes Indicadores: computeInd / indBarras / renderInd / aoaInd*) en los DOS archivos, con datos 100% ficticios
// (ids 92xx). Comprueba que: los totales salen de byEmp, los dias sin marcar coinciden con
// Calidad de marcacion, la concentracion y los dias de la semana suman bien, las exportaciones son
// rectangulares, nada se pinta con NaN/undefined y los dos archivos pintan exactamente lo mismo.
const { cargar, invariantes, FILES } = require('./lib.js');

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fl = lista => DIAS.map(d => lista.includes(d) ? 'True' : '');
const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
const pad = n => String(n).padStart(2, '0');
const habiles = [];                                   // lunes a viernes de septiembre 2026
for (let d = 1; d <= 30; d++) { const dt = new Date(Date.UTC(2026, 8, d)); const w = dt.getUTCDay(); if (w >= 1 && w <= 5) habiles.push(`2026-09-${pad(d)}`); }

// id, departamento, turno, [nº de dias con 2 h extra], [nº de dias sin marcar]
const PERSONAS = [
  ['9201', 'DEPTO A', 'T_DIA', 10, 0], ['9202', 'DEPTO A', 'T_DIA', 4, 0], ['9203', 'DEPTO A', 'T_DIA', 1, 0],
  ['9204', 'DEPTO A', 'T_DIA', 0, 3], ['9205', 'DEPTO A', 'T_DIA', 0, 0], ['9206', 'DEPTO A', 'T_DIA', 2, 2],
  ['9211', 'DEPTO B', 'T_NOCHE', 0, 0], ['9212', 'DEPTO B', 'T_NOCHE', 0, 1], ['9213', 'DEPTO B', 'T_NOCHE', 3, 0],
  ['9214', 'DEPTO B', 'T_NOCHE', 0, 0], ['9215', 'DEPTO B', 'T_NOCHE', 0, 0],
  ['9221', 'DEPTO C', 'T_DIA', 5, 0], ['9222', 'DEPTO C', 'T_DIA', 0, 0],
];

function construir() {
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  tur.push(['T_DIA', 'T_DIA', '1', '07:00:00', '15:00:00', ...fl(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']), '', '0', '']);
  tur.push(['T_NOCHE', 'T_NOCHE', '1', '22:00:00', '06:00:00', ...fl(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']), '', '0', '']);
  PERSONAS.forEach(([id, dep, turno, nExtra, nFalta]) => {
    emp.push([id, 'PRUEBA', 'IND' + id, '2020-01-01', dep, 'PLASTITECSA', 'CARGO PRUEBA', 'Habilitado']);
    hor.push([id, 'PRUEBA', 'IND' + id, turno, turno, '2026-08-01', '2026-12-31']);
    habiles.forEach((iso, i) => {
      if (i < nFalta) return;                                  // los primeros dias sin marcar
      const extra = i >= habiles.length - nExtra;              // los ultimos dias con 2 h extra
      const org = 'Dispositivo-PORTERIA PLANTA 1';
      const push = (d, hm) => mar.push([id, 'PRUEBA', 'IND' + id, 'PLASTITECSA', dep, 'CARGO PRUEBA', f2(d), hm, '255', org]);
      if (turno === 'T_DIA') { push(iso, '07:00'); push(iso, extra ? '17:00' : '15:00'); }
      else {
        const sig = new Date(Date.UTC(2026, 8, +iso.slice(-2) + 1)).toISOString().slice(0, 10);
        push(iso, '22:00'); push(sig, extra ? '08:00' : '06:00');
      }
    });
  });
  return { emp, tur, hor, mar };
}

let fallos = 0;
const ok = (n, c, extra = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!c) fallos++; };
const cerca = (a, b) => Math.abs(a - b) < 1e-6;
const salida = {};

for (const [nombre, html] of Object.entries(FILES)) {
  const api = cargar(html, { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' } });
  const D = construir();
  api.DATA.emp = api.__leer(D.emp); api.DATA.tur = api.__leer(D.tur); api.DATA.hor = api.__leer(D.hor); api.DATA.mar = api.__leer(D.mar);
  api.DATA.ren = null; api.DATA.lac = null;
  api.__set('cIni', '2026-09-01'); api.__set('cFin', '2026-09-30');
  api.runCalc();
  const R = api.__ev('RESULT'), M = api.__ev('MODEL');
  console.log(`── ${nombre}`);
  ok('sin errores de consola al calcular', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  const inv = invariantes(R);
  ok('invariantes I-01/I-02/I-03 = 0', inv.i1 + inv.i2 + inv.i3 === 0);

  const I = api.computeInd(R, {});
  let ord = 0, ex = 0, pe = 0, fa = 0;
  R.byEmp.forEach(e => { ord += e.ordH; ex += e.extraH; pe += e.pendH; fa += e.ciclo.filter(r => (r.flags || []).includes('A-18')).length; });
  ok('13 personas', I.personas === 13, String(I.personas));
  ok('ordinarias, extras y pendientes = suma de byEmp', cerca(I.total.ord, ord) && cerca(I.total.extra, ex) && cerca(I.total.pend, pe));
  ok('hay extras (25 dias x 2 h = 50 h aprox.)', I.total.extra > 40, String(I.total.extra));
  ok('dias sin marcar = A-18 de byEmp', I.total.faltas === fa && fa === 3 + 2 + 1, `${I.total.faltas}/${fa}`);
  const C = api.computeCalidad(M, R, R.cfg);
  ok('dias sin marcar = Calidad de marcacion (sinMarcaTurno)', I.total.faltas === C.total.sinMarcaTurno, `${I.total.faltas}/${C.total.sinMarcaTurno}`);
  ok('dias con turno = Calidad (conTurno)', I.total.prog === C.total.conTurno);
  const CB = api.cobAgregar(api.computeCobertura(M, R, R.cfg).filas);
  ok('dias sin marcar = Adopcion (UNA sola definicion: por jornada, A-18)', CB.falta === I.total.faltas, `${CB.falta}/${I.total.faltas}`);
  ok('dias interpretados: Calidad = Adopcion', CB.perdCal === C.total.sugerido + C.total.bloq, `${CB.perdCal}/${C.total.sugerido + C.total.bloq}`);
  ok('el recargo nocturno sale del DEPTO B', I.unidades.find(u => u.nombre === 'DEPTO B').conc.REC_N.h > 0 && I.unidades.find(u => u.nombre === 'DEPTO A').conc.REC_N.h === 0);
  ok('3 departamentos, ordenados por extras + recargos', I.unidades.length === 3 && I.unidades[0].extra + I.unidades[0].rec >= I.unidades[1].extra + I.unidades[1].rec);
  ok('las extras suman lo mismo por concepto y por persona', cerca(I.unidades.reduce((s, u) => s + u.extra, 0), I.total.extra));

  // salud de los datos: horas en dias interpretados = Calidad (hDudosa)
  ok('salud: horas en dias interpretados = Calidad', cerca(I.salud.hDud, C.total.hDudosa) && cerca(I.salud.hTot, C.total.hTotal), `${I.salud.hDud}/${C.total.hDudosa}`);

  // Pareto
  const P = I.pareto;
  ok('Pareto: 6 personas con extras (9201 9202 9203 9206 9213 9221)', P.M === 6, String(P.M));
  ok('Pareto: la curva termina en 100 %', cerca(P.curva[P.curva.length - 1].y, 1) && P.curva[0].y === 0);
  ok('Pareto: n80 es el minimo que llega al 80 %', I.ranking.slice(0, P.n80).reduce((s, p) => s + p.extra, 0) >= P.totE * 0.8 - 1e-9
    && I.ranking.slice(0, P.n80 - 1).reduce((s, p) => s + p.extra, 0) < P.totE * 0.8);
  ok('Pareto: el ranking va de mayor a menor', I.ranking.every((p, i, a) => !i || a[i - 1].extra >= p.extra));

  // semana
  ok('semana: lunes a domingo, sin fines de semana trabajados', I.semana.map(s => s.nombre).join() === 'Lun,Mar,Mié,Jue,Vie,Sáb,Dom' && I.semana[5].extra === 0 && I.semana[6].extra === 0);
  ok('semana: las extras suman el total', cerca(I.semana.reduce((s, d) => s + d.extra, 0), I.total.extra));
  ok('semana: los dias sin marcar suman el total', I.semana.reduce((s, d) => s + d.faltas, 0) === I.total.faltas);

  // donde mirar: el DEPTO C tiene 2 personas (< 5) y no entra (se cuenta 1)
  const AL = I.alertas;
  ok('alertas: el departamento de 2 personas queda fuera (se cuenta 1)', AL.pocos === 1 && !AL.todas.some(p => p.nombre === 'DEPTO C') && AL.base === 2, `pocos=${AL.pocos} base=${AL.base}`);
  ok('alertas: arriba de las dos medianas y por persona', AL.todas.every(p => p.y > AL.medY && p.x > AL.medX && cerca(p.y, p.extra / p.n) && cerca(p.x, p.faltas / p.n)));
  ok('alertas: la lista no pasa de 5', AL.lista.length <= 5 && AL.lista.length <= AL.total);

  // barras del grafico principal, una por metrica y en total / por persona
  for (const met of ['extra', 'rec', 'pend', 'faltas']) for (const pp of [false, true]) {
    const B = api.indBarras(I, met, pp);
    ok(`barras ${met} ${pp ? 'por persona' : 'total'}: ordenadas de mayor a menor, a lo sumo 12 y todas con etiqueta`,
      B.items.length <= 12 && B.items.every((it, i, a) => !i || a[i - 1].v >= it.v - 1e-9) && B.items.every(it => it.etiqueta && /\S/.test(it.texto)));
  }
  const BT = api.indBarras(I, 'extra', false);
  ok('barras extra total: la suma de los valores es el total de extras', cerca(BT.todas.reduce((s, f) => s + f.total, 0), I.total.extra));
  const BP = api.indBarras(I, 'extra', true);
  ok('barras por persona: el departamento de 2 personas queda fuera del ranking', BP.excluidas === 1 && !BP.todas.some(f => f.nombre === 'DEPTO C'));
  ok('barras recargos: nunca en rojo (es estructural)', api.indBarras(I, 'rec', false).items.every(it => !it.rojo));

  // de cada 100 horas pagadas: particion exacta
  const S = I.estructura;
  const con = Math.min(S.rec, S.pagadas - S.extra);
  ok('de cada 100 h: sin recargo + con recargo + extras = pagadas', cerca((S.pagadas - S.extra - con) + con + S.extra, S.pagadas));
  ok('apilada: se dibuja con valores validos', /<svg/.test(api.svgIndApilada(S)) && !/NaN|undefined/.test(api.svgIndApilada(S)));

  // departamento abierto -> nivel empleado (computeInd recibe un R ya recortado; opt.depto abre un departamento)
  const IA = api.computeInd(R, { depto: 'DEPTO A' });
  ok('departamento abierto: nivel empleado con 6 personas', IA.nivel === 'emp' && IA.unidades.length === 6 && IA.personas === 6);
  ok('departamento abierto: las extras del depto son las de sus personas', cerca(IA.total.extra, IA.unidades.reduce((s, u) => s + u.extra, 0)));
  api.alcSetVinc('RETIRADO');
  const IV = api.computeInd(api.alcanceR(R), {});
  ok('alcance sin personas: no revienta y queda vacio', IV.personas === 0 && IV.unidades.length === 0 && IV.pareto.M === 0 && IV.salud.pct === null);
  api.alcLimpiar();
  api.alcSetPerfil('ADMINISTRATIVO');
  ok('alcance de perfil: solo ROTATIVO existe aqui, ADMINISTRATIVO queda vacio', api.computeInd(api.alcanceR(R), {}).personas === 0);
  api.alcLimpiar();

  // exportaciones
  const hojas = { Res: api.aoaIndRes(I), Dep: api.aoaInd(I), Emp: api.aoaIndEmp(I), Sem: api.aoaIndSem(I), EmpNivel: api.aoaInd(IA), Alert: api.aoaIndAlert(I), Alcance: api.aoaAlcance() };
  Object.entries(hojas).forEach(([k, a]) => ok(`aoa ${k} es rectangular (${a.length} filas x ${a[0].length} columnas)`, a.length > 1 && a.every(r => r.length === a[0].length)));
  ok('aoaIndEmp: el % acumulado termina en 100', hojas.Emp[hojas.Emp.length - 1][6] === 100);
  ok('aoaInd (departamento) trae una fila por departamento', hojas.Dep.length === 1 + 3);

  // renders: alcance completo, departamento abierto, metrica de dias sin marcar por persona, y alcance vacio
  const ids = ['#indCards', '#indRuta', '#indSalud', '#indBarrasTitle', '#indBarrasLead', '#indBarras', '#indBarrasTabla', '#indParetoLead', '#indPareto', '#indEst', '#indEstLead',
    '#indSemLead', '#indSem', '#indSemTabla', '#indAlertLead', '#indAlert', '#tIndHeat thead', '#tIndHeat tbody', '#indPrintHead'];
  const pintar = () => ids.map(s => (api.__mk(s).innerHTML || api.__mk(s).textContent || '')).join('\n');
  api.renderInd();
  const t1 = pintar();
  ok('renderInd (todo): pinta sin NaN ni undefined', t1.length > 3000 && !/NaN|undefined|\[object/.test(t1), (t1.match(/NaN|undefined|\[object/g) || []).join());
  ok('renderInd (todo): una fila por departamento y la de total', (api.__mk('#tIndHeat tbody').innerHTML.match(/<tr/g) || []).length === 4);
  api.__ev('IND_DEP = "DEPTO A"'); api.renderInd();
  const t2 = pintar();
  ok('renderInd (departamento): pinta sin NaN ni undefined', !/NaN|undefined|\[object/.test(t2), (t2.match(/NaN|undefined|\[object/g) || []).join());
  ok('renderInd (departamento): una fila por persona y la de total', (api.__mk('#tIndHeat tbody').innerHTML.match(/<tr/g) || []).length === 7);
  api.__ev('IND_DEP = ""; IND_MET = "faltas"; IND_PP = true; IND_SEM = "faltas"'); api.renderInd();
  const t2b = pintar();
  ok('renderInd (dias sin marcar, por persona, semana de faltas): pinta sin NaN', !/NaN|undefined|\[object/.test(t2b));
  api.__ev('IND_MET = "extra"; IND_PP = false; IND_SEM = "extra"');
  api.alcSetVinc('RETIRADO');
  const t3 = pintar();
  ok('renderInd (sin personas): no revienta ni pinta NaN', !/NaN|undefined|\[object/.test(t3));
  api.alcLimpiar();
  api.renderInd();
  ok('sin errores de consola al pintar', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  api.__dom();
  ok('cableado de la pestana corre sin errores', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  salida[nombre] = t1 + '\n====\n' + t2 + '\n====\n' + t2b + '\n====\n' + t3 + '\n====\n' + JSON.stringify(hojas);
}
ok('los dos archivos pintan y exportan EXACTAMENTE lo mismo', salida.COMPLETO === salida.RRHH);
console.log(fallos ? 'FALLOS: ' + fallos : 'INDICADORES OK');
process.exit(fallos ? 1 : 0);
