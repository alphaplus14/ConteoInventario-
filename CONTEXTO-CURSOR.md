# Proyecto: Conteo de inventario (React + Supabase)

Guarda este archivo en la raíz del repo como `CONTEXTO.md` y dile a Cursor: **"Lee CONTEXTO.md y construye el proyecto completo siguiendo todo lo que dice. Hazlo por fases y no pases a la siguiente sin que la anterior compile."**

## 1. Objetivo

Mientras se hace un conteo físico en papel, la app ayuda a llevar la cuenta: el usuario escribe una referencia y una cantidad y la app **acumula** el total por referencia. Opcionalmente puede agregarle un **detalle** al producto (ej. "caja dañada", "sin etiqueta").

La app **solo cuenta**. No compara contra el sistema de la empresa ni importa inventarios.

Se usa sobre todo desde el celular, con una mano, muchas veces seguidas. La velocidad de captura es lo más importante.

## 2. Restricciones de despliegue (importante)

- El frontend debe ser **100 % estático** (sin servidor propio) para desplegarlo en **Netlify** o **GitHub Pages**. Por eso NO se usa Laravel ni Node en el servidor.
- Base de datos y usuarios: **Supabase** (plan gratuito, PostgreSQL + Auth). El frontend habla directo con Supabase mediante `@supabase/supabase-js` y **Row Level Security (RLS)**.
- Todo debe funcionar con costo $0.

## 3. Stack

- React 18 + Vite (JavaScript, no TypeScript)
- CSS simple (un solo `styles.css`), sin librerías de UI pesadas
- `@supabase/supabase-js`
- Sin router: una sola página con selector de sesión y lista de conteo
- Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

## 4. Funcionalidades

### Usuarios
- La app tiene **varios usuarios**. Registro e inicio de sesión con email + contraseña (Supabase Auth). Incluir "cerrar sesión".
- **Cada usuario ve y modifica solo sus propios datos** (sesiones y conteos privados).
- Pantalla de login con opción de crear cuenta. Mensajes de error claros en español (contraseña corta, email ya registrado, credenciales inválidas).

### Sesiones de conteo
- El usuario puede crear, elegir, renombrar y borrar sesiones (ej. "Bodega principal - octubre").
- Todo el conteo pertenece a una sesión. Al abrir la app se selecciona la última sesión usada.

### Pantalla de conteo
- Campos: **Referencia** (texto), **Cantidad** (número, por defecto 1, acepta decimales) y **Detalle** (texto opcional, colapsado por defecto tras un botón "+ Detalle" para no estorbar la captura rápida).
- Enter en la referencia pasa a cantidad; Enter en cantidad guarda, limpia la referencia y el detalle, deja la cantidad en 1 y devuelve el foco a Referencia.
- Al escribir una referencia, mostrar en vivo cuánto lleva acumulado ("ABC-001 lleva 24" o "es nueva") y, si tiene detalle, mostrarlo.
- Tras guardar, confirmación visible: "ABC-001 ahora lleva 36".
- Botón **Deshacer** que revierte la última captura (varias veces seguidas).
- Lista de referencias contadas, la más reciente arriba, con buscador (por referencia y por detalle). Cada fila muestra referencia, total y detalle (si existe), y permite **editar total**, **editar o quitar detalle** y **borrar**.
- Mostrar el total de referencias distintas y la suma general de la sesión.
- Normalización: `trim()` y mayúsculas en la referencia. `abc-001 ` y `ABC-001` son la misma referencia.
- **Detalle:** es opcional y pertenece a la referencia dentro de la sesión (no a cada captura). Si al capturar se escribe un detalle, reemplaza el anterior; si se deja vacío, se conserva el que ya tenía.
- Actualización optimista: la interfaz responde al instante y sincroniza en segundo plano. Si falla la red, mostrar aviso claro y reintentar (no perder capturas).

## 5. Base de datos (ejecutar en Supabase → SQL Editor)

```sql
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.count_items (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reference text not null,
  qty numeric not null default 0,
  detail text,
  updated_at timestamptz not null default now(),
  primary key (session_id, reference)
);

create table public.count_log (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reference text not null,
  qty numeric not null,
  created_at timestamptz not null default now()
);

create index on public.count_log (session_id, id desc);

-- RLS: cada usuario solo ve y modifica lo suyo
alter table public.sessions    enable row level security;
alter table public.count_items enable row level security;
alter table public.count_log   enable row level security;

create policy "own rows" on public.sessions    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.count_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.count_log   for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sumar una captura de forma atómica y devolver el nuevo total y el detalle
create or replace function public.add_count(
  p_session uuid, p_ref text, p_qty numeric, p_detail text default null
) returns table(qty numeric, detail text) language plpgsql security invoker as $$
declare v_ref text := upper(trim(p_ref)); v_detail text := nullif(trim(coalesce(p_detail, '')), '');
begin
  insert into public.count_log(session_id, reference, qty) values (p_session, v_ref, p_qty);
  return query
  insert into public.count_items as ci(session_id, reference, qty, detail)
  values (p_session, v_ref, p_qty, v_detail)
  on conflict (session_id, reference)
  do update set qty = ci.qty + excluded.qty,
                detail = coalesce(excluded.detail, ci.detail),
                updated_at = now()
  returning ci.qty, ci.detail;
end $$;

-- Deshacer la última captura de la sesión
create or replace function public.undo_last(p_session uuid)
returns table(reference text, qty numeric) language plpgsql security invoker as $$
declare v_log public.count_log%rowtype;
begin
  select * into v_log from public.count_log l where l.session_id = p_session order by l.id desc limit 1;
  if not found then return; end if;
  delete from public.count_log where id = v_log.id;
  update public.count_items ci set qty = ci.qty - v_log.qty, updated_at = now()
   where ci.session_id = p_session and ci.reference = v_log.reference;
  delete from public.count_items ci
   where ci.session_id = p_session and ci.reference = v_log.reference
     and ci.qty = 0 and ci.detail is null
     and not exists (select 1 from public.count_log l where l.session_id = p_session and l.reference = v_log.reference);
  return query select v_log.reference, v_log.qty;
end $$;
```

Notas:
- "Editar total" y "editar detalle" hacen `update` directo sobre `count_items`. Al editar el total, borrar de `count_log` las capturas de esa referencia para que Deshacer no descuadre.
- Si se quita el detalle de una referencia (`detail = null`) la fila sigue existiendo mientras tenga cantidad.

## 6. Estructura sugerida

```
/
├─ CONTEXTO.md
├─ index.html
├─ package.json
├─ vite.config.js
├─ netlify.toml
├─ .env.example
├─ .github/workflows/deploy.yml
└─ src/
   ├─ main.jsx
   ├─ App.jsx
   ├─ supabaseClient.js
   ├─ lib/ (normalize.js, errors.js)
   ├─ components/ (Auth, SessionPicker, CountForm, ItemList, ItemRow)
   └─ styles.css
```

## 7. Criterios de calidad

- Mobile-first: botones grandes, `inputmode="decimal"` en cantidad, `autocapitalize="characters"` en referencia, inputs con font-size ≥ 16px (evita zoom en iOS).
- Modo claro y oscuro con `prefers-color-scheme`.
- Foco visible y contraste accesible.
- Errores de red visibles y sin pérdida de capturas.
- Nunca usar la `service_role` key en el frontend, solo la `anon` key.
- No commitear `.env`; incluir `.env.example`.

## 8. Configurar Supabase (gratis)

1. Crear cuenta en supabase.com → **New project** (plan Free).
2. **SQL Editor** → pegar y ejecutar el SQL de la sección 5.
3. **Authentication → Providers → Email**: dejar habilitado el registro. Por defecto Supabase exige confirmar el correo y su servicio de correo gratuito tiene un límite bajo de envíos por hora. Para empezar simple, desactivar "Confirm email"; si la app va a tener muchos usuarios, configurar un SMTP propio.
4. **Authentication → URL Configuration**: agregar la URL final del sitio (Netlify o GitHub Pages) como Site URL.
5. **Project Settings → API**: copiar `Project URL` y la `anon public key`.
6. Local: crear `.env` con `VITE_SUPABASE_URL=...` y `VITE_SUPABASE_ANON_KEY=...`.

Nota: los proyectos gratuitos de Supabase se pausan tras aproximadamente una semana sin actividad. Se reactivan con un clic desde el panel.

## 9. Despliegue

### Opción A: Netlify
- Conectar el repo de GitHub en Netlify.
- Build command: `npm run build` · Publish directory: `dist`
- En **Site settings → Environment variables** agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Crear `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
```

### Opción B: GitHub Pages
- En `vite.config.js` definir `base: '/NOMBRE-DEL-REPO/'`.
- En el repo: **Settings → Pages → Source: GitHub Actions**.
- En **Settings → Secrets and variables → Actions** crear los secrets `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Crear `.github/workflows/deploy.yml` que: haga checkout, `npm ci`, `npm run build` (pasando los secrets como variables de entorno) y publique `dist` con `actions/upload-pages-artifact` y `actions/deploy-pages` (permisos `pages: write` e `id-token: write`), disparado en push a `main`.

## 10. Fases de trabajo para Cursor

1. Crear proyecto Vite + React, estructura de carpetas, `supabaseClient.js`, `.env.example`.
2. Registro, login, cerrar sesión y selector de sesiones.
3. Pantalla de conteo completa (captura con detalle opcional, acumulado en vivo, deshacer, lista con buscador, editar total y detalle, borrar).
4. Estilos mobile-first y modo oscuro.
5. `netlify.toml`, workflow de GitHub Pages y `README.md` con los pasos de las secciones 8 y 9.

Al terminar cada fase: correr `npm run build` y corregir errores antes de continuar.
