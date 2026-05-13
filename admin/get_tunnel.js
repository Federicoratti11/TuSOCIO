const localtunnel = require('localtunnel');
const fs = require('fs');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    fs.writeFileSync('tunnel_url.txt', tunnel.url);
    console.log(tunnel.url);
  } catch (err) {
    console.error(err);
  }
})();
