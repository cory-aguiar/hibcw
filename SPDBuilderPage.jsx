import { usePlanYear, planYearLong, planYearLabel } from '@/lib/PlanYearContext'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PLAN_MAP, ACA_PLAN_BENEFITS } from '@/lib/plans'
import { getSPDCobraText, getSPDFmlaText, getSPDErisaText } from '@/lib/compliance'
import { generateSPDHtml } from '@/lib/spdHtmlGenerator'
import { FileText, Download, ChevronDown, ChevronUp, AlertTriangle, FileDown } from 'lucide-react'

const SECTIONS = [
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'glance',      label: 'Benefits at a glance' },
  { id: 'plans',       label: 'Plan details' },
  { id: 'cobra',       label: 'COBRA / continuation' },
  { id: 'fmla',        label: 'FMLA / leave' },
  { id: 'erisa',       label: 'ERISA rights & reporting' },
  { id: 'hipaa',       label: 'HIPAA privacy' },
  { id: 'claims',      label: 'Claims & appeals' },
]

function SPDSection({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-surface-100 rounded-xl overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-50 hover:bg-kiaa-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-display font-semibold text-kiaa-700 text-sm uppercase tracking-wide">{title}</span>
        {open ? <ChevronUp size={14} className="text-surface-400"/> : <ChevronDown size={14} className="text-surface-400"/>}
      </button>
      {open && (
        <div className="px-4 py-3 text-sm text-surface-700 leading-relaxed bg-white">
          {children}
        </div>
      )}
    </div>
  )
}

function PlanGlanceTable({ plan, isAca = false }) {
  const isHMO  = plan.referralRequired
  const isPPP  = plan.id ? (plan.id.startsWith('ppp') || plan.id === 'aca_ppp') : false
  const isMed  = isAca ? false : (plan.riders ? plan.riders.length === 1 : plan.package === 'Medical Only')

  const rows = [
    { section: 'Cost sharing basics' },
    { label: 'Plan type',                             value: plan.type },
    { label: 'Deductible — individual / family',      value: plan.deductible,   free: plan.deductible === '$0' || (plan.deductible || '').startsWith('$0 ') },
    { label: 'Out-of-pocket max — medical',           value: plan.oopMedical,   warn: true },
    { label: 'Out-of-pocket max — Rx',                value: plan.oopRx },
    { label: 'Referral required for specialist',      value: isHMO ? 'Yes — required' : 'No', warn: isHMO },
    { label: 'Out-of-network coverage',               value: plan.outOfNetwork, warn: plan.outOfNetwork === 'Not covered (emergency only)' },
    { section: 'Office visits' },
    { label: 'Primary care visit',                    value: plan.pcp },
    { label: 'Specialist visit',                      value: plan.specialist },
    { label: 'Urgent care',                           value: plan.pcp },
    { label: 'Preventive care / screenings',          value: 'No charge',       free: true },
    { label: 'Mental health — outpatient physician',  value: plan.pcp },
    { label: 'Mental health — inpatient physician',   value: 'No charge',       free: true },
    { section: 'Emergency & hospital' },
    { label: 'Emergency room (facility)',             value: plan.er },
    { label: 'Emergency room (physician)',            value: isHMO ? 'No charge' : (isPPP ? '$12 copay' : '$20 copay'), free: isHMO },
    { label: 'Inpatient hospital facility',           value: plan.hospital },
    { label: 'Outpatient surgery (facility)',         value: isHMO ? 'No charge' : (isPPP ? '10% coinsurance' : '20% coinsurance'), free: isHMO },
    { label: 'Maternity care',                        value: plan.maternity },
    { section: 'Prescription drugs' },
    { label: 'Generic — retail (30-day)',             value: plan.rxGeneric },
    { label: 'Generic — mail order (90-day)',         value: isMed ? '—' : (plan.rxGenericMail || '$14 copay') },
    { label: 'Preferred brand — retail',             value: plan.rxPreferred },
    { label: 'Preferred brand — mail order',         value: isMed ? '—' : (plan.rxPreferredMail || '$100 copay') },
    { label: 'Non-preferred brand — retail',         value: `${plan.rxPreferred} + $35 other brand cost share` },
    { label: 'Specialty drugs — retail',             value: isPPP ? '20% coinsurance' : `${plan.rxPreferred} + $35 other brand cost share` },
    { section: 'Recovery & special needs' },
    { label: 'Home health care',                     value: isHMO ? 'No charge (in-network)' : 'No charge (150 visits/yr)' },
    { label: 'Skilled nursing care',                 value: '20% coinsurance (120 days/yr)' },
    { label: 'Durable medical equipment',            value: isHMO ? '50% coinsurance' : '20% coinsurance' },
    { label: 'Hospice services',                     value: 'No charge', free: true },
  ]

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="bg-kiaa-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">{plan.type}</span>
        <div>
          <div className="font-display font-semibold text-kiaa-700 text-sm">{plan.name}</div>
          {plan.codes && <div className="text-xs text-surface-400">{plan.codes}</div>}
          {isAca && <div className="text-xs text-surface-400">ACA Small Group — Full Package incl. Riders</div>}
        </div>
        <div className="ml-auto flex gap-1">
          {isAca
            ? ['Dental','Vision','Group Life/AD&D'].map(r => <span key={r} className="badge badge-aqua text-xs">{r}</span>)
            : (plan.riders || []).map(r => <span key={r} className="badge badge-aqua text-xs">{r}</span>)
          }
        </div>
      </div>
      {plan.referralRequired && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 text-xs text-amber-800">
          <AlertTriangle size={12} className="flex-shrink-0 text-amber-600"/>
          HMO — referral required for all specialist visits. Out-of-network not covered except emergencies.
        </div>
      )}
      <div className="border border-surface-100 rounded-xl overflow-hidden text-sm">
        {rows.map((r, i) => {
          if (r.section) return (
            <div key={i} className="px-4 py-1.5 bg-kiaa-700 text-white text-xs font-semibold uppercase tracking-wide">{r.section}</div>
          )
          return (
            <div key={i} className="grid grid-cols-2 border-b border-surface-50 last:border-0 hover:bg-kiaa-50/30">
              <div className="px-4 py-2 text-surface-500 bg-surface-50/50">{r.label}</div>
              <div className={`px-4 py-2 font-medium ${r.free ? 'text-kiaa-600' : r.warn ? 'text-amber-700' : 'text-surface-700'}`}>{r.value}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 text-xs text-surface-400 italic px-1">
        Services not covered include acupuncture, cosmetic surgery, long-term care, and weight loss programs.
        {!isAca && (plan.riders || []).length === 1 && ' Dental and vision not included in this option.'}
        {isAca && ' All ACA plans are Full Package — Dental, Vision, and Group Life/AD&D are included.'}
      </div>
    </div>
  )
}

export default function SPDBuilderPage() {
  const { oePlanYear, oePlanStart, oePlanEnd } = usePlanYear()
  const oePlanLong = `October 1, ${oePlanYear.split('-')[0]} – September 30, ${oePlanYear.split('-')[1]}`
  const oePlanShort = `${oePlanStart} – ${oePlanEnd}`
  const [companies, setCompanies] = useState([])
  const [selected,    setSelected]    = useState('')
  const [acaPlanStart,  setAcaPlanStart]  = useState('')
  const [acaElections,  setAcaElections]  = useState({})
  const [sections,  setSections]  = useState(SECTIONS.map(s => s.id))
  const [generated, setGenerated] = useState(false)
  const previewRef = useRef(null)

  useEffect(() => {
    supabase.from('companies').select('*').order('name')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  useEffect(() => {
    if (!selected) return
    setGenerated(false)
    setAcaElections({})
    const co = companies.find(c => c.id === selected)
    if (co?.group_type === 'aca_small_group') {
      supabase.from('company_elections').select('plan_id, elected')
        .eq('company_id', selected)
        .in('plan_id', ['aca_cm_a','aca_hph_plus','aca_ppp'])
        .then(({ data }) => {
          const el = {}
          ;(data || []).forEach(r => { el[r.plan_id] = r.elected })
          setAcaElections(el)
        })
    }
  }, [selected, companies])

  const company  = companies.find(c => c.id === selected)
  const isAca    = company?.group_type === 'aca_small_group'
  // For ACA: compute plan year from start date
  const acaPlanEnd = acaPlanStart ? (() => {
    const d = new Date(acaPlanStart + 'T00:00:00')
    d.setFullYear(d.getFullYear() + 1)
    d.setDate(d.getDate() - 1)
    return d.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
  })() : ''
  const acaPlanStartLong = acaPlanStart ? new Date(acaPlanStart + 'T00:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) : ''
  const acaPlanYearLong  = acaPlanStart ? `${acaPlanStartLong} – ${acaPlanEnd}` : 'Contact KIAA for plan year dates'
  const acaPlanYearShort = acaPlanStart ? `${acaPlanStart} – ${acaPlanEnd}` : ''
  const planList = isAca
    ? Object.values(ACA_PLAN_BENEFITS).filter(p => acaElections[p.id])
    : (company?.plans || []).map(pid => PLAN_MAP[pid]).filter(Boolean)
  const planNames = planList.map(p => p.name)

  function toggleSection(id) {
    setSections(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function handleGenerate() {
    if (!selected) return
    setGenerated(true)
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // ── Download print-ready HTML file ──────────────────────────
  function handleDownloadHtml() {
    if (!company) return
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
    const html = generateSPDHtml({ company, planList, sections, generatedDate, isAca, planYear: isAca ? acaPlanYearLong : oePlanLong, planYearShort: isAca ? acaPlanYearShort : oePlanShort })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `SPD_${company.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().getFullYear()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 page-enter">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">SPD Builder</h1>
        <p className="text-surface-400 text-sm mt-0.5">Generate a company-specific Summary Plan Description</p>
      </div>

      {/* Config */}
      <div className="card mb-6">
        <h2 className="section-title">Configure</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Select company</label>
            <select className="input" value={selected}
              onChange={e => { setSelected(e.target.value); setGenerated(false) }}>
              <option value="">— choose a company —</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.employee_count} employees)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Plan year</label>
            <input className="input opacity-70 cursor-default"
              value={isAca ? acaPlanYearLong : oePlanLong} readOnly />
            {isAca && (
              <div className="mt-2">
                <label className="label text-xs">ACA plan year start date</label>
                <input type="date" className="input w-48 text-sm"
                  value={acaPlanStart} onChange={e => setAcaPlanStart(e.target.value)}/>
                <p className="text-xs text-surface-400 mt-1">Enter the company's coverage effective date to calculate their plan year</p>
              </div>
            )}
          </div>
        </div>

        {company && (planList.length > 0 || isAca) && (
          <div className="mb-4 p-3 bg-kiaa-50 rounded-xl border border-kiaa-200">
            <div className="text-xs text-kiaa-600 font-medium mb-2">Plans enrolled for this company</div>
            <div className="flex flex-wrap gap-1.5">
              {planList.map(p => <span key={p.id} className="badge badge-aqua">{p.shortName}</span>)}
            </div>
          </div>
        )}

        <div className="mb-5">
          <label className="label mb-2">Sections to include</label>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => toggleSection(s.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  sections.includes(s.id)
                    ? 'bg-kiaa-600 text-white border-kiaa-600'
                    : 'bg-white text-surface-500 border-surface-200 hover:border-kiaa-400'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!selected}>
            <FileText size={15}/> Preview SPD
          </button>
          {company && (
            <button className="btn btn-teal" onClick={handleDownloadHtml} disabled={!selected}>
              <FileDown size={15}/> Download print-ready HTML
            </button>
          )}
          {generated && (
            <button className="btn" onClick={() => window.print()}>
              <Download size={15}/> Print preview
            </button>
          )}
        </div>

        {company && (
          <p className="text-xs text-surface-400 mt-3 flex items-center gap-1.5">
            <FileDown size={11}/>
            The downloaded HTML file opens in any browser — use File → Print → Save as PDF to create a letter-size PDF.
          </p>
        )}
      </div>

      {/* Preview */}
      {generated && company && (
        <div ref={previewRef} className="card">
          <div className="text-center pb-5 mb-5 border-b border-surface-100">
            <div className="inline-block bg-kiaa-600 text-white font-display font-bold text-lg px-5 py-1.5 rounded-full mb-3">
              KIAA Benefits OS
            </div>
            <h2 className="font-display text-xl font-bold text-kiaa-700">{company.name}</h2>
            <p className="text-surface-500 text-sm mt-1">Summary Plan Description — HMSA Group Health Plan</p>
            <p className="text-surface-400 text-xs mt-0.5">Plan Year: {isAca ? acaPlanYearLong : oePlanLong}</p>
          </div>

          <SPDSection title="1.  Plan information">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {[
                ['Company',            company.name],
                ['Employees',          company.employee_count],
                ['Insurance carrier',  'Hawaii Medical Service Association (HMSA)'],
                ['HMSA member services','1-800-776-4672  |  www.hmsa.com'],
                ['Plan year',          isAca ? acaPlanYearLong : oePlanLong],
                ['Plan administrator', `${company.contact_name || '[HR Contact]'} — ${company.contact_email || '[email]'}`],
                ['Plans enrolled',     planNames.length ? planNames.join(', ') : (isAca ? 'ACA Small Group plans' : 'Not specified')],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <div className="text-surface-400 font-medium">{k}</div>
                  <div className="text-surface-700">{v}</div>
                </div>
              ))}
            </div>
          </SPDSection>

          {sections.includes('eligibility') && (
            <SPDSection title="2.  Eligibility">
              Employees regularly scheduled to work 20 or more hours per week are eligible to enroll following
              the applicable waiting period. Eligible dependents include a lawful spouse or domestic partner and
              dependent children up to age 26. Employees must complete enrollment within 30 days of their eligibility
              date. Open Enrollment occurs annually before October 1. Special enrollment is available within 30 days
              of a qualifying life event such as marriage, birth, adoption, or loss of other coverage.
            </SPDSection>
          )}

          {sections.includes('glance') && (planList.length > 0 || isAca) && (
            <SPDSection title="3.  Benefits at a glance">
              <p className="text-surface-500 text-xs mb-4 italic">
                Summary of key benefit features for each plan offered by {company.name}. Refer to full{' '}
                {isAca ? 'HMSA Small Group' : 'HMSA'} plan documents and the attached SBC for complete details.
              </p>
              {planList.map(plan => <PlanGlanceTable key={plan.id} plan={plan} isAca={isAca} />)}
            </SPDSection>
          )}

          {sections.includes('plans') && planNames.length > 0 && (
            <SPDSection title="4.  Plans enrolled">
              {isAca ? (
                <>
                  {company.name} participates in the HMSA ACA Small Group program and offers the following
                  plan(s) for the {acaPlanYearLong} plan year:{' '}
                  <strong>{planNames.join(', ')}</strong>. All plans are ACA-compliant Full Package plans
                  administered by HMSA and include Dental, Vision, and Group Life/AD&D Riders.
                  Full plan documents are available at{' '}
                  <a href="https://www.hmsa.com" className="text-kiaa-600 underline">www.hmsa.com</a>{' '}
                  or by calling 1-800-776-4672.
                </>
              ) : (
                <>
                  {company.name} offers the following HMSA plan(s) for the {isAca ? acaPlanYearLong : oePlanLong} plan year:{' '}
                  <strong>{planNames.join(', ')}</strong>. All plans are administered by HMSA.
                  Full plan documents are available at{' '}
                  <a href="https://www.hmsa.com" className="text-kiaa-600 underline">www.hmsa.com</a>{' '}
                  or by calling 1-800-776-4672.
                </>
              )}
            </SPDSection>
          )}

          {sections.includes('cobra') && (
            <SPDSection title="5.  COBRA / continuation of coverage">
              {getSPDCobraText(company)}
            </SPDSection>
          )}

          {sections.includes('fmla') && (
            <SPDSection title="6.  FMLA / family and medical leave">
              {getSPDFmlaText(company)}
            </SPDSection>
          )}

          {sections.includes('erisa') && (
            <SPDSection title="7.  ERISA rights & reporting">
              {getSPDErisaText(company)}
            </SPDSection>
          )}

          {sections.includes('hipaa') && (
            <SPDSection title="8.  HIPAA privacy">
              Your protected health information (PHI) is protected under HIPAA. HMSA's Notice of Privacy Practices
              is available at hmsa.com or by calling 1-800-776-4672. You have the right to inspect and obtain a
              copy of your PHI, request corrections, and file a complaint with HMSA or the U.S. Department of HHS.
            </SPDSection>
          )}

          {sections.includes('claims') && (
            <SPDSection title="9.  Claims & appeals">
              In-network providers generally file claims directly with HMSA. To file yourself: www.hmsa.com or
              1-800-776-4672. Appeals: HMSA Member Advocacy and Appeals, P.O. Box 1958, Honolulu, HI 96805-1958
              | appeals@hmsa.com | (808) 948-5090. You have 180 days from denial to appeal.
              External review available after internal appeals are exhausted.
            </SPDSection>
          )}

          <div className="mt-5 pt-4 border-t border-surface-100 text-xs text-surface-400 text-center">
            This SPD is provided for informational purposes only. Official HMSA plan documents govern in all cases.
            Generated by KIAA Benefits OS.
          </div>
        </div>
      )}
    </div>
  )
}
