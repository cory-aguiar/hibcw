/**
 * AcaPremiumCalculator
 * Lookup tool for ACA Small Group age-based premiums.
 * Used in the HR Portal for ACA companies.
 *
 * Rules:
 * - Age calculated as of member start date
 * - Ages 0-14: flat pediatric rate
 * - Ages 65+: capped at age-65 rate
 * - Children 18 and under: first 3 charged, rest $0
 * - Adults 19+: always charged at their age rate
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Calculator, Info } from 'lucide-react'

const ACA_PLANS = [
  { id: 'aca_cm_a',     name: 'CompMED A' },
  { id: 'aca_hph_plus', name: 'Health Plan Hawaii Plus' },
  { id: 'aca_ppp',      name: 'PPP' },
]

// All ACA plans are Full Package — Riders included at MRG flat rates
const RIDERS_RATES = {
  single:    45.24,
  two_party: 92.40,
  family:    136.36,
}

const RELATIONSHIPS = ['Employee', 'Spouse / Domestic Partner', 'Child / Dependent']

function calcAge(dob, startDate) {
  if (!dob || !startDate) return null
  const d = new Date(dob)
  const s = new Date(startDate)
  if (isNaN(d) || isNaN(s)) return null
  let age = s.getFullYear() - d.getFullYear()
  const m = s.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && s.getDate() < d.getDate())) age--
  return Math.max(0, age)
}

function lookupAge(age) {
  // ACA age lookup rules
  if (age === null) return null
  if (age <= 14) return 14   // pediatric flat rate stored at age 14
  if (age >= 65) return 65   // capped at 65
  return age
}

export default function AcaPremiumCalculator({ company }) {
  const quarter    = company?.aca_quarter
  const [plan,     setPlan]     = useState('aca_cm_a')
  const [startDate,setStartDate]= useState('')
  const [members,  setMembers]  = useState([
    { id: 1, relationship: 'Employee', dob: '' }
  ])
  const [rates,    setRates]    = useState({}) // age -> premium
  const [result,   setResult]   = useState(null)
  const [ridersTier, setRidersTier] = useState('auto') // 'auto' | 'single' | 'two_party' | 'family'
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!quarter || !plan) return
    supabase.from('aca_rates').select('age, premium')
      .eq('quarter', quarter).eq('plan_id', plan)
      .then(({ data }) => {
        const r = {}
        ;(data || []).forEach(row => { r[row.age] = parseFloat(row.premium) })
        setRates(r)
        setResult(null)
      })
  }, [quarter, plan])

  function addMember() {
    setMembers(m => [...m, { id: Date.now(), relationship: 'Child / Dependent', dob: '' }])
    setResult(null)
  }

  function removeMember(id) {
    setMembers(m => m.filter(x => x.id !== id))
    setResult(null)
  }

  function updateMember(id, field, value) {
    setMembers(m => m.map(x => x.id === id ? { ...x, [field]: value } : x))
    setResult(null)
  }

  function calculate() {
    setError('')
    if (!startDate) { setError('Please enter a start date.'); return }
    if (!quarter)   { setError('No quarter assigned to this company. Ask KIAA to set the ACA quarter.'); return }
    if (!Object.keys(rates).length) { setError(`No rates loaded for ${quarter}. Ask KIAA to upload rates.`); return }

    const rows = []
    let childCount = 0

    members.forEach(m => {
      const age = calcAge(m.dob, startDate)
      if (age === null) { setError(`Missing or invalid date of birth for ${m.relationship}.`); return }
      const isChild = age <= 18
      const lookupAgeVal = lookupAge(age)
      const basePremium = rates[lookupAgeVal] ?? null

      let premium = basePremium
      let note = ''

      if (isChild) {
        childCount++
        if (childCount > 3) {
          premium = 0
          note = 'No charge (4th+ child)'
        }
      }

      rows.push({
        relationship: m.relationship,
        dob:          m.dob,
        age,
        lookupAge:    lookupAgeVal,
        basePremium,
        premium,
        note,
        isChild,
      })
    })

    if (rows.some(r => r.basePremium === null && r.premium !== 0)) {
      setError('Some ages have no rate on file. Check that rates are loaded for this quarter.')
      return
    }

    const medicalTotal = rows.reduce((sum, r) => sum + (r.premium || 0), 0)

    // Determine coverage tier for Riders
    const adultCount = rows.filter(r => !r.isChild).length
    const childCount2 = rows.filter(r => r.isChild).length
    let autoTier
    if (adultCount === 1 && childCount2 === 0) {
      autoTier = 'single'
    } else if (adultCount + childCount2 === 2) {
      autoTier = 'two_party'
    } else {
      autoTier = 'family'
    }
    const selectedTier = ridersTier === 'auto' ? autoTier : ridersTier
    const tierLabel = { single: 'Single', two_party: '2-Party', family: 'Family' }[selectedTier]
    const ridersPremium = RIDERS_RATES[selectedTier]

    const total = medicalTotal + ridersPremium
    setResult({ rows, medicalTotal, ridersTier: tierLabel, ridersPremium, total, plan, quarter, startDate })
  }

  const fmt = v => v === 0 ? '$0.00' : v != null ? `$${parseFloat(v).toFixed(2)}` : '—'
  const planName = ACA_PLANS.find(p => p.id === plan)?.name

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={15} className="text-kiaa-600"/>
        <span className="font-display font-semibold text-surface-700">ACA Premium Calculator</span>
        {quarter && (
          <span className="badge badge-aqua text-xs font-mono">{quarter}</span>
        )}
      </div>

      {!quarter && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 mb-4">
          <Info size={12} className="flex-shrink-0 mt-0.5 text-amber-500"/>
          No ACA quarter assigned to this company. Contact KIAA to set up the quarterly rates.
        </div>
      )}

      <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5 text-xs text-kiaa-700 mb-5">
        <Info size={12} className="flex-shrink-0 mt-0.5"/>
        Premiums are based on each member's age as of their coverage start date.
        Ages 0–14 use the pediatric rate. Ages 65+ are capped at the age-65 rate.
        Only the first 3 children (age 18 and under) are charged a premium.
      </div>

      {/* Plan + Start date */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="label">ACA Plan</label>
          <select className="input" value={plan} onChange={e => { setPlan(e.target.value); setResult(null) }}>
            {ACA_PLANS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Coverage start date</label>
          <input type="date" className="input" value={startDate}
            onChange={e => { setStartDate(e.target.value); setResult(null) }}/>
        </div>
      </div>

      {/* Members */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Members</label>
          <button className="btn btn-sm btn-teal" onClick={addMember}>
            <Plus size={12}/> Add member
          </button>
        </div>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Relationship</label>
                  <select className="input text-sm py-1"
                    value={m.relationship}
                    onChange={e => updateMember(m.id, 'relationship', e.target.value)}
                    disabled={i === 0}>
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Date of birth</label>
                  <input type="date" className="input text-sm py-1"
                    value={m.dob}
                    onChange={e => updateMember(m.id, 'dob', e.target.value)}/>
                </div>
              </div>
              {i > 0 && (
                <button className="btn btn-sm btn-icon text-red-400 hover:text-red-600 flex-shrink-0"
                  onClick={() => removeMember(m.id)}>
                  <Trash2 size={13}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
          <span>⚠</span> {error}
        </div>
      )}

      {/* Riders tier override */}
      <div className="mb-4">
        <label className="label">Riders Package tier</label>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'auto',      label: 'Auto (based on members)' },
            { value: 'single',    label: `Single — ${fmt(RIDERS_RATES.single)}` },
            { value: 'two_party', label: `2-Party — ${fmt(RIDERS_RATES.two_party)}` },
            { value: 'family',    label: `Family — ${fmt(RIDERS_RATES.family)}` },
          ].map(opt => (
            <button key={opt.value}
              onClick={() => { setRidersTier(opt.value); setResult(null) }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                ridersTier === opt.value
                  ? 'bg-kiaa-600 text-white border-kiaa-600'
                  : 'bg-white text-surface-500 border-surface-200 hover:border-kiaa-400'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary mb-6" onClick={calculate}>
        <Calculator size={13}/> Calculate premium
      </button>

      {/* Results */}
      {result && (
        <div className="card p-0 overflow-hidden">
          <div className="bg-kiaa-700 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white font-semibold text-sm">{planName}</div>
              <div className="text-kiaa-200 text-xs mt-0.5">
                Quarter {result.quarter} &nbsp;·&nbsp; Start date: {new Date(result.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-kiaa-200 text-xs">Total monthly premium (incl. Riders)</div>
              <div className="text-white font-display font-bold text-xl">{fmt(result.total)}</div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 py-2">Member</th>
                <th className="text-center text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 py-2">Age</th>
                <th className="text-center text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 py-2">Rated age</th>
                <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 py-2">Premium</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i} className="border-b border-surface-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-surface-700">{r.relationship}</div>
                    {r.note && <div className="text-xs text-amber-600 mt-0.5">{r.note}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-surface-600">{r.age}</td>
                  <td className="px-4 py-2.5 text-center text-surface-500 text-xs">
                    {r.age !== r.lookupAge ? (
                      <span className="badge badge-gray">{r.lookupAge}{r.age <= 14 ? ' (ped)' : r.age >= 65 ? ' (cap)' : ''}</span>
                    ) : r.age}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-kiaa-700">
                    {r.premium === 0 ? <span className="text-surface-400 font-normal">$0.00</span> : fmt(r.premium)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-100 bg-surface-50">
                <td className="px-4 py-2.5 text-sm font-medium text-surface-600">Medical subtotal</td>
                <td colSpan={2} className="px-4 py-2.5 text-xs text-surface-400 text-center">age-based</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-surface-600">{fmt(result.medicalTotal)}</td>
              </tr>
              <tr className="bg-surface-50">
                <td className="px-4 py-2.5 text-sm font-medium text-surface-600">
                  Riders Package
                  <span className="ml-1.5 text-xs text-surface-400">(Vision · Dental · Group Life)</span>
                </td>
                <td colSpan={2} className="px-4 py-2.5 text-xs text-surface-400 text-center">{result.ridersTier}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-surface-600">{fmt(result.ridersPremium)}</td>
              </tr>
              <tr className="bg-kiaa-50 border-t border-kiaa-100">
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-kiaa-700">Total monthly premium</td>
                <td className="px-4 py-3 text-right font-display font-bold text-kiaa-700 text-base">{fmt(result.total)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="px-4 py-3 bg-surface-50 text-xs text-surface-400 border-t border-surface-100">
            This is a premium estimate only. Final premium confirmed by KIAA upon enrollment.
          </div>
        </div>
      )}
    </div>
  )
}
