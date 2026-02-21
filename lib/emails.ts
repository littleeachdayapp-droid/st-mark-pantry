function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#FEFCE8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEFCE8;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2D5016;padding:20px 24px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">St. Mark Legacy Food Pantry</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:12px;">St. Mark UMC &mdash; Legacy Food Pantry</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatDateNice(dateStr: string, dayOfWeek: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
  return `${dayOfWeek}, ${formatted}`;
}

export function confirmationEmail(
  firstName: string,
  date: string,
  dayOfWeek: string,
  role?: string
): { subject: string; html: string } {
  const dateStr = formatDateNice(date, dayOfWeek);
  const roleLine = role ? `<p style="margin:8px 0 0;color:#374151;font-size:14px;">Role: <strong>${role}</strong></p>` : '';

  return {
    subject: `You're signed up for ${dateStr}`,
    html: baseTemplate('Signup Confirmation', `
      <h2 style="margin:0 0 12px;color:#1f2937;font-size:20px;">You're signed up!</h2>
      <p style="margin:0;color:#374151;font-size:14px;">Hi ${firstName},</p>
      <p style="margin:8px 0 0;color:#374151;font-size:14px;">You've been signed up to volunteer at the food pantry on:</p>
      <p style="margin:12px 0;padding:12px 16px;background-color:#f0fdf4;border-radius:6px;color:#166534;font-size:16px;font-weight:600;">${dateStr}</p>
      ${roleLine}
      <p style="margin:16px 0 0;color:#374151;font-size:14px;">Thank you for serving!</p>
    `),
  };
}

export function reminderEmail(
  firstName: string,
  date: string,
  dayOfWeek: string,
  role?: string
): { subject: string; html: string } {
  const dateStr = formatDateNice(date, dayOfWeek);
  const roleLine = role ? `<p style="margin:8px 0 0;color:#374151;font-size:14px;">Role: <strong>${role}</strong></p>` : '';

  return {
    subject: `Reminder: Volunteering on ${dateStr}`,
    html: baseTemplate('Volunteer Reminder', `
      <h2 style="margin:0 0 12px;color:#1f2937;font-size:20px;">Upcoming Session Reminder</h2>
      <p style="margin:0;color:#374151;font-size:14px;">Hi ${firstName},</p>
      <p style="margin:8px 0 0;color:#374151;font-size:14px;">This is a friendly reminder that you're scheduled to volunteer at the food pantry on:</p>
      <p style="margin:12px 0;padding:12px 16px;background-color:#eff6ff;border-radius:6px;color:#1e40af;font-size:16px;font-weight:600;">${dateStr}</p>
      ${roleLine}
      <p style="margin:16px 0 0;color:#374151;font-size:14px;">We look forward to seeing you there!</p>
    `),
  };
}

export function publicConfirmationEmail(
  firstName: string,
  dates: { date: string; dayOfWeek: string }[],
  role?: string
): { subject: string; html: string } {
  const count = dates.length;
  const dateListHtml = dates
    .map((d) => {
      const nice = formatDateNice(d.date, d.dayOfWeek);
      return `<li style="padding:4px 0;color:#166534;font-weight:600;">${nice}</li>`;
    })
    .join('');

  const roleLine = role
    ? `<p style="margin:8px 0 0;color:#374151;font-size:14px;">Preferred role: <strong>${role}</strong></p>`
    : '';

  return {
    subject: `You're signed up to volunteer (${count} session${count === 1 ? '' : 's'})`,
    html: baseTemplate('Signup Confirmation', `
      <h2 style="margin:0 0 12px;color:#1f2937;font-size:20px;">You're signed up!</h2>
      <p style="margin:0;color:#374151;font-size:14px;">Hi ${firstName},</p>
      <p style="margin:8px 0 0;color:#374151;font-size:14px;">Thank you for signing up to volunteer at the food pantry. Here are your upcoming sessions:</p>
      <ul style="list-style:none;padding:0;margin:12px 0;padding:12px 16px;background-color:#f0fdf4;border-radius:6px;">
        ${dateListHtml}
      </ul>
      ${roleLine}
      <p style="margin:16px 0 0;color:#374151;font-size:14px;">We look forward to seeing you there!</p>
    `),
  };
}

export function cancellationEmail(
  firstName: string,
  date: string,
  dayOfWeek: string
): { subject: string; html: string } {
  const dateStr = formatDateNice(date, dayOfWeek);

  return {
    subject: `Signup cancelled for ${dateStr}`,
    html: baseTemplate('Signup Cancelled', `
      <h2 style="margin:0 0 12px;color:#1f2937;font-size:20px;">Signup Cancelled</h2>
      <p style="margin:0;color:#374151;font-size:14px;">Hi ${firstName},</p>
      <p style="margin:8px 0 0;color:#374151;font-size:14px;">Your volunteer signup for the following session has been cancelled:</p>
      <p style="margin:12px 0;padding:12px 16px;background-color:#fef2f2;border-radius:6px;color:#991b1b;font-size:16px;font-weight:600;">${dateStr}</p>
      <p style="margin:16px 0 0;color:#374151;font-size:14px;">If this was a mistake, please contact your coordinator to be re-added.</p>
    `),
  };
}
