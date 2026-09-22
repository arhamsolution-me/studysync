import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../config';

interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;

  private async getTransporter(): Promise<Transporter | null> {
    if (this.initialized) return this.transporter;
    this.initialized = true;

    const service = process.env.SMTP_SERVICE;
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER;
    const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

    if (service === 'gmail' && user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
      console.log(`[Email] ✅ Configured Gmail SMTP transport (${user})`);
    } else if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      console.log(`[Email] ✅ Configured custom SMTP transport (${host}:${port})`);
    } else if (config.sendgrid.apiKey) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: config.sendgrid.apiKey,
        },
      });
      console.log('[Email] Configured SendGrid SMTP transport');
    } else {
      console.log('[Email] No SMTP credentials provided — emails will be logged to console in dev mode.');
    }

    return this.transporter;
  }

  /**
   * Send an email with automatic HTML fallback and console logging.
   */
  async sendEmail(options: SendMailOptions): Promise<{ success: boolean; previewUrl?: string }> {
    const transporter = await this.getTransporter();
    const from = process.env.SMTP_FROM || config.sendgrid.fromEmail || 'StudySync AI <reminders@studysync.ai>';

    const htmlContent = options.html || `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
        <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0; font-size: 20px;">📚 StudySync AI</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Smart Academic Assistant</p>
        </div>
        <div style="white-space: pre-wrap; font-size: 15px; line-height: 1.6; background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
${options.text}
        </div>
        <div style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
          <p>Sent by StudySync AI to help you stay on track with your academic tasks.</p>
        </div>
      </div>
    `;

    if (!transporter) {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log(`║ 📬 [EMAIL DISPATCH SIMULATION]`);
      console.log(`║ To: ${options.to}`);
      console.log(`║ From: ${from}`);
      console.log(`║ Subject: ${options.subject}`);
      console.log(`╟────────────────────────────────────────────────────────────╢`);
      console.log(options.text.split('\n').map((l) => `║ ${l}`).join('\n'));
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      return { success: true };
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: htmlContent,
      });

      console.log(`[Email] Successfully sent email to ${options.to} (MessageID: ${info.messageId})`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      return {
        success: true,
        previewUrl: previewUrl ? (previewUrl as string) : undefined,
      };
    } catch (err: any) {
      console.error(`[Email] Failed to send email to ${options.to}:`, err.message);
      return { success: false };
    }
  }

  /**
   * Send 6-Digit Email Verification OTP for Registration.
   */
  async sendVerificationOtpEmail(toEmail: string, otp: string, fullName: string = 'Student'): Promise<boolean> {
    const subject = `Your StudySync AI Verification Code: ${otp}`;
    const text = `Hi ${fullName},\n\nYour 6-digit StudySync AI verification code is: ${otp}\n\nThis code expires in 15 minutes. Enter this code to verify your academic account.\n\nIf you did not request this code, please ignore this email.\n\nBest,\nStudySync AI Team`;
    const html = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background-color: #FAFAF9; border-radius: 16px; border: 1px solid #E7E5E4;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: #6366F1; border-radius: 12px; margin-bottom: 12px; color: #FFFFFF; font-size: 22px; font-weight: 700;">
            S
          </div>
          <h2 style="color: #1C1917; margin: 0; font-size: 22px; font-weight: 700;">Verify Your Email</h2>
          <p style="color: #78716C; font-size: 14px; margin: 6px 0 0 0;">Welcome to StudySync AI, ${fullName}!</p>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E7E5E4; border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
          <p style="color: #44403C; font-size: 14px; margin: 0 0 16px 0;">Use the 6-digit verification code below to activate your academic account:</p>
          <div style="display: inline-block; background: #EEF2FF; border: 1.5px dashed #6366F1; border-radius: 10px; padding: 14px 28px; letter-spacing: 8px; font-size: 28px; font-weight: 800; color: #4338CA; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #A8A29E; font-size: 12px; margin: 16px 0 0 0;">This security code expires in <strong>15 minutes</strong>.</p>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #A8A29E; line-height: 1.5;">
          <p style="margin: 0;">If you didn't create a StudySync account, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    const res = await this.sendEmail({ to: toEmail, subject, text, html });
    return res.success;
  }

  /**
   * Send Password Reset OTP Email.
   */
  async sendPasswordResetOtpEmail(toEmail: string, otp: string, fullName: string = 'Student'): Promise<boolean> {
    const subject = `StudySync AI Password Reset Code: ${otp}`;
    const text = `Hi ${fullName},\n\nWe received a request to reset your StudySync AI account password.\n\nYour reset verification code is: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did not make this request, your account is safe and you can disregard this email.\n\nBest,\nStudySync AI Security Team`;
    const html = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background-color: #FAFAF9; border-radius: 16px; border: 1px solid #E7E5E4;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1C1917; margin: 0; font-size: 22px; font-weight: 700;">Password Reset Code</h2>
          <p style="color: #78716C; font-size: 14px; margin: 6px 0 0 0;">Hello ${fullName}, reset your password below:</p>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E7E5E4; border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
          <p style="color: #44403C; font-size: 14px; margin: 0 0 16px 0;">Enter this 6-digit code in the password reset form:</p>
          <div style="display: inline-block; background: #FEF2F2; border: 1.5px dashed #EF4444; border-radius: 10px; padding: 14px 28px; letter-spacing: 8px; font-size: 28px; font-weight: 800; color: #DC2626; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #A8A29E; font-size: 12px; margin: 16px 0 0 0;">This code expires in <strong>15 minutes</strong>.</p>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #A8A29E; line-height: 1.5;">
          <p style="margin: 0;">If you didn't request a password reset, please change your password immediately or contact support.</p>
        </div>
      </div>
    `;

    const res = await this.sendEmail({ to: toEmail, subject, text, html });
    return res.success;
  }
}

export const emailService = new EmailService();
