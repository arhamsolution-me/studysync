import fs from 'fs';
import path from 'path';

export type WhatsAppState = 'OFF' | 'IDLE' | 'COURSE_CHAT';

export interface UserSession {
  jid: string;
  state: WhatsAppState;
  activeCourseId: string | null;
  activeCourseName: string | null;
  lastActive: number;
}

const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
const SESSIONS_FILE = path.resolve(baseDir, 'storage', 'whatsapp_sessions.json');

class WhatsAppStateManager {
  private sessions = new Map<string, UserSession>();

  constructor() {
    this.loadSessions();
  }

  private loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          data.forEach((s: UserSession) => this.sessions.set(s.jid, s));
        }
      }
    } catch (err) {
      console.warn('[WhatsAppState] Error loading whatsapp_sessions.json:', err);
    }
  }

  private saveSessions() {
    try {
      const dir = path.dirname(SESSIONS_FILE);
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      }
      const data = Array.from(this.sessions.values());
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[WhatsAppState] Error saving whatsapp_sessions.json:', err);
    }
  }

  getSession(jid: string): UserSession {
    let session = this.sessions.get(jid);
    if (!session) {
      session = {
        jid,
        state: 'OFF',
        activeCourseId: null,
        activeCourseName: null,
        lastActive: Date.now(),
      };
      this.sessions.set(jid, session);
      this.saveSessions();
    }
    return session;
  }

  activateAgent(jid: string): UserSession {
    const session = this.getSession(jid);
    session.state = 'IDLE';
    session.activeCourseId = null;
    session.activeCourseName = null;
    session.lastActive = Date.now();
    this.sessions.set(jid, session);
    this.saveSessions();
    return session;
  }

  deactivateAgent(jid: string): UserSession {
    const session = this.getSession(jid);
    session.state = 'OFF';
    session.activeCourseId = null;
    session.activeCourseName = null;
    session.lastActive = Date.now();
    this.sessions.set(jid, session);
    this.saveSessions();
    return session;
  }

  enterCourse(jid: string, courseId: string, courseName: string): UserSession {
    const session = this.getSession(jid);
    session.state = 'COURSE_CHAT';
    session.activeCourseId = courseId;
    session.activeCourseName = courseName;
    session.lastActive = Date.now();
    this.sessions.set(jid, session);
    this.saveSessions();
    return session;
  }

  exitCourse(jid: string): UserSession {
    const session = this.getSession(jid);
    session.state = 'IDLE';
    session.activeCourseId = null;
    session.activeCourseName = null;
    session.lastActive = Date.now();
    this.sessions.set(jid, session);
    this.saveSessions();
    return session;
  }

  updateActivity(jid: string) {
    const session = this.getSession(jid);
    session.lastActive = Date.now();
    this.saveSessions();
  }

  getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }
}

export const whatsAppStateManager = new WhatsAppStateManager();
