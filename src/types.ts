import type { NubeSDKState } from "@tiendanube/nube-sdk-types";

/**
 * Estado local de la aplicación Muff para Tienda Nube.
 */
export interface AppState {
  title: string;
  description: string;
  isLoading: boolean;
  lastUpdate: string;
  promotion: {
    message: string;
    active: boolean;
  };
  toastMessage: string;
  settings: {
    promoActive: boolean;
    promoType: string;
    promoPercentage: number;
  };
}

/**
 * Respuesta de la API /api/settings del backend.
 */
export interface SettingsResponse {
  promoActive: boolean;
  promoType: string;
  promoPercentage: number;
}

/**
 * Estructura de un item del carrito de Tienda Nube.
 * Tipado defensivo para trabajar con state.cart.items.
 */
export interface CartItem {
  id: number | string;
  name: string;
  price: string | number;
  quantity: number;
}

/**
 * Extensión del estado del SDK si necesitamos campos extra.
 */
export interface ExtendedNubeState extends NubeSDKState {
  // Reservado para extensiones futuras
}
