import { Resend } from 'resend';
import { db } from './db';
import { localizations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  
  return new Resend(apiKey);
}

// Helper function to get localized strings
async function getLocalizedStrings(language: string = 'en') {
  const keys = [
    'email_invitation_subject',
    'email_invitation_greeting',
    'email_invitation_body',
    'email_invitation_cta',
    'email_invitation_expires',
    'email_invitation_footer',
    'email_from_name',
    'invitation_title'
  ];
  
  const translations: Record<string, string> = {};
  
  for (const key of keys) {
    const [result] = await db
      .select({ value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.key, key),
        eq(localizations.language, language)
      ))
      .limit(1);
    
    if (result) {
      translations[key] = result.value;
    }
  }
  
  // Fallbacks to English
  return {
    subject: translations['email_invitation_subject'] || "You've been invited to join {{tenantName}}",
    greeting: translations['email_invitation_greeting'] || 'Hello!',
    body: translations['email_invitation_body'] || "You've been invited to join {{tenantName}} on Repair Beam.",
    cta: translations['email_invitation_cta'] || 'Accept Invitation',
    expires: translations['email_invitation_expires'] || 'This invitation expires on',
    footer: translations['email_invitation_footer'] || "If you didn't expect this invitation, you can safely ignore this email.",
    fromName: translations['email_from_name'] || 'Repair Beam',
    title: translations['invitation_title'] || "You've Been Invited!"
  };
}

export async function sendInvitationEmail(
  email: string,
  invitedName: string,
  invitedByName: string,
  invitationToken: string,
  expiresAt: Date,
  language: string = 'en',
  tenantName?: string
) {
  try {
    const client = getResendClient();
    
    // Get localized strings
    const t = await getLocalizedStrings(language);
    const organizationName = tenantName || 'Repair Beam';
    
    // Build the invitation URL
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
    const invitationUrl = `${baseUrl}/accept-invite/${invitationToken}`;
    
    // Format expiry date based on language
    const locale = language === 'pt-BR' ? 'pt-BR' : 'en-US';
    const expiryDate = new Date(expiresAt).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation - Repair Beam</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(to bottom right, #1e293b, #1e3a5f); border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(to right, #1e40af, #0891b2); padding: 30px; text-align: center; border-bottom: 1px solid rgba(6, 182, 212, 0.2);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                🔧 Repair Beam
              </h1>
              <p style="margin: 10px 0 0 0; color: #cbd5e1; font-size: 14px;">
                Team Invitation
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 22px; font-weight: 600;">
                ${t.title}
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                ${t.greeting}${invitedName ? ' ' + invitedName : ''},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                <strong style="color: #06b6d4;">${invitedByName}</strong> ${t.body.replace('{{tenantName}}', `<strong style="color: #06b6d4;">${organizationName}</strong>`)}
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${invitationUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(to right, #2563eb, #06b6d4); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);">
                      ${t.cta}
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px 0; color: #60a5fa; font-size: 14px; font-weight: 600;">
                      ⏰ Important Information
                    </p>
                    <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">
                      ${t.expires} <strong>${expiryDate}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 5px 0 0 0; color: #06b6d4; font-size: 14px; word-break: break-all;">
                ${invitationUrl}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: rgba(15, 23, 42, 0.5); border-top: 1px solid rgba(100, 116, 139, 0.2); text-align: center;">
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 13px;">
                This invitation was sent by ${invitedByName}
              </p>
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                ${t.footer}
              </p>
              <p style="margin: 15px 0 0 0; color: #475569; font-size: 12px;">
                © ${new Date().getFullYear()} Repair Beam. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
${t.greeting}${invitedName ? ' ' + invitedName : ''},

${t.title}

${invitedByName} ${t.body.replace('{{tenantName}}', organizationName)}

${invitationUrl}

${t.expires} ${expiryDate}.

${t.footer}

---
© ${new Date().getFullYear()} ${t.fromName}
    `;

    const result = await client.emails.send({
      from: 'Repair Beam <onboarding@resend.dev>',
      to: email,
      subject: t.subject.replace('{{tenantName}}', organizationName),
      html,
      text,
    });

    console.log('Invitation email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    throw error;
  }
}
