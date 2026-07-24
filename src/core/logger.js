import pino from 'pino';
import path from 'path';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          destination: 2 // OBLIGATORIO: stderr (2)
        },
        level: process.env.LOG_LEVEL || 'info'
      },
      {
        target: 'pino/file',
        options: {
          destination: path.join(process.cwd(), 'logs/bridge.log'),
          mkdir: true
        },
        level: 'debug' // En archivo guardamos todo siempre
      }
    ]
  }
});
