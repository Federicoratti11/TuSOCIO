require('dotenv').config();
const express      = require('express');
const axios        = require('axios');
const path         = require('path');
const fs           = require('fs');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const initSqlJs    = require('sql.js');

const app     = express();
const PORT    = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const DB_PATH = path.join(__dirname, 'muff.db');

// ─── Base de datos SQLite ─────────────────────────────────────────────────────

let db; // instancia de la DB

/**
 * Inicializa SQLite y crea la tabla si no existe.
 * Carga el archivo muff.db del disco si ya existe (persistencia).
 */
async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    // Cargar DB existente desde el archivo
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] Base de datos cargada desde', DB_PATH);
  } else {
    // Crear nueva DB
    db = new SQL.Database();
    console.log('[DB] Nueva base de datos creada en', DB_PATH);
  }

  // Crear tabla si no existe
  db.run(`
    CREATE TABLE IF NOT EXISTS store_settings (
      store_id        TEXT PRIMARY KEY,
      promo_active    INTEGER NOT NULL DEFAULT 0,
      promo_type      TEXT    NOT NULL DEFAULT '2do_al_50',
      promo_percentage REAL   NOT NULL DEFAULT 0.5,
      access_token    TEXT,
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  saveDB();
  console.log('[DB] Tabla inicializada correctamente.');
}

/**
 * Persiste la DB en disco después de cada escritura.
 */
function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Helpers DB ───────────────────────────────────────────────────────────────

function getSettings(storeId) {
  const stmt = db.prepare(
    'SELECT promo_active, promo_type, promo_percentage, access_token FROM store_settings WHERE store_id = ?'
  );
  stmt.bind([storeId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      promoActive:     Boolean(row.promo_active),
      promoType:       row.promo_type,
      promoPercentage: row.promo_percentage,
      accessToken:     row.access_token,
    };
  }
  stmt.free();
  // Devolver valores por defecto si la tienda no existe aún
  return { promoActive: false, promoType: '2do_al_50', promoPercentage: 0.5, accessToken: null };
}

function upsertSettings(storeId, promoActive, promoType, promoPercentage) {
  db.run(
    `INSERT INTO store_settings (store_id, promo_active, promo_type, promo_percentage, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(store_id) DO UPDATE SET
       promo_active     = excluded.promo_active,
       promo_type       = excluded.promo_type,
       promo_percentage = excluded.promo_percentage,
       updated_at       = excluded.updated_at`,
    [storeId, promoActive ? 1 : 0, promoType, promoPercentage]
  );
  saveDB();
}

function upsertToken(storeId, accessToken) {
  db.run(
    `INSERT INTO store_settings (store_id, access_token, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(store_id) DO UPDATE SET
       access_token = excluded.access_token,
       updated_at   = excluded.updated_at`,
    [storeId, accessToken]
  );
  saveDB();
}

// ─── Middlewares ──────────────────────────────────────────────────────────────

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// ✅ El bundle JS vive en admin/public/dist/ y se sirve automáticamente
// como /dist/muff-app.iife.js por el middleware de arriba

// ── Seguridad ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://*.tiendanube.com https://*.nuvemshop.com.br; " +
    "frame-src 'self' https://*.tiendanube.com https://*.nuvemshop.com.br https://tusocio-production.up.railway.app; " +
    "script-src 'self' https://unpkg.com https://*.tiendanube.com https://*.nuvemshop.com.br; " +
    "connect-src 'self' https://*.tiendanube.com https://*.nuvemshop.com.br https://tusocio-production.up.railway.app;"
  );
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── API: Puente NubeSDK → Backend ───────────────────────────────────────────

/**
 * GET /api/settings?store_id=XYZ
 * El script de la tienda consulta aquí la configuración activa.
 */
app.get('/api/settings', (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id es requerido' });

  const settings = getSettings(String(store_id));
  console.log(`[Settings] GET store_id=${store_id} →`, settings);
  res.json(settings);
});

/**
 * POST /api/settings
 * El dashboard actualiza la configuración de la promo.
 */
app.post('/api/settings', async (req, res) => {
  const { store_id, promoActive, promoPercentage } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id es requerido' });

  const pct = parseFloat(promoPercentage);
  upsertSettings(
    String(store_id),
    Boolean(promoActive),
    '2do_al_50',
    isNaN(pct) ? 0.5 : pct
  );

  const updated = getSettings(String(store_id));
  console.log(`[Settings] POST store_id=${store_id} →`, updated);
  
  // ✅ Registrar / Actualizar la Promoción en Tienda Nube para forzar el Webhook
  if (updated.accessToken && promoActive) {
    try {
      await axios.post(
        `https://api.tiendanube.com/v1/${store_id}/promotions`,
        {
          name: "2do al 50% (MuffApp)",
          type: "cross_item", // Tienda Nube discount api generic type
          starts_at: new Date().toISOString()
        },
        {
          headers: {
            'Authentication': `bearer ${updated.accessToken}`,
            'User-Agent':     'MuffApp (contacto@muff.com.ar)',
            'Content-Type':   'application/json',
          },
        }
      );
      console.log(`[Settings] Promoción registrada/actualizada en Tienda Nube para ${store_id}`);
      lastApiError = null;
    } catch (promoErr) {
      lastApiError = promoErr.response?.data || promoErr.message;
      console.error(`[Settings] Error registrando la promoción en Tienda Nube:`, lastApiError);
    }
  }

  res.json({ success: true, settings: { ...updated, accessToken: undefined } });
});

/**
 * GET /api/me
 * El dashboard JS obtiene el store_id del servidor (la cookie es httpOnly).
 */
app.get('/api/me', (req, res) => {
  const storeId = req.cookies?.store_id;
  if (!storeId) {
    return res.status(401).json({ error: 'No autenticado. Instalá la app primero.' });
  }
  res.json({ store_id: storeId, client_id: process.env.CLIENT_ID });
});

// ─── OAuth: Flujo de Instalación ─────────────────────────────────────────────

/**
 * GET /auth/callback?code=XXX
 * Tienda Nube redirige aquí tras la autorización del comerciante.
 */
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Falta el código de autorización.');

  try {
    console.log('[OAuth] Canjeando código de autorización...');

    const tokenResponse = await axios.post(
      'https://www.tiendanube.com/apps/authorize/token',
      {
        client_id:     process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
      },
      {
        headers: { 'User-Agent': 'MuffApp (contacto@muff.com.ar)' },
        timeout: 10000,
      }
    );

    const { access_token, user_id } = tokenResponse.data;
    const storeId = String(user_id);
    console.log(`[OAuth] Token recibido para tienda: ${storeId}`);

    // ✅ Persistir token y settings por defecto en SQLite
    upsertToken(storeId, access_token);

    // ✅ Inyectar el script en la tienda via API de Tienda Nube
    const scriptUrl = `${APP_URL}/dist/muff-app.iife.js`;
    try {
      await axios.post(
        `https://api.tiendanube.com/v1/${storeId}/scripts`,
        { src: scriptUrl, event: 'onload', where: 'store' },
        {
          headers: {
            'Authentication': `bearer ${access_token}`,
            'User-Agent':     'MuffApp (contacto@muff.com.ar)',
            'Content-Type':   'application/json',
          },
        }
      );
      console.log(`[OAuth] Script inyectado en tienda ${storeId}`);
    } catch (injectError) {
      console.error('[OAuth] Error inyectando script:', injectError.response?.data ?? injectError.message);
    }

    // ✅ Registrar Callback para la Discount API
    try {
      const callbackUrl = `${APP_URL}/api/discount-callback`;
      // Registramos la URL para recibir eventos del carrito (Discount API)
      await axios.put(
        `https://api.tiendanube.com/v1/${storeId}/discounts/callbacks`,
        { callback_url: callbackUrl },
        {
          headers: {
            'Authentication': `bearer ${access_token}`,
            'User-Agent':     'MuffApp (contacto@muff.com.ar)',
            'Content-Type':   'application/json',
          },
        }
      );
      console.log(`[OAuth] Callback de Discount API registrado en tienda ${storeId}`);
      lastApiError = null;
    } catch (cbError) {
      lastApiError = cbError.response?.data || cbError.message;
      console.error('[OAuth] Error registrando callback de descuentos:', lastApiError);
    }


    // Cookie httpOnly para el dashboard (SameSite=None y Secure requeridos para iframes)
    res.cookie('access_token', access_token, { httpOnly: true, sameSite: 'none', secure: true });
    res.cookie('store_id',     storeId,       { httpOnly: true, sameSite: 'none', secure: true });
    res.redirect('/');

  } catch (error) {
    console.error('[OAuth] Error en instalación:', error.response?.data ?? error.message);
    res.status(500).send('Error durante la instalación. Revisá la terminal del servidor.');
  }
});

// ─── Debug API & Webhook ──────────────────────────────────────────────────────

let lastWebhookPayload = null;
let lastApiError = null;

/**
 * GET /api/last-webhook
 * Endpoint temporal para inspeccionar el payload enviado por Tienda Nube.
 */
app.get('/api/last-webhook', (req, res) => {
  res.json({ payload: lastWebhookPayload });
});

/**
 * GET /api/last-error
 * Endpoint temporal para ver por qué falla la API de Tienda Nube.
 */
app.get('/api/last-error', (req, res) => {
  res.json({ error: lastApiError });
});

/**
 * GET /api/debug-tiendanube
 * Consulta a Tienda Nube para ver qué webhooks y promociones están registrados.
 */
app.get('/api/debug-tiendanube', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id es requerido' });

  const settings = getSettings(String(store_id));
  if (!settings.accessToken) return res.status(400).json({ error: 'No token' });

  try {
    const config = {
      headers: {
        'Authentication': `bearer ${settings.accessToken}`,
        'User-Agent': 'MuffApp (contacto@muff.com.ar)'
      }
    };
    
    let callbacks = null;
    let promotions = null;
    let callbackError = null;
    let promoError = null;

    try {
      const cbRes = await axios.get(`https://api.tiendanube.com/v1/${store_id}/discounts/callbacks`, config);
      callbacks = cbRes.data;
    } catch (e) { callbackError = e.response?.data || e.message; }

    try {
      const pRes = await axios.get(`https://api.tiendanube.com/v1/${store_id}/promotions`, config);
      promotions = pRes.data;
    } catch (e) { promoError = e.response?.data || e.message; }

    res.json({
      callbacks,
      callbackError,
      promotions,
      promoError
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/discount-callback
 * Endpoint llamado por Tienda Nube cada vez que se actualiza el carrito.
 */
app.post('/api/discount-callback', (req, res) => {
  console.log(`\n\n[Discount API] NUEVO EVENTO RECIBIDO`);
  
  const cart = req.body;
  lastWebhookPayload = cart;
  
  if (!cart || !cart.items || !Array.isArray(cart.items) || cart.items.length === 0) {
    return res.status(200).json({ discounts: [] });
  }

  try {
    // Desglosar los productos según su cantidad
    const allItems = [];
    for (const item of cart.items) {
      const qty = parseInt(item.quantity || 1, 10);
      const price = parseFloat(item.price || item.unit_price || 0); // Manejo de variaciones de la API
      for (let i = 0; i < qty; i++) {
        allItems.push({ ...item, price });
      }
    }

    if (allItems.length >= 2) {
      // Ordenar por precio ascendente para descontar el más barato
      allItems.sort((a, b) => a.price - b.price);
      const cheapestPrice = allItems[0].price;
      const discountAmount = cheapestPrice * 0.5; // 50% del más barato

      console.log(`[Discount API] Aplicando descuento de $${discountAmount} al carrito.`);

      return res.status(200).json({
        discounts: [
          {
            id: "muff-promo-2do-50",
            name: "2do al 50% (Muff)",
            amount: discountAmount,
            type: "fixed" // o "percentage"
          }
        ]
      });
    }

    // Si no hay 2 productos, no aplicamos nada
    return res.status(200).json({ discounts: [] });

  } catch (err) {
    console.error("[Discount API] Error calculando el descuento:", err);
    return res.status(200).json({ discounts: [] }); // Devolver array vacío en caso de error para no romper el checkout
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Muff corriendo en puerto ${PORT}`);
    console.log(`📋 Dashboard:      ${APP_URL}/`);
    console.log(`🔐 OAuth Callback: ${APP_URL}/auth/callback`);
    console.log(`⚙️  API Settings:  ${APP_URL}/api/settings`);
    console.log(`🗄️  DB:            ${DB_PATH}`);
  });
}).catch((err) => {
  console.error('❌ Error inicializando la base de datos:', err);
  process.exit(1);
});
