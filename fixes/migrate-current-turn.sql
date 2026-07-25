-- Migrate sessions table to include current_turn
ALTER TABLE sessions ADD COLUMN current_turn TEXT;
