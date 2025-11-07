import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function sendInvitationEmail(
  email: string,
  invitedName: string,
  invitedByName: string,
  invitationToken: string,
  expiresAt: Date
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    // Build the invitation URL
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
    const invitationUrl = `${baseUrl}/accept-invite/${invitationToken}`;
    
    // Format expiry date
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
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
                You've been invited to join a team!
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                Hi ${invitedName || 'there'},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                <strong style="color: #06b6d4;">${invitedByName}</strong> has invited you to join their organization on <strong style="color: #06b6d4;">Repair Beam</strong>. Click the button below to accept the invitation and get started.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${invitationUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(to right, #2563eb, #06b6d4); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);">
                      Accept Invitation
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
                      This invitation will expire on <strong>${expiryDate}</strong>. Please accept it before then to join the team.
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
                If you weren't expecting this invitation, you can safely ignore this email.
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
Hi ${invitedName || 'there'},

You've been invited to join a team on Repair Beam!

${invitedByName} has invited you to join their organization. Click the link below to accept the invitation:

${invitationUrl}

This invitation will expire on ${expiryDate}.

If you weren't expecting this invitation, you can safely ignore this email.

---
© ${new Date().getFullYear()} Repair Beam
    `;

    const result = await client.emails.send({
      from: fromEmail || 'Repair Beam <onboarding@resend.dev>',
      to: email,
      subject: `You've been invited to join Repair Beam`,
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
