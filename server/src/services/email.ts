import nodemailer from 'nodemailer';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SMTP_FROM = process.env.SMTP_FROM || '"Scelto Poker" <poker@scelto.no>';

// --- Brevo HTTP API (production on Render free tier) ---

const BREVO_API_KEY = process.env.BREVO_API_KEY;

async function sendViaBrevo(to: string, subject: string, html: string) {
  // Parse sender from SMTP_FROM: "Name" <email> or just email
  const fromMatch = SMTP_FROM.match(/"?([^"<]*)"?\s*<([^>]+)>/);
  const sender = fromMatch
    ? { name: fromMatch[1].trim(), email: fromMatch[2] }
    : { name: 'Scelto Poker', email: SMTP_FROM };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
}

// --- Nodemailer SMTP (local dev with Mailhog) ---

let transporter: nodemailer.Transporter | null = null;

if (!BREVO_API_KEY) {
  const smtpConfig: any = {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    smtpConfig.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  transporter = nodemailer.createTransport(smtpConfig);
  console.log(`Email: SMTP ${smtpConfig.host}:${smtpConfig.port} secure=${smtpConfig.secure} auth=${!!smtpConfig.auth}`);
} else {
  console.log('Email: Brevo HTTP API');
}

// --- Public API ---

async function sendEmail(to: string, subject: string, html: string) {
  if (BREVO_API_KEY) {
    await sendViaBrevo(to, subject, html);
  } else {
    await transporter!.sendMail({ from: SMTP_FROM, to, subject, html });
  }
}

export async function sendMagicLink(email: string, name: string, token: string, tournamentName: string) {
  const loginUrl = `${APP_URL}/auth/verify?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e;">Scelto Poker Tournament</h1>
      <p>Hey ${name},</p>
      <p>You've been invited to <strong>${tournamentName}</strong>!</p>
      <a href="${loginUrl}" style="
        display: inline-block;
        background: #e94560;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: bold;
        margin: 16px 0;
      ">Join Tournament</a>
      <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
    </div>
  `;

  await sendEmail(email, `You're invited to ${tournamentName}!`, html);
}
