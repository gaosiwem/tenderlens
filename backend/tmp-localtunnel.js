const fs = require('fs');
const path = require('path');
const localtunnel = require('localtunnel');
(async () => {
  const tunnel = await localtunnel({ port: 8080, local_host: '127.0.0.1' });
  const target = path.join(process.cwd(), 'localtunnel-url.txt');
  fs.writeFileSync(target, `${tunnel.url}\n`, 'utf8');
  console.log(tunnel.url);
  tunnel.on('close', () => process.exit(0));
  setInterval(() => {}, 60_000);
})();
