-- ============================================================
-- Usuario de SOLO LECTURA para el chatbot (Módulo 3.2)
-- Ejecutar con el usuario ADMINISTRADOR (en Neon: SQL Editor).
--
-- Cambia la contraseña antes de ejecutarlo. Si usas
-- `npm run db:apply`, el texto __READER_PASSWORD__ se reemplaza
-- automáticamente por DB_PASSWORD de backend/.env.
-- Neon exige contraseñas robustas (mínimo ~12 caracteres variados).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_reader') THEN
    CREATE ROLE chatbot_reader WITH LOGIN PASSWORD '__READER_PASSWORD__';
  ELSE
    ALTER ROLE chatbot_reader WITH LOGIN PASSWORD '__READER_PASSWORD__';
  END IF;
END
$$;

-- Acceso a la base de datos actual (funciona aunque se llame "neondb" o "chatbot-urp")
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO chatbot_reader', current_database());
END
$$;

-- Acceso al esquema público
GRANT USAGE ON SCHEMA public TO chatbot_reader;

-- Solo SELECT en las tablas actuales...
GRANT SELECT ON ALL TABLES IN SCHEMA public TO chatbot_reader;

-- ...y en las tablas que se creen en el futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO chatbot_reader;

-- Defensa en profundidad: aunque alguien lograra saltarse el SQL Validator,
-- la sesión de este usuario es de solo lectura y las consultas largas se cortan.
ALTER ROLE chatbot_reader SET default_transaction_read_only = on;
ALTER ROLE chatbot_reader SET statement_timeout = '10s';

-- Nadie (salvo el dueño) puede crear objetos en public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
