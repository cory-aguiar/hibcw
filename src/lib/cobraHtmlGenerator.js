/**
 * COBRA Notice HTML Generator
 * Produces two federally compliant COBRA notices:
 *   1. General / Initial Notice (required within 90 days of coverage start)
 *   2. Election Notice (required within 14 days of a qualifying event)
 *
 * Legal basis: ERISA §606, 29 CFR §2590.606, DOL model notices
 */

// ── Shared CSS ────────────────────────────────────────────────
const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Georgia', serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: #fff;
  }

  @page {
    size: letter portrait;
    margin: 1in 1in 1in 1in;
  }
  @page {
    @top-center {
      content: "COBRA Continuation Coverage Notice — Confidential";
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 8pt;
      color: #999;
    }
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 8pt;
      color: #999;
    }
  }

  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
  .page-break  { page-break-before: always; break-before: page; }

  .screen-header {
    background: #385262;
    color: #fff;
    padding: 12px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: 'DM Sans', system-ui, sans-serif;
  }
  .screen-header .brand { font-size: 13px; font-weight: 700; color: #6595B2; }
  .screen-header .doc-name { font-size: 11px; opacity: 0.8; margin-top: 1px; }
  .btn-print {
    background: #6595B2; color: #385262; border: none;
    padding: 7px 18px; border-radius: 6px; font-size: 12px;
    font-weight: 700; cursor: pointer; font-family: 'DM Sans', system-ui, sans-serif;
  }
  .btn-print:hover { background: #84AAC1; }
  @media print { .screen-header { display: none; } }

  .document {
    max-width: 7.5in;
    margin: 0 auto;
    padding: 0.4in 0.85in 0.5in;
  }
  @media print { .document { padding: 0; max-width: none; } }

  /* ── Letterhead ── */
  .letterhead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 14px;
    margin-bottom: 16px;
    border-bottom: 2px solid #496B80;
  }
  .letterhead-left .org {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 8.5pt;
    color: #496B80;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 3px;
  }
  .letterhead-left .company {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 14pt;
    font-weight: 700;
    color: #385262;
    line-height: 1.2;
  }
  .letterhead-left .address {
    font-size: 9pt;
    color: #555;
    margin-top: 4px;
    line-height: 1.5;
  }
  .letterhead-right {
    text-align: right;
    font-size: 9pt;
    color: #555;
    line-height: 1.6;
  }
  .letterhead-right .notice-type {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 10pt;
    font-weight: 700;
    color: #496B80;
    margin-bottom: 3px;
  }

  /* ── Important notice box ── */
  .notice-box {
    background: #FFF8E7;
    border: 1.5px solid #EF9F27;
    border-left: 5px solid #EF9F27;
    border-radius: 4px;
    padding: 10px 14px;
    margin-bottom: 16px;
    font-size: 9.5pt;
    line-height: 1.5;
  }
  .notice-box strong { color: #633806; }
  .notice-box.deadline {
    background: #FCEBEB;
    border-color: #E24B4A;
    border-left-color: #E24B4A;
  }
  .notice-box.deadline strong { color: #501313; }
  .notice-box.info {
    background: #EDF2F6;
    border-color: #6595B2;
    border-left-color: #496B80;
  }

  /* ── Address block ── */
  .date-line { margin-bottom: 14px; font-size: 10.5pt; }
  .address-block { margin-bottom: 18px; line-height: 1.7; }
  .address-block .re {
    font-weight: bold;
    margin-top: 14px;
    margin-bottom: 4px;
    font-size: 10.5pt;
  }

  /* ── Body text ── */
  h2 {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 11pt;
    font-weight: 700;
    color: #385262;
    border-bottom: 1px solid #C9E8E7;
    padding-bottom: 3px;
    margin: 18px 0 8px;
    page-break-after: avoid;
    break-after: avoid;
  }
  p { margin-bottom: 9px; }
  p:last-child { margin-bottom: 0; }
  ul, ol { padding-left: 20px; margin-bottom: 9px; }
  li { margin-bottom: 4px; }

  /* ── Tables ── */
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 10pt;
  }
  .info-table td {
    padding: 5px 10px;
    border: 1px solid #C9E8E7;
    vertical-align: top;
  }
  .info-table td:first-child {
    background: #F0FAF9;
    font-weight: bold;
    width: 42%;
    color: #496B80;
  }

  /* ── Signature block ── */
  .signature-block {
    margin-top: 28px;
    padding-top: 14px;
    border-top: 1px solid #C9E8E7;
  }
  .sig-line {
    border-top: 1px solid #333;
    width: 2.8in;
    margin-top: 40px;
    margin-bottom: 4px;
  }
  .sig-label { font-size: 9.5pt; color: #555; }

  /* ── Footer disclaimer ── */
  .doc-footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #C9E8E7;
    font-size: 8pt;
    color: #888;
    line-height: 1.5;
    font-style: italic;
  }

  /* ── Election form ── */
  .election-form {
    border: 2px solid #496B80;
    border-radius: 6px;
    padding: 16px 20px;
    margin-top: 24px;
  }
  .election-form h3 {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 11pt;
    font-weight: 700;
    color: #385262;
    margin-bottom: 12px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .form-field {
    border-bottom: 1px solid #333;
    min-height: 22px;
    margin-bottom: 12px;
    display: block;
    width: 100%;
  }
  .form-row {
    display: flex;
    gap: 20px;
    margin-bottom: 12px;
  }
  .form-row .form-group { flex: 1; }
  .form-group label {
    font-size: 9pt;
    color: #555;
    display: block;
    margin-bottom: 2px;
  }
  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 10pt;
  }
  .checkbox-row input[type="checkbox"] {
    margin-top: 2px;
    flex-shrink: 0;
    width: 14px;
    height: 14px;
  }
  .return-address {
    background: #F0FAF9;
    border: 1px solid #C9E8E7;
    border-radius: 4px;
    padding: 8px 12px;
    margin-top: 12px;
    font-size: 9.5pt;
    color: #333;
  }
`

// ── Address block builder ────────────────────────────────────
function companyAddress(company) {
  const parts = [
    company.address_line1,
    company.address_line2,
    [company.city, company.state, company.zip].filter(Boolean).join(', ')
  ].filter(Boolean)
  return parts.join('<br>')
}

// ── Qualifying event labels ───────────────────────────────────
export const QUALIFYING_EVENTS = [
  { value: 'termination',       label: 'Termination of employment (other than for gross misconduct)' },
  { value: 'reduction',         label: 'Reduction in hours below eligibility threshold' },
  { value: 'death',             label: 'Death of the covered employee' },
  { value: 'divorce',           label: 'Divorce or legal separation from the covered employee' },
  { value: 'medicare',          label: 'Covered employee becoming entitled to Medicare' },
  { value: 'dependent_age',     label: 'Dependent child losing eligibility (age 26)' },
  { value: 'bankruptcy',        label: 'Employer bankruptcy (retiree coverage)' },
]

export const COBRA_DURATIONS = {
  termination:   '18 months',
  reduction:     '18 months',
  death:         '36 months',
  divorce:       '36 months',
  medicare:      '36 months',
  dependent_age: '36 months',
  bankruptcy:    '36 months',
}

// ════════════════════════════════════════════════════════════
// 1. GENERAL / INITIAL NOTICE
// ════════════════════════════════════════════════════════════
export function generateCobraInitialNoticeHtml({ company, planList, noticeDate, generatedDate }) {
  const addressLine = companyAddress(company)
  const planNames   = planList.map(p => p.name).join(', ') || 'HMSA Group Health Plan'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>COBRA Initial Notice — ${company.name}</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="screen-header">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="/logowhite.png" alt="KIAA" style="height:26px;width:26px;object-fit:contain;filter:brightness(0) invert(1);"/>
      <div>
      <div class="brand">KIAA Connect</div>
      <div class="doc-name">COBRA General Notice — ${company.name}</div>
    </div>
    <button class="btn-print" onclick="window.print()">&#128438; Print / Save PDF</button>
  </div>

  <div class="document">

    <!-- Letterhead -->
    <div class="letterhead avoid-break">
      <div class="letterhead-left">
        <img src="/logowhite.png" alt="KIAA" style="height:28px;margin-bottom:4px;filter:brightness(0) saturate(100%) invert(18%) sepia(28%) saturate(800%) hue-rotate(185deg) brightness(85%);display:block;"/>
        <div class="org">Kanoelehua Industrial Area Association</div>
        <div class="company">${company.name}</div>
        ${addressLine ? `<div class="address">${addressLine}</div>` : ''}
        ${company.contact_phone ? `<div class="address">${company.contact_phone}</div>` : ''}
        ${company.contact_email ? `<div class="address">${company.contact_email}</div>` : ''}
      </div>
      <div class="letterhead-right">
        <div class="notice-type">COBRA General Notice</div>
        <div>Date: ${noticeDate}</div>
        <div>Re: Continuation Coverage Rights</div>
        <div style="margin-top:6px;font-size:8.5pt;color:#496B80;font-weight:bold;">ERISA § 606 Notice</div>
      </div>
    </div>

    <!-- Important notice -->
    <div class="notice-box info avoid-break">
      <strong>IMPORTANT: Please read this notice carefully and keep it for future reference.</strong>
      This notice contains important information about your right to continue your health care coverage
      under the Consolidated Omnibus Budget Reconciliation Act (COBRA) when coverage under the group
      health plan would otherwise end.
    </div>

    <!-- Salutation -->
    <p>Dear Plan Participant and/or Covered Dependent:</p>

    <p>You are receiving this notice because you have recently become covered under a group health plan
    (the Plan) sponsored by <strong>${company.name}</strong> (the Employer). This notice contains
    important information about your right to COBRA continuation coverage, which is a temporary extension
    of coverage under the Plan.</p>

    <!-- Section 1 -->
    <h2>What is COBRA Continuation Coverage?</h2>
    <p>COBRA continuation coverage is a continuation of Plan coverage when it would otherwise end
    because of a life event known as a "qualifying event." Specific qualifying events are listed later
    in this notice. After a qualifying event, COBRA continuation coverage must be offered to each
    person who is a "qualified beneficiary." You, your spouse, and your dependent children could become
    qualified beneficiaries if coverage under the Plan is lost because of the qualifying event.</p>

    <p>Under the Plan, qualified beneficiaries who elect COBRA continuation coverage must pay for COBRA
    continuation coverage. COBRA continuation coverage is the same coverage that the Plan gives to other
    participants or beneficiaries not receiving COBRA continuation coverage. Each qualified beneficiary
    who elects COBRA continuation coverage will have the same rights under the Plan as other participants
    or beneficiaries covered under the Plan, including open enrollment rights.</p>

    <!-- Section 2 -->
    <h2>How Long Will COBRA Continuation Coverage Last?</h2>
    <p>COBRA continuation coverage is a temporary continuation of coverage that generally lasts for a
    maximum period of time based on the qualifying event:</p>
    <ul>
      <li><strong>18 months</strong> — if coverage is lost due to a covered employee's termination of
      employment (for reasons other than gross misconduct) or reduction in hours of employment</li>
      <li><strong>36 months</strong> — for all other qualifying events (death of covered employee,
      divorce or legal separation, employee's entitlement to Medicare, or a dependent child's loss of
      eligibility)</li>
    </ul>
    <p>There are also circumstances in which the continuation period may be extended. These are
    described below.</p>

    <p><strong>Disability Extension (11 additional months):</strong> If you or anyone in your family
    covered under the Plan is determined by the Social Security Administration (SSA) to be disabled and
    you notify the Plan Administrator in a timely fashion, you and your entire family may be entitled to
    get up to an additional 11 months of COBRA continuation coverage, for a maximum of 29 months. The
    disability would have to have started at some time before the 60th day of COBRA continuation coverage
    and must last at least until the end of the 18-month period of continuation coverage.</p>

    <p><strong>Second Qualifying Event Extension (18 additional months):</strong> If your family
    experiences another qualifying event during the 18 months of COBRA continuation coverage, the spouse
    and dependent children in your family can get up to 18 additional months of COBRA continuation
    coverage, for a maximum of 36 months, if the Plan is properly notified about the second qualifying
    event.</p>

    <!-- Section 3 -->
    <h2>What is a Qualifying Event?</h2>
    <p>When your employment ends or your hours of work are reduced, you have a qualifying event. Other
    qualifying events may affect your spouse or dependent children. A qualifying event occurs if loss of
    coverage under the Plan results from one of the following events:</p>
    <ul>
      <li>The covered employee's termination of employment for any reason other than gross misconduct</li>
      <li>The covered employee's reduction in hours of employment</li>
      <li>The covered employee's death</li>
      <li>The covered employee's divorce or legal separation</li>
      <li>The covered employee's entitlement to Medicare benefits (under Part A, Part B, or both)</li>
      <li>A dependent child's loss of dependent status under the Plan (e.g., reaching age 26)</li>
      <li>The covered employee's bankruptcy (for retiree coverage only)</li>
    </ul>

    <!-- Section 4 -->
    <h2>Who Can Elect COBRA Continuation Coverage?</h2>
    <p>Each qualified beneficiary will independently have the option of electing COBRA continuation
    coverage. Qualified beneficiaries include:</p>
    <ul>
      <li>The covered employee</li>
      <li>The covered employee's spouse (if covered under the Plan)</li>
      <li>The covered employee's dependent children (if covered under the Plan)</li>
      <li>A child born to or placed for adoption with the covered employee during COBRA continuation
      coverage</li>
    </ul>

    <!-- Section 5 -->
    <h2>How Much Does COBRA Continuation Coverage Cost?</h2>
    <p>Generally, each qualified beneficiary may be required to pay the entire cost of COBRA continuation
    coverage. The amount a qualified beneficiary may be required to pay may not exceed 102 percent
    (or, in the case of an extension of continuation coverage due to a disability, 150 percent) of the
    cost to the group health plan (including both employer and employee contributions) for coverage of a
    similarly situated plan participant or beneficiary who is not receiving continuation coverage.</p>

    <p>The current premium amounts for COBRA continuation coverage under this Plan are available from
    the Plan Administrator. You will be notified of the applicable premium at the time you are given
    the opportunity to elect continuation coverage.</p>

    <!-- Section 6 -->
    <h2>How Can You Elect COBRA Continuation Coverage?</h2>
    <p>To elect continuation coverage, you must complete the Election Form and submit it to
    <strong>${company.name}</strong> at the address shown above. The Election Form is included with
    the COBRA Election Notice, which you will receive if a qualifying event occurs.</p>

    <p>If you do not elect COBRA continuation coverage, your coverage under the Plan will end on the
    date of the qualifying event or the date otherwise provided under the terms of the Plan.</p>

    <!-- Section 7 -->
    <h2>Your Responsibility to Notify the Plan Administrator</h2>
    <p>For some qualifying events, you must notify the Plan Administrator. <strong>You must notify the
    Plan Administrator within 60 days</strong> if the following qualifying events occur:</p>
    <ul>
      <li>Divorce or legal separation of the covered employee and spouse</li>
      <li>A dependent child's loss of eligibility under the Plan</li>
      <li>A Social Security Administration disability determination (for the disability extension)</li>
      <li>A second qualifying event during COBRA continuation coverage</li>
    </ul>
    <p>Notify the Plan Administrator in writing at the address shown above. Failure to provide timely
    notice may result in the loss of COBRA rights for you and your dependents.</p>

    <!-- Section 8 -->
    <h2>COBRA and Other Coverage Options</h2>
    <p>Instead of enrolling in COBRA continuation coverage, there may be other coverage options for you
    and your family through the Health Insurance Marketplace, Medicaid, or other group health plan
    coverage options (such as a spouse's plan) that may cost less than COBRA continuation coverage.
    When you lose job-based health coverage, it's a special enrollment period, which means you have a
    limited time — generally 60 days — to enroll in Marketplace coverage.</p>
    <p>For more information about the Health Insurance Marketplace, visit
    <strong>www.HealthCare.gov</strong> or call 1-800-318-2596.</p>

    <!-- Section 9 -->
    <h2>Plan Information</h2>
    <table class="info-table avoid-break">
      <tr><td>Plan name</td><td>${company.name} HMSA Group Health Plan</td></tr>
      <tr><td>Plans offered</td><td>${planNames}</td></tr>
      <tr><td>Plan administrator</td><td>${company.contact_name || company.name}</td></tr>
      <tr><td>Administrator address</td><td>${addressLine || '[Company address]'}</td></tr>
      <tr><td>Administrator phone</td><td>${company.contact_phone || '[Phone number]'}</td></tr>
      <tr><td>Administrator email</td><td>${company.contact_email || '[Email address]'}</td></tr>
      <tr><td>Insurance carrier</td><td>Hawaii Medical Service Association (HMSA) | 1-800-776-4672</td></tr>
      <tr><td>Plan year</td><td>${planYear || 'October 1, 2025 – September 30, 2026'}</td></tr>
    </table>

    <!-- Section 10 -->
    <h2>For More Information</h2>
    <p>This notice does not fully describe continuation coverage or other rights under the Plan. More
    information about continuation coverage and your rights under the Plan is available in the Summary
    Plan Description or from the Plan Administrator.</p>

    <p>For more information about your rights under ERISA, including COBRA, the Health Insurance
    Portability and Accountability Act (HIPAA), and other laws affecting group health plans, contact
    the nearest Regional or District Office of the U.S. Department of Labor's Employee Benefits Security
    Administration (EBSA) in your area or visit <strong>www.dol.gov/ebsa</strong>. For assistance,
    call 1-866-444-3272.</p>

    <p>You may also contact the Hawaii Insurance Division at (808) 586-2790 for information about
    your rights under Hawaii state law.</p>

    <!-- Signature -->
    <div class="signature-block avoid-break">
      <p>Sincerely,</p>
      <div class="sig-line"></div>
      <div class="sig-label">${company.contact_name || 'Plan Administrator'}</div>
      <div class="sig-label">${company.name}</div>
      ${company.contact_phone ? `<div class="sig-label">${company.contact_phone}</div>` : ''}
    </div>

    <div class="doc-footer">
      This General COBRA Notice is provided pursuant to ERISA § 606 and 29 CFR § 2590.606-1.
      Generated by KIAA Connect on ${generatedDate}. This document does not constitute legal advice.
      Employers should consult qualified legal counsel to ensure compliance with applicable federal
      and state law.
    </div>
  </div>
</body>
</html>`
}

// ════════════════════════════════════════════════════════════
// 2. COBRA ELECTION NOTICE
// ════════════════════════════════════════════════════════════
export function generateCobraElectionNoticeHtml({
  company, planList,
  participant, // { name, address, city, state, zip, dependents: [] }
  qualifyingEvent, // value from QUALIFYING_EVENTS
  eventDate,
  coverageLostDate,
  electionDeadline,
  noticeDate,
  generatedDate,
}) {
  const addressLine   = companyAddress(company)
  const planNames     = planList.map(p => p.name).join(', ') || 'HMSA Group Health Plan'
  const eventLabel    = QUALIFYING_EVENTS.find(e => e.value === qualifyingEvent)?.label || qualifyingEvent
  const duration      = COBRA_DURATIONS[qualifyingEvent] || '18 months'
  const maxEndDate    = coverageLostDate ? `(coverage ends by ${coverageLostDate} plus ${duration})` : ''
  const participantAddress = [
    participant?.address,
    [participant?.city, participant?.state, participant?.zip].filter(Boolean).join(', ')
  ].filter(Boolean).join('<br>')

  const dependentRows = (participant?.dependents || []).map(d =>
    `<tr><td>${d.name || ''}</td><td>${d.relationship || ''}</td><td>${d.dob || ''}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>COBRA Election Notice — ${company.name} — ${participant?.name || 'Participant'}</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="screen-header">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="/logowhite.png" alt="KIAA" style="height:26px;width:26px;object-fit:contain;filter:brightness(0) invert(1);"/>
      <div>
      <div class="brand">KIAA Connect</div>
      <div class="doc-name">COBRA Election Notice — ${participant?.name || 'Participant'}</div>
    </div>
    <button class="btn-print" onclick="window.print()">&#128438; Print / Save PDF</button>
  </div>

  <div class="document">

    <!-- Letterhead -->
    <div class="letterhead avoid-break">
      <div class="letterhead-left">
        <img src="/logowhite.png" alt="KIAA" style="height:28px;margin-bottom:4px;filter:brightness(0) saturate(100%) invert(18%) sepia(28%) saturate(800%) hue-rotate(185deg) brightness(85%);display:block;"/>
        <div class="org">Kanoelehua Industrial Area Association</div>
        <div class="company">${company.name}</div>
        ${addressLine ? `<div class="address">${addressLine}</div>` : ''}
        ${company.contact_phone ? `<div class="address">${company.contact_phone}</div>` : ''}
        ${company.contact_email ? `<div class="address">${company.contact_email}</div>` : ''}
      </div>
      <div class="letterhead-right">
        <div class="notice-type">COBRA Election Notice</div>
        <div>Date: ${noticeDate}</div>
        <div style="margin-top:6px;font-size:8.5pt;color:#496B80;font-weight:bold;">ERISA § 606 Notice</div>
      </div>
    </div>

    <!-- Addressee -->
    <div class="address-block">
      <div>${participant?.name || '[Participant Name]'}</div>
      ${participantAddress ? `<div>${participantAddress}</div>` : '<div>[Address]</div>'}
    </div>

    <!-- Deadline warning -->
    <div class="notice-box deadline avoid-break">
      <strong>IMPORTANT — TIME-SENSITIVE NOTICE:</strong> You have <strong>60 days</strong> from the
      date of this notice (or the date your coverage ends, whichever is later) to elect COBRA
      continuation coverage. Your election deadline is: <strong>${electionDeadline || '[Election Deadline Date]'}</strong>.
      If you do not elect COBRA by this deadline, you will lose your right to continuation coverage.
    </div>

    <!-- Salutation -->
    <p>Dear ${participant?.name || 'Plan Participant and/or Covered Dependent'},</p>

    <p>This notice is to inform you that your group health coverage under the <strong>${company.name}
    HMSA Group Health Plan</strong> will end or has ended as a result of a qualifying event.
    You have the right to elect COBRA continuation coverage under the Plan.</p>

    <!-- Qualifying event details -->
    <h2>Qualifying Event Information</h2>
    <table class="info-table avoid-break">
      <tr><td>Qualifying event</td><td>${eventLabel}</td></tr>
      <tr><td>Date of qualifying event</td><td>${eventDate || '[Date of Event]'}</td></tr>
      <tr><td>Date coverage ends / ended</td><td>${coverageLostDate || '[Coverage End Date]'}</td></tr>
      <tr><td>Maximum coverage period</td><td>${duration} ${maxEndDate}</td></tr>
      <tr><td>Election deadline</td><td><strong>${electionDeadline || '[60 days from notice date]'}</strong></td></tr>
    </table>

    <!-- Qualified beneficiaries -->
    <h2>Qualified Beneficiaries</h2>
    <p>The following individuals are qualified beneficiaries entitled to elect COBRA continuation
    coverage under this notice:</p>
    <table class="info-table">
      <thead>
        <tr>
          <td style="background:#496B80;color:#fff;font-weight:700">Name</td>
          <td style="background:#496B80;color:#fff;font-weight:700">Relationship</td>
          <td style="background:#496B80;color:#fff;font-weight:700">Date of birth</td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${participant?.name || '[Employee name]'}</td>
          <td>Employee</td>
          <td>${participant?.dob || '—'}</td>
        </tr>
        ${dependentRows}
      </tbody>
    </table>

    <!-- Plans available -->
    <h2>Coverage Available Under COBRA</h2>
    <p>You may elect to continue the same coverage you had under the Plan immediately before the
    qualifying event. The following plans are available for COBRA continuation:</p>
    <table class="info-table avoid-break">
      ${planList.map(p => `
        <tr>
          <td>${p.name}</td>
          <td>${p.type} — Deductible: ${p.deductible} | OOP Max: ${p.oopMedical} | PCP: ${p.pcp}</td>
        </tr>`).join('')}
    </table>
    <p style="margin-top:8px">Contact the Plan Administrator or HMSA at 1-800-776-4672 for current
    COBRA premium amounts for each plan option.</p>

    <!-- Cost -->
    <h2>Cost of COBRA Continuation Coverage</h2>
    <p>You will be required to pay the full cost of COBRA continuation coverage, which may not exceed
    102% of the applicable premium (or 150% during a disability extension). Current COBRA premium
    rates are available from the Plan Administrator at the contact information above.</p>
    <p>Your first COBRA premium payment will cover the period from <strong>${coverageLostDate || 'the date coverage ended'}</strong>
    through the end of that month (and any subsequent months for which you have not yet paid). You
    must make your first payment within <strong>45 days</strong> after the date of your election.
    After the first payment, premiums are due on the first of each month.</p>

    <!-- How to elect -->
    <h2>How to Elect COBRA Continuation Coverage</h2>
    <p>To elect COBRA continuation coverage, complete the Election Form attached to this notice and
    return it to the Plan Administrator at the address above no later than
    <strong>${electionDeadline || '[Election Deadline]'}</strong>.</p>
    <ul>
      <li>Each qualified beneficiary may independently elect COBRA</li>
      <li>A covered employee or the employee's spouse may elect on behalf of all qualified beneficiaries</li>
      <li>A parent or legal guardian may elect on behalf of a minor dependent child</li>
    </ul>
    <p>If you waive COBRA continuation coverage before the election deadline, you may revoke your
    waiver and elect coverage at any time before the deadline. Coverage will be reinstated retroactively
    to the date coverage was lost.</p>

    <!-- Other options -->
    <h2>Other Coverage Options</h2>
    <p>Instead of electing COBRA, you may be eligible for other coverage options:</p>
    <ul>
      <li><strong>Health Insurance Marketplace:</strong> Visit www.HealthCare.gov or call 1-800-318-2596.
      Losing job-based coverage is a special enrollment event (60-day window).</li>
      <li><strong>Medicaid:</strong> You may qualify based on income. Visit www.medicaid.gov.</li>
      <li><strong>Spouse's plan:</strong> You may be able to enroll in a spouse's employer plan
      within 30 days of losing coverage.</li>
    </ul>

    <!-- Important notices -->
    <h2>Your Responsibilities During COBRA</h2>
    <p>While enrolled in COBRA continuation coverage, you must notify the Plan Administrator within
    30 days if any of the following occur:</p>
    <ul>
      <li>You become covered under another group health plan</li>
      <li>You become entitled to Medicare</li>
      <li>You experience a second qualifying event (divorce, dependent aging out, etc.)</li>
      <li>A Social Security Administration disability determination is made or ends</li>
    </ul>

    <!-- Contacts -->
    <h2>Contacts &amp; Resources</h2>
    <table class="info-table avoid-break">
      <tr><td>Plan Administrator</td><td>${company.contact_name || company.name} | ${company.contact_phone || ''} | ${company.contact_email || ''}</td></tr>
      <tr><td>HMSA Member Services</td><td>1-800-776-4672 | www.hmsa.com</td></tr>
      <tr><td>HMSA Appeals</td><td>appeals@hmsa.com | (808) 948-5090</td></tr>
      <tr><td>DOL / EBSA</td><td>1-866-444-3272 | www.dol.gov/ebsa</td></tr>
      <tr><td>Hawaii Insurance Division</td><td>(808) 586-2790</td></tr>
      <tr><td>Health Insurance Marketplace</td><td>1-800-318-2596 | www.HealthCare.gov</td></tr>
    </table>

    <!-- Signature -->
    <div class="signature-block avoid-break">
      <p>Sincerely,</p>
      <div class="sig-line"></div>
      <div class="sig-label">${company.contact_name || 'Plan Administrator'}</div>
      <div class="sig-label">${company.name}</div>
      ${company.contact_phone ? `<div class="sig-label">${company.contact_phone}</div>` : ''}
    </div>

    <!-- ── ELECTION FORM (detachable) ── -->
    <div class="page-break"></div>

    <div class="election-form">
      <h3>COBRA Continuation Coverage Election Form</h3>
      <p style="font-size:9.5pt;text-align:center;margin-bottom:14px;color:#555">
        Complete and return this form to the Plan Administrator no later than
        <strong>${electionDeadline || '[Election Deadline]'}</strong>
      </p>

      <div class="form-row">
        <div class="form-group">
          <label>Employee / Participant name</label>
          <span class="form-field">&nbsp;</span>
        </div>
        <div class="form-group">
          <label>Date of qualifying event</label>
          <span class="form-field">&nbsp;</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Mailing address</label>
          <span class="form-field">&nbsp;</span>
        </div>
        <div class="form-group">
          <label>Phone number</label>
          <span class="form-field">&nbsp;</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>City</label>
          <span class="form-field">&nbsp;</span>
        </div>
        <div class="form-group" style="flex:0.4">
          <label>State</label>
          <span class="form-field">&nbsp;</span>
        </div>
        <div class="form-group" style="flex:0.6">
          <label>ZIP code</label>
          <span class="form-field">&nbsp;</span>
        </div>
      </div>

      <p style="font-size:9.5pt;font-weight:bold;margin:12px 0 8px">
        I elect COBRA continuation coverage for the following individuals:
      </p>
      ${['Employee / Self', 'Spouse / Domestic partner', 'Dependent child(ren) — list names below'].map(label => `
        <div class="checkbox-row">
          <input type="checkbox"> <span>${label}</span>
        </div>`).join('')}
      <div style="margin:6px 0 12px">
        <label style="font-size:9pt;color:#555">Dependent child name(s)</label>
        <span class="form-field">&nbsp;</span>
      </div>

      <p style="font-size:9.5pt;font-weight:bold;margin:12px 0 8px">
        Plan option selected:
      </p>
      ${planList.map(p => `
        <div class="checkbox-row">
          <input type="checkbox"> <span>${p.name} (${p.type})</span>
        </div>`).join('')}

      <div class="form-row" style="margin-top:16px">
        <div class="form-group">
          <label>Signature</label>
          <span class="form-field">&nbsp;</span>
        </div>
        <div class="form-group">
          <label>Date signed</label>
          <span class="form-field">&nbsp;</span>
        </div>
      </div>

      <div class="return-address">
        <strong>Return completed form to:</strong><br>
        ${company.contact_name || 'Plan Administrator'} — ${company.name}<br>
        ${addressLine || '[Company address]'}<br>
        ${company.contact_phone ? `Phone: ${company.contact_phone}<br>` : ''}
        ${company.contact_email ? `Email: ${company.contact_email}` : ''}
      </div>
    </div>

    <div class="doc-footer">
      This COBRA Election Notice is provided pursuant to ERISA § 606 and 29 CFR § 2590.606-4.
      Generated by KIAA Connect on ${generatedDate}. This document does not constitute legal advice.
      Employers should consult qualified legal counsel to ensure COBRA compliance.
    </div>

  </div>
</body>
</html>`
}
