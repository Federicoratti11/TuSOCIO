/** @jsxImportSource @tiendanube/nube-sdk-jsx */
import {
  Box,
  Row,
  Column,
  Text,
  Icon,
  Fragment,
} from "@tiendanube/nube-sdk-jsx";
import type { NubeSDK, NubeComponent } from "@tiendanube/nube-sdk-types";
import type { AppState } from "./types";

// ─── Sub-componentes ───────────────────────────────────────────────────────────

/**
 * Banner de promo activa (2+ items en el carrito).
 * ✅ Componente funcional puro — sin hooks, sin DOM.
 */
function ActivePromoBanner(props: { message: string }): NubeComponent {
  return (
    <Box
      padding={16}
      borderRadius={8}
      background="accent-surface"
      id="muff-promo-banner"
    >
      <Column gap={8}>
        <Row gap={8}>
          <Icon name="tag" color="accent" />
          <Text modifiers={["bold"]} color="accent">
            PROMO MUFF · 2do al 50%
          </Text>
        </Row>
        <Text>{props.message}</Text>
      </Column>
    </Box>
  );
}

/**
 * Banner de invitación para agregar más artículos.
 */
function InvitationBanner(): NubeComponent {
  return (
    <Box
      padding={16}
      borderRadius={8}
      background="neutral-surface"
      id="muff-promo-hint"
    >
      <Column gap={8}>
        <Row gap={8}>
          <Icon name="tag" color="neutral" />
          <Text modifiers={["bold"]}>¡Aprovechá el 2do al 50%!</Text>
        </Row>
        <Text>• Comprá 2 artículos o más para activar la promo.</Text>
        <Text>• El descuento se aplica al artículo más barato.</Text>
        <Text>• Podés combinar cualquier producto de la tienda.</Text>
      </Column>
    </Box>
  );
}

/**
 * Toast de confirmación cuando la promo se activa.
 */
function ToastBanner(props: { message: string }): NubeComponent {
  return (
    <Box
      padding={12}
      borderRadius={8}
      background="success-surface"
      id="muff-toast"
    >
      <Row gap={8}>
        <Icon name="check-circle" color="success" />
        <Text color="success" modifiers={["bold"]}>
          {props.message}
        </Text>
      </Row>
    </Box>
  );
}

// ─── Componente raíz ───────────────────────────────────────────────────────────

/**
 * Renderiza el árbol de componentes del script de la tienda.
 * ✅ Componente funcional puro — sin hooks, sin DOM, sin iframes.
 * ✅ Retorna NubeComponent, tipo correcto del SDK.
 */
export function renderUI(_nube: NubeSDK, state: AppState): NubeComponent {
  const showToast  = Boolean(state.toastMessage);
  const promoOn    = state.settings?.promoActive ?? false;
  const promoActive = state.promotion?.active && Boolean(state.promotion?.message);

  return (
    <Box padding={16} id="muff-promo-root">
      <Column gap={12}>

        {/* Toast de promo activada */}
        {showToast
          ? <ToastBanner message={state.toastMessage} />
          : <Fragment />}

        {/* Banner principal */}
        {promoActive
          ? <ActivePromoBanner message={state.promotion!.message} />
          : promoOn
            ? <InvitationBanner />
            : <Fragment />}

        {/* Indicador de carga */}
        {state.isLoading ? (
          <Box padding={8} id="muff-loading">
            <Text color="neutral" modifiers={["italic"]}>Actualizando...</Text>
          </Box>
        ) : <Fragment />}

        {/* Timestamp de última revisión */}
        {state.lastUpdate ? (
          <Text color="neutral" modifiers={["italic"]} id="muff-last-update">
            SDK activo · Última revisión: {state.lastUpdate}
          </Text>
        ) : <Fragment />}

      </Column>
    </Box>
  );
}
