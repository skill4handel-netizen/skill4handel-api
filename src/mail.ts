const SITE = 'https://www.skill4handel.com';
const API = 'https://skill4handel-api.onrender.com';

export async function sendVerifyEmail(to: string, token: string) {
  const link = `${SITE}/verify.html?token=${encodeURIComponent(token)}`;
  const apiLink = `${API}/auth/verify?token=${encodeURIComponent(token)}`;
  const key = process.env.RESEND_API_KEY || '';
  const from = process.env.MAIL_FROM || 'Skill4Handel <info@skill4handel.com>';
  if (!key) {
    console.log(`VERIFY LINK for ${to}: ${link}`);
    return link;
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'Confirm your Skill4Handel email',
        html: `<p>Confirm your Skill4Handel account by opening this link:</p>
<p><a href="${link}">${link}</a></p>
<p>After confirmation, open the app and log in.</p>
<p>If the website page is unavailable, use this backup link:<br><a href="${apiLink}">${apiLink}</a></p>`,
      }),
    });
  } catch (error) {
    console.log('MAIL ERROR', error);
    console.log(`VERIFY LINK for ${to}: ${link}`);
  }
  return link;
}
