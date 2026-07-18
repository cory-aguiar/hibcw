import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { usePlanYear } from '@/lib/PlanYearContext'
import { PLANS, formatPhone } from '@/lib/plans'
import { X, Save, Calculator, Info, ChevronDown, ChevronUp } from 'lucide-react'

function randomCode() {
  // Alphanumeric company code — excludes ambiguous chars (0,O,1,I,L)
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => CHARS[b % CHARS.length]).join('')
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','GU','VI','AS','MP',
]

// IRS/DOL FTE calculation
// FTE = full-time + (part-time monthly hrs / 120) + (seasonal monthly hrs / 120)
// Monthly hrs = weekly avg × 4.33
function calcFTE({ ft=0, ptCount=0, ptHrs=0, seasonal=0, seasHrs=0 }) {
  const ptFTE   = (ptCount   * ptHrs   * 4.33) / 120
  const seasFTE = (seasonal  * seasHrs * 4.33) / 120
  return parseFloat((ft + ptFTE + seasFTE).toFixed(2))
}

function SectionHeader({ title, sub, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-left"
    >
      <div>
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide">{title}</div>
        {sub && <div className="text-xs text-surface-400 font-normal normal-case mt-0.5">{sub}</div>}
      </div>
      {open ? <ChevronUp size={13} className="text-surface-400"/> : <ChevronDown size={13} className="text-surface-400"/>}
    </button>
  )
}

export default function CompanyModal({ company, onClose, onSaved }) {
  const { user, isAdmin } = useAuth()
  const { oePlanYear } = usePlanYear()
  const isEdit = !!company

  const [form, setForm] = useState({
    name:           company?.name           || '',
    company_code:   company?.company_code   || randomCode(),
    contact_name:   company?.contact_name   || '',
    contact_email:  company?.contact_email  || '',
    contact_phone:  formatPhone(company?.contact_phone) || '',
    address_line1:  company?.address_line1  || '',
    address_line2:  company?.address_line2  || '',
    city:           company?.city           || '',
    state:          company?.state          || 'HI',
    zip:            company?.zip            || '',
    notes:          company?.notes          || '',
    renewal_date:   company?.renewal_date   || '',
    status:         company?.status         || 'active',
    plans:          company?.plans          || [],
    band:           company?.band != null ? String(company.band) : '',
    // FTE worksheet
    ft_employees:        company?.ft_employees        || '',
    pt_employees:        company?.pt_employees        || '',
    pt_avg_hrs:          company?.pt_avg_hrs          || '',
    seasonal_employees:  company?.seasonal_employees  || '',
    seasonal_avg_hrs:    company?.seasonal_avg_hrs    || '',
    // Plan participants (ERISA)
    plan_participants:   company?.plan_participants   || '',
    // Employee-facing / portal fields
    benefits_contact_name:  company?.benefits_contact_name  || '',
    benefits_contact_email: company?.benefits_contact_email || '',
    benefits_contact_phone: formatPhone(company?.benefits_contact_phone) || '',
    oe_deadline:            company?.oe_deadline            || '',
    oe_instructions:        company?.oe_instructions        || '',
    kaiser_eligible:        company?.kaiser_eligible        || false,
    group_type:             company?.group_type             || 'merit_rated',
    aca_quarter:            company?.aca_quarter            || '',
    hmsa_group_no:          company?.hmsa_group_no           || '',
    kaiser_group_no:        company?.kaiser_group_no          || '',
  })

  // Section open/close state
  const [sections, setSections] = useState({
    company: true, contact: true, address: false, fte: true, plans: true, notes: false
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }
  function toggleSection(key) { setSections(s => ({ ...s, [key]: !s[key] })) }
  function togglePlan(id) {
    setForm(f => ({
      ...f,
      plans: f.plans.includes(id) ? f.plans.filter(p => p !== id) : [...f.plans, id]
    }))
  }

  // Live-calculated FTE and headcount
  const fte = calcFTE({
    ft:       parseFloat(form.ft_employees)       || 0,
    ptCount:  parseFloat(form.pt_employees)       || 0,
    ptHrs:    parseFloat(form.pt_avg_hrs)         || 0,
    seasonal: parseFloat(form.seasonal_employees) || 0,
    seasHrs:  parseFloat(form.seasonal_avg_hrs)   || 0,
  })
  const headcount = (parseFloat(form.ft_employees) || 0)
    + (parseFloat(form.pt_employees) || 0)
    + (parseFloat(form.seasonal_employees) || 0)

  const cobraApplies = fte >= 20
  const fmlaApplies  = headcount >= 50
  const hasFTEData   = form.ft_employees !== ''

  // Sync the "Plans enrolled" checklist into company_elections rows so the
  // Open Enrollment tab (which reads company_elections, not company.plans)
  // reflects what was checked here. Only touches the `elected` flag on each
  // row — never overwrites contribution amounts already entered elsewhere.
  // ACA companies use a separate election flow (different plan IDs) so this
  // is skipped for them.
  async function syncPlanElections(companyId) {
    if (!companyId || form.group_type === 'aca_small_group') return
    const rows = PLANS.map(p => ({
      company_id: companyId,
      plan_year:  oePlanYear,
      plan_id:    p.id,
      elected:    form.plans.includes(p.id),
    }))
    const { error: syncErr } = await supabase
      .from('company_elections')
      .upsert(rows, { onConflict: 'company_id,plan_year,plan_id' })
    if (syncErr) console.error('Failed to sync plan elections:', syncErr)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Company name is required.'); return }

    setSaving(true)
    setError('')

    const addressParts = [
      form.address_line1,
      form.address_line2,
      [form.city, form.state].filter(Boolean).join(', '),
      form.zip,
    ].filter(Boolean)

    // Build payload with only known-safe columns.
    // FTE worksheet columns (ft_employees etc.) require migration 007 to be run.
    // We try to include them but catch column-not-found errors gracefully.
    const ftCount  = parseFloat(form.ft_employees)       || 0
    const ptCount  = parseFloat(form.pt_employees)       || 0
    const ptHrs    = parseFloat(form.pt_avg_hrs)         || 0
    const seasCount= parseFloat(form.seasonal_employees) || 0
    const seasHrs  = parseFloat(form.seasonal_avg_hrs)   || 0
    const calcFte  = hasFTEData ? fte  : (parseFloat(form.employee_count) || 0)
    const calcHC   = hasFTEData ? headcount : (parseInt(form.employee_count) || 0)

    const payload = {
      name:           form.name.trim(),
      company_code:   form.company_code ? String(form.company_code).trim() : null,
      band:                  form.band ? parseInt(form.band) : null,
      group_type:             form.group_type             || 'merit_rated',
      aca_quarter:            form.aca_quarter            || null,
      hmsa_group_no:          form.hmsa_group_no          || null,
      kaiser_group_no:        form.kaiser_group_no        || null,
      benefits_contact_name:  form.benefits_contact_name  || null,
      benefits_contact_email: form.benefits_contact_email || null,
      benefits_contact_phone: form.benefits_contact_phone || null,
      oe_deadline:            form.oe_deadline            || null,
      oe_instructions:        form.oe_instructions        || null,
      contact_name:   form.contact_name  || null,
      contact_email:  form.contact_email || null,
      contact_phone:  form.contact_phone || null,
      address_line1:  form.address_line1 || null,
      address_line2:  form.address_line2 || null,
      city:           form.city          || null,
      state:          form.state         || null,
      zip:            form.zip           || null,
      address:        addressParts.join(', ') || null,
      notes:          form.notes         || null,
      renewal_date:   form.renewal_date  || null,
      status:         form.status        || 'active',
      plans:          form.plans         || [],
      employee_count: calcHC,
      fte_count:      calcFte,
      headcount:      calcHC,
      plan_participants: form.plan_participants ? parseInt(form.plan_participants) : null,
      ft_employees:       ftCount,
      pt_employees:       ptCount,
      pt_avg_hrs:         ptHrs,
      seasonal_employees: seasCount,
      seasonal_avg_hrs:   seasHrs,
      created_by: user?.id || null,
    }

    const { data, error: err } = isEdit
      ? await supabase.from('companies').update(payload).eq('id', company.id).select()
      : await supabase.from('companies').insert(payload).select()


    setSaving(false)

    if (err) {
      // Column doesn't exist yet — strip unknown columns and retry
      const unknownCols = ['ft_employees','pt_employees','pt_avg_hrs','seasonal_employees','seasonal_avg_hrs','band','oe_status']
      const isColError = err.code === 'PGRST204' || unknownCols.some(c => err.message?.includes(c))
      if (isColError) {
        const safePayload = { ...payload }
        unknownCols.forEach(c => delete safePayload[c])
        const { data: data2, error: err2 } = isEdit
          ? await supabase.from('companies').update(safePayload).eq('id', company.id).select()
          : await supabase.from('companies').insert(safePayload).select()
        if (err2) {
          setError(`Save failed: ${err2.message} (code: ${err2.code})`)
          return
        }
        await syncPlanElections(isEdit ? company.id : data2?.[0]?.id)
        onSaved()
        return
      }
      setError(`Save failed: ${err.message} (code: ${err.code})`)
      return
    }
    await syncPlanElections(isEdit ? company.id : data?.[0]?.id)
    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="font-display text-base font-semibold text-kiaa-700">
            {isEdit ? `Edit — ${company.name}` : 'Add company'}
          </h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="modal-body space-y-1">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-2">{error}</div>
          )}

          {/* ── Company basics ── */}
          <div className="border-b border-surface-100 pb-2">
            <SectionHeader title="Company" open={sections.company} onToggle={() => toggleSection('company')} />
            {sections.company && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="col-span-2">
                  <label className="label">Company name *</label>
                  <input className="input" value={form.name}
                    onChange={e => set('name', e.target.value)} placeholder="Aloha Staffing LLC" />
                </div>
                <div>
                  <label className="label">Employee lookup code <span className="text-surface-400 font-normal normal-case">(employees enter this at /plans)</span></label>
                  <input className="input font-mono tracking-widest" type="number" min="1000" max="9999"
                    value={form.company_code}
                    onChange={e => set('company_code', e.target.value)}
                    placeholder="e.g. 1042" />
                  <p className="text-xs text-surface-400 mt-1">4-digit number. Auto-assigned if left blank. Share with employees so they can view their plans at /plans.</p>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="prospect">Prospect</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="label">Renewal date</label>
                  <input className="input" type="date" value={form.renewal_date}
                    onChange={e => set('renewal_date', e.target.value)} />
                </div>
                <div>
                  <label className="label">HMSA band <span className="text-surface-400 font-normal normal-case">(assigned by HMSA)</span></label>
                  {isAdmin ? (
                    <select className="input" value={form.band} onChange={e => set('band', e.target.value)}>
                      <option value="">— not assigned —</option>
                      {[1,2,3,4,5,6,7,8].map(b => <option key={b} value={b}>Band {b}</option>)}
                      <option value={9}>Band 9 — Riders Only</option>
                    </select>
                  ) : (
                    <div className="input bg-surface-100 text-surface-500 cursor-not-allowed">
                      {form.band ? `Band ${form.band}` : '— set by KIAA administrator —'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Contact ── */}
          <div className="border-b border-surface-100 pb-2">
            <SectionHeader title="Contact" open={sections.contact} onToggle={() => toggleSection('contact')} />
            {sections.contact && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label">Contact name</label>
                  <input className="input" value={form.contact_name}
                    onChange={e => set('contact_name', e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="label">Contact email</label>
                  <input className="input" type="email" value={form.contact_email}
                    onChange={e => set('contact_email', e.target.value)} placeholder="jane@company.com" />
                </div>
                <div className="col-span-2">
                  <label className="label">Contact phone</label>
                  <input className="input" type="tel" value={form.contact_phone}
                    onChange={e => set('contact_phone', formatPhone(e.target.value))} placeholder="(808) 555-0100" />
                </div>
              </div>
            )}
          </div>

          {/* ── Address ── */}
          <div className="border-b border-surface-100 pb-2">
            <SectionHeader title="Address" open={sections.address} onToggle={() => toggleSection('address')} />
            {sections.address && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="col-span-2">
                  <label className="label">Address line 1</label>
                  <input className="input" value={form.address_line1}
                    onChange={e => set('address_line1', e.target.value)} placeholder="123 Kamehameha Ave" />
                </div>
                <div className="col-span-2">
                  <label className="label">Address line 2 <span className="text-surface-400 font-normal normal-case">(suite, floor, etc.)</span></label>
                  <input className="input" value={form.address_line2}
                    onChange={e => set('address_line2', e.target.value)} placeholder="Suite 200" />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city}
                    onChange={e => set('city', e.target.value)} placeholder="Hilo" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">State</label>
                    <select className="input" value={form.state} onChange={e => set('state', e.target.value)}>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">ZIP</label>
                    <input className="input" value={form.zip}
                      onChange={e => set('zip', e.target.value)} placeholder="96720" maxLength={10} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── FTE Worksheet ── */}
          <div className="border-b border-surface-100 pb-2">
            <SectionHeader
              title="Employee count"
              sub="Used to determine COBRA, FMLA & ERISA thresholds"
              open={sections.fte}
              onToggle={() => toggleSection('fte')}
            />
            {sections.fte && (
              <div className="mt-3 space-y-3">

                {/* Info box */}
                <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5">
                  <Info size={13} className="text-kiaa-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-kiaa-700 leading-relaxed">
                    Enter your employee figures below. FTE count is calculated automatically using the
                    IRS/DOL method: <span className="font-mono text-kiaa-800">FTE = full-time + (part-time monthly hrs ÷ 120)</span>.
                    Monthly hours = weekly average × 4.33 weeks.
                  </div>
                </div>

                {/* Full-time */}
                <div>
                  <label className="label">
                    Full-time employees (30+ hrs/week)
                    <span className="text-surface-400 font-normal normal-case ml-1">— counts as 1.0 FTE each</span>
                  </label>
                  <input className="input" type="number" min="0" step="1"
                    value={form.ft_employees}
                    onChange={e => set('ft_employees', e.target.value)}
                    placeholder="e.g. 22" />
                </div>

                {/* Part-time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">
                      Part-time employees
                      <span className="text-surface-400 font-normal normal-case ml-1">(&lt;30 hrs/week)</span>
                    </label>
                    <input className="input" type="number" min="0" step="1"
                      value={form.pt_employees}
                      onChange={e => set('pt_employees', e.target.value)}
                      placeholder="e.g. 8" />
                  </div>
                  <div>
                    <label className="label">Avg weekly hours each</label>
                    <input className="input" type="number" min="1" max="29" step="1"
                      value={form.pt_avg_hrs}
                      onChange={e => set('pt_avg_hrs', e.target.value)}
                      placeholder="e.g. 20" />
                  </div>
                </div>

                {/* Seasonal */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Seasonal employees</label>
                    <input className="input" type="number" min="0" step="1"
                      value={form.seasonal_employees}
                      onChange={e => set('seasonal_employees', e.target.value)}
                      placeholder="e.g. 3" />
                  </div>
                  <div>
                    <label className="label">Avg weekly hours each</label>
                    <input className="input" type="number" min="1" max="40" step="1"
                      value={form.seasonal_avg_hrs}
                      onChange={e => set('seasonal_avg_hrs', e.target.value)}
                      placeholder="e.g. 30" />
                  </div>
                </div>

                {/* Live results */}
                {hasFTEData && (
                  <div className="bg-surface-50 border border-surface-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Calculator size={13} className="text-kiaa-600" />
                      <span className="text-xs font-medium text-kiaa-700">Calculated results</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white border border-surface-100 rounded-lg p-2.5 text-center">
                        <div className="text-xs text-surface-400 mb-0.5">FTE count</div>
                        <div className="text-lg font-semibold text-kiaa-700">{fte}</div>
                        <div className="text-xs text-surface-400">used for COBRA</div>
                      </div>
                      <div className="bg-white border border-surface-100 rounded-lg p-2.5 text-center">
                        <div className="text-xs text-surface-400 mb-0.5">Total headcount</div>
                        <div className="text-lg font-semibold text-surface-700">{headcount}</div>
                        <div className="text-xs text-surface-400">used for FMLA</div>
                      </div>
                    </div>
                    <div className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg ${cobraApplies ? 'bg-kiaa-50 text-kiaa-800' : 'bg-amber-50 text-amber-800'}`}>
                      <span className="font-medium">Federal COBRA</span>
                      <span>{cobraApplies ? `✓ Applies (${fte} FTEs ≥ 20)` : `Not required (${fte} FTEs < 20) — HI state continuation may apply`}</span>
                    </div>
                    <div className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg ${fmlaApplies ? 'bg-kiaa-50 text-kiaa-800' : 'bg-amber-50 text-amber-800'}`}>
                      <span className="font-medium">Federal FMLA</span>
                      <span>{fmlaApplies ? `✓ Applies (${headcount} employees ≥ 50)` : `Not required (${headcount} employees < 50)`}</span>
                    </div>
                  </div>
                )}

                {/* Plan participants */}
                <div>
                  <label className="label">
                    Plan participants
                    <span className="text-surface-400 font-normal normal-case ml-1">— enrolled employees + enrolled dependents (for ERISA Form 5500 — 100+ threshold)</span>
                  </label>
                  <input className="input" type="number" min="0"
                    value={form.plan_participants}
                    onChange={e => set('plan_participants', e.target.value)}
                    placeholder="Leave blank to estimate from headcount" />
                </div>
              </div>
            )}
          </div>

          {/* ── Plans ── */}
          <div className="border-b border-surface-100 pb-2">
            <SectionHeader title="Plans enrolled" open={sections.plans} onToggle={() => toggleSection('plans')} />
            {sections.plans && (
              <div className="flex flex-wrap gap-2 mt-3">
                {PLANS.map(p => (
                  <button key={p.id} type="button" onClick={() => togglePlan(p.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      form.plans.includes(p.id)
                        ? 'bg-kiaa-600 text-white border-kiaa-600'
                        : 'bg-white text-surface-600 border-surface-200 hover:border-kiaa-400'
                    }`}>
                    {p.shortName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div>
            <SectionHeader title="Notes" open={sections.notes} onToggle={() => toggleSection('notes')} />
            {sections.notes && (
              <textarea className="input h-20 resize-none mt-3" value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Renewal notes, special requirements, etc." />
            )}
          </div>

        </div>

        {/* Group type */}
        <div className="px-6 pb-4 border-t border-surface-100 pt-4">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
            Group classification
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Group type</label>
              <select className="input" value={form.group_type || 'merit_rated'}
                onChange={e => set('group_type', e.target.value)}>
                <option value="merit_rated">Merit Rated Group (MRG)</option>
                <option value="aca_small_group">ACA Small Group (ACA)</option>
              </select>
            </div>
            {form.group_type === 'aca_small_group' && (
              <div className="mt-3">
                <label className="label">ACA Quarter</label>
                <select className="input w-48" value={form.aca_quarter || ''}
                  onChange={e => set('aca_quarter', e.target.value)}>
                  <option value="">— not set —</option>
                  {['1','2','3','4'].map(q => (
                    <option key={q} value={`${form.renewal_date?.slice(0,4) || new Date().getFullYear()}-${q}`}>
                      Q{q} {q==='1'?'(Jan–Mar)':q==='2'?'(Apr–Jun)':q==='3'?'(Jul–Sep)':'(Oct–Dec)'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-surface-400 mt-1">Set the active quarter for premium calculations</p>
              </div>
            )}
          </div>
        </div>

        {/* Group numbers */}
        <div className="px-6 pb-4 border-t border-surface-100 pt-4">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
            Group numbers
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">HMSA Group #</label>
              <input className="input font-mono" value={form.hmsa_group_no || ''} placeholder="e.g. 83367"
                onChange={e => set('hmsa_group_no', e.target.value)}/>
            </div>
            <div>
              <label className="label">Kaiser Group # <span className="text-surface-400 font-normal">(if applicable)</span></label>
              <input className="input font-mono" value={form.kaiser_group_no || ''} placeholder="e.g. 7320"
                onChange={e => set('kaiser_group_no', e.target.value)}/>
            </div>
          </div>
        </div>

        {/* Employee-facing fields */}
        <div className="px-6 pb-4 border-t border-surface-100 pt-4">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
            Employee portal — benefits contact &amp; OE info
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Benefits contact name</label>
                <input className="input" value={form.benefits_contact_name || ''} placeholder="Jane Smith"
                  onChange={e => set('benefits_contact_name', e.target.value)}/>
              </div>
              <div>
                <label className="label">Benefits contact email</label>
                <input className="input" type="email" value={form.benefits_contact_email || ''} placeholder="jane@company.com"
                  onChange={e => set('benefits_contact_email', e.target.value)}/>
              </div>
              <div>
                <label className="label">Benefits contact phone</label>
                <input className="input" type="tel" value={form.benefits_contact_phone || ''} placeholder="(808) 555-0100"
                  onChange={e => set('benefits_contact_phone', formatPhone(e.target.value))}/>
              </div>
            </div>
            <div>
              <label className="label">OE deadline <span className="text-surface-400 font-normal">(shown to employees)</span></label>
              <input className="input w-48" type="date" value={form.oe_deadline || ''}
                onChange={e => set('oe_deadline', e.target.value)}/>
            </div>
            <div>
              <label className="label">OE instructions <span className="text-surface-400 font-normal">(shown to employees)</span></label>
              <textarea className="input h-20 resize-none" value={form.oe_instructions || ''}
                placeholder="e.g. Complete your enrollment form and return it to HR by the deadline above."
                onChange={e => set('oe_instructions', e.target.value)}/>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14}/> {saving ? 'Saving…' : 'Save company'}
          </button>
        </div>
      </div>
    </div>
  )
}
