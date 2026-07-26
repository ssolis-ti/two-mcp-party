-- Migración: Agregar soporte de modos a sessions
-- Ejecutar solo si la DB ya existe y no tiene estas columnas

ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'moderator';
ALTER TABLE sessions ADD COLUMN mode_config TEXT;
ALTER TABLE sessions ADD COLUMN turn_count INTEGER DEFAULT 0;
