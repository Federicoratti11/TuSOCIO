const localtunnel = require('localtunnel');
const fs = require('fs');

(async () => {
  const tunnel = await localtunnel({ port: 3000 });
  fs.writeFileSync('tunnel.txt', tunnel.url);
  console.log(`Tunnel running at: ${tunnel.url}`);

  tunnel.on('close', () => {
    console.log('Tunnel closed');
  });
})();
