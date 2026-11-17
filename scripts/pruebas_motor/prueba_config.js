'use strict';
// Parametros persistentes (mb_params) y archivo de configuracion (exportar / importar) en los DOS archivos,
// con datos 100% ficticios (ids 95xx). Comprueba: PARAM_IDS == lo que lee readConfig == los controles del HTML;
// los defaults salen del HTML y no de lo guardado; mb_params se repone al abrir (id desconocido o valor invalido
// se ignora); "Restaurar"; el formato exacto del .json; la ida y vuelta de las 9 secciones; que un archivo
// invalido (JSON roto, formato ajeno, version futura, tipo erroneo en CUALQUIER seccion) no cambia nada, ni
// parcialmente; que importar muta los globales en sitio, recalcula y no pierde los Excel cargados; que cada
// archivo importa el .json del otro; y que sin tocar nada la nomina y las exportaciones son las de siempre.
const { cargar, invariantes, FILES } = require('./lib.js');

let fallos = 0;
const ok = (n, c, extra = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!c) fallos++; };
const J = JSON.stringify;

/* ── datos ficticios minimos: 4 personas, un ciclo de septiembre ── */
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fl = lista => DIAS.map(d => lista.includes(d) ? 'True' : '');
const f2 = iso => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
const pad = n => String(n).padStart(2, '0');
const habiles = [];
for (let d = 1; d <= 30; d++) { const w = new Date(Date.UTC(2026, 8, d)).getUTCDay(); if (w >= 1 && w <= 5) habiles.push(`2026-09-${pad(d)}`); }
const PERSONAS = [['9501', 'DEPTO A', 'PLASTITECSA', 3], ['9502', 'DEPTO A', 'PLASTITECSA', 0], ['9503', 'DEPTO B', 'GRANSERVICIOS', 1], ['9504', 'DEPTO B', 'PLASTITECSA', 2]];
function construir() {
  const emp = [['Empleado'], ['Empleado ID', 'Nombres', 'Apellidos', 'Fecha de contratación', 'Departamento', 'Compañía', 'Cargo', 'Estado empleado']];
  const tur = [['Turno'], ['Código', 'Descripción del turno', 'Time ID', 'Hora Entrada', 'Hora Salida', ...DIAS, 'holiday', 'Descanso', 'Descontar descansso en']];
  const hor = [['Horario'], ['Empleado ID', 'Nombres', 'Apellidos', 'Código', 'Descripción del turno', 'Fecha Inicial', 'Fecha Final']];
  const mar = [[''], ['Reporte de Marcaciones'], ['Employee ID', 'Nombres', 'Apellidos', 'Branch', 'Departamento', 'Position', 'Fecha', 'Hora', 'Tipo de Marcación', 'Origen del registro']];
  tur.push(['T_DIA', 'T_DIA', '1', '07:00:00', '15:00:00', ...fl(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']), '', '0', '']);
  PERSONAS.forEach(([id, dep, cia, nExtra]) => {
    emp.push([id, 'PRUEBA', 'CFG' + id, '2020-01-01', dep, cia, 'CARGO PRUEBA', 'Habilitado']);
    hor.push([id, 'PRUEBA', 'CFG' + id, 'T_DIA', 'T_DIA', '2026-08-01', '2026-12-31']);
    habiles.forEach((iso, i) => {
      const extra = i >= habiles.length - nExtra;
      const push = (d, hm) => mar.push([id, 'PRUEBA', 'CFG' + id, cia, dep, 'CARGO PRUEBA', f2(d), hm, '255', 'Dispositivo-PORTERIA PLANTA 1']);
      push(iso, '07:00'); push(iso, extra ? '17:00' : '15:00');
    });
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
const huella = api => {
  const R = api.__ev('RESULT');
  return J([...R.byEmp].map(([id, e]) => [id, e.tot, e.extraH, e.pendH, e.ordH])) + J(api.aoaCons());
};
const estado = api => { const o = api.configArmar(new Date(2026, 0, 1)); return J(o); };   // fecha fija: solo importa el contenido
const ls = k => global.localStorage.getItem(k);

/* poblar las 9 secciones con valores NO por defecto */
function poblar(api) {
  api.__set('cUmbral', '40'); api.__set('cEscPrimer', '20'); api.__set('cDom', '0'); api.__set('cRedon', 'ciclo');
  api.__set('cSemIni', '1'); api.__set('cSemHora', '21:30'); api.__set('cAdmin', 'T_X');
  api.__ev("PERFILES['9501']='ADMINISTRATIVO'; PERFILES['9502']='ROTATIVO'");
  api.__ev("CONFIANZA.add('9503')");
  api.__ev("AUTOR['9504']=[{ini:'2026-09-01',fin:'2026-09-30',estado:'AUT',motivo:'Prueba'},{ini:'2026-10-01',fin:'2026-10-05',estado:'NO',motivo:''}]");
  api.__ev("DISPOSITIVOS['Dispositivo-LECTOR 1']='INTERIOR'; DISPOSITIVOS['Dispositivo-LECTOR 2']='PORTERIA'");
  api.__ev("KPI_EXCL.add('TARJETA'); KPI_EXCL.add('SNAPIT')");
  api.__ev("ROT.noConf.add('2026-04'); ROT.noConf.add('2026-07')");
  api.__ev("COLS_OCULTAS.add('acum'); COLS_CONS_OCULTAS.add('cargo'); COLS_ASIS_OCULTAS.add('pct')");
}
function limpiar(api) {
  api.restaurarParametros();
  api.__ev("Object.keys(PERFILES).forEach(k=>delete PERFILES[k]); Object.keys(AUTOR).forEach(k=>delete AUTOR[k]); Object.keys(DISPOSITIVOS).forEach(k=>delete DISPOSITIVOS[k])");
  api.__ev("CONFIANZA = new Set(); KPI_EXCL = new Set(); ROT.noConf.clear(); COLS_OCULTAS = new Set(); COLS_CONS_OCULTAS = new Set(); COLS_ASIS_OCULTAS = new Set()");
}
const sinFecha = t => t.replace(/"generado":"[^"]*"/, '"generado":"X"');
const textosExportados = {};

async function main() {
for (const [nombre, html] of Object.entries(FILES)) {
  console.log(`── ${nombre}`);
  const esFull = nombre === 'COMPLETO';
  let api = nuevo(html);

  /* A. PARAM_IDS == readConfig == controles del HTML; defaults del HTML */
  const ids = api.__ev('PARAM_IDS'), guardar = api.__ev('PARAM_GUARDAR');
  const leidos = [...api.readConfig.toString().matchAll(/\bv\('(\w+)'\)/g)].map(m => m[1]);
  ok('PARAM_IDS == los ids que lee readConfig()', J([...new Set(leidos)].sort()) === J([...ids].sort()), `${ids.length} ids`);
  const enHtml = [...api.__fuente.matchAll(/<(?:input|select)\b[^>]*\bid="(c[A-Z]\w*)"/g)].map(m => m[1]);
  ok('PARAM_IDS == los controles c* declarados en el HTML', J([...new Set(enHtml)].sort()) === J([...ids].sort()), `${enHtml.length} controles`);
  ok('el rango del ciclo no se guarda ni se exporta (PARAM_GUARDAR sin cIni/cFin)', !guardar.includes('cIni') && !guardar.includes('cFin') && guardar.length === ids.length - 2);
  const defs = api.__ev('PARAM_DEFAULTS');
  ok('PARAM_DEFAULTS son los del HTML para cada parametro', guardar.every(k => defs[k] === api.__defaults[k].value), guardar.filter(k => defs[k] !== api.__defaults[k].value).join(','));
  ok('defaults conocidos: cUmbral 42, cEscPrimer 25, cDom 1, cSemHora 22:00', defs.cUmbral === '42' && defs.cEscPrimer === '25' && defs.cDom === '1' && defs.cSemHora === '22:00');
  ok('sin nada guardado el formulario queda con los defaults', J(api.leerParametrosForm()) === J(defs));

  /* B. mb_params al abrir */
  const defaultsHtml = api.leerParametrosForm();
  const huellaBase = (() => { api.runCalc(); return huella(api); })();
  ok('calculo sin errores y con invariantes en cero', api.__errores.length === 0 && (i => i.i1 + i.i2 + i.i3)(invariantes(api.__ev('RESULT'))) === 0, api.__errores.slice(0, 1).join(''));
  const guardado = { cUmbral: '40', cAdmin: 'T_X', cSemHora: '21:30', cZzz: '9', cDom: '7', cTolIni: 'abc', cIni: '2020-01-01', cRedon: 'ciclo' };
  api = cargar(html, { store: { mb_params: J(guardado) } });
  const f = api.leerParametrosForm();
  ok('mb_params se aplica al abrir (cUmbral, cAdmin, cSemHora, cRedon)', f.cUmbral === '40' && f.cAdmin === 'T_X' && f.cSemHora === '21:30' && f.cRedon === 'ciclo');
  ok('un id desconocido (cZzz) se ignora sin error', !('cZzz' in f) && api.__errores.length === 0);
  ok('un valor invalido (select cDom=7, numero cTolIni=abc) se ignora y queda el default', f.cDom === '1' && f.cTolIni === '120');
  ok('el rango del ciclo guardado se ignora (cIni queda vacio)', api.__mk('#cIni').value === '');
  ok('los defaults capturados NO cambian por lo guardado', api.__ev('PARAM_DEFAULTS').cUmbral === '42' && api.__ev('PARAM_DEFAULTS').cRedon === 'dia');
  for (const malo of ['{no es json', '[1,2]', '"texto"', 'null']) {
    const a2 = cargar(html, { store: { mb_params: malo } });
    ok(`mb_params corrupto (${malo}) no rompe la carga ni cambia nada`, a2.__errores.length === 0 && J(a2.leerParametrosForm()) === J(defaultsHtml));
  }

  /* C. guardar, restaurar y cableado */
  api = nuevo(html);
  api.__set('cUmbral', '39'); api.__set('cIni', '2026-09-01');
  api.guardarParametros();
  const g = JSON.parse(ls('mb_params'));
  ok('guardarParametros guarda SOLO lo que difiere del default (y nunca el rango)', J(g) === '{"cUmbral":"39"}');
  api.__set('cUmbral', defs.cUmbral); api.guardarParametros();
  ok('sin cambios mb_params queda en {} (un default nuevo en otra version llegaria a todos)', ls('mb_params') === '{}');
  api.__set('cUmbral', '39'); api.guardarParametros();
  api.runCalc();
  api.__set('cUmbral', '38'); api.runCalc();
  ok('runCalc guarda los parametros con los que calculo', JSON.parse(ls('mb_params')).cUmbral === '38');
  api.restaurarParametros();
  ok('restaurarParametros: el formulario vuelve a los defaults del HTML y se borra lo guardado', J(api.leerParametrosForm()) === J(defs) && ls('mb_params') === '{}' && api.__mk('#cIni').value === '2026-09-01');
  // botones: cableado real contra el mock (se capturan los listeners antes de DOMContentLoaded)
  api = nuevo(html);
  const oyentes = {};
  ids.forEach(k => { const e = api.__mk('#' + k); e.addEventListener = (ev, fn) => { (oyentes[k] = oyentes[k] || []).push([ev, fn]); }; });
  api.__dom();
  ok('DOMContentLoaded sin errores de consola', api.__errores.length === 0, api.__errores.slice(0, 1).join(''));
  api.runCalc(); const R0 = api.__ev('RESULT');
  api.__set('cUmbral', '41');
  if (esFull) {
    ok('completo: los 34 parametros escuchan el cambio (todos salen de PARAM_IDS)', ids.every(k => (oyentes[k] || []).some(([ev]) => ev === 'change')), ids.filter(k => !(oyentes[k] || []).length).join(','));
    oyentes.cEscPrimer.forEach(([, fn]) => fn());
    ok('completo: cambiar un parametro (cEscPrimer, antes sin escucha) guarda y recalcula', api.__ev('RESULT') !== R0 && JSON.parse(ls('mb_params')).cUmbral === '41');
  } else {
    ok('rrhh: solo cIni/cFin escuchan el cambio; el resto se aplica con "Aplicar y recalcular"', ids.every(k => ((oyentes[k] || []).length > 0) === esCiclo(k)));
    oyentes.cIni.forEach(([, fn]) => fn());
    ok('rrhh: cambiar el rango recalcula', api.__ev('RESULT') !== R0);
    const R1 = api.__ev('RESULT'); api.__set('cUmbral', '43');
    ok('rrhh: editar un parametro NO recalcula ni guarda hasta aplicar', api.__ev('RESULT') === R1 && JSON.parse(ls('mb_params')).cUmbral !== '43');
    api.__mk('#btnGearApply').onclick();
    ok('rrhh: "Aplicar y recalcular" guarda y recalcula', api.__ev('RESULT') !== R1 && JSON.parse(ls('mb_params')).cUmbral === '43' && api.__ev('RESULT').cfg.umbral === 43);
  }
  const Rr = api.__ev('RESULT'); api.__set('cUmbral', '47'); api.guardarParametros();
  global.confirm = () => false; api.__mk('#btnParamsReset').onclick();
  ok('"Restaurar parametros por defecto": si se cancela el confirm no cambia nada', api.leerParametrosForm().cUmbral === '47' && api.__ev('RESULT') === Rr);
  global.confirm = () => true; api.__mk('#btnParamsReset').onclick();
  ok('"Restaurar parametros por defecto": confirmado vuelve a los defaults y lo guardado queda en los defaults', api.leerParametrosForm().cUmbral === '42' && (ls('mb_params') === '{}' || J(JSON.parse(ls('mb_params'))) === J(defs)));
  ok(esFull ? 'completo: restaurar recalcula' : 'rrhh: restaurar NO recalcula (se aplica con el boton)', esFull ? api.__ev('RESULT') !== Rr : api.__ev('RESULT') === Rr);

  /* D. formato exacto del archivo */
  api = nuevo(html); api.__dom(); api.runCalc(); poblar(api);
  const cfg = api.configArmar(new Date(2026, 10, 17, 10, 30, 5));
  ok('claves en el orden del plan', J(Object.keys(cfg)) === J(['formato', 'version', 'generado', 'herramienta', 'parametros', 'perfiles', 'confianza', 'autorizaciones', 'dispositivos', 'ajustesHorario', 'alcance', 'rotacion', 'columnas']));
  ok('formato mod_bio-config, version 1, generado AAAA-MM-DDTHH:MM:SS', cfg.formato === 'mod_bio-config' && cfg.version === 1 && cfg.generado === '2026-11-17T10:30:05');
  ok(`herramienta = ${esFull ? 'completa' : 'rrhh'}`, cfg.herramienta === (esFull ? 'completa' : 'rrhh'));
  ok('ajustesHorario existe y es []', Array.isArray(cfg.ajustesHorario) && cfg.ajustesHorario.length === 0);
  ok('las 9 secciones traen lo poblado', cfg.parametros.cUmbral === '40' && cfg.perfiles['9501'] === 'ADMINISTRATIVO' && J(cfg.confianza) === '["9503"]'
    && cfg.autorizaciones['9504'].length === 2 && cfg.dispositivos['Dispositivo-LECTOR 1'] === 'INTERIOR'
    && J(cfg.alcance) === '{"deptosExcluidos":["SNAPIT","TARJETA"]}' && J(cfg.rotacion) === '{"mesesNoConfiables":["2026-04","2026-07"]}'
    && J(cfg.columnas) === '{"detalle":["acum"],"consolidado":["cargo"],"asistencia":["pct"]}');
  ok('los parametros exportados no incluyen el rango del ciclo y son todos texto', !('cIni' in cfg.parametros) && !('cFin' in cfg.parametros) && Object.keys(cfg.parametros).length === guardar.length && Object.values(cfg.parametros).every(v => typeof v === 'string'));
  ok('el nombre es mod_bio_config_AAAA-MM-DD_HHmm.json', api.configNombre(new Date(2026, 10, 17, 10, 30, 5)) === 'mod_bio_config_2026-11-17_1030.json' && api.configNombre(new Date(2026, 0, 5, 9, 7)) === 'mod_bio_config_2026-01-05_0907.json');
  const texto0 = J(cfg);
  ok('no lleva los Excel ni la lactancia ni nombres de personas', !/"(emp|tur|hor|mar|ren|lac|nombre|nombres)"/.test(texto0) && !/PRUEBA|CFG95/.test(texto0));

  /* exportarConfig: descarga real contra el mock */
  let blob = null, descarga = null;
  global.URL.createObjectURL = b => { blob = b; return 'blob:x'; };
  global.document.createElement = () => { const a = { click() { descarga = a.download; } }; return a; };
  api.__mk('#btnExportCfg').onclick();
  const exportado = JSON.parse(blob.p[0]);
  ok('exportarConfig descarga un .json con el nombre del plan', /^mod_bio_config_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(descarga || ''), descarga);
  ok('el contenido descargado es la configuracion en memoria', J({ ...exportado, generado: 'X' }) === J({ ...JSON.parse(texto0), generado: 'X' }));
  textosExportados[nombre] = blob.p[0];

  /* E. ida y vuelta de las 9 secciones */
  const antes = sinFecha(estado(api)), almacenAntes = ['mb_perfiles', 'mb_confianza', 'mb_autor', 'mb_dispositivos', 'mb_kpi_excl', 'mb_rot_meses', 'mb_colsDet', 'mb_colsCons', 'mb_colsAsis'];
  api.__set('cUmbral', '40'); api.runCalc(); const huellaCon = huella(api);
  limpiar(api); api.runCalc();
  ok('limpiar deja todo en blanco', sinFecha(estado(api)) !== antes && Object.keys(api.configArmar().perfiles).length === 0 && api.configArmar().parametros.cUmbral === '42');
  const P = api.__ev('PERFILES'), A = api.__ev('AUTOR'), DSP = api.__ev('DISPOSITIVOS'), NC = api.__ev('ROT').noConf;
  const marcaDatos = api.DATA.mar;                                   // los Excel cargados deben sobrevivir
  api.__mk('body').dataset.modo = 'setup';
  let abierto = 0, cerrado = 0;
  api.__mk('#dlgImportCfg').showModal = () => abierto++; api.__mk('#dlgImportCfg').close = () => cerrado++;
  const Rantes = api.__ev('RESULT');
  const r = api.abrirImportCfg(texto0, 'mi_config.json');
  const vista = api.__mk('#cfgImpBody').innerHTML;
  ok('vista previa: abre el dialogo, habilita "Reemplazar" y no aplica nada todavia', abierto === 1 && api.__mk('#btnCfgImpOk').disabled === false && r.ok && Object.keys(api.__ev('PERFILES')).length === 0);
  ok('vista previa: conteo por seccion con "ahora"', /Perfiles manuales: <b>2<\/b>[^]*\(ahora: 0\)/.test(vista) && /Dirección y confianza: <b>1<\/b>/.test(vista) && /Autorizaciones de extras: <b>1 personas, 2 rangos<\/b>/.test(vista)
    && /Roles de dispositivos: <b>2<\/b>/.test(vista) && /Departamentos excluidos del alcance: <b>2<\/b>/.test(vista) && /Meses de rotación no confiables: <b>2<\/b>/.test(vista) && /Columnas ocultas:/.test(vista));
  ok('vista previa: lista los parametros que cambian "ahora → nuevo"', /Parámetros que cambian/.test(vista) && /cUmbral[^]*<td>42<\/td><td><b>40<\/b>/.test(vista) && /cAdmin[^]*<td>T_ADM<\/td><td><b>T_X<\/b>/.test(vista));
  ok('vista previa: el select se muestra con su texto, no con su valor (cDom 1 -> 0)', /cDom/.test(vista) && /<td>Sí<\/td><td><b>No<\/b><\/td>/.test(vista));
  ok('vista previa: dice que no se recarga la pagina ni se tocan los Excel', /No se recarga la página/.test(vista));
  api.confirmarImportCfg();
  ok('Reemplazar: cierra el dialogo y deja el estado identico al exportado', cerrado === 1 && sinFecha(estado(api)) === antes);
  ok('los globales se mutaron EN SITIO (mismos objetos PERFILES, AUTOR, DISPOSITIVOS, ROT.noConf)', P === api.__ev('PERFILES') && A === api.__ev('AUTOR') && DSP === api.__ev('DISPOSITIVOS') && NC === api.__ev('ROT').noConf
    && P['9501'] === 'ADMINISTRATIVO' && A['9504'].length === 2 && DSP['Dispositivo-LECTOR 2'] === 'PORTERIA' && NC.has('2026-07'));
  ok('lo que es let se reasigno: CONFIANZA, KPI_EXCL y las columnas', api.__ev('CONFIANZA.has("9503") && KPI_EXCL.has("TARJETA") && COLS_OCULTAS.has("acum") && COLS_CONS_OCULTAS.has("cargo") && COLS_ASIS_OCULTAS.has("pct")'));
  ok('las exclusiones importadas activan el modo "todos menos estos" del Alcance', api.__ev('ALC.modoDep') === 'excluir');
  ok('localStorage refleja cada seccion', almacenAntes.every(k => ls(k) !== null) && J(JSON.parse(ls('mb_perfiles'))) === J(texto0 && JSON.parse(texto0).perfiles) && ls('mb_kpi_excl') === '["SNAPIT","TARJETA"]'
    && ls('mb_rot_meses') === '["2026-04","2026-07"]' && ls('mb_colsDet') === '["acum"]' && JSON.parse(ls('mb_params')).cUmbral === '40');
  ok('NUNCA recarga ni pierde los Excel cargados (DATA intacta)', api.DATA.mar === marcaDatos && api.DATA.emp && api.DATA.tur && api.DATA.hor);
  ok('recalcula con lo importado (RESULT nuevo, umbral 40) y reproduce la huella', api.__ev('RESULT') !== Rantes && api.__ev('RESULT').cfg.umbral === 40 && huella(api) === huellaCon);
  ok('recalcular no cambia de pantalla (sigue en "setup")', api.__mk('body').dataset.modo === 'setup');
  ok('ida y vuelta sin errores de consola', api.__errores.length === 0, api.__errores.slice(0, 1).join(' | '));

  /* sin RESULT tambien aplica (no hay nada que recalcular) */
  const sinCalc = cargar(html);
  sinCalc.abrirImportCfg(texto0, 'x.json'); sinCalc.confirmarImportCfg();
  ok('sin calculo previo tambien se importa (sin recalcular ni romper)', sinFecha(estado(sinCalc)) === antes && sinCalc.__errores.length === 0 && sinCalc.__ev('RESULT') === null && JSON.parse(ls('mb_params')).cUmbral === '40');

  /* F. archivos invalidos: ni un cambio, ni parcial */
  api = nuevo(html); api.runCalc(); poblar(api); api.guardarParametros();
  api.__ev("PERFILES['9505']='ROTATIVO'");
  const base = J({ e: estado(api), f: api.leerParametrosForm(), s: ['mb_perfiles', 'mb_params', 'mb_kpi_excl', 'mb_colsCons', 'mb_autor'].map(ls) });
  const snapshot = () => J({ e: estado(api), f: api.leerParametrosForm(), s: ['mb_perfiles', 'mb_params', 'mb_kpi_excl', 'mb_colsCons', 'mb_autor'].map(ls) });
  const v1 = o => J({ formato: 'mod_bio-config', version: 1, ...o });
  const MALOS = [
    ['JSON roto', '{"formato":'], ['vacio', ''], ['una lista', '[]'], ['un texto', '"hola"'], ['null', 'null'],
    ['formato ajeno', J({ formato: 'otra-cosa', version: 1 })], ['sin formato', J({ version: 1, parametros: {} })],
    ['version futura (2)', J({ formato: 'mod_bio-config', version: 2 })], ['version texto', J({ formato: 'mod_bio-config', version: '1' })],
    ['version 0', J({ formato: 'mod_bio-config', version: 0 })], ['version 1.5', J({ formato: 'mod_bio-config', version: 1.5 })], ['sin version', J({ formato: 'mod_bio-config' })],
    ['parametros: lista', v1({ parametros: [] })], ['parametros: null', v1({ parametros: null })], ['parametros: numero en vez de texto', v1({ parametros: { cUmbral: 42 } })],
    ['parametros: opcion de select inexistente', v1({ parametros: { cDom: '7' } })], ['parametros: numero ilegible', v1({ parametros: { cTolIni: 'abc' } })],
    ['parametros: fecha mal escrita', v1({ parametros: { cCorte: '15/07/2026' } })], ['parametros: hora mal escrita', v1({ parametros: { cSemHora: 'tarde' } })],
    ['perfiles: lista', v1({ perfiles: [] })], ['perfiles: null', v1({ perfiles: null })], ['perfiles: rol inexistente', v1({ perfiles: { 9501: 'JEFE' } })],
    ['perfiles: clave __proto__', '{"formato":"mod_bio-config","version":1,"perfiles":{"__proto__":"ROTATIVO"}}'],
    ['confianza: texto', v1({ confianza: '9503' })], ['confianza: numeros', v1({ confianza: [9503] })], ['confianza: vacio', v1({ confianza: [''] })],
    ['autorizaciones: lista', v1({ autorizaciones: [] })], ['autorizaciones: valor no lista', v1({ autorizaciones: { 9504: {} } })],
    ['autorizaciones: fecha imposible', v1({ autorizaciones: { 9504: [{ ini: '2026-02-30', fin: '2026-03-01', estado: 'AUT' }] } })],
    ['autorizaciones: ini > fin', v1({ autorizaciones: { 9504: [{ ini: '2026-09-10', fin: '2026-09-01', estado: 'AUT' }] } })],
    ['autorizaciones: estado inexistente', v1({ autorizaciones: { 9504: [{ ini: '2026-09-01', fin: '2026-09-02', estado: 'X' }] } })],
    ['autorizaciones: motivo numerico', v1({ autorizaciones: { 9504: [{ ini: '2026-09-01', fin: '2026-09-02', estado: 'NO', motivo: 5 }] } })],
    ['dispositivos: rol inexistente', v1({ dispositivos: { D1: 'XX' } })], ['dispositivos: lista', v1({ dispositivos: [] })],
    ['ajustesHorario: objeto', v1({ ajustesHorario: {} })], ['ajustesHorario: texto', v1({ ajustesHorario: 'a' })],
    ['alcance: lista', v1({ alcance: [] })], ['alcance: deptosExcluidos texto', v1({ alcance: { deptosExcluidos: 'A' } })],
    ['rotacion: mes imposible', v1({ rotacion: { mesesNoConfiables: ['2026-13'] } })], ['rotacion: mes mal escrito', v1({ rotacion: { mesesNoConfiables: ['abril'] } })], ['rotacion: lista', v1({ rotacion: [] })],
    ['columnas: lista', v1({ columnas: [] })], ['columnas: detalle con numeros', v1({ columnas: { detalle: [1] } })], ['columnas: consolidado texto', v1({ columnas: { consolidado: 'x' } })],
    ['ATOMICO: secciones buenas + una mala (rotacion)', v1({ parametros: { cUmbral: '55' }, perfiles: { 9599: 'ROTATIVO' }, confianza: ['9598'], rotacion: { mesesNoConfiables: ['2026-99'] } })],
    ['ATOMICO: parametros buenos + dispositivo malo', v1({ parametros: { cUmbral: '55' }, dispositivos: { D9: 'NOPE' } })],
  ];
  let aplicadoDeMas = [], noRechazado = [], habilitado = [];
  for (const [desc, t] of MALOS) {
    const r = api.configValidar(t);
    if (r.ok || !r.errores.length) noRechazado.push(desc);
    api.abrirImportCfg(t, 'malo.json');
    if (api.__mk('#btnCfgImpOk').disabled !== true || api.__ev('CFG_PEND') !== null) habilitado.push(desc);
    api.confirmarImportCfg();
    if (snapshot() !== base) aplicadoDeMas.push(desc);
  }
  ok(`${MALOS.length} archivos invalidos: todos rechazados con su motivo`, noRechazado.length === 0, noRechazado.join(' | '));
  ok('invalidos: "Reemplazar" queda deshabilitado y no hay nada pendiente', habilitado.length === 0, habilitado.join(' | '));
  ok('invalidos: NO cambia ningun estado (ni parametros, ni localStorage), ni parcialmente', aplicadoDeMas.length === 0, aplicadoDeMas.join(' | '));
  api.abrirImportCfg('{"formato":', 'roto.json');
  ok('un archivo roto muestra el error en el dialogo', /No se puede importar/.test(api.__mk('#cfgImpBody').innerHTML) && /JSON legible/.test(api.__mk('#cfgImpBody').innerHTML));
  api.abrirImportCfg(v1({ perfiles: { 9501: 'JEFE' }, rotacion: { mesesNoConfiables: ['2026-13'] } }), 'dos.json');
  ok('se listan TODOS los errores, no solo el primero', (api.__mk('#cfgImpBody').innerHTML.match(/<li>/g) || []).length >= 2);

  /* G. validos y tolerancias */
  const minimo = api.configValidar(J({ formato: 'mod_bio-config', version: 1 }));
  ok('lo minimo (formato + version) es valido y no trae datos', minimo.ok && Object.keys(minimo.datos).length === 0);
  api.abrirImportCfg(J({ formato: 'mod_bio-config', version: 1 }), 'min.json'); api.confirmarImportCfg();
  ok('una seccion ausente NO se borra (se conserva lo actual)', snapshot() === base);
  api.abrirImportCfg(J({ formato: 'mod_bio-config', version: 1, perfiles: { 9501: 'ROTATIVO' } }), 'p.json'); api.confirmarImportCfg();
  ok('solo se reemplaza lo que el archivo trae (perfiles) y lo demas queda', api.__ev('PERFILES["9501"]') === 'ROTATIVO' && api.__ev('PERFILES["9505"]') === undefined && api.__ev('PERFILES["9502"]') === undefined
    && api.__ev('CONFIANZA.has("9503")') && api.leerParametrosForm().cUmbral === '40');
  const vacia = api.configValidar(J({ formato: 'mod_bio-config', version: 1, perfiles: {}, confianza: [], autorizaciones: {}, dispositivos: {}, ajustesHorario: [], alcance: { deptosExcluidos: [] }, rotacion: { mesesNoConfiables: [] }, columnas: { detalle: [], consolidado: [], asistencia: [] } }));
  ok('secciones vacias son validas', vacia.ok && vacia.avisos.length === 0);
  const raras = api.configValidar(J({ formato: 'mod_bio-config', version: 1, futuro: 1, alcance: { otra: 1 }, columnas: { otra: [] }, parametros: { cZzz: '1', cIni: '2020-01-01' } }));
  ok('claves y parametros desconocidos: aviso y se ignoran (no es error)', raras.ok && raras.avisos.length === 5 && !('cZzz' in raras.datos.parametros) && !('cIni' in raras.datos.parametros), raras.avisos.length + '');
  const conAj = api.configValidar(J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [{ emp: '9501' }, { emp: '9502' }] }));
  ok('ajustesHorario con datos: se tolera, se avisa y no se aplica', conAj.ok && conAj.datos.ajustesHorario === 2 && conAj.avisos.some(a => /ajustes de horario/i.test(a)));
  api.abrirImportCfg(J({ formato: 'mod_bio-config', version: 1, ajustesHorario: [{ emp: '9501' }] }), 'aj.json'); api.confirmarImportCfg();
  ok('ajustesHorario no escribe ninguna llave nueva en localStorage', ls('mb_ajustes_horario') === null && api.configArmar().ajustesHorario.length === 0);
  api.abrirImportCfg(J({ formato: 'mod_bio-config', version: 1, 'clave<img src=x onerror=1>': 1 }), '<b>n</b>.json');
  const cuerpo = api.__mk('#cfgImpBody').innerHTML;
  ok('lo que viene del archivo se escapa en la vista previa (sin HTML inyectado)', !/<img/.test(cuerpo) && !/<b>n<\/b>/.test(cuerpo) && /&lt;img/.test(cuerpo));
  const dup = api.configValidar(J({ formato: 'mod_bio-config', version: 1, confianza: ['1', ' 1 ', '2'], alcance: { deptosExcluidos: ['tarjeta', 'TARJETA'] } }));
  ok('se normalizan repetidos y mayusculas de departamentos', J(dup.datos.confianza) === '["1","2"]' && J(dup.datos.deptosExcluidos) === '["TARJETA"]');

  /* H. cableado del boton Importar (selector de archivo) */
  api = nuevo(html); api.runCalc();
  api.__dom();
  let abre = 0; api.__mk('#fImportCfg').click = () => abre++;
  api.__mk('#btnImportCfg').onclick();
  ok('"Importar configuracion" abre el selector de archivo', abre === 1);
  const sel = api.__mk('#fImportCfg'); sel.files = [{ name: 'x.json', text: async () => texto0 }]; sel.value = 'C:\\x.json';
  let abierto2 = 0; api.__mk('#dlgImportCfg').showModal = () => abierto2++;
  await api.__mk('#fImportCfg').onchange({ target: sel });
  {
    ok('elegir el archivo abre la vista previa y deja elegir el mismo de nuevo', abierto2 === 1 && sel.value === '' && api.__ev('CFG_PEND') !== null);
    api.__mk('#btnCfgImpCancel').onclick();
    ok('Cancelar descarta lo pendiente sin aplicar', api.__ev('CFG_PEND') === null && api.leerParametrosForm().cUmbral === '42');
    api.abrirImportCfg(texto0, 'x.json'); api.__mk('#btnCfgImpOk').onclick();
    ok('el boton Reemplazar aplica', api.leerParametrosForm().cUmbral === '40' && api.__ev('PERFILES["9501"]') === 'ADMINISTRATIVO');
  }

  /* I. sin tocar nada: la nomina y las exportaciones son las de siempre */
  // (cada motor usa el DOM/localStorage globales del ULTIMO cargado: se corren de uno en uno)
  const a0 = nuevo(html); a0.runCalc(); const h0 = huella(a0), ids0 = J(a0.__ev('RESULT').cons.map(c => c.emp.id));
  const a1 = nuevo(html, { mb_params: J(defaultsHtml) }); a1.runCalc(); const h1 = huella(a1);
  ok('con mb_params igual a los defaults la nomina y el Consolidado son identicos a no tener nada guardado', h0 === h1 && h0 === huellaBase);
  const a2 = nuevo(html); a2.runCalc();
  a2.abrirImportCfg(J(a2.configArmar()), 'mismo.json'); a2.confirmarImportCfg();
  ok('exportar e importar sin cambiar nada deja la huella intacta', huella(a2) === h0 && J(a2.__ev('RESULT').cons.map(c => c.emp.id)) === ids0);
}

/* J. cada archivo importa el .json del otro y los formatos son los mismos */
const [nA, nB] = Object.keys(FILES);
const A = JSON.parse(textosExportados[nA]), B = JSON.parse(textosExportados[nB]);
ok('los dos archivos exportan el mismo formato (mismas claves y version)', J(Object.keys(A)) === J(Object.keys(B)) && A.version === B.version && A.formato === B.formato);
ok('a igual estado, igual contenido (solo cambia generado y herramienta)', J({ ...A, generado: 0, herramienta: 0 }) === J({ ...B, generado: 0, herramienta: 0 }));
ok('herramienta distingue el origen', A.herramienta === 'completa' && B.herramienta === 'rrhh');
for (const [origen, destino] of [[nA, nB], [nB, nA]]) {
  const api = cargar(FILES[destino], { inputs: { cIni: '2026-09-01', cFin: '2026-09-30' } });
  const r = api.abrirImportCfg(textosExportados[origen], 'cruzado.json');
  api.confirmarImportCfg();
  const E = JSON.parse(textosExportados[origen]), D = api.configArmar();
  ok(`${destino} importa el .json de ${origen} y queda con el mismo estado`, r.ok && J({ ...D, generado: 0, herramienta: 0 }) === J({ ...E, generado: 0, herramienta: 0 }) && api.__errores.length === 0, r.errores.join(' | '));
}


/* K. regresiones de la revision de la Fase A */
for (const [nombre, html] of Object.entries(FILES)) {
  console.log(`── ${nombre} (regresiones de la revision)`);
  const v1 = o => J({ formato: 'mod_bio-config', version: 1, ...o });

  /* 1. inyeccion de CSS por las claves de columnas */
  const veneno = 'x"]{display:none} body{display:none} #q[a="';
  let api = nuevo(html); api.runCalc();
  const antes = J(api.configArmar(new Date(2026, 0, 1)));
  const exacto = '{"formato":"mod_bio-config","version":1,"columnas":{"detalle":["x\\"]{display:none} body{display:none} #q[a=\\""]}}';
  const rExacto = api.configValidar(exacto);
  ok('columnas: el caso exacto del informe se RECHAZA (error, import completo abortado)', !rExacto.ok && rExacto.datos === null && rExacto.errores.some(e => /Columnas ocultas/.test(e)));
  api.abrirImportCfg(exacto, 'veneno.json'); api.confirmarImportCfg();
  ok('columnas: tras intentar importarlo no cambia nada y el CSS no se contamina', J(api.configArmar(new Date(2026, 0, 1))) === antes && !/body\{/.test(api.__mk('#colDetStyle').textContent));
  for (const k of ['a b', 'a"b', 'a]b', 'a{b', 'a;b', '', 'a\nb', 'x"] {', 'c-02 20']) {
    ok(`columnas: la clave ${J(k)} se rechaza en detalle, consolidado y asistencia`, ['detalle', 'consolidado', 'asistencia'].every(s => !api.configValidar(v1({ columnas: { [s]: [k] } })).ok));
  }
  ok('columnas: las claves reales (acum, c-0220, dep, cargo, pct) siguen aceptandose', api.configValidar(v1({ columnas: { detalle: ['acum', 'c-0220'], consolidado: ['dep', 'cargo'], asistencia: ['pct'] } })).ok);
  const sucio = { mb_colsDet: J([veneno, 'acum', 5, null, 'c-0220']), mb_colsCons: J(['a b', 'cargo', '}body{']), mb_colsAsis: J({ no: 'lista' }) };
  api = cargar(html, { store: sucio });
  ok('localStorage envenenado al abrir: solo sobreviven claves seguras (detalle, consolidado) y una no-lista queda vacia (asistencia)',
    J([...api.__ev('COLS_OCULTAS')]) === '["acum","c-0220"]' && J([...api.__ev('COLS_CONS_OCULTAS')]) === '["cargo"]' && api.__ev('COLS_ASIS_OCULTAS').size === 0 && api.__errores.length === 0);
  api.aplicarCols(); api.aplicarColsCons(); api.aplicarColsAsis();
  ok('localStorage envenenado: el CSS generado no trae nada inyectado', !/body|display:none\}[^]*display:none\} body/.test(api.__mk('#colDetStyle').textContent + api.__mk('#colConsStyle').textContent + api.__mk('#colAsisStyle').textContent)
    && api.__mk('#colDetStyle').textContent === '#tDet [data-col="acum"]{display:none}#tDet [data-col="c-0220"]{display:none}');
  api = cargar(html, { store: { mb_colsDet: '{roto', mb_colsCons: 'null', mb_colsAsis: '"x"' } });
  ok('localStorage de columnas corrupto: no rompe la carga y queda vacio', api.__errores.length === 0 && api.__ev('COLS_OCULTAS').size === 0 && api.__ev('COLS_CONS_OCULTAS').size === 0 && api.__ev('COLS_ASIS_OCULTAS').size === 0);

  /* 2. mb_params es un diff */
  api = nuevo(html); api.runCalc();
  ok('mb_params tras calcular sin tocar nada es {}', global.localStorage.getItem('mb_params') === '{}');
  api.__set('cUmbral', '40'); api.__set('cDom', '0'); api.runCalc();
  ok('mb_params guarda solo los que difieren (cUmbral, cDom)', J(JSON.parse(global.localStorage.getItem('mb_params'))) === '{"cUmbral":"40","cDom":"0"}');
  ok('el archivo exportado SI lleva todos los parametros (no es un diff)', Object.keys(api.configArmar().parametros).length === api.__ev('PARAM_GUARDAR').length);

  /* 3. paramValido tan estricto como el navegador */
  api = nuevo(html);
  const bad = { cTolPunt: ['-5', ' 5', '5 ', '0x10', '1e308', 'NaN', 'Infinity', '-Infinity', '1e999', '5,5', '--5', '5.', '.5', '+5'], cAusAviso: ['0', '-1'], cEscGracia: ['1e999', '-1', '9999999', 'abc'],
    cSemHora: ['25:00', '24:00', '12:60', '9:30', 'tarde', '12:30:99'], cCorte: ['2026-13-45', '2026-02-30', '2026-00-10', '26-01-01', '2026-1-1'] };
  const bien = { cTolPunt: ['0', '5', '12.5'], cAusAviso: ['1', '3'], cEscGracia: ['0', '10', '29'], cSemHora: ['00:00', '23:59', '22:00', '07:05:30'], cCorte: ['2026-02-28', '2024-02-29', ''] };
  let maloAcepta = [], buenoRechaza = [];
  Object.entries(bad).forEach(([k, l]) => l.forEach(v => { if (api.paramValido(k, v) || api.configValidar(v1({ parametros: { [k]: v } })).ok) maloAcepta.push(k + '=' + v); }));
  Object.entries(bien).forEach(([k, l]) => l.forEach(v => { if (!api.paramValido(k, v) || !api.configValidar(v1({ parametros: { [k]: v } })).ok) buenoRechaza.push(k + '=' + v); }));
  ok('parametros: valores que el navegador no aceptaria se rechazan (espacios, 0x10, 1e308, NaN, Infinity, negativos con min>=0, min/max, hora y fecha reales)', maloAcepta.length === 0, maloAcepta.join(' '));
  ok('parametros: los valores normales siguen aceptandose', buenoRechaza.length === 0, buenoRechaza.join(' '));
  ok('parametros: un numero sin tope en el HTML tampoco pasa de 1e6', !api.paramValido('cEscPrimer', '1000001') && api.paramValido('cEscPrimer', '1000000'));
  const guardadoMalo = { cTolPunt: '-5', cEscGracia: '1e999', cDoble: ' 5', cTolIni: '0x10', cLactMin6: '1e308', cEscPrimer: 'NaN', cAusAviso: '0', cCorte: '2026-13-45', cSemHora: '25:00', cUmbral: 'Infinity', cExtraPaso: '45', cTolFin: '200' };
  api = cargar(html, { store: { mb_params: J(guardadoMalo) } });
  const f = api.leerParametrosForm(), d0 = api.__ev('PARAM_DEFAULTS');
  ok('mb_params ya guardado con valores invalidos: se descartan (quedan los defaults) y los validos se aplican',
    ['cTolPunt', 'cEscGracia', 'cDoble', 'cTolIni', 'cLactMin6', 'cEscPrimer', 'cAusAviso', 'cCorte', 'cSemHora', 'cUmbral'].every(k => f[k] === d0[k]) && f.cExtraPaso === '45' && f.cTolFin === '200' && api.__errores.length === 0);
  const esc = (m, g, p = 25) => api.escalera(m, { escPrimer: p, escGracia: g });
  ok('escalera con valores normales NO cambia (24->0, 25->0,5, 50->1, 80->1,5, 110->2, 140->2,5, 170->3)', [24, 25, 49, 50, 79, 80, 110, 140, 170].map(m => esc(m, 10)).join() === '0,0.5,0.5,1,1,1.5,2,2.5,3');
  const t0 = Date.now();
  const raros = [Infinity, -Infinity, NaN, 1e12, 1e308, -50, 30, 31, 200].map(g => esc(100, g));
  ok('escalera no se cuelga con gracia infinita, NaN, enorme o negativa y devuelve numeros', Date.now() - t0 < 500 && raros.every(x => Number.isFinite(x)), raros.join());
  ok('escalera con minutos enormes o no finitos tambien termina', Date.now() - t0 < 500 && esc(1e9, 10) <= 1000 && esc(Infinity, 10) === 0 && esc(NaN, 10) === 0);
  api = nuevo(html); api.__set('cEscGracia', '1e999'); api.__set('cEscPrimer', '1e999');
  const t1 = Date.now(); api.runCalc();
  ok('un formulario con 1e999 en la escalera calcula sin colgarse', Date.now() - t1 < 5000 && api.__errores.length === 0, api.__errores.slice(0, 1).join(''));

  /* 4. ids normalizados: el archivo solo lleva ids */
  api = nuevo(html); api.runCalc();
  const idMalos = [['perfiles: un nombre', v1({ perfiles: { 'JUAN PEREZ': 'ROTATIVO' } })], ['perfiles: solo espacios', v1({ perfiles: { '   ': 'ROTATIVO' } })], ['perfiles: clave vacia', v1({ perfiles: { '': 'ROTATIVO' } })],
    ['perfiles: con coma', v1({ perfiles: { 'PEREZ, JUAN': 'ROTATIVO' } })], ['perfiles: demasiado largo', v1({ perfiles: { ['1'.repeat(40)]: 'ROTATIVO' } })],
    ['confianza: un nombre', v1({ confianza: ['Juan Perez'] })], ['confianza: solo espacios', v1({ confianza: ['   '] })],
    ['autorizaciones: un nombre', v1({ autorizaciones: { 'Juan Perez': [{ ini: '2026-09-01', fin: '2026-09-02', estado: 'AUT' }] } })],
    ['perfiles: ids repetidos tras normalizar (0385 y 385)', v1({ perfiles: { '0385': 'ROTATIVO', '385': 'ADMINISTRATIVO' } })],
    ['autorizaciones: ids repetidos tras normalizar', v1({ autorizaciones: { ' 042': [{ ini: '2026-09-01', fin: '2026-09-02', estado: 'AUT' }], '42': [{ ini: '2026-09-01', fin: '2026-09-02', estado: 'NO' }] } })]];
  const aceptados = idMalos.filter(([, t]) => api.configValidar(t).ok).map(([d]) => d);
  ok('ids: nombres, vacios, repetidos y demasiado largos se rechazan', aceptados.length === 0, aceptados.join(' | '));
  const rOk = api.configValidar(v1({ perfiles: { ' 9501 ': 'ROTATIVO', '0385': 'ADMINISTRATIVO', 'EJEMPLO-1': 'ROTATIVO' }, confianza: [' 9503 ', '0042', '42', 'A.B'],
    autorizaciones: { ' 0007 ': [{ ini: '2026-09-01', fin: '2026-09-02', estado: 'AUT' }] } }));
  ok('ids: se recortan y pierden los ceros a la izquierda (como normId); ids con letras o guion siguen validos', rOk.ok && J(Object.keys(rOk.datos.perfiles).sort()) === '["385","9501","EJEMPLO-1"]' && J(rOk.datos.confianza) === '["9503","42","A.B"]' && J(Object.keys(rOk.datos.autorizaciones)) === '["7"]', J(rOk.errores));
  api.abrirImportCfg(v1({ perfiles: { ' 9501 ': 'ROTATIVO', '0385': 'ADMINISTRATIVO' } }), 'ids.json'); api.confirmarImportCfg();
  ok('ids: lo importado queda con la llave normalizada en PERFILES', api.__ev('PERFILES["9501"]') === 'ROTATIVO' && api.__ev('PERFILES["385"]') === 'ADMINISTRATIVO' && api.__ev('PERFILES[" 9501 "]') === undefined);
  ok('ids: la clave __proto__ sigue rechazada', !api.configValidar('{"formato":"mod_bio-config","version":1,"autorizaciones":{"__proto__":[]},"perfiles":{"__proto__":"ROTATIVO"}}').ok);
  ok('regresiones sin errores de consola', api.__errores.length === 0, api.__errores.slice(0, 1).join(' | '));
}
}
// rrhh: solo el rango del ciclo escucha el cambio
function esCiclo(k) { return k === 'cIni' || k === 'cFin'; }
main().then(() => { console.log(fallos ? 'FALLOS: ' + fallos : 'CONFIG OK'); process.exit(fallos ? 1 : 0); })
  .catch(e => { console.log('FALLA: excepcion no controlada: ' + (e && e.stack || e)); process.exit(1); });
