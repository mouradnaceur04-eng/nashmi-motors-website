/**
 * Nashmi Motors — Lead Submission (Vercel)
 *
 * Receives form data from any form on the site and emails it
 * directly to DealerCenter CRM via Resend.
 *
 * Required env var in Vercel dashboard:
 *   RESEND_API_KEY  — get free at resend.com (3,000 emails/month)
 *
 * After setting the key, verify nashmimotors.com in Resend so the
 * FROM address shows as leads@nashmimotors.com instead of the default.
 */

const LEAD_EMAIL   = '29008363@leadsprod.dealercenter.net';
const DEALER_NAME  = 'Nashmi Motors';
const DEALER_PHONE = '(717) 743-5175';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body || {};
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('RESEND_API_KEY not set in Vercel environment variables');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  // ── Build email subject ───────────────────────────────────────────────────
  const firstName = data['First Name'] || data['Name'] || 'Customer';
  const lastName  = data['Last Name']  || '';
  const name      = `${firstName} ${lastName}`.trim();
  const formType  = data['_type'] || 'Inquiry';
  const vehicle   = data['Vehicle Interest'] || data['Vehicle'] || data['vehicle'] || '';
  const subject   = `[${formType}] ${name}${vehicle ? ` — ${vehicle}` : ''} — ${DEALER_NAME}`;

  // ── Build plain-text email body ───────────────────────────────────────────
  const skip = new Set(['_type', '_source']);
  const lines = [`New ${formType} from ${DEALER_NAME} website`, '─'.repeat(40)];
  for (const [k, v] of Object.entries(data)) {
    if (!skip.has(k) && v?.toString().trim()) {
      lines.push(`${k}: ${v.toString().trim()}`);
    }
  }
  lines.push('─'.repeat(40));
  lines.push(`Sent via ${DEALER_NAME} website | ${DEALER_PHONE}`);
  const textBody = lines.join('\n');

  // ── Build HTML email body ─────────────────────────────────────────────────
  const rows = Object.entries(data)
    .filter(([k, v]) => !skip.has(k) && v?.toString().trim())
    .map(([k, v]) => `
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;white-space:nowrap">${k}</td>
        <td style="padding:8px 12px;color:#111827;border:1px solid #e5e7eb">${v.toString().trim()}</td>
      </tr>`).join('');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#2d5a27;padding:24px 28px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">${DEALER_NAME}</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">New ${formType}</p>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none">
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
          Submitted via ${DEALER_NAME} website &bull; ${DEALER_PHONE} &bull; 8001 Paxton St, Harrisburg PA 17111
        </p>
      </div>
    </div>`;

  // ── Determine FROM address ────────────────────────────────────────────────
  // Set RESEND_FROM_DOMAIN env var to e.g. "leads@nashmimotors.com" after
  // verifying nashmimotors.com in Resend. Until then uses Resend's default.
  const fromAddr = process.env.RESEND_FROM_DOMAIN
    ? `${DEALER_NAME} <${process.env.RESEND_FROM_DOMAIN}>`
    : `${DEALER_NAME} <onboarding@resend.dev>`;

  // If using default Resend address, we can only send to the account owner's
  // verified email — set RESEND_FALLBACK_EMAIL to your Gmail in that case.
  const toAddr = process.env.RESEND_FROM_DOMAIN
    ? LEAD_EMAIL
    : (process.env.RESEND_FALLBACK_EMAIL || LEAD_EMAIL);

  // ── Send via Resend ───────────────────────────────────────────────────────
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     fromAddr,
        to:       [toAddr],
        reply_to: data['Email'] || undefined,
        subject,
        html:     htmlBody,
        text:     textBody,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Lead send error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
