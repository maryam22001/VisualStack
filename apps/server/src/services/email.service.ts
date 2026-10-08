import nodemailer from 'nodemailer';

/**
 * Creates and verifies the Gmail SMTP Transporter.
 */
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('[Email] Missing GMAIL_USER or GMAIL_APP_PASSWORD in environment variables.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends OTP email to recipient via Gmail SMTP.
 */
export async function sendOtpEmail(to: string, name: string, code: string): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    console.error('[Email] Cannot send email: Transporter unconfigured.');
    return false;
  }

  const mailOptions = {
    from: `"VisualStack" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${code} is your VisualStack verification code`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333333; margin-top: 0;">Welcome to VisualStack!</h2>
        <p style="color: #555555; font-size: 16px;">Hi ${name || 'there'},</p>
        <p style="color: #555555; font-size: 16px;">Use the verification code below to complete your authentication:</p>
        <div style="background-color: #f4f4f7; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #111827; border-radius: 6px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #888888; font-size: 13px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] OTP successfully dispatched to ${to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to deliver OTP via Nodemailer:', error);
    return false;
  }
}
export async function sendPasswordResetEmail(to: string, name: string, code: string): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    console.error('[Email] Cannot send email: Transporter unconfigured.');
    return false;
  }

  const mailOptions = {
    from: `"VisualStack" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${code} is your VisualStack password reset code`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333333; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #555555; font-size: 16px;">Hi ${name || 'there'},</p>
        <p style="color: #555555; font-size: 16px;">We received a request to reset your password. Use the code below to reset it:</p>
        <div style="background-color: #f4f4f7; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0284c7; border-radius: 6px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #888888; font-size: 13px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset OTP sent to ${to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    return false;
  }
}
// Dev convenience only. Never print codes in production logs.
function logDevCode(to: string, code: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Dev Mailer] Verification code for ${to}: ${code}`);
  }
}