import Database from 'better-sqlite3';
import { SessionsService } from './src/modules/sessions/sessions.service.js';
import { MessagingService } from './src/modules/messaging/messaging.service.js';
import { LoopService } from './src/modules/messaging/loop.service.js';
import { eventBus } from './src/core/event-bus.js';
import fs from 'fs';

async function run() {
  console.log('Testing Handshake and Anti-Looping...');
  
  const db = new Database(':memory:');
  
  // Load schemas
  const schemas = [
    'src/modules/sessions/sessions.schema.sql',
    'src/modules/agents/agents.schema.sql',
    'src/modules/messaging/messaging.schema.sql'
  ];
  for (const s of schemas) {
    db.exec(fs.readFileSync(s, 'utf-8'));
  }

  const loopService = new LoopService(db);
  const sessionsService = new SessionsService(db, eventBus);
  const messagingService = new MessagingService(db, eventBus, loopService);

  // Register agents manually in DB
  db.prepare("INSERT INTO agents (name, description, type, status) VALUES ('SYSTEM', 'System', 'system', 'online')").run();
  db.prepare("INSERT INTO agents (name, description, type, status) VALUES ('test_a', 'A', 'developer', 'online')").run();
  db.prepare("INSERT INTO agents (name, description, type, status) VALUES ('test_b', 'B', 'developer', 'online')").run();

  // Create session
  const session = sessionsService.createSession({ name: 'Test Session', mode: 'autopilot' });
  
  // Join first agent
  sessionsService.joinSession('test_a', session.id);
  
  // Join second agent -> should trigger Handshake
  sessionsService.joinSession('test_b', session.id);
  
  // Check if system message was generated
  const msgs = messagingService.getMessages('test_a');
  console.log('Messages after join:');
  
  const handshake = msgs.find(m => m.from_agent === 'SYSTEM');
  if (handshake && handshake.content.includes('Participantes')) {
    console.log('✅ Handshake V2 working');
  } else {
    console.log('❌ Handshake V2 failed');
    console.dir(msgs, {depth: null});
  }

  // Test anti-looping
  console.log('Testing Anti-looping...');
  for (let i = 0; i < 5; i++) {
    try {
      messagingService.sendMessage({
        from: 'test_a',
        content: '{"name": "bridge_list_sessions"}', // same tool content
        priority: 'critical'
      });
    } catch (e) {
      // Could fail if it's not test_a's turn, but autopilot handles it differently or we can just yield.
      console.log('Send errored:', e.message);
    }
  }

  const msgs2 = messagingService.getMessages('test_a');
  const loopSysMsg = msgs2.find(m => m.from_agent === 'SYSTEM' && m.content.includes('Anti-Looping'));
  
  if (loopSysMsg) {
    console.log('✅ Anti-Looping working');
  } else {
    console.log('❌ Anti-Looping failed');
    console.dir(msgs2.map(m => m.content), {depth: null});
  }
}

run();
