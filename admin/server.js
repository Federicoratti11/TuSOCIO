require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const path    = require('path');
const cookieParser = require('cookie-parser');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// ─── Persistencia en Memoria por store_id ─────────────────────────────────────
// ⚠️ Para producción real: reemplazar por SQLite/PostgreSQL.
// Suficiente para homologación de Tienda Nube.
const storeSettings = new Map();

/**
 * Configuración por defecto para nuevas tiendas instaladas.
 */
function defaultSettings() {
  return {
    promoActive:     false,  // ✅ Inicia desactivada — el comerciante la activa desde el dashboard
    promoType:       "2do_al_50",
    promoPercentage: 0.5,
  };
}

// ─── Middlewares ──────────────────────────────────────────────────────────────

// ✅ CORS habilitado para que el script de la tienda pueda leer /api/settings
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir dashboard de administración
app.use(express.static(path.join(__dirname, 'public')));
// Servir el bundle compilado del script de la tienda
app.use('/dist', express.static(path.join(__dirname, '../dist')));

// Logger de peticiones
app.use((req, res, next) => {
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
  if (!store_id) {
    return res.status(400).json({ error: 'store_id es requerido' });
  }

  const settings = storeSettings.get(String(store_id)) ?? defaultSettings();
  console.log(`[Settings] store_id=${store_id} →`, settings);
  res.json(settings);
});

/**
 * POST /api/settings
 * El dashboard actualiza la configuración de la promo.
 * Body: { store_id, promoActive, promoPercentage }
 */
app.post('/api/settings', (req, res) => {
  const { store_id, promoActive, promoPercentage } = req.body;
  if (!store_id) {
    return res.status(400).json({ error: 'store_id es requerido' });
  }

  const current = storeSettings.get(String(store_id)) ?? defaultSettings();
  const updated = {
    ...current,
    promoActive:     Boolean(promoActive),
    promoPercentage: parseFloat(promoPercentage) || current.promoPercentage,
  };
  storeSettings.set(String(store_id), updated);

  console.log(`[Settings] Actualizado store_id=${store_id} →`, updated);
  res.json({ success: true, settings: updated });
});

// ─── OAuth: Flujo de Instalación ─────────────────────────────────────────────

/**
 * GET /auth/callback?code=XXX&store_id=YYY
 * Tienda Nube redirige aquí tras la autorización del comerciante.
 */
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Falta el código de autorización.');
  }

  try {
    console.log(`[OAuth] Canjeando código de autorización...`);

    // ✅ Intercambio del código por access_token
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

    // ✅ Persistir configuración inicial para esta tienda
    if (!storeSettings.has(storeId)) {
      storeSettings.set(storeId, defaultSettings());
    }

    // ✅ Inyectar el script automáticamente via API de Tienda Nube
    const scriptUrl = `${APP_URL}/dist/muff-app.iife.js`;
    try {
      await axios.post(
        `https://api.tiendanube.com/v1/${storeId}/scripts`,
        {
          src:   scriptUrl,
          event: "onload",
          where: "store",
        },
        {
          headers: {
            'Authentication': `bearer ${access_token}`,
            'User-Agent':      'MuffApp (contacto@muff.com.ar)',
            'Content-Type':    'application/json',
          },
        }
      );
      console.log(`[OAuth] Script inyectado en tienda ${storeId}`);
    } catch (injectError) {
      // No bloqueamos la instalación si falla la inyección
      console.error('[OAuth] Error inyectando script:', injectError.response?.data ?? injectError.message);
    }

    // Persistir el token en cookie (para el dashboard — en prod usar DB)
    res.cookie('access_token', access_token, { httpOnly: true });
    res.cookie('store_id',     storeId,       { httpOnly: true });

    res.redirect('/');
  } catch (error) {
    console.error('[OAuth] Error en instalación:', error.response?.data ?? error.message);
    res.status(500).send('Error durante la instalación. Revisá la terminal del servidor.');
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * GET /api/me
 * El dashboard JS consulta esto para obtener el store_id sin tocar cookies httpOnly.
 */
app.get('/api/me', (req, res) => {
  const storeId = req.cookies?.store_id;
  if (!storeId) {
    return res.status(401).json({ error: 'No autenticado. Instala la app primero.' });
  }
  res.json({ store_id: storeId });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});


// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Muff corriendo en puerto ${PORT}`);
  console.log(`📋 Dashboard:       ${APP_URL}/`);
  console.log(`🔐 OAuth Callback:  ${APP_URL}/auth/callback`);
  console.log(`⚙️  API Settings:   ${APP_URL}/api/settings`);
});
