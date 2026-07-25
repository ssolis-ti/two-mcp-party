-- Migrate messages table to include priority
ALTER TABLE messages ADD COLUMN priority TEXT DEFAULT 'normal';
