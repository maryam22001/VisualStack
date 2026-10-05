import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendOtpEmail(to: string, name: string, code: string): Promise<boolean> {
  try {
    if (resend) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'VisualStack <onboarding@resend.dev>',
        to,
        subject: 'Your VisualStack Verification Code',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; borderRadius: 8px;">
            <h2 style="color: #0284c7; margin-top: 0;">Confirm Your Email</h2>
            <p>Hi ${name},</p>
            <p>Your 6-digit confirmation code for VisualStack is:</p>
            <div style="background: #f1f5f9; padding: 16px; font-size: 24px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #0f172a; border-radius: 6px;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 13px; margin-top: 20px;">This code will expire in 10 minutes.</p>
          </div>
        `
      });
      return true;
    } else {
      console.log(`[Dev Mailer] Verification code for ${to}: ${code}`);
      return true;
    }
  } catch (err) {
    console.error('Email delivery error:', err);
    return false;
  }
}