'use strict';
// El filtro de ALCANCE compartido por Resumen del ciclo, Adopcion y Calidad de marcacion, en los DOS archivos,
// con datos 100% ficticios (ids 93xx). Comprueba la semantica de cada filtro (incluir/excluir departamentos,
// chips de personas, perfil, vinculo, compania, ocultar sin turno), que se combinan con Y, que los numeros de
// las tres pestañas y de sus exportaciones respetan el alcance, que sin filtro los totales son los de siempre,
// la persistencia de las exclusiones (mb_kpi_excl) y que los dos archivos pintan exactamente lo mismo.
const { cargar, invariantes, FILES } = require('./lib.js');

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fl = lista => DIAS.map(d => lista.includes(d) ? 'True' : '');
const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
const pad = n => String(n).padStart(2, '0');
const habiles = [];
for (let d = 1; d <= 30; d++) { const dt = new Date(Date.UTC(2026, 8, d)); const w = dt.getUTCDay(); if (w >= 1 && w <= 5) habiles.push(`2026-09-${pad(d)}`); }

// id, departamento, turno (null = SIN turno asignado), compania, dias extra, dias sin marcar
const PERSONAS = [
  ['9301', 'DEPTO A', 'T_DIA', 'PLASTITECSA', 5, 0], ['9302', 'DEPTO A', 'T_DIA', 'PLASTITECSA', 0, 2], ['9303', 'DEPTO A', 'T_DIA', 'GRANSERVICIOS', 1, 0],
  ['9311', 'DEPTO B', 'T_NOCHE', 'PLASTITECSA', 0, 0], ['9312', 'DEPTO B', 'T_NOCHE', 'PLASTITECSA', 3, 1],
  ['9321', 'GERENCIA X', null, 'PLASTITECSA', 0, 0], ['9322', 'GERENCIA X', null, 'PLASTITECSA', 0, 0],
];

function construir() {
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  tur.push(['T_DIA', 'T_DIA', '1', '07:00:00', '15:00:00', ...fl(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']), '', '0', '']);
  tur.push(['T_NOCHE', 'T_NOCHE', '1', '22:00:00', '06:00:00', ...fl(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']), '', '0', '']);
  PERSONAS.forEach(([id, dep, turno, cia, nExtra, nFalta]) => {
    emp.push([id, 'PRUEBA', 'ALC' + id, '2020-01-01', dep, cia, 'CARGO PRUEBA', 'Habilitado']);
    if (turno) hor.push([id, 'PRUEBA', 'ALC' + id, turno, turno, '2026-08-01', '2026-12-31']);
    habiles.forEach((iso, i) => {
      if (turno && i < nFalta) return;
      const extra = i >= habiles.length - nExtra;
      const org = 'Dispositivo-PORTERIA PLANTA 1';
      const push = (d, hm) => mar.push([id, 'PRUEBA', 'ALC' + id, cia, dep, 'CARGO PRUEBA', f2(d), hm, '255', org]);
      if (!turno) { push(iso, '07:00'); push(iso, '17:00'); }                  // sin turno: marca igual (todo sale como extra)
      else if (turno === 'T_DIA') { push(iso, '07:00'); push(iso, extra ? '17:00' : '15:00'); }
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
const mala = s => /NaN|undefined|\[object|Infinity/.test(s);
const salida = {};

for (const [nombre, html] of Object.entries(FILES)) {
  const api = cargar(html, { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' } });
  const D = construir();
  api.DATA.emp = api.__leer(D.emp); api.DATA.tur = api.__leer(D.tur); api.DATA.hor = api.__leer(D.hor); api.DATA.mar = api.__leer(D.mar);
  api.DATA.ren = null; api.DATA.lac = null;
  api.__set('cIni', '2026-09-01'); api.__set('cFin', '2026-09-30');
  api.runCalc();
  const R = api.__ev('RESULT');
  console.log(`── ${nombre}`);
  ok('sin errores de consola al calcular', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  const n = () => api.alcanceR(R).byEmp.size;
  const ids = () => [...api.alcanceR(R).byEmp.keys()].sort().join(',');

  // punto de partida
  ok('sin filtros: entran las 7 personas y no hay alcance activo', n() === 7 && !api.alcanceHay());
  ok('sinTurnoAsignado: solo las 2 de GERENCIA X', ['9321', '9322'].every(id => api.sinTurnoAsignado(R.byEmp.get(id))) && ['9301', '9311'].every(id => !api.sinTurnoAsignado(R.byEmp.get(id))));
  ok('las 2 personas sin turno tienen todo en extras (el aviso dice la verdad)', ['9321', '9322'].every(id => R.byEmp.get(id).extraH > 0));
  const I0 = api.computeInd(api.alcanceR(R), {});
  ok('sin filtros: Resumen == calculo directo sobre RESULT', cerca(I0.total.extra, api.computeInd(R, {}).total.extra) && I0.personas === 7);
  const info0 = api.alcanceInfo();
  ok('alcanceInfo: 3 departamentos de 3, 7 de 7 personas, 2 sin turno', info0.deps === 3 && info0.depsEn === 3 && info0.enAlcance === 7 && info0.sinTurnoEn === 2 && info0.ocultas === 0, JSON.stringify(info0));

  // departamentos: solo estos
  api.alcSetModoDep('incluir'); api.alcToggleDep('DEPTO A', true);
  ok('solo DEPTO A: 3 personas, un solo departamento', ids() === '9301,9302,9303' && api.alcanceUnDepto(api.alcanceR(R)) === 'DEPTO A');
  api.alcToggleDep('depto b', true);                      // la comparacion es sin importar mayusculas
  ok('solo A y B (en minusculas tambien): 5 personas, ya no hay un unico departamento', n() === 5 && api.alcanceUnDepto(api.alcanceR(R)) === null);
  ok('incluir NO se guarda en mb_kpi_excl', api.__ev('localStorage.getItem("mb_kpi_excl")') === null);
  api.alcToggleDep('DEPTO A', false); api.alcToggleDep('DEPTO B', false);
  ok('sin casillas marcadas en "solo estos": no filtra (vuelven las 7)', n() === 7);

  // departamentos: todos menos estos (y persistencia)
  api.alcSetModoDep('excluir'); api.alcToggleDep('GERENCIA X', true);
  ok('todos menos GERENCIA X: 5 personas', n() === 5 && !ids().includes('9321'));
  ok('la exclusion se guarda en mb_kpi_excl (la misma llave que usaba el KPI)', JSON.parse(api.__ev('localStorage.getItem("mb_kpi_excl")')).join() === 'GERENCIA X');
  ok('el texto del alcance lo dice', /Sin los departamentos: GERENCIA X/.test(api.alcanceTexto()) && /2 de 3 departamentos|2 de 3/.test(api.alcanceTexto()), api.alcanceTexto());
  const infoX = api.alcanceInfo();
  ok('con GERENCIA X afuera ya no hay personas sin turno dentro', infoX.sinTurnoEn === 0 && infoX.enAlcance === 5);

  // limpiar: vuelve todo y borra lo guardado
  api.alcLimpiar();
  ok('limpiar: 7 personas, sin alcance, y borra mb_kpi_excl', n() === 7 && !api.alcanceHay() && api.__ev('localStorage.getItem("mb_kpi_excl")') === '[]');

  // personas: solo / excluir
  api.alcAddPers('9301'); api.alcAddPers('9312'); api.alcAddPers('0000');   // el 0000 no existe: se ignora
  ok('solo 9301 y 9312 (un id inexistente se ignora)', ids() === '9301,9312', ids());
  api.alcSetModoPer('excluir');
  ok('excluir 9301 y 9312: quedan las otras 5', n() === 5 && !ids().includes('9301') && !ids().includes('9312'));
  api.alcQuitarPers('9301');
  ok('quitar un chip: excluir solo 9312 deja 6', n() === 6 && ids().includes('9301'));
  api.alcQuitarPers('9312');
  ok('sin chips no filtra', n() === 7);
  api.alcLimpiar();

  // sin turno
  api.alcSetSinTurno(true);
  ok('ocultar sin turno: salen las 2 de GERENCIA X', n() === 5 && !ids().includes('9321'));
  const infoS = api.alcanceInfo();
  ok('alcanceInfo cuenta las 2 ocultas y 0 dentro', infoS.ocultas === 2 && infoS.sinTurnoEn === 0, JSON.stringify(infoS));
  api.alcResumen();
  ok('la nota ofrece mostrarlas', /están ocultas|esta oculta/.test(api.__mk('#alcNota').innerHTML) && /Mostrarlas/.test(api.__mk('#alcNota').innerHTML));
  api.alcSetSinTurno(false);
  api.alcResumen();
  ok('mostrar de nuevo: la nota avisa de las 2 personas sin turno y que todo sale como extra', /2 personas sin turno asignado/.test(api.__mk('#alcNota').innerHTML) && /como extra/.test(api.__mk('#alcNota').innerHTML), api.__mk('#alcNota').innerHTML.replace(/<[^>]+>/g, ''));

  // perfil, vinculo, compania
  api.alcSetCia('GRANSERVICIOS');
  ok('compañia GRANSERVICIOS: 1 persona', ids() === '9303');
  api.alcSetCia('');
  api.alcSetPerfil('ADMINISTRATIVO');
  ok('perfil administrativo: nadie en estos datos (todos son rotativos)', n() === 0);
  api.alcSetPerfil('ROTATIVO');
  ok('perfil rotativo: las 7', n() === 7);
  api.alcSetPerfil(''); api.alcSetVinc('RETIRADO');
  ok('solo retirados: nadie', n() === 0);
  api.alcLimpiar();

  // combinaciones con Y
  api.alcSetModoDep('incluir'); api.alcToggleDep('DEPTO A', true); api.alcSetCia('PLASTITECSA'); api.alcAddPers('9303'); api.alcSetModoPer('excluir');
  ok('DEPTO A y PLASTITECSA y sin la 9303: quedan 9301 y 9302', ids() === '9301,9302', ids());
  ok('el texto del alcance resume los tres filtros', api.alcanceLista().length === 3, api.alcanceLista().join(' | '));
  api.alcLimpiar();

  // cargo (lo usa Rotación; en las otras tres pestañas recorta igual que los demás filtros)
  api.alcSetCargo('CARGO PRUEBA');
  ok('cargo válido: filtra (las 7 tienen ese cargo), cuenta como alcance activo y sale en el texto', n() === 7 && api.alcanceHay() && api.alcanceLista().includes('Cargo: CARGO PRUEBA'), api.alcanceLista().join(' | '));
  api.alcSetCargo('CARGO QUE NO EXISTE');
  ok('un cargo que no existe se suelta solo (la lista de cargos depende de lo demás) y no deja el alcance vacío', api.__ev('ALC.cargo') === '' && n() === 7);
  api.alcSetModoDep('incluir'); api.alcToggleDep('DEPTO A', true); api.alcSetCargo('CARGO PRUEBA');
  ok('el cargo se combina con Y con el departamento', ids() === '9301,9302,9303');
  ok('alcanceOkEmp (nivel persona, sin el cálculo del ciclo) coincide con alcanceOk y salta el cargo si se le pide',
    [...R.byEmp.values()].every(e => api.alcanceOkEmp(e.emp) === api.alcanceOk(e)) && api.alcanceOkEmp(R.byEmp.get('9311').emp, true) === false);
  api.alcLimpiar();
  ok('limpiar también suelta el cargo', api.__ev('ALC.cargo') === '' && !api.alcanceHay());

  // las tres pestañas y las exportaciones respetan el alcance
  api.alcSetModoDep('incluir'); api.alcToggleDep('DEPTO B', true);
  const R2 = api.alcanceR(R), Q = api.calidadFiltrada(), CC = api.cobCalc(), I2 = api.computeInd(R2, api.indOpt(R2));
  ok('DEPTO B: Resumen, Calidad y Adopcion ven las mismas 2 personas', I2.personas === 2 && Q.total.empleados === 2 && CC.C.filas.length === 2);
  ok('DEPTO B: las extras del Resumen son las de sus 2 personas', cerca(I2.total.extra, R.byEmp.get('9311').extraH + R.byEmp.get('9312').extraH));
  ok('DEPTO B: un unico departamento abre el nivel persona', I2.nivel === 'emp' && I2.unidades.length === 2);
  ok('DEPTO B: aoaCobertura 2 personas, aoaCalidadEmp 2 personas, aoaAlcance describe el filtro',
    api.aoaCobertura().length === 3 && api.aoaCalidadEmp().length === 3 && api.aoaAlcance().some(f => /DEPTO B/i.test(String(f[1]))));
  ok('DEPTO B: aoaCoberturaDep trae 1 departamento y el total', api.aoaCoberturaDep().length === 3);
  ok('DEPTO B: aoaInd trae las 2 personas', api.aoaInd(I2).length === 3);
  api.alcLimpiar();
  const Q7 = api.calidadFiltrada(), C7 = api.cobCalc();
  ok('sin alcance: Calidad y Adopcion ven las 7', Q7.total.empleados === 7 && C7.C.filas.length === 7);
  ok('dias sin marcar: Resumen = Calidad = Adopcion (por jornada)', I0.total.faltas === Q7.total.sinMarcaTurno && Q7.total.sinMarcaTurno === api.cobAgregar(C7.C.filas).falta && I0.total.faltas === 3, `${I0.total.faltas}/${Q7.total.sinMarcaTurno}`);
  ok('Calidad: calidadMarca = limpios / dias con marcacion', cerca(Q7.total.calidadMarca, Q7.total.limpio / (Q7.total.dias - Q7.total.sinMarca) * 100));

  // renders con distintos alcances (incluido el vacio) no revientan y no pintan NaN
  const idsDom = ['#indCards', '#indSalud', '#indBarras', '#indBarrasLead', '#indAlert', '#indEst', '#indSem', '#tIndHeat tbody', '#indPrintHead',
    '#qHero', '#qFuera', '#tQ tbody', '#tQEmp tbody', '#qRuta', '#qEmpInfo', '#qPrintHead',
    '#cobTiles', '#cobRuta', '#tCobDep tbody', '#cobAviso', '#cobPrintHead', '#tCob tbody',
    '#alcResumen', '#alcFiltros', '#alcNota', '#alcDeps', '#alcPers'];
  const pintar = () => idsDom.map(s => (api.__mk(s).innerHTML || api.__mk(s).textContent || '')).join('\n');
  const todo = () => { api.renderInd(); api.renderCalidad(); api.renderCob(); api.alcResumen(); return pintar(); };
  const varios = [];
  varios.push(todo());
  api.alcSetModoDep('excluir'); api.alcToggleDep('GERENCIA X', true); varios.push(todo()); api.alcLimpiar();
  api.alcSetModoDep('incluir'); api.alcToggleDep('GERENCIA X', true); varios.push(todo());
  ok('Adopcion con un unico departamento: abre solo el nivel departamento y muestra la matriz', api.__mk('#cobMatriz').hidden === false);
  api.alcLimpiar();
  api.alcAddPers('9301'); varios.push(todo()); api.alcLimpiar();
  api.alcSetPerfil('ADMINISTRATIVO'); varios.push(todo());
  ok('alcance vacio: no pinta NaN ni undefined', !varios.some(mala), varios.map((t, i) => mala(t) ? i : '').join(''));
  ok('alcance vacio: Adopcion dice que no hay datos y la matriz esta oculta', /Sin datos|Sin personas/.test(api.__mk('#tCobDep tbody').innerHTML) && api.__mk('#cobMatriz').hidden === true);
  api.alcLimpiar();
  api.__ev('COB_DEP = null; COB_EMP = ""; IND_DEP = ""; Q_DEP = null');
  api.__ev('COB_DEP = "DEPTO A"'); api.renderCob(); ok('Adopcion con DEPTO A abierto: matriz visible y sin NaN', api.__mk('#cobMatriz').hidden === false && !mala(pintar()));
  api.__ev('COB_DEP = null'); api.renderCob(); ok('Adopcion en el alcance completo: matriz oculta', api.__mk('#cobMatriz').hidden === true);
  api.__ev('Q_DEP = "DEPTO A"'); api.renderCalidad(); ok('Calidad con DEPTO A abierto pinta sin NaN', !mala(pintar())); api.__ev('Q_DEP = null');
  ok('sin errores de consola al pintar', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));

  // cambiar de pestaña repinta lo que quedo sucio
  api.alcSetModoDep('excluir'); api.alcToggleDep('GERENCIA X', true);
  api.__mk('#indCards').innerHTML = 'VIEJO';
  ok('un cambio de alcance deja las 4 pestañas sucias (Resumen, Adopción, Calidad y Rotación)', api.__ev('[...ALC_SUCIO].sort().join()') === 'cal2,cob,ind,rot');
  api.showTab('ind');
  ok('showTab repinta la pestaña sucia con el alcance nuevo', api.__mk('#indCards').innerHTML !== 'VIEJO' && !api.__ev('ALC_SUCIO.has("ind")'));
  ok('showTab muestra la barra de alcance en Resumen y la oculta en Consolidado', api.__mk('#alcBar').hidden === false && (api.showTab('cons'), api.__mk('#alcBar').hidden === true));
  api.alcLimpiar();

  // el panel
  api.alcPanel();
  ok('el panel lista los 3 departamentos y las compañias', (api.__mk('#alcDeps').innerHTML.match(/type="checkbox"/g) || []).length === 3 && /GRANSERVICIOS/.test(api.__mk('#alcCia').innerHTML));
  api.alcAddPers('9301'); api.alcSugerir('alc9302');
  ok('el buscador sugiere por nombre y el chip aparece con su ×', /9302/.test(api.__mk('#alcSug').innerHTML) && /data-quitar="9301"/.test(api.__mk('#alcPers').innerHTML), api.__mk('#alcSug').innerHTML.slice(0, 80));
  api.alcLimpiar();
  api.__dom();
  ok('cableado de DOMContentLoaded sin errores (el mock devuelve null para lo no declarado)', api.__errores.length === 0, api.__errores.slice(0, 2).join(' | '));
  const inv = invariantes(R);
  ok('invariantes I-01/I-02/I-03 = 0', inv.i1 + inv.i2 + inv.i3 === 0);
  api.alcSetPerfil('ZZ'); const vacio = todo(); api.alcLimpiar();
  salida[nombre] = varios.join('\n====\n') + '\n====\n' + vacio + '\n====\n' + JSON.stringify([api.aoaAlcance(), api.aoaCobertura(), api.aoaCoberturaDep(), api.aoaCalidad(), api.aoaCalidadEmp()]);
}
// el encabezado impreso lleva la hora de generacion (con segundos): se quita para comparar
const sinHora = t => t.replace(/generado [0-9\/,: .apm]*/gi, 'generado ');
ok('los dos archivos pintan y exportan EXACTAMENTE lo mismo', sinHora(salida.COMPLETO) === sinHora(salida.RRHH));
console.log(fallos ? 'FALLOS: ' + fallos : 'ALCANCE OK');
process.exit(fallos ? 1 : 0);
