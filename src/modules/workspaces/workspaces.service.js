import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../core/logger.js';

export class WorkspacesService {
  constructor(db, eventBus, config = {}) {
    this.db = db;
    this.eventBus = eventBus;
    // Base dir for all workspaces (defaults to process.cwd()/workspaces)
    this.workspacesRoot = config.workspacesRoot || path.join(process.cwd(), 'workspaces');

    this.eventBus.on('session:created', async ({ sessionId }) => {
      try {
        await this.initWorkspace(sessionId);
      } catch (e) {
        logger.error({ err: e, sessionId }, 'Failed to auto-init workspace for new session');
      }
    });
  }

  /**
   * Initializes the workspace root and session specific folder
   */
  async initWorkspace(sessionId) {
    if (!sessionId) throw new Error('sessionId is required');
    if (/[\/\\]|\.\./.test(sessionId)) throw new Error('Security Error: Invalid sessionId format');
    
    try {
      await fs.mkdir(this.workspacesRoot, { recursive: true });
      const sessionPath = path.join(this.workspacesRoot, sessionId);
      await fs.mkdir(sessionPath, { recursive: true });
      logger.info({ sessionId, path: sessionPath }, 'Workspace initialized');
      return sessionPath;
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to initialize workspace');
      throw err;
    }
  }

  /**
   * Validates a path to prevent Directory Traversal
   * Returns the absolute safe path.
   */
  getSafePath(sessionId, requestedPath) {
    if (!sessionId || !requestedPath) throw new Error('sessionId and requestedPath are required');
    if (/[\/\\]|\.\./.test(sessionId)) throw new Error('Security Error: Invalid sessionId format');

    const sessionRoot = path.join(this.workspacesRoot, sessionId);
    
    // Normalize resolving the requested path relative to the session root
    const absolutePath = path.resolve(sessionRoot, requestedPath);

    // Security check: Must be inside the session root folder
    const relative = path.relative(sessionRoot, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      logger.warn({ sessionId, requestedPath, absolutePath }, 'Path traversal attempt blocked');
      throw new Error(`Security Error: Access denied. Path ${requestedPath} is outside the session workspace.`);
    }

    return absolutePath;
  }

  async writeFile(sessionId, filePath, content) {
    const safePath = this.getSafePath(sessionId, filePath);
    try {
      // Create subdirectories if they don't exist
      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, content, 'utf-8');
      
      this.eventBus.emit('workspace:file_written', { sessionId, filePath });
      return { success: true, message: `File ${filePath} written successfully.` };
    } catch (err) {
      logger.error({ err, sessionId, filePath }, 'Failed to write workspace file');
      throw new Error(`Failed to write file: ${err.message}`);
    }
  }

  async readFile(sessionId, filePath) {
    const safePath = this.getSafePath(sessionId, filePath);
    try {
      const content = await fs.readFile(safePath, 'utf-8');
      return { content };
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error(`File not found: ${filePath}`);
      logger.error({ err, sessionId, filePath }, 'Failed to read workspace file');
      throw new Error(`Failed to read file: ${err.message}`);
    }
  }

  async listFiles(sessionId, dirPath = '.') {
    const safePath = this.getSafePath(sessionId, dirPath);
    try {
      const entries = await fs.readdir(safePath, { withFileTypes: true });
      
      const files = entries.map(dirent => ({
        name: dirent.name,
        type: dirent.isDirectory() ? 'directory' : 'file',
        path: path.normalize(path.join(dirPath, dirent.name)).replace(/\\/g, '/')
      }));

      return { files };
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error(`Directory not found: ${dirPath}`);
      logger.error({ err, sessionId, dirPath }, 'Failed to list workspace files');
      throw new Error(`Failed to list files: ${err.message}`);
    }
  }
}
