# Trueke PRG — web

Aplicación web de intercambio entre miembros autorizados. No hay precios ni pagos: cada publicación contiene qué ofrecés y qué buscás a cambio.

## Desarrollo
1. Copiar `.env.example` a `.env.local`.
2. Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Desde esta carpeta ejecutar `npm install` y `npm run dev`.

## Deploy en Vercel
- Importar el repositorio `pitucorporacion-collab/trueke`.
- Root Directory: `web`.
- Framework: Vite.
- Build: `npm run build`; Output: `dist`.
- Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

El registro invoca la Edge Function `trueke-register`. La clave secreta de Supabase nunca se incluye en el frontend.
