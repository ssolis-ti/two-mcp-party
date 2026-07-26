-- Migración para agregar columna faltante current_session_id
-- Ejecutar: sqlite3 agentbridge.db < fixes/migrate-current-session-id.sql

-- La columna current_session_id se agregó en una versión posterior del schema.
-- Si la DB se creó antes de ese cambio, esta migración la agrega sin perder datos.

ALTER TABLE agents ADD COLUMN current_session_id TEXT;
