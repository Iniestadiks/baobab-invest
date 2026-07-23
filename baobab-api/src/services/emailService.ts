import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendVerificationEmail(email: string, firstName: string, code: string) {
  await transporter.sendMail({
    from: `"KORAPACT" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Vérification de votre compte KORAPACT',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#050810;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:#0C1024;border:1px solid rgba(255,255,255,0.07);border-radius:24px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#2563EB,#06B6D4);padding:40px;text-align:center;">
            <div style="width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;margin-bottom:16px;">K</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;letter-spacing:-0.5px;">KORAPACT</h1>
          </div>
          <div style="padding:40px;">
            <h2 style="color:#fff;font-size:20px;font-weight:800;margin:0 0 8px;">Bonjour ${firstName} 👋</h2>
            <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.7;margin:0 0 32px;">
              Votre code de vérification pour activer votre compte KORAPACT :
            </p>
            <div style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.3);border-radius:16px;padding:24px;text-align:center;margin-bottom:32px;">
              <div style="font-size:42px;font-weight:900;letter-spacing:16px;color:#fff;font-family:monospace;">${code}</div>
              <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:12px 0 0;">Expire dans <strong style="color:#06B6D4;">10 minutes</strong></p>
            </div>
            <p style="color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;margin:0;">
              Si vous n'avez pas créé de compte KORAPACT, ignorez cet email.
            </p>
          </div>
          <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;">© 2026 KORAPACT · Plateforme d'investissement communautaire</p>
          </div>
        </div>
      </body>
      </html>
    `,
  })
}

export async function sendWelcomeEmail(email: string, firstName: string) {
  await transporter.sendMail({
    from: `"KORAPACT" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Bienvenue sur KORAPACT 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#050810;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:#0C1024;border:1px solid rgba(255,255,255,0.07);border-radius:24px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#2563EB,#06B6D4);padding:40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">🎉</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">Compte activé !</h1>
          </div>
          <div style="padding:40px;">
            <h2 style="color:#fff;font-size:20px;font-weight:800;margin:0 0 16px;">Bienvenue ${firstName} !</h2>
            <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.7;margin:0 0 28px;">
              Votre compte KORAPACT est maintenant actif. Vous pouvez investir, suivre vos projets et percevoir vos retours.
            </p>
            <a href="${process.env.FRONTEND_URL}/dashboard"
              style="display:block;text-align:center;background:linear-gradient(135deg,#2563EB,#06B6D4);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:16px 32px;border-radius:14px;">
              Accéder à mon espace →
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
  })
}