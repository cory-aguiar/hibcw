import { usePlanYear } from '@/lib/PlanYearContext'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PLANS, PLANS_7A, PLANS_7B, COMPARISON_FIELDS, KAISER_COMPARISON_FIELDS, KAISER_PLAN_BENEFITS, groupKaiserRates, ACA_PLAN_BENEFITS } from '@/lib/plans'

const CLASS_COLORS = {
  '7a': { header: 'bg-kiaa-700', badge: 'bg-kiaa-aqua text-kiaa-800', label: '7(a) Plans — Equal to or better than the prevalent plan' },
  '7b': { header: 'bg-surface-700', badge: 'bg-surface-300 text-surface-800', label: '7(b) Plans — Employer must pay one-half of dependent coverage cost' },
}

export default function PlanComparisonPage() {
  const { oePlanStart, oePlanEnd, oePlanYear } = usePlanYear()
  const [highlight,    setHighlight]    = useState('')
  const [selectedIds,  setSelectedIds]  = useState(PLANS.map(p => p.id))
  const [companies,    setCompanies]    = useState([])
  const [selectedCo,   setSelectedCo]   = useState('')
  const [kaiserRates,  setKaiserRates]  = useState([])
  const [kaiserLoading,setKaiserLoading]= useState(false)
  const [tab,          setTab]          = useState('hmsa') // 'hmsa' | 'aca'

  useEffect(() => {
    supabase.from('companies')
      .select('id,name,kaiser_eligible,kaiser_schedule')
      .eq('kaiser_eligible', true)
      .order('name')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  useEffect(() => {
    if (!selectedCo) { setKaiserRates([]); return }
    setKaiserLoading(true)
    supabase.from('kaiser_rates').select('*')
      .eq('company_id', selectedCo)
      .eq('plan_year', oePlanYear)
      .order('kaiser_plan_no').order('package_type')
      .then(({ data }) => { setKaiserRates(data || []); setKaiserLoading(false) })
  }, [selectedCo, oePlanYear])

  const visible   = PLANS.filter(p => selectedIds.includes(p.id))
  const visible7a = visible.filter(p => p.hmsa_class === '7a')
  const visible7b = visible.filter(p => p.hmsa_class === '7b')

  function togglePlan(id) {
    setSelectedIds(s =>
      s.includes(id)
        ? s.length > 1 ? s.filter(x => x !== id) : s
        : [...s, id]
    )
  }

  function PlanGroupTable({ plans, classKey }) {
    if (plans.length === 0) return null
    const colors = CLASS_COLORS[classKey]
    return (
      <div className="card p-0 overflow-hidden mb-4">
        <div className={`${colors.header} px-4 py-2.5 flex items-center gap-3`}>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${colors.badge}`}>
            HMSA {classKey === '7a' ? '7(a)' : '7(b)'}
          </span>
          <span className="text-white text-xs font-medium">{colors.label}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse"
            style={{ minWidth: `${200 + plans.length * 150}px` }}>
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 py-3 bg-surface-50 w-44 sticky left-0 z-10">
                  Feature
                </th>
                {plans.map(p => (
                  <th key={p.id} className={`text-center text-xs font-semibold uppercase tracking-wider px-3 py-3 ${
                    p.id === highlight ? 'bg-kiaa-600 text-white' : 'bg-surface-50 text-surface-500'
                  }`}>
                    <div>{p.shortName}</div>
                    <div className={`font-normal normal-case mt-0.5 flex items-center justify-center gap-1 ${
                      p.id === highlight ? 'text-kiaa-200' : 'text-surface-400'
                    }`} style={{fontSize:'10px'}}>
                      <span className={`px-1.5 py-0 rounded text-xs ${
                        p.type === 'HMO'
                          ? (p.id === highlight ? 'bg-amber-300 text-amber-900' : 'bg-amber-100 text-amber-700')
                          : (p.id === highlight ? 'bg-kiaa-300 text-kiaa-900' : 'bg-kiaa-100 text-kiaa-700')
                      }`}>{p.type}</span>
                      {p.package}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FIELDS.map(({ key, label, format: fmt }) => (
                <tr key={key} className="border-b border-surface-50 hover:bg-kiaa-50/20 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-medium text-surface-500 bg-white sticky left-0">{label}</td>
                  {plans.map(p => {
                    const val = fmt ? fmt(p[key]) : p[key]
                    const isHL = p.id === highlight
                    return (
                      <td key={p.id} className={`px-3 py-2.5 text-center text-xs ${
                        isHL ? 'bg-kiaa-50 text-kiaa-800 font-medium' : 'text-surface-600'
                      }`}>
                        {key === 'referralRequired'
                          ? (val
                            ? <span className="badge badge-amber">Yes</span>
                            : <span className="badge badge-green">No</span>)
                          : val}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {classKey === '7b' && (
                <tr className="bg-amber-50">
                  <td className="px-4 py-2 text-xs text-amber-700 sticky left-0 bg-amber-50" colSpan={plans.length + 1}>
                    ⚠ 7(b) plans: Employer is required to pay one-half of the cost for dependents' coverage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function KaiserGroupTable({ rates, schedule }) {
    const groups = groupKaiserRates(rates)
    if (groups.length === 0) return null

    // Build plan objects for comparison — merge static benefit details with rate data
    const kaiserPlans = groups.map(g => ({
      id:        `kaiser_${g.kaiser_plan_no}_${g.package_type}`,
      planNo:    g.kaiser_plan_no,
      shortName: `Kaiser ${g.kaiser_plan_no} ${g.package_type === 'full' ? 'Full' : 'Med/Rx'}`,
      schedule:  g.schedule || schedule,
      ...KAISER_PLAN_BENEFITS[g.package_type],
      // Premiums from rates
      premium_single:    g.premium_single,
      premium_two_party: g.premium_two_party,
      premium_family:    g.premium_family,
    }))

    // Kaiser-specific comparison fields — adds premium rows on top
    const kaiserFields = [
      { key: 'premium_single',    label: 'Single premium' },
      { key: 'premium_two_party', label: '2-Party premium' },
      { key: 'premium_family',    label: 'Family premium' },
      ...KAISER_COMPARISON_FIELDS,
    ]

    return (
      <div className="card p-0 overflow-hidden mb-4">
        <div className="bg-[#385262] px-4 py-2.5 flex items-center gap-3">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-300 text-blue-900">
            Kaiser HMO
          </span>
          <span className="text-white text-xs font-medium">
            Kaiser Permanente Plans — Schedule {schedule} · All plans comply with Hawaii PHCA
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse"
            style={{ minWidth: `${200 + kaiserPlans.length * 160}px` }}>
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 py-3 bg-surface-50 w-44 sticky left-0 z-10">
                  Feature
                </th>
                {kaiserPlans.map(p => (
                  <th key={p.id} className="text-center text-xs font-semibold uppercase tracking-wider px-3 py-3 bg-surface-50 text-surface-500">
                    <div>{p.shortName}</div>
                    <div className="font-normal normal-case mt-0.5 flex items-center justify-center gap-1 text-surface-400" style={{fontSize:'10px'}}>
                      <span className="px-1.5 py-0 rounded text-xs bg-amber-100 text-amber-700">HMO</span>
                      {p.package}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kaiserFields.map(({ key, label, format: fmt }) => (
                <tr key={key} className={`border-b border-surface-50 hover:bg-blue-50/20 transition-colors ${
                  key.startsWith('premium_') ? 'bg-blue-50/30' : ''
                }`}>
                  <td className="px-4 py-2.5 text-xs font-medium text-surface-500 bg-white sticky left-0">{label}</td>
                  {kaiserPlans.map(p => {
                    const val = fmt ? fmt(p[key]) : p[key]
                    const isPremium = key.startsWith('premium_')
                    return (
                      <td key={p.id} className="px-3 py-2.5 text-center text-xs text-surface-600">
                        {key === 'referralRequired'
                          ? <span className="badge badge-amber">Yes</span>
                          : isPremium
                            ? <span className="font-mono font-semibold text-kiaa-700">
                                {val ? `$${parseFloat(val).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}
                              </span>
                            : val || '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-amber-50">
                <td className="px-4 py-2 text-xs text-amber-700 sticky left-0 bg-amber-50" colSpan={kaiserPlans.length + 1}>
                  ⚠ Kaiser HMO — Referral required for specialist visits. No out-of-network coverage except emergencies.
                  Benefit details are estimates — refer to company-specific Kaiser SBC for exact values.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const selectedCompany = companies.find(c => c.id === selectedCo)

  return (
    <div className="p-8 page-enter">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Plan Comparison</h1>
        <p className="text-surface-400 text-sm mt-0.5">
          HMSA &amp; Kaiser plans · Plan year {oePlanStart} – {oePlanEnd}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-5">
        {[
          { id: 'hmsa', label: 'HMSA Merit Rated' },
          { id: 'aca',  label: 'ACA Small Group' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${
              tab === t.id
                ? 'bg-kiaa-600 text-white border-kiaa-600'
                : 'bg-white text-surface-500 border-surface-200 hover:border-kiaa-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── HMSA / Kaiser tab ── */}
      {tab === 'hmsa' && (
        <>
          {/* Filter bar */}
          <div className="card mb-5">
            <div className="space-y-3">
              {/* 7(a) filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-kiaa-700 bg-kiaa-50 border border-kiaa-200 px-2 py-0.5 rounded w-16 text-center flex-shrink-0">7(a)</span>
                {PLANS_7A.map(p => (
                  <button key={p.id} onClick={() => togglePlan(p.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selectedIds.includes(p.id)
                        ? 'bg-kiaa-600 text-white border-kiaa-600'
                        : 'bg-white text-surface-500 border-surface-200 hover:border-kiaa-400'
                    }`}>
                    {p.shortName}
                    <span className={`ml-1.5 text-xs px-1 rounded ${
                      selectedIds.includes(p.id)
                        ? (p.type === 'HMO' ? 'bg-amber-300 text-amber-900' : 'bg-kiaa-300 text-kiaa-900')
                        : (p.type === 'HMO' ? 'bg-amber-100 text-amber-600' : 'bg-surface-100 text-surface-500')
                    }`}>{p.type}</span>
                  </button>
                ))}
              </div>
              {/* 7(b) filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-surface-600 bg-surface-100 border border-surface-200 px-2 py-0.5 rounded w-16 text-center flex-shrink-0">7(b)</span>
                {PLANS_7B.map(p => (
                  <button key={p.id} onClick={() => togglePlan(p.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selectedIds.includes(p.id)
                        ? 'bg-surface-700 text-white border-surface-700'
                        : 'bg-white text-surface-500 border-surface-200 hover:border-surface-400'
                    }`}>
                    {p.shortName}
                    <span className={`ml-1.5 text-xs px-1 rounded ${
                      selectedIds.includes(p.id)
                        ? (p.type === 'HMO' ? 'bg-amber-300 text-amber-900' : 'bg-surface-300 text-surface-900')
                        : (p.type === 'HMO' ? 'bg-amber-100 text-amber-600' : 'bg-surface-100 text-surface-500')
                    }`}>{p.type}</span>
                  </button>
                ))}
              </div>

              {/* Kaiser company selector */}
              <div className="flex items-center gap-2 pt-1 border-t border-surface-100 flex-wrap">
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded flex-shrink-0">Kaiser</span>
                <select className="input text-xs py-1 w-auto"
                  value={selectedCo} onChange={e => setSelectedCo(e.target.value)}>
                  <option value="">— Select company to show Kaiser plans —</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.kaiser_schedule ? ` (Schedule ${c.kaiser_schedule})` : ''}</option>
                  ))}
                </select>
                {kaiserLoading && <span className="text-xs text-surface-400">Loading…</span>}
                {selectedCo && !kaiserLoading && kaiserRates.length === 0 && (
                  <span className="text-xs text-amber-600">No Kaiser rates loaded for this company yet.</span>
                )}
              </div>

              {/* Highlight */}
              <div className="flex items-center gap-2 pt-1 border-t border-surface-100">
                <span className="text-xs text-surface-400 font-medium">Highlight column:</span>
                <select className="input text-xs py-1 w-auto"
                  value={highlight} onChange={e => setHighlight(e.target.value)}>
                  <option value="">None</option>
                  <optgroup label="7(a) Plans">
                    {PLANS_7A.map(p => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                  </optgroup>
                  <optgroup label="7(b) Plans">
                    {PLANS_7B.map(p => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* HMSA tables */}
          <PlanGroupTable plans={visible7a} classKey="7a" />
          <PlanGroupTable plans={visible7b} classKey="7b" />

          {/* Kaiser table — only when company selected and rates loaded */}
          {selectedCo && kaiserRates.length > 0 && (
            <KaiserGroupTable
              rates={kaiserRates}
              schedule={selectedCompany?.kaiser_schedule || ''}
            />
          )}
        </>
      )}

      {/* ── ACA Small Group tab ── */}
      {tab === 'aca' && (() => {
        const acaPlans = Object.values(ACA_PLAN_BENEFITS)
        const ACA_ROWS = [
          { sec: 'Plan overview' },
          { key:'type',          label:'Plan type' },
          { key:'deductible',    label:'Deductible (ind / fam)' },
          { sec: 'Out-of-pocket maximums' },
          { key:'oopMedical',    label:'OOP max — medical (ind / fam)' },
          { key:'oopRx',         label:'OOP max — Rx (ind / fam)' },
          { sec: 'Office visits' },
          { key:'pcp',           label:'Primary care (PCP)' },
          { key:'specialist',    label:'Specialist' },
          { key:'referralRequired', label:'Referral required',
            format: v => v
              ? <span className="badge badge-amber">Yes</span>
              : <span className="badge badge-green">No</span> },
          { sec: 'Emergency & hospital' },
          { key:'er',            label:'Emergency room' },
          { key:'hospital',      label:'Inpatient hospital' },
          { key:'maternity',     label:'Maternity' },
          { sec: 'Prescription drugs' },
          { key:'rxGeneric',     label:'Generic — retail (30-day)' },
          { key:'rxPreferred',   label:'Preferred brand — retail' },
          { sec: 'Network' },
          { key:'outOfNetwork',  label:'Out-of-network' },
        ]
        return (
          <>
            <div className="card mb-4 bg-kiaa-50 border-kiaa-200">
              <p className="text-xs text-kiaa-700">
                <strong>ACA Small Group plans</strong> — All three plans are Full Package and include
                the KIAA Riders Package (Dental, Vision, Group Life/AD&D). Riders flat rates:
                Single $45.24 / 2-Party $92.40 / Family $136.36/mo.
                Age-based rating: ages 0–14 use pediatric flat rate, ages 65+ capped at 65.
                First 3 children (≤18) charged; additional children at $0.
              </p>
            </div>
            <div className="card p-0 overflow-hidden mb-4">
              <div className="bg-kiaa-600 px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-kiaa-aqua text-kiaa-800">
                  ACA Small Group
                </span>
                <span className="text-white text-xs font-medium">
                  HMSA ACA Plans · Full Package incl. Riders · Age-based rating
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" style={{ minWidth:`${200 + acaPlans.length * 180}px` }}>
                  <thead>
                    <tr className="border-b border-surface-100">
                      <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 py-3 bg-surface-50 w-44 sticky left-0 z-10">
                        Feature
                      </th>
                      {acaPlans.map(p => (
                        <th key={p.id} className="text-center text-xs font-semibold uppercase tracking-wider px-3 py-3 bg-surface-50 text-surface-500">
                          <div>{p.shortName}</div>
                          <div className="font-normal normal-case mt-0.5 flex items-center justify-center gap-1 text-surface-400" style={{fontSize:'10px'}}>
                            <span className={`px-1.5 py-0 rounded text-xs ${
                              p.type === 'HMO' ? 'bg-amber-100 text-amber-700' : 'bg-kiaa-100 text-kiaa-700'
                            }`}>{p.type}</span>
                            Full Package
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ACA_ROWS.map(({ sec, key, label, format: fmt }, i) => {
                      if (sec) return (
                        <tr key={i} className="border-b border-surface-50">
                          <td colSpan={acaPlans.length + 1} className="px-4 py-1.5 bg-kiaa-700 text-white text-xs font-semibold uppercase tracking-wide">
                            {sec}
                          </td>
                        </tr>
                      )
                      return (
                        <tr key={key} className="border-b border-surface-50 hover:bg-kiaa-50/20 transition-colors">
                          <td className="px-4 py-2.5 text-xs font-medium text-surface-500 bg-white sticky left-0">{label}</td>
                          {acaPlans.map(p => (
                            <td key={p.id} className="px-3 py-2.5 text-center text-xs text-surface-600">
                              {fmt ? fmt(p[key]) : (p[key] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                    {/* Riders row */}
                    <tr className="border-b border-surface-50 bg-kiaa-50/30">
                      <td className="px-4 py-2.5 text-xs font-medium text-surface-500 bg-kiaa-50/50 sticky left-0">Coverage riders</td>
                      {acaPlans.map(p => (
                        <td key={p.id} className="px-3 py-2.5 text-center text-xs text-kiaa-700 font-semibold">
                          ✓ Dental · Vision · Life/AD&D
                        </td>
                      ))}
                    </tr>
                    {/* Riders premiums */}
                    {[
                      { label: 'Riders — Single', key: 'r_single',    val: '$45.24/mo' },
                      { label: 'Riders — 2-Party', key: 'r_two_party', val: '$92.40/mo' },
                      { label: 'Riders — Family',  key: 'r_family',   val: '$136.36/mo' },
                    ].map(({ label, key, val }) => (
                      <tr key={key} className="border-b border-surface-50 hover:bg-kiaa-50/20">
                        <td className="px-4 py-2 text-xs font-medium text-surface-400 bg-white sticky left-0">{label}</td>
                        {acaPlans.map(p => (
                          <td key={p.id} className="px-3 py-2 text-center text-xs font-mono text-surface-600">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-surface-400 italic">
              All ACA plans comply with Hawaii PHCA (HRS § 393). Premiums are age-based — actual employee
              premiums are calculated using the KIAA ACA Premium Calculator. Refer to each plan's SBC for
              complete benefit details.
            </p>
          </>
        )
      })()}
    </div>
  )
}
