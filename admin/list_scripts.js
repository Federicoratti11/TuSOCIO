const axios = require('axios');

const ACCESS_TOKEN = '2578651ff63661be9fd03507301ae7839ac9bdd1';
const STORE_ID = '7682598';

axios.get(`https://api.tiendanube.com/v1/${STORE_ID}/scripts`, {
  headers: {
    'Authentication': `bearer ${ACCESS_TOKEN}`,
    'User-Agent': 'MuffApp (contacto@muff.com.ar)'
  }
})
.then(response => {
  console.log('SUCCESS: Scripts list');
  console.log(JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.log('ERROR: Listing failed');
  console.error(error.response ? error.response.data : error.message);
});
