import Database from 'better-sqlite3';
import { SessionsService } from './src/modules/sessions/sessions.service.js';
import { WorkspacesService } from './src/modules/workspaces/workspaces.service.js';
import { eventBus } from './src/core/event-bus.js';

const db = new Database('agentbridge.db');
const workspaces = new WorkspacesService(db, eventBus);
const sessions = new SessionsService(db, eventBus);

const session = sessions.createSession({ name: 'Test Session', mode: 'moderator' });
console.log('Created session:', session.id);
