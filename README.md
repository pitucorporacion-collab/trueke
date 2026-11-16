# Trueke PRG

Aplicación web adaptable a celulares y computadoras para una comunidad privada de trueques de Río Grande. No incluye pagos, precios ni transferencias.

## Funciones incluidas

- Registro con teléfono, contraseña y código general de invitación.
- Validación del teléfono contra una lista privada de números autorizados.
- Alta pendiente de aprobación administrativa.
- Publicaciones con foto, qué ofrecés y qué buscás en un solo formulario.
- Intereses mutuos, propuestas directas, coincidencias y mensajería privada.
- Denuncias de publicaciones y herramientas de moderación.
- Denuncias y panel de administración.
- Diseño adaptable a celular y computadora.

## Tecnología

- React + Vite.
- Supabase para autenticación, base de datos y almacenamiento.
- GitHub Actions para comprobar que el proyecto compile.

## Preparación de Supabase

1. Crear un proyecto gratuito en https://supabase.com/.
2. En el panel de Supabase, abrir **SQL Editor** y ejecutar el archivo `supabase/schema.sql`.
3. En **Authentication → Providers → Phone**, habilitar Phone y desactivar la confirmación por SMS. El ingreso usa contraseña; el teléfono no queda verificado automáticamente.
4. En **Authentication → Settings**, revisar las políticas de contraseñas y límites de acceso.
5. En **Project Settings → API**, copiar Project URL y la clave anon/public.
6. Crear un archivo `.env.local` a partir de `.env.example` y completar las dos variables.
7. En SQL Editor, agregar el primer teléfono autorizado y configurar el código general. Después de crear la cuenta del administrador, promover su perfil con el SQL indicado abajo.
8. Ejecutar `npm install` y `npm run dev`.

### Primer administrador

Antes de registrar la cuenta administradora, ejecutar (reemplazando el teléfono y el código):

```sql
insert into public.app_settings (key, value)
values ('invite_code', '"CAMBIAR-ESTE-CODIGO"'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into public.authorized_phones (phone, note)
values ('+5492964XXXXXX', 'Administrador')
on conflict (phone) do nothing;
```

Luego registrarse desde la aplicación con ese teléfono y contraseña. Una vez creada la cuenta, ejecutar:

```sql
update public.profiles
set role = 'admin', status = 'active'
where phone = '+5492964XXXXXX';
```

Desde el panel de administración se pueden agregar los demás teléfonos autorizados y aprobar usuarios pendientes.

## Seguridad importante del registro

El código general es una invitación compartida, no una prueba de identidad ni de titularidad del teléfono. Por eso cada cuenta nueva queda **pendiente** hasta que el administrador la apruebe. No publicar la lista de teléfonos ni la clave de servicio de Supabase. En el navegador solo se usa la clave anon/public; nunca la service_role.

## Publicación online

El proyecto puede desplegarse en Vercel o Netlify conectando este repositorio. Configurar allí las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Agregar el dominio publicado en Supabase → Authentication → URL Configuration.

## Estado

El código inicial está preparado. Para que los 300 miembros compartan datos en internet falta crear/configurar el proyecto Supabase y desplegar la web. Sin esas credenciales, la app abre en modo demostración local.
