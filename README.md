# Conteo de inventario

App web estática (React + Vite) para llevar el conteo físico por referencia. Cada usuario ve solo sus sesiones. Base de datos y autenticación: Supabase (plan gratuito). Se puede publicar en Netlify o GitHub Pages.

## Requisitos

- Node.js 18 o superior
- Un proyecto en [supabase.com](https://supabase.com) (plan Free)

## 1. Configurar Supabase

1. Crea una cuenta en supabase.com → **New project** (plan Free).
2. Abre **SQL Editor**, pega el contenido de `supabase/schema.sql` y ejecútalo.
3. **Authentication → Providers → Email**: deja el registro habilitado. Para empezar simple, desactiva **Confirm email** (el correo gratuito de Supabase tiene un límite bajo de envíos). Si habrá muchos usuarios, configura un SMTP propio.
4. **Authentication → URL Configuration**: agrega la URL final del sitio (Netlify o GitHub Pages) como Site URL.
5. **Project Settings → API**: copia `Project URL` y la **anon public** key. Nunca uses la `service_role` key en el frontend.

Los proyectos gratuitos de Supabase se pausan tras aproximadamente una semana sin actividad. Se reactivan con un clic desde el panel.

## 2. Correr en local

```bash
npm install
copy .env.example .env
```

En `.env`:

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_public_key
```

```bash
npm run dev
```

Build de producción:

```bash
npm run build
npm run preview
```

No subas `.env` al repo.

## 3. Despliegue

### Opción A: Netlify

1. Conecta el repo de GitHub en Netlify.
2. Build command: `npm run build` · Publish directory: `dist` (también está en `netlify.toml`).
3. **Site settings → Environment variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

### Opción B: GitHub Pages

1. En el repo: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions**: crea `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. El workflow `.github/workflows/deploy.yml` publica `dist` en cada push a `main`.
4. Si el repo no se llama `inventario`, cambia `VITE_BASE_PATH` en el workflow (debe ser `/NOMBRE-DEL-REPO/`).

## Uso

1. Crea una cuenta e inicia sesión.
2. Crea o elige una sesión (ej. “Bodega principal - octubre”).
3. Escribe referencia, Enter, cantidad, Enter. El total se acumula por referencia.
4. **+ Detalle** es opcional (caja dañada, sin etiqueta). Si lo dejas vacío, se conserva el detalle anterior.
5. **Deshacer** revierte la última captura. Puedes usarlo varias veces.
