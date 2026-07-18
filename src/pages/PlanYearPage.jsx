/**
 * PlanYearPage — Admin only
 * KIAA uses this to manage plan year transitions without a code deploy.
 *
 * Two independent settings:
 *   Active Plan Year  — what employees see on /plans
 *   OE Plan Year      — what OE pages read/write (admin + HR portal)
 *
 * Workflow for next OE season (July/August):
 *   1. Change OE Plan Year to '2026-2027'
 *      → OE page, Rate Sheet Manager, Document Library all switch to new year
 *      → Employees still see 2025-2026 on /plans
 *   2. Load new HMSA rates (Rate Sheet Manager)
 *   3. Upload new Kaiser pricing sheets per company
 *   4. Upload new SBCs to Document Library
 *   5. HR clients complete OE for 2026-2027
 *   6. On Oct 1 — change Active Plan Year to '2026-2027'
 *      → Employees now see the new plan year
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePlanYear, planYearLong, planYearLabel } from '@/lib/PlanYearContext'
import { useAuth } from '@/lib/AuthContext'
import { Save, CheckCircle, AlertCircle, Calendar, Users, ClipboardCheck, Info, ChevronRight, DollarSign } from 'lucide-react'

const KNOWN_YEARS = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
  '2027-2028',
  '2028-2029',
]

function YearCard({ title, icon: Icon, yearKey, startKey, endKey, description, badge, accentCls }) {
  const ctx = usePlanYear()
  const currentYear  = ctx[yearKey]
  const currentStart = ctx[startKey]
  const currentEnd   = ctx[endKey]

  const [editing,  setEditing]  = useState(false)
  const [yearVal,  setYearVal]  = useState(currentYear)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  // Derive start/end from selected year
  function deriveRange(year) {
    if (!year || !year.includes('-')) return { start: '', end: '' }
    const [y1, y2] = year.split('-')
    return { start: `10/01/${y1}`, end: `09/30/${y2}` }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const { start, end } = deriveRange(yearVal)

    const updates = [
      { key: yearKey.replace(/([A-Z])/g, '_$1').toLowerCase(), value: yearVal },
      { key: startKey.replace(/([A-Z])/g, '_$1').toLowerCase(), value: start },
      { key: endKey.replace(/([A-Z])/g, '_$1').toLowerCase(), value: end },
    ]

    for (const { key, value } of updates) {
      const { error: e } = await supabase
        .from('app_config')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (e) { setError(e.message); setSaving(false); return }
    }

    await ctx.reload()
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 3000)
  }

  const { start: previewStart, end: previewEnd } = deriveRange(yearVal)
  const isChanged = yearVal !== currentYear

  return (
    <div className={`card border-l-4 ${accentCls}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${accentCls.includes('kiaa') ? 'bg-kiaa-50' : 'bg-surface-100'}`}>
            <Icon size={16} className={accentCls.includes('kiaa') ? 'text-kiaa-600' : 'text-surface-500'}/>
          </div>
          <div>
            <h3 className="font-display font-semibold text-surface-700">{title}</h3>
            <p className="text-xs text-surface-400 mt-0.5">{description}</p>
          </div>
        </div>
        <span className={`badge text-xs ${accentCls.includes('kiaa') ? 'badge-aqua' : 'badge-gray'}`}>{badge}</span>
      </div>

      {/* Current value */}
      <div className="bg-surface-50 rounded-xl px-4 py-3 mb-4">
        <div className="text-xs text-surface-400 mb-1 uppercase tracking-wide font-medium">Currently set to</div>
        <div className="font-display font-bold text-xl text-surface-700">{currentYear}</div>
        <div className="text-xs text-surface-500 mt-0.5">
          {currentStart} – {currentEnd}
        </div>
      </div>

      {/* Edit */}
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="label">Change to plan year</label>
            <select
              className="input"
              value={yearVal}
              onChange={e => setYearVal(e.target.value)}
            >
              {KNOWN_YEARS.map(y => (
                <option key={y} value={y}>{y} — Oct 1, {y.split('-')[0]} – Sep 30, {y.split('-')[1]}</option>
              ))}
            </select>
          </div>

          {isChanged && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-amber-500"/>
              <div>
                This will change to <strong>{yearVal}</strong> ({previewStart} – {previewEnd}).
                All {badge.toLowerCase()} data will switch to this plan year immediately.
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
              <AlertCircle size={13}/>{error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !isChanged}>
              {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Save size={13}/> Save change</>}
            </button>
            <button className="btn btn-sm" onClick={() => { setEditing(false); setYearVal(currentYear) }}>Cancel</button>
            {saved && <span className="text-xs text-kiaa-500 flex items-center gap-1"><CheckCircle size={12}/> Saved</span>}
          </div>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={() => { setEditing(true); setYearVal(currentYear) }}>
          <Calendar size={13}/> Change plan year
        </button>
      )}
    </div>
  )
}

const DEFAULT_RIDERS = {
  drug_single: 113.32,    drug_two_party: 240.64,    drug_family: 360.58,
  vision_single: 7.32,    vision_two_party: 14.62,   vision_family: 21.92,
  dental_single: 33.56,   dental_two_party: 73.42,   dental_family: 110.08,
  life_single: 4.36,      life_two_party: 4.36,      life_family: 4.36,
  compcare: 6.76,
}

function RidersConfig({ planYear }) {
  const [vals,    setVals]    = useState(DEFAULT_RIDERS)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!planYear) return
    setLoading(true)
    supabase.from('riders_config').select('*').eq('plan_year', planYear).single()
      .then(({ data }) => {
        if (data) {
          const { id, plan_year, created_at, updated_at, ...rates } = data
          setVals(rates)
        } else {
          setVals(DEFAULT_RIDERS)
        }
        setLoading(false)
      })
  }, [planYear])

  async function handleSave() {
    setSaving(true)
    await supabase.from('riders_config').upsert({ plan_year: planYear, ...vals }, { onConflict: 'plan_year' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const ROWS = [
    { label: 'Drug',        keys: ['drug_single',   'drug_two_party',   'drug_family']   },
    { label: 'Vision',      keys: ['vision_single', 'vision_two_party', 'vision_family'] },
    { label: 'Dental',      keys: ['dental_single', 'dental_two_party', 'dental_family'] },
    { label: 'Life/AD&D',   keys: ['life_single',   'life_two_party',   'life_family']   },
  ]

  return (
    <div className="card mt-6">
      <h2 className="section-title flex items-center gap-2 mb-1">
        <DollarSign size={14} className="text-kiaa-600"/> Riders &amp; Drug Rates
      </h2>
      <p className="text-xs text-surface-400 mb-4">
        These rates apply to all Full Package HMSA plans for plan year <strong className="text-surface-600">{planYear}</strong>. Update each October when HMSA issues new rates.
      </p>
      {loading ? (
        <div className="text-sm text-surface-400 py-4 text-center">Loading…</div>
      ) : (
        <>
          <table className="w-full border-collapse mb-4 text-sm">
            <thead>
              <tr className="bg-kiaa-700 text-white text-xs">
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Component</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Employee only</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">2-Party</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Family</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => (
                <tr key={row.label} className="border-b border-surface-50">
                  <td className="px-3 py-2 font-medium text-surface-700">{row.label}</td>
                  {row.keys.map(key => (
                    <td key={key} className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-surface-400 text-xs">$</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={vals[key]}
                          onChange={e => setVals(v => ({ ...v, [key]: parseFloat(e.target.value)||0 }))}
                          className="input text-right font-mono text-sm py-1 w-24"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-surface-50">
                <td className="px-3 py-2 font-medium text-surface-700">COMPCARE <span className="text-xs font-normal text-surface-400">(all tiers)</span></td>
                <td className="px-3 py-2 text-right" colSpan={3}>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-surface-400 text-xs">$</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={vals.compcare}
                      onChange={e => setVals(v => ({ ...v, compcare: parseFloat(e.target.value)||0 }))}
                      className="input text-right font-mono text-sm py-1 w-24"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Save size={13}/> Save rates</>}
            </button>
            {saved && <span className="text-xs text-kiaa-500 flex items-center gap-1"><CheckCircle size={12}/> Saved</span>}
          </div>
        </>
      )}
    </div>
  )
}

export default function PlanYearPage() {
  const { profile } = useAuth()
  const { activePlanYear, oePlanYear, activePlanStart, activePlanEnd, oePlanStart, oePlanEnd } = usePlanYear()
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'staff'

  if (!isAdmin) return (
    <div className="p-8 text-surface-400">Access restricted to KIAA admins.</div>
  )

  const inTransition = activePlanYear !== oePlanYear

  return (
    <div className="p-8 page-enter max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Plan Year Settings</h1>
        <p className="text-surface-400 text-sm mt-0.5">
          Manage plan year transitions without a code deploy.
        </p>
      </div>

      {/* Transition mode banner */}
      {inTransition && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-6">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <div>
            <div className="font-semibold text-amber-800 text-sm">OE Transition Mode active</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Employees see <strong>{activePlanYear}</strong> on /plans, while OE pages are configured for <strong>{oePlanYear}</strong>.
              When ready (Oct 1), update the Active Plan Year to match.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <YearCard
          title="Active Plan Year"
          icon={Users}
          yearKey="activePlanYear"
          startKey="activePlanStart"
          endKey="activePlanEnd"
          description="What employees see on the /plans page"
          badge="Employees"
          accentCls="border-kiaa-400"
        />
        <YearCard
          title="OE Plan Year"
          icon={ClipboardCheck}
          yearKey="oePlanYear"
          startKey="oePlanStart"
          endKey="oePlanEnd"
          description="Rate sheets, Open Enrollment, Document Library"
          badge="Admin & HR"
          accentCls="border-surface-300"
        />
      </div>

      {/* OE season workflow guide */}
      <div className="card bg-kiaa-50 border-kiaa-200">
        <h2 className="section-title flex items-center gap-2 mb-4">
          <Info size={14} className="text-kiaa-600"/> OE Season Playbook
        </h2>
        <div className="space-y-3">
          {[
            {
              step: '1',
              when: 'July / August',
              action: 'Change OE Plan Year to 2026-2027',
              detail: 'Rate Sheet Manager, Document Library, and Open Enrollment all switch to the new year. Employee /plans stays on current year.',
              color: 'bg-kiaa-600',
            },
            {
              step: '2',
              when: 'July – September',
              action: 'Load new rates & upload new SBCs',
              detail: 'Upload new HMSA rate CSV in Rate Sheet Manager. Upload new Kaiser pricing sheets per company. Upload new SBCs to Document Library.',
              color: 'bg-kiaa-600',
            },
            {
              step: '3',
              when: 'August – September',
              action: 'HR clients complete OE',
              detail: 'HR contacts elect plans and set contributions for 2026-2027 via the portal. All elections write to the new plan year.',
              color: 'bg-kiaa-600',
            },
            {
              step: '4',
              when: 'October 1',
              action: 'Change Active Plan Year to 2026-2027',
              detail: 'Employees now see the new plan year, new premiums, and new SBCs on /plans. OE is complete.',
              color: 'bg-kiaa-400',
            },
          ].map(({ step, when, action, detail, color }) => (
            <div key={step} className="flex gap-3">
              <div className={`${color} text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                {step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-surface-700">{action}</span>
                  <span className="badge badge-gray text-xs">{when}</span>
                </div>
                <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Riders & Drug config */}
      <RidersConfig planYear={oePlanYear}/>

    </div>
  )
}
