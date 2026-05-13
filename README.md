# Muff Home & Deco — App Tienda Nube

App de promoción "2do al 50%" para Tienda Nube.

## 🗂️ Estructura

```
tiendanube-app/
├── src/            → Script del carrito (NubeSDK)
│   ├── index.ts    → Worker: eventos y lógica
│   ├── ui.tsx      → Componentes visuales (NubeSDK JSX)
│   └── types.ts    → Tipos TypeScript
├── admin/          → Backend + Dashboard
│   ├── server.js   → Servidor Express + OAuth + API
│   └── public/
│       └── index.html → Panel de control (Nimbus CSS)
├── dist/           → Bundle compilado (generado por `npm run build`)
└── vite.config.ts  → Configuración de build
```

## 🚀 Deploy en Render (gratis)

### 1. Subir a GitHub

Solo subís la carpeta `admin/` a un repositorio de GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/muff-tiendanube-admin.git
git push -u origin main
```

### 2. Crear servicio en Render

1. [render.com](https://render.com) → **New > Web Service**
2. Conectar tu repositorio de GitHub
3. Configurar:
   - **Root Directory:** `admin`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`

### 3. Variables de entorno en Render

En el panel de Render → **Environment**:

| Variable | Valor |
|----------|-------|
| `CLIENT_ID` | `31472` |
| `CLIENT_SECRET` | *(tu secret)* |
| `APP_URL` | `https://TU-APP.onrender.com` *(lo obtenés una vez creado el servicio)* |

### 4. Servir el script del carrito

El bundle `dist/muff-app.iife.js` también debe estar accesible. Tenés dos opciones:

**Opción A (más simple):** Comprometer el `dist/` al repo y Render lo sirve directamente.

**Opción B (recomendado):** Agregar el build del script como parte del deploy de Render:
- **Build Command:** `npm install && cd .. && npm install && npm run build && cd admin`

### 5. Actualizar URLs en Tienda Nube Portal

Una vez que tenés tu URL de Render:
- **Página de la aplicación:** `https://TU-APP.onrender.com/`
- **URL de redirección:** `https://TU-APP.onrender.com/auth/callback`

### 6. Variable de entorno del script del carrito

En la raíz del proyecto crear `.env` (o en Render si buildás desde allí):
```
VITE_BACKEND_URL=https://TU-APP.onrender.com
```
Luego correr `npm run build` para regenerar el bundle con la URL correcta.

## 🔧 Desarrollo local

```bash
# Terminal 1: servidor backend
cd admin && node server.js

# Terminal 2: build del script (cuando hagas cambios)
npm run build
```

## ✅ Checklist de Homologación

- [x] Datos del carrito desde `state.cart`
- [x] Promo prendible/apagable desde el dashboard
- [x] Detección de etapa de checkout (`success`)
- [x] Keys únicas en componentes de lista
- [x] `nube.render()` solo cuando el estado cambió
- [x] `npx tsc --noEmit` → 0 errores
- [x] Persistencia con `asyncLocalStorage` (no `localStorage`)
- [x] Sin React Hooks en el script de la tienda
- [x] Sin acceso al DOM
- [x] Sin iframes externos
- [x] CORS habilitado en el servidor
