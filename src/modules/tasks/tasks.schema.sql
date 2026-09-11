CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    publisher TEXT NOT NULL,
    claimant TEXT,
    status TEXT DEFAULT 'open', -- open, in_progress, completed, failed
    description TEXT NOT NULL,
    -- Ticket ejecutable <-> hoja de tarea que la colmena diseño. Sin esta
    -- relacion, materialize copiaba el contenido del plan como texto plano y no
    -- habia forma de preguntar que tarea del plan ejecuta un ticket: planificacion
    -- y ejecucion vivian como dos universos sin una sola FK entre ellos.
    -- NULL es legitimo: un ticket publicado a mano no nace de ningun plan.
    swarm_task_id TEXT REFERENCES swarm_tasks(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_swarm_task ON tasks(swarm_task_id);
