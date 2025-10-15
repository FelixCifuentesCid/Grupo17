-- ================================
-- Extensiones útiles
-- ================================
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- búsqueda por similitud (trigramas)

-- ================================
-- Tablas
-- Convención:
--  - fechas: fecha_creacion, fecha_modificacion
--  - usuarios: usuario_creacion, usuario_modificacion (uuid -> auth.users.id)
-- ================================

-- 1) CATEGORIAS
create table if not exists public.categorias (
  id_categoria        uuid primary key default gen_random_uuid(),
  nombre              text not null unique,
  descripcion         text,
  fecha_creacion      timestamptz not null default now(),
  fecha_modificacion  timestamptz,
  usuario_creacion    uuid not null default auth.uid() references auth.users(id),
  usuario_modificacion uuid references auth.users(id)
);

-- 2) PRODUCTOS
-- Nutrientes: obligatorios CL + opcionales frecuentes
create table if not exists public.productos (
  id_producto         uuid primary key default gen_random_uuid(),
  nombre              text not null,
  marca               text,
  id_categoria        uuid not null references public.categorias(id_categoria) on delete cascade,

  -- OBLIGATORIOS (Chile)
  energia_kcal        numeric,
  proteinas_g         numeric,
  grasa_total_g       numeric,
  carbohidratos_g     numeric,    -- "hidratos de carbono disponibles"
  azucares_g          numeric,
  sodio_mg            numeric,

  -- OPCIONALES
  grasa_saturada_g    numeric,
  grasa_trans_g       numeric,
  grasa_monoinsat_g   numeric,
  grasa_poliinsat_g   numeric,
  colesterol_mg       numeric,
  fibra_dietetica_g   numeric,
  calcio_mg           numeric,
  fosforo_mg          numeric,
  hierro_mg           numeric,
  potasio_mg          numeric,
  vitamina_c_mg       numeric,

  fecha_creacion      timestamptz not null default now(),
  fecha_modificacion  timestamptz,
  usuario_creacion    uuid not null default auth.uid() references auth.users(id),
  usuario_modificacion uuid references auth.users(id)
);

-- 3) INGREDIENTES
create table if not exists public.ingredientes (
  id_ingrediente      uuid primary key default gen_random_uuid(),
  id_producto         uuid not null references public.productos(id_producto) on delete cascade,
  nombre              text not null,
  fecha_creacion      timestamptz not null default now(),
  fecha_modificacion  timestamptz,
  usuario_creacion    uuid not null default auth.uid() references auth.users(id),
  usuario_modificacion uuid references auth.users(id)
);

-- 4) ROLES (metadatos de usuario, enlazado a auth.users)
create table if not exists public.roles (
  id_rol         uuid primary key default gen_random_uuid(),
  codigo         text unique not null,        -- ej: 'admin', 'editor', 'viewer'
  descripcion    text,
  fecha_creacion timestamptz not null default now(),
  fecha_modificacion timestamptz
);

-- 5) PERFILES (metadatos de usuario, enlazado a auth.users)
create table if not exists public.perfiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nombre_usuario      text unique not null,
  id_rol              uuid not null references public.roles(id_rol),
  fecha_creacion      timestamptz default now(),
  fecha_modificacion  timestamptz
);

-- ================================
-- Índices recomendados
-- ================================
-- FK lookups
create index if not exists idx_productos_categoria on public.productos (id_categoria);
create index if not exists idx_ingredientes_producto on public.ingredientes (id_producto);

-- Búsqueda flexible por nombre/marca (trigramas)
create index if not exists productos_nombre_trgm on public.productos using gin (nombre gin_trgm_ops);
create index if not exists productos_marca_trgm on public.productos using gin (marca gin_trgm_ops);

-- Listados por categoría/fecha
create index if not exists productos_cat_nombre on public.productos (id_categoria, nombre);
create index if not exists productos_cat_fecha on public.productos (id_categoria, fecha_creacion desc);

-- ================================
-- Triggers de auditoría (update)
--  - Setea fecha_modificacion = now()
--  - Setea usuario_modificacion = auth.uid()
-- ================================
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  new.fecha_modificacion := now();
  -- Si hay contexto de Auth (vía PostgREST/SDK/Edge Function con JWT), auth.uid() devuelve el usuario
  begin
    new.usuario_modificacion := auth.uid();
  exception
    when others then
      -- En conexiones server-side sin JWT, deja usuario_modificacion como está (o nulo)
      null;
  end;
  return new;
end;
$$;

-- Crear triggers para cada tabla
drop trigger if exists trg_categorias_audit on public.categorias;
create trigger trg_categorias_audit
before update on public.categorias
for each row execute function public.set_audit_fields();

drop trigger if exists trg_productos_audit on public.productos;
create trigger trg_productos_audit
before update on public.productos
for each row execute function public.set_audit_fields();

drop trigger if exists trg_ingredientes_audit on public.ingredientes;
create trigger trg_ingredientes_audit
before update on public.ingredientes
for each row execute function public.set_audit_fields();

drop trigger if exists trg_perfiles_audit on public.perfiles;
create trigger trg_perfiles_audit
before update on public.perfiles
for each row execute function public.set_audit_fields();