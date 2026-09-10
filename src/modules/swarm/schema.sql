-- Schema del módulo "swarm" — Mente colmena planificadora.
-- Almacena planes maestros, hojas de tarea y el catálogo de skills.
-- La mente colmena DISEÑA y ORGANIZA; otras LLM EJECUTAN las tareas.

CREATE TABLE IF NOT EXISTS swarm_plans (
  id            TEXT PRIMARY KEY,
  objective     TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',   -- draft | ready | executing | done | archived
  source        TEXT NOT NULL DEFAULT 'manual',  -- manual | self_improve
  parent_plan   TEXT,                            -- plan del que nació (automimejora)
  metadata      TEXT,                            -- JSON: {target, tags, owner}
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS swarm_tasks (
  id                TEXT PRIMARY KEY,
  plan_id           TEXT NOT NULL REFERENCES swarm_plans(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  deliverable       TEXT,        -- qué debe producir la LLM ejecutora
  accept_criteria   TEXT,        -- JSON array: criterios de aceptación
  dependencies      TEXT,        -- JSON array: ids de tareas que deben completarse antes
  capabilities      TEXT,        -- JSON array: skills/capabilities requeridos
  suggested_model   TEXT,        -- modelo LiteLLM sugerido para ejecutar
  assigned_to       TEXT,        -- agente/LLM externa que la tomará (null = sin asignar)
  status            TEXT NOT NULL DEFAULT 'ready',  -- ready | in_progress | done | blocked
  result_ref        TEXT,        -- ref/summary cuando esté ejecutada
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS swarm_skills (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  domain        TEXT,
  description   TEXT,
  source        TEXT NOT NULL DEFAULT 'known',   -- known | proposed (faltante)
  agent         TEXT,                            -- agente que lo posee (si es conocido)
  confidence    REAL DEFAULT 1.0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS swarm_reflections (
  id           TEXT PRIMARY KEY,
  plan_id      TEXT REFERENCES swarm_plans(id),
  summary      TEXT,
  strengths    TEXT,          -- JSON array
  gaps         TEXT,          -- JSON array
  next_plan_id TEXT,          -- plan de automimejora propuesto
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- T1: Los aportes individuales de cada modelo durante la deliberación se
-- pierden tras la síntesis. Esta tabla los retiene para trazabilidad,
-- auditoría y reutilización (harness de la mente colmena).
CREATE TABLE IF NOT EXISTS swarm_contributions (
  id           TEXT PRIMARY KEY,
  plan_id      TEXT NOT NULL REFERENCES swarm_plans(id) ON DELETE CASCADE,
  model        TEXT NOT NULL,            -- nombre del modelo que aportó
  role         TEXT,                     -- producer | reviewer | critic | chair ...
  content      TEXT NOT NULL,            -- texto crudo del aporte (sin el prefijo [name (role)])
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_plan ON swarm_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_skills_name ON swarm_skills(name);
CREATE INDEX IF NOT EXISTS idx_contrib_plan ON swarm_contributions(plan_id);
