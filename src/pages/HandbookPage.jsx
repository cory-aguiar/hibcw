import { useState } from 'react'

const SECTIONS = [
  {
    group: 'Getting started',
    items: [
      { num: 1,  label: 'Introduction',           sub: 'Roles, group types, overview' },
      { num: 2,  label: 'Dashboard',               sub: 'Widgets, tasks, renewals' },
    ]
  },
  {
    group: 'Managing companies',
    items: [
      { num: 3,  label: 'Companies',               sub: 'Adding, codes, bands, Kaiser' },
      { num: 4,  label: 'Open Enrollment — MRG',   sub: 'Timeline, rates, OE workflow' },
      { num: 5,  label: 'Open Enrollment — ACA',   sub: 'Age-based, renewal workflow' },
      { num: 6,  label: 'Prospects (ACA)',          sub: 'Phase 1 → 2, checklist, acceptance' },
    ]
  },
  {
    group: 'Rates & documents',
    items: [
      { num: 7,  label: 'Premium Rate Sheet',      sub: 'Uploading rates, COMPCARE, Kaiser' },
      { num: 8,  label: 'Document Library',        sub: 'SBCs, collateral, external links' },
      { num: 9,  label: 'Forms & Links',           sub: 'Managing HR-facing resources' },
    ]
  },
  {
    group: 'Users & settings',
    items: [
      { num: 10, label: 'HR Client Portal',        sub: 'What they see, support tips' },
      { num: 11, label: 'User Management',         sub: 'Inviting, roles, troubleshooting' },
      { num: 12, label: 'Settings & Plan Year',    sub: 'OE status, annual checklist' },
    ]
  },
]

const ALL_ITEMS = SECTIONS.flatMap(g => g.items)

const CONTENT = {
  1: {
    tag: 'Getting started',
    title: 'Introduction',
    intro: 'KIAA Connect is KIAA\'s internal benefits administration platform. It manages two distinct types of employer groups — Merit Rated Groups (MRG) and ACA Small Groups — along with the full lifecycle from prospect inquiry through enrollment and ongoing administration.',
    body: () => (
      <div className="space-y-6">
        <div>
          <h3 className="hb-h3">What KIAA Connect does</h3>
          <p className="hb-p">KIAA Connect is the central hub for managing enrolled companies and their plan elections, running annual open enrollment for MRG and ACA groups, processing new ACA prospects from inquiry to enrollment, storing and distributing plan documents and SBCs, providing HR clients with a self-service portal, and generating premium rate sheets by band.</p>
        </div>
        <div>
          <h3 className="hb-h3">Two types of groups</h3>
          <table className="hb-table">
            <thead><tr><th>Feature</th><th>Merit Rated Groups (MRG)</th><th>ACA Small Groups</th></tr></thead>
            <tbody>
              <tr><td>Eligibility</td><td>Any size employer</td><td>1–50 full-time employees</td></tr>
              <tr><td>Plan year</td><td>October 1 — September 30</td><td>Flexible start date</td></tr>
              <tr><td>Rate basis</td><td>Band (1–9)</td><td>Age-based per member</td></tr>
              <tr><td>Carrier</td><td>HMSA · Kaiser</td><td>HMSA only</td></tr>
              <tr><td>COMPCARE</td><td>Optional add-on</td><td>Not available</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hb-h3">User roles</h3>
          <table className="hb-table">
            <thead><tr><th>Role</th><th>Access level</th><th>Typical user</th></tr></thead>
            <tbody>
              <tr><td><span className="badge-admin">Super Admin</span></td><td>Full access to all features</td><td>KIAA leadership</td></tr>
              <tr><td><span className="badge-staff">Staff</span></td><td>Full access except user management</td><td>KIAA staff</td></tr>
              <tr><td><span className="badge-hr">HR Client</span></td><td>Company portal — their company only</td><td>Employer HR contacts</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hb-tip">
          <span>💡</span>
          <div><strong>Accessing KIAA Connect</strong><br/>Log in at <strong>connect.kiaahilo.org</strong>. Use your KIAA email and the password you set when you accepted your invitation.</div>
        </div>
      </div>
    )
  },
  2: {
    tag: 'Getting started',
    title: 'Dashboard',
    intro: 'The Dashboard is the first screen you see after logging in. It gives you a real-time overview of KIAA\'s current workload, upcoming deadlines, and pending items.',
    body: () => (
      <div className="space-y-4">
        <div><h3 className="hb-h3">Summary cards</h3><p className="hb-p">The top row shows total enrolled companies, active plan year, open enrollment status, and pending tasks. These update in real time.</p></div>
        <div><h3 className="hb-h3">Upcoming renewals</h3><p className="hb-p">Lists companies whose plan year is ending within 90 days. Use this to proactively reach out and begin OE preparation. MRG renewals cluster around September for October 1 effective dates.</p></div>
        <div><h3 className="hb-h3">Pending tasks</h3><p className="hb-p">Tasks assigned to companies appear here. Click any task to navigate directly to the company.</p></div>
        <div><h3 className="hb-h3">New prospects</h3><p className="hb-p">Recently submitted ACA prospects appear here with their status. Click to open the prospect detail and begin the review checklist.</p></div>
        <div className="hb-warn"><span>⚠️</span><div><strong>Check the dashboard daily</strong><br/>New prospect submissions and overdue tasks won't send repeated notifications — checking the dashboard daily ensures nothing falls through the cracks.</div></div>
      </div>
    )
  },
  3: {
    tag: 'Managing companies',
    title: 'Companies',
    intro: 'The Companies page is the master list of all enrolled KIAA members. Each company has a detail page with their plan elections, census, documents, tasks, and enrollment history.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hb-h3">Adding a new company</h3>
          <div className="hb-steps">
            {[
              ['Click "New company"', 'From the Companies page, click the "New company" button. A modal will appear.'],
              ['Fill in company details', 'Enter the company name, contact name, email, and phone.'],
              ['Assign a band', 'Select the HMSA rate band (1–9) for MRG companies. ACA companies do not use bands.'],
              ['Set company code', 'A 6-character alphanumeric code is auto-generated. Share this with the HR contact so they can register at /register.'],
              ['Save and share code', 'Click Save. The company is created.'],
            ].map(([t,d],i) => (
              <div key={i} className="hb-step">
                <div className="hb-step-num">{i+1}</div>
                <div><div className="hb-step-title">{t}</div><div className="hb-step-desc">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="hb-warn"><span>⚠️</span><div><strong>Keep codes confidential</strong><br/>The company code grants access to that company's plan and rate information. Only share it with the authorized HR contact.</div></div>
        <div><h3 className="hb-h3">Assigning a Kaiser schedule</h3><p className="hb-p">For companies enrolled with Kaiser Permanente, assign their Kaiser schedule (B, D, or I) from the company detail page. Confirm the correct schedule with HMSA or the Kaiser rep before assigning.</p></div>
      </div>
    )
  },
  4: {
    tag: 'Open Enrollment',
    title: 'Open Enrollment — Merit Rated Groups',
    intro: 'Merit Rated Groups (MRG) are employer groups whose premiums are based on HMSA band rates — fixed monthly amounts by tier. MRG plan years run October 1 through September 30.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hb-h3">MRG renewal timeline</h3>
          <div className="hb-flow">
            {['July — Upload new rates','August — Open OE','September — HR submits','October 1 — New plan year'].map((l,i,a) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`hb-flow-box${i===3?' hb-flow-accent':''}`}>{l}</div>
                {i < a.length-1 && <span className="hb-flow-arrow">→</span>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="hb-h3">Riders & Drug rates reference</h3>
          <p className="hb-p">These rates are stored in the database per plan year and updated each October in <strong>Plan Year Settings → Riders & Drug Rates</strong>.</p>
          <table className="hb-table">
            <thead><tr><th>Component</th><th>Employee only</th><th>2-Party</th><th>Family</th></tr></thead>
            <tbody>
              <tr><td>Drug (HMSA)</td><td>$113.32</td><td>$240.64</td><td>$360.58</td></tr>
              <tr><td>Vision</td><td>$7.32</td><td>$14.62</td><td>$21.92</td></tr>
              <tr><td>Dental</td><td>$33.56</td><td>$73.42</td><td>$110.08</td></tr>
              <tr><td>Life/AD&D</td><td>$4.36</td><td>$4.36</td><td>$4.36</td></tr>
              <tr><td>COMPCARE</td><td>$6.76</td><td>$6.76</td><td>$6.76</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hb-warn"><span>⚠️</span><div><strong>The medical_ field includes Drug</strong><br/>Enter the Medical column value from the HMSA PDF directly — do NOT subtract Drug.</div></div>
        <div className="hb-tip"><span>💡</span><div><strong>HMSA submission deadline</strong><br/>KIAA must submit all plan elections by the <strong>10th of the month prior to the effective date</strong>. For October 1 renewals: September 10.</div></div>
      </div>
    )
  },
  5: {
    tag: 'Open Enrollment',
    title: 'Open Enrollment — ACA Small Groups',
    intro: 'ACA Small Groups are employers with 1–50 full-time employees. Unlike MRG, ACA premiums are age-based — each member\'s premium is calculated individually.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hb-h3">Key differences from MRG</h3>
          <table className="hb-table">
            <thead><tr><th>Aspect</th><th>MRG</th><th>ACA Small Group</th></tr></thead>
            <tbody>
              <tr><td>Premiums</td><td>Band-based (flat by tier)</td><td>Age-based (per member)</td></tr>
              <tr><td>Plan year</td><td>Oct 1 — Sep 30 (fixed)</td><td>Any start date (flexible)</td></tr>
              <tr><td>Census required</td><td>Headcount only</td><td>Full census with DOB</td></tr>
              <tr><td>FEIN/DOL required</td><td>No</td><td>Yes — via JotForm</td></tr>
              <tr><td>DCCA verification</td><td>No</td><td>Yes — by KIAA admin</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hb-h3">ACA renewal workflow</h3>
          <div className="hb-steps">
            {[
              ['Confirm updated census','The HR client updates their census — any employee changes must be reflected before renewal.'],
              ['Recalculate premiums','Run the quote using the updated census and new plan year rates.'],
              ['Send renewal quote','Send the updated quote via email. Process any plan changes through HMSA.'],
              ['Submit to HMSA','Submit changes by the 10th of the month prior to the renewal effective date.'],
            ].map(([t,d],i) => (
              <div key={i} className="hb-step">
                <div className="hb-step-num">{i+1}</div>
                <div><div className="hb-step-title">{t}</div><div className="hb-step-desc">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  },
  6: {
    tag: 'ACA Prospects',
    title: 'Prospects (ACA)',
    intro: 'New ACA Small Groups begin as prospects. KIAA Connect manages the full lifecycle from initial inquiry through acceptance, registration, and conversion to an enrolled member company.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hb-h3">Prospect status flow</h3>
          <div className="hb-flow flex-wrap gap-y-2">
            {['Pending','Submitted','Approved','Accepted','Converted'].map((s,i,a) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`hb-flow-box${s==='Accepted'?' hb-flow-accent':''}${s==='Pending'?' hb-flow-muted':''}`}>{s}</div>
                {i < a.length-1 && <span className="hb-flow-arrow">→</span>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="hb-h3">Admin review checklist</h3>
          <p className="hb-p">Complete all 8 items before the "Send approval link" button unlocks.</p>
          <div className="space-y-1 mt-2">
            {['DCCA business name search completed','Business name matches census submission','Business is Active/good standing (DCCA)','FEIN received via JotForm','Hawaii DOL number received via JotForm','Employee count meets minimum (2+ employees)','Age validation reviewed','Quote calculated and confirmed with HMSA'].map((item,i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-surface-50 text-sm text-surface-500">
                <span className="hb-check">☐</span>{item}
              </div>
            ))}
          </div>
        </div>
        <div className="hb-warn"><span>⚠️</span><div><strong>JotForm required before quote delivery</strong><br/>KIAA cannot prepare or deliver a quote until the FEIN and DOL number are received via JotForm.</div></div>
        <div className="hb-tip"><span>💡</span><div><strong>Printing the acceptance record</strong><br/>After acceptance, click "Print acceptance record" in the prospect detail for the full e-signature and compliance record.</div></div>
      </div>
    )
  },
  7: {
    tag: 'Rates & Documents',
    title: 'Premium Rate Sheet',
    intro: 'The Premium Rate Sheet displays HMSA and Kaiser premiums organized by plan type. It is the primary tool for generating rate quotes for companies and prospects.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hb-h3">Five sections</h3>
          <table className="hb-table">
            <thead><tr><th>Section</th><th>Plans</th><th>Columns</th></tr></thead>
            <tbody>
              <tr><td>7(a) Full Package</td><td>PPP, CompMED A, HPH Plus</td><td>Medical, Drug, Vision, Dental, Life, Total</td></tr>
              <tr><td>7(a) Medical Only</td><td>PPP, CompMED A</td><td>Medical only, Total</td></tr>
              <tr><td>7(b) Full Package</td><td>CompMED B, HPH Basic</td><td>Medical, Drug, Vision, Dental, Life, Total</td></tr>
              <tr><td>7(b) Medical Only</td><td>CompMED B</td><td>Medical only, Total</td></tr>
              <tr><td>Kaiser</td><td>Per schedule</td><td>Medical (incl. Drug), Vision, Dental, Life, Total</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hb-h3">Controls</h3>
          <p className="hb-p"><strong>Band selector</strong> — Select the company's HMSA band (1–9).</p>
          <p className="hb-p"><strong>Kaiser schedule</strong> — Appears if Kaiser rates exist. Select B, D, or I.</p>
          <p className="hb-p"><strong>Include COMPCARE</strong> — Check only for companies that have elected COMPCARE.</p>
        </div>
        <div>
          <h3 className="hb-h3">Updating rates each plan year</h3>
          <div className="hb-steps">
            {[
              ['Go to Plan Year Settings','Navigate to Plan Year in the Admin sidebar.'],
              ['Scroll to Riders & Drug Rates','The editable rate table appears at the bottom of the page.'],
              ['Enter new rates from HMSA','Update Drug, Vision, Dental, Life/AD&D, and COMPCARE values.'],
              ['Click Save rates','Rates update immediately across the entire Premium Rate Sheet.'],
            ].map(([t,d],i) => (
              <div key={i} className="hb-step">
                <div className="hb-step-num">{i+1}</div>
                <div><div className="hb-step-title">{t}</div><div className="hb-step-desc">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="hb-tip"><span>💡</span><div><strong>Kaiser Drug is included in medical</strong><br/>Kaiser has no separate Drug column — Drug is already baked into the medical rate.</div></div>
        <div className="hb-warn"><span>⚠️</span><div><strong>Update rates before opening OE</strong><br/>Riders & Drug rates must be updated for the new plan year before HR clients begin open enrollment.</div></div>
      </div>
    )
  },
  8: {
    tag: 'Rates & Documents',
    title: 'Document Library',
    intro: 'The Document Library stores and organizes all plan-related documents. Documents uploaded here are automatically distributed to HR clients through the portal.',
    body: () => (
      <div className="space-y-5">
        <div><h3 className="hb-h3">Plan Documents tab</h3><p className="hb-p">Linked to specific health plans and plan years. Upload SBCs (required) and Benefit Summaries (optional). PDFs only. Use Replace to upload a new version.</p></div>
        <div className="hb-warn"><span>⚠️</span><div><strong>SBCs must be updated each plan year</strong><br/>HMSA issues new SBCs annually. Upload before opening enrollment.</div></div>
        <div><h3 className="hb-h3">Enrollment Packet Collateral tab</h3><p className="hb-p">Carrier-level documents included in the digital enrollment packet. Sections for HMSA and Kaiser. Documents marked Evergreen are not plan-year specific.</p></div>
        <div><h3 className="hb-h3">External Links tab</h3><p className="hb-p">JotForms and external resources stored here appear automatically in the HR portal Forms & resources section.</p>
          <div className="hb-tip"><span>💡</span><div><strong>Group Life JotForm</strong><br/>https://form.jotform.com/212707120638046</div></div>
        </div>
      </div>
    )
  },
  9: {
    tag: 'Rates & Documents',
    title: 'Forms & Links',
    intro: 'The Forms & Links page manages forms and resources visible to HR clients in their portal — separate from enrollment-specific JotForms in the Document Library.',
    body: () => (
      <div className="space-y-4">
        <div>
          <h3 className="hb-h3">Adding a form or link</h3>
          <div className="hb-steps">
            {[
              ['Click "Add form / link"','From the Forms & Links page, click the button to open the add form panel.'],
              ['Enter a name and URL','The name appears as the link label in the HR portal. Include https:// in the URL.'],
              ['Add an optional description','A short description helps HR clients understand what the form is for.'],
              ['Save','The link immediately appears in all HR client portals.'],
            ].map(([t,d],i) => (
              <div key={i} className="hb-step">
                <div className="hb-step-num">{i+1}</div>
                <div><div className="hb-step-title">{t}</div><div className="hb-step-desc">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="hb-tip"><span>💡</span><div><strong>Use Document Library External Links for enrollment JotForms</strong><br/>Forms & Links is for general HR resources. Enrollment JotForms belong in Document Library → External Links.</div></div>
      </div>
    )
  },
  10: {
    tag: 'Users & Settings',
    title: 'HR Client Portal',
    intro: 'The HR Client Portal is the interface that HR contacts see when they log in. It is scoped entirely to their company — they cannot see other companies or any KIAA admin tools.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hb-h3">What HR clients can do</h3>
          <table className="hb-table">
            <thead><tr><th>Section</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>Plans</td><td>View elected plans, download SBCs and benefit summaries</td></tr>
              <tr><td>Open Enrollment</td><td>Submit plan elections, update FTE headcount, acknowledge compliance</td></tr>
              <tr><td>Compliance</td><td>View COBRA, FMLA, ERISA, and PHCA requirements</td></tr>
              <tr><td>Tasks</td><td>View and complete tasks assigned by KIAA</td></tr>
              <tr><td>Forms & resources</td><td>Access JotForms and external resources added by KIAA</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hb-h3">Common support requests</h3>
          <p className="hb-p"><strong>Can't log in</strong> — Verify their email in Supabase → Auth → Users. Ask them to use the Forgot password link.</p>
          <p className="hb-p"><strong>Can't see their plans</strong> — Check that the company has elected plans in the current plan year and that their profile's company_id is correct.</p>
          <p className="hb-p"><strong>OE not showing</strong> — Confirm OE is set to Open in Settings.</p>
        </div>
      </div>
    )
  },
  11: {
    tag: 'Users & Settings',
    title: 'User Management',
    intro: 'User accounts are managed through Supabase Authentication and the KIAA Connect profiles table. Roles determine what each user can see and do.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hb-h3">Inviting a new admin or staff member</h3>
          <div className="hb-steps">
            {[
              ['Pre-assign their role (recommended)','Run this SQL before sending the invite:\nINSERT INTO public.pending_roles (email, role)\nVALUES (\'their@email.com\', \'super_admin\');'],
              ['Send the invite','Go to Supabase → Authentication → Users → Invite user and enter their email.'],
              ['They accept and log in','The system creates their profile with the pre-assigned role automatically.'],
            ].map(([t,d],i) => (
              <div key={i} className="hb-step">
                <div className="hb-step-num">{i+1}</div>
                <div><div className="hb-step-title">{t}</div><div className="hb-step-desc" style={{whiteSpace:'pre-line'}}>{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="hb-warn"><span>⚠️</span><div><strong>If you forgot to pre-assign a role</strong><br/>Run: <code className="text-xs bg-surface-100 px-1 py-0.5 rounded font-mono">UPDATE public.profiles SET role = 'super_admin' WHERE email = 'their@email.com';</code> Then have them log out and back in.</div></div>
        <div>
          <h3 className="hb-h3">Troubleshooting access</h3>
          <p className="hb-p"><strong>Profile not created</strong> — Check public.profiles for their email. If missing, insert manually.</p>
          <p className="hb-p"><strong>Wrong role</strong> — Update role in their profile row and have them log out and back in.</p>
          <p className="hb-p"><strong>Stale session</strong> — Have them fully close the browser and log back in.</p>
        </div>
      </div>
    )
  },
  12: {
    tag: 'Users & Settings',
    title: 'Settings & Plan Year',
    intro: 'The Settings page controls the active plan year, open enrollment status, and other global configuration that affects all users of KIAA Connect.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hb-h3">OE status options</h3>
          <table className="hb-table">
            <thead><tr><th>Status</th><th>What HR clients see</th></tr></thead>
            <tbody>
              <tr><td>Not started</td><td>"Open enrollment has not started yet"</td></tr>
              <tr><td>Open</td><td>Full OE form — plan selection, FTE update, compliance acknowledgments</td></tr>
              <tr><td>Closed</td><td>"The enrollment window has passed. Contact KIAA if you need to make changes."</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hb-h3">Annual plan year transition checklist</h3>
          <div className="space-y-1 mt-2">
            {['Upload new HMSA band rates for all 9 bands','Upload new SBCs for all plans (from HMSA)','Upload new Kaiser rates for all schedules (B, D, I)','Update active plan year in Settings','Set OE status to Open','Notify all HR clients that OE is open','Collect OE submissions before September 10 deadline','Submit confirmed elections to HMSA','Set OE status to Closed after submission deadline'].map((item,i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-surface-50 text-sm text-surface-500">
                <span className="hb-check">☐</span>{item}
              </div>
            ))}
          </div>
        </div>
        <div className="hb-tip"><span>💡</span><div><strong>HMSA submission deadline</strong><br/>Submit all plan elections to HMSA by the <strong>10th of the month prior to the effective date</strong>. Missing this deadline may delay employee coverage.</div></div>
      </div>
    )
  },
}

export default function HandbookPage() {
  const [active, setActive] = useState(1)
  const section = CONTENT[active]
  const currentIdx = ALL_ITEMS.findIndex(i => i.num === active)
  const prev = currentIdx > 0 ? ALL_ITEMS[currentIdx - 1] : null
  const next = currentIdx < ALL_ITEMS.length - 1 ? ALL_ITEMS[currentIdx + 1] : null

  return (
    <div className="p-8 page-enter">

      {/* Page header — same pattern as every other page */}
      <div className="mb-7">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Admin Handbook</h1>
        <p className="text-surface-400 text-sm mt-1">Internal documentation for KIAA staff · connect.kiaahilo.org</p>
      </div>

      <div className="flex gap-6 items-start">

        {/* TOC */}
        <div className="w-52 flex-shrink-0 sticky top-4">
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100">
              <span className="section-title mb-0 text-sm">Contents</span>
            </div>
            <nav className="p-2">
              {SECTIONS.map(group => (
                <div key={group.group} className="mb-3">
                  <div className="px-2 mb-1 text-xs font-bold uppercase text-surface-300" style={{ letterSpacing: '0.1em', fontSize: '9px' }}>
                    {group.group}
                  </div>
                  {group.items.map(item => {
                    const isActive = active === item.num
                    return (
                      <button key={item.num} onClick={() => setActive(item.num)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all mb-0.5 border-l-2 ${
                          isActive
                            ? 'bg-kiaa-50 border-kiaa-500'
                            : 'border-transparent hover:bg-surface-50 hover:border-surface-200'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded flex items-center justify-center font-bold flex-shrink-0 ${
                          isActive ? 'bg-kiaa-600 text-white' : 'bg-surface-100 text-surface-400'
                        }`} style={{ fontSize: '9px' }}>
                          {item.num}
                        </span>
                        <span className={`text-xs leading-tight ${isActive ? 'font-semibold text-kiaa-700' : 'text-surface-500'}`}>
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="card">

            {/* Section tag + title */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-kiaa-700 flex-shrink-0`}>
                {active}
              </span>
              <span className="text-xs font-bold uppercase text-kiaa-500" style={{ letterSpacing: '0.12em' }}>
                {section.tag}
              </span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-kiaa-700 mb-2">{section.title}</h2>
            <p className="text-surface-400 text-sm leading-relaxed mb-6 pb-5 border-b border-surface-100">
              {section.intro}
            </p>

            {/* Body */}
            <section.body />

            {/* Prev / Next */}
            <div className="flex justify-between mt-8 pt-5 border-t border-surface-100 gap-3">
              {prev ? (
                <button onClick={() => setActive(prev.num)} className="btn flex items-center gap-2">
                  <span className="text-surface-300">←</span>
                  <div className="text-left">
                    <div className="label mb-0">Previous</div>
                    <div className="text-sm font-semibold text-surface-600">{prev.label}</div>
                  </div>
                </button>
              ) : <div />}
              {next ? (
                <button onClick={() => setActive(next.num)} className="btn flex items-center gap-2">
                  <div className="text-right">
                    <div className="label mb-0">Next</div>
                    <div className="text-sm font-semibold text-surface-600">{next.label}</div>
                  </div>
                  <span className="text-surface-300">→</span>
                </button>
              ) : <div />}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hb-h3 {
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-weight: 600;
          font-size: 17px; color: #263944;
          margin-top: 20px; margin-bottom: 8px;
          letter-spacing: -0.01em;
        }
        .hb-p {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13.5px; color: #7A746E;
          line-height: 1.65; margin-bottom: 10px;
        }
        .hb-table {
          width: 100%; border-collapse: collapse;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px; margin-bottom: 12px;
          border: 1px solid #BED8E1; overflow: hidden; border-radius: 8px;
        }
        .hb-table th {
          background: #263944; color: #fff;
          padding: 9px 14px; text-align: left;
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .hb-table td {
          padding: 9px 14px; border-bottom: 1px solid #BED8E1;
          color: #7A746E; vertical-align: top;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .hb-table tr:last-child td { border-bottom: none; }
        .hb-table tr:nth-child(even) td { background: #F4F6FA; }
        .hb-tip {
          background: #EDF2F6; border: 1px solid #BED8E1;
          border-left: 3px solid #385262; border-radius: 8px;
          padding: 12px 14px; display: flex; gap: 10px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px; color: #385262; line-height: 1.55; margin: 14px 0;
        }
        .hb-warn {
          background: #FFFBEB; border: 1px solid #FCD34D;
          border-left: 3px solid #D97706; border-radius: 8px;
          padding: 12px 14px; display: flex; gap: 10px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px; color: #78350F; line-height: 1.55; margin: 14px 0;
        }
        .hb-steps { margin: 12px 0; }
        .hb-step { display: flex; gap: 12px; margin-bottom: 14px; }
        .hb-step-num {
          width: 26px; height: 26px; border-radius: 50%;
          background: #263944; color: #fff;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 2px;
        }
        .hb-step-title {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13.5px; font-weight: 700;
          color: #263944; margin-bottom: 3px;
        }
        .hb-step-desc {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px; color: #7A746E; line-height: 1.55;
        }
        .hb-flow { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin: 12px 0; }
        .hb-flow-box {
          background: #263944; color: #fff;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px; font-weight: 600;
          padding: 7px 12px; border-radius: 7px;
        }
        .hb-flow-accent { background: #385262; color: #fff; }
        .hb-flow-muted  { background: #EDF2F6; color: #7A746E; }
        .hb-flow-arrow  { color: #84AAC1; font-size: 16px; font-weight: 300; }
        .hb-check { color: #385262; font-size: 14px; flex-shrink: 0; }
        .badge-admin {
          background: #FEF3C7; color: #78350F; border: 1px solid #FCD34D;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px; font-weight: 700; padding: 2px 8px;
          border-radius: 4px; letter-spacing: 0.02em;
        }
        .badge-staff {
          background: #EDF2F6; color: #496B80; border: 1px solid #BED8E1;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px; font-weight: 700; padding: 2px 8px;
          border-radius: 4px; letter-spacing: 0.02em;
        }
        .badge-hr {
          background: #EDF2F6; color: #263944; border: 1px solid #BED8E1;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px; font-weight: 700; padding: 2px 8px;
          border-radius: 4px; letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  )
}
