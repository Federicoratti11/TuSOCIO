import nexo from '@tiendanube/nexo';

// ── Estado ────────────────────────────────────────────────────────────
let storeId = '';
let currentSettings = { promoActive: false, promoPercentage: 0.5 };
let nexoInstance: any = null;

// ── Helpers ───────────────────────────────────────────────────────────
function showAlert(message: string, type: 'success' | 'error') {
  const el = document.getElementById('save-alert');
  if (!el) return;
  el.textContent  = message;
  el.className    = `alert ${type} show`;
  setTimeout(() => { el.className = 'alert'; }, 4000);
}

function updatePreview() {
  const rangeEl = document.getElementById('discount-range') as HTMLInputElement;
  const subtitle = document.getElementById('preview-subtitle');
  if (rangeEl && subtitle) {
    subtitle.textContent = `Agregá 2 artículos y ahorrá ${rangeEl.value}% en el más barato.`;
  }
}

// ── Carga inicial: obtener store_id del servidor, luego settings ──────
async function loadSettings() {
  // 1. Inicializar Nexo INMEDIATAMENTE para evitar el timeout de Tienda Nube
  try {
    const clientId = '31472'; // Client ID fijo o pasarlo por env
    // Usamos el export default de nexo que tiene create()
    nexoInstance = nexo.create({ clientId: clientId, log: true });
    nexo.iAmReady(nexoInstance); // Avisar a Tienda Nube INMEDIATAMENTE
    nexo.connect(nexoInstance).catch(e => console.warn('[Nexo] connect timeout', e));
  } catch (nexoErr) {
    console.warn('[Nexo] Error al conectar o ejecutando fuera de Tienda Nube:', nexoErr);
  }

  try {
    // Obtener store_id desde las cookies httpOnly (si el navegador lo permite)
    const meRes = await fetch('/api/me');
    if (!meRes.ok) {
      const badge = document.getElementById('app-status-badge');
      if (badge) {
        badge.className = 'status-badge inactive';
        badge.innerHTML = '<span class="status-dot"></span>ERROR DE SESIÓN';
      }
      showAlert('El navegador bloqueó las cookies o la sesión expiró. Abrí la app en una nueva pestaña.', 'error');
      return;
    }
    
    const me = await meRes.json();
    storeId = me.store_id;

    // Actualizar badge con store_id
    const badge = document.getElementById('app-status-badge');
    if (badge) {
      badge.innerHTML = `<span class="status-dot"></span>CONECTADA · Tienda ${storeId}`;
    }

    // Cargar configuración de la tienda
    const res = await fetch(`/api/settings?store_id=${storeId}`);
    if (!res.ok) throw new Error('Error al cargar configuración');
    const data = await res.json();
    currentSettings = data;

    const toggle = document.getElementById('promo-toggle') as HTMLInputElement;
    if (toggle) toggle.checked = data.promoActive;
    
    const range = document.getElementById('discount-range') as HTMLInputElement;
    const pct = Math.round((data.promoPercentage ?? 0.5) * 100);
    if (range) range.value = pct.toString();
    
    const display = document.getElementById('discount-display');
    if (display) display.textContent = `${pct}%`;
    
    updatePreview();

  } catch (err) {
    console.error('[Dashboard] Error cargando settings:', err);
    showAlert('❌ Error al cargar la configuración. Revisá la conexión.', 'error');
  }
}

// ── Guardar settings ──────────────────────────────────────────────────
(window as any).saveSettings = async function() {
  const btn = document.getElementById('save-btn') as HTMLButtonElement;
  const toggle = document.getElementById('promo-toggle') as HTMLInputElement;
  const range = document.getElementById('discount-range') as HTMLInputElement;
  
  if (!btn || !toggle || !range) return;

  const promoActive = toggle.checked;
  const promoPercentage = parseInt(range.value, 10) / 100;

  btn.disabled    = true;
  btn.textContent = '⏳ Guardando...';

  try {
    const res = await fetch('/api/settings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ store_id: storeId, promoActive, promoPercentage }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentSettings = data.settings;
    showAlert('✅ Configuración guardada correctamente.', 'success');

    // Actualizar badge
    const badge = document.getElementById('app-status-badge');
    if (badge) {
      badge.className = `status-badge ${promoActive ? 'active' : 'inactive'}`;
      badge.innerHTML = `<span class="status-dot"></span>${promoActive ? 'PROMO ACTIVA' : 'PROMO INACTIVA'}`;
    }
  } catch (err) {
    console.error('[Dashboard] Error guardando settings:', err);
    showAlert('❌ Error al guardar. Revisá la conexión.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '💾 Guardar Configuración';
  }
};

// ── Eventos ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const range = document.getElementById('discount-range');
  if (range) {
    range.addEventListener('input', (e) => {
      const display = document.getElementById('discount-display');
      if (display) display.textContent = `${(e.target as HTMLInputElement).value}%`;
      updatePreview();
    });
  }

  // ── Inicializar ───────────────────────────────────────────────────────
  loadSettings();
});
