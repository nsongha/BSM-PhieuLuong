import { ipcMain, dialog, shell } from 'electron';
import { randomUUID } from 'crypto';
import { listSheets, readXlsx } from '../modules/excelReader';
import { validateAndMap } from '../modules/mappingValidator';
import { renderPayslipPdf, cleanupPdf, checkQpdf } from '../modules/pdfRenderer';
import {
  testConnection,
  sendWithRetry,
  buildAttachmentName,
  renderTemplate,
} from '../modules/emailSender';
import {
  getSettings,
  saveSettings,
  getEmailPassword,
  getTrackerSecret,
  appendLog,
  getLog,
  saveCheckpoint,
  getCheckpoint,
  clearCheckpoint,
  getEmailTemplates,
  getActiveTemplateIndex,
  saveEmailTemplates,
  setActiveTemplateIndex,
} from '../modules/settingsStore';
import type {
  Employee,
  Mapping,
  Settings,
  SendOptions,
  SendProgress,
  LogEntry,
  LogRecipient,
  Checkpoint,
  EmailTemplate,
} from '../preload';

let cancelRequested = false;
let batchInProgress = false;

// Render mẫu cho 1 nhân viên — thay 5 biến rồi trả subject + body text thuần.
function renderFor(tpl: EmailTemplate, emp: Employee, opts: SendOptions, settings: Settings) {
  const vars = {
    ten: emp.hoTen, thang: opts.month, nam: opts.year,
    cong_ty: settings.companyName, mat_khau: emp.pdfPassword,
  };
  return { subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars) };
}

export function registerIpcHandlers() {
  ipcMain.handle('email:cancel', async () => {
    cancelRequested = true;
  });

  ipcMain.handle('system:check-qpdf', async () => checkQpdf());

  ipcMain.handle('file:open-xlsx', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    return r.filePaths[0];
  });

  ipcMain.handle('excel:list-sheets', async (_e, filePath: string) => {
    return listSheets(filePath);
  });

  ipcMain.handle('excel:read', async (_e, filePath: string, sheetIndex?: number) => {
    return readXlsx(filePath, sheetIndex ?? 0);
  });

  ipcMain.handle(
    'mapping:validate',
    async (_e, rows: Record<string, unknown>[], mapping: Mapping) => {
      return validateAndMap(rows, mapping);
    }
  );

  ipcMain.handle(
    'pdf:preview',
    async (_e, employee: Employee, settings: Settings, opts: SendOptions) => {
      const result = await renderPayslipPdf(employee, settings, opts, { encrypt: false });
      const err = await shell.openPath(result.pdfPath);
      if (err) console.error('shell.openPath error:', err);
      return result;
    }
  );

  ipcMain.handle(
    'email:test-connection',
    async (_e, user: string, password: string) => {
      const pw = password || getEmailPassword();
      if (!pw) return { ok: false, error: 'Chưa có App Password để kiểm tra' };
      return testConnection(user, pw);
    }
  );

  ipcMain.handle(
    'email:dry-run',
    async (_e, employees: Employee[], settings: Settings, opts: SendOptions) => {
      const pw = getEmailPassword();
      if (!pw) return { ok: false, error: 'Chưa cấu hình email password' };
      if (!settings.emailTest) return { ok: false, error: 'Chưa cấu hình email test' };

      const sample =
        employees.length <= 3
          ? employees
          : [
              employees[0],
              employees[Math.floor(employees.length / 2)],
              employees[employees.length - 1],
            ];

      // Resolve mẫu 1 lần ở đầu — sửa mẫu giữa chừng không ảnh hưởng đợt này.
      const _tpls = getEmailTemplates();
      const tpl = _tpls[opts.templateIndex ?? getActiveTemplateIndex()] ?? _tpls[0];

      const recipients: LogRecipient[] = [];
      let succeeded = 0;
      let failed = 0;

      for (const emp of sample) {
        const trackToken =
          settings.trackingEnabled && settings.trackerEndpoint ? randomUUID() : undefined;
        const trackerPixelUrl =
          trackToken && settings.trackerEndpoint
            ? `${settings.trackerEndpoint.replace(/\/$/, '')}/api/t/${trackToken}.gif`
            : undefined;

        try {
          const { pdfPath } = await renderPayslipPdf(emp, settings, opts);
          try {
            const r = renderFor(tpl, emp, opts, settings);
            await sendWithRetry({
              user: settings.emailUser,
              password: pw,
              fromName: settings.companyName,
              to: settings.emailTest,
              subject: `[GỬI THỬ] ${r.subject} — ${emp.hoTen}`,
              body:
                `[GỬI THỬ] Email mẫu — nếu gửi thật sẽ đến: ${emp.email}\n\n` +
                r.body,
              attachmentPath: pdfPath,
              attachmentName: buildAttachmentName(emp.hoTen, emp.maNV, opts.month, opts.year),
              trackerPixelUrl,
            });
            succeeded += 1;
            recipients.push({
              hoTen: emp.hoTen,
              email: settings.emailTest,
              maNV: emp.maNV,
              status: 'sent',
              trackToken,
            });
          } finally {
            cleanupPdf(pdfPath);
          }
        } catch (e) {
          failed += 1;
          recipients.push({
            hoTen: emp.hoTen,
            email: emp.email,
            maNV: emp.maNV,
            status: 'failed',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      appendLog({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        month: opts.month,
        year: opts.year,
        total: sample.length,
        succeeded,
        failed,
        testMode: false,
        simulate: false,
        dryRun: true,
        recipients,
      });

      return { ok: failed === 0, error: failed > 0 ? `${failed}/${sample.length} thất bại` : undefined, sent: succeeded };
    }
  );

  ipcMain.handle(
    'email:send-batch',
    async (event, employees: Employee[], settings: Settings, opts: SendOptions) => {
      if (batchInProgress) throw new Error('Một đợt gửi khác đang chạy — chờ xong rồi thử lại');
      batchInProgress = true;
      cancelRequested = false;
      const pw = opts.simulate ? null : getEmailPassword();
      if (!opts.simulate && !pw) {
        batchInProgress = false;
        throw new Error('Chưa cấu hình email password');
      }
      const send = (p: SendProgress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('email:send-progress', p);
        }
      };

      send({ kind: 'start', total: employees.length });

      try {

      // Resolve mẫu 1 lần ở đầu batch — sửa mẫu giữa chừng không ảnh hưởng batch đang chạy.
      const _tpls = getEmailTemplates();
      const tpl = _tpls[opts.templateIndex ?? getActiveTemplateIndex()] ?? _tpls[0];

      // Resume nếu đúng batch còn checkpoint — skip các row đã xử lý
      const existing = getCheckpoint();
      const rowIndexSet = new Set(employees.map((e) => e.rowIndex));
      const resuming =
        existing &&
        existing.opts.month === opts.month &&
        existing.opts.year === opts.year &&
        existing.employees.length === employees.length &&
        existing.employees.every((e) => rowIndexSet.has(e.rowIndex));

      const processed = new Set<number>(resuming ? existing!.processedRowIndexes : []);
      const recipients: LogRecipient[] = resuming ? [...existing!.recipients] : [];
      let succeeded = recipients.filter((r) => r.status === 'sent').length;
      let failed = recipients.filter((r) => r.status === 'failed').length;

      const batchId = resuming ? existing!.batchId : randomUUID();
      const startedAt = resuming ? existing!.startedAt : new Date().toISOString();

      const persistCheckpoint = () => {
        if (opts.simulate) return; // Giả lập không cần checkpoint
        const cp: Checkpoint = {
          batchId,
          startedAt,
          employees,
          settings,
          opts,
          processedRowIndexes: Array.from(processed),
          recipients,
        };
        saveCheckpoint(cp);
      };

      const finishLog = () => {
        const entry: LogEntry = {
          id: batchId,
          timestamp: new Date().toISOString(),
          month: opts.month,
          year: opts.year,
          total: employees.length,
          succeeded,
          failed,
          testMode: opts.testMode,
          simulate: opts.simulate,
          recipients,
        };
        appendLog(entry);
        clearCheckpoint();
      };

      persistCheckpoint();

      for (const emp of employees) {
        if (processed.has(emp.rowIndex)) continue;
        if (cancelRequested || event.sender.isDestroyed()) {
          finishLog();
          send({ kind: 'done', total: employees.length, succeeded, failed });
          return;
        }
        if (emp.errors.length > 0) {
          failed += 1;
          const errMsg = emp.errors.join('; ');
          recipients.push({
            hoTen: emp.hoTen,
            email: emp.email,
            maNV: emp.maNV,
            status: 'failed',
            error: errMsg,
          });
          send({
            kind: 'failed',
            rowIndex: emp.rowIndex,
            hoTen: emp.hoTen,
            email: emp.email,
            error: errMsg,
          });
          processed.add(emp.rowIndex);
          persistCheckpoint();
          continue;
        }

        if (opts.simulate) {
          await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
          succeeded += 1;
          recipients.push({
            hoTen: emp.hoTen,
            email: emp.email,
            maNV: emp.maNV,
            status: 'sent',
          });
          send({
            kind: 'sent',
            rowIndex: emp.rowIndex,
            hoTen: emp.hoTen,
            email: emp.email,
          });
          processed.add(emp.rowIndex);
          // simulate không persist checkpoint — xem persistCheckpoint()
          continue;
        }

        const trackToken =
          settings.trackingEnabled && settings.trackerEndpoint ? randomUUID() : undefined;
        const trackerPixelUrl =
          trackToken && settings.trackerEndpoint
            ? `${settings.trackerEndpoint.replace(/\/$/, '')}/api/t/${trackToken}.gif`
            : undefined;

        try {
          const { pdfPath } = await renderPayslipPdf(emp, settings, opts);
          const recipientEmail = opts.testMode ? settings.emailTest : emp.email;
          const bodyPrefix = opts.testMode
            ? `[CHẾ ĐỘ TEST] Email này đáng lẽ gửi đến: ${emp.email}\n\n`
            : '';
          try {
            const r = renderFor(tpl, emp, opts, settings);
            await sendWithRetry({
              user: settings.emailUser,
              password: pw!,
              fromName: settings.companyName,
              to: recipientEmail,
              subject: (opts.testMode ? '[TEST] ' : '') + r.subject,
              body: bodyPrefix + r.body,
              attachmentPath: pdfPath,
              attachmentName: buildAttachmentName(emp.hoTen, emp.maNV, opts.month, opts.year),
              trackerPixelUrl,
            });
            succeeded += 1;
            recipients.push({
              hoTen: emp.hoTen,
              email: recipientEmail,
              maNV: emp.maNV,
              status: 'sent',
              trackToken,
            });
            send({
              kind: 'sent',
              rowIndex: emp.rowIndex,
              hoTen: emp.hoTen,
              email: recipientEmail,
            });
          } finally {
            cleanupPdf(pdfPath);
          }
        } catch (e) {
          failed += 1;
          const errMsg = e instanceof Error ? e.message : String(e);
          recipients.push({
            hoTen: emp.hoTen,
            email: emp.email,
            maNV: emp.maNV,
            status: 'failed',
            error: errMsg,
          });
          send({
            kind: 'failed',
            rowIndex: emp.rowIndex,
            hoTen: emp.hoTen,
            email: emp.email,
            error: errMsg,
          });
        }
        processed.add(emp.rowIndex);
        persistCheckpoint();
        await new Promise((r) => setTimeout(r, 1000));
      }

      finishLog();
      send({ kind: 'done', total: employees.length, succeeded, failed });
      } finally {
        batchInProgress = false;
      }
    }
  );

  ipcMain.handle('tracker:ping', async (_e, endpoint: string, secret?: string) => {
    try {
      const url = endpoint.replace(/\/$/, '') + '/api/opens?tokens=00000000-0000-0000-0000-000000000000';
      const effectiveSecret = secret ?? getTrackerSecret() ?? '';
      const headers: Record<string, string> = {};
      if (effectiveSecret) headers['Authorization'] = `Bearer ${effectiveSecret}`;
      const resp = await fetch(url, { method: 'GET', headers });
      if (resp.ok) return { ok: true };
      if (resp.status === 401) {
        return { ok: false, error: 'Unauthorized — tracker secret sai hoặc thiếu' };
      }
      const text = await resp.text().catch(() => '');
      return { ok: false, error: `HTTP ${resp.status}: ${text.slice(0, 200)}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle(
    'tracker:query-opens',
    async (_e, endpoint: string, tokens: string[]) => {
      if (!endpoint || tokens.length === 0) return { ok: true, tokens: {} };
      // Chunk into batches: server enforces 500/request (returns 413 if exceeded).
      // 400 gives headroom if the server limit ever drops.
      const CHUNK = 400;
      const url = endpoint.replace(/\/$/, '') + '/api/opens';
      const secret = getTrackerSecret();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secret) headers['Authorization'] = `Bearer ${secret}`;

      const merged: Record<string, unknown> = {};
      try {
        for (let i = 0; i < tokens.length; i += CHUNK) {
          const batch = tokens.slice(i, i + CHUNK);
          const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ tokens: batch }),
          });
          if (!resp.ok) {
            const hint =
              resp.status === 401
                ? 'Tracker secret sai/thiếu — vào Cài đặt để sửa'
                : `Tracker HTTP ${resp.status}`;
            return { ok: false, error: hint, tokens: merged };
          }
          const data = (await resp.json()) as { tokens?: Record<string, unknown> };
          Object.assign(merged, data.tokens ?? {});
        }
        return { ok: true, tokens: merged };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: `Không kết nối được tracker: ${msg}`, tokens: merged };
      }
    }
  );

  ipcMain.handle('settings:get', async () => ({
    settings: getSettings(),
    hasPassword: getEmailPassword() !== null,
    hasTrackerSecret: getTrackerSecret() !== null,
  }));
  ipcMain.handle(
    'settings:save',
    async (_e, s: Settings, password?: string, trackerSecret?: string) => {
      if (batchInProgress) {
        throw new Error('Đang có đợt gửi — không thể đổi cài đặt lúc này. Đợi xong hoặc huỷ rồi thử lại.');
      }
      saveSettings(s, password, trackerSecret);
    }
  );
  ipcMain.handle('templates:get', async () => ({
    templates: getEmailTemplates(),
    activeIndex: getActiveTemplateIndex(),
  }));

  ipcMain.handle(
    'templates:save',
    async (_e, templates: EmailTemplate[], activeIndex: number) => {
      if (batchInProgress) throw new Error('Đang có đợt gửi — không thể đổi mẫu lúc này.');
      saveEmailTemplates(templates);
      setActiveTemplateIndex(activeIndex);
    }
  );

  ipcMain.handle('log:list', async () => getLog());

  ipcMain.handle('checkpoint:get', async () => getCheckpoint());

  ipcMain.handle('checkpoint:discard', async () => {
    // Ghi phần đã xử lý vào log trước khi xoá, để user không mất dấu các email đã gửi
    const cp = getCheckpoint();
    if (cp && cp.recipients.length > 0) {
      const succeeded = cp.recipients.filter((r) => r.status === 'sent').length;
      const failed = cp.recipients.filter((r) => r.status === 'failed').length;
      appendLog({
        id: cp.batchId,
        timestamp: new Date().toISOString(),
        month: cp.opts.month,
        year: cp.opts.year,
        total: cp.employees.length,
        succeeded,
        failed,
        testMode: cp.opts.testMode,
        simulate: cp.opts.simulate,
        recipients: cp.recipients,
      });
    }
    clearCheckpoint();
  });
}
