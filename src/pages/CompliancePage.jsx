import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCompliance } from '@/lib/compliance'
import { Search, HelpCircle, X } from 'lucide-react'

// ── Column definitions with full explainers ───────────────────
const COLUMNS = [
  {
    key:       'fedCobra',
    label:     'Federal COBRA',
    threshold: '20+ FTEs',
    basis:     'FTE count',
    law:       'ERISA § 601–608 / IRC § 4980B',
    color:     'text-amber-700',
    explainer: {
      what: 'The Consolidated Omnibus Budget Reconciliation Act requires employers to offer continued health coverage to employees and their dependents after certain qualifying events — termination, reduction in hours, divorce, death, Medicare entitlement, or a dependent aging off the plan.',
      who:  'Applies to private-sector employers with 20 or more full-time equivalent employees on a typical business day during the prior calendar year.',
      how:  'Part-time employees count as fractions toward the 20 FTE threshold (e.g. a 20-hr/week employee = 0.67 FTE). Government and church plans are generally exempt.',
      deadline: 'Election notice must be sent within 14 days of learning of a qualifying event. Employees have 60 days to elect coverage. Coverage can last 18–36 months.',
      penalty: 'Excise tax of $100/day per qualified beneficiary for failure to provide required notices.',
    },
  },
  {
    key:       'hiCobra',
    label:     'HI State Continuation',
    threshold: 'Fewer than 20 FTEs',
    basis:     'FTE count',
    law:       'Hawaii HRS § 393',
    color:     'text-blue-700',
    explainer: {
      what: 'Hawaii state continuation coverage rules that apply when federal COBRA does not — i.e., for employers with fewer than 20 FTEs. Provides similar continuation rights under state law.',
      who:  'All Hawaii employers covered by the Hawaii Prepaid Health Care Act with fewer than 20 FTEs. Employers subject to federal COBRA are not covered by this state continuation requirement.',
      how:  'Contact the Hawaii Insurance Division for current requirements, as state rules may differ from federal COBRA in duration, notice requirements, and premium limits.',
      deadline: 'Notice and election requirements vary — consult Hawaii Insurance Division at (808) 586-2790.',
      penalty: 'State penalties may apply for failure to provide continuation coverage. Contact Hawaii DOL for details.',
    },
  },
  {
    key:       'fmla',
    label:     'Federal FMLA',
    threshold: '50+ employees',
    basis:     'Total headcount',
    law:       '29 CFR § 825',
    color:     'text-amber-700',
    explainer: {
      what: 'The Family and Medical Leave Act entitles eligible employees to up to 12 weeks of unpaid, job-protected leave per year for qualifying reasons: birth/adoption of a child, serious health condition of the employee or immediate family member, or qualifying military exigencies.',
      who:  'Private-sector employers with 50 or more employees on the payroll (total headcount, not FTEs) within 75 miles of the worksite for at least 20 calendar weeks in the current or prior year. Employees must have worked 12+ months and 1,250+ hours in the prior year.',
      how:  'Unlike COBRA, FMLA uses total headcount — every employee on payroll counts as one, including part-time and seasonal workers. Health coverage must be maintained during FMLA leave on the same terms as active employees.',
      deadline: 'Employer must notify employee of FMLA eligibility within 5 business days of learning of a qualifying need. Designation notice required within 5 days of receiving sufficient information.',
      penalty: 'Employees may sue for damages including lost wages, benefits, and attorney fees. DOL may investigate and assess civil penalties.',
    },
  },
  {
    key:       'erisa5500',
    label:     'ERISA Form 5500',
    threshold: '100+ participants',
    basis:     'Plan participants',
    law:       '29 CFR § 2520.104-46',
    color:     'text-red-700',
    explainer: {
      what: 'ERISA requires annual filing of Form 5500 (Annual Return/Report of Employee Benefit Plan) with the DOL and IRS. The form discloses financial condition, investments, and operations of the plan.',
      who:  'Employee benefit plans with 100 or more participants at the beginning of the plan year. "Participants" means enrolled employees (active employees, retired participants, and separated employees entitled to future benefits) — dependents are beneficiaries, not participants, and are not counted in the threshold. Plans with fewer than 100 participants generally qualify for the small plan exemption (Schedule I vs. Schedule H).',
      how:  'The filing threshold is based on the number of plan participants at the start of the plan year, not at year-end. All employers subject to ERISA must comply with other ERISA requirements (SPD distribution, claims procedures, fiduciary duties) regardless of participant count.',
      deadline: 'Due by the last day of the 7th month after the plan year ends (e.g., July 31 for a December 31 plan year). Extensions available.',
      penalty: 'Up to $250/day (max $150,000) for late filing. DOL Delinquent Filer Voluntary Compliance Program available to reduce penalties.',
    },
  },
  {
    key:       'phcaTdi',
    label:     'Hawaii PHCA / TDI',
    threshold: 'All HI employers',
    basis:     'All employers',
    law:       'HRS § 393 / HRS § 392',
    color:     'text-kiaa-700',
    explainer: {
      what: 'Two separate Hawaii state requirements that apply to all Hawaii employers regardless of size. The Prepaid Health Care Act (PHCA) requires employers to provide health care coverage. Temporary Disability Insurance (TDI) provides partial wage replacement for employees unable to work due to a non-work-related illness or injury, including pregnancy.',
      who:  'All Hawaii employers. PHCA covers employees working 20+ hours/week for 4+ consecutive weeks. TDI covers most employees — certain agricultural workers and domestic workers may be exempt.',
      how:  'PHCA requires employer contribution toward health plan premiums. TDI can be provided through the State TDI plan or an approved private plan. Both are administered by the Hawaii Department of Labor and Industrial Relations (DLIR).',
      deadline: 'PHCA: provide coverage from first day of eligibility. TDI: benefits begin after a 7-day waiting period.',
      penalty: 'PHCA: fines up to $500/day. TDI: fines and penalties per HRS § 392. Contact Hawaii DLIR at (808) 586-9188.',
    },
  },
]

function ExplainerModal({ col, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal max-w-lg">
        <div className="modal-header">
          <div>
            <div className="font-display text-base font-semibold text-kiaa-700">{col.label}</div>
            <div className="text-xs text-surface-400 mt-0.5">{col.law} &nbsp;·&nbsp; Threshold: {col.threshold} ({col.basis})</div>
          </div>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body space-y-4">
          {[
            { label: 'What it is',    text: col.explainer.what },
            { label: 'Who it applies to', text: col.explainer.who },
            { label: 'How it works',  text: col.explainer.how },
            { label: 'Key deadlines', text: col.explainer.deadline },
            { label: 'Penalties',     text: col.explainer.penalty },
          ].map(({ label, text }) => (
            <div key={label}>
              <div className="text-xs font-semibold text-kiaa-700 uppercase tracking-wide mb-1">{label}</div>
              <p className="text-sm text-surface-600 leading-relaxed">{text}</p>
            </div>
          ))}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
            This information is provided for general reference only and does not constitute legal advice.
            Consult qualified legal counsel for compliance guidance specific to your situation.
          </div>
        </div>
      </div>
    </div>
  )
}

function CompBadge({ required, trueLabel = 'Required', falseLabel = 'Not required', mayApply }) {
  if (mayApply)  return <span className="badge badge-blue">May apply</span>
  if (required)  return <span className="comp-required">{trueLabel}</span>
  return <span className="comp-exempt">{falseLabel}</span>
}

export default function CompliancePage() {
  const [companies, setCompanies] = useState([])
  const [filtered,  setFiltered]  = useState([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [activeCol, setActiveCol] = useState(null)

  useEffect(() => {
    supabase
      .from('companies')
      .select('id,name,employee_count,fte_count,headcount,plan_participants,status')
      .order('name')
      .then(({ data }) => {
        setCompanies(data || [])
        setFiltered(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    setFiltered(
      companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    )
  }, [search, companies])

  function badge(c) {
    const comp = getCompliance(c)
    return {
      fedCobra: <CompBadge required={comp.fedCobra.required} />,
      hiCobra:  comp.hiCobra.required
        ? <CompBadge mayApply />
        : <span className="comp-na">—</span>,
      fmla:     <CompBadge required={comp.fmla.required} />,
      erisa5500: comp.erisa5500.required
        ? <span className="comp-warn">Required</span>
        : <span className="comp-exempt">Exempt</span>,
      phcaTdi:  <span className="comp-required">Required</span>,
    }
  }

  return (
    <div className="p-8 page-enter">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Compliance Dashboard</h1>
        <p className="text-surface-400 text-sm mt-0.5">
          Click any column header <HelpCircle size={12} className="inline mb-0.5 text-kiaa-500"/> for a full explainer
        </p>
      </div>

      {/* Column explainer cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {COLUMNS.map(col => (
          <button
            key={col.key}
            onClick={() => setActiveCol(col)}
            className="text-left p-3 bg-white border border-surface-100 rounded-xl hover:border-kiaa-300 hover:bg-kiaa-50 transition-all group"
          >
            <div className="flex items-start justify-between gap-1 mb-1.5">
              <div className={`text-xs font-semibold ${col.color} leading-tight`}>{col.label}</div>
              <HelpCircle size={12} className="text-surface-300 group-hover:text-kiaa-500 flex-shrink-0 mt-0.5 transition-colors" />
            </div>
            <div className="text-xs text-surface-400">{col.threshold}</div>
            <div className="text-xs text-surface-300 mt-0.5 italic">{col.basis}</div>
          </button>
        ))}
      </div>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          className="input pl-9"
          placeholder="Filter companies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-surface-400 text-sm">Loading…</div>
        ) : (
          <table className="data-table min-w-[820px]">
            <thead>
              <tr>
                <th>Company</th>
                <th>FTEs / Headcount</th>
                {COLUMNS.map(col => (
                  <th key={col.key}>
                    <button
                      onClick={() => setActiveCol(col)}
                      className="flex items-center gap-1 hover:text-kiaa-600 transition-colors group"
                    >
                      {col.label}
                      <HelpCircle size={11} className="text-surface-300 group-hover:text-kiaa-500 flex-shrink-0" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-surface-400 py-8">
                    No companies found
                  </td>
                </tr>
              ) : filtered.map(c => {
                const b = badge(c)
                const fte = c.fte_count ?? c.employee_count ?? '—'
                const hc  = c.headcount ?? c.employee_count ?? '—'
                return (
                  <tr key={c.id}>
                    <td className="font-medium text-surface-700">{c.name}</td>
                    <td>
                      <div className="text-surface-600">{fte} <span className="text-surface-400 text-xs">FTE</span></div>
                      <div className="text-surface-400 text-xs">{hc} headcount</div>
                    </td>
                    <td>{b.fedCobra}</td>
                    <td>{b.hiCobra}</td>
                    <td>{b.fmla}</td>
                    <td>{b.erisa5500}</td>
                    <td>{b.phcaTdi}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Explainer modal */}
      {activeCol && (
        <ExplainerModal col={activeCol} onClose={() => setActiveCol(null)} />
      )}
    </div>
  )
}
