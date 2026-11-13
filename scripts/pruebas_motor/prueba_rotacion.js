'use strict';
// La pestaña ROTACION en los DOS archivos, con datos 100% ficticios (ids 95xx y 96xx).
// Parte A: computeRot sobre un modelo armado a mano, con cifras calculadas A MANO (plantilla inicio/fin, ingresos,
//          retiros por tipo, depuracion masiva, ingresos masivos, ventana, mes no confiable, mes en curso).
// Parte B: el FILTRO DE TIPO DE RETIRO (el numerador cuenta solo los tipos marcados; la plantilla NO se reduce) y
//          el caso combinado tipo + departamento + cargo + ventana + interruptor de depuracion.
// Parte C: casos borde (plantilla 0, una sola persona, retiro antes de la ventana, sin fecha, retiro anterior al ingreso,
//          cargo ausente, archivo de Renuncias sin cargar).
// Parte D: la capa completa (Excel falsos por readSheet, runCalc, renderRot, hooks, exportacion a Excel) y que los dos
//          archivos pintan y exportan EXACTAMENTE lo mismo.
const { cargar, invariantes, FILES } = require('./lib.js');

let fallos = 0;
const ok = (n, c, extra = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!c) fallos++; };
const cerca = (a, b) => Math.abs(a - b) < 1e-9;
const mala = s => /NaN|undefined|\[object|Infinity/.test(s);

// id, departamento, cargo, compania (null = solo en Renuncias: se recupera de las marcaciones, que aqui no hay), ingreso, retiro, tipo, vinculo
const POB = [];
const p = (id, dep, cargo, cia, ing, ret, tipo, vinc) => POB.push({ id, dep, cargo, cia, ing, ret, tipo, vinc: vinc || (ret ? 'RETIRADO' : 'ACTIVO') });
['1', '2', '3', '4'].forEach(n => p('950' + n, 'DEPTO X', 'OP', 'PLASTITECSA', '2020-01-0' + n, null, ''));
['5', '6'].forEach(n => p('950' + n, 'DEPTO X', 'SUP', 'PLASTITECSA', '2020-01-0' + n, null, ''));
['1', '2'].forEach(n => p('951' + n, 'DEPTO Y', 'JEFE', 'GRANSERVICIOS', '2020-02-0' + n, null, ''));
p('9520', 'DEPTO X', 'OP', 'PLASTITECSA', '2026-07-02', null, '');                       // H1: ingreso real de julio
['1', '2', '3', '4'].forEach(n => p('953' + n, 'DEPTO Y', 'OP2', 'GRANSERVICIOS', '2026-06-01', null, ''));   // ingreso MASIVO (4 > 3)
p('9601', 'DEPTO X', 'OP', null, null, '2026-06-10', 'Renuncia');                          // L1
p('9602', 'DEPTO X', 'OP', null, null, '2026-07-05', 'Despedido');                         // L2
p('9603', 'DEPTO Y', 'JEFE', null, null, '2026-07-20', 'Renuncia');                        // L3
['1', '2', '3', '4'].forEach(n => p('961' + n, 'DEPTO X', 'OP', null, null, '2026-07-21', 'Renuncia'));      // depuracion masiva (4 > 3)
p('9620', 'DEPTO Y', 'JEFE', null, null, null, 'Renuncia', 'RETIRADO');                    // S1: retirado SIN fecha
p('9630', 'DEPTO X', 'OP', 'PLASTITECSA', '2026-07-10', '2026-07-01', 'Renuncia');         // C1: retiro anterior al ingreso

function modelo(pob) {
  const employees = new Map();
  pob.forEach(x => employees.set(x.id, { id: x.id, nombre: 'ROTNOM' + x.id, depto: x.dep, cargo: x.cargo, empresa: x.cia || '',
    ingreso: x.ing, retiro: x.ret, vinculo: x.vinc, tipoRetiro: x.tipo }));
  const punches = new Map([['9501', [{ iso: '2026-09-30' }]]]);       // el ultimo dato es el 30-sep: ningun mes de la ventana esta en curso
  return { employees, punches };
}
const CFG = { retMasivo: 3, ingMasivo: 3 };

const salida = {};
for (const [nombre, html] of Object.entries(FILES)) {
  const api = cargar(html, { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' } });
  console.log(`── ${nombre}`);

  // ───────────────────────── A: cifras calculadas a mano ─────────────────────────
  const M = modelo(POB);
  api.marcarIngresosMasivos(M, CFG); api.marcarRetirosMasivos(M, CFG);
  ok('marcarRetirosMasivos: solo el 21-jul (4 personas > 3)', M.retiroMasivo.size === 1 && M.retiroMasivo.get('2026-07-21') === 4, JSON.stringify([...M.retiroMasivo]));
  ok('el ingreso masivo (1-jun, 4 personas) lo detecta el mismo mecanismo de siempre', M.ingresoMasivo.get('2026-06-01') === 4);
  const sinMasivos = modelo(POB); api.marcarRetirosMasivos(sinMasivos, { retMasivo: 15 });
  ok('con el limite por defecto (15) ninguna fecha de estas es masiva', sinMasivos.retiroMasivo.size === 0);

  const V = { desde: '2026-06', hasta: '2026-08' };
  const R = api.computeRot(M, CFG, { ...V });
  const [jun, jul, ago] = R.meses;
  const fila = f => [f.ini, f.fin, f.ingresos, f.retiros, f.vol, f.desp, f.otro, f.depurados, f.ingMasivos, f.prom];
  ok('junio: plantilla 15 → 14, 1 retiro (renuncia), 4 ingresos masivos aparte', JSON.stringify(fila(jun)) === JSON.stringify([15, 14, 0, 1, 1, 0, 0, 0, 4, 14.5]), JSON.stringify(fila(jun)));
  ok('julio: plantilla 14 → 13, 1 ingreso, 2 retiros (1 renuncia + 1 despedido), 4 depurados aparte', JSON.stringify(fila(jul)) === JSON.stringify([14, 13, 1, 2, 1, 1, 0, 4, 0, 13.5]), JSON.stringify(fila(jul)));
  ok('agosto: plantilla 13 → 13 sin movimientos', JSON.stringify(fila(ago)) === JSON.stringify([13, 13, 0, 0, 0, 0, 0, 0, 0, 13]), JSON.stringify(fila(ago)));
  ok('tasa = retiros / plantilla promedio (1/14,5 · 2/13,5 · 0)', cerca(jun.tasa, 1 / 14.5) && cerca(jul.tasa, 2 / 13.5) && ago.tasa === 0);
  ok('el saldo neto es ingresos − retiros', jun.saldo === -1 && jul.saldo === -1 && ago.saldo === 0);
  ok('total de la ventana: 3 retiros sobre la suma de plantillas (1/14,5 + 2/13,5 + 0 = 3/41)', R.tot.retiros === 3 && cerca(R.tot.sumProm, 41) && cerca(R.tot.tasa, 3 / 41));
  ok('los 4 de la depuracion NO entran ni al numerador ni a la plantilla (julio ini = 14, no 18)', jul.ini === 14 && R.calidad.depurados === 4);
  const dia = (P, t) => P.filter(x => !x.excl && (x.ini === null || x.ini <= t) && (x.ret === null || x.ret > t)).length;   // oraculo independiente: plantilla al final de cada dia
  ok('oraculo diario de plantilla: inicio y fin de cada mes coinciden', R.meses.every(f => f.ini === dia(R.P, rotAnt(f.mes)) && f.fin === dia(R.P, api.rotUltimoDia(f.mes))));
  function rotAnt(mes) { const d = new Date(mes + '-01T00:00:00Z'); d.setUTCDate(0); return d.toISOString().slice(0, 10); }
  ok('las particiones por compañia suman el total (inicio, fin y retiros de cada mes)', R.meses.every((f, i) =>
    R.cias.reduce((s, c) => s + c.filas[i].ini, 0) === f.ini && R.cias.reduce((s, c) => s + c.filas[i].fin, 0) === f.fin && R.cias.reduce((s, c) => s + c.filas[i].retiros, 0) === f.retiros));
  ok('compañías ordenadas con «Sin dato» al final', R.cias.map(c => c.clave).join() === 'GRANSERVICIOS,PLASTITECSA,Sin dato', R.cias.map(c => c.clave).join());
  const porDep = api.rotGrupos(R.P, R.meses.map(f => f.mes), x => x.depto, null);
  ok('las particiones por departamento y por cargo también suman el total', R.meses.every((f, i) => porDep.reduce((s, g) => s + g.filas[i].ini, 0) === f.ini)
    && api.rotGrupos(R.P, ['2026-07'], x => x.cargo, null).reduce((s, g) => s + g.filas[0].retiros, 0) === jul.retiros);

  // interruptores: depuracion masiva e ingresos masivos
  const Ri = api.computeRot(M, CFG, { ...V, incRet: true });
  ok('«incluir depuraciones masivas»: julio pasa a 6 retiros, la plantilla de junio sube de 15 a 19 y no hay depurados aparte',
    Ri.meses[1].retiros === 6 && Ri.meses[1].vol === 5 && Ri.meses[1].desp === 1 && Ri.meses[0].ini === 19 && Ri.meses[0].fin === 18 && Ri.calidad.depurados === 0, JSON.stringify(fila(Ri.meses[1])));
  const Rg = api.computeRot(M, CFG, { ...V, incIng: true });
  ok('«incluir ingresos masivos»: junio cuenta 4 ingresos y su plantilla de inicio baja de 15 a 11', Rg.meses[0].ingresos === 4 && Rg.meses[0].ini === 11 && Rg.meses[0].fin === 14 && Rg.meses[0].ingMasivos === 0);

  // mes no confiable y mes en curso
  const Rn = api.computeRot(M, CFG, { ...V, noConf: new Set(['2026-07']) });
  ok('mes no confiable: marcado, fuera de los promedios (quedan jun y ago: 1 retiro sobre 14,5 + 13)', Rn.meses[1].noConf && !Rn.meses[1].usable && Rn.uso.join() === '2026-06,2026-08' && Rn.tot.retiros === 1 && cerca(Rn.tot.sumProm, 27.5));
  const Rp = api.computeRot({ ...M, punches: new Map([['9501', [{ iso: '2026-08-14' }]]]) }, CFG, { ...V });
  ok('último dato a mitad de agosto: agosto queda «en curso» y fuera del promedio', Rp.meses[2].parcial && !Rp.meses[2].usable && Rp.uso.join() === '2026-06,2026-07');
  const Rt = api.computeRot(M, CFG, { ...V, noConf: new Set(['2026-06', '2026-07', '2026-08']) });
  ok('todos los meses no confiables: totales en cero, sin NaN y sin reventar', Rt.tot.retiros === 0 && Rt.tot.tasa === null && Rt.uso.length === 0 && !mala(JSON.stringify(Rt.tot)));

  // ───────────────────────── B: filtro por tipo de retiro ─────────────────────────
  const Rd = api.computeRot(M, CFG, { ...V, tipos: new Set(['desp']) });
  ok('solo despedidos: el numerador cuenta solo despedidos (junio 0, julio 1, agosto 0)', Rd.meses.map(f => f.retiros).join() === '0,1,0' && Rd.meses.every(f => f.vol === 0 && f.otro === 0));
  ok('solo despedidos: la plantilla NO se reduce (idéntica a la sin filtro, mes por mes)', Rd.meses.every((f, i) => f.ini === R.meses[i].ini && f.fin === R.meses[i].fin && f.prom === R.meses[i].prom));
  ok('solo despedidos: la tasa es despedidos / plantilla TOTAL (1/13,5 en julio)', cerca(Rd.meses[1].tasa, 1 / 13.5));
  const Rv = api.computeRot(M, CFG, { ...V, tipos: new Set(['vol']) });
  ok('solo renuncias: junio 1, julio 1 (L3; el despedido queda fuera del numerador pero SÍ salió de la plantilla)', Rv.meses.map(f => f.retiros).join() === '1,1,0' && Rv.meses[1].fin === 13);
  ok('renuncias + despedidos = todos (sin filtro)', Rd.meses.every((f, i) => f.retiros + Rv.meses[i].retiros === R.meses[i].retiros));
  const Rtodos = api.computeRot(M, CFG, { ...V, tipos: new Set(['vol', 'desp', 'otro']) });
  ok('marcar todos los tipos = no filtrar', JSON.stringify(Rtodos.meses.map(fila)) === JSON.stringify(R.meses.map(fila)));
  const Rnin = api.computeRot(M, CFG, { ...V, tipos: new Set() });
  ok('ningún tipo marcado: 0 retiros, plantilla intacta y sin NaN', Rnin.tot.retiros === 0 && Rnin.meses.every((f, i) => f.prom === R.meses[i].prom) && !mala(JSON.stringify(Rnin.tot)));
  ok('el filtro por tipo también aplica a la depuración aparte (solo despedidos: 0 depurados, pues eran renuncias)', Rd.calidad.depurados === 0 && R.calidad.depurados === 4);
  ok('rotTipo clasifica renuncia / despedido / otro / vacío', api.rotTipo('Renuncia') === 'vol' && api.rotTipo('Despedido') === 'desp' && api.rotTipo('Mutuo acuerdo') === 'vol'
    && api.rotTipo('Terminación de contrato') === 'otro' && api.rotTipo('') === 'otro' && api.rotTipo(undefined) === 'otro' && api.rotTipo('DESPIDO CON JUSTA CAUSA') === 'desp');

  // caso combinado: tipo + departamento + cargo + ventana + interruptor de depuracion
  const okXOP = e => e.depto === 'DEPTO X' && e.cargo === 'OP';
  const win = { desde: '2026-07', hasta: '2026-08', tipos: new Set(['desp']), ok: okXOP };
  const C1 = api.computeRot(M, CFG, { ...win, incRet: true });
  const C0 = api.computeRot(M, CFG, { ...win, incRet: false });
  ok('combinado (despedido + DEPTO X + cargo OP + jul–ago + depuración INCLUIDA): julio 9 → 5, 1 retiro, plantilla 7',
    C1.meses[0].ini === 9 && C1.meses[0].fin === 5 && C1.meses[0].retiros === 1 && C1.meses[0].prom === 7 && cerca(C1.meses[0].tasa, 1 / 7) && C1.meses[0].ingresos === 1, JSON.stringify(fila(C1.meses[0])));
  ok('combinado (…depuración EXCLUIDA): julio 5 → 5, el mismo retiro, plantilla 5 (el interruptor mueve solo la plantilla)',
    C0.meses[0].ini === 5 && C0.meses[0].fin === 5 && C0.meses[0].retiros === 1 && C0.meses[0].prom === 5 && cerca(C0.meses[0].tasa, 1 / 5), JSON.stringify(fila(C0.meses[0])));
  ok('combinado: agosto 5 → 5 sin retiros en ambos casos', C1.meses[1].ini === 5 && C1.meses[1].retiros === 0 && C0.meses[1].prom === 5);
  ok('combinado: la ventana de dos meses y el total salen del filtro', C1.meses.length === 2 && C1.tot.retiros === 1 && cerca(C1.tot.tasa, 1 / 12) && C1.nivel === 'cargo', `nivel ${C1.nivel}`);
  const Rcarg = api.computeRot(M, CFG, { ...V, ok: e => e.depto === 'DEPTO X' });
  ok('un solo departamento en el alcance: el ranking pasa a cargos', Rcarg.nivel === 'cargo' && Rcarg.rank.every(r => ['OP', 'SUP'].includes(r.clave)));

  // ranking por tasa
  const rk = R.rank.map(r => r.clave);
  ok('ranking por departamento ordenado por TASA (no por cantidad) y con plantilla ≥ 5 en las elegibles', R.nivel === 'depto' && R.rank.every((r, i) => i === 0 || (R.rank[i - 1].tasa == null ? -1 : R.rank[i - 1].tasa) >= (r.tasa == null ? -1 : r.tasa)) && R.elegibles.every(r => r.promMedio >= 5), rk.join());

  // ───────────────────────── C: casos borde ─────────────────────────
  const Rv0 = api.computeRot(M, CFG, { ...V, ok: () => false });
  ok('nadie en el alcance: plantilla 0, tasa null, ranking vacío y sin NaN', Rv0.meses.every(f => f.prom === 0 && f.tasa === null && f.retiros === 0) && Rv0.rank.length === 0 && !mala(JSON.stringify(Rv0.meses.map(fila))));
  const Rsolo = api.computeRot(M, CFG, { ...V, ok: e => e.id === '9602' });
  ok('una sola persona (el despedido de julio): 1 retiro y plantilla 0,5 sin NaN', Rsolo.tot.retiros === 1 && Rsolo.meses[1].retiros === 1 && !mala(JSON.stringify(Rsolo.tot)) && Rsolo.elegibles.length === 0);
  const Rtarde = api.computeRot(M, CFG, { desde: '2026-07', hasta: '2026-08' });
  ok('retiro ANTES de la ventana (L1, 10-jun): no cuenta como retiro ni está en la plantilla de julio', Rtarde.meses[0].retiros === 2 && Rtarde.meses[0].ini === 14 && !Rtarde.P.find(x => x.id === '9601').excl);
  ok('retirado sin fecha (S1): queda aparte, no entra a la plantilla ni a la tasa', R.calidad.sinFecha === 1 && R.P.find(x => x.id === '9620').excl === 'sinFecha');
  ok('retiro anterior al ingreso (C1): queda aparte como inconsistente', R.calidad.inconsistentes === 1 && R.P.find(x => x.id === '9630').excl === 'inconsistente');
  const cm = modelo([{ id: '9701', dep: 'D', cargo: '', cia: 'C', ing: '2020-05-01', ret: null, tipo: '', vinc: 'ACTIVO' },
                     { id: '9702', dep: 'D', cargo: '  ', cia: 'C', ing: '2020-05-02', ret: '2026-07-10', tipo: '', vinc: 'RETIRADO' }]);
  const Rc = api.computeRot(cm, CFG, { desde: '2026-07', hasta: '2026-07', ok: () => true });
  ok('cargo ausente: queda como «(sin cargo)» y el retiro sin tipo es «otro»', Rc.P.every(x => x.cargo === '(sin cargo)') && Rc.meses[0].otro === 1 && Rc.calidad.sinTipo === 1 && Rc.nivel === 'cargo');
  ok('sin retiros en el modelo no hay rotación que calcular', api.computeRot({ employees: new Map([['1', { id: '1', ingreso: '2020-01-01', retiro: null, vinculo: 'ACTIVO' }]]), punches: new Map() }, CFG, {}).vacio === true);
  ok('rotRango: del primer retiro al último dato; hasta = mes de la última marcación', R.rango.min === '2026-06' && R.rango.max === '2026-09' && R.rango.hasta === '2026-09');
  ok('rotSumaMes cruza el año', api.rotSumaMes('2026-01', -1) === '2025-12' && api.rotSumaMes('2026-11', 3) === '2027-02' && api.rotListaMeses('2026-11', '2027-01').join() === '2026-11,2026-12,2027-01');

  // ───────────────────────── D: la capa completa ─────────────────────────
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const fl = l => DIAS.map(d => l.includes(d) ? 'True' : '');
  const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
  const habiles = [];
  for (let d = 1; d <= 30; d++) { const w = new Date(Date.UTC(2026, 8, d)).getUTCDay(); if (w >= 1 && w <= 5) habiles.push(`2026-09-${String(d).padStart(2, '0')}`); }
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en'],
    ['T_DIA', 'T_DIA', '1', '07:00:00', '15:00:00', ...fl(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']), '', '0', '']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  const ren = [['Renuncia'], ['Empleado', 'Departamento', 'Cargo', 'Tipo de renuncia', 'Fecha de retiro', 'Función de Asistencia', 'Motivo de renuncia']];
  POB.forEach(x => {
    const enMaestro = x.cia !== null;
    if (enMaestro) emp.push([x.id, 'ROTNOM', x.id, x.ing || '', x.dep, x.cia, x.cargo, 'Habilitado']);
    if (x.vinc === 'RETIRADO') ren.push([`${x.id} ROTNOM${x.id}`, x.dep, x.cargo, x.tipo, x.ret || '', '', '']);
    if (x.vinc === 'ACTIVO' && x.id.startsWith('950') || x.id === '9511') {          // solo unos pocos marcan: lo justo para tener marcaciones
      hor.push([x.id, 'ROTNOM', x.id, 'T_DIA', 'T_DIA', '2026-08-01', '2026-12-31']);
      habiles.forEach(iso => { ['07:00', '15:00'].forEach(hm => mar.push([x.id, 'ROTNOM', x.id, x.cia, x.dep, x.cargo, f2(iso), hm, '255', 'Dispositivo-PORTERIA PLANTA 1'])); });
    }
  });
  const armar = (a, conRen) => {
    a.DATA.emp = a.__leer(emp); a.DATA.tur = a.__leer(tur); a.DATA.hor = a.__leer(hor); a.DATA.mar = a.__leer(mar);
    a.DATA.ren = conRen ? a.__leer(ren) : null; a.DATA.lac = null;
    a.__set('cIni', '2026-09-01'); a.__set('cFin', '2026-09-30'); a.__set('cRetMasivo', '3'); a.__set('cIngMasivo', '3');
  };
  const hooks = {};
  for (const sel of ['#rotChips', '#rotTipos', '#rotDesde', '#rotHasta', '#rotIncRet', '#rotIncIng'])
    api.__mk(sel).addEventListener = (ev, fn) => { hooks[sel + ':' + ev] = fn; };
  armar(api, true);
  api.__dom();
  api.runCalc();
  ok('runCalc con la pestaña nueva: sin errores de consola', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  const RR = api.__ev('RESULT');
  const Rp1 = api.rotCalc();
  ok('capa completa: la ventana por defecto va de jun a sep y trae los mismos números que el modelo a mano (julio: 14 → 13, 2 retiros)',
    !Rp1.vacio && Rp1.desde === '2026-06' && Rp1.hasta === '2026-09' && Rp1.meses[1].ini === 14 && Rp1.meses[1].fin === 13 && Rp1.meses[1].retiros === 2 && Rp1.meses[1].depurados === 4, JSON.stringify(fila(Rp1.meses[1])));
  ok('los renunciados que solo están en Renuncias aparecen como «Sin dato» de compañía', Rp1.cias.map(c => c.clave).join() === 'GRANSERVICIOS,PLASTITECSA,Sin dato', Rp1.cias.map(c => c.clave).join());
  ok('el modelo trae las fechas masivas de retiro con el parámetro del formulario (cRetMasivo = 3)', api.__ev('MODEL.retiroMasivo.get("2026-07-21")') === 4);
  const dom = id => api.__mk(id).innerHTML + '';
  const paint = () => ['#rotCards', '#rotSalud', '#rotMes', '#rotLeg', '#rotChips', '#rotMesTabla', '#rotRank', '#rotRankTabla', '#rotRankLead', '#rotCia', '#rotRuta', '#rotTipos', '#rotPrintHead'].map(dom).join('\n');
  const t0 = paint();
  ok('la pantalla pinta sin NaN ni undefined', !mala(t0) && /Retiros del período/.test(dom('#rotCards')) && /<svg/.test(dom('#rotMes')));
  ok('el aviso de depuración habla de 4 retiros en una fecha y las cajas de tipo muestran Renuncia y Despedido', /4 retiros comparten fecha/.test(dom('#rotSalud')) && /Renuncia/.test(dom('#rotTipos')) && /Despedido/.test(dom('#rotTipos')) && !/Otro/.test(dom('#rotTipos')), dom('#rotSalud').replace(/<[^>]+>/g, '').slice(0, 90));
  ok('los controles se llenan: ventana jun–sep y el rotulado por mes', /value="2026-09"/.test(dom('#rotHasta')) && api.__mk('#rotDesde').value === '2026-06');
  ok('el gráfico dibuja una columna por mes con su porcentaje y la leyenda separa renuncia / despedido / depuración', (dom('#rotMes').match(/class="lbl"/g) || []).length === 4 && /Depuración BioTime/.test(dom('#rotLeg')) && /Renuncia/.test(dom('#rotLeg')) && /Despedido/.test(dom('#rotLeg')));

  // el filtro de tipo por la interfaz
  const cambiarTipo = (k, marcado) => hooks['#rotTipos:change']({ target: { dataset: { tipo: k }, checked: marcado } });
  cambiarTipo('vol', false);
  const dDesp = dom('#rotLeg'), cDesp = dom('#rotCards');
  ok('desmarcar «Renuncia»: la leyenda y el gráfico muestran SOLO despedidos y la tarjeta de renuncia dice que no está marcada',
    /Despedido/.test(dDesp) && !/Renuncia/.test(dDesp) && !/var\(--cat-1\)/.test(dom('#rotMes')) && /no está marcada/.test(cDesp), dDesp.replace(/<[^>]+>/g, ''));
  api.__mk('.tabs button.on').dataset.tab = 'rot';
  api.alcResumen();
  ok('la línea del Alcance muestra el tipo de retiro elegido (solo en Rotación)', /Tipo de retiro: Despedido/.test(dom('#alcFiltros')), dom('#alcFiltros').replace(/<[^>]+>/g, ''));
  ok('en Rotación el Alcance cuenta a TODA la gente del modelo (no solo a la del ciclo) y no ofrece «ocultar sin turno»', api.alcanceInfo().personas === POB.length && api.__mk('#alcNota').hidden === true && new RegExp(`de ${POB.length} personas`).test(api.__mk('#alcResumen').textContent), api.__mk('#alcResumen').textContent);
  ok('los retirados sin compañía conocida se cuentan aparte y avisan que no llevan tasa por compañía', Rp1.calidad.sinCia === 3 && /sin compañía conocida/.test(dom('#rotSalud')), 'sinCia=' + Rp1.calidad.sinCia);
  api.__mk('.tabs button.on').dataset.tab = 'ind';
  api.alcResumen();
  ok('…y desaparece en las otras pestañas', !/Tipo de retiro/.test(dom('#alcFiltros')));
  api.__mk('.tabs button.on').dataset.tab = 'rot';

  // caso combinado por la interfaz: despedido + DEPTO X + cargo OP + jul–ago + depuración incluida
  api.alcSetModoDep('incluir'); api.alcToggleDep('DEPTO X', true); api.alcSetCargo('OP');
  ok('el cargo del Alcance depende del departamento: con DEPTO X solo quedan OP y SUP', /<option>OP<\/option>/.test(dom('#alcCargo')) && /<option>SUP<\/option>/.test(dom('#alcCargo')) && !/JEFE/.test(dom('#alcCargo')), dom('#alcCargo').replace(/<[^>]+>/g, ' '));
  hooks['#rotDesde:change']({ target: { value: '2026-07' } }); hooks['#rotHasta:change']({ target: { value: '2026-08' } });
  hooks['#rotIncRet:change']({ target: { checked: true } });
  const Rc1 = api.rotCalc();
  ok('combinado por la interfaz (despedido + DEPTO X + OP + jul–ago + depuración incluida): julio 9 → 5, 1 retiro, plantilla 7',
    Rc1.meses[0].ini === 9 && Rc1.meses[0].fin === 5 && Rc1.meses[0].retiros === 1 && Rc1.meses[0].prom === 7, JSON.stringify(fila(Rc1.meses[0])));
  hooks['#rotIncRet:change']({ target: { checked: false } });
  const Rc0 = api.rotCalc();
  ok('…con la depuración excluida: julio 5 → 5, mismo retiro, plantilla 5', Rc0.meses[0].ini === 5 && Rc0.meses[0].prom === 5 && Rc0.meses[0].retiros === 1);
  ok('el texto del Alcance resume cargo y tipo', /Cargo: OP/.test(api.alcanceTexto()) && /Tipo de retiro: Despedido/.test(api.alcanceTexto()), api.alcanceTexto());

  // exportacion a Excel: respeta tipo, departamento, cargo, ventana y depuracion; solo ids
  api.__mk('#expRot').onclick();
  const wb = api.__escritos[api.__escritos.length - 1];
  const hojas = Object.fromEntries(wb.wb.sheets.map(s => [s.n, s.aoa]));
  ok('el Excel trae las 6 hojas', Object.keys(hojas).join() === 'Alcance,Por mes,Por departamento y mes,Por cargo y mes,Detalle de retiros,Fechas masivas' && /^Rotacion_2026-07_2026-08/.test(wb.name), Object.keys(hojas).join() + ' ' + wb.name);
  const alc = Object.fromEntries(hojas['Alcance'].filter(r => r.length > 1));
  ok('la hoja Alcance lista los tipos seleccionados, la ventana y los interruptores', alc['Tipos de retiro incluidos'] === 'Despedido' && alc['Ventana'] === '2026-07 a 2026-08' && alc['Incluye depuraciones masivas de BioTime'] === 'NO' && /Cargo: OP/.test(String(alc['Filtros activos'])), JSON.stringify(alc).slice(0, 300));
  const det = hojas['Detalle de retiros'];
  ok('el detalle de retiros trae solo despedidos de DEPTO X / cargo OP dentro de la ventana', det.slice(1).length === 1 && det[1][0] === '9602' && det[1][5] === 'Despedido' && det[1][1] === 'DEPTO X' && det[1][2] === 'OP', JSON.stringify(det.slice(1)));
  ok('Por mes: una fila TODAS y una por compañía para cada mes de la ventana', hojas['Por mes'].length === 1 + 2 * (1 + Rc0.cias.length));
  ok('Por mes: «Sin dato» lleva sus retiros pero SIN tasa (no tiene plantilla propia); las demás compañías sí', hojas['Por mes'].slice(1).filter(r => r[1] === 'Sin dato').every(r => r[11] === '') && hojas['Por mes'].slice(1).filter(r => r[1] === 'PLASTITECSA').every(r => r[11] !== ''));
  ok('la tabla mes × compañía de la pantalla no inventa tasas para «Sin dato»', /compañía desconocida: sin tasa/.test(dom('#rotCia')) && !/\d{3}[.,]\d%/.test(dom('#rotCia').replace(/<[^>]+>/g, ' ')));
  ok('el Excel no lleva nombres, solo ids', !/ROTNOM/.test(JSON.stringify(hojas)) && !hojas['Detalle de retiros'][0].includes('NOMBRE'));
  ok('hoja de fechas masivas: el retiro del 21-jul con sus 4 personas y el ingreso del 1-jun', hojas['Fechas masivas'].some(r => r[0] === 'RETIRO' && r[1] === '2026-07-21' && r[2] === 4) && hojas['Fechas masivas'].some(r => r[0] === 'INGRESO' && r[1] === '2026-06-01' && r[2] === 4));
  ok('las filas de las hojas son rectangulares', Object.values(hojas).every(a => a.every(r => r.length === a[0].length) || a === hojas['Alcance']));

  // mes no confiable por la interfaz, y que se guarda
  api.alcLimpiar(); cambiarTipo('vol', true);
  hooks['#rotDesde:change']({ target: { value: '2026-06' } }); hooks['#rotHasta:change']({ target: { value: '2026-09' } });
  hooks['#rotChips:click']({ target: { closest: () => ({ dataset: { mes: '2026-07' } }) } });
  const Rm = api.rotCalc();
  ok('clic en un mes: queda no confiable, sale del promedio y se guarda en mb_rot_meses', Rm.meses[1].noConf && !Rm.meses[1].usable && JSON.parse(api.__ev('localStorage.getItem("mb_rot_meses")')).join() === '2026-07');
  ok('…y el gráfico y el chip lo marcan', /no confiable/.test(dom('#rotMes')) && /class="off"/.test(dom('#rotChips')));
  hooks['#rotChips:click']({ target: { closest: () => ({ dataset: { mes: '2026-07' } }) } });
  ok('otro clic lo vuelve a contar y limpia lo guardado', !api.rotCalc().meses[1].noConf && api.__ev('localStorage.getItem("mb_rot_meses")') === '[]');

  // ranking: clic en un departamento abre sus cargos; ruta
  api.__ev('ROT.dep = "DEPTO X"'); api.renderRot();
  ok('departamento abierto: el ranking pasa a cargos y la ruta lo dice', /Rotación mensual por cargo/.test(api.__mk('#rotRankTitle').textContent) && /DEPTO X/.test(dom('#rotRuta')));
  api.__ev('ROT.dep = ""');

  // alcances vacios / sin archivo de Renuncias
  api.alcSetModoDep('incluir'); api.alcToggleDep('NO EXISTE', true); api.renderRot();
  ok('alcance vacío: la pantalla pinta sin NaN', !mala(paint()));
  api.alcLimpiar();
  api.__ev('DATA.ren = null'); armar(api, false); api.runCalc();
  api.renderRot();
  ok('sin archivo de Renuncias: avisa que hay que cargarlo y oculta el cuerpo (el archivo sigue siendo opcional)', api.__mk('#rotAviso').hidden === false && /Renuncias/.test(dom('#rotAviso')) && api.__mk('#rotCuerpo').hidden === true && api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  ok('sin Renuncias el resto de las pestañas calcula igual (consolidado y resumen pintan)', /Retiros|Horas extra/.test(dom('#indCards')) && api.__ev('RESULT.todos.length') === 7);
  armar(api, true); api.runCalc();
  const inv = invariantes(api.__ev('RESULT'));
  ok('invariantes I-01/I-02/I-03 = 0', inv.i1 + inv.i2 + inv.i3 === 0);
  ok('sin errores de consola al terminar', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  salida[nombre] = JSON.stringify({ R: Rp1.meses.map(fila), t: t0, hojas: Object.keys(hojas), alc: hojas['Alcance'], pm: hojas['Por mes'], det, fe: hojas['Fechas masivas'] });
}
// el encabezado impreso lleva la hora de generacion (con segundos): se quita para comparar
const sinHora = t => t.replace(/generado [0-9\/,: .apm]*/gi, 'generado ');
ok('los dos archivos pintan y exportan EXACTAMENTE lo mismo', sinHora(salida.COMPLETO) === sinHora(salida.RRHH));
console.log(fallos ? 'FALLOS: ' + fallos : 'ROTACION OK');
process.exit(fallos ? 1 : 0);
