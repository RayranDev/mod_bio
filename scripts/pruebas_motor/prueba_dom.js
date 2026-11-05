'use strict';
// El cableado de DOMContentLoaded se ejecuta contra el mock que devuelve null para lo no declarado.
const { cargar, FILES } = require('./lib.js');
let fallos = 0;
for (const [n, f] of Object.entries(FILES)) {
  const api = cargar(f);
  try { api.__dom(); const e = api.__errores.length; console.log((e ? 'FALLA ' : 'OK    ') + n + ' DOMContentLoaded; errores de consola: ' + e); if (e) fallos++; }
  catch (e) { fallos++; console.log('FALLA ' + n + ' DOMContentLoaded lanza: ' + e.message.slice(0, 160)); }
}
console.log(fallos ? 'FALLOS: ' + fallos : 'DOM OK');
process.exit(fallos ? 1 : 0);
