/**
 * enrollmentFormGenerator.js
 * Generates a company-specific enrollment form HTML
 * with Employer Section pre-filled and only elected plans shown.
 * Employee section is left blank for handwritten completion.
 */

import { PLAN_MAP, RIDERS_PLAN, groupKaiserRates } from '@/lib/plans'

function planLabel(planId) {
  const p = PLAN_MAP[planId]
  if (!p) return null
  // Return display name without "Package" suffix for brevity
  return p.name
}

export function generateEnrollmentForm({ company, elections, rates, kaiserRates = [], kaiserElections = {}, generatedDate }) {
  const today = generatedDate || new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })

  // Build elected plan list
  const electedHmsa = Object.entries(elections || {})
    .filter(([planId, el]) => el?.elected && planId !== 'kiaa_riders' && planId !== 'compcare')
    .map(([planId]) => PLAN_MAP[planId])
    .filter(Boolean)

  const ridersElected = elections?.['kiaa_riders']?.elected

  const electedKaiser = groupKaiserRates(kaiserRates)
    .filter(g => kaiserElections[`${g.kaiser_plan_no}_${g.package_type}`]?.elected)

  const hasFullPackage = [...electedHmsa, ...electedKaiser].some(p =>
    p?.package === 'Full Package' || p?.package_type === 'full'
  )

  // All elected plans for the checkboxes
  const allElectedPlans = [
    ...electedHmsa.map(p => ({
      id:      p.id,
      label:   p.name,
      type:    p.type,
      carrier: 'HMSA',
      isFull:  p.package === 'Full Package',
    })),
    ...electedKaiser.map(g => ({
      id:      `kaiser_${g.kaiser_plan_no}_${g.package_type}`,
      label:   `Kaiser Permanente ${g.kaiser_plan_no} ${g.package_type === 'full' ? 'Full Package' : 'Med/Rx Package'}`,
      type:    'HMO',
      carrier: 'Kaiser',
      isFull:  g.package_type === 'full',
    })),
    ...(ridersElected ? [{
      id:      'kiaa_riders',
      label:   'KIAA Riders Package (Vision, Dental, Group Life/AD&D)',
      type:    'Riders',
      carrier: 'HMSA',
      isFull:  false,
    }] : []),
  ]

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Enrollment Form — ${company.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #111; background: #fff; padding: 12px 16px; }
    h1 { font-size: 12pt; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
    h2 { font-size: 8.5pt; font-weight: bold; text-align: center; color: #444; margin-bottom: 8px; }
    .section { border: 1px solid #333; border-radius: 3px; margin-bottom: 6px; overflow: hidden; }
    .section-hdr { background: #0D6965; color: #fff; font-weight: bold; font-size: 8.5pt; padding: 3px 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .section-hdr.kaiser { background: #385262; }
    .section-body { padding: 6px 8px; }
    .row { display: flex; gap: 8px; margin-bottom: 5px; align-items: flex-end; }
    .field { flex: 1; }
    .field label { display: block; font-size: 7pt; color: #555; margin-bottom: 1px; font-weight: bold; }
    .field .val { border-bottom: 1px solid #111; min-height: 15px; padding: 1px 3px; font-size: 8.5pt; background: #f9fafb; }
    .field .blank { border-bottom: 1px solid #111; min-height: 15px; }
    .plan-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
    .plan-item { display: flex; align-items: center; gap: 5px; padding: 3px 6px; border: 1px solid #ccc; border-radius: 2px; background: #f9fafb; }
    .plan-item .checkbox { width: 12px; height: 12px; border: 1.5px solid #333; flex-shrink: 0; }
    .plan-item .plan-name { font-size: 8.5pt; font-weight: 500; }
    .plan-item .plan-type { font-size: 7pt; color: #666; }
    .enroll-type { display: flex; gap: 10px; margin-bottom: 5px; flex-wrap: wrap; }
    .enroll-type label { display: flex; align-items: center; gap: 3px; font-size: 8.5pt; }
    .coverage-type { display: flex; gap: 6px; flex-wrap: wrap; }
    .coverage-item { display: flex; align-items: center; gap: 4px; border: 1px solid #ccc; padding: 2px 6px; border-radius: 2px; font-size: 8pt; }
    .note { font-size: 7pt; color: #555; font-style: italic; margin-top: 4px; }
    .sig-row { display: flex; gap: 16px; margin-top: 6px; }
    .sig-field { flex: 1; }
    .sig-field label { font-size: 7pt; font-weight: bold; color: #555; display: block; margin-bottom: 1px; }
    .sig-line { border-bottom: 1px solid #111; min-height: 20px; }
    .prefilled { color: #0D6965; font-weight: 600; }
    .footer { margin-top: 8px; font-size: 7pt; color: #555; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
    .group-life-note { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 2px; padding: 4px 8px; font-size: 7.5pt; color: #92400E; margin-top: 5px; }
    @media print {
      body { padding: 4px 8px; }
      .no-print { display: none; }
      @page { size: letter; margin: 0.4in; }
    }
    .finput { width: 100%; border: none; border-bottom: 1px solid #111; font-size: 8.5pt; font-family: Arial, Helvetica, sans-serif; padding: 1px 3px; min-height: 15px; background: transparent; outline: none; color: #111; }
    .finput:focus { background: #fffde7; border-bottom: 1.5px solid #0D6965; }
    @media print { .finput { background: transparent !important; } }
    .print-btn { display: block; margin: 0 auto 12px; padding: 6px 20px; background: #0D6965; color: #fff; border: none; border-radius: 6px; font-size: 10pt; cursor: pointer; font-weight: bold; }
  </style>
</head>
<body>

  <button class="print-btn no-print" onclick="window.print()">🖨 Print or Save as PDF — give signed form to your HR department</button>

  <h1>Subscriber Enrollment Form</h1>
  <h2>Please print clearly. Complete all fields to ensure enrollment.</h2>

  <!-- Employer Section -->
  <div class="section">
    <div class="section-hdr">Employer Section</div>
    <div class="section-body">
      <div class="row">
        <div class="field" style="flex:2">
          <label>Company Name</label>
          <div class="val prefilled">${company.name || ''}</div>
        </div>
        <div class="field">
          <label>Point of Contact</label>
          <div class="val prefilled">${company.benefits_contact_name || company.contact_name || ''}</div>
        </div>
        <div class="field">
          <label>Phone</label>
          <div class="val prefilled">${company.benefits_contact_phone || company.contact_phone || ''}</div>
        </div>
      </div>
      <div class="row">
        <div class="field" style="flex:2">
          <label>Email</label>
          <div class="val prefilled">${company.benefits_contact_email || company.contact_email || ''}</div>
        </div>
        <div class="field">
          <label>HMSA Group #</label>
          <div class="val prefilled">${company.hmsa_group_no || ''}</div>
        </div>
        <div class="field">
          <label>HMSA Band</label>
          <div class="val prefilled">${company.band ? 'Band ' + company.band : ''}</div>
        </div>
        ${company.kaiser_group_no ? `
        <div class="field">
          <label>Kaiser Group #</label>
          <div class="val prefilled">${company.kaiser_group_no}</div>
        </div>` : ''}
      </div>

      <!-- Type of enrollment -->
      <div style="margin-bottom:8px;">
        <div style="font-size:8pt;font-weight:bold;color:#555;margin-bottom:4px;">TYPE OF ENROLLMENT (select one)</div>
        <div class="enroll-type">
          ${['Open Enrollment','New Hire','Rehire','COBRA','Qualifying Event'].map(t =>
            `<label><input type="checkbox" style="width:12px;height:12px;"> ${t}</label>`
          ).join('')}
        </div>
      </div>

      <!-- Plan selection -->
      <div>
        <div style="font-size:8pt;font-weight:bold;color:#555;margin-bottom:6px;">PLAN SELECTION — Select one health plan from your company's available options</div>
        ${allElectedPlans.length === 0 ? `
          <div style="color:#888;font-style:italic;font-size:9pt;">No plans on file. Contact KIAA.</div>
        ` : `
          <div class="plan-grid">
            ${allElectedPlans.map(p => `
              <div class="plan-item">
                <div class="checkbox"></div>
                <div>
                  <div class="plan-name">${p.label}</div>
                  <div class="plan-type">${p.carrier} · ${p.type}${p.isFull ? ' · Full Package' : ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
        ${hasFullPackage || ridersElected ? `
          <div class="group-life-note">
            ⚠ Group Life enrollment form must accompany all Full-Package and Rider-Package enrollments.
          </div>
        ` : ''}
      </div>

      <!-- Effective date & election code -->
      <div class="row" style="margin-top:6px;">
        <div class="field">
          <label>Effective Date</label>
          <div class="blank"></div>
        </div>
        <div class="field">
          <label>Election Code</label>
          <div class="blank"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Employee Section -->
  <div class="section">
    <div class="section-hdr">Employee Section — Please complete all fields</div>
    <div class="section-body">
      <div class="row">
        <div class="field" style="flex:2"><label>Last Name</label><input type="text" class="finput" placeholder="Last name"/></div>
        <div class="field" style="flex:2"><label>First Name</label><input type="text" class="finput" placeholder="First name"/></div>
        <div class="field" style="flex:0.5"><label>MI</label><input type="text" class="finput" maxlength="1"/></div>
        <div class="field" style="flex:0.5"><label>Suffix</label><input type="text" class="finput" placeholder="Jr/Sr"/></div>
      </div>
      <div class="row">
        <div class="field"><label>Social Security Number</label><input type="text" class="finput" placeholder="XXX-XX-XXXX"/></div>
        <div class="field"><label>Date of Hire (MM/DD/YYYY)</label><input type="text" class="finput" placeholder="MM/DD/YYYY"/></div>
        <div class="field"><label>Date of Birth (MM/DD/YYYY)</label><input type="text" class="finput" placeholder="MM/DD/YYYY"/></div>
        <div class="field" style="flex:0.5"><label>Gender</label><div style="display:flex;gap:8px;border-bottom:1px solid #111;min-height:15px;padding:1px 4px;"><label><input type="checkbox" style="width:11px;height:11px;"> M</label><label><input type="checkbox" style="width:11px;height:11px;"> F</label></div></div>
      </div>
      <div class="row">
        <div class="field" style="flex:3"><label>Mailing Address</label><input type="text" class="finput" placeholder="Street address"/></div>
        <div class="field" style="flex:2"><label>City</label><input type="text" class="finput" placeholder="City"/></div>
        <div class="field" style="flex:0.5"><label>State</label><input type="text" class="finput" value="HI" maxlength="2"/></div>
        <div class="field"><label>Zip</label><input type="text" class="finput" placeholder="96720" maxlength="10"/></div>
      </div>
      <div class="row">
        <div class="field" style="flex:2"><label>Email Address (optional)</label><input type="email" class="finput" placeholder="email@example.com"/></div>
        <div class="field"><label>Home Phone</label><input type="tel" class="finput" placeholder="(808) 555-0100"/></div>
        <div class="field"><label>Work Phone</label><input type="tel" class="finput" placeholder="(808) 555-0100"/></div>
      </div>
      <div class="row">
        <div class="field">
          <label>Marital Status</label>
          <div style="display:flex;gap:8px;border-bottom:1px solid #111;min-height:18px;padding:1px 4px;">
            ${['Single','Married','Divorced','Widowed'].map(s =>
              `<label style="font-size:9pt;"><input type="checkbox" style="width:11px;height:11px;"> ${s}</label>`
            ).join('')}
          </div>
        </div>
        <div class="field" style="flex:2">
          <label>Type of Coverage Requested</label>
          <div class="coverage-type">
            <div class="coverage-item"><input type="checkbox" style="width:11px;height:11px;"> [01] Employee Only</div>
            <div class="coverage-item"><input type="checkbox" style="width:11px;height:11px;"> [02] Employee + 1 Dependent</div>
            <div class="coverage-item"><input type="checkbox" style="width:11px;height:11px;"> [03] Employee + 2 or more Dependents</div>
          </div>
        </div>
      </div>
      ${electedHmsa.some(p => p.type === 'HMO') || electedKaiser.length > 0 ? `
      <div class="row">
        <div class="field" style="flex:2"><label>Primary Care Provider — First Name</label><div class="blank"></div></div>
        <div class="field" style="flex:2"><label>Primary Care Provider — Last Name</label><div class="blank"></div></div>
        <div class="field"><label>PCP ID #</label><input type="text" class="finput" placeholder="PCP ID"/></div>
        <div class="field" style="flex:0.7">
          <label>Established Patient?</label>
          <div style="display:flex;gap:8px;border-bottom:1px solid #111;min-height:18px;padding:1px 4px;">
            <label style="font-size:9pt;"><input type="checkbox" style="width:11px;height:11px;"> Yes</label>
            <label style="font-size:9pt;"><input type="checkbox" style="width:11px;height:11px;"> No</label>
          </div>
        </div>
      </div>
      <div class="note">* Primary Care Provider required for HMO plan enrollees (Health Plan Hawaii Plus, Kaiser Permanente)</div>
      ` : ''}

      <!-- Members enrolling table -->
      <div style="margin-top:6px;">
        <div style="font-size:8pt;font-weight:bold;color:#555;margin-bottom:4px;">MEMBERS ENROLLING</div>
        <table style="width:100%;border-collapse:collapse;font-size:8.5pt;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="border:1px solid #ccc;padding:3px 4px;text-align:left;font-size:7.5pt;">Relationship</th>
              <th style="border:1px solid #ccc;padding:3px 4px;text-align:left;font-size:7.5pt;">First Name (Last if different)</th>
              <th style="border:1px solid #ccc;padding:4px;text-align:center;">Sex</th>
              <th style="border:1px solid #ccc;padding:3px 4px;text-align:left;font-size:7.5pt;">Date of Birth</th>
              <th style="border:1px solid #ccc;padding:3px 4px;text-align:left;font-size:7.5pt;">Social Security #</th>
              ${electedHmsa.some(p => p.type === 'HMO') || electedKaiser.length > 0 ? '<th style="border:1px solid #ccc;padding:3px 4px;text-align:left;font-size:7.5pt;">Primary Care Provider</th><th style="border:1px solid #ccc;padding:4px;text-align:center;">PCP ID#</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${['Spouse','Child/Dependent','Child/Dependent','Child/Dependent'].map(rel => `
              <tr>
                <td style="border:1px solid #ccc;padding:4px;color:#666;">${rel}</td>
                <td style="border:1px solid #ccc;padding:10px 3px 3px;"></td>
                <td style="border:1px solid #ccc;padding:4px;text-align:center;">
                  <label style="font-size:8pt;"><input type="checkbox" style="width:10px;height:10px;"> M</label>
                  <label style="font-size:8pt;"><input type="checkbox" style="width:10px;height:10px;"> F</label>
                </td>
                <td style="border:1px solid #ccc;padding:3px;"><input type="text" class="finput" style="width:100%;"/></td>
                <td style="border:1px solid #ccc;padding:3px;"><input type="text" class="finput" style="width:100%;" placeholder="MM/DD/YYYY"/></td>
                ${electedHmsa.some(p => p.type === 'HMO') || electedKaiser.length > 0 ? '<td style="border:1px solid #ccc;padding:10px 3px 3px;"></td><td style="border:1px solid #ccc;padding:10px 3px 3px;"></td>' : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Other coverage -->
      <div style="margin-top:6px;">
        <div style="font-size:8.5pt;font-weight:bold;color:#555;margin-bottom:4px;">
          Do you or a covered family member have other insurance coverage?
          <label style="font-weight:normal;margin-left:10px;"><input type="checkbox" style="width:11px;height:11px;"> Yes</label>
          <label style="font-weight:normal;margin-left:8px;"><input type="checkbox" style="width:11px;height:11px;"> Yes (Medicare)</label>
          <label style="font-weight:normal;margin-left:8px;"><input type="checkbox" style="width:11px;height:11px;"> No</label>
        </div>
        <div class="row">
          <div class="field"><label>Name of Health Plan</label><input type="text" class="finput"/></div>
          <div class="field"><label>Name of Plan Holder</label><input type="text" class="finput"/></div>
          <div class="field"><label>Health Plan Number</label><input type="text" class="finput"/></div>
          <div class="field"><label>Effective Date</label><div class="blank"></div></div>
        </div>
      </div>

      <!-- Signatures -->
      <div class="sig-row">
        <div class="sig-field">
          <label>Employee Signature <span style="font-size:6.5pt;color:#888;">(sign after printing)</span></label>
          <div class="sig-line"></div>
        </div>
        <div class="sig-field" style="flex:0.5">
          <label>Date</label>
          <input type="text" class="finput" placeholder="MM/DD/YYYY"/>
        </div>
        <div class="sig-field">
          <label>Employer Signature <span style="font-size:6.5pt;color:#888;">(sign after printing)</span></label>
          <div class="sig-line"></div>
        </div>
        <div class="sig-field" style="flex:0.5">
          <label>Date</label>
          <input type="text" class="finput" placeholder="MM/DD/YYYY"/>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    Send completed Enrollment Forms to KIAA · 820 Piilani St., Suite 201 · Hilo, HI 96720 · Fax: 808-935-9740 · Email: admin@kiaahilo.org<br>
    ${hasFullPackage || ridersElected ? '<strong>Group Life Enrollment forms must accompany all Full-Package and Rider-Package enrollments.</strong><br>' : ''}
    Generated ${today} · Plan year: ${company.plan_year || '2025-2026'}
  </div>

</body>
</html>`
}
