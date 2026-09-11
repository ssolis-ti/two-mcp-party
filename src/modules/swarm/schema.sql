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
  -- known    : capacidad real del catalogo semilla.
  -- proposed : la exige una tarea y NO existe en el catalogo -> carencia real.
  -- orphan   : sugerido en su momento a nivel de plan, pero ninguna tarea lo
  --            exige. Se conserva como registro historico; no es una carencia.
  source        TEXT NOT NULL DEFAULT 'known',   -- known | proposed | orphan
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

-- FEAT-011: el sintetizador consolida por contrato, y consolidar destruye el
-- desacuerdo: cuando un angulo invalidaba lo que otro proponia, la objecion se
-- promediaba hacia la nada. Esta tabla la retiene como artefacto de primera clase.
-- Relacional (no un array JSON en el plan) para poder unir disputas con tickets.
CREATE TABLE IF NOT EXISTS swarm_disputes (
  id           TEXT PRIMARY KEY,
  plan_id      TEXT NOT NULL REFERENCES swarm_plans(id) ON DELETE CASCADE,
  claim        TEXT NOT NULL,                    -- la objecion, en palabras del objetor
  raised_by    TEXT,                             -- angulo que objeto (NO es identidad verificable)
  target       TEXT,                             -- titulo de tarea o propuesta objetada
  target_task  TEXT REFERENCES swarm_tasks(id),  -- resuelto por titulo tras crear las tareas
  severity     TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high | critical
  resolution   TEXT NOT NULL DEFAULT 'open',     -- open | accepted | dismissed
  rationale    TEXT,                             -- obligatorio y verificado por codigo si dismissed
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Que skill exige cada tarea. `swarm_tasks.capabilities` guarda lo que el modelo
-- escribio (texto libre) y se conserva como registro crudo; esta tabla es la
-- relacion RESUELTA contra el catalogo. Sin ella, "que tareas necesitan este
-- skill" era un LIKE sobre un blob JSON, y habia capabilities referenciadas que
-- no existian en swarm_skills: el cruce por nombre no fallaba, simplemente no
-- encontraba nada y nadie se enteraba.
CREATE TABLE IF NOT EXISTS swarm_task_skills (
  task_id   TEXT NOT NULL REFERENCES swarm_tasks(id) ON DELETE CASCADE,
  skill_id  TEXT NOT NULL REFERENCES swarm_skills(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_plan ON swarm_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_disputes_plan ON swarm_disputes(plan_id);
CREATE INDEX IF NOT EXISTS idx_task_skills_skill ON swarm_task_skills(skill_id);
-- El catalogo se consulta por nombre; sin esto nada impedia dos filas homonimas
-- con ids distintos, y una tarea podia resolver contra cualquiera de las dos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_unique ON swarm_skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_name ON swarm_skills(name);
CREATE INDEX IF NOT EXISTS idx_contrib_plan ON swarm_contributions(plan_id);
