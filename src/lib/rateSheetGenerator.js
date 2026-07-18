// Inline groupKaiserRates to avoid circular import issues
function groupKaiserRates(rows = []) {
  return [...rows].sort((a, b) => {
    if (a.kaiser_plan_no !== b.kaiser_plan_no) return a.kaiser_plan_no.localeCompare(b.kaiser_plan_no)
    return a.package_type === 'med_rx' ? -1 : 1
  })
}

/**
 * KIAA Connect — Company Rate Sheet Generator
 * Produces a print-ready HTML rate sheet for a specific company
 * showing only their elected plans with premiums and contributions.
 */

const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: #fff;
  }
  @page {
    size: letter portrait;
    margin: 0.65in 0.75in 0.65in 0.75in;
    @top-center {
      content: "CONFIDENTIAL — For Employer Use Only";
      font-size: 7.5pt; color: #999;
    }
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages) " · KIAA Connect · Plan year " + (params?.planYear || '2025-2026') + "";
      font-size: 7.5pt; color: #999;
    }
  }
  @media print { .screen-header { display: none; } }
  .screen-header {
    background: #08403E; color: #fff;
    padding: 10px 24px;
    display: flex; align-items: center; justify-content: space-between;
    font-family: Arial, sans-serif;
  }
  .brand { font-size: 13px; font-weight: 700; color: #1BE3DC; }
  .doc-name { font-size: 11px; opacity: 0.75; margin-top: 1px; }
  .btn-print {
    background: #16BAB5; color: #08403E; border: none;
    padding: 6px 16px; border-radius: 5px;
    font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .page { max-width: 7in; margin: 0 auto; padding: 0.2in 0; }
  @media print { .page { padding: 0; max-width: none; } }

  /* Letterhead */
  .letterhead {
    display: flex; align-items: flex-start;
    justify-content: space-between;
    border-bottom: 3px solid #0D6965;
    padding-bottom: 12px; margin-bottom: 16px;
  }
  .lh-left .org {
    font-size: 7.5pt; font-weight: 700; color: #0D6965;
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;
  }
  .lh-left .company {
    font-size: 15pt; font-weight: 700; color: #08403E; line-height: 1.2;
  }
  .lh-left .meta { font-size: 8.5pt; color: #555; margin-top: 3px; }
  .lh-right { text-align: right; font-size: 8.5pt; color: #555; line-height: 1.7; }
  .lh-right .doc-title {
    font-size: 11pt; font-weight: 700; color: #0D6965; margin-bottom: 2px;
  }

  /* Section headers */
  .section-hdr {
    display: flex; align-items: center; gap: 8px;
    margin: 18px 0 8px;
    page-break-after: avoid; break-after: avoid;
  }
  .section-badge {
    font-size: 7.5pt; font-weight: 700; padding: 2px 8px;
    border-radius: 3px; letter-spacing: 0.04em;
  }
  .badge-7a  { background: #0D6965; color: #1BE3DC; }
  .badge-7b  { background: #334155; color: #fff; }
  .badge-riders { background: #475569; color: #fff; }
  .badge-addon  { background: #0D6965; color: #1BE3DC; }
  .section-label { font-size: 8pt; color: #666; }

  /* Plan block */
  .plan-block {
    border: 0.75pt solid #C9E8E7;
    border-radius: 4px;
    margin-bottom: 10px;
    page-break-inside: avoid; break-inside: avoid;
    overflow: hidden;
  }
  .plan-hdr {
    background: #0D6965; color: #fff;
    padding: 6px 12px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .plan-hdr.dark { background: #334155; }
  .plan-name { font-size: 9.5pt; font-weight: 700; }
  .plan-meta { font-size: 7.5pt; opacity: 0.75; margin-top: 1px; }
  .plan-badges { display: flex; gap: 4px; }
  .type-badge {
    font-size: 7.5pt; font-weight: 700; padding: 1px 6px;
    border-radius: 9999px; background: #1BE3DC; color: #08403E;
  }
  .type-badge.hmo { background: #FCD34D; color: #78350F; }
  .hmo-note {
    background: #FEF3C7; border-bottom: 0.5pt solid #FDE68A;
    padding: 4px 12px; font-size: 7.5pt; color: #78350F;
  }
  .7b-note {
    background: #F1F5F9; border-bottom: 0.5pt solid #CBD5E1;
    padding: 4px 12px; font-size: 7.5pt; color: #475569;
  }

  /* Premium table */
  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: #F0FAF9; font-size: 7.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
    color: #0D6965; padding: 5px 10px;
    border-bottom: 0.5pt solid #C9E8E7;
  }
  thead th:first-child { text-align: left; }
  thead th:not(:first-child) { text-align: right; }
  tbody td { padding: 5px 10px; border-bottom: 0.5pt solid #EEF8F7; font-size: 9pt; }
  tbody tr:last-child td { border-bottom: none; }
  tbody td:first-child { color: #555; }
  tbody td:not(:first-child) { text-align: right; font-family: 'Courier New', monospace; }
  .td-total { color: #333; }
  .td-ee { font-weight: 700; color: #0D6965; }
  .td-er { color: #555; }
  .td-na { color: #bbb; font-style: italic; }
  .cc-badge {
    font-size: 6.5pt; background: #E0F5F4; color: #0D6965;
    padding: 0 4px; border-radius: 2px; margin-left: 3px;
    vertical-align: middle;
  }
  .method-note {
    font-size: 7.5pt; color: #6B9E9C; padding: 4px 10px;
    background: #F8FDFC; border-top: 0.5pt solid #EEF8F7; font-style: italic;
  }

  /* COMPCARE block */
  .compcare-block {
    border: 0.75pt solid #C9E8E7; border-radius: 4px;
    margin-bottom: 10px; overflow: hidden;
    page-break-inside: avoid;
  }
  .compcare-hdr {
    background: #0D6965; color: #fff; padding: 6px 12px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .compcare-body {
    padding: 8px 12px; background: #F8FDFC;
    font-size: 8.5pt; color: #333;
    display: flex; align-items: center; gap: 16px;
  }
  .compcare-rate { font-family: 'Courier New', monospace; font-weight: 700; color: #0D6965; font-size: 11pt; }

  /* Footer */
  .doc-footer {
    margin-top: 20px; padding-top: 10px;
    border-top: 0.5pt solid #C9E8E7;
    font-size: 7.5pt; color: #888; line-height: 1.6;
    font-style: italic;
  }
  .conf-notice {
    background: #FEF3C7; border: 0.5pt solid #FDE68A;
    border-radius: 3px; padding: 5px 10px;
    font-size: 7.5pt; color: #78350F;
    margin-bottom: 14px; font-style: normal;
  }
`

function fmt(v) {
  if (!v && v !== 0) return '—'
  return '$' + parseFloat(v).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })
}

function parseMoney(v) {
  return parseFloat(String(v || 0).replace(/[$,]/g, '')) || 0
}

function calcPhca(grossWage, total) {
  if (!grossWage || !total) return 0
  const pct15 = parseMoney(grossWage) * 0.015
  const cap50 = parseMoney(total) * 0.50
  return Math.round(Math.min(pct15, cap50) * 100) / 100
}

function planRows(plan, election, rate, compCareElected, COMPCARE) {
  const method  = election?.contrib_method || 'fixed'
  const gross   = election?.gross_wage
  const ccAddon = compCareElected && ['ppp_full','compmed_a_full','hph_plus_full','hph_basic_full','compmed_b_full'].includes(plan.id)
    ? (COMPCARE?.tiers?.single || 6.76) : 0

  const tiers = [
    { label: 'Employee only (Single)',   base: rate?.single,    eeFixed: election?.ee_single },
    { label: 'Employee + 1 (2-Party)',   base: rate?.two_party, eeFixed: election?.ee_two_party },
    { label: 'Employee + family',        base: rate?.family,    eeFixed: election?.ee_family },
  ]

  return tiers.map(({ label, base, eeFixed }) => {
    const total = (parseMoney(base) || 0) + ccAddon
    const ee    = method === 'phca' ? calcPhca(gross, total) : parseMoney(eeFixed)
    const er    = total ? Math.max(0, total - ee) : 0
    return { label, total, ee, er, hasData: !!base }
  })
}

export function generateCompanyRateSheet({
  company, plans, elections, rates, COMPCARE, generatedDate, planYear, planYearLong,
  kaiserRates = [], kaiserElections = {}, oePlanYear
}) {
  const plans7a     = plans.filter(p => p.hmsa_class === '7a')
  const plans7b     = plans.filter(p => p.hmsa_class === '7b')
  const ridersEl    = elections['kiaa_riders']
  const ccElected   = company.compcare_elected
  const today       = generatedDate || new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })

  function planBlock(plan, election, rate) {
    if (!election?.elected) return ''
    const rows    = planRows(plan, election, rate, ccElected, COMPCARE)
    const isDark  = plan.hmsa_class === '7b'
    const method  = election?.contrib_method || 'fixed'
    const isPhca  = method === 'phca'
    const ccApplies = ccElected && ['ppp_full','compmed_a_full','hph_plus_full','hph_basic_full','compmed_b_full'].includes(plan.id)

    return `
    <div class="plan-block">
      <div class="plan-hdr ${isDark ? 'dark' : ''}">
        <div>
          <div class="plan-name">${plan.name}</div>
          <div class="plan-meta">${plan.codes} · ${plan.hmsa_class_label}</div>
        </div>
        <div class="plan-badges">
          <span class="type-badge ${plan.type === 'HMO' ? 'hmo' : ''}">${plan.type}</span>
        </div>
      </div>
      ${plan.referralRequired ? '<div class="hmo-note">⚠ HMO Plan — Primary care physician referral required for specialist visits. Out-of-network services not covered (emergency only).</div>' : ''}
      ${plan.hmsa_class === '7b' ? '<div class="7b-note">7(b) Plan — Employer is required to pay one-half of the cost for dependents\' coverage.</div>' : ''}
      <table>
        <thead>
          <tr>
            <th>Coverage tier</th>
            <th>Total premium${ccApplies ? ' (incl. COMPCARE)' : ''}</th>
            <th>Employee pays</th>
            <th>Employer pays</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(({ label, total, ee, er, hasData }) => `
          <tr>
            <td>${label}</td>
            <td class="td-total">${hasData ? fmt(total) : '<span class="td-na">N/A</span>'}</td>
            <td class="td-ee">${hasData ? fmt(ee) : '<span class="td-na">N/A</span>'}</td>
            <td class="td-er">${hasData ? fmt(er) : '<span class="td-na">N/A</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${isPhca ? `<div class="method-note">Employee contribution calculated using Hawaii PHCA § 393-15: 1.5% of average monthly gross wages${election?.gross_wage ? ` ($${parseFloat(election.gross_wage).toLocaleString()})` : ''}, not to exceed 50% of the total premium.</div>` : ''}
    </div>`
  }

  const addr = [
    company.address_line1,
    company.address_line2,
    [company.city, company.state, company.zip].filter(Boolean).join(', ')
  ].filter(Boolean).join(' · ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Rate Sheet — ${company.name}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="screen-header">
  <div>
    <div class="brand">KIAA Connect</div>
    <div class="doc-name">Company Rate Sheet — ${company.name}</div>
  </div>
  <button class="btn-print" onclick="window.print()">🖨 Print / Save PDF</button>
</div>

<div class="page">
  <!-- Letterhead -->
  <div class="letterhead">
    <div class="lh-left">
      <div class="org">Kanoelehua Industrial Area Association</div>
      <div class="company">${company.name}</div>
      <div class="meta">${addr || ''}${company.band ? ` · HMSA Band ${company.band}` : ''}</div>
    </div>
    <div class="lh-right">
      <div class="doc-title">Health Plan Rate Sheet</div>
      <div>Plan year: ${planYearLong || 'October 1, 2025 – September 30, 2026'}</div>
      <div>Generated: ${today}</div>
      <div style="color:#0D6965;font-weight:700;margin-top:4px;">CONFIDENTIAL</div>
    </div>
  </div>

  <div class="conf-notice">
    This rate sheet is confidential and intended for employer use only. All premiums are monthly amounts and do not include the KIAA Administrative Fee of <strong>$4.00 per employee per month</strong>.
  </div>

  <!-- 7(a) Plans -->
  ${plans7a.filter(p => elections[p.id]?.elected).length > 0 ? `
  <div class="section-hdr">
    <span class="section-badge badge-7a">7(a) Plans</span>
    <span class="section-label">Equal to or better than the prevalent plan</span>
  </div>
  ${plans7a.map(p => planBlock(p, elections[p.id], rates[p.id])).join('')}
  ` : ''}

  <!-- 7(b) Plans -->
  ${plans7b.filter(p => elections[p.id]?.elected).length > 0 ? `
  <div class="section-hdr">
    <span class="section-badge badge-7b">7(b) Plans</span>
    <span class="section-label">Employer must pay one-half of dependent coverage cost</span>
  </div>
  ${plans7b.map(p => planBlock(p, elections[p.id], rates[p.id])).join('')}
  ` : ''}

  <!-- Riders Package -->
  ${ridersEl?.elected ? `
  <div class="section-hdr">
    <span class="section-badge badge-riders">Riders</span>
    <span class="section-label">KIAA Riders Package — Vision, Dental, Group Life/AD&D</span>
  </div>
  <div class="plan-block">
    <div class="plan-hdr dark">
      <div>
        <div class="plan-name">KIAA Riders Package (Vision, Dental, Group Life/AD&D)</div>
        <div class="plan-meta">Available to employees with outside medical/drug coverage</div>
      </div>
      <span class="type-badge">PPO</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Coverage tier</th>
          <th>Vision</th>
          <th>Dental</th>
          <th>Life/AD&amp;D</th>
          <th>Total</th>
          <th>Employee pays</th>
          <th>Employer pays</th>
        </tr>
      </thead>
      <tbody>
        ${[
          { label: 'Single',  total: rates['kiaa_riders']?.premium_single    || rates['kiaa_riders']?.single    || 45.24,  ee: ridersEl.ee_single,    vision: rates['kiaa_riders']?.vision_single    || 7.32,  dental: rates['kiaa_riders']?.dental_single    || 33.56,  life: rates['kiaa_riders']?.life_single    || 4.36 },
          { label: '2-Party', total: rates['kiaa_riders']?.premium_two_party || rates['kiaa_riders']?.two_party || 92.40,  ee: ridersEl.ee_two_party, vision: rates['kiaa_riders']?.vision_two_party || 14.62, dental: rates['kiaa_riders']?.dental_two_party || 73.42,  life: rates['kiaa_riders']?.life_two_party || 4.36 },
          { label: 'Family',  total: rates['kiaa_riders']?.premium_family    || rates['kiaa_riders']?.family    || 136.36, ee: ridersEl.ee_family,    vision: rates['kiaa_riders']?.vision_family    || 21.92, dental: rates['kiaa_riders']?.dental_family    || 110.08, life: rates['kiaa_riders']?.life_family    || 4.36 },
        ].map(({ label, total, ee, vision, dental, life }) => {
          const eeAmt = parseMoney(ee)
          const er    = total ? Math.max(0, parseMoney(total) - eeAmt) : 0
          return `<tr>
            <td>${label}</td>
            <td class="td-total">${fmt(vision)}</td>
            <td class="td-total">${fmt(dental)}</td>
            <td class="td-total">${fmt(life)}</td>
            <td class="td-total" style="font-weight:600;">${total ? fmt(total) : '<span class="td-na">N/A</span>'}</td>
            <td class="td-ee">${total ? fmt(eeAmt) : '<span class="td-na">N/A</span>'}</td>
            <td class="td-er">${total ? fmt(er) : '<span class="td-na">N/A</span>'}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Kaiser Permanente -->
  ${kaiserRates.length > 0 && groupKaiserRates(kaiserRates).some(g => kaiserElections[g.kaiser_plan_no + '_' + g.package_type]?.elected) ? `
  <div class="section-hdr" style="background:#385262;">
    <span class="section-badge" style="background:rgba(255,255,255,0.2);color:#fff;">Kaiser</span>
    <span class="section-label" style="color:#fff;">Kaiser Permanente Plans${company.kaiser_schedule ? ' — Schedule ' + company.kaiser_schedule : ''}</span>
  </div>
  ${groupKaiserRates(kaiserRates).map(group => {
    const key = group.kaiser_plan_no + '_' + group.package_type
    const el  = kaiserElections[key]
    if (!el?.elected) return ''
    const isFull   = group.package_type === 'full'
    const pkgLabel = isFull ? 'Full Package' : 'Med/Rx Package'
    const method   = el.contrib_method || 'fixed'
    const tiers = [
      { label: 'Single',  total: group.premium_single,    medical: group.medical_single,    ee: el.ee_single },
      { label: '2-Party', total: group.premium_two_party, medical: group.medical_two_party, ee: el.ee_two_party },
      { label: 'Family',  total: group.premium_family,    medical: group.medical_family,    ee: el.ee_family },
    ]
    return `
    <div class="plan-block">
      <div class="plan-hdr" style="background:#385262;">
        <div>
          <div class="plan-name" style="color:#fff;">Kaiser Permanente ${group.kaiser_plan_no} — ${pkgLabel}</div>
          <div class="plan-meta" style="color:#84aac1;">HMO · Schedule ${group.schedule || company.kaiser_schedule || ''}${isFull ? ' · Includes HMSA Vision, Dental &amp; Life/AD&amp;D' : ''}</div>
        </div>
        <span class="type-badge" style="background:rgba(255,255,255,0.2);color:#fff;">HMO</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Coverage tier</th>
            <th>Medical &amp; Drug</th>
            ${isFull ? '<th>Vision</th><th>Dental</th><th>Life/AD&amp;D</th>' : ''}
            <th>Total</th>
            <th>Employee pays</th>
            <th>Employer pays</th>
          </tr>
        </thead>
        <tbody>
          ${tiers.map(({ label, total, medical, ee }) => {
            const RIDERS = { Single: { vision:7.32, dental:33.56, life:4.36 }, '2-Party': { vision:14.62, dental:73.42, life:4.36 }, Family: { vision:21.92, dental:110.08, life:4.36 } }
            const r = RIDERS[label] || {}
            let eeAmt = parseMoney(ee)
            if (method === 'phca' && el.gross_wage) {
              const pct15 = parseMoney(el.gross_wage) * 0.015
              const cap50 = parseMoney(total) * 0.50
              eeAmt = Math.min(pct15, cap50)
            }
            const er = total ? Math.max(0, parseMoney(total) - eeAmt) : 0
            return `<tr>
              <td>${label}</td>
              <td class="td-total">${fmt(medical || total)}</td>
              ${isFull ? `<td class="td-total">${fmt(r.vision)}</td><td class="td-total">${fmt(r.dental)}</td><td class="td-total">${fmt(r.life)}</td>` : ''}
              <td class="td-total" style="font-weight:600;">${fmt(total)}</td>
              <td class="td-ee">${fmt(eeAmt)}</td>
              <td class="td-er">${fmt(er)}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
      ${method === 'phca' ? '<div style="font-size:7pt;color:#555;padding:4px 8px;">Employee contribution calculated using Hawaii PHCA 1.5% method (HRS § 393-15).</div>' : ''}
    </div>`
  }).join('')}
  ` : ''}

  <!-- COMPCARE -->
  ${ccElected ? `
  <div class="section-hdr">
    <span class="section-badge badge-addon">Add-on</span>
    <span class="section-label">COMPCARE — Included in all full package plan premiums above</span>
  </div>
  <div class="compcare-block">
    <div class="compcare-hdr">
      <div>
        <div class="plan-name">COMPCARE (Acupuncture, Massage, Active &amp; Fit)</div>
        <div class="plan-meta">Employee benefit — included in full package plan totals above</div>
      </div>
      <span class="type-badge">Add-on</span>
    </div>
    <div class="compcare-body">
      <div>
        <div style="font-size:7.5pt;color:#666;margin-bottom:2px;">Monthly premium per employee</div>
        <div class="compcare-rate">$6.76</div>
      </div>
      <div style="font-size:8pt;color:#555;flex:1;">
        Applies to all coverage tiers (Single, 2-Party, Family). Covers the employee subscriber only —
        dependents are not covered by COMPCARE for the 2025–2026 plan year.
        COMPCARE premiums are already included in the Full Package plan totals shown above.
      </div>
    </div>
  </div>
  ` : ''}

  <div class="doc-footer">
    All plans administered by Hawaii Medical Service Association (HMSA) through Kanoelehua Industrial Area Association (KIAA).
    Contact KIAA: (808) 961-5422 · kiaahilo.org · Contact HMSA: 1-800-776-4672 · hmsa.com<br>
    Plan year: ${planYearLong || 'October 1, 2025 – September 30, 2026'} · Generated by KIAA Connect on ${today}<br>
    This document is for employer reference only and does not constitute a certificate of coverage.
    Refer to the Summary Plan Description (SPD) and Summary of Benefits &amp; Coverage (SBC) for complete plan details.<br>
    <strong>* Total premiums do not include the KIAA Administrative Fee of $4.00 per employee per month.</strong>
  </div>
</div>
</body>
</html>`
}

