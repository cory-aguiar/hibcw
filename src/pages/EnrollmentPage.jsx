import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { PLANS, PLAN_MAP, PLANS_7A, PLANS_7B, RIDERS_PLAN, COMPCARE, isPlanCompCareEligible, groupKaiserRates, isBand9 } from '@/lib/plans'
import KaiserRateTable from '@/components/KaiserRateTable'
import { Save, CheckCircle, AlertCircle, Loader, Info, Lock, ChevronDown, ChevronUp, Printer, Search, X } from 'lucide-react'
import { generateCompanyRateSheet } from '@/lib/rateSheetGenerator'

import { usePlanYear, planYearLabel, planYearLong, acaPlanYearLong } from '@/lib/PlanYearContext'

function fmt(v) {
  if (!v && v !== 0) return '—'
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parseMoney(v) {
  return Math.max(0, parseFloat(String(v).replace(/[$,]/g,'')) || 0)
}

/**
 * Hawaii PHCA employee contribution calculation
 * Employee contribution = min(gross_wages × 1.5%, total_premium × 50%)
 * Source: HRS § 393-15
 */
function calcPhcaContrib(monthlyGrossWage, totalPremium) {
  if (!monthlyGrossWage || !totalPremium) return { contrib: 0, cap: 0, capped: false }
  const pct15   = parseMoney(monthlyGrossWage) * 0.015
  const cap50   = parseMoney(totalPremium) * 0.50
  const contrib = Math.min(pct15, cap50)
  return {
    contrib: Math.round(contrib * 100) / 100,
    cap:     Math.round(cap50 * 100) / 100,
    capped:  pct15 > cap50,
    pct15:   Math.round(pct15 * 100) / 100,
  }
}

function OEStatusBadge({ status }) {
  const map = {
    pending:   { cls: 'badge-gray',  label: 'Pending' },
    submitted: { cls: 'badge-amber', label: 'Submitted' },
    confirmed: { cls: 'badge-green', label: 'Confirmed' },
  }
  const { cls, label } = map[status] || map.pending
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Company search + filter picker ───────────────────────────
function CompanyPicker({ companies, selected, onSelect }) {
  const [search,      setSearch]      = useState('')
  const [filterType,  setFilterType]  = useState('all')   // all | merit_rated | aca_small_group
  const [filterOE,    setFilterOE]    = useState('all')   // all | pending | submitted | confirmed
  const [filterBand,  setFilterBand]  = useState('all')

  const filtered = companies.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType !== 'all' && (c.group_type || 'merit_rated') !== filterType) return false
    if (filterOE   !== 'all' && (c.oe_status  || 'pending')     !== filterOE)   return false
    if (filterBand !== 'all' && String(c.band) !== filterBand)                  return false
    return true
  })

  const hasFilters = search || filterType !== 'all' || filterOE !== 'all' || filterBand !== 'all'
  const selectedCompany = companies.find(c => c.id === selected)

  const OE_COLORS = {
    pending:   'bg-surface-100 text-surface-500',
    submitted: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-kiaa-100 text-kiaa-700',
  }

  return (
    <div>
      <label className="label mb-2">Select company</label>

      {/* Search */}
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          className="input pl-8 text-sm"
          placeholder="Search companies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
            <X size={13}/>
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {/* Group type */}
        <div className="flex items-center gap-0.5 bg-surface-50 border border-surface-100 rounded-lg p-0.5">
          {[['all','All'],['merit_rated','MRG'],['aca_small_group','ACA']].map(([v,l]) => (
            <button key={v} onClick={() => setFilterType(v)}
              className={`text-xs px-2 py-0.5 rounded-md transition-all ${
                filterType === v ? 'bg-kiaa-600 text-white font-semibold' : 'text-surface-500 hover:text-kiaa-600'
              }`}>{l}</button>
          ))}
        </div>

        {/* OE status */}
        <div className="flex items-center gap-0.5 bg-surface-50 border border-surface-100 rounded-lg p-0.5">
          <span className="text-xs text-surface-400 px-1 font-medium">OE:</span>
          {[['all','All'],['pending','Pending'],['submitted','Submitted'],['confirmed','Confirmed']].map(([v,l]) => (
            <button key={v} onClick={() => setFilterOE(v)}
              className={`text-xs px-2 py-0.5 rounded-md transition-all ${
                filterOE === v ? 'bg-kiaa-600 text-white font-semibold' : 'text-surface-500 hover:text-kiaa-600'
              }`}>{l}</button>
          ))}
        </div>

        {/* Band — only for MRG */}
        {filterType !== 'aca_small_group' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-surface-400 font-medium">Band:</span>
            <select className="input text-xs py-0.5 w-auto" value={filterBand} onChange={e => setFilterBand(e.target.value)}>
              <option value="all">All</option>
              {['1','2','3','4','5','6','7','8','9'].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterType('all'); setFilterOE('all'); setFilterBand('all') }}
            className="text-xs px-2 py-0.5 rounded-full border border-surface-200 text-surface-400 hover:text-surface-600 flex items-center gap-1">
            <X size={10}/> Clear
          </button>
        )}

        <span className="text-xs text-surface-400 ml-auto">{filtered.length} of {companies.length}</span>
      </div>

      {/* Company list */}
      <div className="border border-surface-100 rounded-xl overflow-hidden">
        {/* Selected company pinned at top */}
        {selected && selectedCompany && !filtered.find(c => c.id === selected) && (
          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-kiaa-600 text-white text-sm border-b border-kiaa-500"
            onClick={() => onSelect(selected)}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">{selectedCompany.name}</span>
              <span className="text-xs opacity-70">(outside filter)</span>
            </div>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full flex-shrink-0">Selected</span>
          </button>
        )}

        <div className="max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-surface-400">No companies match</div>
          ) : (
            filtered.map(c => {
              const isSelected = c.id === selected
              const oeStatus   = c.oe_status || 'pending'
              const isAca      = c.group_type === 'aca_small_group'
              return (
                <button key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm border-b border-surface-50 last:border-0 transition-colors text-left ${
                    isSelected ? 'bg-kiaa-50 border-kiaa-100' : 'hover:bg-surface-50'
                  }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-medium truncate ${isSelected ? 'text-kiaa-700' : 'text-surface-700'}`}>
                      {c.name}
                    </span>
                    {isAca
                      ? <span className="text-xs font-semibold px-1.5 py-0 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">ACA</span>
                      : c.band
                        ? <span className="text-xs font-semibold px-1.5 py-0 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">B{c.band}</span>
                        : null
                    }
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${OE_COLORS[oeStatus]}`}>
                    {oeStatus.charAt(0).toUpperCase() + oeStatus.slice(1)}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function EnrollmentPage() {
  const { oePlanYear, oePlanStart, oePlanEnd } = usePlanYear()
  const PLAN_YEAR = oePlanYear
  const { profile, isAdmin, isStaff } = useAuth()
  const [companies,  setCompanies]  = useState([])
  const [selected,   setSelected]   = useState('')
  const [rates,      setRates]      = useState({}) // planId -> { single, two_party, family }
  const [elections,  setElections]  = useState({}) // planId -> { elected, ee_single, ee_two_party, ee_family }
  const [oeStatus,   setOeStatus]   = useState('pending')
  const [band,       setBand]       = useState(null)
  const [renewalDate,setRenewalDate]= useState(null)
  const [oeOpenDate, setOeOpenDate] = useState(null)
  const [oeCloseDate,setOeCloseDate]= useState(null)
  const [isAca,      setIsAca]      = useState(false)
  const [acaElected, setAcaElected] = useState({ aca_cm_a: false, aca_hph_plus: false, aca_ppp: false, kiaa_riders: false, compcare: false })
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')
  const [openPlans,  setOpenPlans]  = useState({})
  const [compCareElected, setCompCareElected] = useState(false)
  const [kaiserRates,    setKaiserRates]    = useState([])
  const [kaiserElections,setKaiserElections]= useState({}) // `${planNo}_${pkgType}` -> { elected, ee_single, ee_two_party, ee_family, contrib_method, gross_wage }
  const [openKaiserPlans,setOpenKaiserPlans]= useState({})

  // HR clients auto-select their own company
  useEffect(() => {
    async function load() {
      if (isStaff) {
        // Try with new columns; fall back gracefully if migration 009 not yet run
        let { data, error: qErr } = await supabase
          .from('companies')
          .select('id,name,band,oe_status,group_type,aca_quarter')
          .order('name')
        if (qErr) {
          const fallback = await supabase
            .from('companies')
            .select('id,name')
            .order('name')
          data = (fallback.data || []).map(c => ({
            ...c, band: null, oe_status: 'pending'
          }))
        }
        setCompanies(data || [])
      } else if (profile?.company_id) {
        setSelected(profile.company_id)
      }
    }
    load()
  }, [profile, isStaff])

  // Load rates + elections when company selected
  useEffect(() => {
    if (!selected) return
    loadElectionData()
  }, [selected])

  // Guards against out-of-order async responses: if the user clicks
  // through several companies quickly, an older, slower request can
  // resolve after a newer one and overwrite the correct data on screen.
  // Each call captures its own id; results are only applied if this is
  // still the most recent request by the time each await resolves.
  const loadIdRef = useRef(0)

  async function loadElectionData() {
    const myLoadId = ++loadIdRef.current
    setLoading(true)
    setError('')
    setIsAca(false)

    // Get full company data including group_type for ACA detection.
    // select('*') deliberately, rather than naming columns — avoids this
    // query breaking outright if a column gets renamed/added elsewhere.
    const { data: co, error: coErr } = await supabase
      .from('companies')
      .select('*')
      .eq('id', selected)
      .single()

    // Bail out if a newer request has superseded this one
    if (loadIdRef.current !== myLoadId) return

    if (coErr) {
      console.error('Failed to load company:', coErr)
      setError(`Failed to load company: ${coErr.message}`)
      setLoading(false)
      return
    }

    if (!co) {
      setError('Company not found.')
      setLoading(false)
      return
    }

    // Check if ACA company
    if (co.group_type === 'aca_small_group') {
      setIsAca(true)
      setBand(null)
      setRenewalDate(co.plan_effective_date || co.renewal_date || null)
      setOeOpenDate(co.oe_open_date || null)
      setOeCloseDate(co.oe_close_date || null)
      // Load existing ACA elections
      const { data: acaEl } = await supabase.from('company_elections').select('plan_id, elected')
        .eq('company_id', selected).in('plan_id', ['aca_cm_a','aca_hph_plus','aca_ppp','kiaa_riders','compcare'])
      if (loadIdRef.current !== myLoadId) return
      const el = { aca_cm_a: false, aca_hph_plus: false, aca_ppp: false, kiaa_riders: false, compcare: false }
      ;(acaEl || []).forEach(r => { if (r.plan_id in el) el[r.plan_id] = r.elected })
      setAcaElected(el)
      setLoading(false)
      return
    }
    setIsAca(false)

    if (!co.band) {
      // Migration may not be run yet, or band not assigned
      if (co.oe_status === undefined) {
        setError('Migration 009 has not been run yet. Run 009_open_enrollment.sql in Supabase SQL Editor to enable Open Enrollment.')
      } else {
        setError('This company has no HMSA band assigned. Edit the company and set their band (1–8) to continue.')
      }
      setLoading(false)
      return
    }
    setBand(co.band)
    setOeStatus(co.oe_status || 'pending')
    setCompCareElected(co.compcare_elected || false)
    // Band 9 companies can only elect Riders — reset any other elections
    if (co.band === 9) {
      // Ensure only Riders is available
    }

    // Load Kaiser rates if eligible
    if (co.kaiser_eligible) {
      const { data: kr } = await supabase
        .from('kaiser_rates')
        .select('*')
        .eq('company_id', selected)
        .eq('plan_year', PLAN_YEAR)
        .order('kaiser_plan_no').order('package_type')
      if (loadIdRef.current !== myLoadId) return
      setKaiserRates(kr || [])

      // Load existing Kaiser elections
      const { data: keRows } = await supabase
        .from('company_elections')
        .select('*')
        .eq('company_id', selected)
        .eq('plan_year', PLAN_YEAR)
        .eq('carrier', 'kaiser')
      if (loadIdRef.current !== myLoadId) return
      const ke = {}
      ;(keRows || []).forEach(row => {
        const key = `${row.kaiser_plan_no}_${row.kaiser_package_type}`
        ke[key] = {
          elected:        row.elected ?? false,
          ee_single:      row.ee_single ?? '',
          ee_two_party:   row.ee_two_party ?? '',
          ee_family:      row.ee_family ?? '',
          contrib_method: row.contrib_method || 'fixed',
          gross_wage:     row.gross_wage || '',
        }
      })
      setKaiserElections(ke)
    } else {
      setKaiserRates([])
      setKaiserElections({})
    }

    // Get rates for this band
    const { data: rateRows } = await supabase
      .from('rate_bands')
      .select('plan_id, premium_single, premium_two_party, premium_family, medical_single, medical_two_party, medical_family, vision_single, vision_two_party, vision_family, dental_single, dental_two_party, dental_family, life_single, life_two_party, life_family')
      .eq('plan_year', PLAN_YEAR)
      .eq('band', co.band)

    if (loadIdRef.current !== myLoadId) return

    const r = {}
    ;(rateRows || []).forEach(row => {
      r[row.plan_id] = {
        single:    row.premium_single,
        two_party: row.premium_two_party,
        family:    row.premium_family,
        medical_single:    row.medical_single    || row.premium_single,
        medical_two_party: row.medical_two_party || row.premium_two_party,
        medical_family:    row.medical_family    || row.premium_family,
        vision_single:     row.vision_single    || 0,
        vision_two_party:  row.vision_two_party || 0,
        vision_family:     row.vision_family    || 0,
        dental_single:     row.dental_single    || 0,
        dental_two_party:  row.dental_two_party || 0,
        dental_family:     row.dental_family    || 0,
        life_single:       row.life_single      || 0,
        life_two_party:    row.life_two_party   || 0,
        life_family:       row.life_family      || 0,
      }
    })
    setRates(r)

    // Get existing elections
    // Load riders flat rate
    const { data: ridersRateRow } = await supabase
      .from('rate_bands')
      .select('*')
      .eq('plan_year', PLAN_YEAR)
      .eq('plan_id', 'kiaa_riders')
      .eq('band', 0)
      .maybeSingle()
    if (loadIdRef.current !== myLoadId) return
    if (ridersRateRow) {
      setRates(prev => ({
        ...prev,
        kiaa_riders: {
          single:            ridersRateRow.premium_single,
          two_party:         ridersRateRow.premium_two_party,
          family:            ridersRateRow.premium_family,
          premium_single:    ridersRateRow.premium_single,
          premium_two_party: ridersRateRow.premium_two_party,
          premium_family:    ridersRateRow.premium_family,
          medical_single:    ridersRateRow.medical_single    || 0,
          medical_two_party: ridersRateRow.medical_two_party || 0,
          medical_family:    ridersRateRow.medical_family    || 0,
          vision_single:     ridersRateRow.vision_single     || ridersRateRow.premium_single    || 0,
          vision_two_party:  ridersRateRow.vision_two_party  || ridersRateRow.premium_two_party || 0,
          vision_family:     ridersRateRow.vision_family     || ridersRateRow.premium_family    || 0,
          dental_single:     ridersRateRow.dental_single     || 0,
          dental_two_party:  ridersRateRow.dental_two_party  || 0,
          dental_family:     ridersRateRow.dental_family     || 0,
          life_single:       ridersRateRow.life_single       || 0,
          life_two_party:    ridersRateRow.life_two_party    || 0,
          life_family:       ridersRateRow.life_family       || 0,
        }
      }))
    }

    const { data: elRows } = await supabase
      .from('company_elections')
      .select('*')
      .eq('company_id', selected)
      .eq('plan_year', PLAN_YEAR)

    if (loadIdRef.current !== myLoadId) return

    const e = {}
    PLANS.forEach(p => {
      const existing = elRows?.find(r => r.plan_id === p.id)
      e[p.id] = {
        elected:      existing?.elected      ?? false,
        ee_single:    existing?.ee_single    ?? '',
        ee_two_party: existing?.ee_two_party ?? '',
        ee_family:    existing?.ee_family    ?? '',
      }
    })
    setElections(e)
    setLoading(false)
  }

  function toggleElected(planId) {
    setElections(e => ({ ...e, [planId]: { ...e[planId], elected: !e[planId].elected } }))
    setSaved(false)
  }

  function setContrib(planId, tier, val) {
    setElections(e => ({ ...e, [planId]: { ...e[planId], [tier]: val } }))
    setSaved(false)
  }

  function togglePlanOpen(planId) {
    setOpenPlans(o => ({ ...o, [planId]: !o[planId] }))
  }

  // ── Kaiser helpers ──────────────────────────────────────────
  function toggleKaiserElected(key) {
    setKaiserElections(e => ({ ...e, [key]: { ...(e[key]||{}), elected: !e[key]?.elected } }))
    setSaved(false)
  }
  function setKaiserContrib(key, field, val) {
    setKaiserElections(e => ({ ...e, [key]: { ...(e[key]||{}), [field]: val } }))
    setSaved(false)
  }
  function toggleKaiserPlanOpen(key) {
    setOpenKaiserPlans(o => ({ ...o, [key]: !o[key] }))
  }

  // ── Save draft ──────────────────────────────────────────────
  async function handleSave(submit = false) {
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()

    const rows = PLANS.map(p => {
      const el = elections[p.id] || {}
      const r  = rates[p.id] || {}
      // If PHCA method, calculate contributions from gross wage
      let eeSingle = parseMoney(el.ee_single)
      let eeTwoParty = parseMoney(el.ee_two_party)
      let eeFamily = parseMoney(el.ee_family)
      if (el.contrib_method === 'phca' && el.gross_wage) {
        eeSingle    = calcPhcaContrib(el.gross_wage, r.single).contrib
        eeTwoParty  = calcPhcaContrib(el.gross_wage, r.two_party).contrib
        eeFamily    = calcPhcaContrib(el.gross_wage, r.family).contrib
      }
      return {
        company_id:     selected,
        plan_year:      PLAN_YEAR,
        plan_id:        p.id,
        elected:        el.elected ?? false,
        ee_single:      eeSingle,
        ee_two_party:   eeTwoParty,
        ee_family:      eeFamily,
        submitted_at:   submit ? new Date().toISOString() : null,
        submitted_by:   submit ? user.id : null,
      }
    })

    const { error: err } = await supabase
      .from('company_elections')
      .upsert(rows, { onConflict: 'company_id,plan_year,plan_id' })

    if (err) { setSaving(false); setError(err.message); return }

    // Update plans array and compcare flag on company profile
    const electedPlanIds = PLANS.filter(p => elections[p.id]?.elected).map(p => p.id)
    const newStatus = submit ? 'submitted' : oeStatus

    await supabase
      .from('companies')
      .update({ plans: electedPlanIds, oe_status: newStatus, compcare_elected: compCareElected })
      .eq('id', selected)

    // Save Kaiser elections
    const kaiserGroups = groupKaiserRates(kaiserRates)
    if (kaiserGroups.length > 0) {
      const kaiserRows = kaiserGroups.map(group => {
        const key = `${group.kaiser_plan_no}_${group.package_type}`
        const el  = kaiserElections[key] || {}
        let eeSingle   = parseMoney(el.ee_single)
        let eeTwoParty = parseMoney(el.ee_two_party)
        let eeFamily   = parseMoney(el.ee_family)
        if (el.contrib_method === 'phca' && el.gross_wage) {
          eeSingle    = calcPhcaContrib(el.gross_wage, group.premium_single).contrib
          eeTwoParty  = calcPhcaContrib(el.gross_wage, group.premium_two_party).contrib
          eeFamily    = calcPhcaContrib(el.gross_wage, group.premium_family).contrib
        }
        return {
          company_id:          selected,
          plan_year:           PLAN_YEAR,
          plan_id:             `kaiser_${group.kaiser_plan_no}_${group.package_type}`,
          carrier:             'kaiser',
          kaiser_plan_no:      group.kaiser_plan_no,
          kaiser_package_type: group.package_type,
          elected:             el.elected ?? false,
          ee_single:           eeSingle,
          ee_two_party:        eeTwoParty,
          ee_family:           eeFamily,
          contrib_method:      el.contrib_method || 'fixed',
          gross_wage:          parseMoney(el.gross_wage) || null,
          submitted_at:        submit ? new Date().toISOString() : null,
          submitted_by:        submit ? user.id : null,
        }
      })
      await supabase
        .from('company_elections')
        .upsert(kaiserRows, { onConflict: 'company_id,plan_year,plan_id' })
    }

    if (submit) {
      setOeStatus('submitted')
      // Refresh companies list
      const { data } = await supabase.from('companies').select('id,name,band,oe_status,group_type,aca_quarter').order('name')
      setCompanies(data || [])
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // ── Admin: confirm election ─────────────────────────────────
  async function handleConfirm() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('companies').update({ oe_status: 'confirmed' }).eq('id', selected)
    await supabase.from('company_elections')
      .update({ confirmed_at: new Date().toISOString(), confirmed_by: user.id })
      .eq('company_id', selected)
      .eq('plan_year', PLAN_YEAR)
    setOeStatus('confirmed')
    const { data } = await supabase.from('companies').select('id,name,band,oe_status,group_type,aca_quarter').order('name')
    setCompanies(data || [])
  }

  const company    = companies.find(c => c.id === selected)
  const isLocked   = oeStatus === 'confirmed' && !isAdmin
  const electedCount = Object.values(elections).filter(e => e.elected).length

  return (
    <div className="p-8 page-enter max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Open Enrollment</h1>
        <p className="text-surface-400 text-sm mt-0.5">
          Plan elections and employee contribution amounts &nbsp;·&nbsp; Plan year {oePlanStart} – {oePlanEnd}
        </p>
      </div>

      {/* Company selector (admin/staff only) */}
      {isStaff && (
        <div className="card mb-5">
          <CompanyPicker
            companies={companies}
            selected={selected}
            onSelect={id => { setSelected(id); setSaved(false); setError('') }}
          />
          {company && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-surface-100">
              <div>
                <div className="text-xs text-surface-400 mb-1">OE status</div>
                <OEStatusBadge status={oeStatus}/>
              </div>
              {band && (
                <div>
                  <div className="text-xs text-surface-400 mb-1">HMSA band</div>
                  <span className="badge badge-aqua font-semibold">Band {band}</span>
                </div>
              )}
              {isAca && (
                <div>
                  <div className="text-xs text-surface-400 mb-1">Type</div>
                  <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">ACA Small Group</span>
                </div>
              )}
              {oeStatus === 'submitted' && isAdmin && (
                <button className="btn btn-primary btn-sm ml-auto" onClick={handleConfirm}>
                  <CheckCircle size={13}/> Confirm election
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* HR client header */}
      {!isStaff && profile?.company_id && (
        <div className="card mb-5 bg-kiaa-50 border-kiaa-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display font-semibold text-kiaa-700">Open Enrollment {isAca ? acaPlanYearLong(renewalDate) : oePlanYear}</div>
              <p className="text-sm text-surface-500 mt-0.5">
                {isAca
                  ? `Select the plans you want to offer your employees and set employee contribution amounts.${
                      oeOpenDate && oeCloseDate
                        ? ` Your Open Enrollment window: ${new Date(oeOpenDate+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} – ${new Date(oeCloseDate+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}.`
                        : ' Contact KIAA for your Open Enrollment window dates.'
                    }`
                  : 'Select the plans you want to offer your employees and set employee contribution amounts.'}
              </p>
            </div>
            <OEStatusBadge status={oeStatus}/>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
          <AlertCircle size={14}/>{error}
        </div>
      )}

      {loading && selected && (
        <div className="flex items-center gap-2 text-surface-400 py-8">
          <Loader size={16} className="animate-spin"/> Loading rates and elections…
        </div>
      )}

      {/* No band warning */}
      {!loading && selected && !isAca && !band && !error && (
        <div className="card bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <AlertCircle size={14} className="text-amber-600"/>
            No HMSA band assigned to this company. Edit the company and set their band (1–8) before proceeding.
          </div>
        </div>
      )}

      {/* MRG No rates warning */}
      {!loading && selected && !isAca && band && Object.keys(rates).length === 0 && (
        <div className="card bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <AlertCircle size={14} className="text-amber-600"/>
            No rates found for Band {band} in plan year {oePlanYear}. Go to Rate Sheet Manager to enter premiums first.
          </div>
        </div>
      )}

      {/* ACA Election grid */}
      {!loading && selected && isAca && (
        <>
          {isLocked && (
            <div className="flex items-center gap-2 bg-kiaa-50 border border-kiaa-200 text-kiaa-800 text-sm px-3 py-2.5 rounded-lg mb-4">
              <Lock size={13}/> This election has been confirmed by KIAA and is locked.
            </div>
          )}

          {/* ACA Small Group OE */}
          {isAca && (() => {
            const ACA_PLANS = [
              { id: 'aca_cm_a',     name: 'CompMED A',              type: 'PPO' },
              { id: 'aca_hph_plus', name: 'Health Plan Hawaii Plus', type: 'HMO' },
              { id: 'aca_ppp',      name: 'PPP',                     type: 'PPO' },
            ]
            const ACA_ADDONS = [
              { id: 'kiaa_riders', name: 'KIAA Riders Package', sub: 'Vision · Dental · Group Life/AD&D', badge: 'Riders' },
              { id: 'compcare',    name: 'COMPCARE',            sub: 'Acupuncture · Massage · Active & Fit', badge: 'Add-on' },
            ]
            const co = companies.find(c => c.id === selected)
            const quarter = co?.aca_quarter

            return (
              <div className="space-y-4">
                {/* Quarter info */}
                <div className="flex items-center gap-3">
                  <span className="badge badge-aqua font-mono">ACA Small Group</span>
                  {quarter
                    ? <span className="text-sm text-surface-500">Active quarter: <strong>{quarter}</strong></span>
                    : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">⚠ No ACA quarter set — edit the company to assign one</span>
                  }
                </div>

                {/* Plan elections */}
                <div className="card p-0 overflow-hidden">
                  <div className="bg-kiaa-700 px-4 py-2.5">
                    <span className="text-white text-sm font-semibold">ACA Plan Elections</span>
                    <span className="text-kiaa-200 text-xs ml-2">Select which plans this company offers to employees</span>
                  </div>
                  <div className="divide-y divide-surface-50">
                    {ACA_PLANS.map(plan => (
                      <div key={plan.id} className="flex items-center gap-4 px-4 py-3">
                        <input type="checkbox" className="w-4 h-4 accent-kiaa-600"
                          checked={acaElected[plan.id] || false}
                          onChange={e => setAcaElected(prev => ({ ...prev, [plan.id]: e.target.checked }))}/>
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium text-surface-700 text-sm">{plan.name}</span>
                          <span className={`badge text-xs ${plan.type === 'HMO' ? 'badge-amber' : 'badge-aqua'}`}>{plan.type}</span>
                        </div>
                        <span className="text-xs text-surface-400">Age-based premiums · Medical &amp; Prescription Drug benefits</span>
                      </div>
                    ))}
                    <div className="px-4 py-2 bg-surface-50">
                      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Add-ons</div>
                      {ACA_ADDONS.map(addon => (
                        <div key={addon.id} className="flex items-center gap-4 py-2">
                          <input type="checkbox" className="w-4 h-4 accent-kiaa-600"
                            checked={acaElected[addon.id] || false}
                            onChange={e => setAcaElected(prev => ({ ...prev, [addon.id]: e.target.checked }))}/>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="font-medium text-surface-700 text-sm">{addon.name}</span>
                            <span className="badge badge-gray text-xs">{addon.badge}</span>
                          </div>
                          <span className="text-xs text-surface-400">{addon.sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contributions message */}
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
                  <Info size={14} className="flex-shrink-0 mt-0.5 text-blue-500"/>
                  <div>
                    <strong>Employer contributions</strong> — ACA Small Group premiums are age-based and vary per employee.
                    KIAA does not manage contribution schedules for ACA plans.
                    Please determine your contribution policy separately and communicate it directly to your employees.
                  </div>
                </div>

                {/* Premium sheet download */}
                {quarter && (
                  <div className="flex items-center justify-between bg-surface-50 border border-surface-200 rounded-xl px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-surface-700">Age-based rate sheet</div>
                      <div className="text-xs text-surface-400 mt-0.5">Download the full premium table for {quarter} for employee reference</div>
                    </div>
                    <button className="btn" onClick={async () => {
                      const { data } = await supabase.from('aca_rates').select('plan_id, age, premium')
                        .eq('quarter', quarter).order('plan_id').order('age')
                      if (!data?.length) { alert('No rates found for ' + quarter); return }
                      const planNames = { aca_cm_a: 'CompMED A', aca_hph_plus: 'HPH Plus', aca_ppp: 'PPP' }
                      const rows = [['Plan','Age','Premium']]
                      data.forEach(r => rows.push([planNames[r.plan_id]||r.plan_id, r.age, r.premium]))
                      const csv = rows.map(r => r.join(',')).join('\n')
                      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
                      const a = Object.assign(document.createElement('a'), { href: url, download: `ACA_Rates_${quarter}.csv` })
                      a.click(); URL.revokeObjectURL(url)
                    }}>
                      <Printer size={13}/> Download rate sheet
                    </button>
                  </div>
                )}

                {/* Save button */}
                <div className="flex justify-end gap-3 pt-2">
                  <button className="btn btn-primary" onClick={async () => {
                    setSaving(true)
                    for (const [planId, elected] of Object.entries(acaElected)) {
                      const { data: existing } = await supabase.from('company_elections').select('id')
                        .eq('company_id', selected).eq('plan_id', planId).maybeSingle()
                      if (existing) {
                        await supabase.from('company_elections').update({ elected }).eq('id', existing.id)
                      } else {
                        await supabase.from('company_elections').insert({
                          company_id: selected, plan_id: planId, elected,
                          plan_year: isAca && renewalDate
                            ? `${new Date(renewalDate + 'T00:00:00').getFullYear()}-${new Date(renewalDate + 'T00:00:00').getFullYear() + 1}`
                            : (oePlanYear || '2026')
                        })
                      }
                    }
                    await supabase.from('companies').update({ oe_status: 'confirmed' }).eq('id', selected)
                    setCompanies(prev => prev.map(c => c.id === selected ? { ...c, oe_status: 'confirmed' } : c))
                    setSaving(false)
                  }} disabled={saving}>
                    {saving ? <><Loader size={13} className="animate-spin"/> Saving…</> : <><Save size={13}/> Save elections</>}
                  </button>
                </div>
              </div>
            )
          })()}

          {!isAca && isBand9(company) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 mb-4">
              <Info size={12} className="flex-shrink-0 mt-0.5 text-amber-500"/>
              <div>
                <strong>Band 9 — Riders Only.</strong> This company does not have medical or drug coverage through KIAA.
                Only the standalone Riders Package (Vision, Dental, Group Life/AD&D) is available. COMPCARE is not available for Band 9.
              </div>
            </div>
          )}

        </>
      )}

      {/* MRG Election grid */}
      {!loading && selected && !isAca && band && Object.keys(rates).length > 0 && (
        <>
          {isLocked && (
            <div className="flex items-center gap-2 bg-kiaa-50 border border-kiaa-200 text-kiaa-800 text-sm px-3 py-2.5 rounded-lg mb-4">
              <Lock size={13}/> This election has been confirmed by KIAA and is locked.
            </div>
          )}

          <div className="space-y-3">
            {/* 7(a) section — hidden for Band 9 */}
            {!isBand9(company) && (
              <div className="flex items-center gap-3 py-1">
                <span className="text-xs font-bold bg-kiaa-700 text-kiaa-aqua px-2.5 py-1 rounded">7(a)</span>
                <span className="text-xs text-surface-500 font-medium">Equal to or better than the prevalent plan</span>
              </div>
            )}
            {!isBand9(company) && PLANS_7A.map(plan => {
              const el    = elections[plan.id] || {}
              const r     = rates[plan.id] || {}
              const isOpen = openPlans[plan.id] ?? el.elected
              const eeSingle    = parseMoney(el.ee_single)
              const eeTwoParty  = parseMoney(el.ee_two_party)
              const eeFamily    = parseMoney(el.ee_family)
              const ccAddon     = compCareElected && isPlanCompCareEligible(plan.id) ? COMPCARE.tiers.single : 0
              const erSingle    = Math.max(0, (r.single    || 0) + ccAddon - eeSingle)
              const erTwoParty  = Math.max(0, (r.two_party || 0) + ccAddon - eeTwoParty)
              const erFamily    = Math.max(0, (r.family    || 0) + ccAddon - eeFamily)

              return (
                <div key={plan.id} className={`card p-0 overflow-hidden transition-all ${el.elected ? 'border-kiaa-400' : 'border-surface-100'}`}>
                  {/* Plan header row */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${el.elected ? 'bg-kiaa-600' : 'bg-surface-50 hover:bg-surface-100'}`}
                    onClick={() => !isLocked && togglePlanOpen(plan.id)}
                  >
                    {/* Elect checkbox */}
                    <input
                      type="checkbox"
                      checked={el.elected || false}
                      disabled={isLocked}
                      onChange={e => { e.stopPropagation(); toggleElected(plan.id) }}
                      className="w-4 h-4 accent-kiaa-400 cursor-pointer"
                      onClick={e => e.stopPropagation()}
                    />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${el.elected ? 'bg-kiaa-aqua text-kiaa-800' : 'bg-surface-200 text-surface-600'}`}>
                      {plan.type}
                    </span>
                    <span className={`font-display font-semibold text-sm ${el.elected ? 'text-white' : 'text-surface-700'}`}>
                      {plan.name}
                    </span>
                    {r.single ? (
                      <span className={`text-xs ml-auto mr-2 ${el.elected ? 'text-kiaa-200' : 'text-surface-400'}`}>
                        Single {fmt(r.single)} &nbsp;|&nbsp; 2-Party {fmt(r.two_party)} &nbsp;|&nbsp; Family {fmt(r.family)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500 ml-auto mr-2">No rates for Band {band}</span>
                    )}
                    {isOpen
                      ? <ChevronUp size={14} className={el.elected ? 'text-kiaa-200' : 'text-surface-400'}/>
                      : <ChevronDown size={14} className={el.elected ? 'text-kiaa-200' : 'text-surface-400'}/>
                    }
                  </div>

                  {isOpen && (
                    <div className="p-4 border-t border-surface-100">
                      {/* Contribution method */}
                      <div className="flex items-center gap-3 mb-4 p-3 bg-surface-50 rounded-xl border border-surface-100 flex-wrap">
                        <span className="text-xs font-medium text-surface-500 uppercase tracking-wide flex-shrink-0">Contribution method:</span>
                        <div className="flex gap-2">
                          {[{id:'fixed',label:'Fixed amount'},{id:'phca',label:'PHCA 1.5% method'}].map(({id,label}) => (
                            <button key={id}
                              onClick={() => !isLocked && setContrib(plan.id, 'contrib_method', id)}
                              disabled={isLocked}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                (elections[plan.id]?.contrib_method||'fixed')===id
                                  ? 'bg-kiaa-600 text-white border-kiaa-600'
                                  : 'bg-white text-surface-500 border-surface-200 hover:border-kiaa-400'
                              }`}>{label}</button>
                          ))}
                        </div>
                        {(elections[plan.id]?.contrib_method||'fixed')==='phca' && (
                          <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-surface-500">Avg monthly gross wage:</span>
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                              <input type="number" min="0" step="1"
                                value={elections[plan.id]?.gross_wage??''}
                                onChange={e=>setContrib(plan.id,'gross_wage',e.target.value)}
                                disabled={isLocked}
                                className="input text-right pl-5 pr-2 py-1 text-sm w-32 font-mono"
                                placeholder="3000"/>
                            </div>
                            <span className="text-xs text-surface-400">/ month</span>
                          </div>
                        )}
                      </div>
                      {(elections[plan.id]?.contrib_method||'fixed')==='phca' && (
                        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4 text-xs text-blue-800">
                          <span className="flex-shrink-0 mt-0.5">ℹ</span>
                          <div><strong>Hawaii PHCA § 393-15:</strong> Employee contribution = the lesser of (1) 1.5% of monthly gross wages, or (2) 50% of the total premium.</div>
                        </div>
                      )}
                      <div className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">
                        Monthly premium breakdown &amp; employee contributions
                      </div>
                      <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-max">
                        <thead>
                          <tr className="bg-surface-50">
                            <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2 w-20">Tier</th>
                            <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Medical</th>
                            {(r.vision_single > 0 || r.dental_single > 0) && <>
                              <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Vision</th>
                              <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Dental</th>
                              <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Life/AD&D</th>
                            </>}
                            {compCareElected && isPlanCompCareEligible(plan.id) && (
                              <th className="text-right text-xs font-semibold text-kiaa-500 uppercase tracking-wider pb-2 pt-2 px-2">COMPCARE</th>
                            )}
                            <th className="text-right text-xs font-semibold text-kiaa-600 uppercase tracking-wider pb-2 pt-2 px-2">Total</th>
                            <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Emp. pays</th>
                            <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Er. pays</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {label:'Single',  total:r.single,    eeKey:'ee_single',    medical:r.medical_single,    vision:r.vision_single,    dental:r.dental_single,    life:r.life_single},
                            {label:'2-Party', total:r.two_party, eeKey:'ee_two_party', medical:r.medical_two_party, vision:r.vision_two_party, dental:r.dental_two_party, life:r.life_two_party},
                            {label:'Family',  total:r.family,    eeKey:'ee_family',    medical:r.medical_family,    vision:r.vision_family,    dental:r.dental_family,    life:r.life_family},
                          ].map(({label,total,eeKey,medical,vision,dental,life}) => {
                            const isPhca   = (elections[plan.id]?.contrib_method||'fixed')==='phca'
                            const cc       = compCareElected && isPlanCompCareEligible(plan.id)
                            const adjTotal = total ? parseMoney(total)+(cc?ccAddon:0) : total
                            const phca     = isPhca ? calcPhcaContrib(elections[plan.id]?.gross_wage, adjTotal) : null
                            const fixedEe  = parseMoney(elections[plan.id]?.[eeKey])
                            const displayEe = isPhca ? (phca?.contrib||0) : fixedEe
                            const displayEr = adjTotal ? Math.max(0,parseMoney(adjTotal)-displayEe) : 0
                            const hasBrkdwn = (r.vision_single > 0 || r.dental_single > 0)
                            return (
                              <tr key={label} className="border-t border-surface-50">
                                <td className="py-2 px-2 font-medium text-surface-700">{label}</td>
                                <td className="py-2 px-2 text-right font-mono text-surface-600">{fmt(medical || total)}</td>
                                {hasBrkdwn && <>
                                  <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{vision > 0 ? fmt(vision) : '—'}</td>
                                  <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{dental > 0 ? fmt(dental) : '—'}</td>
                                  <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{life > 0 ? fmt(life) : '—'}</td>
                                </>}
                                {cc && <td className="py-2 px-2 text-right font-mono text-kiaa-500 text-xs">+{fmt(ccAddon)}</td>}
                                <td className="py-2 px-2 text-right font-mono font-semibold text-kiaa-700">
                                  <span title={cc?`Includes COMPCARE +${fmt(ccAddon)}`:''}>
                                    {fmt(adjTotal)}{cc&&<span className="text-xs text-kiaa-400 ml-1">w/CC</span>}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right">
                                  {isPhca ? (
                                    <div className="text-right">
                                      <div className="font-mono font-semibold text-surface-700">{fmt(phca?.contrib)}</div>
                                      {phca?.capped&&<div className="text-xs text-amber-600">⚠ Capped 50%</div>}
                                      {!phca?.capped&&phca?.pct15>0&&<div className="text-xs text-surface-400">1.5% wages</div>}
                                    </div>
                                  ) : (
                                    <div className="relative inline-flex items-center justify-end">
                                      <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                                      <input type="number" min="0" step="0.01" max={adjTotal||9999}
                                        value={elections[plan.id]?.[eeKey]??''}
                                        onChange={e=>setContrib(plan.id,eeKey,e.target.value)}
                                        disabled={isLocked}
                                        className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono disabled:opacity-60"
                                        placeholder="0.00"/>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 text-right font-mono font-semibold text-kiaa-700">
                                  {adjTotal?fmt(displayEr):'—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {/* 7(b) section — hidden for Band 9 */}
            {!isBand9(company) && (
              <div className="flex items-center gap-3 py-1 mt-3 pt-3 border-t border-surface-100">
                <span className="text-xs font-bold bg-surface-700 text-white px-2.5 py-1 rounded">7(b)</span>
                <span className="text-xs text-surface-500 font-medium">Employer must pay one-half of dependent coverage cost</span>
              </div>
            )}
            {!isBand9(company) && PLANS_7B.map(plan => {
              const el    = elections[plan.id] || {}
              const r     = rates[plan.id] || {}
              const isOpen = openPlans[plan.id] ?? el.elected
              const eeSingle    = parseMoney(el.ee_single)
              const eeTwoParty  = parseMoney(el.ee_two_party)
              const eeFamily    = parseMoney(el.ee_family)
              const ccAddon     = compCareElected && isPlanCompCareEligible(plan.id) ? COMPCARE.tiers.single : 0
              const erSingle    = Math.max(0, (r.single    || 0) + ccAddon - eeSingle)
              const erTwoParty  = Math.max(0, (r.two_party || 0) + ccAddon - eeTwoParty)
              const erFamily    = Math.max(0, (r.family    || 0) + ccAddon - eeFamily)

              return (
                <div key={plan.id} className={`card p-0 overflow-hidden transition-all ${el.elected ? 'border-surface-500' : 'border-surface-100'}`}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${el.elected ? 'bg-surface-700' : 'bg-surface-50 hover:bg-surface-100'}`}
                    onClick={() => !isLocked && togglePlanOpen(plan.id)}
                  >
                    <input
                      type="checkbox"
                      checked={el.elected || false}
                      disabled={isLocked}
                      onChange={e => { e.stopPropagation(); toggleElected(plan.id) }}
                      className="w-4 h-4 cursor-pointer"
                      onClick={e => e.stopPropagation()}
                    />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${el.elected ? 'bg-kiaa-aqua text-kiaa-800' : 'bg-surface-200 text-surface-600'}`}>
                      {plan.type}
                    </span>
                    <span className={`font-display font-semibold text-sm ${el.elected ? 'text-white' : 'text-surface-700'}`}>
                      {plan.name}
                    </span>
                    {plan.note && (
                      <span className={`text-xs ${el.elected ? 'text-amber-300' : 'text-amber-600'}`}>⚠ 7(b)</span>
                    )}
                    {r.single ? (
                      <span className={`text-xs ml-auto mr-2 ${el.elected ? 'text-surface-300' : 'text-surface-400'}`}>
                        Single {fmt(r.single)} &nbsp;|&nbsp; 2-Party {fmt(r.two_party)} &nbsp;|&nbsp; Family {fmt(r.family)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500 ml-auto mr-2">No rates for Band {band}</span>
                    )}
                    {isOpen
                      ? <ChevronUp size={14} className={el.elected ? 'text-surface-300' : 'text-surface-400'}/>
                      : <ChevronDown size={14} className={el.elected ? 'text-surface-300' : 'text-surface-400'}/>
                    }
                  </div>
                  {isOpen && (
                    <div className="p-4 border-t border-surface-100">
                      {plan.note && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                          ⚠ {plan.note}
                        </div>
                      )}
                      {/* Contribution method selector */}
                      <div className="flex items-center gap-3 mb-4 p-3 bg-surface-50 rounded-xl border border-surface-100">
                        <span className="text-xs font-medium text-surface-500 uppercase tracking-wide flex-shrink-0">Contribution method:</span>
                        <div className="flex gap-2">
                          {[
                            { id: 'fixed', label: 'Fixed amount' },
                            { id: 'phca',  label: 'PHCA 1.5% method' },
                          ].map(({ id, label }) => (
                            <button key={id}
                              onClick={() => !isLocked && setContrib(plan.id, 'contrib_method', id)}
                              disabled={isLocked}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                (elections[plan.id]?.contrib_method || 'fixed') === id
                                  ? 'bg-kiaa-600 text-white border-kiaa-600'
                                  : 'bg-white text-surface-500 border-surface-200 hover:border-kiaa-400'
                              }`}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {(elections[plan.id]?.contrib_method || 'fixed') === 'phca' && (
                          <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-surface-500">Avg monthly gross wage:</span>
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                              <input
                                type="number" min="0" step="1"
                                value={elections[plan.id]?.gross_wage ?? ''}
                                onChange={e => setContrib(plan.id, 'gross_wage', e.target.value)}
                                disabled={isLocked}
                                className="input text-right pl-5 pr-2 py-1 text-sm w-32 font-mono"
                                placeholder="3000"
                              />
                            </div>
                            <span className="text-xs text-surface-400">/ month</span>
                          </div>
                        )}
                      </div>

                      {/* PHCA explanation */}
                      {(elections[plan.id]?.contrib_method || 'fixed') === 'phca' && (
                        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4 text-xs text-blue-800">
                          <span className="flex-shrink-0 mt-0.5">ℹ</span>
                          <div>
                            <strong>Hawaii PHCA § 393-15:</strong> Employee contribution = the lesser of
                            (1) 1.5% of monthly gross wages, or (2) 50% of the total premium.
                            Contributions are calculated automatically based on the gross wage entered above.
                          </div>
                        </div>
                      )}

                      <div className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-3">
                        Employee contribution amounts (what the employee pays per month)
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 w-32">Tier</th>
                            <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2">Total premium</th>
                            <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2">Employee pays</th>
                            <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2">Employer pays</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label:'Single',  total: r.single,    eeKey:'ee_single',    fixedEe: eeSingle,   fixedEr: erSingle },
                            { label:'2-Party', total: r.two_party, eeKey:'ee_two_party', fixedEe: eeTwoParty, fixedEr: erTwoParty },
                            { label:'Family',  total: r.family,    eeKey:'ee_family',    fixedEe: eeFamily,   fixedEr: erFamily },
                          ].map(({ label, total, eeKey, fixedEe, fixedEr }) => {
                            const isPhca = (elections[plan.id]?.contrib_method || 'fixed') === 'phca'
                            const phca   = isPhca ? calcPhcaContrib(elections[plan.id]?.gross_wage, total) : null
                            const displayEe = isPhca ? (phca?.contrib || 0) : fixedEe
                            const displayEr = total ? Math.max(0, parseMoney(total) - displayEe) : 0
                            return (
                              <tr key={label} className="border-t border-surface-50">
                                <td className="py-2 font-medium text-surface-700">{label}</td>
                                <td className="py-2 text-right text-surface-600 font-mono">
                                {(() => {
                                  const cc = compCareElected && isPlanCompCareEligible(plan.id)
                                  const displayTotal = cc && total ? parseMoney(total) + COMPCARE.tiers.single : total
                                  return (
                                    <span title={cc ? `Includes COMPCARE +${fmt(COMPCARE.tiers.single)}` : ''}>
                                      {fmt(displayTotal)}
                                      {cc && <span className="text-xs text-kiaa-500 ml-1">w/ CC</span>}
                                    </span>
                                  )
                                })()}
                              </td>
                                <td className="py-2 text-right">
                                  {isPhca ? (
                                    <div className="text-right">
                                      <div className="font-mono font-semibold text-surface-700">{fmt(phca?.contrib)}</div>
                                      {phca?.capped && (
                                        <div className="text-xs text-amber-600">
                                          ⚠ Capped at 50% ({fmt(phca?.cap)})
                                        </div>
                                      )}
                                      {!phca?.capped && phca?.pct15 > 0 && (
                                        <div className="text-xs text-surface-400">
                                          1.5% of wages
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="relative inline-flex items-center justify-end">
                                      <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                                      <input
                                        type="number" min="0" step="0.01" max={total || 9999}
                                        value={elections[plan.id]?.[eeKey] ?? ''}
                                        onChange={e => setContrib(plan.id, eeKey, e.target.value)}
                                        disabled={isLocked}
                                        className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono disabled:opacity-60"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 text-right font-mono font-semibold text-kiaa-700">
                                  {total ? fmt(displayEr) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Kaiser — not available for Band 9 */}
          {!isAca && !isBand9(company) && kaiserRates.length > 0 && (
            <div className="mt-6 pt-6 border-t-2 border-surface-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"/>
                <h3 className="font-display font-semibold text-surface-700">Kaiser Permanente Plans</h3>
                {companies.find(c=>c.id===selected)?.kaiser_schedule && (
                  <span className="badge badge-aqua font-mono text-xs font-bold">
                    Schedule {companies.find(c=>c.id===selected)?.kaiser_schedule}
                  </span>
                )}
                <span className="badge badge-blue text-xs">HMO</span>
              </div>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-800 mb-4">
                <Info size={12} className="flex-shrink-0 mt-0.5"/>
                Kaiser plans use composite rates specific to this company. COMPCARE does not apply to Kaiser plans.
                Full Package plans include HMSA Dental, Vision, and Group Life/AD&amp;D (Riders flat rate).
                ACA plans provide Medical &amp; Prescription Drug benefits. Pediatric Dental &amp; Vision included for dependents ≤18 (ACA-required).
                The KIAA Riders Package is a separate standalone benefit.
              </div>

              {groupKaiserRates(kaiserRates).map(group => {
                const key       = `${group.kaiser_plan_no}_${group.package_type}`
                const election  = kaiserElections[key] || {}
                const isElected = election.elected || false
                const isOpen    = openKaiserPlans[key] ?? isElected
                const method    = election.contrib_method || 'fixed'
                const grossWage = election.gross_wage || ''
                const isFull    = group.package_type === 'full'
                const pkgLabel  = isFull ? 'Full Package' : 'Med/Rx Package'

                const tiers = [
                  { label: 'Single',  total: group.premium_single,    eeKey: 'ee_single' },
                  { label: '2-Party', total: group.premium_two_party, eeKey: 'ee_two_party' },
                  { label: 'Family',  total: group.premium_family,    eeKey: 'ee_family' },
                ]

                return (
                  <div key={key} className={`card p-0 overflow-hidden mb-3 transition-all ${isElected ? 'border-kiaa-400' : 'border-surface-100'}`}>
                    {/* Header */}
                    <div
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isElected ? 'bg-kiaa-600' : 'bg-surface-50 hover:bg-surface-100'}`}
                      onClick={() => !isLocked && toggleKaiserPlanOpen(key)}
                    >
                      <input type="checkbox" checked={isElected} disabled={isLocked}
                        onChange={e => { e.stopPropagation(); toggleKaiserElected(key) }}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 accent-kiaa-400 cursor-pointer"
                      />
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${isElected ? 'bg-amber-300 text-amber-900' : 'bg-amber-100 text-amber-700'}`}>HMO</span>
                      <span className={`font-display font-semibold text-sm flex-1 ${isElected ? 'text-white' : 'text-surface-700'}`}>
                        Kaiser Permanente {group.kaiser_plan_no} — {pkgLabel}
                      </span>
                      <span className={`text-xs hidden sm:block ${isElected ? 'text-white/60' : 'text-surface-400'}`}>
                        {fmt(group.premium_single)} / {fmt(group.premium_two_party)} / {fmt(group.premium_family)}
                      </span>
                      {isOpen
                        ? <ChevronUp size={14} className={isElected ? 'text-white/60' : 'text-surface-400'}/>
                        : <ChevronDown size={14} className={isElected ? 'text-white/60' : 'text-surface-400'}/>}
                    </div>

                    {/* Expanded body */}
                    {isOpen && (
                      <div className="p-4 border-t border-surface-100">
                        {isFull && (
                          <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-lg px-3 py-2 mb-4 text-xs text-kiaa-800">
                            <Info size={12} className="flex-shrink-0 mt-0.5 text-kiaa-600"/>
                            Full Package — includes Kaiser Medical &amp; Drug plus HMSA Dental, Vision, and Group Life/AD&amp;D (Riders flat rate already included in total premium).
                          </div>
                        )}

                        {/* Contribution method */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-surface-50 rounded-xl border border-surface-100 flex-wrap">
                          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide flex-shrink-0">Contribution method:</span>
                          <div className="flex gap-2">
                            {[{id:'fixed',label:'Fixed amount'},{id:'phca',label:'PHCA 1.5%'}].map(({id,label}) => (
                              <button key={id}
                                onClick={() => !isLocked && setKaiserContrib(key, 'contrib_method', id)}
                                disabled={isLocked}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${method===id ? 'bg-kiaa-600 text-white border-kiaa-600' : 'bg-white text-surface-500 border-surface-200 hover:border-kiaa-400'}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                          {method === 'phca' && (
                            <div className="flex items-center gap-2 ml-auto flex-wrap">
                              <span className="text-xs text-surface-500">Avg monthly gross wage:</span>
                              <div className="relative inline-flex items-center">
                                <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                                <input type="number" min="0" step="1"
                                  value={grossWage}
                                  onChange={e => setKaiserContrib(key, 'gross_wage', e.target.value)}
                                  disabled={isLocked}
                                  className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono"
                                  placeholder="3000"
                                />
                              </div>
                              <span className="text-xs text-surface-400">/month</span>
                            </div>
                          )}
                        </div>

                        {/* Premium breakdown table */}
                        <div className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">Monthly premium breakdown</div>
                        <div className="overflow-x-auto mb-4">
                        <table className="w-full text-sm min-w-max">
                          <thead>
                            <tr className="bg-surface-50">
                              <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2 w-24">Tier</th>
                              <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Medical &amp; Drug</th>
                              {isFull && <>
                                <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Vision</th>
                                <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Dental</th>
                                <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Life/AD&amp;D</th>
                              </>}
                              <th className="text-right text-xs font-semibold text-kiaa-600 uppercase tracking-wider pb-2 pt-2 px-2">Total</th>
                              <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Emp. pays</th>
                              <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Er. pays</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tiers.map(({ label, total, eeKey }) => {
                              // Riders breakdown (flat rates per tier)
                              const RIDERS = { Single: { vision: 7.32, dental: 33.56, life: 4.36 }, '2-Party': { vision: 14.62, dental: 73.42, life: 4.36 }, Family: { vision: 21.92, dental: 110.08, life: 4.36 } }
                              const riders = RIDERS[label] || {}
                              const medical = isFull
                                ? parseMoney(group[`medical_${label === 'Single' ? 'single' : label === '2-Party' ? 'two_party' : 'family'}`])
                                : parseMoney(total)
                              const phcaResult = calcPhcaContrib(grossWage, total)
                              const ee = method === 'phca'
                                ? phcaResult.contrib
                                : parseMoney(election[eeKey])
                              const er = Math.max(0, (parseMoney(total)||0) - ee)
                              return (
                                <tr key={label} className="border-t border-surface-50">
                                  <td className="py-2 px-2 font-medium text-surface-700">{label}</td>
                                  <td className="py-2 px-2 text-right font-mono text-surface-600">{fmt(medical)}</td>
                                  {isFull && <>
                                    <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{fmt(riders.vision)}</td>
                                    <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{fmt(riders.dental)}</td>
                                    <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{fmt(riders.life)}</td>
                                  </>}
                                  <td className="py-2 px-2 text-right font-mono font-semibold text-kiaa-700">{fmt(total)}</td>
                                  <td className="py-2 px-2 text-right">
                                    {method === 'phca' ? (
                                      <div className="text-right">
                                        <div className="font-mono font-semibold text-surface-700">{fmt(ee)}</div>
                                        {phcaResult?.capped && <div className="text-xs text-amber-600">⚠ Capped 50%</div>}
                                      </div>
                                    ) : (
                                      <div className="relative inline-flex items-center justify-end">
                                        <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                                        <input type="number" min="0" step="0.01" max={total}
                                          value={election[eeKey] ?? ''}
                                          onChange={e => setKaiserContrib(key, eeKey, e.target.value)}
                                          disabled={isLocked}
                                          className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono disabled:opacity-60"
                                          placeholder="0.00"
                                        />
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-semibold text-kiaa-700">{fmt(er)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        </div>
                        {isFull && (
                          <div className="text-xs text-surface-400 italic mb-2">
                            Vision, Dental, and Life/AD&D are HMSA Riders flat rates — same for all companies.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* COMPCARE — not available for Band 9 or ACA */}
          {!isAca && !isBand9(company) && (
          <div className="mt-3 pt-3 border-t border-surface-100">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold bg-kiaa-600 text-kiaa-aqua px-2.5 py-1 rounded">ADD-ON</span>
              <span className="text-xs text-surface-500 font-medium">COMPCARE — A-la-carte benefit (company election required)</span>
            </div>
            <div className={`card p-0 overflow-hidden ${compCareElected ? 'border-kiaa-400' : 'border-surface-100'}`}>
              <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${compCareElected ? 'bg-kiaa-600' : 'bg-surface-50'}`}>
                <input type="checkbox"
                  checked={compCareElected}
                  disabled={isLocked}
                  onChange={e => setCompCareElected(e.target.checked)}
                  className="w-4 h-4 accent-kiaa-400 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`font-display font-semibold text-sm ${compCareElected ? 'text-white' : 'text-surface-700'}`}>
                    {COMPCARE.name}
                  </span>
                  <div className={`text-xs mt-0.5 ${compCareElected ? 'text-kiaa-200' : 'text-surface-400'}`}>
                    Acupuncture, Massage, Active &amp; Fit &nbsp;·&nbsp; All tiers: +{fmt(COMPCARE.tiers.single)}/mo per employee
                  </div>
                </div>
                {compCareElected && (
                  <span className="text-xs bg-kiaa-aqua text-kiaa-800 px-2 py-0.5 rounded font-semibold">Elected</span>
                )}
              </div>
            </div>
          </div>
          )}

          {/* KIAA Riders Package — not for ACA (included in Full Package) */}
          {!isAca && RIDERS_PLAN && (
            <div className="mt-3 pt-3 border-t border-surface-100">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold bg-surface-600 text-white px-2.5 py-1 rounded">RIDERS</span>
                <span className="text-xs text-surface-500 font-medium">KIAA Riders Package — available to all companies</span>
              </div>
              <div className={`card p-0 overflow-hidden ${elections['kiaa_riders']?.elected ? 'border-surface-500' : 'border-surface-100'}`}>
                <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${elections['kiaa_riders']?.elected ? 'bg-surface-700' : 'bg-surface-50 hover:bg-surface-100'}`}
                  onClick={() => !isLocked && togglePlanOpen('kiaa_riders')}>
                  <input type="checkbox"
                    checked={elections['kiaa_riders']?.elected || false}
                    disabled={isLocked}
                    onChange={e => { e.stopPropagation(); toggleElected('kiaa_riders') }}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 accent-kiaa-400 cursor-pointer"
                  />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${elections['kiaa_riders']?.elected ? 'bg-kiaa-aqua text-kiaa-800' : 'bg-surface-200 text-surface-600'}`}>PPO</span>
                  <span className={`font-display font-semibold text-sm flex-1 ${elections['kiaa_riders']?.elected ? 'text-white' : 'text-surface-700'}`}>
                    {RIDERS_PLAN.name}
                  </span>
                  <span className={`text-xs mr-2 ${elections['kiaa_riders']?.elected ? 'text-surface-300' : 'text-surface-400'}`}>
                    Single {fmt(rates['kiaa_riders']?.premium_single || rates['kiaa_riders']?.single || RIDERS_PLAN.flatRates.single)} &nbsp;|&nbsp;
                    2-Party {fmt(rates['kiaa_riders']?.premium_two_party || rates['kiaa_riders']?.two_party || RIDERS_PLAN.flatRates.two_party)} &nbsp;|&nbsp;
                    Family {fmt(rates['kiaa_riders']?.premium_family || rates['kiaa_riders']?.family || RIDERS_PLAN.flatRates.family)}
                  </span>
                  {openPlans['kiaa_riders']
                    ? <ChevronUp size={14} className={elections['kiaa_riders']?.elected ? 'text-surface-300' : 'text-surface-400'}/>
                    : <ChevronDown size={14} className={elections['kiaa_riders']?.elected ? 'text-surface-300' : 'text-surface-400'}/>}
                </div>
                {openPlans['kiaa_riders'] && (
                  <div className="p-4 border-t border-surface-100">
                    <div className="text-xs text-surface-500 mb-3 bg-kiaa-50 border border-kiaa-200 rounded-lg px-3 py-2">
                      {RIDERS_PLAN.note}
                    </div>
                    <div className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">
                      Monthly premium breakdown &amp; employee contributions
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                      <thead>
                        <tr className="bg-surface-50">
                          <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2 w-20">Tier</th>
                          <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Vision</th>
                          <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Dental</th>
                          <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Life/AD&amp;D</th>
                          <th className="text-right text-xs font-semibold text-kiaa-600 uppercase tracking-wider pb-2 pt-2 px-2">Total</th>
                          <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Emp. pays</th>
                          <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2 pt-2 px-2">Er. pays</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label:'Single',  total: rates['kiaa_riders']?.premium_single    || rates['kiaa_riders']?.single    || RIDERS_PLAN.flatRates.single,    eeKey:'ee_single',    vision: rates['kiaa_riders']?.vision_single    || 7.32,   dental: rates['kiaa_riders']?.dental_single    || 33.56,  life: rates['kiaa_riders']?.life_single    || 4.36 },
                          { label:'2-Party', total: rates['kiaa_riders']?.premium_two_party || rates['kiaa_riders']?.two_party || RIDERS_PLAN.flatRates.two_party, eeKey:'ee_two_party', vision: rates['kiaa_riders']?.vision_two_party || 14.62,  dental: rates['kiaa_riders']?.dental_two_party || 73.42,  life: rates['kiaa_riders']?.life_two_party || 4.36 },
                          { label:'Family',  total: rates['kiaa_riders']?.premium_family    || rates['kiaa_riders']?.family    || RIDERS_PLAN.flatRates.family,    eeKey:'ee_family',    vision: rates['kiaa_riders']?.vision_family    || 21.92,  dental: rates['kiaa_riders']?.dental_family    || 110.08, life: rates['kiaa_riders']?.life_family    || 4.36 },
                        ].map(({ label, total, eeKey, vision, dental, life }) => {
                          const ee = parseMoney(elections['kiaa_riders']?.[eeKey])
                          const er = Math.max(0, parseMoney(total) - ee)
                          return (
                            <tr key={label} className="border-t border-surface-50">
                              <td className="py-2 px-2 font-medium text-surface-700">{label}</td>
                              <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{fmt(vision)}</td>
                              <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{fmt(dental)}</td>
                              <td className="py-2 px-2 text-right font-mono text-surface-500 text-xs">{fmt(life)}</td>
                              <td className="py-2 px-2 text-right font-mono font-semibold text-kiaa-700">{fmt(total)}</td>
                              <td className="py-2 px-2 text-right">
                                <div className="relative inline-flex items-center justify-end">
                                  <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                                  <input type="number" min="0" step="0.01" max={total}
                                    value={elections['kiaa_riders']?.[eeKey] ?? ''}
                                    onChange={e => setContrib('kiaa_riders', eeKey, e.target.value)}
                                    disabled={isLocked}
                                    className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono disabled:opacity-60"
                                    placeholder="0.00"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-semibold text-kiaa-700">{fmt(er)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!isLocked && (
              <>
                <button className="btn" onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? <><Loader size={14} className="animate-spin"/>Saving…</> : <><Save size={14}/>Save draft</>}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSave(true)}
                  disabled={saving || electedCount === 0}
                >
                  <CheckCircle size={14}/>
                  Submit election ({electedCount} plan{electedCount !== 1 ? 's' : ''} selected)
                </button>
              </>
            )}
            {isAdmin && oeStatus === 'submitted' && (
              <button className="btn btn-teal" onClick={handleConfirm}>
                <Lock size={14}/> Confirm &amp; lock election
              </button>
            )}
            {saved && <span className="text-sm text-kiaa-500 flex items-center gap-1.5"><CheckCircle size={13}/> Saved</span>}

            {electedCount > 0 && (
              <button className="btn ml-auto" onClick={() => {
                const html = generateCompanyRateSheet({
                  company:        { ...companies.find(c=>c.id===selected), band },
                  plans:          PLANS,
                  elections,
                  rates,
                  COMPCARE,
                  kaiserRates,
                  kaiserElections,
                  oePlanYear,
                  generatedDate:  new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'Pacific/Honolulu'})
                })
                const w = window.open('','_blank')
                w.document.write(html)
                w.document.close()
              }}>
                <Printer size={14}/> Print rate sheet
              </button>
            )}
            {electedCount === 0 && !isLocked && (
              <span className="text-xs text-amber-600">Select at least one plan to submit.</span>
            )}
          </div>

          <p className="text-xs text-surface-400 mt-3">
            Submitting updates Plans Enrolled on the company profile. Plans can be changed until the election is confirmed by KIAA.
          </p>
        </>
      )}
    </div>
  )
}
