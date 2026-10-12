import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Transactional email via Gmail SMTP (Nodemailer).
 *
 * Required env:
 *   GMAIL_USER          the Gmail address that sends the mail
 *   GMAIL_APP_PASSWORD  a 16-character Google "App password" (needs 2-Step Verification on)
 * Optional env:
 *   EMAIL_FROM_NAME     display name shown to recipients (default "VisualStack")
 *   EMAIL_REPLY_TO      reply-to address
 *
 * Both the verification code and the password-reset code use the same professional
 * template, rendered as HTML (table layout + inline CSS for Gmail/Outlook/Yahoo) with a
 * plain-text alternative.
 */

const BRAND = {
  name: 'VisualStack',
  primary: '#0284c7',
  primaryDark: '#0369a1',
  ink: '#0f172a',
  body: '#475569',
  muted: '#94a3b8',
  page: '#f1f5f9',
  border: '#e2e8f0',
  codeBg: '#f0f9ff',
  codeBorder: '#bae6fd'
};

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO_STACK = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

export type EmailKind = 'verify' | 'reset';

const COPY: Record<
  EmailKind,
  { subject: (code: string) => string; heading: string; intro: string; ttlMinutes: number; ignore: string; reason: string }
> = {
  verify: {
    subject: (code) => `${code} is your ${BRAND.name} verification code`,
    heading: 'Verify your email address',
    intro: `Thanks for signing up. Enter the code below in the ${BRAND.name} window to confirm your email and open your workspace.`,
    ttlMinutes: 10,
    ignore: 'You can safely ignore this email — nothing is activated without this code.',
    reason: 'create a VisualStack account'
  },
  reset: {
    subject: (code) => `${code} is your ${BRAND.name} password reset code`,
    heading: 'Reset your password',
    intro: `We received a request to reset the password for your ${BRAND.name} account. Enter the code below to choose a new password.`,
    ttlMinutes: 15,
    ignore: "You can safely ignore this email — your password won't change unless this code is used.",
    reason: 'request a password reset'
  }
};

// Names come from the sign-up form, so they must never be injected into HTML raw.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmail(kind: EmailKind, { name, code }: { name: string; code: string }) {
  const c = COPY[kind];
  const rawFirst = (name || '').trim().split(/\s+/)[0] || 'there';
  const firstName = escapeHtml(rawFirst);
  const subject = c.subject(code);
  const preheader = `Your code is ${code}. It expires in ${c.ttlMinutes} minutes.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
    ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">

          <tr>
            <td style="background:${BRAND.ink};padding:22px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="32" height="32" align="center" valign="middle"
                      style="background:${BRAND.primary};border-radius:8px;color:#ffffff;font-family:${FONT_STACK};font-size:17px;font-weight:700;line-height:32px;">V</td>
                  <td style="padding-left:12px;font-family:${FONT_STACK};font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">${BRAND.name}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 32px 8px 32px;font-family:${FONT_STACK};">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.ink};">${c.heading}</h1>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${BRAND.body};">Hi ${firstName},</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:${BRAND.body};">${escapeHtml(c.intro)}</p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:${BRAND.codeBg};border:1px solid ${BRAND.codeBorder};border-radius:10px;padding:22px 12px;">
                    <span style="font-family:${MONO_STACK};font-size:36px;font-weight:700;letter-spacing:10px;color:${BRAND.primaryDark};padding-left:10px;">${escapeHtml(code)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 8px 32px;font-family:${FONT_STACK};">
              <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.body};text-align:center;">
                This code expires in <strong style="color:${BRAND.ink};">${c.ttlMinutes} minutes</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 32px 32px;font-family:${FONT_STACK};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid ${BRAND.border};padding-top:20px;font-size:13px;line-height:1.6;color:${BRAND.body};">
                    <strong style="color:${BRAND.ink};">Didn&rsquo;t ${escapeHtml(c.reason)}?</strong>
                    ${escapeHtml(c.ignore)}
                    For your security, never share this code with anyone. ${BRAND.name} will never ask you for it.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr>
            <td align="center" style="padding:20px 16px 0 16px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
              ${BRAND.name} &middot; Visual system architecture diagrams<br>
              You received this email because someone used this address to ${escapeHtml(c.reason)}.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    c.heading,
    '',
    `Hi ${rawFirst},`,
    '',
    c.intro,
    '',
    `    ${code}`,
    '',
    `This code expires in ${c.ttlMinutes} minutes.`,
    '',
    `Didn't ${c.reason}? ${c.ignore}`,
    `Never share this code with anyone. ${BRAND.name} will never ask you for it.`,
    '',
    `- The ${BRAND.name} team`
  ].join('\n');

  return { subject, html, text };
}

// ---------- Transport ----------

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  // Google displays app passwords as four space-separated groups; strip the spaces.
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !pass) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      pool: true,
      maxConnections: 3
    });
  }
  return cachedTransporter;
}

/** Call once at boot so a wrong app password shows up in the logs immediately. */
export async function verifyEmailTransport(): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] GMAIL_USER / GMAIL_APP_PASSWORD not set - emails will NOT be sent.');
    return false;
  }
  try {
    await transporter.verify();
    console.log(`[email] SMTP ready - sending as ${process.env.GMAIL_USER}`);
    return true;
  } catch (err) {
    explainSmtpError(err);
    return false;
  }
}

function explainSmtpError(err: any) {
  console.error(`[email] SMTP error: ${err?.message || err}`);
  if (err?.code === 'EAUTH') {
    console.error(
      '[email] Gmail rejected the login. Use a 16-character App Password (not your normal password); ' +
      '2-Step Verification must be enabled on the Google account.'
    );
  }
}

// Dev convenience only. Never print codes in production logs.
function logDevCode(kind: EmailKind, to: string, code: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Dev Mailer] ${kind} code for ${to}: ${code}`);
  }
}

async function deliver(kind: EmailKind, to: string, name: string, code: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] Transport not configured - no email was sent.');
    logDevCode(kind, to, code);
    return false;
  }

  const { subject, html, text } = renderEmail(kind, { name, code });
  const fromName = process.env.EMAIL_FROM_NAME || BRAND.name;

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text,
      replyTo: process.env.EMAIL_REPLY_TO || undefined
    });
    console.log(`[email] ${kind} email sent to ${to} (id: ${info.messageId})`);
    return true;
  } catch (err) {
    explainSmtpError(err);
    logDevCode(kind, to, code);
    return false;
  }
}

/** Account verification code. Resolves true only if Gmail accepted the message. */
export const sendOtpEmail = (to: string, name: string, code: string) => deliver('verify', to, name, code);

/** Password reset code. Resolves true only if Gmail accepted the message. */
export const sendPasswordResetEmail = (to: string, name: string, code: string) => deliver('reset', to, name, code);
