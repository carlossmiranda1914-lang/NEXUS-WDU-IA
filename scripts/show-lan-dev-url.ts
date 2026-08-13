import os from 'node:os';

const interfaces = os.networkInterfaces();
const addresses = Object.entries(interfaces)
  .flatMap(([name, values]) => (values || []).map((value) => ({ name, ...value })))
  .filter((value) => value.family === 'IPv4' && !value.internal)
  .map((value) => ({ name: value.name, address: value.address }));

console.log('[NEXUS MOBILE] No telemóvel, não use localhost:3000.');
console.log('[NEXUS MOBILE] Com o computador e o telemóvel na mesma rede local, use um destes endereços:');
if (addresses.length === 0) {
  console.log('[NEXUS MOBILE] Nenhum IPv4 local foi detetado automaticamente. Execute ipconfig e use o Endereço IPv4 do computador.');
} else {
  for (const item of addresses) console.log(`[NEXUS MOBILE] ${item.name}: http://${item.address}:3000`);
}
