const axios = require('axios');
const token = '2578651ff63661be9fd03507301ae7839ac9bdd1';
const storeId = '7682598';

async function run() {
  try {
    const res = await axios.post(
      `https://api.tiendanube.com/v1/${storeId}/promotions`,
      {
        type: "cross_item",
        name: "MuffApp 2do al 50%",
        starts_at: new Date().toISOString()
      },
      {
        headers: {
          'Authentication': `bearer ${token}`,
          'User-Agent':     'MuffApp (contacto@muff.com.ar)',
          'Content-Type':   'application/json',
        }
      }
    );
    console.log("Exito:", JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log("Error:", JSON.stringify(e.response?.data || e.message, null, 2));
  }
}
run();
