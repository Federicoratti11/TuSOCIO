const axios = require('axios');

const ACCESS_TOKEN = '2578651ff63661be9fd03507301ae7839ac9bdd1';
const STORE_ID = '7682598';
const SCRIPT_URL = 'https://d0e4187dbf87e592-181-46-139-184.serveousercontent.com/dist/muff-app.iife.js';

axios.post(`https://api.tiendanube.com/v1/${STORE_ID}/scripts`, {
  src: SCRIPT_URL,
  event: "onload",
  where: "store"
}, {
  headers: {
    'Authentication': `bearer ${ACCESS_TOKEN}`,
    'User-Agent': 'MuffApp (contacto@muff.com.ar)',
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('SUCCESS: Script injected');
  console.log(response.data);
})
.catch(error => {
  console.log('ERROR: Injection failed');
  console.error(error.response ? error.response.data : error.message);
});
