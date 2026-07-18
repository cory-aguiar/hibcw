import { getSPDCobraText, getSPDFmlaText, getSPDErisaText } from '@/lib/compliance'

// ── MRG plan benefit rows ─────────────────────────────────────
function planRows(plan) {
  const isHMO    = plan.referralRequired
  const isPPP    = plan.id.startsWith('ppp')
  const isMedOnly = plan.riders ? plan.riders.length === 1 : false

  return [
    { section: 'Cost sharing basics' },
    { label: 'Plan type',                            value: plan.type },
    { label: 'Deductible — individual / family',     value: plan.deductible,  free: plan.deductible === '$0' },
    { label: 'Out-of-pocket max — medical (ind/fam)',value: plan.oopMedical,  warn: true },
    { label: 'Out-of-pocket max — Rx (ind/fam)',     value: plan.oopRx },
    { label: 'Referral required for specialist',     value: isHMO ? 'Yes — required' : 'No', warn: isHMO },
    { label: 'Out-of-network coverage',              value: plan.outOfNetwork, warn: plan.outOfNetwork === 'Not covered (emergency only)' },
    { label: 'Coinsurance',                          value: isPPP ? '10% (hospital) / 20% (other) in-network; 30% out-of-network' : '20%' },

    { section: 'Office visits' },
    { label: 'Primary care visit',                   value: plan.pcp },
    { label: 'Specialist visit',                     value: plan.specialist },
    { label: 'Urgent care',                          value: plan.pcp },
    { label: 'Preventive care / screenings',         value: 'No charge', free: true },
    { label: 'Immunizations (standard and travel)',  value: 'No charge', free: true },
    { label: 'Mental health — outpatient physician', value: plan.pcp },
    { label: 'Mental health — inpatient physician',  value: 'No charge', free: true },

    { section: 'Emergency & urgent care' },
    { label: 'Emergency room (facility)',            value: plan.er },
    { label: 'Emergency room (physician)',           value: plan.id === 'hph_basic_full' ? 'No charge' : (isPPP ? '$12 copay' : '$20 copay') },
    { label: 'Urgent care',                          value: plan.pcp },
    { label: 'Emergency medical transport (air/ground)', value: '20% coinsurance' },

    { section: 'Hospital & surgery' },
    { label: 'Inpatient facility fee',               value: plan.hospital },
    { label: 'Inpatient physician visits',           value: isHMO ? '20% coinsurance' : (isPPP ? '$12 copay' : '$20 copay') },
    { label: 'Outpatient surgery — facility',        value: isHMO ? 'No charge' : (isPPP ? '10% coinsurance' : '20% coinsurance') },
    { label: 'Outpatient surgery — surgeon (cutting)',value: isHMO ? '$20 copay' : (isPPP ? '10% coinsurance' : '20% coinsurance') },
    { label: 'Maternity — prenatal / postnatal',     value: plan.maternity },
    { label: 'Maternity — childbirth facility',      value: isHMO ? '20% coinsurance' : plan.maternity },

    { section: 'Prescription drugs' },
    { label: 'Generic — retail (30-day)',            value: `${plan.rxGeneric}/prescription` },
    { label: 'Generic — mail order (84–90 day)',     value: isMedOnly ? '—' : '$11 copay/prescription' },
    { label: 'Preferred brand — retail',             value: `${plan.rxPreferred}/prescription` },
    { label: 'Preferred brand — mail order',         value: isMedOnly ? '—' : '$65 copay/prescription' },
    { label: 'Non-preferred brand — retail',         value: `${plan.rxPreferred}/prescription + $35 other brand cost share` },
    { label: 'Non-preferred brand — mail order',     value: isMedOnly ? '—' : '$65 copay + $105 other brand cost share' },
    { label: 'Specialty drugs — retail',             value: isPPP ? '20% coinsurance' : `${plan.rxPreferred}/prescription + $35 other brand cost share` },
    { label: 'Specialty drugs — mail order',         value: isMedOnly ? '—' : (isPPP ? 'Not covered' : '$65 copay + $105 other brand cost share') },

    { section: 'Recovery & special needs' },
    { label: 'Home health care',                     value: isHMO ? 'No charge (in-network only)' : 'No charge (150 visits/year)' },
    { label: 'Rehabilitation services',              value: isHMO ? '$20 copay/visit' : '20% coinsurance' },
    { label: 'Skilled nursing care',                 value: '20% coinsurance (120 days/year)' },
    { label: 'Durable medical equipment',            value: isHMO ? '50% coinsurance' : '20% coinsurance' },
    { label: 'Hospice services',                     value: 'No charge', free: true },
    { label: 'Habilitation services',                value: 'Not covered' },
  ]
}

// ── ACA plan benefit rows ─────────────────────────────────────
function acaPlanRows(plan) {
  const isHMO = plan.referralRequired
  const isPPP = plan.id === 'aca_ppp'

  return [
    { section: 'Cost sharing basics' },
    { label: 'Plan type',                            value: plan.type },
    { label: 'Deductible — individual / family',     value: plan.deductible, free: plan.deductible === '$0' || (plan.deductible||'').startsWith('$0 ') },
    { label: 'Out-of-pocket max — medical (ind/fam)',value: plan.oopMedical, warn: true },
    { label: 'Out-of-pocket max — Rx (ind/fam)',     value: plan.oopRx },
    { label: 'Referral required for specialist',     value: isHMO ? 'Yes — required' : 'No', warn: isHMO },
    { label: 'Out-of-network coverage',              value: plan.outOfNetwork, warn: plan.outOfNetwork === 'Not covered (emergency only)' },

    { section: 'Office visits' },
    { label: 'Primary care visit',                   value: plan.pcp },
    { label: 'Specialist visit',                     value: plan.specialist },
    { label: 'Preventive care / screenings',         value: 'No charge', free: true },
    { label: 'Mental health — outpatient',           value: plan.pcp },

    { section: 'Emergency & hospital' },
    { label: 'Emergency room',                       value: plan.er },
    { label: 'Inpatient hospital facility',          value: plan.hospital },
    { label: 'Maternity care',                       value: plan.maternity },

    { section: 'Prescription drugs' },
    { label: 'Generic — retail (30-day)',            value: `${plan.rxGeneric}/prescription` },
    { label: 'Generic — mail order (84–90 day)',     value: '$14 copay/prescription' },
    { label: 'Preferred brand — retail',             value: `${plan.rxPreferred}/prescription` },
    { label: 'Preferred brand — mail order',         value: '$100 copay/prescription' },
    { label: 'Non-preferred brand — retail',         value: `${plan.rxPreferred}/prescription + $35 other brand cost share` },
    { label: 'Specialty drugs — retail',             value: isPPP ? '20% coinsurance' : `${plan.rxPreferred}/prescription + $35 other brand cost share` },

    { section: 'Pediatric benefits (ACA-required)' },
    { label: 'Pediatric dental',                     value: 'Included for dependents age 18 and under', free: true },
    { label: 'Pediatric vision',                     value: 'Included for dependents age 18 and under', free: true },
  ]
}

// ── HTML renderer for one MRG plan table ─────────────────────
function planTableHtml(plan) {
  const rows = planRows(plan)
  const hmoWarn = plan.referralRequired
    ? `<div class="warn-box">
        ⚠ HMO Plan — A referral from your primary care physician is required before seeing a specialist.
        Out-of-network services are not covered except for emergency care.
       </div>`
    : ''

  const riderBadges = (plan.riders || []).map(r =>
    `<span class="badge">${r}</span>`
  ).join('')

  const rowsHtml = rows.map(r => {
    if (r.section) return `<tr class="section-row"><td colspan="2">${r.section}</td></tr>`
    const cls = r.free ? 'free' : r.warn ? 'warn' : ''
    return `<tr><td class="row-label">${r.label}</td><td class="row-value ${cls}">${r.value}</td></tr>`
  }).join('\n')

  return `
    <div class="plan-block avoid-break">
      <div class="plan-header">
        <div class="plan-header-left">
          <span class="plan-type-badge">${plan.type}</span>
          <div>
            <div class="plan-name">${plan.name}</div>
            <div class="plan-codes">${plan.codes || ''} &nbsp;·&nbsp; ${plan.planYear || ''}</div>
          </div>
        </div>
        <div class="plan-riders">${riderBadges}</div>
      </div>
      ${hmoWarn}
      <table class="benefit-table">
        <thead><tr><th class="col-service">Service</th><th class="col-cost">Your cost</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="plan-footnote">
        Services not covered include: acupuncture, cosmetic surgery, habilitation services, long-term care,
        private-duty nursing, routine foot care, and weight loss programs.
        ${(plan.riders || []).length === 1 ? ' Dental and vision care are not included under this plan option.' : ''}
        See the full HMSA plan document and attached SBC for complete details.
      </div>
    </div>`
}

// ── HTML renderer for one ACA plan table ─────────────────────
function acaPlanTableHtml(plan) {
  const rows = acaPlanRows(plan)
  const hmoWarn = plan.referralRequired
    ? `<div class="warn-box">
        ⚠ HMO Plan — A referral from your primary care physician is required before seeing a specialist.
        Out-of-network services are not covered except for emergency care.
       </div>`
    : ''

  const rowsHtml = rows.map(r => {
    if (r.section) return `<tr class="section-row"><td colspan="2">${r.section}</td></tr>`
    const cls = r.free ? 'free' : r.warn ? 'warn' : ''
    return `<tr><td class="row-label">${r.label}</td><td class="row-value ${cls}">${r.value}</td></tr>`
  }).join('\n')

  return `
    <div class="plan-block avoid-break">
      <div class="plan-header">
        <div class="plan-header-left">
          <span class="plan-type-badge">${plan.type}</span>
          <div>
            <div class="plan-name">${plan.name}</div>
            <div class="plan-codes">ACA Small Group &nbsp;·&nbsp; Medical &amp; Prescription Drug Benefits</div>
          </div>
        </div>
        <div class="plan-riders">
          <span class="badge">Dental</span>
          <span class="badge">Vision</span>
          <span class="badge">Group Life/AD&amp;D</span>
        </div>
      </div>
      ${hmoWarn}
      <table class="benefit-table">
        <thead><tr><th class="col-service">Service</th><th class="col-cost">Your cost</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="plan-footnote">
        All ACA Small Group plans provide Medical and Prescription Drug benefits. Pediatric Dental and Vision
        are included for covered dependents age 18 and under (ACA-required). The KIAA Riders Package (adult
        Dental, Vision, and Group Life/AD&amp;D) is a separate standalone benefit — enrollment is managed
        independently by KIAA.
      </div>
    </div>`
}

// ── Full SPD HTML document ────────────────────────────────────
export function generateSPDHtml({ company, planList, sections, generatedDate, isAca, planYear, planYearShort }) {
  const planNames = planList.map(p => p.name)

  const eligibilityHtml = sections.includes('eligibility') ? `
    <section class="spd-section avoid-break">
      <h2 class="section-title">2. Eligibility</h2>
      <p>Employees regularly scheduled to work 20 or more hours per week are eligible to enroll following
      the applicable waiting period. Eligible dependents include a lawful spouse or domestic partner and
      dependent children up to age 26. Employees must complete enrollment within 30 days of their
      eligibility date.</p>
      ${isAca
        ? `<p>This plan is an ACA Small Group health plan. The plan year begins on the employee's coverage
           effective date and runs for 12 months. Premiums are based on each covered member's age as of the
           coverage effective date and are locked for the plan year. Ages are recalculated upon annual renewal.
           Outside of the initial enrollment period, you may enroll or change coverage within 30 days of a
           qualifying life event (QLE) such as marriage, divorce, birth, adoption, or involuntary loss of other
           coverage. Notify Human Resources within 30 days of the QLE.</p>`
        : `<p>Open Enrollment occurs annually before October 1. Changes made during Open Enrollment take effect
           on October 1. Outside of Open Enrollment, you may enroll or change coverage within 30 days of a
           qualifying life event (QLE) such as marriage, divorce, birth, adoption, or involuntary loss of other
           coverage. Notify Human Resources within 30 days of the QLE.</p>`
      }
    </section>` : ''

  const glanceHtml = sections.includes('glance') && planList.length > 0 ? `
    <section class="spd-section">
      <h2 class="section-title">3. Benefits at a glance</h2>
      <p class="intro-note">The following tables summarize key benefit features for each plan offered by
      ${company.name}. This is a summary only — refer to the full HMSA${isAca ? ' Small Group' : ''}
      plan documents and the attached Summary of Benefits and Coverage (SBC) for complete benefit details,
      limitations, and exclusions. All cost-sharing amounts are per plan year unless otherwise noted.</p>
      ${planList.map(p => isAca ? acaPlanTableHtml(p) : planTableHtml(p)).join('\n')}
    </section>` : ''

  const plansHtml = sections.includes('plans') && planList.length > 0 ? `
    <section class="spd-section avoid-break">
      <h2 class="section-title">4. Plans enrolled</h2>
      ${isAca
        ? `<p>${company.name} participates in the HMSA ACA Small Group program and offers the following
           plan(s) for the ${planYear} plan year: <strong>${planNames.join(', ')}</strong>. These plans
           provide Medical and Prescription Drug benefits administered by Hawaii Medical Service Association
           (HMSA). Pediatric Dental and Vision benefits are included for covered dependents age 18 and under
           as required by the ACA. The KIAA Riders Package (adult Dental, Vision, and Group Life/AD&amp;D)
           is a separate standalone benefit administered by KIAA — enrollment is managed independently.
           Complete plan documents and the Summary of Benefits and Coverage (SBC) are available at
           <strong>www.hmsa.com</strong> or by calling <strong>1-800-776-4672</strong>. In the event of
           any conflict between this SPD and the official plan documents, the official plan documents
           govern.</p>`
        : `<p>${company.name} offers the following HMSA plan(s) for the ${planYear} plan year:
           <strong>${planNames.join(', ')}</strong>. All plans are administered by Hawaii Medical Service
           Association (HMSA). Complete plan documents, the Summary of Benefits and Coverage (SBC), and the
           HMSA Evidence of Coverage are available at <strong>www.hmsa.com</strong> or by calling
           <strong>1-800-776-4672</strong>. In the event of any conflict between this SPD and the official
           plan documents, the official plan documents govern.</p>`
      }
    </section>` : ''

  const cobraHtml = sections.includes('cobra') ? `
    <section class="spd-section avoid-break">
      <h2 class="section-title">5. COBRA / continuation of coverage</h2>
      <p>${getSPDCobraText(company)}</p>
    </section>` : ''

  const fmlaHtml = sections.includes('fmla') ? `
    <section class="spd-section avoid-break">
      <h2 class="section-title">6. FMLA / family and medical leave</h2>
      <p>${getSPDFmlaText(company)}</p>
    </section>` : ''

  const erisakHtml = sections.includes('erisa') ? `
    <section class="spd-section avoid-break">
      <h2 class="section-title">7. ERISA rights &amp; reporting</h2>
      <p>${getSPDErisaText(company)}</p>
      <p>As a participant in this plan you are entitled to certain rights and protections under ERISA.
      You may examine plan documents without charge at the Plan Administrator's office, obtain copies
      upon written request, and receive a summary of the plan's annual financial report. No one may
      fire or discriminate against you for exercising your ERISA rights. For assistance contact the
      Employee Benefits Security Administration (EBSA): 1-866-444-3272 | www.dol.gov/ebsa.</p>
    </section>` : ''

  const hipaaHtml = sections.includes('hipaa') ? `
    <section class="spd-section avoid-break">
      <h2 class="section-title">8. HIPAA privacy</h2>
      <p>Your protected health information (PHI) is protected under the Health Insurance Portability and
      Accountability Act (HIPAA). HMSA's Notice of Privacy Practices is available at hmsa.com or by
      calling 1-800-776-4672. You have the right to inspect and obtain a copy of your PHI, request
      corrections, receive an accounting of disclosures, and file a complaint with HMSA or the U.S.
      Department of Health and Human Services. HMSA does not discriminate on the basis of race, color,
      national origin, age, disability, or sex.</p>
      <p>Language assistance services are available at no cost. Call 1-800-776-4672.
      Spanish: Para obtener asistencia en Español, llame al 1-800-776-4672.
      Tagalog: Tumawag sa 1-800-776-4672. Chinese: 请拨打 1-800-776-4672. TTY: 711.</p>
    </section>` : ''

  const claimsHtml = sections.includes('claims') ? `
    <section class="spd-section avoid-break">
      <h2 class="section-title">9. Claims &amp; appeals</h2>
      <p>In-network providers generally file claims directly with HMSA. To file a claim yourself,
      complete a claim form at <strong>www.hmsa.com</strong> or call <strong>1-800-776-4672</strong>.
      Claims must be submitted within 12 months of the date of service.</p>
      <table class="info-table">
        <tr><td>Urgent care claims</td><td>Decision within 72 hours</td></tr>
        <tr><td>Pre-service (prior authorization)</td><td>Decision within 15 days</td></tr>
        <tr><td>Post-service claims</td><td>Decision within 30 days</td></tr>
      </table>
      <p style="margin-top:10px"><strong>Appeals:</strong> Submit written appeals to HMSA Member Advocacy
      and Appeals, P.O. Box 1958, Honolulu, HI 96805-1958 | appeals@hmsa.com | (808) 948-5090 or
      1-800-462-2085. You have 180 days from receipt of a denial to submit a first-level appeal.
      External review is available after exhausting internal appeals. For external appeals contact the
      Hawaii Insurance Division: (808) 586-2804 | 335 Merchant Street, Room 213, Honolulu, HI 96813.</p>
    </section>` : ''

  const addressLine = [
    company.address_line1,
    company.address_line2,
    [company.city, company.state, company.zip].filter(Boolean).join(', ')
  ].filter(Boolean).join(', ')

  // Cover subtitle and plan year display differ by type
  const coverSubtitle = isAca
    ? 'HMSA ACA Small Group Health Insurance Plan'
    : 'HMSA Group Health Insurance Plan'
  const erisPlanYear = isAca
    ? 'Rolling 12-month from coverage effective date'
    : 'October 1 – September 30'
  const footerPlanYear = planYearShort || (isAca ? '' : '10/01/2025 – 09/30/2026')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SPD — ${company.name} — ${new Date().getFullYear()}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.55; color: #1a1a1a; background: #fff; }
    @page { size: letter portrait; margin: 0.85in 0.85in 0.9in 0.85in; }
    @page :first { margin-top: 0.6in; }
    @page {
      @top-center { content: "${company.name} — Summary Plan Description"; font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; color: #666; }
      @bottom-left { content: "Confidential — For plan participants only"; font-family: 'DM Sans', system-ui, sans-serif; font-size: 7.5pt; color: #999; }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font-family: 'DM Sans', system-ui, sans-serif; font-size: 7.5pt; color: #999; }
    }
    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
    .page-break  { page-break-before: always; break-before: always; }
    .screen-header { background: #385262; color: #fff; padding: 14px 32px; display: flex; align-items: center; justify-content: space-between; font-family: 'DM Sans', system-ui, sans-serif; }
    .screen-header .brand { font-size: 13px; font-weight: 700; color: #6595B2; }
    .screen-header .doc-name { font-size: 12px; opacity: 0.8; }
    .screen-actions { display: flex; gap: 10px; }
    .btn-print { background: #6595B2; color: #385262; border: none; padding: 7px 18px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', system-ui, sans-serif; }
    .btn-print:hover { background: #84AAC1; }
    @media print { .screen-header { display: none; } body { font-size: 10pt; } }
    .document { max-width: 8.5in; margin: 0 auto; padding: 0.5in 0.85in 0.5in; background: #fff; }
    @media print { .document { padding: 0; max-width: none; } }

    /* Cover */
    .cover { text-align: center; padding: 1.2in 0.5in 0.8in; page-break-after: always; break-after: always; }
    .cover-org { font-family: 'DM Sans', system-ui, sans-serif; font-size: 11pt; color: #496B80; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.3in; }
    .cover-company { font-family: Georgia, serif; font-size: 26pt; font-weight: 700; color: #385262; line-height: 1.2; margin-bottom: 0.15in; }
    .cover-title { font-family: 'DM Sans', system-ui, sans-serif; font-size: 16pt; font-weight: 700; color: #496B80; margin-bottom: 0.05in; }
    .cover-subtitle { font-family: 'DM Sans', system-ui, sans-serif; font-size: 11pt; color: #555; margin-bottom: 0.04in; }
    .cover-divider { border: none; border-top: 2px solid #C9E8E7; width: 3in; margin: 0.25in auto; }
    .cover-meta { display: inline-block; text-align: left; font-family: 'DM Sans', system-ui, sans-serif; font-size: 10pt; }
    .cover-meta table { border-collapse: collapse; }
    .cover-meta td { padding: 3px 12px 3px 0; color: #333; }
    .cover-meta td:first-child { color: #666; font-weight: 600; min-width: 160px; }
    .cover-notice { margin-top: 0.3in; font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; color: #888; font-style: italic; max-width: 5in; margin-left: auto; margin-right: auto; line-height: 1.5; }

    /* Sections */
    .spd-section { margin-bottom: 0.35in; }
    .section-title { font-family: 'DM Sans', system-ui, sans-serif; font-size: 13pt; font-weight: 700; color: #385262; border-bottom: 2px solid #C9E8E7; padding-bottom: 5px; margin-bottom: 10px; }
    p { margin-bottom: 8px; }
    .intro-note { font-size: 9pt; color: #555; font-style: italic; margin-bottom: 14px; }

    /* Plan block */
    .plan-block { border: 1px solid #C9E8E7; border-radius: 6px; overflow: hidden; margin-bottom: 18px; }
    .plan-header { background: #385262; color: #fff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
    .plan-header-left { display: flex; align-items: center; gap: 10px; }
    .plan-type-badge { background: #84AAC1; color: #385262; font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; font-weight: 700; padding: 2px 8px; border-radius: 3px; flex-shrink: 0; }
    .plan-name { font-family: 'DM Sans', system-ui, sans-serif; font-size: 11pt; font-weight: 700; }
    .plan-codes { font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; opacity: 0.7; margin-top: 1px; }
    .plan-riders { display: flex; gap: 5px; flex-wrap: wrap; }
    .badge { background: rgba(255,255,255,0.18); color: #fff; font-family: 'DM Sans', system-ui, sans-serif; font-size: 7.5pt; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
    .warn-box { background: #FEF3C7; border-left: 3px solid #F59E0B; padding: 7px 12px; font-family: 'DM Sans', system-ui, sans-serif; font-size: 9pt; color: #78350F; margin: 0; }

    /* Benefit table */
    .benefit-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .benefit-table thead tr { background: #EDF2F6; }
    .benefit-table th { font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #496B80; padding: 6px 10px; text-align: left; border-bottom: 1px solid #C9E8E7; }
    .benefit-table .col-service { width: 58%; }
    .benefit-table .col-cost    { width: 42%; }
    .benefit-table .section-row td { background: #496B80; color: #fff; font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 5px 10px; }
    .benefit-table tr:not(.section-row) { border-bottom: 1px solid #EEF8F7; }
    .benefit-table tr:not(.section-row):last-child { border-bottom: none; }
    .benefit-table tr:not(.section-row):nth-child(even) td { background: #F8FDFC; }
    .row-label { padding: 5px 10px; color: #333; }
    .row-value { padding: 5px 10px; font-weight: 600; }
    .row-value.free { color: #0F6E56; }
    .row-value.warn { color: #854F0B; }
    .plan-footnote { font-size: 8pt; color: #666; font-style: italic; padding: 7px 12px; background: #F8FDFC; border-top: 1px solid #C9E8E7; line-height: 1.4; }

    /* Info table */
    .info-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0; }
    .info-table td { padding: 5px 10px; border: 1px solid #C9E8E7; vertical-align: top; }
    .info-table td:first-child { background: #F0FAF9; font-weight: 600; width: 45%; color: #496B80; }

    /* Footer */
    .spd-footer { border-top: 2px solid #C9E8E7; margin-top: 0.3in; padding-top: 10px; font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; color: #888; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>

  <div class="screen-header">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="/logowhite.png" alt="KIAA" style="height:26px;width:26px;object-fit:contain;filter:brightness(0) invert(1);"/>
      <div>
      <div class="brand">KIAA Connect</div>
      <div class="doc-name">SPD — ${company.name}</div>
    </div>
    <div class="screen-actions">
      <button class="btn-print" onclick="window.print()">&#128438; Print / Save PDF</button>
    </div>
  </div>

  <div class="document">

    <div class="cover">
      <div class="cover-org">Kanoelehua Industrial Area Association</div>
      <div class="cover-company">${company.name}</div>
      <div class="cover-title">Summary Plan Description</div>
      <div class="cover-subtitle">${coverSubtitle}</div>
      <div class="cover-subtitle">Plan Year: ${planYear || 'October 1, 2025 – September 30, 2026'}</div>
      <hr class="cover-divider">
      <div class="cover-meta">
        <table>
          <tr><td>Plan sponsor</td><td>${company.name}</td></tr>
          <tr><td>Employees</td><td>${company.employee_count || '—'}</td></tr>
          ${addressLine ? `<tr><td>Address</td><td>${addressLine}</td></tr>` : ''}
          <tr><td>Plan administrator</td><td>${company.contact_name || '[HR Contact]'}</td></tr>
          ${company.contact_email ? `<tr><td>Administrator email</td><td>${company.contact_email}</td></tr>` : ''}
          ${company.contact_phone ? `<tr><td>Administrator phone</td><td>${company.contact_phone}</td></tr>` : ''}
          <tr><td>Insurance carrier</td><td>Hawaii Medical Service Association (HMSA)</td></tr>
          <tr><td>HMSA member services</td><td>1-800-776-4672  |  www.hmsa.com</td></tr>
          <tr><td>Plans enrolled</td><td>${planNames.length ? planNames.join(', ') : 'Not specified'}</td></tr>
          <tr><td>Document generated</td><td>${generatedDate}</td></tr>
        </table>
      </div>
      <div class="cover-notice">
        This Summary Plan Description is intended to provide a plain-language overview of your health benefits.
        In the event of a conflict between this document and the official HMSA plan documents, the official
        plan documents will govern. This document does not constitute a contract of employment.
      </div>
    </div>

    <section class="spd-section avoid-break">
      <h2 class="section-title">1. Plan information</h2>
      <table class="info-table">
        <tr><td>Plan sponsor / employer</td><td>${company.name}</td></tr>
        <tr><td>Insurance carrier</td><td>Hawaii Medical Service Association (HMSA) | 1-800-776-4672 | www.hmsa.com</td></tr>
        <tr><td>Plan year</td><td>${planYear || 'October 1, 2025 – September 30, 2026'}</td></tr>
        <tr><td>Plan administrator</td><td>${company.contact_name || '[HR Contact]'}${company.contact_email ? ' | ' + company.contact_email : ''}${company.contact_phone ? ' | ' + company.contact_phone : ''}</td></tr>
        <tr><td>Plans offered</td><td>${planNames.length ? planNames.join(', ') : 'Not specified'}</td></tr>
        <tr><td>HMSA appeals</td><td>HMSA Member Advocacy and Appeals | P.O. Box 1958, Honolulu, HI 96805-1958 | appeals@hmsa.com | (808) 948-5090</td></tr>
        <tr><td>ERISA plan year</td><td>${erisPlanYear}</td></tr>
      </table>
    </section>

    ${eligibilityHtml}
    ${glanceHtml}
    ${plansHtml}
    ${cobraHtml}
    ${fmlaHtml}
    ${erisakHtml}
    ${hipaaHtml}
    ${claimsHtml}

    <div class="spd-footer">
      This Summary Plan Description is provided for informational purposes only and does not constitute
      a contract of employment. In the event of any conflict between this document and the official HMSA
      plan documents, the official plan documents govern. Generated by KIAA Connect on ${generatedDate}.
      &nbsp;|&nbsp; Kanoelehua Industrial Area Association &nbsp;|&nbsp; HMSA ${isAca ? 'ACA Small Group' : 'Group'} Health Plan
      ${footerPlanYear ? `&nbsp;|&nbsp; ${footerPlanYear}` : ''}
    </div>

  </div>
</body>
</html>`
}
