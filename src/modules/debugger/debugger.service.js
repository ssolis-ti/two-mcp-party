import fs from 'fs';
import path from 'path';
import os from 'os';

export class DebuggerService {
  constructor(db) {
    this.db = db;
    this.logsPath = path.join(process.cwd(), 'logs/bridge.log');
    this.srcPath = path.join(process.cwd(), 'src');
  }

  getLogs(lines = 100) {
    if (!fs.existsSync(this.logsPath)) {
      return "Log file does not exist yet.";
    }

    try {
      // Método simple para archivos pequeños/medianos
      const content = fs.readFileSync(this.logsPath, 'utf-8');
      const allLines = content.split('\n').filter(Boolean);
      return allLines.slice(-lines).join('\n');
    } catch (error) {
      return `Error reading logs: ${error.message}`;
    }
  }

  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    
    // Contar tablas / tamaño de DB básico
    let dbMetrics = {};
    try {
      const agentsCount = this.db.prepare('SELECT COUNT(*) as c FROM agents').get();
      const msgsCount = this.db.prepare('SELECT COUNT(*) as c FROM messages').get();
      const memCount = this.db.prepare('SELECT COUNT(*) as c FROM shared_memory').get();
      
      dbMetrics = {
        registered_agents: agentsCount?.c || 0,
        total_messages: msgsCount?.c || 0,
        shared_memory_entries: memCount?.c || 0
      };
    } catch (e) {
      dbMetrics = { error: 'DB not fully initialized' };
    }

    return {
      uptime_seconds: process.uptime(),
      nodejs_version: process.version,
      memory_usage_mb: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      },
      host_os: {
        platform: os.platform(),
        free_mem_mb: Math.round(os.freemem() / 1024 / 1024),
        total_mem_mb: Math.round(os.totalmem() / 1024 / 1024)
      },
      database_metrics: dbMetrics
    };
  }

  readSourceFile(relativePath) {
    const absolutePath = path.resolve(this.srcPath, relativePath);
    
    // SEGURIDAD: Prevenir path traversal fuera de src/
    if (!absolutePath.startsWith(this.srcPath)) {
      throw new Error(`SECURITY VIOLATION: Cannot read files outside of the src/ directory.`);
    }

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      const files = fs.readdirSync(absolutePath);
      return `DIRECTORY LISTING of ${relativePath}:\n- ` + files.join('\n- ');
    }

    return fs.readFileSync(absolutePath, 'utf-8');
  }
}
