/**
 * api/send-email.js — Vercel serverless function
 * Sends emails via Resend API.
 * POST /api/send-email
 * Body: { type, to, data }
 */

const FROM_ADDRESS = 'KIAA Connect <noreply@support.kiaahilo.org>'
const ADMIN_EMAIL  = 'admin@kiaahilo.org'
const KIAA_PHONE   = '(808) 961-5422'
const KIAA_ADDRESS = '820 Piilani St., Suite 201, Hilo, HI 96720'

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>KIAA Connect</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#08403e;padding:28px 32px 24px;border-radius:12px 12px 0 0;">
    <div style="font-size:20px;font-weight:500;color:#ffffff;letter-spacing:-0.3px;margin-bottom:4px;font-family:Arial,sans-serif;">KIAA Connect</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;">Kanoelehua Industrial Area Association · Benefits Administration</div>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    ${content}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:20px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="font-size:11px;color:#9ca3af;line-height:1.6;margin:0;font-family:Arial,sans-serif;">
      Kanoelehua Industrial Area Association · ${KIAA_ADDRESS}<br>
      ${KIAA_PHONE} · <a href="mailto:admin@kiaahilo.org" style="color:#9ca3af;">admin@kiaahilo.org</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function sectionTitle(text) {
  return `<p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin:0 0 10px;font-family:Arial,sans-serif;">${text}</p>`
}

function summaryTable(rows) {
  const rowsHtml = rows.map(([label, value, highlight]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7280;font-family:Arial,sans-serif;border-bottom:1px solid #f3f4f6;">${label}</td>
      <td style="padding:6px 0;font-size:13px;font-weight:bold;text-align:right;color:${highlight ? '#059669' : '#111827'};font-family:Arial,sans-serif;border-bottom:1px solid #f3f4f6;">${value}</td>
    </tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:14px 16px;margin-bottom:4px;">
    <tbody>${rowsHtml}</tbody>
  </table>`
}

function quoteTable(quoteRows, totals, ridersTotalMonthly) {
  const planColors = {
    ppp: { color: '#0d6965', bg: '#e6f7f6' },
    cma: { color: '#5b21b6', bg: '#ede9fe' },
    hph: { color: '#78350f', bg: '#fef3c7' },
  }

  const memberRows = quoteRows.map(row => {
    const isEmp  = row.type === 'employee'
    const isDep  = !isEmp
    const padL   = isDep ? 'padding-left:18px;' : ''
    const typeLabel = row.type === 'employee' ? 'Emp' : row.type === 'dependent_spouse' ? 'Spouse' : 'Child'
    const typeColors = {
      employee: 'background:#e6f7f6;color:#0d6965',
      dependent_spouse: 'background:#ede9fe;color:#5b21b6',
      dependent_child: 'background:#fef3c7;color:#78350f',
    }
    const memberCell = `<td style="padding:7px 8px;font-family:Arial,sans-serif;font-size:11px;${padL}border-bottom:1px solid #f3f4f6;">
      <span style="font-family:monospace;font-size:10px;color:#9ca3af;">${row.emp_id}</span>
      <span style="${typeColors[row.type]};font-size:9px;font-weight:bold;padding:1px 5px;border-radius:3px;margin:0 3px;">${typeLabel}</span>
      <span style="font-size:10px;color:#9ca3af;">age ${row.age ?? '—'}</span>
    </td>`

    const pppCell  = row.premiums?.aca_ppp  != null ? `$${row.premiums.aca_ppp.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
    const cmaCell  = row.premiums?.aca_cm_a != null ? `$${row.premiums.aca_cm_a.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
    const hphCell  = row.premiums?.aca_hph_plus != null ? `$${row.premiums.aca_hph_plus.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'

    let ridersCell = '—'
    if (isEmp && row.tier) {
      const RIDERS = { single: 45.24, two_party: 92.40, family: 136.36 }
      const tierLabel = { single: 'Single', two_party: '2-Party', family: 'Family' }
      ridersCell = `$${RIDERS[row.tier].toFixed(2)}<br/><span style="font-size:9px;color:#9ca3af;font-family:Arial,sans-serif;">${tierLabel[row.tier]}</span>`
    } else if (row.isMinorChild) {
      ridersCell = '<span style="font-size:10px;color:#059669;font-family:Arial,sans-serif;">Pediatric ✓</span>'
    }

    const tdStyle = `padding:7px 8px;text-align:right;font-family:monospace;font-size:11px;border-bottom:1px solid #f3f4f6;color:#374151;`
    return `<tr style="${isDep ? 'background:#fafafa;' : ''}">
      ${memberCell}
      <td style="${tdStyle}">${pppCell}</td>
      <td style="${tdStyle}">${cmaCell}</td>
      <td style="${tdStyle}">${hphCell}</td>
      <td style="${tdStyle}">${ridersCell}</td>
    </tr>`
  })

  // Group with spacers between employee families
  const rows = []
  let lastEmpId = null
  quoteRows.forEach((row, i) => {
    if (i > 0 && row.emp_id !== lastEmpId && row.type === 'employee') {
      rows.push(`<tr><td colspan="5" style="padding:2px;background:#f3f4f6;"></td></tr>`)
    }
    rows.push(memberRows[i])
    lastEmpId = row.emp_id
  })

  const fmtTotal = n => n > 0 ? `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:11px;">
    <thead>
      <tr>
        <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;background:#f9fafb;color:#6b7280;font-family:Arial,sans-serif;width:28%;border-bottom:1px solid #e5e7eb;">Member</th>
        <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;text-transform:uppercase;background:${planColors.ppp.bg};color:${planColors.ppp.color};font-family:Arial,sans-serif;border-bottom:1px solid #e5e7eb;">ACA PPP<br/><span style="font-weight:normal;font-size:9px;">PPO</span></th>
        <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;text-transform:uppercase;background:${planColors.cma.bg};color:${planColors.cma.color};font-family:Arial,sans-serif;border-bottom:1px solid #e5e7eb;">CompMED A<br/><span style="font-weight:normal;font-size:9px;">PPO</span></th>
        <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;text-transform:uppercase;background:${planColors.hph.bg};color:${planColors.hph.color};font-family:Arial,sans-serif;border-bottom:1px solid #e5e7eb;">HPH Plus<br/><span style="font-weight:normal;font-size:9px;">HMO</span></th>
        <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;text-transform:uppercase;background:#f3f4f6;color:#374151;font-family:Arial,sans-serif;border-bottom:1px solid #e5e7eb;">Riders<br/><span style="font-weight:normal;font-size:9px;">D · V · Life</span></th>
      </tr>
    </thead>
    <tbody>
      ${rows.join('')}
      <tr style="background:#f9fafb;">
        <td style="padding:8px;font-size:12px;font-weight:bold;color:#374151;font-family:Arial,sans-serif;">Medical total</td>
        <td style="padding:8px;text-align:right;font-size:12px;font-weight:bold;color:${planColors.ppp.color};font-family:monospace;">${fmtTotal(totals.aca_ppp)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;font-weight:bold;color:${planColors.cma.color};font-family:monospace;">${fmtTotal(totals.aca_cm_a)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;font-weight:bold;color:${planColors.hph.color};font-family:monospace;">${fmtTotal(totals.aca_hph_plus)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;font-weight:bold;color:#374151;font-family:monospace;">${fmtTotal(ridersTotalMonthly)}</td>
      </tr>
      <tr style="background:#e6f7f6;">
        <td style="padding:8px;font-size:12px;font-weight:bold;color:#08403e;font-family:Arial,sans-serif;">Plan + Riders combined</td>
        <td style="padding:8px;text-align:right;font-size:12px;font-weight:bold;color:#08403e;font-family:monospace;">${fmtTotal(totals.aca_ppp + ridersTotalMonthly)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;font-weight:bold;color:#08403e;font-family:monospace;">${fmtTotal(totals.aca_cm_a + ridersTotalMonthly)}</td>
        <td style="padding:8px;text-align:right;font-size:12px;font-weight:bold;color:#08403e;font-family:monospace;">${fmtTotal(totals.aca_hph_plus + ridersTotalMonthly)}</td>
        <td style="padding:8px;"></td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:10px;color:#9ca3af;font-family:Arial,sans-serif;margin:8px 0 0;line-height:1.6;">
    ✦ Pediatric dental &amp; vision (age ≤18) included in all ACA plans at no added cost.<br/>
    ✦ Riders (Dental · Vision · Group Life/AD&amp;D) are a standalone optional add-on.<br/>
    ✦ KIAA admin fee of $4.00 per enrolled employee/month is not included above.<br/>
    ✦ Estimates based on ${totals.quarter || 'current'} HMSA rates. Final premiums confirmed at enrollment.
  </p>`
}

function prospectConfirmationEmail(data) {
  const {
    contactName, companyName, contactEmail, startDate, censusCount,
    employeeCount, feinFiled, dolFiled, companyCode, quoteRows,
    totals, ridersTotalMonthly, quarter, jotformUrl
  } = data

  const fmtDate = s => {
    if (!s) return '—'
    const [y,m,d] = s.split('-').map(Number)
    return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  }

  const content = `
    <p style="font-size:15px;color:#111827;margin:0 0 20px;line-height:1.6;">
      Aloha ${contactName},<br/><br/>
      Thank you for submitting your health plan quote request. We've received your information and a KIAA representative will be in touch within <strong>2 business days</strong>.
    </p>

    ${sectionTitle('Submission summary')}
    ${summaryTable([
      ['Company',         companyName],
      ['Contact',         contactName],
      ['Coverage start',  fmtDate(startDate)],
      ['Rate quarter',    quarter || '—'],
      ['Census',          `${censusCount} member${censusCount !== 1 ? 's' : ''} · ${employeeCount} employee${employeeCount !== 1 ? 's' : ''}`],
      ['FEIN attested',   feinFiled ? '✓ Yes' : 'Not attested', feinFiled],
      ['DOL attested',    dolFiled  ? '✓ Yes' : 'Not attested', dolFiled],
      ['Company code',    `<span style="font-family:monospace;background:#e6f7f6;color:#08403e;padding:1px 6px;border-radius:3px;">${companyCode}</span>`],
    ])}

    <div style="height:20px;"></div>

    ${sectionTitle('Your estimated monthly premiums')}
    ${quoteTable(quoteRows, totals, ridersTotalMonthly)}

    <div style="height:24px;"></div>

    ${sectionTitle('What happens next')}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ['1', 'Complete your FEIN and DOL filing', `Use the secure form below to provide your Federal Employer Identification Number and Hawaii DOL number — required by HMSA to process your enrollment.`],
        ['2', 'KIAA reviews your census and confirms premiums', `A representative will verify your census with HMSA and contact you at ${contactEmail} within 2 business days.`],
        ['3', 'Annual KIAA membership', `Participation in KIAA health plans requires an annual membership with the Kanoelehua Industrial Area Association. Your representative will provide details and dues information.`],
        ['4', 'Register on KIAA Connect with your company code', `Once your enrollment is confirmed, use code <strong style="font-family:monospace;background:#e6f7f6;color:#08403e;padding:1px 6px;border-radius:3px;">${companyCode}</strong> at connect.kiaahilo.org — your company information will be pre-filled.`],
      ].map(([num, title, desc]) => `
        <tr>
          <td style="vertical-align:top;padding:0 0 16px;width:34px;">
            <div style="width:24px;height:24px;border-radius:50%;background:#08403e;color:#1be3dc;font-size:11px;font-weight:bold;text-align:center;line-height:24px;font-family:Arial,sans-serif;">${num}</div>
          </td>
          <td style="vertical-align:top;padding:0 0 16px;">
            <p style="margin:0 0 3px;font-size:13px;font-weight:bold;color:#111827;font-family:Arial,sans-serif;">${title}</p>
            <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;font-family:Arial,sans-serif;">${desc}</p>
          </td>
        </tr>`).join('')}
    </table>

    <a href="${jotformUrl || '#'}" style="display:block;background:#08403e;color:#ffffff;text-align:center;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;margin:20px 0;font-family:Arial,sans-serif;">Complete FEIN &amp; DOL filing →</a>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:12px 14px;font-size:12px;color:#78350f;line-height:1.5;font-family:Arial,sans-serif;">
        <strong>Reminder:</strong> KIAA charges an administrative fee of $4.00 per enrolled employee per month, in addition to HMSA premiums shown above. Your KIAA representative will provide a complete cost summary.
      </td></tr>
    </table>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
    <p style="font-size:13px;color:#6b7280;line-height:1.6;font-family:Arial,sans-serif;">
      Questions? Call us at <strong style="color:#111827;">${KIAA_PHONE}</strong> or reply to this email.
    </p>`

  return {
    subject: `Your KIAA health plan quote — ${companyName}`,
    html: baseTemplate(content),
  }
}

function adminNotificationEmail(data) {
  const {
    contactName, companyName, contactEmail, contactPhone,
    startDate, censusCount, employeeCount, feinFiled, dolFiled,
    companyCode, notes, token, disabledDeps
  } = data

  const fmtDate = s => {
    if (!s) return '—'
    const [y,m,d] = s.split('-').map(Number)
    return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  }

  const prospectUrl = `https://connect.kiaahilo.org/prospect/${token}`

  const disabledDepCount = Object.values(disabledDeps || {}).filter(Boolean).length

  const content = `
    <p style="font-size:15px;color:#111827;margin:0 0 20px;line-height:1.6;">
      A new prospective member has submitted a quote request on KIAA Connect.
    </p>

    ${sectionTitle('Company details')}
    ${summaryTable([
      ['Company',        companyName || '—'],
      ['Contact name',   contactName || '—'],
      ['Email',          contactEmail || '—'],
      ['Phone',          contactPhone || '—'],
      ['Coverage start', fmtDate(startDate)],
      ['Census',         `${censusCount} member${censusCount !== 1 ? 's' : ''} · ${employeeCount} employee${employeeCount !== 1 ? 's' : ''}`],
      ['FEIN attested',  feinFiled ? '✓ Yes' : 'Not attested', feinFiled],
      ['DOL attested',   dolFiled  ? '✓ Yes' : 'Not attested', dolFiled],
      ['Company code',   `<span style="font-family:monospace;background:#e6f7f6;color:#08403e;padding:1px 6px;border-radius:3px;">${companyCode}</span>`],
    ])}

    ${disabledDepCount > 0 ? `
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 14px;margin:16px 0;font-size:12px;color:#78350f;font-family:Arial,sans-serif;">
      <strong>⚠ ${disabledDepCount} disabled dependent${disabledDepCount > 1 ? 's' : ''} flagged</strong> — this company has flagged ${disabledDepCount} dependent${disabledDepCount > 1 ? 's' : ''} as potentially qualifying for disabled dependent coverage beyond age 26. HMSA verification required.
    </div>` : ''}

    ${notes ? `
    <div style="margin:16px 0;">
      ${sectionTitle('Internal notes')}
      <p style="font-size:13px;color:#374151;font-family:Arial,sans-serif;background:#f9fafb;padding:10px 14px;border-radius:8px;border:1px solid #e5e7eb;">${notes}</p>
    </div>` : ''}

    <a href="${prospectUrl}" style="display:block;background:#08403e;color:#ffffff;text-align:center;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;margin:20px 0;font-family:Arial,sans-serif;">View full submission on KIAA Connect →</a>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
    <p style="font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;">
      Reply to this email or call ${contactPhone || contactEmail} to follow up. Mark this prospect as converted in the Prospects dashboard once enrollment is confirmed.
    </p>`

  return {
    subject: `New prospect submission — ${companyName}`,
    html: baseTemplate(content),
  }
}

function prospectApprovalEmail(data) {
  const {
    contactName, companyName, contactEmail, startDate,
    companyCode, quarter, deadlines, token,
    quoteRows, totals, ridersTotalMonthly
  } = data

  const fmtDate = s => {
    if (!s) return '—'
    const [y,m,d] = s.split('-').map(Number)
    return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  }

  const prospectUrl = `https://connect.kiaahilo.org/prospect/${token}`
  const registerUrl = `https://connect.kiaahilo.org/register`
  const planYear = startDate ? (() => {
    const [y,m,d] = startDate.split('-').map(Number)
    const end = new Date(y+1,m-1,d-1)
    return `${fmtDate(startDate)} — ${end.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`
  })() : '—'

  const content = `
    <div style="background:#e6f7f6;border:1px solid #0d6965;border-radius:8px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:20px;flex-shrink:0;">✅</span>
      <div>
        <div style="font-size:14px;font-weight:bold;color:#08403e;margin-bottom:3px;font-family:Arial,sans-serif;">Your quote has been reviewed and approved by KIAA</div>
        <div style="font-size:12px;color:#3d5c5b;font-family:Arial,sans-serif;">KIAA has reviewed your census and confirmed your rates. You're ready to select your plan and complete enrollment.</div>
      </div>
    </div>

    <p style="font-size:15px;color:#111827;margin:0 0 18px;line-height:1.6;">Aloha ${contactName},<br/><br/>We're pleased to confirm that your health plan quote for <strong>${companyName}</strong> has been approved. Please review and accept your quote, then complete your registration on KIAA Connect.</p>

    ${sectionTitle('Confirmed quote details')}
    ${summaryTable([
      ['Company',          companyName],
      ['Coverage start',   fmtDate(startDate)],
      ['Plan year',        planYear],
      ['Rate quarter',     `${quarter} · rates confirmed by HMSA`],
      ['KIAA admin fee',   '$4.00 per enrolled employee/month'],
      ['Annual membership','Required · KIAA will provide details'],
      ['Company code',     `<span style="font-family:monospace;background:#e6f7f6;color:#08403e;padding:1px 6px;border-radius:3px;">${companyCode}</span>`],
    ])}

    ${sectionTitle('What to do next')}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ['1', 'Review & accept your quote', `Select the plan(s) you want to offer, review the confirmed rates, and acknowledge the enrollment terms. This creates an official acceptance record.`],
        ['2', 'Create your KIAA Connect account', `Use your company code <strong style="font-family:monospace;background:#e6f7f6;color:#08403e;padding:1px 5px;border-radius:3px;">${companyCode}</strong> to register at connect.kiaahilo.org. Your company info will be pre-filled.`],
        ['3', 'Return signed enrollment forms', `After accepting, you'll receive instructions for downloading and returning HMSA enrollment forms for each employee. Forms must be returned by <strong>${deadlines.forms||'—'}</strong>.`],
      ].map(([n,t,d]) => `
        <tr>
          <td style="vertical-align:top;padding:0 0 14px;width:30px;">
            <div style="width:22px;height:22px;border-radius:50%;background:#08403e;color:#1be3dc;font-size:11px;font-weight:bold;text-align:center;line-height:22px;font-family:Arial,sans-serif;">${n}</div>
          </td>
          <td style="vertical-align:top;padding:0 0 14px;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:bold;color:#111827;font-family:Arial,sans-serif;">${t}</p>
            <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;font-family:Arial,sans-serif;">${d}</p>
          </td>
        </tr>`).join('')}
    </table>

    <a href="${prospectUrl}#accept" style="display:block;background:#08403e;color:#ffffff;text-align:center;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;margin:16px 0 8px;font-family:Arial,sans-serif;">Review &amp; accept your quote →</a>
    <a href="${prospectUrl}#decline" style="display:block;background:#f9fafb;color:#6b7280;text-align:center;padding:11px 24px;border-radius:8px;font-size:12px;font-weight:bold;text-decoration:none;margin:0 0 8px;border:1px solid #e5e7eb;font-family:Arial,sans-serif;">I'd like to decline this quote</a>
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0 0 16px;font-family:Arial,sans-serif;">Not sure yet? Reply to this email or call us at ${KIAA_PHONE} — we're happy to answer any questions before you decide.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
    <p style="font-size:12px;color:#6b7280;line-height:1.6;font-family:Arial,sans-serif;">
      Questions? Call <strong style="color:#111827;">${KIAA_PHONE}</strong> or reply to this email.
    </p>`

  return {
    subject: `Your KIAA quote has been approved — ${companyName}`,
    html: baseTemplate(content),
  }
}

function prospectNextStepsEmail(data) {
  const {
    contactName, companyName, contactEmail, startDate,
    companyCode, quarter, electedPlans, enrolledEmployees,
    enrollmentFormUrl
  } = data

  const fmtDate = s => {
    if (!s) return '—'
    const [y,m,d] = s.split('-').map(Number)
    return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  }

  // Calculate deadlines
  const deadlines = (() => {
    if (!startDate) return { hmsa: '—', forms: '—' }
    const [y,m] = startDate.split('-').map(Number)
    const prevM = m === 1 ? 12 : m - 1
    const prevY = m === 1 ? y - 1 : y
    const hmsa  = new Date(prevY, prevM-1, 10).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    const forms = new Date(prevY, prevM-1, 5).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    return { hmsa, forms }
  })()

  const registerUrl = `https://connect.kiaahilo.org/register`
  const planYear = startDate ? (() => {
    const [y,m,d] = startDate.split('-').map(Number)
    const end = new Date(y+1,m-1,d-1)
    return `${fmtDate(startDate)} — ${end.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`
  })() : '—'

  const content = `
    <div style="background:#e6f7f6;border:1px solid #0d6965;border-radius:8px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:20px;flex-shrink:0;">✅</span>
      <div>
        <div style="font-size:14px;font-weight:bold;color:#08403e;margin-bottom:3px;font-family:Arial,sans-serif;">Quote accepted — ${companyName}</div>
        <div style="font-size:12px;color:#3d5c5b;font-family:Arial,sans-serif;">Your plan election has been recorded. The next step is to collect and return signed enrollment forms for each employee.</div>
      </div>
    </div>

    <p style="font-size:15px;color:#111827;margin:0 0 18px;line-height:1.6;">Aloha ${contactName},<br/><br/>Thank you for accepting your quote. To complete enrollment and secure your <strong>${fmtDate(startDate)}</strong> coverage start date, we need signed enrollment forms from each employee by <strong style="color:#dc2626;">${deadlines.forms}</strong>.</p>

    ${sectionTitle('Accepted election summary')}
    ${summaryTable([
      ['Company',           companyName],
      ['Coverage start',    fmtDate(startDate)],
      ['Plan year',         planYear],
      ['Plans elected',     (electedPlans||[]).join(' · ') || '—'],
      ['Enrolled employees',`${enrolledEmployees||'—'} employees`],
      ['KIAA admin fee',    '$4.00 per enrolled employee/month'],
      ['Company code',      `<span style="font-family:monospace;background:#e6f7f6;color:#08403e;padding:1px 6px;border-radius:3px;">${companyCode}</span>`],
    ])}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;margin-bottom:18px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#991b1b;font-family:Arial,sans-serif;">⚠ Important enrollment deadlines</p>
        ${[
          ['Enrollment forms due to KIAA', deadlines.forms],
          ['HMSA group setup deadline',    deadlines.hmsa],
          ['Coverage effective date',      fmtDate(startDate)],
        ].map(([l,v]) => `
          <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #fca5a5;margin-bottom:4px;">
            <tr>
              <td style="padding:4px 0;font-size:12px;color:#7f1d1d;font-family:Arial,sans-serif;">${l}</td>
              <td style="padding:4px 0;font-size:12px;font-weight:bold;color:#991b1b;text-align:right;font-family:Arial,sans-serif;">${v}</td>
            </tr>
          </table>`).join('')}
        <p style="margin:8px 0 0;font-size:11px;color:#991b1b;line-height:1.5;font-family:Arial,sans-serif;">HMSA requires all enrollment forms and group setup to be completed by the 10th of the month prior to your coverage start date. Missing this deadline may delay your coverage start.</p>
      </td></tr>
    </table>

    ${sectionTitle('What you need to do')}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ['1', 'Download the KIAA enrollment form', 'Download one enrollment form for each employee enrolling in the health plan. Each employee must complete and sign their own form.'],
        ['2', 'Collect completed forms from each employee', 'Ensure each form is fully completed including dependent information, plan selection, and employee signature. Incomplete forms will delay enrollment.'],
        [`3`, `Return all forms to KIAA securely by ${deadlines.forms}`, 'Upload completed forms via our secure Paubox link OR fax to (808) 935-9740. Do not email forms — enrollment forms contain protected health information (PHI).'],
        ['4', 'Register on KIAA Connect', `If you haven't already, create your account using company code <strong style="font-family:monospace;background:#e6f7f6;color:#08403e;padding:1px 5px;border-radius:3px;">${companyCode}</strong> to track your enrollment status.`],
      ].map(([n,t,d]) => `
        <tr>
          <td style="vertical-align:top;padding:0 0 14px;width:30px;">
            <div style="width:22px;height:22px;border-radius:50%;background:#08403e;color:#1be3dc;font-size:11px;font-weight:bold;text-align:center;line-height:22px;font-family:Arial,sans-serif;">${n}</div>
          </td>
          <td style="vertical-align:top;padding:0 0 14px;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:bold;color:#111827;font-family:Arial,sans-serif;">${t}</p>
            <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;font-family:Arial,sans-serif;">${d}</p>
          </td>
        </tr>`).join('')}
    </table>

    <a href="https://next.paubox.com/public/kiaahilo/upload" style="display:block;background:#08403e;color:#ffffff;text-align:center;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;margin:16px 0 8px;font-family:Arial,sans-serif;">🔒 Upload enrollment forms securely via Paubox →</a>
    ${enrollmentFormUrl ? `<a href="${enrollmentFormUrl}" style="display:block;background:#f9fafb;color:#111827;text-align:center;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:bold;text-decoration:none;margin:0 0 8px;border:1px solid #e5e7eb;font-family:Arial,sans-serif;">⬇ Download KIAA enrollment form (PDF)</a>` : ''}
    <a href="${registerUrl}" style="display:block;background:#f9fafb;color:#111827;text-align:center;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:bold;text-decoration:none;margin:0 0 16px;border:1px solid #e5e7eb;font-family:Arial,sans-serif;">Register on KIAA Connect (code: ${companyCode})</a>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #ef4444;border-radius:8px;margin-bottom:16px;">
      <tr><td style="padding:10px 14px;font-size:11px;color:#991b1b;line-height:1.5;font-family:Arial,sans-serif;">
        <strong>PHI security notice:</strong> Enrollment forms contain protected health information. Do not email forms as attachments. Use only the secure Paubox link above or fax to <strong>(808) 935-9740</strong>.
      </td></tr>
    </table>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
    <p style="font-size:12px;color:#6b7280;line-height:1.6;font-family:Arial,sans-serif;">
      Questions? Call <strong style="color:#111827;">${KIAA_PHONE}</strong> or reply to this email. Please do not send enrollment forms by reply email — use Paubox or fax only.
    </p>`

  return {
    subject: `Action required — enrollment forms due by ${deadlines.forms} · ${companyName}`,
    html: baseTemplate(content),
  }
}

function prospectDeclinedEmail(data) {
  const {
    companyName, contactName, contactEmail, contactPhone,
    startDate, companyCode, declineReason, declineComment, token
  } = data

  const fmtDate = s => {
    if (!s) return '—'
    const [y,m,d] = s.split('-').map(Number)
    return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  }

  const prospectUrl = `https://connect.kiaahilo.org/prospect/${token}`

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:14px 16px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:22px;">❌</span>
        <div>
          <p style="margin:0 0 2px;font-size:14px;font-weight:bold;color:#991b1b;font-family:Arial,sans-serif;">Quote declined — ${companyName}</p>
          <p style="margin:0;font-size:12px;color:#7f1d1d;font-family:Arial,sans-serif;">${contactName||'—'} has declined the KIAA health plan quote.</p>
        </div>
      </td></tr>
    </table>

    ${sectionTitle('Company details')}
    ${summaryTable([
      ['Company',        companyName || '—'],
      ['Contact',        contactName || '—'],
      ['Email',          contactEmail || '—'],
      ['Phone',          contactPhone || '—'],
      ['Coverage start', fmtDate(startDate)],
      ['Company code',   `<span style="font-family:monospace;background:#e6f7f6;color:#08403e;padding:1px 6px;border-radius:3px;">${companyCode||'—'}</span>`],
    ])}

    ${sectionTitle('Reason for declining')}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;margin-bottom:16px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#991b1b;font-family:Arial,sans-serif;">${declineReason || 'No reason provided'}</p>
        ${declineComment ? `<p style="margin:0;font-size:12px;color:#7f1d1d;font-style:italic;font-family:Arial,sans-serif;">"${declineComment}"</p>` : ''}
      </td></tr>
    </table>

    <a href="${prospectUrl}" style="display:block;background:#08403e;color:#ffffff;text-align:center;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:bold;text-decoration:none;margin:0 0 16px;font-family:Arial,sans-serif;">View prospect on KIAA Connect →</a>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
    <p style="font-size:12px;color:#6b7280;line-height:1.6;font-family:Arial,sans-serif;">
      You can reopen this prospect at any time from the Prospects dashboard. Consider following up — ${contactPhone ? `call ${contactPhone} or ` : ''}email ${contactEmail||'the contact'} to see if there's anything KIAA can do to help.
    </p>`

  return {
    subject: `Quote declined — ${companyName}`,
    html: baseTemplate(content),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' })
  }

  try {
    const { type, to, data } = req.body
    if (!type || !to) {
      return res.status(400).json({ error: 'Missing type or to' })
    }

    let subject, html
    if (type === 'prospect_confirmation') {
      ({ subject, html } = prospectConfirmationEmail(data))
    } else if (type === 'admin_notification') {
      ({ subject, html } = adminNotificationEmail(data))
    } else if (type === 'prospect_approval') {
      ({ subject, html } = prospectApprovalEmail(data))
    } else if (type === 'prospect_next_steps') {
      ({ subject, html } = prospectNextStepsEmail(data))
    } else if (type === 'prospect_declined') {
      ({ subject, html } = prospectDeclinedEmail(data))
    } else {
      return res.status(400).json({ error: `Unknown email type: ${type}` })
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    })

    const result = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ error: result?.message || 'Resend API error' })
    }

    return res.status(200).json({ ok: true, id: result.id })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
