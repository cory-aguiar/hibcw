import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePlanYear } from '@/lib/PlanYearContext'
import { PLANS_7A, PLANS_7B } from '@/lib/plans'
import { Printer } from 'lucide-react'

const BANDS = [1,2,3,4,5,6,7,8,9]

// Fallback hardcoded rates in case DB entry doesn't exist yet
const RIDERS_DEFAULT = {
  drug:    { single: 113.32, two_party: 240.64, family: 360.58 },
  vision:  { single:   7.32, two_party:  14.62, family:  21.92 },
  dental:  { single:  33.56, two_party:  73.42, family: 110.08 },
  life:    { single:   4.36, two_party:   4.36, family:   4.36 },
  compcare: 6.76,
}

const TIERS = [
  { key: 'single',    label: 'Employee only' },
  { key: 'two_party', label: 'Employee + 1 dependent' },
  { key: 'family',    label: 'Employee + family' },
]

function fmt(n) {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TH = ({ children, green }) => (
  <th className={`px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider ${green ? 'text-kiaa-600' : 'text-surface-500'}`}>
    {children}
  </th>
)

// ── Full Package table (Medical + Drug + Vision + Dental + Life + Total) ──
function FullPackageSection({ title, note, plans, ratesMap, isKaiser, showCompcare, riders }) {
  const filteredPlans = plans.filter(p => ratesMap[p.id])
  if (filteredPlans.length === 0) return null

  return (
    <div className="mb-5">
      <div className="bg-kiaa-700 text-white px-4 py-2 rounded-t-xl">
        <div className="font-bold text-sm">{title}</div>
        {note && <div className="text-xs text-kiaa-300 mt-0.5">{note}</div>}
      </div>
      <div className="border border-surface-100 rounded-b-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-100">
              <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider w-52"></th>
              <TH>{isKaiser ? 'Medical (incl. Drug)' : 'Medical'}</TH>
              {!isKaiser && <TH>Drug</TH>}
              <TH>Vision</TH>
              <TH>Dental</TH>
              <TH>Life/AD&D</TH>
              {showCompcare && <TH>COMPCARE</TH>}
              <TH green>Total*</TH>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map(plan => {
              const r = ratesMap[plan.id]
              const typeBadge = plan.type === 'HMO'
                ? <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">HMO</span>
                : <span className="ml-2 text-xs font-bold text-kiaa-700 bg-kiaa-100 px-2 py-0.5 rounded">PPO</span>
              const isFullOnly = plan.package === 'Full Package Only'
              const displayName = plan.name.replace(' (Full Package)', '').replace(' (Medical Only)', '')
              const totalCols = (isKaiser ? 7 : 8) + (showCompcare ? 1 : 0)
              return (
                <>
                  <tr key={`${plan.id}-hdr`}>
                    <td colSpan={totalCols} className="px-3 pt-3 pb-1">
                      <div className="flex items-center">
                        <span className="font-bold text-sm text-white bg-kiaa-700 px-3 py-1 rounded-lg">{displayName}</span>
                        {typeBadge}
                        {isFullOnly && <span className="ml-2 text-xs text-surface-400 italic">Full Package ONLY</span>}
                        {isKaiser && <span className="ml-2 text-xs text-surface-400 italic">Drug included in medical</span>}
                      </div>
                    </td>
                  </tr>
                  {TIERS.map(t => {
                    const medAndDrug = r[`medical_${t.key}`] || 0
                    const medical    = isKaiser ? medAndDrug : Math.max(0, medAndDrug - riders.drug[t.key])
                    const drug       = isKaiser ? 0 : riders.drug[t.key]
                    const vision     = riders.vision[t.key]
                    const dental     = riders.dental[t.key]
                    const life       = riders.life[t.key]
                    const compcare   = showCompcare ? riders.compcare : 0
                    const total      = medAndDrug + vision + dental + life + compcare
                    return (
                      <tr key={`${plan.id}-${t.key}`} className="border-b border-surface-50 hover:bg-kiaa-50/30 text-sm">
                        <td className="px-3 py-2 text-surface-600 pl-6">{t.label}</td>
                        <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(medical)}</td>
                        {!isKaiser && <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(drug)}</td>}
                        <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(vision)}</td>
                        <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(dental)}</td>
                        <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(life)}</td>
                        {showCompcare && <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(riders.compcare)}</td>}
                        <td className="px-3 py-2 text-right font-mono font-semibold text-kiaa-700">{fmt(total)}</td>
                      </tr>
                    )
                  })}
                  <tr key={`${plan.id}-spacer`}><td colSpan={totalCols} className="py-1"></td></tr>
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Medical Only table (Medical = Total) ──
function MedicalOnlySection({ title, note, plans, ratesMap }) {
  const filteredPlans = plans.filter(p => ratesMap[p.id])
  if (filteredPlans.length === 0) return null

  return (
    <div className="mb-5">
      <div className="bg-kiaa-700 text-white px-4 py-2 rounded-t-xl">
        <div className="font-bold text-sm">{title}</div>
        {note && <div className="text-xs text-kiaa-300 mt-0.5">{note}</div>}
      </div>
      <div className="border border-surface-100 rounded-b-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-100">
              <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider w-52"></th>
              <TH>Medical only</TH>
              <TH green>Total*</TH>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map(plan => {
              const r = ratesMap[plan.id]
              const typeBadge = plan.type === 'HMO'
                ? <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">HMO</span>
                : <span className="ml-2 text-xs font-bold text-kiaa-700 bg-kiaa-100 px-2 py-0.5 rounded">PPO</span>
              const displayName = plan.name.replace(' (Full Package)', '').replace(' (Medical Only)', '')
              return (
                <>
                  <tr key={`${plan.id}-hdr`}>
                    <td colSpan={3} className="px-3 pt-3 pb-1">
                      <div className="flex items-center">
                        <span className="font-bold text-sm text-white bg-kiaa-700 px-3 py-1 rounded-lg">{displayName}</span>
                        {typeBadge}
                        <span className="ml-2 text-xs text-surface-400 italic">Medical Only</span>
                      </div>
                    </td>
                  </tr>
                  {TIERS.map(t => {
                    const medical = r[`medical_${t.key}`] || r[`premium_${t.key}`] || 0
                    return (
                      <tr key={`${plan.id}-${t.key}`} className="border-b border-surface-50 hover:bg-kiaa-50/30 text-sm">
                        <td className="px-3 py-2 text-surface-600 pl-6">{t.label}</td>
                        <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(medical)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-kiaa-700">{fmt(medical)}</td>
                      </tr>
                    )
                  })}
                  <tr key={`${plan.id}-spacer`}><td colSpan={3} className="py-1"></td></tr>
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PremiumSheetPage() {
  const { activePlanYear } = usePlanYear()
  const [band,           setBand]           = useState(1)
  const [ratesMap,       setRatesMap]       = useState({})
  const [loading,        setLoading]        = useState(false)
  const [showCompcare,   setShowCompcare]   = useState(false)
  const [kaiserSchedule, setKaiserSchedule] = useState('')
  const [kaiserRates,    setKaiserRates]    = useState([])
  const [kaiserSchedules,setKaiserSchedules]= useState([])
  const [kaiserLoading,  setKaiserLoading]  = useState(false)
  const [riders,         setRiders]         = useState(RIDERS_DEFAULT)
  const PLAN_YEAR = activePlanYear

  // Load Riders & Drug rates from DB
  useEffect(() => {
    if (!PLAN_YEAR) return
    supabase.from('riders_config').select('*').eq('plan_year', PLAN_YEAR).single()
      .then(({ data }) => {
        if (data) {
          setRiders({
            drug:     { single: data.drug_single,    two_party: data.drug_two_party,    family: data.drug_family    },
            vision:   { single: data.vision_single,  two_party: data.vision_two_party,  family: data.vision_family  },
            dental:   { single: data.dental_single,  two_party: data.dental_two_party,  family: data.dental_family  },
            life:     { single: data.life_single,    two_party: data.life_two_party,    family: data.life_family    },
            compcare: data.compcare,
          })
        }
      })
  }, [PLAN_YEAR])

  // Load HMSA rates
  useEffect(() => {
    if (!band) return
    setLoading(true)
    supabase.from('rate_bands').select('*')
      .eq('plan_year', PLAN_YEAR).eq('band', band)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(r => { map[r.plan_id] = r })
        setRatesMap(map)
        setLoading(false)
      })
  }, [band, PLAN_YEAR])

  // Load available Kaiser schedules
  useEffect(() => {
    supabase.from('kaiser_rates').select('schedule')
      .eq('plan_year', PLAN_YEAR)
      .then(({ data }) => {
        const unique = [...new Set((data||[]).map(r => r.schedule))].sort()
        setKaiserSchedules(unique)
      })
  }, [PLAN_YEAR])

  // Load Kaiser rates when schedule selected
  useEffect(() => {
    if (!kaiserSchedule) { setKaiserRates([]); return }
    setKaiserLoading(true)
    supabase.from('kaiser_rates').select('*')
      .eq('plan_year', PLAN_YEAR)
      .eq('schedule', kaiserSchedule)
      .order('kaiser_plan_no')
      .then(({ data }) => {
        setKaiserRates(data || [])
        setKaiserLoading(false)
      })
  }, [kaiserSchedule, PLAN_YEAR])

  // Split plans by class and package
  const plans7aFull    = PLANS_7A.filter(p => p.hmsa_class === '7a' && p.package !== 'Medical Only' && p.id !== 'kiaa_riders')
  const plans7aMedOnly = PLANS_7A.filter(p => p.hmsa_class === '7a' && p.package === 'Medical Only')
  const plans7bFull    = PLANS_7B.filter(p => p.hmsa_class === '7b' && p.package !== 'Medical Only')
  const plans7bMedOnly = PLANS_7B.filter(p => p.hmsa_class === '7b' && p.package === 'Medical Only')

  const hasAnyRates = Object.keys(ratesMap).length > 0

  return (
    <div className="p-8 page-enter max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-700">Premium Rate Sheet</h1>
          <p className="text-surface-400 text-sm mt-0.5">HMSA health plan premiums by band · {PLAN_YEAR}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="label">Band</label>
            <select className="input w-36" value={band} onChange={e => setBand(Number(e.target.value))}>
              {BANDS.map(b => <option key={b} value={b}>Band {b}</option>)}
            </select>
          </div>
          {kaiserSchedules.length > 0 && (
            <div>
              <label className="label">Kaiser schedule</label>
              <select className="input w-44" value={kaiserSchedule} onChange={e => setKaiserSchedule(e.target.value)}>
                <option value="">— None —</option>
                {kaiserSchedules.map(s => <option key={s} value={s}>Schedule {s}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <input type="checkbox" checked={showCompcare}
              onChange={e => setShowCompcare(e.target.checked)}
              className="w-4 h-4 accent-kiaa-600"/>
            <span className="text-sm text-surface-600">Include COMPCARE</span>
          </label>
          <button className="btn flex items-center gap-2 mt-5" onClick={() => window.print()}>
            <Printer size={14}/> Print
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-surface-400 text-sm py-12">Loading rates…</div>}

      {!loading && !hasAnyRates && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          No rates found for Band {band} · Plan Year {PLAN_YEAR}. Upload rates on the Rate Sheet page.
        </div>
      )}

      {!loading && hasAnyRates && (
        <>
          <div className="mb-4 p-4 bg-kiaa-700 rounded-xl text-white flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-bold">Band {band}</div>
              <div className="text-kiaa-300 text-sm">Rates effective October 1, 2025 – September 30, 2026</div>
            </div>
            <div className="text-right text-xs text-kiaa-300">
              <div>KIAA Connect</div>
              <div>Kanoelehua Industrial Area Association</div>
            </div>
          </div>

          {/* 7(a) Full Package */}
          <FullPackageSection
            title="Available HMSA Plans — 7(a) Health Plans (Full Package)"
            note="7(a) Plans are equal to or better than the benefits offered by the prevalent plan in Hawaii."
            plans={plans7aFull}
            ratesMap={ratesMap}
            showCompcare={showCompcare}
            riders={riders}
          />

          {/* 7(a) Medical Only */}
          <MedicalOnlySection
            title="Available HMSA Plans — 7(a) Health Plans (Medical Only)"
            note="Medical premium only. Drug, Vision, Dental, and Life/AD&D not included."
            plans={plans7aMedOnly}
            ratesMap={ratesMap}
          />

          {/* 7(b) Full Package */}
          <FullPackageSection
            title="Available HMSA Plans — 7(b) Health Plans (Full Package)"
            note="7(b) Plans may have more limited benefits. Employer must pay one-half of dependents' coverage cost."
            plans={plans7bFull}
            ratesMap={ratesMap}
            showCompcare={showCompcare}
            riders={riders}
          />

          {/* 7(b) Medical Only */}
          <MedicalOnlySection
            title="Available HMSA Plans — 7(b) Health Plans (Medical Only)"
            note="Medical premium only. Drug, Vision, Dental, and Life/AD&D not included."
            plans={plans7bMedOnly}
            ratesMap={ratesMap}
          />

          {/* Kaiser */}
          {Object.keys(ratesMap).some(k => k.startsWith('kaiser_')) && (
            <FullPackageSection
              title="Kaiser Health Plans"
              note="Kaiser medical premiums include Drug. Vision, Dental, and Life/AD&D rates are loaded per plan year."
              plans={Object.keys(ratesMap).filter(k => k.startsWith('kaiser_')).map(k => ({
                id: k, name: k.replace('kaiser_', 'Kaiser '), type: 'HMO', package: 'Full Package', hmsa_class: 'kaiser'
              }))}
              ratesMap={ratesMap}
              isKaiser
              showCompcare={false}
              riders={riders}
            />
          )}

          {/* Riders */}
          <div className="mb-5">
            <div className="bg-slate-600 text-white px-4 py-2 rounded-t-xl">
              <div className="font-bold text-sm">KIAA Riders Package</div>
              <div className="text-xs text-slate-300 mt-0.5">Adult Dental · Vision · Group Life/AD&D — standalone add-on, enrolled as a separate group</div>
            </div>
            <div className="border border-surface-100 rounded-b-xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider w-52"></th>
                    <TH>Vision</TH><TH>Dental</TH><TH>Life/AD&D</TH><TH green>Total</TH>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map(t => (
                    <tr key={t.key} className="border-b border-surface-50 hover:bg-slate-50 text-sm">
                      <td className="px-3 py-2 pl-6 text-surface-600">{t.label}</td>
                      <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(riders.vision[t.key])}</td>
                      <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(riders.dental[t.key])}</td>
                      <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(riders.life[t.key])}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-kiaa-700">{fmt(riders.vision[t.key]+riders.dental[t.key]+riders.life[t.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* COMPCARE */}
          <div className="mb-5">
            <div className="bg-orange-700 text-white px-4 py-2 rounded-t-xl">
              <div className="font-bold text-sm">COMPCARE — Acupuncture, Massage, Active & Fit</div>
              <div className="text-xs text-orange-200 mt-0.5">Optional add-on · flat rate per covered employee · all tiers</div>
            </div>
            <div className="border border-surface-100 rounded-b-xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider"></th>
                    <TH green>Rate/mo</TH>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map(t => (
                    <tr key={t.key} className="border-b border-surface-50 hover:bg-orange-50 text-sm">
                      <td className="px-3 py-2 pl-6 text-surface-600">{t.label}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-kiaa-700">{fmt(riders.compcare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kaiser Schedules */}
          {kaiserSchedule && (
            <>
              {kaiserLoading && <div className="text-center text-surface-400 text-sm py-6">Loading Kaiser rates…</div>}
              {!kaiserLoading && kaiserRates.length > 0 && (() => {
                const planNos = [...new Set(kaiserRates.map(r => r.kaiser_plan_no))].sort()
                const fullRates   = kaiserRates.filter(r => r.package_type === 'full')
                const medRxRates  = kaiserRates.filter(r => r.package_type === 'med_rx')

                return (
                  <>
                    {/* Kaiser Full Package */}
                    {fullRates.length > 0 && (
                      <div className="mb-5">
                        <div className="bg-kiaa-700 text-white px-4 py-2 rounded-t-xl">
                          <div className="font-bold text-sm">Kaiser Permanente — Schedule {kaiserSchedule} (Full Package)</div>
                          <div className="text-xs text-kiaa-300 mt-0.5">Medical (incl. Drug) · Vision · Dental · Life/AD&D. Drug is included in the medical premium.</div>
                        </div>
                        <div className="border border-surface-100 rounded-b-xl overflow-hidden">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-surface-50 border-b border-surface-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider w-52"></th>
                                <TH>Medical (incl. Drug)</TH>
                                <TH>Vision</TH>
                                <TH>Dental</TH>
                                <TH>Life/AD&D</TH>
                                <TH green>Total*</TH>
                              </tr>
                            </thead>
                            <tbody>
                              {fullRates.map(r => {
                                return (
                                  <>
                                    <tr key={`k-full-${r.id}-hdr`}>
                                      <td colSpan={6} className="px-3 pt-3 pb-1">
                                        <div className="flex items-center">
                                          <span className="font-bold text-sm text-white bg-kiaa-700 px-3 py-1 rounded-lg">
                                            Kaiser Plan {r.kaiser_plan_no}
                                          </span>
                                          <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">HMO</span>
                                          <span className="ml-2 text-xs text-surface-400 italic">Full Package · Schedule {kaiserSchedule}</span>
                                        </div>
                                      </td>
                                    </tr>
                                    {TIERS.map(t => {
                                      const medical = r[`medical_${t.key}`] || 0
                                      const vision  = riders.vision[t.key]
                                      const dental  = riders.dental[t.key]
                                      const life    = riders.life[t.key]
                                      const total   = medical + vision + dental + life
                                      return (
                                        <tr key={`k-full-${r.id}-${t.key}`} className="border-b border-surface-50 hover:bg-kiaa-50/30 text-sm">
                                          <td className="px-3 py-2 text-surface-600 pl-6">{t.label}</td>
                                          <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(medical)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(vision)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(dental)}</td>
                                          <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(life)}</td>
                                          <td className="px-3 py-2 text-right font-mono font-semibold text-kiaa-700">{fmt(total)}</td>
                                        </tr>
                                      )
                                    })}
                                    <tr key={`k-full-${r.id}-spacer`}><td colSpan={6} className="py-1"></td></tr>
                                  </>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Kaiser Med/Rx Only */}
                    {medRxRates.length > 0 && (
                      <div className="mb-5">
                        <div className="bg-kiaa-700 text-white px-4 py-2 rounded-t-xl">
                          <div className="font-bold text-sm">Kaiser Permanente — Schedule {kaiserSchedule} (Med/Rx Only)</div>
                          <div className="text-xs text-kiaa-300 mt-0.5">Medical and Drug only. Vision, Dental, and Life/AD&D not included.</div>
                        </div>
                        <div className="border border-surface-100 rounded-b-xl overflow-hidden">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-surface-50 border-b border-surface-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider w-52"></th>
                                <TH>Medical (incl. Drug)</TH>
                                <TH green>Total*</TH>
                              </tr>
                            </thead>
                            <tbody>
                              {medRxRates.map(r => (
                                <>
                                  <tr key={`k-med-${r.id}-hdr`}>
                                    <td colSpan={3} className="px-3 pt-3 pb-1">
                                      <div className="flex items-center">
                                        <span className="font-bold text-sm text-white bg-kiaa-700 px-3 py-1 rounded-lg">
                                          Kaiser Plan {r.kaiser_plan_no}
                                        </span>
                                        <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">HMO</span>
                                        <span className="ml-2 text-xs text-surface-400 italic">Med/Rx Only · Schedule {kaiserSchedule}</span>
                                      </div>
                                    </td>
                                  </tr>
                                  {TIERS.map(t => {
                                    const medical = r[`medical_${t.key}`] || 0
                                    return (
                                      <tr key={`k-med-${r.id}-${t.key}`} className="border-b border-surface-50 hover:bg-kiaa-50/30 text-sm">
                                        <td className="px-3 py-2 text-surface-600 pl-6">{t.label}</td>
                                        <td className="px-3 py-2 text-right font-mono text-surface-700">{fmt(medical)}</td>
                                        <td className="px-3 py-2 text-right font-mono font-semibold text-kiaa-700">{fmt(medical)}</td>
                                      </tr>
                                    )
                                  })}
                                  <tr key={`k-med-${r.id}-spacer`}><td colSpan={3} className="py-1"></td></tr>
                                </>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )}

          <p className="text-xs text-surface-400 italic mt-2">
            * Total premiums exclude KIAA Administrative Fee of $4.00 per employee.
            Drug rates (HMSA only): Single $113.32 · 2-Party $240.64 · Family $360.58.
            Kaiser medical premiums include Drug — no separate Drug column.
            Refer to each plan's SBC for complete benefit details.
          </p>
        </>
      )}
    </div>
  )
}
