import { useState } from 'react'

const SECTIONS = [
  {
    group: 'Getting started',
    items: [
      { num: 1, label: 'Welcome',             sub: 'What KIAA Connect is and how to use it' },
      { num: 2, label: 'Your health plans',   sub: 'Understanding your elected plans' },
    ]
  },
  {
    group: 'Enrollment & changes',
    items: [
      { num: 3, label: 'Open enrollment',     sub: 'How to submit your annual elections' },
      { num: 4, label: 'Employee enrollment', sub: 'Submitting enrollment forms to KIAA' },
      { num: 5, label: 'Employee changes',    sub: 'Adding, removing, and updating members' },
    ]
  },
  {
    group: 'Obligations & billing',
    items: [
      { num: 6, label: 'Compliance',          sub: 'COBRA, FMLA, ERISA, PHCA obligations' },
      { num: 7, label: 'Your premiums',       sub: 'Understanding monthly premium billing' },
      { num: 8, label: 'Contact KIAA',        sub: 'Who to call and when' },
    ]
  },
]

const CONTENT = {
  1: {
    tag: 'Getting started',
    title: 'Welcome to KIAA Connect',
    intro: 'KIAA Connect is the online portal where you manage your company\'s health benefit plan year-round — from open enrollment to employee changes to compliance tracking.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">What you can do here</h3>
          <div className="hh-grid">
            {[
              ['📋','Open Enrollment','Submit your annual plan elections each year before October 1.'],
              ['📄','My Plans','View your elected health plans and download plan documents and SBCs.'],
              ['✅','Compliance','Track your COBRA, FMLA, ERISA, and PHCA obligations and deadlines.'],
              ['📝','Forms & Resources','Access enrollment forms, JotForms, and other resources from KIAA.'],
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
    title: 'Your health plans',
    intro: 'As a Merit Rated Group member, your company\'s health plans are selected during open enrollment each year. Your premiums are based on your HMSA rate band — a fixed monthly amount by coverage tier.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">How MRG premiums work</h3>
          <p className="hh-p">Unlike individual health insurance, MRG premiums are based on your group's rate band — not the ages of your employees. Your monthly premium is the same flat rate regardless of who is enrolled, based on the coverage tier:</p>
          <table className="hh-table">
            <thead><tr><th>Coverage tier</th><th>Who it covers</th></tr></thead>
            <tbody>
              <tr><td>Employee only</td><td>The enrolled employee only</td></tr>
              <tr><td>Employee + 1 dependent</td><td>Employee plus one dependent (spouse or child)</td></tr>
              <tr><td>Employee + family</td><td>Employee plus two or more dependents</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hh-h3">Available plans</h3>
          <p className="hh-p">HMSA offers several plan types for MRG groups. Your KIAA representative will advise which plans are available for your rate band.</p>
          <table className="hh-table">
            <thead><tr><th>Plan</th><th>Type</th><th>Coverage</th></tr></thead>
            <tbody>
              <tr><td>Preferred Provider Plan (PPP)</td><td>PPO</td><td>Full Package or Medical Only</td></tr>
              <tr><td>CompMED A</td><td>PPO</td><td>Full Package or Medical Only</td></tr>
              <tr><td>Health Plan Hawaii Plus</td><td>HMO</td><td>Full Package only</td></tr>
              <tr><td>CompMED B</td><td>PPO</td><td>Full Package or Medical Only</td></tr>
              <tr><td>Health Plan Hawaii Basic</td><td>HMO</td><td>Full Package only</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hh-h3">Full Package vs Medical Only</h3>
          <p className="hh-p"><strong>Full Package</strong> includes Medical, Drug, Vision (adult), Dental, and Group Life/AD&D. This is the most comprehensive option.</p>
          <p className="hh-p"><strong>Medical Only</strong> includes Medical coverage only. Drug, Vision, Dental, and Life/AD&D are not included. Available on PPO plans only.</p>
        </div>
        <div>
          <h3 className="hh-h3">COMPCARE (optional add-on)</h3>
          <p className="hh-p">COMPCARE covers acupuncture, massage therapy, and the Active & Fit gym membership program. It is an optional add-on for employees — not available for dependents. Ask your KIAA representative if your group is enrolled.</p>
        </div>
        <div>
          <h3 className="hh-h3">Downloading plan documents</h3>
          <p className="hh-p">Go to <strong>My Plans</strong> in the sidebar to view your elected plans and download the Summary of Benefits and Coverage (SBC) for each plan. The SBC is the official document that describes what your plan covers and what you pay.</p>
        </div>
      </div>
    )
  },
  3: {
    tag: 'Enrollment & changes',
    title: 'Open enrollment',
    intro: 'Open enrollment happens once a year before October 1. This is your opportunity to review and update the health plans you offer your employees for the coming plan year (October 1 – September 30).',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">When OE is open</h3>
          <p className="hh-p">KIAA opens enrollment each year in August. You'll see an action item in your portal and receive an email notification. The deadline to submit is typically <strong>September 10</strong> so KIAA can submit elections to HMSA on time.</p>
        </div>
        <div>
          <h3 className="hh-h3">How to complete open enrollment</h3>
          <div className="hh-steps">
            {[
              ['Log in and go to Open Enrollment','Click "Open Enrollment" in the left sidebar. You\'ll see your current plan elections.'],
              ['Review and select plans','Choose which health plans to offer your employees for the new plan year. You can select multiple plans.'],
              ['Update your FTE headcount','Enter the current number of full-time and part-time employees. This determines your compliance obligations (COBRA, FMLA, etc.).'],
              ['Acknowledge compliance','Review and check the compliance acknowledgments for COBRA, FMLA, ERISA, and PHCA.'],
              ['Submit','Click Submit to send your elections to KIAA. You\'ll receive a confirmation.'],
            ].map(([t,d],i) => (
              <div key={i} className="hh-step">
                <div className="hh-step-num">{i+1}</div>
                <div><div className="hh-step-title">{t}</div><div className="hh-step-desc">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="hh-warn"><span>⚠️</span><div><strong>Don't miss the deadline</strong><br/>KIAA must submit all elections to HMSA by September 10. If you miss the deadline, your coverage may not be updated in time for October 1.</div></div>
        <div className="hh-tip"><span>💡</span><div><strong>No changes?</strong> You still need to complete open enrollment every year. If you're keeping the same plans, simply confirm your elections and submit.</div></div>
      </div>
    )
  },
  4: {
    tag: 'Enrollment & changes',
    title: 'Employee enrollment',
    intro: 'When a new employee joins your company, they need to complete individual enrollment forms before their coverage can begin. These forms are submitted directly to KIAA — not through the portal.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">How to submit enrollment forms</h3>
          <p className="hh-p">Enrollment forms contain protected health information (PHI) and cannot be submitted through KIAA Connect. Use one of the following secure methods:</p>
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
          <p className="hh-p">If your group is enrolled in the Full Package (which includes Group Life/AD&D), each employee must also complete a separate <strong>Group Life Enrollment & Change Form</strong> to designate their beneficiaries. This form is available in the <strong>Forms & resources</strong> section of your portal.</p>
        </div>
        <div>
          <h3 className="hh-h3">Enrollment deadlines</h3>
          <p className="hh-p">New employee enrollment forms must be returned to KIAA by the <strong>5th of the month</strong> prior to their desired coverage start date. KIAA then submits to HMSA by the 10th. Coverage typically begins on the 1st of the following month.</p>
        </div>
        <div className="hh-tip"><span>💡</span><div><strong>Download enrollment forms</strong> from the Forms & resources section of your portal. Contact KIAA at (808) 961-5422 if you need a form that isn't listed.</div></div>
      </div>
    )
  },
  5: {
    tag: 'Enrollment & changes',
    title: 'Employee changes',
    intro: 'Life events — new hires, terminations, marriages, new dependents — may require updates to your group\'s coverage. Most changes must be reported to KIAA within 30 days of the event.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">Types of changes</h3>
          <table className="hh-table">
            <thead><tr><th>Event</th><th>What to do</th><th>Deadline</th></tr></thead>
            <tbody>
              <tr><td>New hire</td><td>Submit enrollment form to KIAA</td><td>Within 30 days of hire date</td></tr>
              <tr><td>Employee termination</td><td>Notify KIAA immediately</td><td>As soon as possible</td></tr>
              <tr><td>New dependent (marriage, birth, adoption)</td><td>Submit change form to KIAA</td><td>Within 30 days of event</td></tr>
              <tr><td>Dependent loses coverage (divorce, age 26)</td><td>Notify KIAA immediately</td><td>As soon as possible</td></tr>
              <tr><td>Name or address change</td><td>Submit change form to KIAA</td><td>At your earliest convenience</td></tr>
            </tbody>
          </table>
        </div>
        <div className="hh-warn"><span>⚠️</span><div><strong>Terminations trigger COBRA</strong><br/>When an employee or dependent loses coverage due to termination or a qualifying event, you are required to send a COBRA notice within 14 days. Use the COBRA Notices section in your portal to generate the required notice.</div></div>
        <div>
          <h3 className="hh-h3">How to submit change forms</h3>
          <p className="hh-p">Change forms contain protected health information and must be submitted via Paubox secure upload, fax (808) 935-9740, or in person at the KIAA office. Do not email forms containing employee SSNs, dates of birth, or medical information.</p>
        </div>
      </div>
    )
  },
  6: {
    tag: 'Obligations & billing',
    title: 'Compliance',
    intro: 'As an employer offering group health benefits, you have ongoing legal obligations under federal and Hawaii state law. The Compliance section of your portal tracks these requirements and their deadlines.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">Key compliance areas</h3>
          <table className="hh-table">
            <thead><tr><th>Law</th><th>What it requires</th><th>Applies to</th></tr></thead>
            <tbody>
              <tr><td>COBRA</td><td>Offer continuation coverage to employees and dependents who lose coverage</td><td>Employers with 20+ employees</td></tr>
              <tr><td>FMLA</td><td>Provide up to 12 weeks of unpaid, job-protected leave for qualifying events</td><td>Employers with 50+ employees</td></tr>
              <tr><td>ERISA</td><td>Provide plan documents and Summary Plan Descriptions to employees</td><td>All employer health plans</td></tr>
              <tr><td>PHCA</td><td>Hawaii Prepaid Health Care Act — employers must provide health coverage to qualifying employees</td><td>All Hawaii employers</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="hh-h3">COBRA notices</h3>
          <p className="hh-p">When an employee or covered dependent loses health coverage, a COBRA notice must be sent within 14 days. Go to <strong>COBRA Notices</strong> in the left sidebar to generate and track required notices for your company.</p>
        </div>
        <div className="hh-tip"><span>💡</span><div><strong>Update your headcount annually</strong><br/>Your FTE headcount (entered during open enrollment) determines which compliance laws apply to your company. Keep it current — it affects your COBRA, FMLA, and ERISA obligations.</div></div>
      </div>
    )
  },
  7: {
    tag: 'Obligations & billing',
    title: 'Your premiums',
    intro: 'Your monthly health insurance premiums are based on your HMSA rate band, the plans you\'ve elected, and the coverage tiers of your enrolled employees.',
    body: () => (
      <div className="space-y-5">
        <div>
          <h3 className="hh-h3">How premiums are calculated</h3>
          <p className="hh-p">MRG premiums are <strong>flat-rate by tier</strong> — every employee pays the same amount based on their coverage level (Employee only, Employee + 1 dependent, or Employee + family). Rates are set by HMSA and take effect October 1 each year.</p>
        </div>
        <div>
          <h3 className="hh-h3">What's included</h3>
          <p className="hh-p">For <strong>Full Package</strong> plans, your premium includes Medical, Drug, Vision, Dental, and Group Life/AD&D. For <strong>Medical Only</strong> plans, only Medical is included.</p>
          <p className="hh-p">The KIAA administrative fee of <strong>$4.00 per enrolled employee per month</strong> is charged separately and is not included in HMSA's stated premium.</p>
        </div>
        <div>
          <h3 className="hh-h3">7(a) vs 7(b) plans</h3>
          <p className="hh-p"><strong>7(a) plans</strong> provide benefits equal to or better than the state's prevalent plan. <strong>7(b) plans</strong> may have more limited benefits. Importantly, under 7(b) plans <strong>employers are required to pay at least half of the cost of dependent coverage</strong>.</p>
        </div>
        <div className="hh-tip"><span>💡</span><div><strong>Questions about your bill?</strong> Contact KIAA at (808) 961-5422 or admin@kiaahilo.org. Have your company code ready.</div></div>
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
              <tr><td>Employee starting or leaving — enrollment/termination forms</td><td>Fax or Paubox upload</td></tr>
              <tr><td>Questions about plan coverage or benefits</td><td>Phone or email</td></tr>
              <tr><td>Open enrollment questions</td><td>Phone or email</td></tr>
              <tr><td>COBRA notice assistance</td><td>Phone</td></tr>
              <tr><td>Premium billing questions</td><td>Phone or email</td></tr>
              <tr><td>Technical issues with KIAA Connect</td><td>Email</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  },
}

export default function HRHandbookMRG() {
  const [active, setActive] = useState(null)
  const section = active ? CONTENT[active] : null

  function handleSelect(num) {
    setActive(num)
    setTimeout(() => {
      document.getElementById('hh-section-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
            📗 HR Member Handbook — Merit Rated Group
          </div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-800 mb-2 leading-tight">
            Your KIAA Benefits Guide
          </h1>
          <p className="text-kiaa-700 text-sm max-w-xl leading-relaxed mb-5">
            Everything you need to manage your company's health benefit plans on KIAA Connect — from open enrollment to employee changes and compliance.
          </p>
          <div className="flex gap-6 flex-wrap pt-4 border-t border-kiaa-200">
            {[['Plan year','October 1 – September 30'],['Rate basis','Band-based (flat rate)'],['Contact','(808) 961-5422']].map(([l,v]) => (
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
        <div id="hh-section-content" className="card">
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
        .hh-p  { font-size:13.5px; color:#3d5c5b; line-height:1.65; margin-bottom:10px; }
        .hh-table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:12px; }
        .hh-table th { background:#EDF2F6; color:#263944; padding:8px 12px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #BED8E1; }
        .hh-table td { padding:8px 12px; border-bottom:1px solid #f0fafa; color:#3d5c5b; vertical-align:top; }
        .hh-table tr:nth-child(even) td { background:#f7fdfc; }
        .hh-tip { background:#EDF2F6; border:1px solid #6595B2; border-radius:10px; padding:12px 14px; display:flex; gap:10px; font-size:13px; color:#263944; line-height:1.5; margin:12px 0; }
        .hh-warn { background:#fef9ec; border:1px solid #f59e0b; border-radius:10px; padding:12px 14px; display:flex; gap:10px; font-size:13px; color:#78350f; line-height:1.5; margin:12px 0; }
        .hh-steps { margin:12px 0; }
        .hh-step { display:flex; gap:12px; margin-bottom:12px; }
        .hh-step-num { width:26px; height:26px; border-radius:50%; background:#263944; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
        .hh-step-title { font-size:13.5px; font-weight:600; color:#263944; margin-bottom:2px; }
        .hh-step-desc { font-size:13px; color:#3d5c5b; line-height:1.55; }
        .hh-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0; }
        .hh-feature-card { display:flex; gap:10px; align-items:flex-start; background:#f7fdfc; border:1px solid #d4f0ef; border-radius:10px; padding:12px; }
        .hh-feature-icon { font-size:20px; flex-shrink:0; }
        .hh-feature-title { font-size:13px; font-weight:600; color:#263944; margin-bottom:2px; }
        .hh-feature-desc { font-size:12px; color:#3d5c5b; line-height:1.45; }
        .hh-contact-card { display:flex; gap:12px; align-items:flex-start; background:#f7fdfc; border:1px solid #d4f0ef; border-radius:10px; padding:14px; }
        .hh-contact-icon { font-size:22px; flex-shrink:0; }
        .hh-contact-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#6b8f8e; margin-bottom:2px; }
        .hh-contact-value { font-size:14px; font-weight:600; color:#263944; margin-bottom:2px; }
        .hh-contact-note { font-size:12px; color:#6b8f8e; }
      `}</style>
    </div>
  )
}
