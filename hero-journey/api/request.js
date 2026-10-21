// Offer request form for hero.ccgroup.lv
// Sends each request to Edgars by email through Resend.
// Requires the RESEND_API_KEY environment variable on the Vercel project.

const TO = 'edgars@ccgroup.lv';
const FROM = "The Hero's Journey <hero@send.ccgroup.lv>";
const TEAM_SIZES = ['1–5', '6–10', '11–20', '21–30', '30+'];

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  // Honeypot: real visitors never see or fill this field.
  if (clean(body.website, 200)) {
    return res.status(200).json({ ok: true });
  }

  const data = {
    name: clean(body.name, 120),
    role: clean(body.role, 120),
    company: clean(body.company, 160),
    teamSize: clean(body.teamSize, 10),
    contact: clean(body.contact, 160),
  };

  if (!data.name || !data.company || !data.contact || !TEAM_SIZES.includes(data.teamSize)) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact);
  const rows = [
    ['Name', data.name],
    ['Role', data.role || '—'],
    ['Company', data.company],
    ['Sales team size', data.teamSize],
    ['Email or phone', data.contact],
  ];

  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a18">' +
    "<h2 style=\"margin:0 0 16px;font-size:20px\">New offer request: The Hero's Journey</h2>" +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows.map(([k, v]) =>
      '<tr><td style="color:#6b6559;padding-right:16px">' + k + '</td><td><strong>' + escapeHtml(v) + '</strong></td></tr>'
    ).join('') +
    '</table>' +
    '<p style="margin-top:20px;color:#6b6559;font-size:13px">Sent from hero.ccgroup.lv</p>' +
    '</div>';

  const text = rows.map(([k, v]) => k + ': ' + v).join('\n') + '\n\nSent from hero.ccgroup.lv';

  const payload = {
    from: FROM,
    to: [TO],
    subject: "Hero's Journey request: " + data.company + ' (' + data.teamSize + ')',
    html,
    text,
  };
  if (isEmail) payload.reply_to = data.contact;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      return res.status(502).json({ ok: false, error: 'send_failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};
