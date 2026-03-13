import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  // No auth needed for Mailhog
});

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export async function sendMagicLink(email: string, name: string, token: string, tournamentName: string) {
  const loginUrl = `${APP_URL}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: '"Scelto Poker" <poker@scelto.no>',
    to: email,
    subject: `You're invited to ${tournamentName}!`,
    html: `
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
    `,
  });
}
