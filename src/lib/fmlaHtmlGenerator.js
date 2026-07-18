/**
 * FMLA Notice HTML Generator
 * Produces all four federally required FMLA notices:
 *   1. General Notice / WH-1420 (always posted; included in handbook)
 *   2. Eligibility & Rights Notice / WH-381 (within 5 business days of leave request)
 *   3. Designation Notice / WH-382 (within 5 business days of sufficient information)
 *   4. Medical Certification Request (within 5 business days; employee has 15 days to return)
 *
 * Legal basis: FMLA § 825.300, 29 CFR § 825.300–825.305, DOL model notices
 */

// ── Shared CSS ────────────────────────────────────────────────
const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Georgia', serif;
    font-size: 11pt; line-height: 1.6; color: #1a1a1a; background: #fff;
  }
  @page {
    size: letter portrait;
    margin: 1in 1in 1in 1in;
    @top-center {
      content: "FMLA Notice — Confidential";
      font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; color: #999;
    }
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: 'DM Sans', system-ui, sans-serif; font-size: 8pt; color: #999;
    }
  }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
  .page-break  { page-break-before: always; break-before: page; }
  .screen-header {
    background: #385262; color: #fff; padding: 12px 28px;
    display: flex; align-items: center; justify-content: space-between;
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
  .document { max-width: 7.5in; margin: 0 auto; padding: 0.4in 0.85in 0.5in; background: #fff; }
  @media print { .document { padding: 0; max-width: none; } }
  .letterhead {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding-bottom: 14px; margin-bottom: 16px; border-bottom: 2px solid #496B80;
  }
  .letterhead-left .org {
    font-family: 'DM Sans', system-ui, sans-serif; font-size: 8.5pt; color: #496B80;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px;
  }
  .letterhead-left .company {
    font-family: 'DM Sans', system-ui, sans-serif; font-size: 14pt; font-weight: 700;
    color: #385262; line-height: 1.2;
  }
  .letterhead-left .address { font-size: 9pt; color: #555; margin-top: 4px; line-height: 1.5; }
  .letterhead-right { text-align: right; font-size: 9pt; color: #555; line-height: 1.6; }
  .letterhead-right .notice-type {
    font-family: 'DM Sans', system-ui, sans-serif; font-size: 10pt; font-weight: 700; color: #496B80; margin-bottom: 3px;
  }
  .notice-box {
    background: #FFF8E7; border: 1.5px solid #EF9F27; border-left: 5px solid #EF9F27;
    border-radius: 4px; padding: 10px 14px; margin-bottom: 16px;
    font-size: 9.5pt; line-height: 1.5;
  }
  .notice-box strong { color: #633806; }
  .notice-box.deadline { background: #FCEBEB; border-color: #E24B4A; border-left-color: #E24B4A; }
  .notice-box.deadline strong { color: #501313; }
  .notice-box.info { background: #EDF2F6; border-color: #6595B2; border-left-color: #496B80; }
  .address-block { margin-bottom: 18px; line-height: 1.7; }
  h2 {
    font-family: 'DM Sans', system-ui, sans-serif; font-size: 11pt; font-weight: 700; color: #385262;
    border-bottom: 1px solid #C9E8E7; padding-bottom: 3px; margin: 16px 0 8px;
    page-break-after: avoid; break-after: avoid;
  }
  p { margin-bottom: 9px; }
  p:last-child { margin-bottom: 0; }
  ul, ol { padding-left: 22px; margin-bottom: 9px; }
  li { margin-bottom: 4px; }
  .info-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  .info-table td { padding: 5px 10px; border: 1px solid #C9E8E7; vertical-align: top; }
  .info-table td:first-child { background: #F0FAF9; font-weight: bold; width: 42%; color: #496B80; }
  .check-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  .check-table td { padding: 6px 10px; border: 1px solid #C9E8E7; vertical-align: top; }
  .check-table td:first-child { width: 24px; text-align: center; }
  .check-table tr:nth-child(even) td { background: #F8FDFC; }
  .sig-block { margin-top: 28px; padding-top: 14px; border-top: 1px solid #C9E8E7; }
  .sig-line { border-top: 1px solid #333; width: 2.8in; margin-top: 36px; margin-bottom: 4px; }
  .sig-label { font-size: 9.5pt; color: #555; }
  .doc-footer {
    margin-top: 24px; padding-top: 10px; border-top: 1px solid #C9E8E7;
    font-size: 8pt; color: #888; line-height: 1.5; font-style: italic;
  }
  .cb { display: inline-block; width: 12px; height: 12px; border: 1px solid #333; margin-right: 4px; vertical-align: middle; }
  .form-line { border-bottom: 1px solid #333; min-height: 20px; margin-bottom: 10px; display: block; }
  .form-row { display: flex; gap: 20px; margin-bottom: 10px; }
  .form-group { flex: 1; }
  .form-group label { font-size: 9pt; color: #555; display: block; margin-bottom: 2px; }
`

// ── Shared letterhead builder ─────────────────────────────────
function letterhead(company, noticeType, noticeDate) {
  const addr = [
    company.address_line1,
    company.address_line2,
    [company.city, company.state, company.zip].filter(Boolean).join(', ')
  ].filter(Boolean).join('<br>')
  return `
    <div class="letterhead avoid-break">
      <div class="letterhead-left">
        <img src="/logowhite.png" alt="KIAA" style="height:28px;margin-bottom:4px;filter:brightness(0) saturate(100%) invert(18%) sepia(28%) saturate(800%) hue-rotate(185deg) brightness(85%);display:block;"/>
        <div class="org">Kanoelehua Industrial Area Association</div>
        <div class="company">${company.name}</div>
        ${addr ? `<div class="address">${addr}</div>` : ''}
        ${company.contact_phone ? `<div class="address">${company.contact_phone}</div>` : ''}
        ${company.contact_email ? `<div class="address">${company.contact_email}</div>` : ''}
      </div>
      <div class="letterhead-right">
        <div class="notice-type">${noticeType}</div>
        <div>Date: ${noticeDate}</div>
        <div style="margin-top:5px;font-size:8.5pt;color:#496B80;font-weight:bold;">29 CFR § 825.300</div>
      </div>
    </div>`
}

function screenHeader(docName) {
  return `
  <div class="screen-header">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="/logowhite.png" alt="KIAA" style="height:26px;width:26px;object-fit:contain;filter:brightness(0) invert(1);"/>
      <div>
      <div class="brand">KIAA Connect</div>
      <div class="doc-name">${docName}</div>
    </div>
    <button class="btn-print" onclick="window.print()">&#128438; Print / Save PDF</button>
  </div>`
}

function docFooter(noticeRef, generatedDate) {
  return `
    <div class="doc-footer">
      ${noticeRef} | Generated by KIAA Connect on ${generatedDate}.
      This document does not constitute legal advice. Employers should consult qualified
      legal counsel to ensure FMLA compliance. DOL model notices available at www.dol.gov/agencies/whd/fmla.
    </div>`
}

// ════════════════════════════════════════════════════════════
// 1. GENERAL NOTICE (WH-1420 equivalent)
// Required: Posted at all worksites + included in employee handbook
// ════════════════════════════════════════════════════════════
export function generateFmlaGeneralNoticeHtml({ company, noticeDate, generatedDate }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>FMLA General Notice — ${company.name}</title>
  <style>${SHARED_CSS}</style></head><body>
  ${screenHeader(`FMLA General Notice — ${company.name}`)}
  <div class="document">
    ${letterhead(company, 'FMLA General Notice', noticeDate)}

    <div class="notice-box info avoid-break">
      <strong>Posting requirement:</strong> This notice must be displayed in a conspicuous place at
      each worksite where FMLA-eligible employees work. It must also be included in any employee
      handbook or written policies provided to employees. Failure to post may extend employee
      notification deadlines.
    </div>

    <h2>Your Rights Under the Family and Medical Leave Act</h2>
    <p>FMLA entitles eligible employees of covered employers to take unpaid, job-protected leave
    for specified family and medical reasons with continuation of group health insurance coverage
    under the same terms and conditions as if the employee had not taken leave.</p>

    <h2>Eligible Employees May Take Up To:</h2>
    <ul>
      <li><strong>12 workweeks of leave</strong> in a 12-month period for:
        <ul>
          <li>The birth of a child and to care for the newborn child within one year of birth</li>
          <li>The placement of a child for adoption or foster care within one year of placement</li>
          <li>To care for the employee's spouse, child, or parent who has a serious health condition</li>
          <li>A serious health condition that makes the employee unable to perform their job</li>
          <li>Any qualifying exigency arising from the employee's spouse, child, or parent being
          a military member on covered active duty</li>
        </ul>
      </li>
      <li><strong>26 workweeks of leave</strong> during a single 12-month period to care for a
      covered servicemember with a serious injury or illness, when the employee is the servicemember's
      spouse, child, parent, or next of kin.</li>
    </ul>

    <h2>Employee Eligibility Requirements</h2>
    <p>An employee is eligible if they have:</p>
    <ul>
      <li>Worked for ${company.name} for at least <strong>12 months</strong></li>
      <li>Worked at least <strong>1,250 hours</strong> during the 12-month period immediately
      before the leave</li>
      <li>Worked at a location where ${company.name} employs at least <strong>50 employees
      within 75 miles</strong></li>
    </ul>

    <h2>Use of Leave</h2>
    <p>FMLA leave may be taken intermittently or on a reduced leave schedule under certain
    circumstances. Employees may also be required to use accrued paid leave while taking FMLA leave,
    in accordance with company policy.</p>

    <h2>Employee Responsibilities</h2>
    <p>Employees must provide 30 days advance notice of the need for FMLA leave when the need is
    foreseeable. When 30 days notice is not possible, notice must be provided as soon as practicable.
    Employees must comply with the employer's normal call-in procedures. ${company.name} may require
    medical certification to support a request for FMLA leave.</p>

    <h2>Employer Responsibilities</h2>
    <p>${company.name} must:</p>
    <ul>
      <li>Inform employees requesting leave whether they are eligible for FMLA leave</li>
      <li>Notify employees of their rights and responsibilities under FMLA</li>
      <li>Notify employees whether the leave will be designated as FMLA-protected</li>
      <li>Maintain group health benefits during FMLA leave on the same terms as if the
      employee had continued to work</li>
      <li>Restore the employee to the same or equivalent position upon return from FMLA leave</li>
    </ul>

    <h2>Unlawful Acts</h2>
    <p>The FMLA prohibits interference with an employee's rights under the law and retaliation
    against employees for exercising or attempting to exercise their FMLA rights.</p>

    <h2>Enforcement</h2>
    <p>Employees may file a complaint with the U.S. Department of Labor, Wage and Hour Division,
    or may bring a private lawsuit against an employer. FMLA does not affect any federal or state
    law prohibiting discrimination or supersede any state or local law which provides greater
    family or medical leave rights.</p>

    <h2>Contact Information</h2>
    <table class="info-table avoid-break">
      <tr><td>Plan Administrator / HR</td><td>${company.contact_name || company.name} | ${company.contact_phone || ''} | ${company.contact_email || ''}</td></tr>
      <tr><td>DOL Wage and Hour Division</td><td>1-866-487-9243 | www.dol.gov/agencies/whd/fmla</td></tr>
      <tr><td>Hawaii DLIR</td><td>(808) 586-8844 | labor.hawaii.gov</td></tr>
    </table>

    ${docFooter('FMLA General Notice | 29 CFR § 825.300(a)', generatedDate)}
  </div></body></html>`
}

// ════════════════════════════════════════════════════════════
// 2. ELIGIBILITY & RIGHTS NOTICE (WH-381 equivalent)
// Required within 5 business days of leave request
// ════════════════════════════════════════════════════════════
export function generateFmlaEligibilityNoticeHtml({
  company, employee, noticeDate, generatedDate,
  isEligible, ineligibleReasons,
  leaveReason, leaveStartDate, leaveEndDate,
  isContinuous, isIntermittent, isReducedSchedule,
  medCertRequired, medCertDueDate,
  paidLeaveRequired, paidLeaveTypes,
}) {
  const addr = [employee?.address, [employee?.city, employee?.state, employee?.zip].filter(Boolean).join(', ')].filter(Boolean).join('<br>')
  const responsibilitiesHtml = `
    <h2>Employee Responsibilities</h2>
    <ul>
      <li>You must provide ${company.name} at least <strong>30 days advance notice</strong> before FMLA
      leave begins if the need for leave is foreseeable. If not foreseeable, provide notice as soon
      as practicable (generally the same or next business day).</li>
      <li>You must comply with ${company.name}'s normal call-in procedures unless there are unusual
      circumstances.</li>
      ${medCertRequired ? `<li>You must provide <strong>medical certification</strong> to support your
      request for leave. A completed certification must be returned to HR no later than
      <strong>${medCertDueDate || '[15 calendar days]'}</strong>. Failure to provide certification
      may result in denial of FMLA protection.</li>` : ''}
      ${paidLeaveRequired ? `<li>You will be required to use accrued paid leave concurrently with
      FMLA leave. Paid leave types: ${paidLeaveTypes || 'vacation, sick leave'}.</li>` : ''}
      <li>You must notify ${company.name} as soon as possible if the dates of leave change, are
      extended, or were unknown.</li>
    </ul>`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>FMLA Eligibility Notice — ${employee?.name || 'Employee'}</title>
  <style>${SHARED_CSS}</style></head><body>
  ${screenHeader(`FMLA Eligibility & Rights Notice — ${employee?.name || 'Employee'}`)}
  <div class="document">
    ${letterhead(company, 'Notice of Eligibility &amp; Rights / Responsibilities', noticeDate)}

    <div class="notice-box deadline avoid-break">
      <strong>Time-sensitive:</strong> This notice must be provided within <strong>5 business days</strong>
      of the employee's request for leave or when the employer acquires knowledge that leave may be
      for an FMLA-qualifying reason.
    </div>

    <div class="address-block">
      <div>${employee?.name || '[Employee Name]'}</div>
      ${addr ? `<div>${addr}</div>` : ''}
    </div>

    <p>Dear ${employee?.name || 'Employee'},</p>
    <p>You have notified us that you need leave beginning <strong>${leaveStartDate || '[Start Date]'}</strong>
    ${leaveEndDate ? `through <strong>${leaveEndDate}</strong>` : ''}
    for: <em>${leaveReason || '[qualifying reason]'}</em>.</p>

    <h2>FMLA Eligibility Determination</h2>
    ${isEligible
      ? `<div class="notice-box info"><strong>You ARE eligible for FMLA leave.</strong> You meet
         all eligibility requirements: 12 months of employment, 1,250 hours worked in the past
         12 months, and 50+ employees within 75 miles of your worksite.</div>`
      : `<div class="notice-box"><strong>You are NOT currently eligible for FMLA leave</strong>
         for the following reason(s):</div>
         <ul>${(ineligibleReasons || []).map(r => `<li>${r}</li>`).join('') || '<li>[Reason not specified]</li>'}</ul>`
    }

    <h2>Leave Details</h2>
    <table class="info-table avoid-break">
      <tr><td>Leave requested from</td><td>${leaveStartDate || '—'}</td></tr>
      <tr><td>Leave requested through</td><td>${leaveEndDate || 'To be determined'}</td></tr>
      <tr><td>Type of leave</td><td>
        ${isContinuous ? '&#x2611; Continuous block of leave<br>' : ''}
        ${isIntermittent ? '&#x2611; Intermittent leave<br>' : ''}
        ${isReducedSchedule ? '&#x2611; Reduced leave schedule' : ''}
      </td></tr>
      <tr><td>Medical certification required</td><td>${medCertRequired ? `Yes — due by ${medCertDueDate || '[15 calendar days from today]'}` : 'No'}</td></tr>
      <tr><td>Paid leave required concurrently</td><td>${paidLeaveRequired ? `Yes — ${paidLeaveTypes || 'per company policy'}` : 'No'}</td></tr>
    </table>

    ${responsibilitiesHtml}

    <h2>Employer Responsibilities</h2>
    <ul>
      <li>${company.name} will maintain your group health benefits during FMLA leave on the same
      terms as if you had continued to work. You are responsible for your share of any premium
      payments during leave.</li>
      <li>Upon return from FMLA leave, you will be restored to the same or equivalent position
      with equivalent benefits, pay, and other terms and conditions of employment.</li>
      <li>If you do not return after FMLA leave, ${company.name} may recover health plan premiums
      paid on your behalf, unless the failure to return is due to a serious health condition or
      circumstances beyond your control.</li>
    </ul>

    <h2>Additional Information</h2>
    <p>If you have questions about your FMLA rights, contact HR at the information below or the
    U.S. DOL Wage and Hour Division at 1-866-487-9243 or www.dol.gov/agencies/whd/fmla.</p>
    <table class="info-table avoid-break">
      <tr><td>HR / Plan Administrator</td><td>${company.contact_name || company.name} | ${company.contact_phone || ''} | ${company.contact_email || ''}</td></tr>
      <tr><td>DOL Wage and Hour Division</td><td>1-866-487-9243 | www.dol.gov/agencies/whd/fmla</td></tr>
    </table>

    <div class="sig-block avoid-break">
      <p>Sincerely,</p>
      <div class="sig-line"></div>
      <div class="sig-label">${company.contact_name || 'HR Administrator'}</div>
      <div class="sig-label">${company.name}</div>
      ${company.contact_phone ? `<div class="sig-label">${company.contact_phone}</div>` : ''}
    </div>

    ${docFooter('FMLA Eligibility & Rights Notice | 29 CFR § 825.300(b)(c)', generatedDate)}
  </div></body></html>`
}

// ════════════════════════════════════════════════════════════
// 3. DESIGNATION NOTICE (WH-382 equivalent)
// Required within 5 business days of sufficient information
// ════════════════════════════════════════════════════════════
export function generateFmlaDesignationNoticeHtml({
  company, employee, noticeDate, generatedDate,
  isDesignated, notDesignatedReason,
  leaveReason, leaveStartDate, leaveEndDate,
  weeksApproved, returnToWorkDate,
  fitnessForDutyRequired,
  paidLeaveRequired, paidLeaveTypes,
}) {
  const addr = [employee?.address, [employee?.city, employee?.state, employee?.zip].filter(Boolean).join(', ')].filter(Boolean).join('<br>')

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>FMLA Designation Notice — ${employee?.name || 'Employee'}</title>
  <style>${SHARED_CSS}</style></head><body>
  ${screenHeader(`FMLA Designation Notice — ${employee?.name || 'Employee'}`)}
  <div class="document">
    ${letterhead(company, 'FMLA Designation Notice', noticeDate)}

    <div class="notice-box deadline avoid-break">
      <strong>Time-sensitive:</strong> This notice must be provided within <strong>5 business days</strong>
      of having sufficient information to determine whether the leave qualifies as FMLA leave.
      This is the employer's official determination that leave is (or is not) FMLA-protected.
    </div>

    <div class="address-block">
      <div>${employee?.name || '[Employee Name]'}</div>
      ${addr ? `<div>${addr}</div>` : ''}
    </div>

    <p>Dear ${employee?.name || 'Employee'},</p>
    <p>We have sufficient information to make a designation determination regarding your leave
    request beginning <strong>${leaveStartDate || '[Start Date]'}</strong>
    for: <em>${leaveReason || '[qualifying reason]'}</em>.</p>

    <h2>FMLA Designation Determination</h2>
    ${isDesignated
      ? `<div class="notice-box info"><strong>Your leave IS designated as FMLA-protected.</strong>
         The leave described below will be counted against your 12-week (or 26-week for military
         caregiver leave) FMLA entitlement for the current 12-month period.</div>`
      : `<div class="notice-box"><strong>Your leave is NOT designated as FMLA-protected.</strong><br>
         Reason: ${notDesignatedReason || '[reason not specified]'}</div>`
    }

    ${isDesignated ? `
    <h2>Leave Designation Details</h2>
    <table class="info-table avoid-break">
      <tr><td>Designated leave begins</td><td>${leaveStartDate || '—'}</td></tr>
      <tr><td>Expected return to work</td><td>${returnToWorkDate || leaveEndDate || 'To be determined'}</td></tr>
      <tr><td>FMLA weeks to be used</td><td>${weeksApproved ? `Approximately ${weeksApproved} week(s)` : 'To be determined based on actual leave taken'}</td></tr>
      <tr><td>Paid leave concurrent</td><td>${paidLeaveRequired ? `Yes — ${paidLeaveTypes || 'per company policy'}` : 'No'}</td></tr>
      <tr><td>Fitness-for-duty cert. required</td><td>${fitnessForDutyRequired ? 'Yes — required before returning to work' : 'No'}</td></tr>
    </table>

    <h2>Your Rights During FMLA Leave</h2>
    <ul>
      <li>${company.name} will maintain your group health benefits during FMLA leave on the same
      terms as if you had continued to work.</li>
      <li>Upon return from FMLA leave, you will be restored to the same or an equivalent position.</li>
      <li>You may take leave intermittently or on a reduced schedule if medically necessary and
      approved by your healthcare provider.</li>
    </ul>

    <h2>Your Responsibilities During FMLA Leave</h2>
    <ul>
      <li>Notify HR as soon as possible if your leave dates change or are extended.</li>
      <li>Comply with ${company.name}'s normal call-in procedures during leave.</li>
      ${fitnessForDutyRequired ? '<li>You must provide a <strong>fitness-for-duty certification</strong> from your healthcare provider before you will be permitted to return to work.</li>' : ''}
      <li>If you do not return to work after your FMLA leave ends, you may be required to reimburse
      ${company.name} for health insurance premiums paid on your behalf during leave, unless the
      failure to return is due to circumstances beyond your control.</li>
    </ul>
    ` : ''}

    <table class="info-table avoid-break" style="margin-top:16px">
      <tr><td>HR / Plan Administrator</td><td>${company.contact_name || company.name} | ${company.contact_phone || ''} | ${company.contact_email || ''}</td></tr>
      <tr><td>DOL Wage and Hour Division</td><td>1-866-487-9243 | www.dol.gov/agencies/whd/fmla</td></tr>
    </table>

    <div class="sig-block avoid-break">
      <p>Sincerely,</p>
      <div class="sig-line"></div>
      <div class="sig-label">${company.contact_name || 'HR Administrator'}</div>
      <div class="sig-label">${company.name}</div>
      ${company.contact_phone ? `<div class="sig-label">${company.contact_phone}</div>` : ''}
    </div>

    ${docFooter('FMLA Designation Notice | 29 CFR § 825.300(d)', generatedDate)}
  </div></body></html>`
}

// ════════════════════════════════════════════════════════════
// 4. MEDICAL CERTIFICATION REQUEST
// May be requested within 5 business days; employee has 15 days to return
// ════════════════════════════════════════════════════════════
export function generateFmlaMedCertRequestHtml({
  company, employee, noticeDate, generatedDate,
  certType, leaveReason, leaveStartDate, certDueDate,
}) {
  const addr = [employee?.address, [employee?.city, employee?.state, employee?.zip].filter(Boolean).join(', ')].filter(Boolean).join('<br>')
  const certFormLabel = certType === 'family'
    ? 'WH-380-F (Certification of Health Care Provider for Family Member\'s Serious Health Condition)'
    : 'WH-380-E (Certification of Health Care Provider for Employee\'s Serious Health Condition)'
  const certFormUrl = certType === 'family'
    ? 'https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh380F.pdf'
    : 'https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh380E.pdf'

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>FMLA Medical Certification Request — ${employee?.name || 'Employee'}</title>
  <style>${SHARED_CSS}</style></head><body>
  ${screenHeader(`FMLA Medical Certification Request — ${employee?.name || 'Employee'}`)}
  <div class="document">
    ${letterhead(company, 'Request for Medical Certification', noticeDate)}

    <div class="notice-box deadline avoid-break">
      <strong>Employee deadline:</strong> You must return the completed certification form to HR no
      later than <strong>${certDueDate || '[15 calendar days from today]'}</strong>. Failure to
      provide a complete and sufficient certification may result in denial of FMLA protection
      for your leave. You may request a 15-day extension for good cause.
    </div>

    <div class="address-block">
      <div>${employee?.name || '[Employee Name]'}</div>
      ${addr ? `<div>${addr}</div>` : ''}
    </div>

    <p>Dear ${employee?.name || 'Employee'},</p>
    <p>You have requested leave beginning <strong>${leaveStartDate || '[Start Date]'}</strong>
    for: <em>${leaveReason || '[qualifying reason]'}</em>. To determine whether your leave
    qualifies for protection under the Family and Medical Leave Act, we are requesting that you
    provide medical certification from a licensed healthcare provider.</p>

    <h2>Required Certification Form</h2>
    <table class="info-table avoid-break">
      <tr><td>Form required</td><td>${certFormLabel}</td></tr>
      <tr><td>Download form</td><td>${certFormUrl}</td></tr>
      <tr><td>Certification due</td><td><strong>${certDueDate || '[15 calendar days from today]'}</strong></td></tr>
      <tr><td>Return completed form to</td><td>${company.contact_name || 'HR Department'}<br>${company.contact_email || ''}<br>${company.contact_phone || ''}</td></tr>
    </table>

    <h2>Instructions</h2>
    <ol>
      <li>Download the certification form at the link above, or request a copy from HR.</li>
      <li>Provide the form to your (or your family member's) licensed healthcare provider
      — a physician, podiatrist, dentist, clinical psychologist, optometrist, chiropractor,
      nurse practitioner, nurse-midwife, clinical social worker, or Christian Science practitioner.</li>
      <li>The healthcare provider completes and signs the form.</li>
      <li>Return the completed form to HR by the due date above. You may submit by email,
      fax, or in person.</li>
    </ol>

    <h2>Important Rights Regarding Certification</h2>
    <ul>
      <li>You have <strong>15 calendar days</strong> to return the completed certification. You
      may request a single 15-day extension if you cannot meet the deadline for reasons beyond
      your control.</li>
      <li>${company.name} may contact your healthcare provider to clarify or authenticate the
      certification, but may not request additional information beyond what is required on the form.</li>
      <li>${company.name} may require a second opinion at its own expense. If the second opinion
      differs, a third opinion (binding on both parties) may be required, also at the company's
      expense.</li>
      <li>Your personal medical information will be kept confidential in a file separate from
      your regular personnel file.</li>
      <li>Providing false or fraudulent information on the certification may result in disciplinary
      action up to and including termination.</li>
    </ul>

    <h2>If You Do Not Provide Certification</h2>
    <p>If you fail to return a complete and sufficient certification within the timeframe specified,
    ${company.name} may deny FMLA protection for the leave. You may still be subject to the
    company's standard attendance policies for any absence not protected by FMLA.</p>

    <table class="info-table avoid-break" style="margin-top:16px">
      <tr><td>Questions? Contact HR</td><td>${company.contact_name || company.name} | ${company.contact_phone || ''} | ${company.contact_email || ''}</td></tr>
      <tr><td>DOL Wage and Hour Division</td><td>1-866-487-9243 | www.dol.gov/agencies/whd/fmla</td></tr>
    </table>

    <div class="sig-block avoid-break">
      <p>Sincerely,</p>
      <div class="sig-line"></div>
      <div class="sig-label">${company.contact_name || 'HR Administrator'}</div>
      <div class="sig-label">${company.name}</div>
      ${company.contact_phone ? `<div class="sig-label">${company.contact_phone}</div>` : ''}
    </div>

    ${docFooter('FMLA Medical Certification Request | 29 CFR § 825.305', generatedDate)}
  </div></body></html>`
}

export const INELIGIBLE_REASONS = [
  { value: 'months', label: 'Has not worked for the employer for at least 12 months' },
  { value: 'hours',  label: 'Has not worked at least 1,250 hours in the past 12 months' },
  { value: 'site',   label: 'Works at a site with fewer than 50 employees within 75 miles' },
]

export const LEAVE_REASONS = [
  'Birth of a child and care of newborn within the first year',
  'Placement of a child for adoption or foster care within the first year',
  'Care for spouse with a serious health condition',
  'Care for child with a serious health condition',
  'Care for parent with a serious health condition',
  "Employee's own serious health condition",
  'Qualifying military exigency (spouse, child, or parent on covered active duty)',
  'Care for covered servicemember with serious injury or illness',
]
