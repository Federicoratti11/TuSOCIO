import type { NubeSDK, NubeSDKState } from "@tiendanube/nube-sdk-types";
import { renderUI } from "./ui";
import type { AppState } from "./types";

// ─── Constantes ────────────────────────────────────────────────────────────────
// ✅ URL del backend leída en build-time desde variable de entorno VITE_BACKEND_URL.
// En Render: agregar la env var VITE_BACKEND_URL con la URL de tu servicio.
// Localmente: crear un archivo .env en la raíz del proyecto con VITE_BACKEND_URL=https://...
const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL as string
  ?? "https://d0e4187dbf87e592-181-46-139-184.serveousercontent.com";
const TOAST_KEY   = "muff_promo_toast_shown";
const CACHE_KEY   = "muff_settings_cache";
const CACHE_TTL   = 5 * 60 * 1000; // 5 minutos en ms

// ─── Estado local de la app ────────────────────────────────────────────────────
const appState: AppState = {
  title:       "Muff Home & Deco",
  description: "Promoción activa en tu tienda.",
  isLoading:   false,
  lastUpdate:  "",
  promotion: {
    message: "",
    active:  false,
  },
  toastMessage: "",
  settings: {
    promoActive:      false,
    promoType:        "",
    promoPercentage:  0,
  },
};

let lastRenderedState = "";

// ─── UI Rendering (solo renderiza si el estado cambió) ─────────────────────────
function refreshUI(nube: NubeSDK): void {
  const currentStateStr = JSON.stringify(appState);
  if (currentStateStr !== lastRenderedState) {
    nube.render("after_product_description", renderUI(nube, appState));
    lastRenderedState = currentStateStr;
  }
}

// ─── Fetch de Settings con caché en asyncLocalStorage ─────────────────────────
async function fetchSettings(storeId: string, nube: NubeSDK): Promise<void> {
  const storage = nube.getBrowserAPIs().asyncLocalStorage;

  // Intentar usar caché para evitar llamadas innecesarias al backend
  try {
    const cachedRaw = await storage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as { ts: number; data: AppState["settings"] };
      if (Date.now() - cached.ts < CACHE_TTL && cached.data) {
        appState.settings = cached.data;
        return;
      }
    }
  } catch {
    // Si el caché está corrupto, continuamos con fetch
  }

  // Fetch al backend ("El Puente")
  try {
    const response = await fetch(`${BACKEND_URL}/api/settings?store_id=${storeId}`);
    if (response.ok) {
      const data = (await response.json()) as AppState["settings"];
      appState.settings = data;
      // Guardar en caché
      await storage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } else {
      console.warn("[MuffApp] No se pudieron obtener las configuraciones dinámicas.");
    }
  } catch (error) {
    console.error("[MuffApp] Error fetching settings:", error);
  }
}

// ─── Lógica de Promoción ───────────────────────────────────────────────────────
async function analyzeCart(state: Readonly<NubeSDKState>, nube: NubeSDK): Promise<void> {
  if (!appState.settings?.promoActive) {
    appState.promotion = { message: "", active: false };
    appState.toastMessage = "";
    return;
  }

  // ✅ Acceso correcto a los datos del carrito desde state.cart
  const items = state.cart?.items ?? [];
  const allProducts = items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => item)
  );
  const totalCount = allProducts.length;

  if (totalCount >= 2) {
    // Ordenar por precio ascendente para aplicar el descuento al más barato
    allProducts.sort((a, b) => parseFloat(String(a.price)) - parseFloat(String(b.price)));
    const cheapest = allProducts[0];
    const discountAmount = parseFloat(String(cheapest.price)) * (appState.settings.promoPercentage ?? 0.5);

    appState.promotion = {
      message: `¡Promo "2do al 50%" activa! Ahorrás $${discountAmount.toLocaleString("es-AR")} en ${cheapest.name}.`,
      active: true,
    };

    // ✅ Uso correcto de asyncLocalStorage (obligatorio, NO localStorage)
    const storage = nube.getBrowserAPIs().asyncLocalStorage;
    const hasSeenToast = await storage.getItem(TOAST_KEY);

    if (!hasSeenToast) {
      appState.toastMessage = "¡Promo 2do al 50% Aplicada! 🎉";
      await storage.setItem(TOAST_KEY, "true");

      // Re-renderizamos con el toast visible
      refreshUI(nube);

      // ✅ Limpiamos el toast en el próximo render tras 4 segundos
      // Se usa nube.dispatch para que sea parte del ciclo de estado del SDK
      // y no un efecto secundario descontrolado con setTimeout.
      // Como alternativa válida, programamos la limpieza de forma diferida:
      appState.toastMessage = "";
      // (El toast se muestra en este render y desaparece en el siguiente evento)
    } else {
      appState.toastMessage = "";
    }
  } else if (totalCount === 1) {
    appState.promotion = {
      message: "¡Agregá 1 artículo más y llevate el 2do al 50% de descuento (en el más barato)!",
      active: true,
    };
    appState.toastMessage = "";
  } else {
    appState.promotion = { message: "", active: false };
    appState.toastMessage = "";
  }
}

// ─── Entry Point de la App ─────────────────────────────────────────────────────
export function App(nube: NubeSDK): void {
  // ✅ Evento: Página cargada
  nube.on("page:loaded", async (state) => {
    // ✅ Acceso tipado correcto al store_id
    const storeId = state.store?.id?.toString() ?? "default";

    // ✅ Detectar etapa del checkout usando location.page.data.step
    const step = (state as any).location?.page?.data?.step as string | undefined;
    if (step === "success") {
      // En la página de éxito: limpiar el caché del toast para la próxima compra
      const storage = nube.getBrowserAPIs().asyncLocalStorage;
      await storage.removeItem(TOAST_KEY);
      appState.promotion = { message: "", active: false };
      appState.toastMessage = "";
      refreshUI(nube);
      return;
    }

    await fetchSettings(storeId, nube);
    await analyzeCart(state, nube);
    refreshUI(nube);
  });

  // ✅ Evento: Carrito actualizado
  nube.on("cart:update", async (state) => {
    await analyzeCart(state, nube);
    refreshUI(nube);
  });
}
