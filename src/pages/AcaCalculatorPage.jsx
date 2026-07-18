import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePlanYear } from '@/lib/PlanYearContext'
import AcaPremiumCalculator from '@/components/AcaPremiumCalculator'
import { PLAN_MAP } from '@/lib/plans'
import { ArrowRight, RefreshCw, Search, X } from 'lucide-react'

const TIERS = [
  { id: 'single',    label: 'Single' },
  { id: 'two_party', label: '2-Party' },
  { id: 'family',    label: 'Family' },
]

// ── Company picker (search + list) ────────────────────────────
function CompanyPicker({ companies, value, onChange }) {
  const [search, setSearch] = useState('')
  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const selected = companies.find(c => c.id === value)

  return (
    <div>
      <label className="label">Select MRG company</label>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"/>
        <input className="input pl-8 text-sm" placeholder="Search companies…"
          value={search} onChange={e => setSearch(e.target.value)}/>
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
            <X size={13}/>
          </button>
        )}
      </div>
      <div className="border border-surface-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-xs text-surface-400 text-center">No companies match</div>
        ) : filtered.map(c => (
          <button key={c.id} onClick={() => onChange(c.id)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm border-b border-surface-50 last:border-0 text-left transition-colors ${
              value === c.id ? 'bg-kiaa-50 text-kiaa-700' : 'hover:bg-surface-50 text-surface-700'
            }`}>
            <span className="font-medium truncate">{c.name}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0 ml-2">
              Band {c.band}
            </span>
          </button>
        ))}
      </div>
      {selected && value && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-100 text-xs text-surface-500">
          <span className="font-medium text-kiaa-700">{selected.name}</span>
          <span className="inline-flex items-center font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Band {selected.band}</span>
          {selected.compcare_elected && <span className="inline-flex items-center font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">COMPCARE</span>}
          {selected.plans?.length > 0 && selected.plans.slice(0,2).map(pid => (
            <span key={pid} className="inline-flex items-center font-semibold px-2 py-0.5 rounded-full bg-kiaa-100 text-kiaa-700">{PLAN_MAP[pid]?.shortName || pid}</span>
          ))}
          {selected.plans?.length > 2 && <span className="text-surface-400">+{selected.plans.length - 2} more</span>}
        </div>
      )}
    </div>
  )
}

// ── Tier selector for one benefit ─────────────────────────────
function TierRow({ label, color, fromRates, toRates, fromTier, toTier, onFromTier, onToTier }) {
  const fromRate = fromRates?.[fromTier]
  const toRate   = toRates?.[toTier]
  const diff     = fromRate != null && toRate != null ? toRate - fromRate : null

  return (
    <div className="border border-surface-100 rounded-xl overflow-hidden mb-3">
      {/* Benefit header */}
      <div className={`px-4 py-2 flex items-center justify-between ${color}`}>
        <span className="font-semibold text-sm">{label}</span>
        {diff != null && (
          <span className={`font-mono text-xs font-bold ${diff > 0 ? 'text-kiaa-300' : diff < 0 ? 'text-emerald-300' : 'text-white/50'}`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(2)}/mo
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="grid grid-cols-[1fr_20px_1fr] gap-2 items-start">
          {/* From */}
          <div>
            <div className="text-xs text-surface-400 font-medium mb-1.5">From</div>
            {TIERS.map(t => {
              const r = fromRates?.[t.id]
              return (
                <button key={t.id} onClick={() => onFromTier(t.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border mb-1 transition-all ${
                    fromTier === t.id
                      ? 'border-kiaa-400 bg-kiaa-50 text-kiaa-700 font-semibold'
                      : 'border-surface-100 hover:border-kiaa-200 text-surface-600'
                  }`}>
                  <span>{t.label}</span>
                  <span className="font-mono text-xs">${r?.toFixed(2)}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-center pt-7 text-surface-300">
            <ArrowRight size={14}/>
          </div>

          {/* To */}
          <div>
            <div className="text-xs text-surface-400 font-medium mb-1.5">To</div>
            {TIERS.map(t => {
              const r = fromRates?.[t.id]
              const isSame = fromTier === t.id
              return (
                <button key={t.id} onClick={() => !isSame && onToTier(t.id)}
                  disabled={isSame}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border mb-1 transition-all ${
                    toTier === t.id
                      ? 'border-kiaa-400 bg-kiaa-50 text-kiaa-700 font-semibold'
                      : isSame
                        ? 'border-surface-50 bg-surface-50 text-surface-300 cursor-not-allowed'
                        : 'border-surface-100 hover:border-kiaa-200 text-surface-600'
                  }`}>
                  <span>{t.label}</span>
                  <span className="font-mono text-xs">{isSame ? '—' : `$${r?.toFixed(2)}`}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Inline result for this benefit */}
        {diff != null && fromTier && toTier && fromTier !== toTier && (
          <div className={`mt-2 flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold ${
            diff > 0 ? 'bg-kiaa-50 text-kiaa-700' : diff < 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-50 text-surface-500'
          }`}>
            <span>${fromRate?.toFixed(2)} → ${toRate?.toFixed(2)}</span>
            <span className="font-mono">{diff > 0 ? '+' : ''}{diff.toFixed(2)}/mo</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MRG Tier Change Calculator ─────────────────────────────────
function MrgTierCalculator() {
  const { oePlanYear } = usePlanYear()
  const PLAN_YEAR = oePlanYear

  const [companies,  setCompanies]  = useState([])
  const [companyId,  setCompanyId]  = useState('')
  const [company,    setCompany]    = useState(null)
  const [planId,     setPlanId]     = useState('')   // selected health plan
  const [ratesMap,   setRatesMap]   = useState({})
  const [ridersRow,  setRidersRow]  = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [qle,        setQle]        = useState('')
  const [fromTier, setFromTier] = useState('')
  const [toTier,   setToTier]   = useState('')

  const QLE_EVENTS = [
    'Marriage', 'Divorce or legal separation', 'Birth or adoption of a child',
    'Dependent child aging off plan (age 26)', 'Death of a covered dependent',
    'Loss of other coverage', 'Other qualifying life event',
  ]

  useEffect(() => {
    supabase.from('companies').select('id,name,band,plans,compcare_elected')
      .eq('group_type','merit_rated').not('band','is',null).order('name')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  useEffect(() => {
    if (!companyId) { setCompany(null); setRatesMap({}); setRidersRow(null); setPlanId(''); return }
    const co = companies.find(c => c.id === companyId)
    setCompany(co || null)
    setPlanId('')
    resetTiers()
    if (co) loadRates(co)
  }, [companyId, companies])

  async function loadRates(co) {
    setLoading(true)
    const { data } = await supabase
      .from('rate_bands').select('*')
      .eq('plan_year', PLAN_YEAR).eq('band', co.band)
    const map = {}
    ;(data || []).forEach(r => { map[r.plan_id] = r })
    setRatesMap(map)
    // Riders — use hardcoded flat rates (not stored in rate_bands)
    setRidersRow({
      dental_single:    33.56, dental_two_party:  73.42, dental_family:  110.08,
      vision_single:     7.32, vision_two_party:  14.62, vision_family:   21.92,
      life_single:       4.36, life_two_party:     4.36, life_family:      4.36,
      premium_single:   45.24, premium_two_party: 92.40, premium_family: 136.36,
    })
    setLoading(false)
  }

  function resetTiers() {
    setFromTier('')
    setToTier('')
  }

  function reset() {
    setCompanyId(''); setCompany(null); setRatesMap({}); setRidersRow(null)
    setPlanId(''); setQle(''); resetTiers()
  }

  // Available medical plans for this company — from elected plans or all in ratesMap
  const availableMedPlans = (() => {
    const electedPids = (company?.plans || []).filter(pid => pid !== 'kiaa_riders' && PLAN_MAP[pid])
    if (electedPids.length > 0) return electedPids.map(pid => PLAN_MAP[pid])
    return Object.keys(ratesMap)
      .filter(pid => pid !== 'kiaa_riders' && PLAN_MAP[pid] && PLAN_MAP[pid].hmsa_class !== 'riders')
      .map(pid => PLAN_MAP[pid])
  })()

  const hasRiders   = true  // All MRG companies can elect Riders — flat rates always apply
  const hasCompcare = company?.compcare_elected

  // Get rates for selected medical plan
  function getMedRates() {
    if (!planId) return null
    const r = ratesMap[planId]
    if (!r) return null
    return { single: r.premium_single, two_party: r.premium_two_party, family: r.premium_family }
  }

  function getRiderRates(type) {
    const r = ridersRow
    if (!r) return null
    // Use DB values if populated, otherwise fall back to known flat rates
    if (type === 'dental') return {
      single:    r.dental_single    || 33.56,
      two_party: r.dental_two_party || 73.42,
      family:    r.dental_family    || 110.08,
    }
    if (type === 'vision') return {
      single:    r.vision_single    || 7.32,
      two_party: r.vision_two_party || 14.62,
      family:    r.vision_family    || 21.92,
    }
    if (type === 'life') return {
      single:    r.life_single    || 4.36,
      two_party: r.life_two_party || 4.36,
      family:    r.life_family    || 4.36,
    }
    return null
  }

  const medRates = getMedRates()
  const benefits = [
    { key: 'medical', label: 'Medical / Drug',       rates: medRates,               show: !!planId  },
    { key: 'dental',  label: 'Dental',               rates: getRiderRates('dental'), show: hasRiders },
    { key: 'vision',  label: 'Vision',               rates: getRiderRates('vision'), show: hasRiders },
    { key: 'life',    label: 'Group Life / AD&D',    rates: getRiderRates('life'),   show: hasRiders },
  ]

  const anySelected = !!(fromTier || toTier)

  // Build breakdown rows using shared fromTier/toTier
  const breakdownRows = benefits.filter(b => b.show && b.rates).map(b => {
    const fRate  = fromTier ? b.rates[fromTier] : null
    const tRate  = toTier   ? b.rates[toTier]   : null
    const changed = fromTier && toTier && fromTier !== toTier
    const diff    = changed && fRate != null && tRate != null ? tRate - fRate : null
    return { ...b, fRate, tRate, changed, diff }
  })

  const hasAnyFrom    = !!planId && Object.keys(ratesMap).length > 0
  const anyFromPicked = !!fromTier
  const anyToPicked   = !!toTier
  const oldTotal = anyFromPicked ? breakdownRows.reduce((sum, r) => sum + (r.fRate ?? 0), 0) + (hasCompcare ? 6.76 : 0) : null
  const newTotal = anyToPicked   ? breakdownRows.reduce((sum, r) => sum + (r.tRate ?? r.fRate ?? 0), 0) + (hasCompcare ? 6.76 : 0) : null
  const totalDiff = newTotal - oldTotal

  const hasMedical = availableMedPlans.length > 0

  return (
    <div>
      <p className="text-surface-400 text-sm mb-5">
        Select a company, choose the health plan, then set tier changes for each elected benefit.
      </p>

      {/* Company + Plan selectors */}
      <div className="card mb-4">
        <CompanyPicker companies={companies} value={companyId} onChange={id => { setCompanyId(id); setPlanId(''); resetTiers() }}/>

        {company && !loading && availableMedPlans.length > 0 && (
          <div className="mt-4 pt-4 border-t border-surface-100">
            <label className="label">Health plan</label>
            <select className="input" value={planId}
              onChange={e => { setPlanId(e.target.value); resetTiers() }}>
              <option value="">— Select plan —</option>
              {availableMedPlans.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* QLE */}
      {company && planId && (
        <div className="card mb-4">
          <label className="label">Qualifying life event</label>
          <select className="input" value={qle} onChange={e => setQle(e.target.value)}>
            <option value="">— Select event —</option>
            {QLE_EVENTS.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
      )}

      {loading && <div className="text-center text-surface-400 text-sm py-6">Loading rates…</div>}

      {!loading && company && Object.keys(ratesMap).length === 0 && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          No rates found for Band {company.band} · Plan Year {PLAN_YEAR}. Check that the rate sheet has been uploaded.
        </div>
      )}

      {/* Benefit tier selectors — only show once plan is selected */}
      {!loading && company && planId && Object.keys(ratesMap).length > 0 && (
        <>
          {/* Single tier change selector */}
          <div className="card mb-4">
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Coverage tier change</div>
            <div className="grid grid-cols-[1fr_24px_1fr] gap-3 items-start">
              <div>
                <label className="label">From tier</label>
                {TIERS.map(t => (
                  <button key={t.id} onClick={() => { setFromTier(t.id); if (toTier === t.id) setToTier('') }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm mb-1.5 transition-all ${
                      fromTier === t.id
                        ? 'border-kiaa-400 bg-kiaa-50 text-kiaa-700 font-semibold'
                        : 'border-surface-100 hover:border-kiaa-200 text-surface-600'
                    }`}>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center pt-8 text-surface-300">
                <ArrowRight size={16}/>
              </div>
              <div>
                <label className="label">To tier</label>
                {TIERS.map(t => {
                  const isSame = fromTier === t.id
                  return (
                    <button key={t.id} onClick={() => !isSame && setToTier(t.id)}
                      disabled={isSame}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm mb-1.5 transition-all ${
                        toTier === t.id
                          ? 'border-kiaa-400 bg-kiaa-50 text-kiaa-700 font-semibold'
                          : isSame
                            ? 'border-surface-50 bg-surface-50 text-surface-300 cursor-not-allowed'
                            : 'border-surface-100 hover:border-kiaa-200 text-surface-600'
                      }`}>
                      <span>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {hasCompcare && (
            <div className="border border-orange-100 rounded-xl overflow-hidden mb-3">
              <div className="bg-orange-600 text-white px-4 py-2 flex items-center justify-between">
                <span className="font-semibold text-sm">COMPCARE — Acupuncture, Massage, Active & Fit</span>
                <span className="font-mono text-xs text-orange-200">$6.76/mo flat</span>
              </div>
              <div className="px-4 py-2.5 text-xs text-surface-500 bg-orange-50">
                Flat rate per covered employee — does not change with coverage tier.
              </div>
            </div>
          )}

          {/* Full premium breakdown */}
          {hasAnyFrom && (
            <div className="border-2 border-kiaa-300 rounded-xl overflow-hidden mt-4">
              {/* Header */}
              <div className="bg-kiaa-700 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white text-sm">Full premium breakdown</div>
                  <div className="text-xs text-kiaa-300 mt-0.5">
                    {company.name} · Band {company.band} · {PLAN_MAP[planId]?.shortName}
                    {qle && ` · ${qle}`}
                  </div>
                </div>
                <div className="text-xs text-kiaa-400 text-right">
                  <div>Effective 1st of month</div>
                  <div>No proration</div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-kiaa-50 border-b border-kiaa-100">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-kiaa-600 uppercase tracking-wider">Benefit</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">From</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">To</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownRows.map(row => (
                      <tr key={row.key} className="border-b border-surface-50 hover:bg-kiaa-50/30">
                        <td className="px-4 py-3 text-surface-600">
                          {row.key === 'medical' ? `Medical / Drug — ${PLAN_MAP[planId]?.shortName}` : row.label}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-surface-500">
                          {row.fRate != null ? `$${row.fRate.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-kiaa-700">
                          {row.tRate != null ? `$${row.tRate.toFixed(2)}` : row.fRate != null ? `$${row.fRate.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.diff != null ? (
                            <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-full ${
                              row.diff > 0 ? 'bg-kiaa-100 text-kiaa-700' : row.diff < 0 ? 'bg-emerald-100 text-emerald-700' : 'text-surface-400'
                            }`}>
                              {row.diff > 0 ? '+' : ''}{row.diff.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-surface-300 italic">no change</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* COMPCARE row */}
                    {hasCompcare && (
                      <tr className="border-b border-surface-50 bg-orange-50/40">
                        <td className="px-4 py-3 text-surface-400 italic text-sm">COMPCARE (flat rate)</td>
                        <td className="px-4 py-3 text-right font-mono text-surface-400">$6.76</td>
                        <td className="px-4 py-3 text-right font-mono text-surface-400">$6.76</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-surface-300 italic">flat rate</span>
                        </td>
                      </tr>
                    )}

                    {/* Total row */}
                    <tr className="bg-kiaa-100 border-t border-kiaa-200">
                      <td className="px-4 py-3 font-semibold text-kiaa-700">Total monthly premium</td>
                      <td className="px-4 py-3 text-right font-mono text-sur-600 font-semibold">
                        {oldTotal != null ? `$${oldTotal.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-kiaa-700 font-bold text-base">
                        {newTotal != null ? `$${newTotal.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {oldTotal != null && newTotal != null && newTotal !== oldTotal && (
                          <span className={`font-mono text-sm font-bold px-2 py-1 rounded-full ${
                            newTotal > oldTotal ? 'bg-kiaa-200 text-kiaa-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {newTotal > oldTotal ? '+' : ''}{(newTotal - oldTotal).toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2 text-xs text-surface-400 italic bg-white border-t border-surface-50">
                Plan year {PLAN_YEAR} · New premium effective 1st of the following month · No proration applied
              </div>
            </div>
          )}

          <button className="btn mt-4 flex items-center gap-2" onClick={reset}>
            <RefreshCw size={13}/> Reset
          </button>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function AcaCalculatorPage() {
  const [tab,        setTab]        = useState('mrg')
  const [companies,  setCompanies]  = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [company,    setCompany]    = useState(null)

  useEffect(() => {
    supabase.from('companies').select('id,name,group_type,aca_quarter')
      .eq('group_type','aca_small_group').order('name')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  useEffect(() => {
    if (!selectedId) { setCompany(null); return }
    setCompany(companies.find(c => c.id === selectedId) || null)
  }, [selectedId, companies])

  return (
    <div className="p-8 page-enter max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Premium Calculator</h1>
        <p className="text-surface-400 text-sm mt-0.5">MRG tier changes and ACA age-based premium lookups</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { id:'mrg', label:'MRG Tier Change' },
          { id:'aca', label:'ACA Age-Based' },
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

      {tab === 'mrg' && <MrgTierCalculator />}

      {tab === 'aca' && (
        <>
          <div className="card mb-5">
            <label className="label">Select ACA company</label>
            <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">— Select a company —</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.aca_quarter ? ` · ${c.aca_quarter}` : ' · no quarter set'}
                </option>
              ))}
            </select>
            {companies.length === 0 && (
              <p className="text-xs text-surface-400 mt-2">No ACA companies found.</p>
            )}
          </div>
          {company && (
            <div className="card">
              <AcaPremiumCalculator company={company}/>
            </div>
          )}
        </>
      )}
    </div>
  )
}
