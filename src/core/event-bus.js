import { EventEmitter } from 'events';
import { logger } from './logger.js';

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // AgentBridge puede tener muchos listeners
  }

  emit(eventName, ...args) {
    logger.debug({ event: eventName }, 'Event emitted');
    return super.emit(eventName, ...args);
  }
}

export const eventBus = new EventBus();
