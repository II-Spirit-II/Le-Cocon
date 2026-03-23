/**
 * Email service — console mode (dev) or Scaleway TEM (prod).
 * Zero dependencies: uses native fetch for Scaleway API.
 */
import { env } from '$env/dynamic/private';

function getConfig() {
  return {
    provider: (env.EMAIL_PROVIDER || 'console') as 'console' | 'scaleway',
    scalewayApiKey: env.SCALEWAY_TEM_API_KEY || '',
    scalewayProjectId: env.SCALEWAY_TEM_PROJECT_ID || '',
    fromEmail: env.EMAIL_FROM || 'noreply@lecocon.app',
    fromName: env.EMAIL_FROM_NAME || 'Le Cocon',
  };
}

function buildVerificationHtml(code: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FFF8F0;font-family:'DM Sans',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:rgba(255,248,240,0.95);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.3);box-shadow:0 8px 32px rgba(194,101,58,0.08);">
        <tr><td align="center" style="padding-bottom:24px;">
          <span style="font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:700;color:#3D3229;">Le Cocon</span>
        </td></tr>
        <tr><td align="center" style="padding-bottom:8px;">
          <span style="font-size:16px;color:#6B5D50;">Votre code de vérification</span>
        </td></tr>
        <tr><td align="center" style="padding:24px 0;">
          <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#E8913A;background:rgba(232,145,58,0.08);padding:16px 32px;border-radius:16px;border:1px solid rgba(232,145,58,0.15);">${code}</span>
        </td></tr>
        <tr><td align="center" style="padding-top:8px;">
          <span style="font-size:14px;color:#9B8E80;">Ce code expire dans 15 minutes.</span>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <span style="font-size:13px;color:#B8A898;">Si vous n'avez pas créé de compte sur Le Cocon, ignorez cet email.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<{ sent: boolean; devCode?: string }> {
  const config = getConfig();

  if (config.provider === 'console') {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EMAIL] Verification code for ${email}: ${code}`);
    }
    return { sent: true, devCode: code };
  }

  // Scaleway TEM API
  try {
    const res = await fetch(
      'https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': config.scalewayApiKey,
        },
        body: JSON.stringify({
          from: { email: config.fromEmail, name: config.fromName },
          to: [{ email }],
          subject: 'Votre code de vérification Le Cocon',
          html: buildVerificationHtml(code),
          project_id: config.scalewayProjectId,
        }),
      }
    );

    if (!res.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[EMAIL] Scaleway TEM error:', res.status, await res.text());
      }
      return { sent: false };
    }

    return { sent: true };
  } catch {
    return { sent: false };
  }
}
