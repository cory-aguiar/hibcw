import { useState } from 'react'

const SECTIONS = [
  {
    group: 'Getting started',
    items: [
      { num: 1, label: 'Welcome',               sub: 'What KIAA Connect is and how to use it' },
      { num: 2, label: 'Your ACA health plans', sub: 'Understanding your plan options' },
      { num: 3, label: 'Understanding premiums',sub: 'How age-based pricing works' },
    ]
  },
  {
    group: 'Enrollment & changes',
    items: [
      { num: 4, label: 'Employee enrollment',   sub: 'Submitting enrollment forms to KIAA' },
      { num: 5, label: 'Employee changes',       sub: 'Adding, removing, and updating members' },
      { num: 6, label: 'FEIN & DOL requirements',sub: 'What they are and why they matter' },
    ]
  },
  {
    group: 'Obligations & billing',
    items: [
      { num: 7, label: 'Compliance',             sub: 'ACA and Hawaii state obligations' },
      { num: 8, label: 'Contact KIAA',           sub: 'Who to call and when' },
    ]
  },
]

const CONTENT = {
  1: {
    tag: 'Getting started',
    title: 'Welcome to KIAA Connect',
    intro: 'KIAA Connect is the online portal where you manage your company\'s ACA Small Group health benefit plan — from enrollment to employee changes and compliance tracking.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">What you can do here</h3>
          <div className="hh-grid">
            {[
              ['📄','My Plans','View your elected health plans and download plan documents and SBCs.'],
              ['📝','Forms & Resources','Access enrollment forms, JotForms, and resources from KIAA.'],
              ['✅','Compliance','Track your COBRA, FMLA, ERISA, and PHCA obligations.'],
              ['🗂️','Tasks','Complete action items assigned to your company by KIAA.'],
            ].map(([icon,title,desc]) => (
              <div key={title} className="hh-feature-card">
                <div className="hh-feature-icon">{icon}</div>
                <div><div className="hh-feature-title">{title}</div><div className="hh-feature-desc">{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="hh-h3">How to log in</h3>
          <div className="hh-steps">
            {[
              ['Go to connect.kiaahilo.org','Open your browser and navigate to the KIAA Connect portal.'],
              ['Enter your email and password','Use the email address on file with KIAA and the password you set when you registered.'],
              ['First time? Use your company code','If you haven\'t registered yet, click "Register" and enter your 6-character company code provided by KIAA.'],
            ].map(([t,d],i) => (
              <div key={i} className="hh-step">
                <div className="hh-step-num">{i+1}</div>
                <div><div className="hh-step-title">{t}</div><div className="hh-step-desc">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="hh-tip"><span>💡</span><div><strong>Forgot your password?</strong> Click "Forgot password" on the login page and a reset link will be sent to your email.</div></div>
      </div>
    )
  },
  2: {
    tag: 'Getting started',
    title: 'Your ACA health plans',
    intro: 'As an ACA Small Group, your company offers HMSA health plans under the Affordable Care Act. You can offer one or more plans to your employees, giving them the option to choose the coverage that fits their needs.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">Available ACA plans</h3>
          <table className="hh-table">
            <thead><tr><th>Plan</th><th>Type</th><th>Coverage options</th></tr></thead>
            <tbody>
              <tr><td>Preferred Provider Plan (PPP)</td><td>PPO</td><td>Full Package or Medical Only</td></tr>
              <tr><td>CompMED A</td><td>PPO</td><td>Full Package or Medical Only</td></tr>
              <tr><td>Health Plan Hawaii Plus</td><td>HMO</td><td>Full Package only</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hh-h3">PPO vs HMO</h3>
          <p className="hh-p"><strong>PPO plans</strong> (Preferred Provider Plan, CompMED A) allow employees to see any doctor in or out of network without a referral. They offer more flexibility but typically have higher premiums.</p>
          <p className="hh-p"><strong>HMO plans</strong> (Health Plan Hawaii Plus) require employees to choose a primary care physician and get referrals to see specialists. They offer comprehensive coverage within the network.</p>
        </div>
        <div>
          <h3 className="hh-h3">Full Package vs Medical Only</h3>
          <p className="hh-p"><strong>Full Package</strong> includes Medical, Drug, Vision (adult), Dental, and Group Life/AD&D. This is the most comprehensive option and the most common choice for ACA groups.</p>
          <p className="hh-p"><strong>Medical Only</strong> includes medical coverage only. Available on PPO plans. Employees would need to obtain Drug, Vision, Dental, and Life coverage separately.</p>
        </div>
        <div>
          <h3 className="hh-h3">KIAA Riders Package</h3>
          <p className="hh-p">The Riders Package (Vision, Dental, Group Life/AD&D) is included in all Full Package plans. Group Life/AD&D requires each employee to complete a separate enrollment form to designate their beneficiaries — this form is available in your portal's Forms & resources section.</p>
        </div>
        <div>
          <h3 className="hh-h3">Downloading plan documents</h3>
          <p className="hh-p">Go to <strong>My Plans</strong> in the sidebar to view your elected plans and download the Summary of Benefits and Coverage (SBC). Share SBCs with your employees so they understand their coverage.</p>
        </div>
        <div>
          <h3 className="hh-h3">Your HMSA membership cards</h3>
          <p className="hh-p">Every employee enrolled in a Full Package plan receives <strong>2 HMSA membership cards</strong> — one for Medical/Drug, one for Dental/Vision (Riders). Employees on Medical Only plans receive only the Medical/Drug card. The My Plans section of your portal has a full visual guide explaining each card and when to use it.</p>
          <div className="hh-tip"><span>💡</span><div>Share the card guide in <strong>My Plans → Understanding your HMSA membership cards</strong> with your employees when their cards arrive so they know which card to use at each provider.</div></div>
        </div>
      </div>
    )
  },
  3: {
    tag: 'Getting started',
    title: 'Understanding your premiums',
    intro: 'ACA Small Group premiums are calculated based on the age of each individual enrolled member — not a flat group rate. This means every employee and dependent has their own premium amount based on their date of birth.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">How age-based pricing works</h3>
          <p className="hh-p">HMSA publishes age-based rate tables each plan year. Each enrolled person's premium is calculated individually using their age as of the coverage start date. This is different from Merit Rated Group plans where everyone in a tier pays the same amount.</p>
          <div className="hh-info"><span>ℹ️</span><div><strong>Example:</strong> A 45-year-old employee will have a different monthly premium than a 28-year-old employee, even if they're both enrolled in the same plan with the same coverage tier.</div></div>
        </div>
        <div>
          <h3 className="hh-h3">Coverage tiers</h3>
          <table className="hh-table">
            <thead><tr><th>Tier</th><th>Who it covers</th></tr></thead>
            <tbody>
              <tr><td>Employee only</td><td>The enrolled employee — age-based rate for employee</td></tr>
              <tr><td>Employee + dependent</td><td>Employee plus one dependent — each priced by their own age</td></tr>
              <tr><td>Employee + family</td><td>Employee plus two or more dependents — each priced individually</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hh-h3">What's included in the premium</h3>
          <p className="hh-p">For Full Package plans, your monthly premium includes Medical, Drug, Vision, Dental, and Group Life/AD&D. The rates for Drug, Vision, Dental, and Life are fixed amounts added to the age-based medical rate.</p>
          <p className="hh-p">The KIAA administrative fee of <strong>$4.00 per enrolled employee per month</strong> is charged separately and is not included in the HMSA stated premium.</p>
        </div>
        <div>
          <h3 className="hh-h3">Pediatric dental & vision</h3>
          <p className="hh-p">Dependent children under age 19 are covered for dental and vision at no additional cost under the ACA's pediatric benefit requirements. Their premiums reflect this — you will not see separate dental/vision charges for minor children.</p>
        </div>
        <div>
          <h3 className="hh-h3">Premium changes</h3>
          <p className="hh-p">Premiums may change each year when HMSA publishes new rate tables. They may also change mid-year if a covered member's age changes significantly. KIAA will notify you of any changes that affect your monthly cost.</p>
        </div>
        <div className="hh-tip"><span>💡</span><div><strong>Questions about your premium?</strong> Contact KIAA at (808) 961-5422 and we can walk through the calculation for each of your covered members.</div></div>
      </div>
    )
  },
  4: {
    tag: 'Enrollment & changes',
    title: 'Employee enrollment',
    intro: 'When an employee joins your ACA plan, they must complete individual enrollment forms before their coverage can begin. These forms contain protected health information and are submitted directly to KIAA — not through the portal.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">How to submit enrollment forms</h3>
          <table className="hh-table">
            <thead><tr><th>Method</th><th>Details</th></tr></thead>
            <tbody>
              <tr><td>Paubox secure upload</td><td>Use the secure Paubox link provided by KIAA to upload completed forms electronically</td></tr>
              <tr><td>Fax</td><td>(808) 935-9740</td></tr>
              <tr><td>In person</td><td>820 Piilani St., Suite 201, Hilo, HI 96720</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hh-h3">Group Life/AD&D enrollment</h3>
          <p className="hh-p">Each employee enrolled in a Full Package plan must complete a separate <strong>Group Life Enrollment & Change Form</strong> to designate their beneficiaries. This form is available in the <strong>Forms & resources</strong> section of your portal. Employees can update their beneficiary designations at any time.</p>
        </div>
        <div>
          <h3 className="hh-h3">Enrollment deadlines</h3>
          <p className="hh-p">Enrollment forms must be returned to KIAA by the <strong>5th of the month</strong> prior to the desired coverage start date. KIAA submits to HMSA by the 10th, and coverage begins on the 1st of the following month.</p>
          <div className="hh-info"><span>ℹ️</span><div><strong>Example:</strong> For July 1 coverage, enrollment forms must be at KIAA by June 5.</div></div>
        </div>
        <div className="hh-warn"><span>⚠️</span><div><strong>Do not email forms with PHI</strong><br/>Enrollment forms contain Social Security Numbers, dates of birth, and other protected health information. Do not send via regular email — use Paubox, fax, or in person only.</div></div>
      </div>
    )
  },
  5: {
    tag: 'Enrollment & changes',
    title: 'Employee changes',
    intro: 'Changes to your covered members — new hires, terminations, new dependents, and life events — must be reported to KIAA promptly. Because ACA premiums are age-based, changes affect your monthly cost.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">Qualifying life events</h3>
          <p className="hh-p">Employees can make coverage changes outside of open enrollment when a qualifying life event occurs. Common qualifying events include:</p>
          <table className="hh-table">
            <thead><tr><th>Event</th><th>What to do</th><th>Deadline</th></tr></thead>
            <tbody>
              <tr><td>New hire</td><td>Submit enrollment form to KIAA</td><td>Within 30 days of hire date</td></tr>
              <tr><td>Employee termination</td><td>Notify KIAA immediately</td><td>As soon as possible</td></tr>
              <tr><td>Marriage</td><td>Submit change form to add spouse</td><td>Within 30 days of marriage</td></tr>
              <tr><td>New baby or adoption</td><td>Submit change form to add dependent</td><td>Within 30 days of birth/adoption</td></tr>
              <tr><td>Dependent turns 26</td><td>Notify KIAA — dependent loses coverage</td><td>As soon as possible</td></tr>
              <tr><td>Divorce</td><td>Notify KIAA — spouse may lose coverage</td><td>Within 30 days</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hh-warn"><span>⚠️</span><div><strong>Terminations trigger COBRA</strong><br/>When an employee or dependent loses coverage, you must send a COBRA notice within 14 days. Use the COBRA Notices section in your portal to generate required notices.</div></div>
        <div>
          <h3 className="hh-h3">How changes affect premiums</h3>
          <p className="hh-p">Because ACA premiums are age-based, adding or removing members changes your monthly total. When a new member is added, KIAA will calculate their premium based on their date of birth and notify you of the updated amount.</p>
        </div>
      </div>
    )
  },
  6: {
    tag: 'Enrollment & changes',
    title: 'FEIN & DOL requirements',
    intro: 'All ACA Small Group enrollments require a Federal Employer Identification Number (FEIN) and a Hawaii Department of Labor (DOL) registration number. These are required by HMSA before coverage can be issued.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">What is a FEIN?</h3>
          <p className="hh-p">A Federal Employer Identification Number (FEIN), also called an EIN, is a 9-digit number assigned by the IRS to identify your business for tax purposes. It is required for all employer-sponsored health plans.</p>
          <p className="hh-p">If you don't have a FEIN yet, you can apply for one free at <strong>irs.gov/ein</strong>. The process takes about 10 minutes and you'll receive your number immediately.</p>
        </div>
        <div>
          <h3 className="hh-h3">What is a Hawaii DOL number?</h3>
          <p className="hh-p">The Hawaii Department of Labor requires all employers to register their business. Your DOL number (employer registration number) is issued by the Hawaii Department of Labor and Industrial Relations (DLIR). This number is required for all Hawaii group health plan enrollments.</p>
        </div>
        <div>
          <h3 className="hh-h3">How to submit your FEIN and DOL number</h3>
          <p className="hh-p">Submit your FEIN and DOL number to KIAA via the secure JotForm link available in the <strong>Forms & resources</strong> section of your portal. Do not send these numbers via regular email.</p>
          <div className="hh-warn"><span>⚠️</span><div><strong>KIAA cannot prepare your quote until these are received</strong><br/>Your FEIN and DOL number are required before KIAA can prepare and deliver your quote. Please submit via JotForm as soon as possible after submitting your census.</div></div>
        </div>
        <div className="hh-tip"><span>💡</span><div><strong>Need help?</strong> Call KIAA at (808) 961-5422 if you have questions about obtaining your FEIN or DOL number. We can guide you through the process.</div></div>
      </div>
    )
  },
  7: {
    tag: 'Obligations & billing',
    title: 'Compliance',
    intro: 'As an ACA Small Group employer, you have compliance obligations under both federal and Hawaii state law. These obligations depend on the size of your workforce and are tracked in the Compliance section of your portal.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">Key compliance areas</h3>
          <table className="hh-table">
            <thead><tr><th>Law</th><th>What it requires</th><th>Applies to</th></tr></thead>
            <tbody>
              <tr><td>ACA</td><td>Employers with 50+ FTEs must offer coverage to full-time employees or face penalties</td><td>50+ full-time equivalent employees</td></tr>
              <tr><td>COBRA</td><td>Offer continuation coverage to employees and dependents who lose coverage</td><td>Employers with 20+ employees</td></tr>
              <tr><td>FMLA</td><td>Provide up to 12 weeks of unpaid, job-protected leave for qualifying events</td><td>Employers with 50+ employees</td></tr>
              <tr><td>ERISA</td><td>Provide plan documents and Summary Plan Descriptions to employees</td><td>All employer health plans</td></tr>
              <tr><td>PHCA</td><td>Hawaii Prepaid Health Care Act — provide health coverage to qualifying Hawaii employees</td><td>All Hawaii employers</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hh-h3">COBRA notices</h3>
          <p className="hh-p">When an employee or covered dependent loses health coverage, a COBRA notice must be sent within 14 days. Go to <strong>COBRA Notices</strong> in the portal to generate required notices.</p>
        </div>
        <div>
          <h3 className="hh-h3">ACA minimum value & affordability</h3>
          <p className="hh-p">ACA plans offered through KIAA are designed to meet minimum value requirements. Coverage is considered affordable if the employee's share of the premium for employee-only coverage does not exceed a set percentage of their household income. KIAA can advise on affordability requirements for your group.</p>
        </div>
        <div className="hh-tip"><span>💡</span><div><strong>Questions about your compliance obligations?</strong> Call KIAA at (808) 961-5422. We can walk through which requirements apply to your group based on your headcount.</div></div>
      </div>
    )
  },
  8: {
    tag: 'Obligations & billing',
    title: 'Contact KIAA',
    intro: 'The KIAA team is here to help. Whether you have questions about your plans, need to submit forms, or need assistance with enrollment — reach out anytime.',
    body: () => (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4">
          {[
            ['📞','Phone','(808) 961-5422','Monday – Friday, business hours'],
            ['📠','Fax','(808) 935-9740','For enrollment forms and PHI documents'],
            ['📧','Email','admin@kiaahilo.org','General inquiries — response within 1 business day'],
            ['📍','In person','820 Piilani St., Suite 201\nHilo, HI 96720','Walk-ins welcome during business hours'],
          ].map(([icon,label,value,note]) => (
            <div key={label} className="hh-contact-card">
              <div className="hh-contact-icon">{icon}</div>
              <div>
                <div className="hh-contact-label">{label}</div>
                <div className="hh-contact-value" style={{whiteSpace:'pre-line'}}>{value}</div>
                <div className="hh-contact-note">{note}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h3 className="hh-h3">When to call</h3>
          <table className="hh-table">
            <thead><tr><th>Situation</th><th>Contact method</th></tr></thead>
            <tbody>
              <tr><td>New employee enrollment or termination</td><td>Fax or Paubox upload</td></tr>
              <tr><td>Questions about your premium or quote</td><td>Phone or email</td></tr>
              <tr><td>FEIN or DOL submission</td><td>JotForm (in Forms & resources)</td></tr>
              <tr><td>COBRA notice assistance</td><td>Phone</td></tr>
              <tr><td>Life event changes (marriage, new dependent)</td><td>Fax or Paubox upload</td></tr>
              <tr><td>Technical issues with KIAA Connect</td><td>Email</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  },
}

export default function HRHandbookACA() {
  const [active, setActive] = useState(null)
  const section = active ? CONTENT[active] : null

  function handleSelect(num) {
    setActive(num)
    setTimeout(() => {
      document.getElementById('hh-aca-section-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  return (
    <div className="space-y-6">
      {/* Cover */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(135deg, #f0fafa 0%, #EDF2F6 60%, #d4f0ef 100%)',
        border: '1px solid #BED8E1',
      }}>
        <div className="px-8 py-7">
          <div className="inline-flex items-center gap-1.5 bg-kiaa-700/10 border border-kiaa-700/20 text-kiaa-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            📘 HR Member Handbook — ACA Small Group
          </div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-800 mb-2 leading-tight">
            Your KIAA Benefits Guide
          </h1>
          <p className="text-kiaa-700 text-sm max-w-xl leading-relaxed mb-5">
            Everything you need to manage your company's ACA Small Group health benefits on KIAA Connect — from understanding age-based premiums to enrollment, compliance, and employee changes.
          </p>
          <div className="flex gap-6 flex-wrap pt-4 border-t border-kiaa-200">
            {[['Plan type','ACA Small Group (1–50 employees)'],['Premium basis','Age-based per member'],['Contact','(808) 961-5422']].map(([l,v]) => (
              <div key={l}>
                <div className="text-kiaa-600/60 text-xs uppercase tracking-wider font-medium mb-0.5">{l}</div>
                <div className="text-kiaa-800 text-sm font-medium">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOC */}
      <div className="space-y-5">
        {SECTIONS.map(group => (
          <div key={group.group}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">{group.group}</span>
              <div className="flex-1 h-px bg-surface-100"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map(item => (
                <button key={item.num}
                  onClick={() => handleSelect(item.num)}
                  className={`flex items-center gap-3 p-3 border rounded-xl text-left transition-all group ${
                    active === item.num
                      ? 'border-kiaa-400 bg-kiaa-50'
                      : 'border-surface-100 hover:border-kiaa-200 hover:bg-kiaa-50/50'
                  }`}>
                  <div className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                    active === item.num ? 'bg-kiaa-600 text-white' : 'bg-kiaa-100 text-kiaa-700'
                  }`}>
                    {item.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${active === item.num ? 'text-kiaa-700' : 'text-surface-700'}`}>{item.label}</div>
                    <div className="text-xs text-surface-400 mt-0.5 truncate">{item.sub}</div>
                  </div>
                  <span className={`text-sm ${active === item.num ? 'text-kiaa-500' : 'text-surface-200 group-hover:text-kiaa-300'}`}>→</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      {active && section && (
        <div id="hh-aca-section-content" className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-kiaa-100 text-kiaa-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{active}</div>
            <span className="text-xs font-semibold text-kiaa-500 uppercase tracking-wider">{section.tag}</span>
          </div>
          <h2 className="font-display text-xl font-semibold text-kiaa-700 mb-2">{section.title}</h2>
          <p className="text-surface-500 text-sm leading-relaxed mb-5 pb-4 border-b border-surface-100">{section.intro}</p>
          <section.body />
        </div>
      )}

      {!active && (
        <div className="text-center py-6 text-surface-400 text-sm">Select a topic above to get started.</div>
      )}

      <style>{`
        .hh-h3 { font-size:15px; font-weight:600; color:#263944; margin-top:14px; margin-bottom:8px; }
        .hh-p  { font-size:13.5px; color:#374151; line-height:1.65; margin-bottom:10px; }
        .hh-table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:12px; }
        .hh-table th { background:#EDF2F6; color:#263944; padding:8px 12px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #BED8E1; }
        .hh-table td { padding:8px 12px; border-bottom:1px solid #f0fafa; color:#374151; vertical-align:top; }
        .hh-table tr:nth-child(even) td { background:#f7fdfc; }
        .hh-tip { background:#EDF2F6; border:1px solid #6595B2; border-radius:10px; padding:12px 14px; display:flex; gap:10px; font-size:13px; color:#263944; line-height:1.5; margin:12px 0; }
        .hh-warn { background:#fef9ec; border:1px solid #f59e0b; border-radius:10px; padding:12px 14px; display:flex; gap:10px; font-size:13px; color:#78350f; line-height:1.5; margin:12px 0; }
        .hh-info { background:#EDF2F6; border:1px solid #BED8E1; border-radius:10px; padding:12px 14px; display:flex; gap:10px; font-size:13px; color:#263944; line-height:1.5; margin:12px 0; }
        .hh-steps { margin:12px 0; }
        .hh-step { display:flex; gap:12px; margin-bottom:12px; }
        .hh-step-num { width:26px; height:26px; border-radius:50%; background:#263944; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
        .hh-step-title { font-size:13.5px; font-weight:600; color:#263944; margin-bottom:2px; }
        .hh-step-desc { font-size:13px; color:#374151; line-height:1.55; }
        .hh-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0; }
        .hh-feature-card { display:flex; gap:10px; align-items:flex-start; background:#f7fdfc; border:1px solid #d4f0ef; border-radius:10px; padding:12px; }
        .hh-feature-icon { font-size:20px; flex-shrink:0; }
        .hh-feature-title { font-size:13px; font-weight:600; color:#263944; margin-bottom:2px; }
        .hh-feature-desc { font-size:12px; color:#374151; line-height:1.45; }
        .hh-contact-card { display:flex; gap:12px; align-items:flex-start; background:#f7fdfc; border:1px solid #d4f0ef; border-radius:10px; padding:14px; }
        .hh-contact-icon { font-size:22px; flex-shrink:0; }
        .hh-contact-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#6b8f8e; margin-bottom:2px; }
        .hh-contact-value { font-size:14px; font-weight:600; color:#263944; margin-bottom:2px; }
        .hh-contact-note { font-size:12px; color:#6b8f8e; }
      `}</style>
    </div>
  )
}
