import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MuffApp',
      fileName: 'muff-app',
      formats: ['iife'], // Formato correcto para scripts inyectados por la API de Tienda Nube
    },
    outDir: 'dist',
    rollupOptions: {
      output: {
        extend: true,
        // ✅ El SDK de Tienda Nube llama a window.MuffApp.App(nube) automáticamente.
        // NO es necesario un footer que auto-invoque App(nube) porque nube no existe
        // en el scope global — el SDK lo inyecta al llamar a la función exportada.
        // Referencia: https://dev.tiendanube.com/docs/developer-tools/nube-sdk/scripts
      },
    },
    // Minificar para producción
    minify: true,
    // Remover comentarios en build de producción
    sourcemap: false,
  },
});
