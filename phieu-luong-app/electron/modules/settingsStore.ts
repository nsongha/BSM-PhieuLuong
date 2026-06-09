import Store from 'electron-store';
import { safeStorage } from 'electron';
import type { Settings, LogEntry, Checkpoint, EmailTemplate } from '../preload';
import { DEFAULT_EMAIL_TEMPLATES } from './emailSender';

type SettingsFile = {
  settings?: Settings;
  encryptedPassword?: string;
  encryptedTrackerSecret?: string;
  encryptedCheckpoint?: string;
  /** Deprecated — plaintext log từ các phiên bản cũ, migrate sang encryptedLog. */
  log?: LogEntry[];
  encryptedLog?: string;
  emailTemplates?: EmailTemplate[];
  activeTemplateIndex?: number;
};

const store = new Store<SettingsFile>({
  name: 'phieu-luong-config',
  defaults: {},
});

const DEFAULT_SETTINGS: Settings = {
  companyName: '',
  emailUser: '',
  emailTest: '',
  trackingEnabled: false,
  isConfigured: false,
};

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(store.get('settings') ?? {}) };
}

export function saveSettings(
  s: Settings,
  plainPassword?: string,
  plainTrackerSecret?: string
): void {
  store.set('settings', { ...s });
  if (plainPassword !== undefined && plainPassword !== '') {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage không khả dụng trên máy này — không thể lưu password an toàn');
    }
    const enc = safeStorage.encryptString(plainPassword);
    store.set('encryptedPassword', enc.toString('base64'));
  }
  if (plainTrackerSecret !== undefined) {
    if (plainTrackerSecret === '') {
      store.delete('encryptedTrackerSecret');
    } else {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage không khả dụng — không thể lưu tracker secret an toàn');
      }
      const enc = safeStorage.encryptString(plainTrackerSecret);
      store.set('encryptedTrackerSecret', enc.toString('base64'));
    }
  }
}

export function getEmailPassword(): string | null {
  const b64 = store.get('encryptedPassword');
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export function getTrackerSecret(): string | null {
  const b64 = store.get('encryptedTrackerSecret');
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

function readRawLog(): LogEntry[] {
  const b64 = store.get('encryptedLog');
  if (b64) {
    try {
      const buf = Buffer.from(b64, 'base64');
      const json = safeStorage.decryptString(buf);
      return JSON.parse(json) as LogEntry[];
    } catch {
      return [];
    }
  }
  // Migration: log cũ plaintext → đọc 1 lần rồi ghi lại đã mã hoá, xoá field cũ
  const legacy = store.get('log');
  if (legacy && Array.isArray(legacy)) {
    writeRawLog(legacy);
    store.delete('log');
    return legacy;
  }
  return [];
}

function writeRawLog(log: LogEntry[]): void {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback plaintext — cảnh báo rõ. Tránh mất log hoàn toàn ở máy lạ.
    console.warn('[log] safeStorage không khả dụng — ghi log plaintext');
    store.set('log', log);
    return;
  }
  const enc = safeStorage.encryptString(JSON.stringify(log));
  store.set('encryptedLog', enc.toString('base64'));
}

export function getLog(): LogEntry[] {
  return readRawLog().slice().reverse();
}

export function appendLog(entry: LogEntry): void {
  const cur = readRawLog();
  cur.push(entry);
  if (cur.length > 200) cur.shift();
  writeRawLog(cur);
}

export function saveCheckpoint(cp: Checkpoint): void {
  const json = JSON.stringify(cp);
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(json);
    store.set('encryptedCheckpoint', enc.toString('base64'));
  } else {
    // Không có safeStorage thì không lưu — tránh để plaintext PII trên disk
    console.warn('[checkpoint] safeStorage không khả dụng — bỏ qua persist checkpoint');
  }
}

export function getCheckpoint(): Checkpoint | null {
  const b64 = store.get('encryptedCheckpoint');
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    const json = safeStorage.decryptString(buf);
    return JSON.parse(json) as Checkpoint;
  } catch {
    return null;
  }
}

export function clearCheckpoint(): void {
  store.delete('encryptedCheckpoint');
}

export function getEmailTemplates(): EmailTemplate[] {
  const t = store.get('emailTemplates');
  if (!Array.isArray(t) || t.length !== 3) return [...DEFAULT_EMAIL_TEMPLATES];
  // normalize: đảm bảo đủ field
  return t.map((x, i) => ({
    name: typeof x?.name === 'string' && x.name ? x.name : DEFAULT_EMAIL_TEMPLATES[i].name,
    subject: typeof x?.subject === 'string' ? x.subject : DEFAULT_EMAIL_TEMPLATES[i].subject,
    body: typeof x?.body === 'string' ? x.body : DEFAULT_EMAIL_TEMPLATES[i].body,
  }));
}

export function saveEmailTemplates(templates: EmailTemplate[]): void {
  store.set('emailTemplates', templates.slice(0, 3));
}

export function getActiveTemplateIndex(): number {
  const i = store.get('activeTemplateIndex');
  return typeof i === 'number' && i >= 0 && i <= 2 ? i : 0;
}

export function setActiveTemplateIndex(i: number): void {
  store.set('activeTemplateIndex', Math.max(0, Math.min(2, i)));
}
