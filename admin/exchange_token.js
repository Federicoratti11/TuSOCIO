const axios = require('axios');

const data = {
  client_id: '31472',
  client_secret: '1a19471c8b45b01454b3781c6e14ce850aa5b30221ce9480',
  grant_type: 'authorization_code',
  code: 'c6d781684298f875a1bc15b4442433f92afc5246'
};

axios.post('https://www.tiendanube.com/apps/authorize/token', data, {
  headers: {
    'User-Agent': 'MuffApp (contacto@muff.com.ar)',
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('SUCCESS');
  console.log(JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.log('ERROR');
  console.error(error.response ? error.response.data : error.message);
});
