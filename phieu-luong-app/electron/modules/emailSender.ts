import nodemailer, { Transporter } from 'nodemailer';
import * as fs from 'fs';

function makeTransporter(user: string, password: string): Transporter {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: password },
    // Timeout để tránh app hang vô hạn khi SMTP chậm/mất mạng
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 45_000,
  });
}

// Scrub credential material before an SMTP error leaves this module.
// Nodemailer errors are usually just SMTP response text, but edge cases
// (config validation, servers echoing back AUTH) can leak the password
// literal or the base64 AUTH PLAIN/LOGIN blob.
function sanitizeSmtpErrorMessage(raw: unknown, password: string): string {
  let msg = raw instanceof Error ? raw.message : String(raw);
  if (password && password.length >= 4) {
    msg = msg.split(password).join('***');
  }
  msg = msg.replace(/(AUTH\s+(?:PLAIN|LOGIN)\s+)[A-Za-z0-9+/=]+/gi, '$1***');
  return msg;
}

export async function testConnection(
  user: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = makeTransporter(user, password);
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: sanitizeSmtpErrorMessage(e, password) };
  }
}

export type SendOneArgs = {
  user: string;
  password: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  attachmentPath: string;
  attachmentName: string;
  trackerPixelUrl?: string;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textToHtmlBody(text: string, pixelUrl?: string): string {
  const safe = escapeHtml(text).replace(/\n/g, '<br>\n');
  const pixel = pixelUrl
    ? `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px" />`
    : '';
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.55;font-size:15px">${safe}${pixel}</body></html>`;
}

export async function sendOne(args: SendOneArgs): Promise<void> {
  const t = makeTransporter(args.user, args.password);
  const html = textToHtmlBody(args.body, args.trackerPixelUrl);
  await t.sendMail({
    from: `"${args.fromName}" <${args.user}>`,
    to: args.to,
    subject: args.subject,
    text: args.body,
    html,
    attachments: [
      {
        filename: args.attachmentName,
        content: fs.readFileSync(args.attachmentPath),
        contentType: 'application/pdf',
      },
    ],
  });
}

export async function sendWithRetry(args: SendOneArgs): Promise<void> {
  // Exponential backoff: 2s → 6s. Tránh hammer SMTP khi gặp rate-limit.
  const delays = [2_000, 6_000];
  const maxAttempts = delays.length + 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendOne(args);
      return;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      }
    }
  }
  throw new Error(sanitizeSmtpErrorMessage(lastError, args.password));
}

export function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

export function buildAttachmentName(hoTen: string, maNV: string, month: string, year: string) {
  const slug = sanitizeFilename(`${maNV}_${hoTen}`) || 'phieu_luong';
  return `PhieuLuong_T${month}_${year}_${slug}.pdf`;
}

export function buildEmailBody(hoTen: string, month: string, year: string, companyName: string, pdfPassword: string) {
  return `Kính gửi ${hoTen},

Phòng Nhân sự ${companyName} xin gửi phiếu lương tháng ${month}/${year}.

File PDF đính kèm được bảo vệ bằng mật khẩu. Vui lòng dùng mã sau để mở file:

    Mật khẩu: ${pdfPassword}

Mã này chỉ dùng cho phiếu lương tháng này. Nếu có bất kỳ sai sót nào, vui lòng liên hệ ngay với phòng Nhân sự.

Trân trọng,
${companyName}`;
}

export function buildSubject(month: string, year: string) {
  return `[Phiếu lương] Tháng ${month}/${year}`;
}
