# GuateGanado — Front-End Web SPA y App Móvil (Ionic + Vue 3 + Capacitor)

![CI Front-End](https://github.com/JoelSotela-hub/ProyectoGanadero_FrontEnd/actions/workflows/ci.yml/badge.svg)
![CI Back-End](https://github.com/Haki7w7/ProyectoGanadero_BackEnd/actions/workflows/ci.yml/badge.svg)

Aplicación cliente multiplataforma (Web SPA y Android APK) del sistema de gestión ganadera **GuateGanado** (Curso IF0009), conectada mediante HTTPS y autenticación Bearer (Laravel Sanctum) a la API REST en producción.

## Enlaces en Producción

- **Aplicación Web SPA (Cloudflare Pages):** https://guateganado.pages.dev
- **API REST Back-End (Render):** https://proyectoganadero-backend.onrender.com
- **Healthcheck API (`/up`):** https://proyectoganadero-backend.onrender.com/up
- **Release APK Android (`v1.1.0`):** https://github.com/JoelSotela-hub/ProyectoGanadero_FrontEnd/releases/tag/v1.1.0
- **Repositorio Back-End:** https://github.com/Haki7w7/ProyectoGanadero_BackEnd
- **Documentación de Despliegue (Lab 14):** [`docs/lab14-despliegue.md`](./docs/lab14-despliegue.md)

## Comandos Principales

```bash
# Instalar dependencias
npm ci

# Servidor de desarrollo
npm run dev

# Ejecutar pruebas unitarias (Vitest)
npm run test:unit

# Compilar bundle de producción (dist/)
npm run build

# Sincronizar con proyecto Android Capacitor
npx cap sync android
```
