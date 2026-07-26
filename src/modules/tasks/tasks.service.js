import { logger } from '../../core/logger.js';
import { generateId } from '../../utils/id.js';

export class TasksService {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  publishTask(agentName, sessionId, description) {
    if (!agentName || !sessionId || !description) {
      throw new Error('agentName, sessionId, and description are required');
    }

    try {
      const taskId = generateId('tsk');
      this.db.prepare(
        'INSERT INTO tasks (id, session_id, publisher, description) VALUES (?, ?, ?, ?)'
      ).run(taskId, sessionId, agentName, description);

      const task = { id: taskId, session_id: sessionId, publisher: agentName, description, status: 'open' };
      logger.info({ taskId, publisher: agentName }, 'Task published');
      
      const sysMsgId = generateId('msg');
      const sysContent = `New Task Published: [${taskId}] ${description}`;
      const metadataStr = JSON.stringify({ task_id: taskId });

      this.db.prepare(`
        INSERT INTO messages (id, session_id, from_agent, content, type, metadata, priority)
        VALUES (?, ?, 'SYSTEM', ?, 'system', ?, 'high')
      `).run(sysMsgId, sessionId, sysContent, metadataStr);

      this.eventBus.emit('message:new', {
        id: sysMsgId,
        session_id: sessionId,
        from: 'SYSTEM',
        content: sysContent,
        type: 'system',
        metadata: metadataStr,
        priority: 'high',
        created_at: new Date().toISOString()
      });

      return task;
    } catch (err) {
      logger.error({ err, agentName }, 'Failed to publish task');
      throw err;
    }
  }

  listTasks(sessionId) {
    if (!sessionId) throw new Error('sessionId is required');
    try {
      return this.db.prepare("SELECT * FROM tasks WHERE session_id = ? AND status = 'open'").all(sessionId);
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to list tasks');
      throw err;
    }
  }

  claimTask(agentName, taskId) {
    if (!agentName || !taskId) throw new Error('agentName and taskId are required');

    try {
      const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      if (!task) throw new Error('Task not found');
      if (task.status !== 'open') throw new Error(`Task is already ${task.status}`);

      this.db.prepare(
        "UPDATE tasks SET status = 'in_progress', claimant = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(agentName, taskId);

      logger.info({ taskId, claimant: agentName }, 'Task claimed');
      
      const sysMsgId = generateId('msg');
      const sysContent = `Task [${taskId}] claimed by ${agentName}`;
      const metadataStr = JSON.stringify({ task_id: taskId, claimant: agentName });

      this.db.prepare(`
        INSERT INTO messages (id, session_id, from_agent, content, type, metadata, priority)
        VALUES (?, ?, 'SYSTEM', ?, 'system', ?, 'normal')
      `).run(sysMsgId, task.session_id, sysContent, metadataStr);

      this.eventBus.emit('message:new', {
        id: sysMsgId,
        session_id: task.session_id,
        from: 'SYSTEM',
        content: sysContent,
        type: 'system',
        metadata: metadataStr,
        priority: 'normal',
        created_at: new Date().toISOString()
      });

      return { success: true, message: `Task ${taskId} claimed successfully.` };
    } catch (err) {
      logger.error({ err, agentName, taskId }, 'Failed to claim task');
      throw err;
    }
  }
}
