const fs = require('fs');
const initSqlJs = require('sql.js');
const axios = require('axios');

async function check() {
  const dbBuffer = fs.readFileSync('muff.db');
  const SQL = await initSqlJs();
  const db = new SQL.Database(dbBuffer);
  const res = db.exec("SELECT access_token FROM store_settings WHERE store_id = '7682598'");
  if (!res.length) return console.log("No token in local db");
  const token = res[0].values[0][0];
  try {
    const getRes = await axios.get('https://api.tiendanube.com/v1/7682598/promotions', {
      headers: { 'Authentication': 'bearer ' + token, 'User-Agent': 'MuffApp' }
    });
    console.log(JSON.stringify(getRes.data, null, 2));
  } catch(e) {
    console.log(e.response ? e.response.data : e.message);
  }
}
check();
