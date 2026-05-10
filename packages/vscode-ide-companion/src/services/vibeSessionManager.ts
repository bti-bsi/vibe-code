/**
 * @license
 * Copyright 2025 Vibe Team
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { getProjectHash } from '@vibe-bti/vibe-code-core/src/utils/paths.js';
import type { VibeSession } from './vibeSessionReader.js';

/**
 * Vibe Session Manager
 *
 * This service provides direct filesystem access to load sessions.
 *
 * Note: Sessions are auto-saved by the CLI's ChatRecordingService.
 * This class is primarily used as a fallback mechanism for loading sessions
 * when ACP methods are unavailable or fail.
 */
export class VibeSessionManager {
  private vibeDir: string;

  constructor() {
    this.vibeDir = path.join(os.homedir(), '.vibe');
  }

  /**
   * Get the session directory for a project with backward compatibility
   */
  private getSessionDir(workingDir: string): string {
    const projectHash = getProjectHash(workingDir);
    const sessionDir = path.join(this.vibeDir, 'tmp', projectHash, 'chats');
    return sessionDir;
  }

  /**
   * Generate a new session ID
   */
  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Load a saved session by name
   *
   * @param sessionName - Name/tag of the session to load
   * @param workingDir - Current working directory
   * @returns Loaded session or null if not found
   */
  async loadSession(
    sessionId: string,
    workingDir: string,
  ): Promise<VibeSession | null> {
    try {
      const sessionDir = this.getSessionDir(workingDir);
      const filename = `session-${sessionId}.json`;
      const filePath = path.join(sessionDir, filename);

      if (!fs.existsSync(filePath)) {
        console.log(`[VibeSessionManager] Session file not found: ${filePath}`);
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const session = JSON.parse(content) as VibeSession;

      console.log(`[VibeSessionManager] Session loaded: ${filePath}`);
      return session;
    } catch (error) {
      console.error('[VibeSessionManager] Failed to load session:', error);
      return null;
    }
  }

  /**
   * List all saved sessions
   *
   * @param workingDir - Current working directory
   * @returns Array of session objects
   */
  async listSessions(workingDir: string): Promise<VibeSession[]> {
    try {
      const sessionDir = this.getSessionDir(workingDir);

      if (!fs.existsSync(sessionDir)) {
        return [];
      }

      const files = fs
        .readdirSync(sessionDir)
        .filter(
          (file) => file.startsWith('session-') && file.endsWith('.json'),
        );

      const sessions: VibeSession[] = [];
      for (const file of files) {
        try {
          const filePath = path.join(sessionDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const session = JSON.parse(content) as VibeSession;
          sessions.push(session);
        } catch (error) {
          console.error(
            `[VibeSessionManager] Failed to read session file ${file}:`,
            error,
          );
        }
      }

      // Sort by last updated time (newest first)
      sessions.sort(
        (a, b) =>
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
      );

      return sessions;
    } catch (error) {
      console.error('[VibeSessionManager] Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Delete a saved session
   *
   * @param sessionId - ID of the session to delete
   * @param workingDir - Current working directory
   * @returns True if deleted successfully, false otherwise
   */
  async deleteSession(sessionId: string, workingDir: string): Promise<boolean> {
    try {
      const sessionDir = this.getSessionDir(workingDir);
      const filename = `session-${sessionId}.json`;
      const filePath = path.join(sessionDir, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[VibeSessionManager] Session deleted: ${filePath}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[VibeSessionManager] Failed to delete session:', error);
      return false;
    }
  }
}
