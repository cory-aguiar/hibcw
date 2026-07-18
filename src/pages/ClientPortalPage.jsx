import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { getCompliance } from '@/lib/compliance'
import { PLANS, PLANS_7A, PLANS_7B, PLAN_MAP, RIDERS_PLAN, COMPCARE, isPlanCompCareEligible, groupKaiserRates, isBand9, ACA_PLAN_BENEFITS } from '@/lib/plans'
import KaiserRateTable from '@/components/KaiserRateTable'
import EnrollmentPacket from '@/components/EnrollmentPacket'
import AcaPremiumCalculator from '@/components/AcaPremiumCalculator'
import { generateCompanyRateSheet } from '@/lib/rateSheetGenerator'
import {
  ShieldCheck, FileText, BookOpen, LogOut, ExternalLink,
  ClipboardCheck, ChevronDown, ChevronUp, CheckCircle,
  Save, Loader, AlertCircle, Lock, Info, Printer, Calculator,
  User, X, Upload, Plus, Trash2, FileDown, LayoutDashboard, Search
} from 'lucide-react'

import { usePlanYear, planYearLabel, planYearLong, acaPlanYearLong, acaPlanStartOf } from '@/lib/PlanYearContext'
import HRHandbookMRG from '@/pages/HRHandbookMRG'
import HRHandbookACA from '@/pages/HRHandbookACA'
import MembershipCardsSection from '@/components/MembershipCardsSection'
import { getSPDCobraText, getSPDFmlaText, getSPDErisaText } from '@/lib/compliance'
import { generateSPDHtml } from '@/lib/spdHtmlGenerator'
import {
  generateCobraInitialNoticeHtml,
  generateCobraElectionNoticeHtml,
  QUALIFYING_EVENTS,
} from '@/lib/cobraHtmlGenerator'
import {
  generateFmlaGeneralNoticeHtml,
  generateFmlaEligibilityNoticeHtml,
  generateFmlaDesignationNoticeHtml,
  generateFmlaMedCertRequestHtml,
  LEAVE_REASONS,
  INELIGIBLE_REASONS,
} from '@/lib/fmlaHtmlGenerator'

function fmt(v) {
  if (!v && v !== 0) return '—'
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parseMoney(v) {
  return Math.max(0, parseFloat(String(v).replace(/[$,]/g,'')) || 0)
}
function calcPhcaContrib(monthlyGrossWage, totalPremium) {
  if (!monthlyGrossWage || !totalPremium) return { contrib: 0, cap: 0, capped: false, pct15: 0 }
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
    submitted: { cls: 'badge-amber', label: 'Submitted — awaiting KIAA confirmation' },
    confirmed: { cls: 'badge-green', label: 'Confirmed' },
  }
  const { cls, label } = map[status] || map.pending
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Plan election card ────────────────────────────────────────
function PlanElectionCard({ plan, election, rate, isLocked, onChange, compCareElected }) {
  const [open, setOpen] = useState(election?.elected ?? false)

  const el          = election || {}
  const r           = rate    || {}
  const isElected   = el.elected ?? false
  const method      = el.contrib_method || 'fixed'
  const grossWage   = el.gross_wage || ''

  const eeSingle    = method === 'phca'
    ? calcPhcaContrib(grossWage, r.single).contrib
    : parseMoney(el.ee_single)
  const eeTwoParty  = method === 'phca'
    ? calcPhcaContrib(grossWage, r.two_party).contrib
    : parseMoney(el.ee_two_party)
  const eeFamily    = method === 'phca'
    ? calcPhcaContrib(grossWage, r.family).contrib
    : parseMoney(el.ee_family)

  const ccAddon    = compCareElected && isPlanCompCareEligible(plan.id) ? COMPCARE.tiers.single : 0
  const erSingle   = Math.max(0, (r.single    || 0) + ccAddon - eeSingle)
  const erTwoParty = Math.max(0, (r.two_party || 0) + ccAddon - eeTwoParty)
  const erFamily   = Math.max(0, (r.family    || 0) + ccAddon - eeFamily)

  function set(key, val) { onChange(plan.id, { ...el, [key]: val }) }

  const headerBg = isElected
    ? (plan.hmsa_class === '7b' ? 'bg-surface-700' : 'bg-kiaa-600')
    : 'bg-surface-50 hover:bg-surface-100'

  return (
    <div className={`card p-0 overflow-hidden transition-all ${isElected ? (plan.hmsa_class === '7b' ? 'border-surface-500' : 'border-kiaa-400') : 'border-surface-100'}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${headerBg}`}
        onClick={() => !isLocked && setOpen(o => !o)}>
        <input type="checkbox" checked={isElected} disabled={isLocked}
          onChange={e => { e.stopPropagation(); set('elected', e.target.checked); setOpen(e.target.checked) }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 cursor-pointer accent-kiaa-400"
        />
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
          plan.type === 'HMO'
            ? (isElected ? 'bg-amber-300 text-amber-900' : 'bg-amber-100 text-amber-700')
            : (isElected ? 'bg-kiaa-aqua text-kiaa-800' : 'bg-surface-200 text-surface-600')
        }`}>{plan.type}</span>
        <span className={`font-display font-semibold text-sm flex-1 ${isElected ? 'text-white' : 'text-surface-700'}`}>
          {plan.name}
        </span>
        {r.single ? (
          <span className={`text-xs hidden sm:block ${isElected ? 'text-white/60' : 'text-surface-400'}`}>
            {fmt(r.single)} / {fmt(r.two_party)} / {fmt(r.family)}
          </span>
        ) : (
          <span className="text-xs text-amber-500">Rates pending</span>
        )}
        {open
          ? <ChevronUp size={14} className={isElected ? 'text-white/60' : 'text-surface-400'}/>
          : <ChevronDown size={14} className={isElected ? 'text-white/60' : 'text-surface-400'}/>}
      </div>

      {/* Expanded */}
      {open && (
        <div className="p-4 border-t border-surface-100">
          {/* 7(b) note */}
          {plan.note && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-800">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5 text-amber-600"/>
              {plan.note}
            </div>
          )}

          {/* Referral note for HMOs */}
          {plan.referralRequired && (
            <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-lg px-3 py-2 mb-4 text-xs text-kiaa-800">
              <Info size={12} className="flex-shrink-0 mt-0.5 text-kiaa-600"/>
              HMO plan — employees must obtain a referral from their primary care physician before seeing a specialist.
            </div>
          )}

          {/* Contribution method */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-surface-50 rounded-xl border border-surface-100 flex-wrap">
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wide flex-shrink-0">
              Contribution method:
            </span>
            <div className="flex gap-2">
              {[
                { id: 'fixed', label: 'Fixed amount' },
                { id: 'phca',  label: 'PHCA 1.5%' },
              ].map(({ id, label }) => (
                <button key={id}
                  onClick={() => !isLocked && set('contrib_method', id)}
                  disabled={isLocked}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    method === id
                      ? 'bg-kiaa-600 text-white border-kiaa-600'
                      : 'bg-white text-surface-500 border-surface-200 hover:border-kiaa-400'
                  }`}>
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
                    onChange={e => set('gross_wage', e.target.value)}
                    disabled={isLocked}
                    className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono"
                    placeholder="3000"
                  />
                </div>
                <span className="text-xs text-surface-400">/month</span>
              </div>
            )}
          </div>

          {/* PHCA explanation */}
          {method === 'phca' && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4 text-xs text-blue-800">
              <Info size={12} className="flex-shrink-0 mt-0.5"/>
              <div>
                <strong>Hawaii PHCA § 393-15:</strong> Employee contribution = the lesser of
                (1) 1.5% of monthly gross wages, or (2) 50% of the total premium.
              </div>
            </div>
          )}

          {/* Premium table */}
          <div className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">
            Monthly premiums &amp; employee contributions
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2">Tier</th>
                <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2">Total</th>
                <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2">Employee</th>
                <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wider pb-2">Employer</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Single',  total: r.single,    eeKey: 'ee_single',    ee: eeSingle,   er: erSingle,   phcaResult: calcPhcaContrib(grossWage, r.single) },
                { label: '2-Party', total: r.two_party, eeKey: 'ee_two_party', ee: eeTwoParty, er: erTwoParty, phcaResult: calcPhcaContrib(grossWage, r.two_party) },
                { label: 'Family',  total: r.family,    eeKey: 'ee_family',    ee: eeFamily,   er: erFamily,   phcaResult: calcPhcaContrib(grossWage, r.family) },
              ].map(({ label, total, eeKey, ee, er, phcaResult }) => (
                <tr key={label} className="border-t border-surface-50">
                  <td className="py-2 font-medium text-surface-700">{label}</td>
                  <td className="py-2 text-right text-surface-600 font-mono">
                    {(() => {
                      const cc = compCareElected && isPlanCompCareEligible(plan.id)
                      const display = cc && total ? parseMoney(total) + COMPCARE.tiers.single : total
                      return (
                        <span title={cc ? 'Includes COMPCARE' : ''}>
                          {fmt(display)}{cc && <span className="text-xs text-kiaa-500 ml-1">w/ CC</span>}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="py-2 text-right">
                    {method === 'phca' ? (
                      <div className="text-right">
                        <div className="font-mono font-semibold text-surface-700">{fmt(phcaResult.contrib)}</div>
                        {phcaResult.capped && <div className="text-xs text-amber-600">⚠ Capped at 50%</div>}
                        {!phcaResult.capped && phcaResult.pct15 > 0 && <div className="text-xs text-surface-400">1.5% of wages</div>}
                      </div>
                    ) : (
                      <div className="relative inline-flex items-center justify-end">
                        <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                        <input type="number" min="0" step="0.01" max={total || 9999}
                          value={el[eeKey] ?? ''}
                          onChange={e => set(eeKey, e.target.value)}
                          disabled={isLocked}
                          className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono disabled:opacity-60"
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-kiaa-700">
                    {total ? fmt(er) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main portal page ──────────────────────────────────────────
export default function ClientPortalPage() {
  const { oePlanYear, oePlanStart, oePlanEnd, activePlanYear } = usePlanYear()
  const PLAN_YEAR = oePlanYear
  const { profile, signOut } = useAuth()
  const [company,   setCompany]   = useState(null)
  const [forms,     setForms]     = useState([])
  const [tasks,     setTasks]     = useState([])
  const [rates,     setRates]     = useState({})
  const [elections, setElections] = useState({})
  const [fte, setFte] = useState({
    ft_employees: '', pt_employees: '', pt_avg_hrs: '',
    seasonal_employees: '', seasonal_avg_hrs: '',
    enrolled_employees: '', plan_participants: ''
  })
  const [planDocs,     setPlanDocs]     = useState({})
  const [fteOpen,      setFteOpen]      = useState(true)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [oeStep,       setOeStep]       = useState(1)
  const [acaStep,      setAcaStep]      = useState(1)
  const [oeStatus,  setOeStatus]  = useState('pending')
  const [band,      setBand]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [compCareElected, setCompCareElected] = useState(false)
  const [kaiserRates,    setKaiserRates]    = useState([])
  const [kaiserElections,setKaiserElections]= useState({})
  const [openKaiserPlans,setOpenKaiserPlans]= useState({})
  const [saved,     setSaved]     = useState(false)
  // Avatar menu + profile
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [showProfile,    setShowProfile]    = useState(false)
  const [profileForm,    setProfileForm]    = useState({ first_name:'', last_name:'', phone:'', job_title:'' })
  const [profileSaving,  setProfileSaving]  = useState(false)
  const [profileSaved,   setProfileSaved]   = useState(false)
  const [profileError,   setProfileError]   = useState('')
  const [showPwChange,   setShowPwChange]   = useState(false)
  const [pwForm,         setPwForm]         = useState({ password:'', confirm:'' })
  const [pwSaving,       setPwSaving]       = useState(false)
  const [pwSaved,        setPwSaved]        = useState(false)
  const [pwError,        setPwError]        = useState('')
  const [companyForm,    setCompanyForm]    = useState({
    contact_name:'', contact_email:'', contact_phone:'',
    benefits_contact_name:'', benefits_contact_email:'', benefits_contact_phone:'',
    address_line1:'', city:'', state:'HI', zip:''
  })
  const [companySaving,  setCompanySaving]  = useState(false)
  const [companySaved,   setCompanySaved]   = useState(false)
  const [companyError,   setCompanyError]   = useState('')
  const [logoUploading,  setLogoUploading]  = useState(false)
  const [saveError, setSaveError] = useState('')
  const [activeSection, setActiveSection] = useState('dashboard')
  const [formsSearch, setFormsSearch] = useState('')
  const [docLog, setDocLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kiaa_doc_log') || '[]') } catch { return [] }
  })

  function logDoc(type, detail) {
    const entry = { type, detail, ts: new Date().toLocaleString('en-US', { timeZone:'Pacific/Honolulu', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) }
    const updated = [entry, ...docLog].slice(0, 50)
    setDocLog(updated)
    try { localStorage.setItem('kiaa_doc_log', JSON.stringify(updated)) } catch {}
  }

  // COBRA notice state
  const [cobraNoticeType, setCobraNoticeType] = useState('election')
  const [cobraParticipant, setCobraParticipant] = useState({ name:'', address:'', city:'', state:'HI', zip:'', dob:'' })
  const [cobraDependents, setCobraDependents] = useState([])
  const [cobraQEvent, setCobraQEvent] = useState('termination')
  const [cobraEventDate, setCobraEventDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone:'Pacific/Honolulu' }))
  const [cobraCovLost, setCobraCovLost] = useState('')
  const [cobraNoticeDate, setCobraNoticeDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone:'Pacific/Honolulu' }))

  // FMLA notice state
  const [fmlaNoticeType, setFmlaNoticeType] = useState('general')
  const [fmlaEmployee, setFmlaEmployee] = useState({ name:'', address:'', city:'', state:'HI', zip:'', start_date:'', end_date:'', leave_reason:'serious_health_condition_employee', intermittent:false })
  const [fmlaEligible, setFmlaEligible] = useState(true)
  const [fmlaIneligibleReasons, setFmlaIneligibleReasons] = useState([])
  const [fmlaDesignated, setFmlaDesignated] = useState(true)

  // SPD state
  const [spdSections, setSpdSections] = useState({ eligibility:true, glance:true, plans:true, cobra:true, fmla:true, erisa:true, hipaa:true, claims:true })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!profile?.company_id) { setLoading(false); return }
    loadAll()
  }, [profile])

  async function loadAll() {
    const [{ data: co }, { data: fm }, { data: dlLinks }, { data: tks }, { data: pdocs }] = await Promise.all([
      supabase.from('companies').select('*').eq('id', profile.company_id).single(),
      supabase.from('forms').select('*').eq('is_active', true).order('name'),
      supabase.from('document_links').select('*').order('created_at'),
      supabase.from('tasks').select('*').eq('company_id', profile.company_id).neq('status','dismissed').order('due_date'),
      supabase.from('plan_documents').select('*').order('uploaded_at', { ascending: false }),
    ])
    setCompany(co)
    setForms([...(fm||[]), ...(dlLinks||[]).map(l => ({ id:`link-${l.id}`, name:l.label, description:l.description, url:l.url }))])
    setTasks(tks || [])
    setOeStatus(co?.oe_status || 'pending')
    setBand(co?.band || null)
    setCompCareElected(co?.compcare_elected || false)
    setOeStep(1)
    setAcaStep(1)
    // Index plan docs by plan_id for quick lookup
    const docsMap = {}
    ;(pdocs || []).forEach(d => {
      if (d.plan_id && d.doc_type === 'sbc')             docsMap[`sbc__${d.plan_id}`]     = d
      if (d.plan_id && d.doc_type === 'benefit_summary') docsMap[`gtb__${d.plan_id}`]     = d
    })
    setPlanDocs(docsMap)
    setFte({
      ft_employees:       co?.ft_employees       != null ? String(co.ft_employees)       : '',
      pt_employees:       co?.pt_employees       != null ? String(co.pt_employees)       : '',
      pt_avg_hrs:         co?.pt_avg_hrs         != null ? String(co.pt_avg_hrs)         : '',
      seasonal_employees: co?.seasonal_employees != null ? String(co.seasonal_employees) : '',
      seasonal_avg_hrs:   co?.seasonal_avg_hrs   != null ? String(co.seasonal_avg_hrs)   : '',
      enrolled_employees: co?.enrolled_employees != null ? String(co.enrolled_employees) : '',
      plan_participants:  co?.plan_participants  != null ? String(co.plan_participants)  : '',
    })

    if (co?.band) {
      // Load rates for this band
      const { data: rateRows } = await supabase
        .from('rate_bands').select('*')
        .eq('plan_year', PLAN_YEAR).eq('band', co.band)
      const r = {}
      ;(rateRows || []).forEach(row => {
        r[row.plan_id] = { single: row.premium_single, two_party: row.premium_two_party, family: row.premium_family }
      })
      // Load riders flat rate
      const { data: ridersRow } = await supabase
        .from('rate_bands').select('*')
        .eq('plan_year', PLAN_YEAR).eq('plan_id', 'kiaa_riders').eq('band', 0).single()
      if (ridersRow) {
        r['kiaa_riders'] = {
          single: ridersRow.premium_single, two_party: ridersRow.premium_two_party, family: ridersRow.premium_family,
          premium_single: ridersRow.premium_single, premium_two_party: ridersRow.premium_two_party, premium_family: ridersRow.premium_family,
          vision_single: ridersRow.vision_single || 7.32, vision_two_party: ridersRow.vision_two_party || 14.62, vision_family: ridersRow.vision_family || 21.92,
          dental_single: ridersRow.dental_single || 33.56, dental_two_party: ridersRow.dental_two_party || 73.42, dental_family: ridersRow.dental_family || 110.08,
          life_single: ridersRow.life_single || 4.36, life_two_party: ridersRow.life_two_party || 4.36, life_family: ridersRow.life_family || 4.36,
        }
      } else if (RIDERS_PLAN?.flatRates) {
        r['kiaa_riders'] = {
          single: RIDERS_PLAN.flatRates.single, two_party: RIDERS_PLAN.flatRates.two_party, family: RIDERS_PLAN.flatRates.family,
          premium_single: RIDERS_PLAN.flatRates.single, premium_two_party: RIDERS_PLAN.flatRates.two_party, premium_family: RIDERS_PLAN.flatRates.family,
          vision_single: 7.32, vision_two_party: 14.62, vision_family: 21.92,
          dental_single: 33.56, dental_two_party: 73.42, dental_family: 110.08,
          life_single: 4.36, life_two_party: 4.36, life_family: 4.36,
        }
      }
      setRates(r)
    }

    // Load elections — for both MRG and ACA companies
    {
      const { data: elRows } = await supabase
        .from('company_elections').select('*')
        .eq('company_id', profile.company_id).eq('plan_year', PLAN_YEAR)
      const e = {}
      // MRG plans
      PLANS.forEach(p => {
        const ex = elRows?.find(r => r.plan_id === p.id)
        e[p.id] = {
          elected:        ex?.elected        ?? false,
          ee_single:      ex?.ee_single      ?? '',
          ee_two_party:   ex?.ee_two_party   ?? '',
          ee_family:      ex?.ee_family      ?? '',
          contrib_method: ex?.contrib_method ?? 'fixed',
          gross_wage:     ex?.gross_wage     ?? '',
        }
      })
      // ACA plans + riders + compcare
      ;['aca_cm_a','aca_hph_plus','aca_ppp','kiaa_riders','compcare'].forEach(planId => {
        if (!e[planId]) {
          const ex = elRows?.find(r => r.plan_id === planId)
          e[planId] = { elected: ex?.elected ?? false }
        }
      })
      setElections(e)
    }

    // Load Kaiser rates + elections if eligible
    if (co?.kaiser_eligible) {
      const { data: kr } = await supabase
        .from('kaiser_rates').select('*')
        .eq('company_id', profile.company_id).eq('plan_year', PLAN_YEAR)
        .order('kaiser_plan_no').order('package_type')
      setKaiserRates(kr || [])

      const { data: keRows } = await supabase
        .from('company_elections').select('*')
        .eq('company_id', profile.company_id).eq('plan_year', PLAN_YEAR)
        .eq('carrier', 'kaiser')
      const ke = {}
      ;(keRows || []).forEach(row => {
        const key = `${row.kaiser_plan_no}_${row.kaiser_package_type}`
        ke[key] = {
          elected:        row.elected        ?? false,
          ee_single:      row.ee_single      ?? '',
          ee_two_party:   row.ee_two_party   ?? '',
          ee_family:      row.ee_family      ?? '',
          contrib_method: row.contrib_method ?? 'fixed',
          gross_wage:     row.gross_wage     ?? '',
        }
      })
      setKaiserElections(ke)
    }

    setLoading(false)

    // Init profile form
    if (profile) {
      setProfileForm({
        first_name: profile.first_name || '',
        last_name:  profile.last_name  || '',
        phone:      profile.phone      || '',
        job_title:  profile.job_title  || '',
      })
    }

    // Init company form
    if (co) {
      setCompanyForm({
        contact_name:            co.contact_name            || '',
        contact_email:           co.contact_email           || '',
        contact_phone:           co.contact_phone           || '',
        benefits_contact_name:   co.benefits_contact_name   || '',
        benefits_contact_email:  co.benefits_contact_email  || '',
        benefits_contact_phone:  co.benefits_contact_phone  || '',
        address_line1:           co.address_line1           || '',
        city:                    co.city                    || '',
        state:                   co.state                   || 'HI',
        zip:                     co.zip                     || '',
      })
    }
  }

  async function saveProfile() {
    setProfileSaving(true)
    setProfileError('')
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: profileForm.first_name.trim(),
        last_name:  profileForm.last_name.trim(),
        phone:      profileForm.phone.trim() || null,
        job_title:  profileForm.job_title.trim() || null,
      })
      .eq('id', profile.id)
    setProfileSaving(false)
    if (error) { setProfileError(error.message); return }
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 3000)
  }

  async function saveCompany() {
    setCompanySaving(true)
    setCompanyError('')
    const { error } = await supabase
      .from('companies')
      .update({
        contact_name:           companyForm.contact_name.trim()           || null,
        contact_email:          companyForm.contact_email.trim()          || null,
        contact_phone:          companyForm.contact_phone.trim()          || null,
        benefits_contact_name:  companyForm.benefits_contact_name.trim()  || null,
        benefits_contact_email: companyForm.benefits_contact_email.trim() || null,
        benefits_contact_phone: companyForm.benefits_contact_phone.trim() || null,
        address_line1:          companyForm.address_line1.trim()          || null,
        city:                   companyForm.city.trim()                   || null,
        state:                  companyForm.state.trim()                  || 'HI',
        zip:                    companyForm.zip.trim()                    || null,
      })
      .eq('id', company.id)
    setCompanySaving(false)
    if (error) { setCompanyError(error.message); return }
    setCompany(c => ({ ...c, ...companyForm }))
    setCompanySaved(true)
    setTimeout(() => setCompanySaved(false), 3000)
  }

  async function uploadLogo(file) {
    if (!file || !company) return
    setLogoUploading(true)
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `logos/${company.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: true })
    if (upErr) { setCompanyError('Logo upload failed: ' + upErr.message); setLogoUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('companies').update({ logo_url: publicUrl }).eq('id', company.id)
    if (dbErr) { setCompanyError('Logo save failed: ' + dbErr.message); setLogoUploading(false); return }
    setCompany(c => ({ ...c, logo_url: publicUrl }))
    setLogoUploading(false)
  }

  async function changePassword() {
    setPwError('')
    if (pwForm.password.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (pwForm.password !== pwForm.confirm) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.password })
    setPwSaving(false)
    if (error) { setPwError(error.message); return }
    setPwSaved(true)
    setPwForm({ password:'', confirm:'' })
    setTimeout(() => { setPwSaved(false); setShowPwChange(false) }, 3000)
  }

  function updateElection(planId, val) {
    setElections(e => ({ ...e, [planId]: val }))
    setSaved(false)
  }

  async function handleSave(submit = false) {
    if (submit && !fte.ft_employees) {
      setSaveError('Please enter your full-time employee count before submitting.')
      return
    }
    setSaving(true)
    setSaveError('')
    const { data: { user } } = await supabase.auth.getUser()
    const isAca = company?.group_type === 'aca_small_group'

    // Build rows for all plan IDs — MRG or ACA
    const planIds = isAca
      ? ['aca_cm_a', 'aca_hph_plus', 'aca_ppp', 'kiaa_riders', 'compcare']
      : PLANS.map(p => p.id)

    const rows = planIds.map(planId => {
      const el = elections[planId] || {}
      const r  = rates[planId] || {}
      let eeSingle    = parseMoney(el.ee_single)
      let eeTwoParty  = parseMoney(el.ee_two_party)
      let eeFamily    = parseMoney(el.ee_family)
      if (el.contrib_method === 'phca' && el.gross_wage) {
        eeSingle    = calcPhcaContrib(el.gross_wage, r.single).contrib
        eeTwoParty  = calcPhcaContrib(el.gross_wage, r.two_party).contrib
        eeFamily    = calcPhcaContrib(el.gross_wage, r.family).contrib
      }
      return {
        company_id:     profile.company_id,
        plan_year:      PLAN_YEAR,
        plan_id:        planId,
        elected:        el.elected ?? false,
        ee_single:      eeSingle,
        ee_two_party:   eeTwoParty,
        ee_family:      eeFamily,
        contrib_method: el.contrib_method || 'fixed',
        gross_wage:     el.gross_wage ? parseMoney(el.gross_wage) : null,
        submitted_at:   submit ? new Date().toISOString() : null,
        submitted_by:   submit ? user.id : null,
      }
    })

    const { error: elErr } = await supabase
      .from('company_elections')
      .upsert(rows, { onConflict: 'company_id,plan_year,plan_id' })

    if (elErr) { setSaving(false); setSaveError(elErr.message); return }

    // Calculate FTE using IRS/DOL method
    const ftCount  = parseInt(fte.ft_employees)  || 0
    const ptCount  = parseInt(fte.pt_employees)  || 0
    const ptHrs    = parseFloat(fte.pt_avg_hrs)  || 0
    const seCount  = parseInt(fte.seasonal_employees) || 0
    const seHrs    = parseFloat(fte.seasonal_avg_hrs) || 0
    const ptFte    = ptCount  > 0 ? Math.round((ptCount  * ptHrs * 4.33) / 120 * 10) / 10 : 0
    const seFte    = seCount  > 0 ? Math.round((seCount  * seHrs * 4.33) / 120 * 10) / 10 : 0
    const calcFte  = Math.round((ftCount + ptFte + seFte) * 10) / 10
    const headcount = ftCount + ptCount + seCount

    // Update company record
    const electedPlanIds = isAca
      ? ['aca_cm_a','aca_hph_plus','aca_ppp','kiaa_riders','compcare'].filter(id => elections[id]?.elected)
      : PLANS.filter(p => elections[p.id]?.elected).map(p => p.id)
    const newStatus = submit ? 'submitted' : oeStatus
    await supabase.from('companies')
      .update({
        plans:              isAca ? [] : electedPlanIds,
        oe_status:          newStatus,
        compcare_elected:   isAca ? (elections['compcare']?.elected || false) : compCareElected,
        employee_count:     ftCount || null,
        ft_employees:       ftCount || null,
        pt_employees:       ptCount || null,
        pt_avg_hrs:         ptHrs   || null,
        seasonal_employees: seCount || null,
        seasonal_avg_hrs:   seHrs   || null,
        fte_count:          calcFte || null,
        headcount:          headcount || null,
        enrolled_employees: fte.enrolled_employees ? parseInt(fte.enrolled_employees) : null,
        plan_participants:  fte.plan_participants ? parseInt(fte.plan_participants) : (fte.enrolled_employees ? parseInt(fte.enrolled_employees) : null),
      })
      .eq('id', profile.company_id)

    if (submit) setOeStatus('submitted')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-kiaa-600"><Loader size={18} className="animate-spin mr-2"/>Loading…</div>

  const comp     = company ? getCompliance(company) : null
  const planList    = (company?.plans || []).map(pid => PLAN_MAP[pid]).filter(Boolean)
  const isLocked    = oeStatus === 'confirmed'
  const isAca       = company?.group_type === 'aca_small_group'
  const acaElectedCount = ['aca_cm_a','aca_hph_plus','aca_ppp'].filter(id => elections[id]?.elected).length
  const electedCount = isAca
    ? acaElectedCount
    : Object.values(elections).filter(e => e.elected).length

  const NAV = [
    { id: 'enrollment', label: 'Open Enrollment', icon: ClipboardCheck, badge: oeStatus !== 'confirmed' && oeStatus !== 'submitted' ? '!' : null },
    { id: 'plans',      label: 'My plans',         icon: FileText },
    { id: 'compliance', label: 'Compliance',        icon: ShieldCheck },
    { id: 'cobra',      label: 'COBRA Notices',     icon: FileText },
    { id: 'fmla',       label: 'FMLA Notices',      icon: FileText },
    { id: 'spd',        label: 'SPD Builder',        icon: BookOpen },
    { id: 'tasks',      label: 'Tasks',             icon: ClipboardCheck, badge: tasks.filter(t=>t.status==='pending').length || null },
    { id: 'forms',      label: 'Forms & resources', icon: BookOpen },
    { id: 'handbook',   label: 'Handbook',          icon: BookOpen },
    ...(company?.group_type === 'aca_small_group' ? [{ id: 'aca', label: 'My Rates', icon: FileText }] : []),
    ...(company?.group_type !== 'aca_small_group' && band ? [{ id: 'rates', label: 'My Rates', icon: FileText }] : []),
  ]

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor:'#EDF2F6', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='600' viewBox='0 0 900 600'%3E%3Cpath d='M0 300 C150 200 300 400 450 300 C600 200 750 400 900 300 L900 600 L0 600 Z' fill='%23385262' fill-opacity='0.04'/%3E%3Cpath d='M0 350 C120 260 280 450 450 350 C620 250 780 440 900 350 L900 600 L0 600 Z' fill='%236595B2' fill-opacity='0.035'/%3E%3Cpath d='M0 420 C180 330 320 500 500 410 C660 330 780 480 900 400 L900 600 L0 600 Z' fill='%23385262' fill-opacity='0.03'/%3E%3Cpath d='M0 80 C200 160 350 0 550 100 C700 180 800 60 900 120 L900 0 L0 0 Z' fill='%236595B2' fill-opacity='0.03'/%3E%3Cpath d='M0 40 C150 120 300 -20 500 60 C680 140 820 20 900 80 L900 0 L0 0 Z' fill='%23385262' fill-opacity='0.025'/%3E%3C/svg%3E")`, backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat' }}>
      {/* Top bar */}
      <header className="text-white px-6 py-4 flex items-center justify-between sticky top-0 z-20 bg-gradient-to-r from-kiaa-700 to-kiaa-800">
        <div className="flex items-center gap-3">
          <img src="/logowhite.png" alt="KIAA" className="w-8 h-8 object-contain" style={{filter:'brightness(0) invert(1)'}}/>
          <div>
            <div className="text-sm font-semibold text-white leading-tight" style={{ letterSpacing: '0.01em' }}>KIAA Connect</div>
            <div className="text-xs uppercase" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', fontSize: '9px' }}>{company?.name || 'Client Portal'}</div>
          </div>
        </div>

        {/* Avatar menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 group"
            onClick={() => setShowAvatarMenu(m => !m)}>
            <div className="w-8 h-8 rounded-full bg-kiaa-500 flex items-center justify-center text-white font-bold text-sm group-hover:bg-kiaa-400 transition-colors">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-white leading-tight">
                {profile?.first_name} {profile?.last_name}
              </div>
              {profile?.job_title && (
                <div className="text-xs text-kiaa-300 leading-tight">{profile.job_title}</div>
              )}
            </div>
            <ChevronDown size={14} className="text-kiaa-300"/>
          </button>

          {showAvatarMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowAvatarMenu(false)}/>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-modal border border-surface-100 py-1 z-20">
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-surface-700 hover:bg-kiaa-50 transition-colors"
                  onClick={() => { setShowAvatarMenu(false); setShowProfile(true) }}>
                  <User size={14} className="text-surface-400"/> My profile
                </button>
                <div className="border-t border-surface-100 my-1"/>
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={signOut}>
                  <LogOut size={14}/> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Profile slide-over */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowProfile(false)}/>
          <div className="relative ml-auto w-full max-w-md bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 bg-gradient-to-r from-kiaa-700 to-kiaa-800">
              <div>
                <div className="font-display font-semibold text-white">My Profile</div>
                <div className="text-kiaa-300 text-xs mt-0.5">{company?.name}</div>
              </div>
              <button onClick={() => setShowProfile(false)} className="text-kiaa-300 hover:text-white">
                <X size={18}/>
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {/* Avatar initial */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-kiaa-100 flex items-center justify-center text-kiaa-700 font-bold text-xl">
                  {profileForm.first_name?.[0]}{profileForm.last_name?.[0]}
                </div>
                <div>
                  <div className="font-semibold text-surface-700">{profileForm.first_name} {profileForm.last_name}</div>
                  <div className="text-xs text-surface-400">{profile?.email}</div>
                  {profileForm.job_title && <div className="text-xs text-surface-500 mt-0.5">{profileForm.job_title}</div>}
                </div>
              </div>

              {/* Profile form */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First name</label>
                  <input className="input" value={profileForm.first_name}
                    onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">Last name</label>
                  <input className="input" value={profileForm.last_name}
                    onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}/>
                </div>
              </div>

              <div>
                <label className="label">Work email</label>
                <input className="input bg-surface-50 text-surface-400 cursor-not-allowed"
                  value={profile?.email || ''} disabled/>
                <p className="text-xs text-surface-400 mt-1">Contact KIAA to change your email address.</p>
              </div>

              <div>
                <label className="label">Phone</label>
                <input className="input" value={profileForm.phone}
                  placeholder="(808) 555-0100"
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}/>
              </div>

              <div>
                <label className="label">Job title</label>
                <input className="input" value={profileForm.job_title}
                  placeholder="e.g. HR Manager, Payroll Coordinator"
                  onChange={e => setProfileForm(f => ({ ...f, job_title: e.target.value }))}/>
              </div>

              {profileError && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                  <AlertCircle size={14}/>{profileError}
                </div>
              )}

              <button className="btn btn-primary w-full justify-center" onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? <><Loader size={14} className="animate-spin"/>Saving…</> :
                 profileSaved  ? <><CheckCircle size={14}/>Saved!</> :
                 <><Save size={14}/>Save changes</>}
              </button>

              {/* Password change */}
              <div className="border-t border-surface-100 pt-4">
                <button
                  className="text-sm text-kiaa-600 hover:text-kiaa-800 font-medium flex items-center gap-1"
                  onClick={() => setShowPwChange(o => !o)}>
                  {showPwChange ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  Change password
                </button>

                {showPwChange && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="label">New password</label>
                      <input type="password" className="input" value={pwForm.password}
                        placeholder="Minimum 8 characters"
                        onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))}/>
                    </div>
                    <div>
                      <label className="label">Confirm new password</label>
                      <input type="password" className="input" value={pwForm.confirm}
                        onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}/>
                    </div>
                    {pwError && (
                      <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                        <AlertCircle size={14}/>{pwError}
                      </div>
                    )}
                    {pwSaved && (
                      <div className="flex items-center gap-2 bg-kiaa-50 text-kiaa-700 text-sm px-3 py-2.5 rounded-lg">
                        <CheckCircle size={14}/>Password updated successfully.
                      </div>
                    )}
                    <button className="btn btn-primary w-full justify-center" onClick={changePassword} disabled={pwSaving}>
                      {pwSaving ? <><Loader size={14} className="animate-spin"/>Updating…</> : 'Update password'}
                    </button>
                  </div>
                )}
              </div>

              {/* Company info — editable */}
              <div className="border-t border-surface-100 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Company information</div>
                    <div className="text-xs text-surface-400 mt-0.5">Update your company's contact details and address</div>
                  </div>
                </div>

                {/* Read-only fields */}
                <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-surface-50 rounded-xl text-xs">
                  <div><span className="text-surface-400">Company</span><div className="font-medium text-surface-700 mt-0.5">{company?.name}</div></div>
                  <div><span className="text-surface-400">Code</span><div className="font-mono font-bold text-kiaa-700 mt-0.5">{company?.company_code}</div></div>
                  <div><span className="text-surface-400">Group type</span><div className="font-medium text-surface-700 mt-0.5">{company?.group_type === 'aca_small_group' ? 'ACA Small Group' : 'Merit Rated'}</div></div>
                  {company?.hmsa_group_no && <div><span className="text-surface-400">HMSA #</span><div className="font-medium text-surface-700 mt-0.5">{company.hmsa_group_no}</div></div>}
                </div>

                {/* Logo upload */}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-surface-500 mb-2">Company logo <span className="font-normal text-surface-400">(shown on employee portal)</span></div>
                  <div className="flex items-center gap-4">
                    {company?.logo_url ? (
                      <img src={company.logo_url} alt="Logo" className="h-14 w-28 object-contain rounded-lg border border-surface-100 bg-surface-50 p-1"/>
                    ) : (
                      <div className="h-14 w-28 rounded-lg border-2 border-dashed border-surface-200 bg-surface-50 flex items-center justify-center text-xs text-surface-400">
                        No logo
                      </div>
                    )}
                    <label className={`btn btn-sm cursor-pointer ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      {logoUploading
                        ? <><Loader size={13} className="animate-spin"/> Uploading…</>
                        : <><Upload size={13}/> {company?.logo_url ? 'Replace' : 'Upload logo'}</>
                      }
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => uploadLogo(e.target.files[0])} disabled={logoUploading}/>
                    </label>
                  </div>
                  <p className="text-xs text-surface-400 mt-1.5">PNG or JPG · Recommended 400×120px or wider</p>
                </div>

                <div className="space-y-4">
                  {/* Primary contact */}
                  <div>
                    <div className="text-xs font-semibold text-surface-500 mb-2">Primary HR contact</div>
                    <div className="space-y-2">
                      <div>
                        <label className="label">Contact name</label>
                        <input className="input" value={companyForm.contact_name}
                          placeholder="Full name"
                          onChange={e => setCompanyForm(f => ({ ...f, contact_name: e.target.value }))}/>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label">Email</label>
                          <input className="input" type="email" value={companyForm.contact_email}
                            placeholder="hr@company.com"
                            onChange={e => setCompanyForm(f => ({ ...f, contact_email: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">Phone</label>
                          <input className="input" value={companyForm.contact_phone}
                            placeholder="(808) 555-0100"
                            onChange={e => setCompanyForm(f => ({ ...f, contact_phone: e.target.value }))}/>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Benefits contact */}
                  <div>
                    <div className="text-xs font-semibold text-surface-500 mb-1">Benefits contact <span className="font-normal text-surface-400">(shown to employees in portal — if different from primary)</span></div>
                    <div className="space-y-2">
                      <div>
                        <label className="label">Contact name</label>
                        <input className="input" value={companyForm.benefits_contact_name}
                          placeholder="Full name"
                          onChange={e => setCompanyForm(f => ({ ...f, benefits_contact_name: e.target.value }))}/>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label">Email</label>
                          <input className="input" type="email" value={companyForm.benefits_contact_email}
                            placeholder="benefits@company.com"
                            onChange={e => setCompanyForm(f => ({ ...f, benefits_contact_email: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">Phone</label>
                          <input className="input" value={companyForm.benefits_contact_phone}
                            placeholder="(808) 555-0100"
                            onChange={e => setCompanyForm(f => ({ ...f, benefits_contact_phone: e.target.value }))}/>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <div className="text-xs font-semibold text-surface-500 mb-2">Business address</div>
                    <div className="space-y-2">
                      <div>
                        <label className="label">Street address</label>
                        <input className="input" value={companyForm.address_line1}
                          placeholder="123 Main St"
                          onChange={e => setCompanyForm(f => ({ ...f, address_line1: e.target.value }))}/>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="label">City</label>
                          <input className="input" value={companyForm.city}
                            placeholder="Hilo"
                            onChange={e => setCompanyForm(f => ({ ...f, city: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">State</label>
                          <input className="input" value={companyForm.state}
                            onChange={e => setCompanyForm(f => ({ ...f, state: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">ZIP</label>
                          <input className="input" value={companyForm.zip}
                            placeholder="96720"
                            onChange={e => setCompanyForm(f => ({ ...f, zip: e.target.value }))}/>
                        </div>
                      </div>
                    </div>
                  </div>

                  {companyError && (
                    <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                      <AlertCircle size={14}/>{companyError}
                    </div>
                  )}

                  <button className="btn btn-primary w-full justify-center" onClick={saveCompany} disabled={companySaving}>
                    {companySaving ? <><Loader size={14} className="animate-spin"/>Saving…</> :
                     companySaved  ? <><CheckCircle size={14}/>Saved!</> :
                     <><Save size={14}/>Save company info</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Company header — hero photo banner */}
        {company && (
          <div className="mb-5 rounded-2xl overflow-hidden shadow-card" style={{
            position: 'relative',
            minHeight: 260,
            backgroundImage: `url("https://lplzkmosawrrcvgljwuk.supabase.co/storage/v1/object/public/documents/portal-hero.jpg")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(56,82,98,0.1) 0%, rgba(38,57,68,0.55) 100%)',
              borderRadius: 'inherit',
            }} />
            <div style={{ position: 'relative', zIndex: 1, padding: '24px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 260 }}>
              <div>
                {company.logo_url && (
                  <img src={company.logo_url} alt={company.name}
                    style={{ height: 32, maxWidth: 120, objectFit: 'contain', marginBottom: 10, filter: 'brightness(0) invert(1)', display: 'block' }} />
                )}
                <h1 className="font-display text-2xl text-white mb-1" style={{ fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                  {company.name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                    Plan year: {isAca ? acaPlanYearLong(acaPlanStartOf(company)) : planYearLong(activePlanYear)}
                  </span>
                  {band && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: 4, backdropFilter: 'blur(4px)' }}>
                      BAND {band}
                    </span>
                  )}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                background: company.status === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.15)',
                color: company.status === 'active' ? '#6EE7B7' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${company.status === 'active' ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.2)'}`,
                padding: '4px 10px', borderRadius: 6, backdropFilter: 'blur(4px)',
              }}>
                {company.status}
              </span>
            </div>
          </div>
        )}

        {!company ? (
          <div className="card text-center py-10">
            <p className="text-surface-500">Your account is not yet linked to a company. Contact your KIAA administrator.</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-5 items-start">

            {/* ── Mobile nav — horizontal scroll on small screens ── */}
            <div className="md:hidden w-full overflow-x-auto pb-1">
              <div className="flex gap-1 min-w-max">
                {[
                  { id:'dashboard',  label:'Home',        icon:LayoutDashboard },
                  { id:'plans',      label:'My Plans',    icon:FileText },
                  ...(company?.group_type !== 'aca_small_group' && band ? [{ id:'rates', label:'My Rates', icon:FileText }] : []),
                  ...(company?.group_type === 'aca_small_group' ? [{ id:'aca', label:'My Rates', icon:FileText }] : []),
                  { id:'enrollment', label:'Enrollment',  icon:ClipboardCheck },
                  { id:'compliance', label:'Compliance',  icon:ShieldCheck },
                  { id:'cobra',      label:'COBRA',       icon:FileText },
                  { id:'fmla',       label:'FMLA',        icon:FileText },
                  { id:'spd',        label:'SPD',         icon:BookOpen },
                  { id:'tasks',      label:'Tasks',       icon:ClipboardCheck, badge: tasks.filter(t=>t.status==='pending').length || null },
                  { id:'forms',      label:'Forms',       icon:BookOpen },
                  { id:'handbook',   label:'Handbook',    icon:BookOpen },
                ].map(({ id, label, icon: Icon, badge }) => (
                  <button key={id} onClick={() => setActiveSection(id)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all relative flex-shrink-0 ${
                      activeSection === id ? 'bg-kiaa-600 text-white' : 'bg-white text-surface-500 border border-surface-200'
                    }`}>
                    <Icon size={14}/>
                    <span>{label}</span>
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{badge}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Desktop sidebar nav + profile ── */}
            <div className="hidden md:flex flex-col w-48 flex-shrink-0 sticky top-4" style={{ gap: 0 }}>
              <nav className="space-y-4 flex-1">
              {[
                {
                  group: 'Overview',
                  items: [
                    { id: 'dashboard', label: 'Dashboard',       icon: LayoutDashboard },
                  ]
                },
                {
                  group: 'Plans & Benefits',
                  items: [
                    { id: 'plans',      label: 'My Plans',        icon: FileText },
                    ...(company?.group_type !== 'aca_small_group' && band ? [{ id: 'rates', label: 'My Rates', icon: FileText }] : []),
                    ...(company?.group_type === 'aca_small_group' ? [{ id: 'aca', label: 'My Rates', icon: FileText }] : []),
                  ]
                },
                {
                  group: 'Enrollment',
                  items: [
                    { id: 'enrollment', label: 'Open Enrollment', icon: ClipboardCheck, badge: oeStatus !== 'confirmed' && oeStatus !== 'submitted' ? '!' : null },
                  ]
                },
                {
                  group: 'Compliance',
                  items: [
                    { id: 'compliance', label: 'Compliance',      icon: ShieldCheck },
                    { id: 'cobra',      label: 'COBRA Notices',   icon: FileText },
                    { id: 'fmla',       label: 'FMLA Notices',    icon: FileText },
                    { id: 'spd',        label: 'SPD Builder',     icon: BookOpen },
                  ]
                },
                {
                  group: 'Resources',
                  items: [
                    { id: 'tasks',    label: 'Tasks',              icon: ClipboardCheck, badge: tasks.filter(t=>t.status==='pending').length || null },
                    { id: 'forms',    label: 'Forms & Resources',  icon: BookOpen },
                    { id: 'handbook', label: 'Handbook',           icon: BookOpen },
                  ]
                },
              ].map(({ group, items }) => (
                <div key={group}>
                  <div className="text-xs font-bold uppercase text-surface-300 px-2 mb-1" style={{ letterSpacing: '0.12em', fontSize: '9px' }}>{group}</div>
                  <div className="space-y-0.5">
                    {items.map(({ id, label, icon: Icon, badge }) => (
                      <button key={id} onClick={() => setActiveSection(id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all relative text-left ${
                          activeSection === id
                            ? 'bg-kiaa-600 text-white'
                            : 'text-surface-500 hover:bg-white hover:text-surface-700'
                        }`}>
                        <Icon size={13} className="flex-shrink-0"/>
                        <span className="flex-1">{label}</span>
                        {badge && (
                          <span className="w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">
                            {badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

              {/* Profile link */}
              <div className="mt-3 pt-3 border-t border-surface-100">
                <button onClick={() => setShowProfile(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-surface-500 hover:bg-white hover:text-surface-700 text-left">
                  <User size={13} className="flex-shrink-0"/>
                  <span className="flex-1">My profile</span>
                </button>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-0">

            {/* ── DASHBOARD ── */}
            {activeSection === 'dashboard' && (
              <div className="space-y-4">

                {/* OE status alert */}
                {oeStatus === 'pending' && (
                  <div className="alert-warning">
                    <span className="text-lg">📋</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-amber-800">Open enrollment is open</div>
                      <div className="text-xs text-amber-700 mt-0.5">Submit your plan elections for the {isAca ? acaPlanYearLong(acaPlanStartOf(company)) : oePlanYear} plan year.</div>
                    </div>
                    <button className="btn btn-sm flex-shrink-0" style={{ background:'#D97706', color:'#fff', borderColor:'#D97706' }}
                      onClick={() => setActiveSection('enrollment')}>
                      Start enrollment →
                    </button>
                  </div>
                )}
                {oeStatus === 'submitted' && (
                  <div className="alert-info">
                    <span className="text-lg">⏳</span>
                    <div>
                      <div className="text-sm font-bold text-kiaa-800">Elections submitted — awaiting KIAA confirmation</div>
                      <div className="text-xs text-kiaa-600 mt-0.5">We'll notify you once your elections are confirmed.</div>
                    </div>
                  </div>
                )}
                {oeStatus === 'confirmed' && (
                  <div className="flex items-center gap-3 bg-kiaa-50 border border-kiaa-100 rounded-xl px-4 py-3">
                    <CheckCircle size={16} className="text-kiaa-500 flex-shrink-0"/>
                    <div className="text-sm font-medium text-kiaa-700">Plan elections confirmed for {isAca ? acaPlanYearLong(acaPlanStartOf(company)) : oePlanYear}</div>
                  </div>
                )}

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="card py-4 text-center">
                    <div className="font-display text-3xl text-kiaa-700">
                      {(company?.plans || []).length}
                    </div>
                    <div className="text-xs text-surface-400 uppercase font-bold mt-1" style={{ letterSpacing:'0.1em' }}>Elected Plans</div>
                  </div>
                  <div className="card py-4 text-center">
                    <div className={`font-display text-3xl ${tasks.filter(t=>t.status==='pending').length > 0 ? 'text-amber-600' : 'text-kiaa-700'}`}>
                      {tasks.filter(t=>t.status==='pending').length}
                    </div>
                    <div className="text-xs text-surface-400 uppercase font-bold mt-1" style={{ letterSpacing:'0.1em' }}>Pending Tasks</div>
                  </div>
                  <div className="card py-4 text-center">
                    <div className="font-display text-3xl text-kiaa-700">
                      {band ? `B${band}` : isAca ? 'ACA' : '—'}
                    </div>
                    <div className="text-xs text-surface-400 uppercase font-bold mt-1" style={{ letterSpacing:'0.1em' }}>{band ? 'HMSA Band' : 'Group Type'}</div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="card">
                  <h2 className="section-title mb-3">Quick actions</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label:'View my plans',        sub:'Enrolled plans & benefit details',  section:'plans',      icon:FileText },
                      { label:'My rates',              sub:'Monthly premiums & contributions',  section: isAca ? 'aca' : 'rates', icon:FileText, hide: !band && !isAca },
                      { label:'Compliance status',     sub:'COBRA, FMLA, ERISA obligations',   section:'compliance', icon:ShieldCheck },
                      { label:'COBRA notices',         sub:'Generate for qualifying events',    section:'cobra',      icon:FileText },
                      { label:'FMLA notices',          sub:'For employee leave requests',       section:'fmla',       icon:FileText },
                      { label:'Build my SPD',          sub:'Summary Plan Description',         section:'spd',        icon:BookOpen },
                      { label:'Forms & resources',     sub:'JotForms and HR links',            section:'forms',      icon:BookOpen },
                      { label:'Document history',       sub: docLog.length > 0 ? `${docLog.length} recently generated` : 'COBRA, FMLA, SPD log', section:'forms', icon:FileText },
                      { label:'HR handbook',           sub:'Benefits guide for your company',  section:'handbook',   icon:BookOpen },
                    ].filter(a => !a.hide).map(action => (
                      <button key={action.section + action.label} onClick={() => setActiveSection(action.section)}
                        className="flex items-start gap-3 p-3 rounded-xl border border-surface-100 bg-white hover:bg-kiaa-50 hover:border-kiaa-200 transition-all text-left">
                        <div className="w-8 h-8 rounded-lg bg-kiaa-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <action.icon size={14} className="text-kiaa-600"/>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-surface-700">{action.label}</div>
                          <div className="text-xs text-surface-400 mt-0.5">{action.sub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {tasks.filter(t=>t.status==='pending').length > 0 && (
                  <div className="card">
                    <h2 className="section-title mb-3">Pending tasks</h2>
                    <div className="space-y-1">
                      {tasks.filter(t=>t.status==='pending').map(t => (
                        <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-surface-100">
                          <div>
                            <div className="text-sm font-medium text-surface-700">{t.title}</div>
                            {t.description && <div className="text-xs text-surface-400">{t.description}</div>}
                          </div>
                          {t.due_date && <span className="text-xs text-surface-400 flex-shrink-0 ml-3">{new Date(t.due_date).toLocaleDateString()}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share employee portal link */}
                {(() => {
                  const portalUrl = `${window.location.origin}/plans?code=${company.company_code}`
                  return (
                    <div className="card">
                      <h2 className="section-title mb-1">Employee portal link</h2>
                      <p className="text-surface-400 text-sm mb-3">Share this link with your employees so they can view their plan options and coverage details.</p>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 input text-xs font-mono text-surface-500 bg-surface-50 cursor-text select-all truncate py-2">
                          {portalUrl}
                        </div>
                        <button className={`btn btn-sm flex-shrink-0 flex items-center gap-1.5 ${copied ? 'bg-kiaa-50 text-kiaa-600 border-kiaa-200' : 'btn-primary'}`}
                          onClick={() => {
                            navigator.clipboard.writeText(portalUrl).then(() => {
                              setCopied(true)
                              setTimeout(() => setCopied(false), 2500)
                            })
                          }}>
                          {copied ? <><CheckCircle size={12}/> Copied!</> : <><FileText size={12}/> Copy link</>}
                        </button>
                        <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                          className="btn btn-sm flex-shrink-0 flex items-center gap-1.5">
                          <ExternalLink size={12}/> Preview
                        </a>
                      </div>
                      <p className="text-xs text-surface-400 mt-2">
                        Employees can also visit <strong>{window.location.origin}/plans</strong> and enter code <strong className="font-mono text-kiaa-700">{company.company_code}</strong>
                      </p>
                    </div>
                  )
                })()}

                {/* Contact KIAA */}
                <div className="card">
                  <h2 className="section-title mb-3">Contact KIAA</h2>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label:'Phone', value:'(808) 961-5422',   sub:'Mon–Fri, business hours' },
                      { label:'Fax',   value:'(808) 935-9740',   sub:'Enrollment & PHI docs' },
                      { label:'Email', value:'admin@kiaahilo.org', sub:'1 business day response' },
                    ].map(c => (
                      <div key={c.label} className="bg-surface-50 rounded-xl p-3">
                        <div className="text-xs font-bold uppercase text-surface-400 mb-1" style={{ letterSpacing:'0.1em' }}>{c.label}</div>
                        <div className="text-sm font-semibold text-kiaa-700 break-all">{c.value}</div>
                        <div className="text-xs text-surface-400 mt-0.5">{c.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'enrollment' && (
              <div className="space-y-4">
                <div className="card">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-kiaa-700 text-lg">Open Enrollment {isAca ? acaPlanYearLong(acaPlanStartOf(company)) : oePlanYear}</h2>
                      <p className="text-surface-400 text-sm mt-0.5">
                        Select the plans you want to offer your employees and set employee contribution amounts.
                      </p>
                    </div>
                    <OEStatusBadge status={oeStatus}/>
                  </div>

                  {isLocked && (
                    <div className="flex items-center gap-2 bg-kiaa-50 border border-kiaa-100 text-kiaa-800 text-sm px-3 py-2.5 rounded-lg mt-4">
                      <Lock size={13}/> Your election has been confirmed by KIAA and is locked.
                    </div>
                  )}

                  {!band && company?.group_type !== 'aca_small_group' && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2.5 rounded-lg mt-4">
                      <AlertCircle size={13} className="text-amber-600"/>
                      Your HMSA band has not been assigned yet. Contact your KIAA administrator to continue.
                    </div>
                  )}

                  {band && Object.keys(rates).length === 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2.5 rounded-lg mt-4">
                      <AlertCircle size={13} className="text-amber-600"/>
                      Rates for your band have not been uploaded yet. Contact your KIAA administrator.
                    </div>
                  )}
                </div>

                {/* ── MRG LOCKED STATE ── */}
                {band && isLocked && (
                  <div className="card text-center py-6">
                    <CheckCircle size={36} className="text-kiaa-400 mx-auto mb-3"/>
                    <div className="font-semibold text-surface-700 mb-1">Election confirmed</div>
                    <p className="text-surface-400 text-sm">Your plan election has been confirmed by KIAA. View your enrolled plans in the My Plans tab.</p>
                  </div>
                )}

                {saved && (
                  <div className="flex items-center gap-2 bg-kiaa-50 text-kiaa-700 text-sm px-3 py-2.5 rounded-lg">
                    <CheckCircle size={14}/> Draft saved successfully.
                  </div>
                )}

                {/* ── ACA OPEN ENROLLMENT ── */}
                {company?.group_type === 'aca_small_group' && !isLocked && (() => {
                  const parseD    = s => { if (!s) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d) }
                  const todayHST  = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' })
                  const today     = parseD(todayHST)
                  const openDate  = parseD(company.oe_open_date)
                  const closeDate = parseD(company.oe_close_date)
                  const effDate   = parseD(company.plan_effective_date)
                  const fmt       = s => { if (!s) return '—'; const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) }
                  const oeNotStarted = openDate  && today < openDate
                  const oeClosed     = closeDate && today > closeDate
                  const oeOpen       = !oeNotStarted && !oeClosed

                  return (
                    <>
                      {/* OE window banner */}
                      {(openDate || closeDate || effDate) && (
                        <div className={`card border ${
                          oeNotStarted ? 'bg-surface-50 border-surface-200' :
                          oeClosed     ? 'bg-red-50 border-red-200' :
                                         'bg-kiaa-50 border-kiaa-200'
                        }`}>
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{oeNotStarted ? '⏳' : oeClosed ? '🔒' : '📋'}</span>
                            <div className="flex-1">
                              <div className={`font-semibold text-sm ${oeClosed ? 'text-red-700' : 'text-kiaa-700'}`}>
                                {oeNotStarted ? 'Open enrollment has not started yet' :
                                 oeClosed     ? 'Open enrollment is closed' :
                                                'Open enrollment is open'}
                              </div>
                              <div className="text-xs text-surface-500 mt-1 space-y-0.5">
                                {openDate  && <div>Opens: <strong>{fmt(openDate)}</strong></div>}
                                {closeDate && <div>Closes: <strong>{fmt(closeDate)}</strong></div>}
                                {effDate   && <div>New plan effective: <strong>{fmt(effDate)}</strong></div>}
                              </div>
                              {oeClosed && (
                                <div className="mt-2 text-xs text-red-600">
                                  The enrollment window has passed. Contact KIAA at (808) 961-5422 if you need to make changes.
                                </div>
                              )}
                              {oeNotStarted && (
                                <div className="mt-2 text-xs text-surface-500">
                                  You'll be able to submit your plan elections starting {fmt(openDate)}.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Plan selection — only when OE is open or no dates set */}
                      {(oeOpen || (!openDate && !closeDate)) && (
                      <>
                      {/* ACA stepped progress bar */}
                      {(() => {
                        const acaSteps = [
                          { num: 1, label: 'Employee count', done: !!(fte.ft_employees) },
                          { num: 2, label: 'Select plans',   done: electedCount > 0 },
                          { num: 3, label: 'Add-ons',        done: true },
                          { num: 4, label: 'Review & submit',done: false },
                        ]
                        return (
                          <div className="card p-0 overflow-hidden mb-3">
                            <div className="flex">
                              {acaSteps.map((s, i) => (
                                <button key={s.num}
                                  onClick={() => setAcaStep(s.num)}
                                  className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-all border-b-2 ${
                                    acaStep === s.num
                                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                                      : s.done
                                        ? 'border-kiaa-400 bg-white text-kiaa-700 hover:bg-kiaa-50'
                                        : 'border-transparent bg-white text-surface-400 hover:bg-surface-50'
                                  } ${i > 0 ? 'border-l border-surface-100' : ''}`}>
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    acaStep === s.num ? 'bg-violet-600 text-white' :
                                    s.done ? 'bg-kiaa-500 text-white' : 'bg-surface-200 text-surface-500'
                                  }`}>
                                    {s.done && acaStep !== s.num ? '✓' : s.num}
                                  </div>
                                  <span className="hidden sm:block">{s.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* ── ACA Step 1: Employee count ── */}
                      {acaStep === 1 && (() => {
                        const ftN  = parseInt(fte.ft_employees)      || 0
                        const ptN  = parseInt(fte.pt_employees)      || 0
                        const ptH  = parseFloat(fte.pt_avg_hrs)      || 0
                        const seN  = parseInt(fte.seasonal_employees) || 0
                        const seH  = parseFloat(fte.seasonal_avg_hrs) || 0
                        const ptFte = ptN > 0 ? Math.round((ptN * ptH * 4.33) / 120 * 10) / 10 : 0
                        const seFte = seN > 0 ? Math.round((seN * seH * 4.33) / 120 * 10) / 10 : 0
                        const totalFte = Math.round((ftN + ptFte + seFte) * 10) / 10
                        const headcount = ftN + ptN + seN
                        return (
                          <div className="card space-y-4">
                            <div>
                              <h3 className="font-display font-semibold text-kiaa-700 text-base mb-1">Step 1 — Employee count</h3>
                              <p className="text-sm text-surface-400">Open enrollment is the right time to update your headcount. These numbers determine your COBRA, FMLA, PHCA, and ERISA obligations.</p>
                            </div>
                            <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 text-xs text-violet-700">
                              <Info size={13} className="flex-shrink-0 mt-0.5"/>
                              FTE is calculated using the IRS/DOL method: FTE = full-time + (part-time monthly hrs ÷ 120). Monthly hours = weekly average × 4.33 weeks. ACA companies with fewer than 50 FTEs are not subject to the employer mandate.
                            </div>
                            <div>
                              <label className="label">Full-time employees (30+ hrs/week) <span className="text-red-400">*</span></label>
                              <input type="number" min="0" className="input"
                                placeholder="e.g. 8"
                                value={fte.ft_employees}
                                onChange={e => setFte(f => ({ ...f, ft_employees: e.target.value }))}/>
                              {!fte.ft_employees && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={11}/> Required before submitting</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label">Part-time employees (&lt;30 hrs/week)</label>
                                <input type="number" min="0" className="input" placeholder="e.g. 4"
                                  value={fte.pt_employees}
                                  onChange={e => setFte(f => ({ ...f, pt_employees: e.target.value }))}/>
                              </div>
                              <div>
                                <label className="label">Avg weekly hours each</label>
                                <input type="number" min="0" max="29" className="input" placeholder="e.g. 20"
                                  value={fte.pt_avg_hrs}
                                  onChange={e => setFte(f => ({ ...f, pt_avg_hrs: e.target.value }))}/>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label">Seasonal employees</label>
                                <input type="number" min="0" className="input" placeholder="e.g. 2"
                                  value={fte.seasonal_employees}
                                  onChange={e => setFte(f => ({ ...f, seasonal_employees: e.target.value }))}/>
                              </div>
                              <div>
                                <label className="label">Avg weekly hours each</label>
                                <input type="number" min="0" className="input" placeholder="e.g. 30"
                                  value={fte.seasonal_avg_hrs}
                                  onChange={e => setFte(f => ({ ...f, seasonal_avg_hrs: e.target.value }))}/>
                              </div>
                            </div>
                            <div>
                              <label className="label">Employees enrolled in the health plan <span className="text-surface-400 font-normal">(waived coverage excluded)</span></label>
                              <input type="number" min="0" className="input"
                                placeholder="e.g. 6"
                                value={fte.enrolled_employees}
                                onChange={e => setFte(f => ({ ...f, enrolled_employees: e.target.value }))}/>
                              <p className="text-xs text-surface-400 mt-1">Used for ERISA Form 5500 plan participant count. Dependents are not counted.</p>
                            </div>
                            {(ftN > 0 || ptN > 0 || seN > 0) && (() => {
                              const enrolledN    = parseInt(fte.enrolled_employees) || 0
                              const participantN = parseInt(fte.plan_participants)  || enrolledN || ftN
                              return (
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-100">
                                  <div className="bg-violet-50 rounded-xl p-3 text-center">
                                    <div className="text-xs text-surface-400 mb-0.5">Calculated FTE</div>
                                    <div className="text-xl font-bold text-violet-700">{totalFte}</div>
                                    <div className="text-xs text-surface-400">COBRA / PHCA</div>
                                  </div>
                                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                                    <div className="text-xs text-surface-400 mb-0.5">Headcount</div>
                                    <div className="text-xl font-bold text-surface-700">{headcount}</div>
                                    <div className="text-xs text-surface-400">all employees · FMLA</div>
                                  </div>
                                  <div className={`rounded-xl p-3 text-center ${participantN >= 100 ? 'bg-amber-50' : 'bg-surface-50'}`}>
                                    <div className="text-xs text-surface-400 mb-0.5">Plan participants</div>
                                    <div className={`text-xl font-bold ${participantN >= 100 ? 'text-amber-700' : 'text-surface-700'}`}>{participantN}</div>
                                    <div className={`text-xs ${participantN >= 100 ? 'text-amber-600' : 'text-surface-400'}`}>
                                      {participantN >= 100 ? '⚠ Form 5500 required' : 'Form 5500 · enrolled only'}
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                            <div className="flex justify-end pt-2">
                              <button className="btn btn-primary" onClick={() => setAcaStep(2)}>
                                Next — select plans <ChevronDown size={14} className="rotate-[-90deg]"/>
                              </button>
                            </div>
                          </div>
                        )
                      })()}

                      {/* ── ACA Step 2: Select plans ── */}
                      {acaStep === 2 && (
                        <div className="space-y-3">
                          <div className="card">
                            <h3 className="font-display font-semibold text-kiaa-700 text-base mb-1">Step 2 — Select health plans</h3>
                            <p className="text-sm text-surface-400">Choose the ACA plans you want to offer your employees. You may elect more than one. Age-based premiums are calculated by KIAA after submission.</p>
                          </div>
                          <div className="space-y-2">
                            {[
                              { id: 'aca_ppp',      name: 'ACA PPP',        type: 'PPO', desc: 'Preferred Provider — in & out of network, no referral required' },
                              { id: 'aca_cm_a',     name: 'ACA CompMED A',  type: 'PPO', desc: 'CompMED/PPO — in & out of network, no referral required' },
                              { id: 'aca_hph_plus', name: 'ACA HPH Plus',   type: 'HMO', desc: 'Health Plan Hawaii Plus — HMO, referral required' },
                            ].map(plan => {
                              const elected  = elections[plan.id]?.elected || false
                              const expanded = expandedPlan === plan.id
                              const p        = ACA_PLAN_BENEFITS[plan.id]
                              const sbc      = planDocs[`sbc__${plan.id}`]
                              return (
                                <div key={plan.id}
                                  className={`border rounded-xl overflow-hidden transition-all ${elected ? 'border-violet-400' : 'border-surface-100'}`}>
                                  <div
                                    className={`p-4 cursor-pointer ${elected ? 'bg-violet-50' : 'hover:bg-surface-50'}`}
                                    onClick={() => !isLocked && updateElection(plan.id, { ...elections[plan.id], elected: !elected })}>
                                    <div className="flex items-center gap-3">
                                      <input type="checkbox" checked={elected} readOnly
                                        className="w-4 h-4 accent-violet-600 cursor-pointer flex-shrink-0"/>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-sm text-surface-700">{plan.name}</span>
                                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${plan.type === 'HMO' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>{plan.type}</span>
                                        </div>
                                        <div className="text-xs text-surface-400 mt-0.5">{plan.desc}</div>
                                      </div>
                                      {elected && <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Selected</span>}
                                    </div>
                                  </div>
                                  <div className="border-t border-surface-100 px-4 py-2 flex items-center justify-between bg-white">
                                    <button
                                      className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                                      onClick={e => { e.stopPropagation(); setExpandedPlan(expanded ? null : plan.id) }}>
                                      {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                      {expanded ? 'Hide details' : 'View benefits at a glance'}
                                    </button>
                                    {sbc && (
                                      <a href={sbc.file_url} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                                        onClick={e => e.stopPropagation()}>
                                        📄 Download SBC
                                      </a>
                                    )}
                                  </div>
                                  {expanded && p && (
                                    <div className="border-t border-surface-100 divide-y divide-surface-50">
                                      {[
                                        { section: 'Cost sharing' },
                                        { label: 'Deductible (ind / fam)',   value: p.deductible,    free: (p.deductible||'').startsWith('$0') },
                                        { label: 'OOP max — medical',        value: p.oopMedical,    warn: true },
                                        { label: 'OOP max — Rx',             value: p.oopRx },
                                        { label: 'Referral required',        value: p.referralRequired ? 'Yes — HMO' : 'No', warn: p.referralRequired },
                                        { label: 'Out-of-network',           value: p.outOfNetwork,  warn: p.outOfNetwork?.includes('Not covered') },
                                        { section: 'Office visits' },
                                        { label: 'Primary care (PCP)',       value: p.pcp,           free: p.pcp === 'No charge' },
                                        { label: 'Specialist',               value: p.specialist },
                                        { label: 'Emergency room',           value: p.er },
                                        { label: 'Inpatient hospital',       value: p.hospital },
                                        { section: 'Prescription drugs' },
                                        { label: 'Generic (retail)',         value: p.rxGeneric,     free: p.rxGeneric?.startsWith('$0') },
                                        { label: 'Preferred brand (retail)', value: p.rxPreferred },
                                        { section: 'Pediatric benefits (ACA-required)' },
                                        { label: 'Pediatric dental',         value: 'Included — dependents age 18 and under', free: true },
                                        { label: 'Pediatric vision',         value: 'Included — dependents age 18 and under', free: true },
                                      ].map((row, i) => {
                                        if (row.section) return (
                                          <div key={i} className="px-4 py-1.5 bg-violet-700 text-white text-xs font-semibold uppercase tracking-wide">{row.section}</div>
                                        )
                                        return (
                                          <div key={i} className="flex items-center px-4 py-2 text-xs">
                                            <span className="text-surface-400 flex-1">{row.label}</span>
                                            <span className={`font-semibold ${row.free ? 'text-kiaa-600' : row.warn ? 'text-amber-700' : 'text-surface-700'}`}>
                                              {row.value || '—'}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <button className="btn flex items-center gap-2" onClick={() => setAcaStep(1)}>
                              <ChevronDown size={14} className="rotate-90"/> Back
                            </button>
                            <button className="btn btn-primary flex items-center gap-2" onClick={() => setAcaStep(3)}
                              disabled={electedCount === 0}>
                              Next — add-ons <ChevronDown size={14} className="rotate-[-90deg]"/>
                            </button>
                          </div>
                          {electedCount === 0 && <p className="text-xs text-amber-600 text-right">Select at least one plan to continue.</p>}
                        </div>
                      )}

                      {/* ── ACA Step 3: Add-ons ── */}
                      {acaStep === 3 && (
                        <div className="space-y-3">
                          <div className="card">
                            <h3 className="font-display font-semibold text-kiaa-700 text-base mb-1">Step 3 — Add-ons</h3>
                            <p className="text-sm text-surface-400">These optional benefits can be added on top of your ACA health plan election.</p>
                          </div>

                          {/* Riders */}
                          <div className="card">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-bold bg-surface-600 text-white px-2.5 py-1 rounded">RIDERS</span>
                              <span className="text-xs text-surface-500">KIAA Riders Package — standalone add-on, enrolled separately by KIAA</span>
                            </div>
                            <div className={`border rounded-xl p-4 cursor-pointer transition-all ${elections['kiaa_riders']?.elected ? 'border-slate-400 bg-slate-50' : 'border-surface-100 hover:border-slate-200'}`}
                              onClick={() => !isLocked && updateElection('kiaa_riders', { ...elections['kiaa_riders'], elected: !elections['kiaa_riders']?.elected })}>
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={elections['kiaa_riders']?.elected || false} readOnly
                                  className="w-4 h-4 cursor-pointer flex-shrink-0"/>
                                <div className="flex-1">
                                  <span className="font-semibold text-sm text-surface-700">KIAA Riders Package</span>
                                  <div className="text-xs text-surface-400 mt-0.5">Adult Dental · Vision · Group Life/AD&D — enrolled as a separate group by KIAA</div>
                                  <div className="text-xs text-surface-400 mt-0.5">Single $45.24 · 2-Party $92.40 · Family $136.36/mo</div>
                                  <div className="text-xs text-amber-700 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                                    This is a KIAA-exclusive benefit. Pediatric dental & vision are already included in your ACA plan at no added cost for dependents age 18 and under.
                                  </div>
                                </div>
                                {elections['kiaa_riders']?.elected && <span className="text-xs bg-slate-600 text-white px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Elected</span>}
                              </div>
                            </div>
                          </div>

                          {/* COMPCARE */}
                          <div className="card">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-bold bg-kiaa-600 text-kiaa-aqua px-2.5 py-1 rounded">ADD-ON</span>
                              <span className="text-xs text-surface-500">COMPCARE — Acupuncture, Massage, Active & Fit</span>
                            </div>
                            <div className={`border rounded-xl p-4 cursor-pointer transition-all ${elections['compcare']?.elected ? 'border-orange-400 bg-orange-50' : 'border-surface-100 hover:border-orange-200'}`}
                              onClick={() => !isLocked && updateElection('compcare', { ...elections['compcare'], elected: !elections['compcare']?.elected })}>
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={elections['compcare']?.elected || false} readOnly
                                  className="w-4 h-4 cursor-pointer flex-shrink-0"/>
                                <div className="flex-1">
                                  <span className="font-semibold text-sm text-surface-700">COMPCARE</span>
                                  <div className="text-xs text-surface-400 mt-0.5">Acupuncture · Massage · Active & Fit — +$6.76/mo per employee (all tiers)</div>
                                </div>
                                {elections['compcare']?.elected && <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Elected</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <button className="btn flex items-center gap-2" onClick={() => setAcaStep(2)}>
                              <ChevronDown size={14} className="rotate-90"/> Back
                            </button>
                            <button className="btn btn-primary flex items-center gap-2" onClick={() => setAcaStep(4)}>
                              Next — review & submit <ChevronDown size={14} className="rotate-[-90deg]"/>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── ACA Step 4: Review & submit ── */}
                      {acaStep === 4 && (
                        <div className="space-y-3">
                          <div className="card">
                            <h3 className="font-display font-semibold text-kiaa-700 text-base mb-1">Step 4 — Review & submit</h3>
                            <p className="text-sm text-surface-400">Review your elections before submitting to KIAA. Age-based premiums will be calculated by KIAA after submission.</p>
                          </div>

                          {/* Summary */}
                          <div className="card space-y-3">
                            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Election summary</div>

                            <div className="flex items-center justify-between text-sm border-b border-surface-50 pb-2">
                              <span className="text-surface-500">Full-time employees</span>
                              <span className="font-semibold text-surface-700">{fte.ft_employees || '—'}</span>
                            </div>

                            <div>
                              <div className="text-xs text-surface-400 mb-2">Elected ACA plans ({electedCount})</div>
                              {electedCount === 0
                                ? <p className="text-xs text-amber-600">No plans selected — go back to Step 2.</p>
                                : ['aca_ppp','aca_cm_a','aca_hph_plus'].filter(pid => elections[pid]?.elected).map(pid => {
                                    const planNames = { aca_ppp: 'ACA PPP', aca_cm_a: 'ACA CompMED A', aca_hph_plus: 'ACA HPH Plus' }
                                    return (
                                      <div key={pid} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-50">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">ACA</span>
                                          <span className="text-surface-700">{planNames[pid]}</span>
                                        </div>
                                        <span className="text-xs text-surface-400 italic">Age-based rates · confirmed by KIAA</span>
                                      </div>
                                    )
                                  })
                              }
                            </div>

                            {(elections['kiaa_riders']?.elected || elections['compcare']?.elected) && (
                              <div>
                                <div className="text-xs text-surface-400 mb-2">Add-ons</div>
                                {elections['kiaa_riders']?.elected && (
                                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-surface-50">
                                    <span className="text-surface-700">KIAA Riders Package</span>
                                    <span className="font-mono text-xs text-surface-500">$45.24 / $92.40 / $136.36/mo</span>
                                  </div>
                                )}
                                {elections['compcare']?.elected && (
                                  <div className="flex items-center justify-between text-sm py-1.5">
                                    <span className="text-surface-700">COMPCARE</span>
                                    <span className="font-mono text-xs text-surface-500">$6.76/mo flat</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-violet-700 flex items-start gap-2">
                              <Info size={12} className="flex-shrink-0 mt-0.5"/>
                              Age-based premiums for ACA plans are calculated individually per member. KIAA will confirm final premiums after reviewing your census.
                            </div>
                          </div>

                          {saveError && (
                            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                              <AlertCircle size={14}/>{saveError}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <button className="btn flex items-center gap-2" onClick={() => setAcaStep(3)}>
                              <ChevronDown size={14} className="rotate-90"/> Back
                            </button>
                            <div className="flex items-center gap-3 flex-wrap">
                              <button className="btn" onClick={() => handleSave(false)} disabled={saving}>
                                {saving ? <><Loader size={14} className="animate-spin"/>Saving…</> : <><Save size={14}/>Save draft</>}
                              </button>
                              <button className="btn btn-primary"
                                onClick={() => handleSave(true)}
                                disabled={saving || electedCount === 0 || !fte.ft_employees}>
                                <CheckCircle size={14}/>
                                Submit to KIAA
                              </button>
                            </div>
                          </div>
                          {(!fte.ft_employees || electedCount === 0) && (
                            <p className="text-xs text-amber-600">
                              {!fte.ft_employees ? 'Complete the employee count in Step 1 before submitting. ' : ''}
                              {electedCount === 0 ? 'Select at least one plan in Step 2 before submitting.' : ''}
                            </p>
                          )}
                          {saved && (
                            <div className="flex items-center gap-2 bg-kiaa-50 text-kiaa-700 text-sm px-3 py-2.5 rounded-lg">
                              <CheckCircle size={14}/> Draft saved successfully.
                            </div>
                          )}
                          <p className="text-xs text-surface-400">
                            Save draft saves your progress without submitting. Submit sends your election to KIAA for confirmation. Age-based premiums will be calculated by KIAA after submission.
                          </p>
                        </div>
                      )}
                    </>
                    )}
                  </>
                  )
                })()}

                {/* ── ACA LOCKED STATE ── */}
                {company?.group_type === 'aca_small_group' && isLocked && (
                  <div className="card text-center py-6">
                    <CheckCircle size={36} className="text-kiaa-400 mx-auto mb-3"/>
                    <div className="font-semibold text-surface-700 mb-1">Election confirmed</div>
                    <p className="text-surface-400 text-sm">Your plan election has been confirmed by KIAA. View your enrolled plans in the My Plans tab.</p>
                  </div>
                )}

                {/* ── MRG STEPPED OPEN ENROLLMENT ── */}
                {band && Object.keys(rates).length > 0 && !isLocked && (() => {
                  const steps = [
                    { num: 1, label: 'Employee count',   done: !!(fte.ft_employees) },
                    { num: 2, label: 'Select plans',      done: electedCount > 0 },
                    { num: 3, label: 'Add-ons',           done: true },
                    { num: 4, label: 'Review & submit',   done: false },
                  ]

                  return (
                    <>
                      {/* Step progress bar */}
                      <div className="card p-0 overflow-hidden">
                        <div className="flex">
                          {steps.map((s, i) => (
                            <button key={s.num}
                              onClick={() => setOeStep(s.num)}
                              className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-all border-b-2 ${
                                oeStep === s.num
                                  ? 'border-kiaa-500 bg-kiaa-50 text-kiaa-700'
                                  : s.done
                                    ? 'border-kiaa-400 bg-white text-kiaa-700 hover:bg-kiaa-50'
                                    : 'border-transparent bg-white text-surface-400 hover:bg-surface-50'
                              } ${i > 0 ? 'border-l border-surface-100' : ''}`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                oeStep === s.num ? 'bg-kiaa-600 text-white' :
                                s.done ? 'bg-kiaa-500 text-white' : 'bg-surface-200 text-surface-500'
                              }`}>
                                {s.done && oeStep !== s.num ? '✓' : s.num}
                              </div>
                              <span className="hidden sm:block">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Step 1 — Employee count */}
                      {oeStep === 1 && (() => {
                        const ftN  = parseInt(fte.ft_employees)   || 0
                        const ptN  = parseInt(fte.pt_employees)   || 0
                        const ptH  = parseFloat(fte.pt_avg_hrs)   || 0
                        const seN  = parseInt(fte.seasonal_employees) || 0
                        const seH  = parseFloat(fte.seasonal_avg_hrs) || 0
                        const ptFte = ptN > 0 ? Math.round((ptN * ptH * 4.33) / 120 * 10) / 10 : 0
                        const seFte = seN > 0 ? Math.round((seN * seH * 4.33) / 120 * 10) / 10 : 0
                        const totalFte = Math.round((ftN + ptFte + seFte) * 10) / 10
                        const headcount = ftN + ptN + seN
                        return (
                          <div className="card space-y-4">
                            <div>
                              <h3 className="font-display font-semibold text-kiaa-700 text-base mb-1">Step 1 — Employee count</h3>
                              <p className="text-sm text-surface-400">Open enrollment is the right time to update your headcount. These numbers determine your COBRA, FMLA, PHCA, and ERISA obligations.</p>
                            </div>
                            <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-100 rounded-xl px-3 py-2.5 text-xs text-kiaa-700">
                              <Info size={13} className="flex-shrink-0 mt-0.5"/>
                              FTE is calculated using the IRS/DOL method: FTE = full-time + (part-time monthly hrs ÷ 120). Monthly hours = weekly average × 4.33 weeks.
                            </div>
                            <div>
                              <label className="label">Full-time employees (30+ hrs/week) <span className="text-red-400">*</span></label>
                              <input type="number" min="0" className="input"
                                placeholder="e.g. 22"
                                value={fte.ft_employees}
                                onChange={e => setFte(f => ({ ...f, ft_employees: e.target.value }))}/>
                              {!fte.ft_employees && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={11}/> Required before submitting</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label">Part-time employees (&lt;30 hrs/week)</label>
                                <input type="number" min="0" className="input" placeholder="e.g. 8"
                                  value={fte.pt_employees}
                                  onChange={e => setFte(f => ({ ...f, pt_employees: e.target.value }))}/>
                              </div>
                              <div>
                                <label className="label">Avg weekly hours each</label>
                                <input type="number" min="0" max="29" className="input" placeholder="e.g. 20"
                                  value={fte.pt_avg_hrs}
                                  onChange={e => setFte(f => ({ ...f, pt_avg_hrs: e.target.value }))}/>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label">Seasonal employees</label>
                                <input type="number" min="0" className="input" placeholder="e.g. 3"
                                  value={fte.seasonal_employees}
                                  onChange={e => setFte(f => ({ ...f, seasonal_employees: e.target.value }))}/>
                              </div>
                              <div>
                                <label className="label">Avg weekly hours each</label>
                                <input type="number" min="0" className="input" placeholder="e.g. 30"
                                  value={fte.seasonal_avg_hrs}
                                  onChange={e => setFte(f => ({ ...f, seasonal_avg_hrs: e.target.value }))}/>
                              </div>
                            </div>
                            <div>
                              <label className="label">Employees enrolled in the health plan <span className="text-surface-400 font-normal">(waived coverage excluded)</span></label>
                              <input type="number" min="0" className="input"
                                placeholder="e.g. 5 — if 2 of 7 employees waived coverage"
                                value={fte.enrolled_employees}
                                onChange={e => setFte(f => ({ ...f, enrolled_employees: e.target.value }))}/>
                              <p className="text-xs text-surface-400 mt-1">Used for ERISA Form 5500 plan participant count. Dependents are not counted.</p>
                            </div>
                            {(ftN > 0 || ptN > 0 || seN > 0) && (() => {
                              const enrolledN    = parseInt(fte.enrolled_employees) || 0
                              const participantN = parseInt(fte.plan_participants)  || enrolledN || ftN
                              return (
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-100">
                                  <div className="bg-kiaa-50 rounded-xl p-3 text-center">
                                    <div className="text-xs text-surface-400 mb-0.5">Calculated FTE</div>
                                    <div className="text-xl font-bold text-kiaa-700">{totalFte}</div>
                                    <div className="text-xs text-surface-400">COBRA / PHCA</div>
                                  </div>
                                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                                    <div className="text-xs text-surface-400 mb-0.5">Headcount</div>
                                    <div className="text-xl font-bold text-surface-700">{headcount}</div>
                                    <div className="text-xs text-surface-400">all employees · FMLA</div>
                                  </div>
                                  <div className={`rounded-xl p-3 text-center ${participantN >= 100 ? 'bg-amber-50' : 'bg-surface-50'}`}>
                                    <div className="text-xs text-surface-400 mb-0.5">Plan participants</div>
                                    <div className={`text-xl font-bold ${participantN >= 100 ? 'text-amber-700' : 'text-surface-700'}`}>{participantN}</div>
                                    <div className={`text-xs ${participantN >= 100 ? 'text-amber-600' : 'text-surface-400'}`}>
                                      {participantN >= 100 ? '⚠ Form 5500 required' : 'Form 5500 · enrolled only'}
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                            <div className="flex justify-end pt-2">
                              <button className="btn btn-primary" onClick={() => setOeStep(2)}>
                                Next — Select plans <ChevronDown size={14} className="rotate-[-90deg]"/>
                              </button>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Step 2 — Select plans */}
                      {oeStep === 2 && (
                        <div className="space-y-3">
                          <div className="card">
                            <h3 className="font-display font-semibold text-kiaa-700 text-base mb-1">Step 2 — Select health plans</h3>
                            <p className="text-sm text-surface-400">Choose the plans you want to offer your employees. Check a plan to expand it and set employee contribution amounts.</p>
                          </div>

                          {!isBand9(company) && (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold bg-kiaa-700 text-kiaa-aqua px-2.5 py-1 rounded">7(a)</span>
                                <span className="text-xs text-surface-500 font-medium">Equal to or better than the prevalent plan</span>
                              </div>
                              <div className="space-y-2">
                                {PLANS_7A.map(plan => (
                                  <PlanElectionCard key={plan.id}
                                    plan={plan} election={elections[plan.id]}
                                    rate={rates[plan.id]} isLocked={isLocked}
                                    onChange={updateElection} compCareElected={compCareElected}/>
                                ))}
                              </div>
                              <div className="flex items-center gap-3 mt-3">
                                <span className="text-xs font-bold bg-surface-700 text-white px-2.5 py-1 rounded">7(b)</span>
                                <span className="text-xs text-surface-500 font-medium">Employer must pay one-half of dependent coverage cost</span>
                              </div>
                              <div className="space-y-2">
                                {PLANS_7B.map(plan => (
                                  <PlanElectionCard key={plan.id}
                                    plan={plan} election={elections[plan.id]}
                                    rate={rates[plan.id]} isLocked={isLocked}
                                    onChange={updateElection} compCareElected={compCareElected}/>
                                ))}
                              </div>
                            </>
                          )}

                          {kaiserRates.length > 0 && (
                            <div className="mt-4 pt-4 border-t-2 border-surface-100">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-2 h-2 rounded-full bg-blue-400"/>
                                <h3 className="font-display font-semibold text-surface-700 text-sm">Kaiser Permanente Plans</h3>
                                {company?.kaiser_schedule && (
                                  <span className="badge badge-aqua font-mono text-xs font-bold">Schedule {company.kaiser_schedule}</span>
                                )}
                              </div>
                              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-800 mb-3">
                                <span className="flex-shrink-0">ℹ</span>
                                Kaiser plans use composite rates specific to your company. COMPCARE does not apply to Kaiser plans.
                              </div>
                              <KaiserRateTable rates={kaiserRates} schedule={company?.kaiser_schedule}/>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2">
                            <button className="btn" onClick={() => setOeStep(1)}>
                              <ChevronDown size={14} className="rotate-90"/> Back
                            </button>
                            <button className="btn btn-primary" onClick={() => setOeStep(3)}
                              disabled={electedCount === 0}>
                              Next — Add-ons <ChevronDown size={14} className="rotate-[-90deg]"/>
                            </button>
                          </div>
                          {electedCount === 0 && <p className="text-xs text-amber-600 text-right">Select at least one plan to continue.</p>}
                        </div>
                      )}

                      {/* Step 3 — Add-ons */}
                      {oeStep === 3 && (
                        <div className="space-y-3">
                          <div className="card">
                            <h3 className="font-display font-semibold text-kiaa-700 text-base mb-1">Step 3 — Add-ons</h3>
                            <p className="text-sm text-surface-400">These optional benefits can be added on top of your health plan election.</p>
                          </div>

                          {RIDERS_PLAN && (
                            <div className="card">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold bg-surface-600 text-white px-2.5 py-1 rounded">RIDERS</span>
                                <span className="text-xs text-surface-500 font-medium">KIAA Riders Package — Adult Dental, Vision, Group Life/AD&D</span>
                              </div>
                              <PlanElectionCard
                                plan={RIDERS_PLAN}
                                election={elections['kiaa_riders']}
                                rate={rates['kiaa_riders'] || { single: RIDERS_PLAN.flatRates.single, two_party: RIDERS_PLAN.flatRates.two_party, family: RIDERS_PLAN.flatRates.family }}
                                isLocked={isLocked} onChange={updateElection} compCareElected={false}/>
                              <p className="text-xs text-surface-400 mt-2 px-1">{RIDERS_PLAN.note}</p>
                            </div>
                          )}

                          {!isBand9(company) && (
                            <div className="card">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold bg-kiaa-600 text-kiaa-aqua px-2.5 py-1 rounded">ADD-ON</span>
                                <span className="text-xs text-surface-500 font-medium">COMPCARE — Acupuncture, Massage, Active & Fit</span>
                              </div>
                              <div className={`card p-0 overflow-hidden ${compCareElected ? 'border-kiaa-400' : 'border-surface-100'}`}>
                                <div className={`flex items-center gap-3 px-4 py-3 ${compCareElected ? 'bg-kiaa-600' : 'bg-surface-50'}`}>
                                  <input type="checkbox" checked={compCareElected} disabled={isLocked}
                                    onChange={e => setCompCareElected(e.target.checked)}
                                    className="w-4 h-4 accent-kiaa-400 cursor-pointer"/>
                                  <div className="flex-1">
                                    <span className={`font-semibold text-sm ${compCareElected ? 'text-white' : 'text-surface-700'}`}>{COMPCARE.name}</span>
                                    <div className={`text-xs mt-0.5 ${compCareElected ? 'text-kiaa-200' : 'text-surface-400'}`}>
                                      Acupuncture, Massage, Active & Fit · +{fmt(COMPCARE.tiers.single)}/mo per employee (all tiers)
                                    </div>
                                  </div>
                                  {compCareElected && <span className="text-xs bg-kiaa-aqua text-kiaa-800 px-2 py-0.5 rounded font-semibold">Elected</span>}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2">
                            <button className="btn" onClick={() => setOeStep(2)}>
                              <ChevronDown size={14} className="rotate-90"/> Back
                            </button>
                            <button className="btn btn-primary" onClick={() => setOeStep(4)}>
                              Next — Review & submit <ChevronDown size={14} className="rotate-[-90deg]"/>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step 4 — Review & submit */}
                      {oeStep === 4 && (
                        <div className="space-y-3">
                          <div className="card">
                            <h3 className="font-display font-semibold text-kiaa-700 text-base mb-1">Step 4 — Review & submit</h3>
                            <p className="text-sm text-surface-400">Review your elections before submitting to KIAA. Once submitted, contact KIAA to make changes.</p>
                          </div>

                          {/* Summary */}
                          <div className="card space-y-3">
                            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Election summary</div>

                            {/* FTE */}
                            <div className="flex items-center justify-between text-sm border-b border-surface-50 pb-2">
                              <span className="text-surface-500">Full-time employees</span>
                              <span className="font-semibold text-surface-700">{fte.ft_employees || '—'}</span>
                            </div>

                            {/* Elected plans */}
                            <div>
                              <div className="text-xs text-surface-400 mb-2">Elected plans ({electedCount})</div>
                              {electedCount === 0
                                ? <p className="text-xs text-amber-600">No plans selected — go back to Step 2.</p>
                                : PLANS.filter(p => elections[p.id]?.elected).map(p => (
                                    <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-50">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${p.hmsa_class === '7b' ? 'bg-surface-100 text-surface-600' : 'bg-kiaa-100 text-kiaa-700'}`}>{p.hmsa_class?.toUpperCase()}</span>
                                        <span className="text-surface-700">{p.name}</span>
                                      </div>
                                      <span className="font-mono text-xs text-surface-500">{fmt(rates[p.id]?.single)} / {fmt(rates[p.id]?.two_party)} / {fmt(rates[p.id]?.family)}</span>
                                    </div>
                                  ))
                              }
                            </div>

                            {/* Add-ons */}
                            {(elections['kiaa_riders']?.elected || compCareElected) && (
                              <div>
                                <div className="text-xs text-surface-400 mb-2">Add-ons</div>
                                {elections['kiaa_riders']?.elected && (
                                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-surface-50">
                                    <span className="text-surface-700">KIAA Riders Package</span>
                                    <span className="font-mono text-xs text-surface-500">{fmt(RIDERS_PLAN?.flatRates.single)} / {fmt(RIDERS_PLAN?.flatRates.two_party)} / {fmt(RIDERS_PLAN?.flatRates.family)}</span>
                                  </div>
                                )}
                                {compCareElected && (
                                  <div className="flex items-center justify-between text-sm py-1.5">
                                    <span className="text-surface-700">COMPCARE</span>
                                    <span className="font-mono text-xs text-surface-500">{fmt(COMPCARE.tiers.single)}/mo flat</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {saveError && (
                            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                              <AlertCircle size={14}/>{saveError}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <button className="btn" onClick={() => setOeStep(3)}>
                              <ChevronDown size={14} className="rotate-90"/> Back
                            </button>
                            <div className="flex items-center gap-3 flex-wrap">
                              <button className="btn" onClick={() => handleSave(false)} disabled={saving}>
                                {saving ? <><Loader size={14} className="animate-spin"/>Saving…</> : <><Save size={14}/>Save draft</>}
                              </button>
                              <button className="btn btn-primary"
                                onClick={() => handleSave(true)}
                                disabled={saving || electedCount === 0 || !fte.ft_employees}>
                                <CheckCircle size={14}/>
                                Submit to KIAA
                              </button>
                            </div>
                          </div>
                          {(!fte.ft_employees || electedCount === 0) && (
                            <p className="text-xs text-amber-600">
                              {!fte.ft_employees ? 'Complete the employee count in Step 1 before submitting. ' : ''}
                              {electedCount === 0 ? 'Select at least one plan in Step 2 before submitting.' : ''}
                            </p>
                          )}
                          {electedCount > 0 && (
                            <button className="btn text-xs" onClick={() => {
                              const html = generateCompanyRateSheet({ company, plans: PLANS, elections, rates, COMPCARE, kaiserRates, kaiserElections, oePlanYear, generatedDate: new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'Pacific/Honolulu'}) })
                              const w = window.open('','_blank'); w.document.write(html); w.document.close()
                            }}>
                              <Printer size={13}/> Print rate sheet
                            </button>
                          )}
                          <p className="text-xs text-surface-400">
                            Save draft saves your progress without submitting. Submit sends your election to KIAA for confirmation.
                          </p>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* ── MY PLANS ── */}
            {activeSection === 'plans' && (
              <div className="card">
                <h2 className="section-title flex items-center gap-2"><FileText size={15}/> Enrolled plans</h2>
                {company?.group_type === 'aca_small_group' ? (() => {
                  const acaElected = ['aca_cm_a','aca_hph_plus','aca_ppp'].filter(id => elections[id]?.elected)
                  const ridersElected = elections['kiaa_riders']?.elected
                  const compCareElected = elections['compcare']?.elected
                  if (acaElected.length === 0) return (
                    <p className="text-surface-400 text-sm">No plans enrolled yet. Complete Open Enrollment to add plans.</p>
                  )
                  return (
                    <div className="space-y-4">
                      {acaElected.map(planId => {
                        const p   = ACA_PLAN_BENEFITS[planId]
                        const sbc = planDocs[`sbc__${planId}`]
                        if (!p) return null
                        return (
                          <div key={planId} className="border border-surface-100 rounded-xl overflow-hidden">
                            {/* Plan header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-kiaa-700">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.type === 'HMO' ? 'bg-amber-300 text-amber-900' : 'bg-kiaa-aqua text-kiaa-800'}`}>{p.type}</span>
                                <span className="font-semibold text-sm text-white">{p.name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500 text-white font-semibold">ACA</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {sbc && (
                                  <a href={sbc.file_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-full transition-colors">
                                    📄 SBC
                                  </a>
                                )}
                              </div>
                            </div>
                            {/* Benefit details */}
                            <div className="divide-y divide-surface-50">
                              {[
                                { section: 'Cost sharing' },
                                { label: 'Deductible (ind / fam)',     value: p.deductible,   free: (p.deductible||'').startsWith('$0') },
                                { label: 'OOP max — medical',          value: p.oopMedical,   warn: true },
                                { label: 'OOP max — Rx',               value: p.oopRx },
                                { label: 'Referral required',          value: p.referralRequired ? 'Yes — HMO' : 'No', warn: p.referralRequired },
                                { label: 'Out-of-network',             value: p.outOfNetwork, warn: p.outOfNetwork?.includes('Not covered') },
                                { section: 'Office visits' },
                                { label: 'Primary care (PCP)',         value: p.pcp,          free: p.pcp?.startsWith('$0') || p.pcp === 'No charge' },
                                { label: 'Specialist',                 value: p.specialist },
                                { label: 'Emergency room',             value: p.er },
                                { label: 'Inpatient hospital',         value: p.hospital },
                                { section: 'Prescription drugs' },
                                { label: 'Generic (retail)',           value: p.rxGeneric,    free: p.rxGeneric?.startsWith('$0') },
                                { label: 'Preferred brand (retail)',   value: p.rxPreferred },
                              ].map((row, i) => {
                                if (row.section) return (
                                  <div key={i} className="px-4 py-1.5 bg-kiaa-600 text-white text-xs font-semibold uppercase tracking-wide">{row.section}</div>
                                )
                                return (
                                  <div key={i} className="flex items-center px-4 py-2 text-xs">
                                    <span className="text-surface-400 flex-1">{row.label}</span>
                                    <span className={`font-semibold ${row.free ? 'text-kiaa-600' : row.warn ? 'text-amber-700' : 'text-surface-700'}`}>
                                      {row.value || '—'}
                                    </span>
                                  </div>
                                )
                              })}
                              {/* Riders included */}
                              <div className="px-4 py-2 bg-slate-50 flex items-center justify-between text-xs">
                                <span className="text-surface-400">Riders included</span>
                                <span className="text-slate-600 font-semibold">Dental · Vision · Group Life/AD&D</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {ridersElected && (
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-surface-700">KIAA Riders Package</span>
                            <span className="badge badge-gray">Standalone add-on</span>
                          </div>
                          <div className="text-xs text-surface-500 mt-1">Adult Dental · Vision · Group Life/AD&D</div>
                          <div className="text-xs text-surface-400 mt-1">Enrolled separately by KIAA · Single $45.24 · 2-Party $92.40 · Family $136.36/mo</div>
                        </div>
                      )}
                      {compCareElected && (
                        <div className="border border-orange-100 rounded-xl p-3 bg-orange-50">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-surface-700">COMPCARE</span>
                            <span className="badge badge-amber">Add-on</span>
                          </div>
                          <div className="text-xs text-surface-500 mt-1">Acupuncture · Massage · Active &amp; Fit</div>
                        </div>
                      )}
                    </div>
                  )
                })() : (
                  planList.length === 0 ? (
                    <p className="text-surface-400 text-sm">No plans enrolled yet. Complete Open Enrollment to add plans.</p>
                  ) : (
                    <div className="space-y-4">
                      {planList.map(p => {
                        const r      = rates[p.id]
                        const el     = elections[p.id] || {}
                        const sbc    = planDocs[`sbc__${p.id}`]
                        const gtb    = planDocs[`gtb__${p.id}`]
                        const cc     = compCareElected && isPlanCompCareEligible(p.id) ? COMPCARE.tiers.single : 0
                        const method = el.contrib_method || 'fixed'
                        const eeSingle   = method === 'phca' ? calcPhcaContrib(el.gross_wage, r?.single).contrib   : parseMoney(el.ee_single)
                        const eeTwoParty = method === 'phca' ? calcPhcaContrib(el.gross_wage, r?.two_party).contrib : parseMoney(el.ee_two_party)
                        const eeFamily   = method === 'phca' ? calcPhcaContrib(el.gross_wage, r?.family).contrib   : parseMoney(el.ee_family)
                        const erSingle   = r ? Math.max(0, (r.single    + cc) - eeSingle)   : null
                        const erTwoParty = r ? Math.max(0, (r.two_party + cc) - eeTwoParty) : null
                        const erFamily   = r ? Math.max(0, (r.family    + cc) - eeFamily)   : null

                        return (
                          <div key={p.id} className="border border-surface-100 rounded-xl overflow-hidden">

                            {/* Plan header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-kiaa-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.type === 'HMO' ? 'bg-amber-300 text-amber-900' : 'bg-kiaa-400 text-white'}`}>{p.type}</span>
                                <span className="font-semibold text-sm text-white">{p.name}</span>
                                <span className="badge badge-gray">{p.hmsa_class_label}</span>
                                {p.package && <span className="text-xs text-white/50">{p.package}</span>}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {gtb && (
                                  <a href={gtb.file_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-full transition-colors flex items-center gap-1">
                                    <FileText size={11}/> GTB
                                  </a>
                                )}
                                {sbc && (
                                  <a href={sbc.file_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-full transition-colors flex items-center gap-1">
                                    <FileText size={11}/> SBC
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Plan codes */}
                            {p.codes && (
                              <div className="px-4 py-2 bg-surface-50 border-b border-surface-100 text-xs text-surface-400 font-mono">
                                Plan codes: {p.codes}
                              </div>
                            )}

                            {p.referralRequired && (
                              <div className="mx-4 mt-3 text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-lg border border-amber-100 flex items-center gap-2">
                                <span>⚠</span> HMO plan — employees must obtain a referral from their primary care physician before seeing a specialist.
                              </div>
                            )}

                            {p.note && (
                              <div className="mx-4 mt-3 text-xs bg-kiaa-50 text-kiaa-700 px-3 py-2 rounded-lg border border-kiaa-100">
                                {p.note}
                              </div>
                            )}

                            {/* Full benefit detail */}
                            <div className="divide-y divide-surface-50">
                              {/* Cost sharing section */}
                              <div className="px-4 py-1.5 bg-kiaa-800 mt-3 mx-4 rounded-t-lg">
                                <span className="text-xs font-bold text-white/70 uppercase tracking-wide">Cost sharing</span>
                              </div>
                              {[
                                { label: 'Deductible (ind / fam)',  value: p.deductible },
                                { label: 'OOP max — medical',       value: p.oopMedical,   warn: true },
                                { label: 'OOP max — Rx',            value: p.oopRx },
                                { label: 'Out-of-network',          value: p.outOfNetwork, warn: p.outOfNetwork?.includes('Not covered') },
                              ].map((row, i) => (
                                <div key={i} className="flex items-center mx-4 px-0 py-2 text-xs border-b border-surface-50">
                                  <span className="text-surface-400 flex-1">{row.label}</span>
                                  <span className={`font-semibold ${row.warn ? 'text-amber-700' : 'text-surface-700'}`}>{row.value || '—'}</span>
                                </div>
                              ))}

                              {/* Office visits */}
                              <div className="px-4 py-1.5 bg-kiaa-700 mx-4">
                                <span className="text-xs font-bold text-white/70 uppercase tracking-wide">Office visits</span>
                              </div>
                              {[
                                { label: 'Primary care (PCP)',  value: p.pcp,       free: p.pcp === 'No charge' },
                                { label: 'Specialist',          value: p.specialist },
                                { label: 'Emergency room',      value: p.er },
                                { label: 'Inpatient hospital',  value: p.hospital },
                                { label: 'Maternity',           value: p.maternity },
                              ].map((row, i) => (
                                <div key={i} className="flex items-center mx-4 px-0 py-2 text-xs border-b border-surface-50">
                                  <span className="text-surface-400 flex-1">{row.label}</span>
                                  <span className={`font-semibold ${row.free ? 'text-kiaa-600' : 'text-surface-700'}`}>{row.value || '—'}</span>
                                </div>
                              ))}

                              {/* Prescription drugs */}
                              <div className="px-4 py-1.5 bg-kiaa-700 mx-4">
                                <span className="text-xs font-bold text-white/70 uppercase tracking-wide">Prescription drugs</span>
                              </div>
                              {[
                                { label: 'Generic (retail)',         value: p.rxGeneric,   free: p.rxGeneric?.startsWith('$0') },
                                { label: 'Preferred brand (retail)', value: p.rxPreferred },
                              ].map((row, i) => (
                                <div key={i} className="flex items-center mx-4 px-0 py-2 text-xs border-b border-surface-50">
                                  <span className="text-surface-400 flex-1">{row.label}</span>
                                  <span className={`font-semibold ${row.free ? 'text-kiaa-600' : 'text-surface-700'}`}>{row.value || '—'}</span>
                                </div>
                              ))}

                              {/* Included riders */}
                              {p.riders?.length > 0 && (
                                <>
                                  <div className="px-4 py-1.5 bg-kiaa-700 mx-4">
                                    <span className="text-xs font-bold text-white/70 uppercase tracking-wide">Included coverage</span>
                                  </div>
                                  <div className="flex items-center mx-4 px-0 py-2 text-xs border-b border-surface-50 rounded-b-lg mb-4">
                                    <span className="text-surface-400 flex-1">Riders included</span>
                                    <span className="font-semibold text-surface-700">{p.riders.join(' · ')}</span>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Premium & contribution breakdown */}
                            {r && (
                              <div className="px-4 pb-4 pt-1">
                                <div className="text-xs font-bold text-surface-400 uppercase mb-2" style={{ letterSpacing: '0.1em' }}>
                                  Monthly premiums &amp; contributions
                                  {cc > 0 && <span className="text-kiaa-500 normal-case font-normal ml-1">· includes COMPCARE (+{fmt(cc)}/mo)</span>}
                                </div>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr>
                                      <th className="text-left text-xs font-semibold text-surface-400 uppercase pb-2" style={{ letterSpacing: '0.06em' }}>Tier</th>
                                      <th className="text-right text-xs font-semibold text-surface-400 uppercase pb-2" style={{ letterSpacing: '0.06em' }}>Total</th>
                                      <th className="text-right text-xs font-semibold text-surface-400 uppercase pb-2" style={{ letterSpacing: '0.06em' }}>Employee</th>
                                      <th className="text-right text-xs font-semibold text-surface-400 uppercase pb-2" style={{ letterSpacing: '0.06em' }}>Employer</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[
                                      { label: 'Single',  total: r.single    + cc, ee: eeSingle,   er: erSingle   },
                                      { label: '2-Party', total: r.two_party + cc, ee: eeTwoParty, er: erTwoParty },
                                      { label: 'Family',  total: r.family    + cc, ee: eeFamily,   er: erFamily   },
                                    ].map(row => (
                                      <tr key={row.label} className="border-t border-surface-50">
                                        <td className="py-2 font-medium text-surface-700">{row.label}</td>
                                        <td className="py-2 text-right font-mono text-surface-600">{fmt(row.total)}</td>
                                        <td className="py-2 text-right font-mono text-surface-600">{fmt(row.ee)}</td>
                                        <td className="py-2 text-right font-mono font-semibold text-kiaa-700">{fmt(row.er)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {method === 'phca' && (
                                  <p className="text-xs text-surface-400 mt-1.5">Employee contribution calculated using PHCA 1.5% method.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Riders if elected */}
                      {elections['kiaa_riders']?.elected && (
                        <div className="border border-surface-100 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 bg-surface-600">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded">RIDERS</span>
                              <span className="text-sm font-semibold text-white">KIAA Riders Package</span>
                            </div>
                            {planDocs['gtb__kiaa_riders'] && (
                              <a href={planDocs['gtb__kiaa_riders'].file_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-full transition-colors flex items-center gap-1">
                                <FileText size={11}/> GTB
                              </a>
                            )}
                          </div>
                          <div className="divide-y divide-surface-50">
                            {[
                              { label: 'Adult Dental',    value: 'Included' },
                              { label: 'Vision',          value: 'Included' },
                              { label: 'Group Life/AD&D', value: 'Included' },
                            ].map((row, i) => (
                              <div key={i} className="flex items-center px-4 py-2 text-xs">
                                <span className="text-surface-400 flex-1">{row.label}</span>
                                <span className="font-semibold text-kiaa-600">{row.value}</span>
                              </div>
                            ))}
                          </div>
                          {rates['kiaa_riders'] && (
                            <div className="px-4 pb-4 pt-2">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr>
                                    <th className="text-left text-xs font-semibold text-surface-400 uppercase pb-2" style={{ letterSpacing: '0.06em' }}>Component</th>
                                    <th className="text-right text-xs font-semibold text-surface-400 uppercase pb-2" style={{ letterSpacing: '0.06em' }}>Single</th>
                                    <th className="text-right text-xs font-semibold text-surface-400 uppercase pb-2" style={{ letterSpacing: '0.06em' }}>2-Party</th>
                                    <th className="text-right text-xs font-semibold text-surface-400 uppercase pb-2" style={{ letterSpacing: '0.06em' }}>Family</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { label: 'Drug',      s: rates['kiaa_riders'].premium_single,  tp: rates['kiaa_riders'].premium_two_party,  f: rates['kiaa_riders'].premium_family },
                                    { label: 'Vision',    s: rates['kiaa_riders'].vision_single,   tp: rates['kiaa_riders'].vision_two_party,   f: rates['kiaa_riders'].vision_family },
                                    { label: 'Dental',    s: rates['kiaa_riders'].dental_single,   tp: rates['kiaa_riders'].dental_two_party,   f: rates['kiaa_riders'].dental_family },
                                    { label: 'Life/AD&D', s: rates['kiaa_riders'].life_single,     tp: rates['kiaa_riders'].life_two_party,     f: rates['kiaa_riders'].life_family },
                                  ].map(row => (
                                    <tr key={row.label} className="border-t border-surface-50">
                                      <td className="py-2 font-medium text-surface-700">{row.label}</td>
                                      <td className="py-2 text-right font-mono text-surface-600">{fmt(row.s)}</td>
                                      <td className="py-2 text-right font-mono text-surface-600">{fmt(row.tp)}</td>
                                      <td className="py-2 text-right font-mono text-surface-600">{fmt(row.f)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Membership cards explainer — ACA Full Package only */}
                {isAca && <MembershipCardsSection />}
              </div>
            )}

            {/* ── COMPLIANCE ── */}
            {activeSection === 'compliance' && comp && (
              <div className="space-y-4">
                <div className="card">
                  <h2 className="section-title flex items-center gap-2 mb-1"><ShieldCheck size={15}/> Compliance status</h2>
                  <p className="text-surface-400 text-sm">Based on your current employee count. Requirements update automatically when you submit your headcount during open enrollment.</p>
                </div>

                {[
                  {
                    label: 'Federal COBRA',
                    law: 'ERISA § 601–608',
                    required: comp.fedCobra.required,
                    status: comp.fedCobra.required ? 'required' : 'not-required',
                    threshold: '20+ FTEs',
                    what: 'Offer continued health coverage to employees and dependents after qualifying events (termination, reduced hours, divorce, etc.).',
                    deadline: 'Election notice within 14 days of qualifying event. Employee has 60 days to elect. Coverage lasts 18–36 months.',
                    penalty: '$100/day per qualified beneficiary for failure to notify.',
                    action: { label: 'Generate COBRA notice', section: 'cobra' },
                  },

                  {
                    label: 'Federal FMLA',
                    law: '29 CFR § 825',
                    required: comp.fmla.required,
                    status: comp.fmla.required ? 'required' : 'not-required',
                    threshold: '50+ employees (total headcount)',
                    what: 'Eligible employees get up to 12 weeks of unpaid, job-protected leave for birth/adoption, serious illness, or qualifying military exigencies.',
                    deadline: 'Notify employee of eligibility within 5 business days of leave request. Designation notice within 5 days of sufficient information.',
                    penalty: 'Employees may sue for lost wages and benefits. DOL may investigate and assess civil penalties.',
                    action: { label: 'Generate FMLA notice', section: 'fmla' },
                  },
                  {
                    label: 'ERISA Form 5500',
                    law: '29 CFR § 2520',
                    required: comp.erisa5500.required,
                    status: comp.erisa5500.required ? 'required' : 'not-required',
                    threshold: '100+ plan participants',
                    what: 'Annual filing with DOL and IRS disclosing the financial condition and operations of your benefit plan.',
                    deadline: 'Due July 31 for October 1–September 30 plan year. Extensions available.',
                    penalty: 'Up to $250/day (max $150,000) for late filing.',
                    action: null,
                  },
                  {
                    label: 'Hawaii PHCA',
                    law: 'HRS § 393',
                    required: true,
                    status: 'required',
                    threshold: 'All Hawaii employers',
                    what: 'Requires employers to provide and contribute toward health care coverage for employees working 20+ hours/week for 4+ consecutive weeks.',
                    deadline: 'Provide coverage from first day of eligibility.',
                    penalty: 'Fines up to $500/day.',
                    action: null,
                  },
                  {
                    label: 'Hawaii TDI',
                    law: 'HRS § 392',
                    required: true,
                    status: 'required',
                    threshold: 'All Hawaii employers',
                    what: 'Temporary Disability Insurance provides partial wage replacement for employees unable to work due to non-work-related illness or injury, including pregnancy.',
                    deadline: 'Benefits begin after 7-day waiting period.',
                    penalty: 'Fines and penalties per HRS § 392. Contact Hawaii DLIR at (808) 586-9188.',
                    action: null,
                  },
                  {
                    label: 'SPD Distribution',
                    law: 'ERISA § 104(b)',
                    required: true,
                    status: 'required',
                    threshold: 'All ERISA plans',
                    what: 'Distribute a Summary Plan Description (SPD) to all plan participants within 90 days of enrollment and within 30 days of any material change.',
                    deadline: 'New participants: within 90 days. Updated SPD: every 5 years (annual changes) or 10 years.',
                    penalty: 'Civil penalties up to $110/day per participant for willful failure to distribute.',
                    action: { label: 'Build my SPD', section: 'spd' },
                  },
                ].map(item => (
                  <div key={item.label} className="card p-0 overflow-hidden">
                    <div className={`flex items-center justify-between px-4 py-3 border-b border-surface-100 ${
                      item.status === 'required' ? 'bg-amber-50' :
                      item.status === 'may-apply' ? 'bg-kiaa-50' : 'bg-surface-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-surface-700">{item.label}</span>
                        <span className="text-xs font-mono text-surface-400">{item.law}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-surface-400">{item.threshold}</span>
                        <span className={`badge ${
                          item.status === 'required'    ? 'badge-amber' :
                          item.status === 'may-apply'   ? 'badge-blue'  : 'badge-gray'
                        }`}>
                          {item.status === 'required' ? 'Required' : item.status === 'may-apply' ? 'May apply' : 'Not required'}
                        </span>
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <p className="text-sm text-surface-600">{item.what}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-bold uppercase text-surface-400 mb-1" style={{ letterSpacing:'0.08em' }}>Deadline / timing</div>
                          <div className="text-xs text-surface-600">{item.deadline}</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold uppercase text-surface-400 mb-1" style={{ letterSpacing:'0.08em' }}>Penalty for non-compliance</div>
                          <div className="text-xs text-surface-600">{item.penalty}</div>
                        </div>
                      </div>
                      {item.action && (
                        <button className="btn btn-sm btn-primary mt-2" onClick={() => setActiveSection(item.action.section)}>
                          {item.action.label} →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── TASKS ── */}
            {activeSection === 'tasks' && (
              <div className="space-y-4">
                <div className="card">
                  <h2 className="section-title mb-1">Tasks</h2>
                  <p className="text-surface-400 text-sm">Items assigned by your KIAA administrator. Mark tasks complete once you've taken action.</p>
                </div>
                {tasks.length === 0 ? (
                  <div className="card text-center py-8">
                    <CheckCircle size={28} className="text-kiaa-400 mx-auto mb-2"/>
                    <p className="text-surface-400 text-sm">No pending tasks — you're all caught up.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(t => (
                      <div key={t.id} className="card flex items-start gap-3 py-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          t.due_date && new Date(t.due_date) < new Date() ? 'bg-red-400' :
                          t.due_date && new Date(t.due_date) < new Date(Date.now() + 7*24*60*60*1000) ? 'bg-amber-400' :
                          'bg-kiaa-400'
                        }`}/>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-surface-700">{t.title}</div>
                          {t.description && <div className="text-xs text-surface-400 mt-0.5">{t.description}</div>}
                          {t.due_date && (
                            <div className={`text-xs mt-1 font-medium ${
                              new Date(t.due_date) < new Date() ? 'text-red-500' :
                              new Date(t.due_date) < new Date(Date.now() + 7*24*60*60*1000) ? 'text-amber-600' :
                              'text-surface-400'
                            }`}>
                              Due {new Date(t.due_date).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
                              {new Date(t.due_date) < new Date() && ' — overdue'}
                            </div>
                          )}
                        </div>
                        <button className="btn btn-sm flex-shrink-0 flex items-center gap-1.5"
                          onClick={async () => {
                            await supabase.from('tasks').update({ status:'complete' }).eq('id', t.id)
                            setTasks(prev => prev.filter(x => x.id !== t.id))
                          }}>
                          <CheckCircle size={12}/> Mark done
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── FORMS ── */}
            {activeSection === 'cobra' && comp && (
              <div className="space-y-5">
                <div className="card">
                  <h2 className="section-title flex items-center gap-2 mb-1"><FileText size={15}/> COBRA Notices</h2>
                  <p className="text-surface-400 text-sm">
                    {comp.fedCobra.required
                      ? 'Federal COBRA applies to your company (20+ FTEs). Generate required notices below.'
                      : 'Federal COBRA does not currently apply based on your headcount. Contact KIAA at (808) 961-5422 if you have questions.'}
                  </p>
                  {!comp.fedCobra.required && (
                    <div className="alert-info mt-3 text-xs">
                      <span>ℹ</span><span>Contact KIAA at (808) 961-5422 if an employee needs continuation coverage information.</span>
                    </div>
                  )}
                </div>

                {comp.fedCobra.required && (
                  <>
                    {/* Notice type selector */}
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { id: 'election', label: 'Election Notice', sub: 'For a specific qualifying event' },
                        { id: 'initial',  label: 'General Notice',  sub: 'New employee / new coverage' },
                      ].map(t => (
                        <button key={t.id} onClick={() => setCobraNoticeType(t.id)}
                          className={`flex-1 min-w-[180px] text-left px-4 py-3 rounded-xl border-2 transition-all ${cobraNoticeType === t.id ? 'border-kiaa-500 bg-kiaa-50' : 'border-surface-100 bg-white hover:border-kiaa-200'}`}>
                          <div className={`text-sm font-semibold ${cobraNoticeType === t.id ? 'text-kiaa-700' : 'text-surface-700'}`}>{t.label}</div>
                          <div className="text-xs text-surface-400 mt-0.5">{t.sub}</div>
                        </button>
                      ))}
                    </div>

                    <div className="card space-y-4">
                      <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">Participant information</div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="label">Full legal name</label>
                          <input className="input" value={cobraParticipant.name} placeholder="Jane Doe"
                            onChange={e => setCobraParticipant(p => ({ ...p, name: e.target.value }))}/>
                        </div>
                        <div className="col-span-2">
                          <label className="label">Street address</label>
                          <input className="input" value={cobraParticipant.address} placeholder="123 Main St"
                            onChange={e => setCobraParticipant(p => ({ ...p, address: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">City</label>
                          <input className="input" value={cobraParticipant.city} placeholder="Hilo"
                            onChange={e => setCobraParticipant(p => ({ ...p, city: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">ZIP</label>
                          <input className="input" value={cobraParticipant.zip} placeholder="96720"
                            onChange={e => setCobraParticipant(p => ({ ...p, zip: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">Date of birth</label>
                          <input className="input" type="date" value={cobraParticipant.dob}
                            onChange={e => setCobraParticipant(p => ({ ...p, dob: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">Notice date</label>
                          <input className="input" type="date" value={cobraNoticeDate}
                            onChange={e => setCobraNoticeDate(e.target.value)}/>
                        </div>
                      </div>

                      {cobraNoticeType === 'election' && (
                        <>
                          <div className="border-t border-surface-100 pt-4">
                            <div className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Qualifying event</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <label className="label">Event type</label>
                                <select className="input" value={cobraQEvent} onChange={e => setCobraQEvent(e.target.value)}>
                                  {QUALIFYING_EVENTS.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="label">Event date</label>
                                <input className="input" type="date" value={cobraEventDate}
                                  onChange={e => setCobraEventDate(e.target.value)}/>
                              </div>
                              <div>
                                <label className="label">Coverage loss date</label>
                                <input className="input" type="date" value={cobraCovLost}
                                  onChange={e => setCobraCovLost(e.target.value)}/>
                              </div>
                            </div>
                          </div>

                          {/* Dependents */}
                          <div className="border-t border-surface-100 pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">Dependents (if any)</div>
                              <button className="btn btn-sm" onClick={() => setCobraDependents(d => [...d, { name:'', dob:'' }])}>
                                <Plus size={12}/> Add dependent
                              </button>
                            </div>
                            {cobraDependents.map((dep, i) => (
                              <div key={i} className="flex gap-2 mb-2 items-end">
                                <div className="flex-1">
                                  <label className="label">Name</label>
                                  <input className="input" value={dep.name} placeholder="Dependent name"
                                    onChange={e => setCobraDependents(d => d.map((x,j) => j===i ? {...x, name: e.target.value} : x))}/>
                                </div>
                                <div className="w-36">
                                  <label className="label">Date of birth</label>
                                  <input className="input" type="date" value={dep.dob}
                                    onChange={e => setCobraDependents(d => d.map((x,j) => j===i ? {...x, dob: e.target.value} : x))}/>
                                </div>
                                <button className="btn btn-sm btn-danger mb-0" onClick={() => setCobraDependents(d => d.filter((_,j) => j!==i))}>
                                  <Trash2 size={12}/>
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <button className="btn btn-primary flex items-center gap-2" onClick={() => {
                        const planList = (company?.plans || []).map(pid => PLAN_MAP[pid]).filter(Boolean)
                        const html = cobraNoticeType === 'election'
                          ? generateCobraElectionNoticeHtml({ company, participant: cobraParticipant, dependents: cobraDependents, qEvent: cobraQEvent, eventDate: cobraEventDate, coverageLostDate: cobraCovLost, noticeDate: cobraNoticeDate, plans: planList })
                          : generateCobraInitialNoticeHtml({ company, participant: cobraParticipant, noticeDate: cobraNoticeDate, plans: planList })
                        const w = window.open('', '_blank'); w.document.write(html); w.document.close()
                        logDoc('COBRA Notice', `${cobraNoticeType === 'election' ? 'Election' : 'General'} notice — ${cobraParticipant.name || 'unnamed'}`)
                      }}>
                        <FileDown size={14}/> Generate notice
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeSection === 'fmla' && comp && (
              <div className="space-y-5">
                <div className="card">
                  <h2 className="section-title flex items-center gap-2 mb-1"><FileText size={15}/> FMLA Notices</h2>
                  <p className="text-surface-400 text-sm">
                    {comp.fmla.required
                      ? 'Federal FMLA applies to your company (50+ employees). Generate required notices below.'
                      : 'Federal FMLA does not currently apply to your company based on headcount. Hawaii TDI still applies to all Hawaii employers.'}
                  </p>
                </div>

                {/* Notice type selector */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id:'general',     label:'General Notice',              sub:'Post at each worksite + include in handbook', law:'29 CFR § 825.300(a)' },
                    { id:'eligibility', label:'Eligibility & Rights Notice', sub:'Sent upon specific leave request',            law:'29 CFR § 825.300(b)(c)' },
                    { id:'designation', label:'Designation Notice',          sub:'Official FMLA determination',                 law:'29 CFR § 825.300(d)' },
                    { id:'medcert',     label:'Medical Certification',       sub:'Request from healthcare provider',            law:'29 CFR § 825.305' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setFmlaNoticeType(t.id)}
                      className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${fmlaNoticeType === t.id ? 'border-kiaa-500 bg-kiaa-50' : 'border-surface-100 bg-white hover:border-kiaa-200'}`}>
                      <div className={`text-sm font-semibold ${fmlaNoticeType === t.id ? 'text-kiaa-700' : 'text-surface-700'}`}>{t.label}</div>
                      <div className="text-xs text-surface-400 mt-0.5">{t.sub}</div>
                      <div className="text-xs text-kiaa-500 mt-0.5 font-mono">{t.law}</div>
                    </button>
                  ))}
                </div>

                <div className="card space-y-4">
                  {fmlaNoticeType !== 'general' && (
                    <>
                      <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">Employee information</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="label">Employee full name</label>
                          <input className="input" value={fmlaEmployee.name} placeholder="Jane Doe"
                            onChange={e => setFmlaEmployee(em => ({ ...em, name: e.target.value }))}/>
                        </div>
                        <div className="col-span-2">
                          <label className="label">Street address</label>
                          <input className="input" value={fmlaEmployee.address} placeholder="123 Main St"
                            onChange={e => setFmlaEmployee(em => ({ ...em, address: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">City</label>
                          <input className="input" value={fmlaEmployee.city} placeholder="Hilo"
                            onChange={e => setFmlaEmployee(em => ({ ...em, city: e.target.value }))}/>
                        </div>
                        <div>
                          <label className="label">ZIP</label>
                          <input className="input" value={fmlaEmployee.zip} placeholder="96720"
                            onChange={e => setFmlaEmployee(em => ({ ...em, zip: e.target.value }))}/>
                        </div>
                      </div>

                      {(fmlaNoticeType === 'eligibility' || fmlaNoticeType === 'designation' || fmlaNoticeType === 'medcert') && (
                        <div className="border-t border-surface-100 pt-4 space-y-3">
                          <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">Leave details</div>
                          <div>
                            <label className="label">Leave reason</label>
                            <select className="input" value={fmlaEmployee.leave_reason}
                              onChange={e => setFmlaEmployee(em => ({ ...em, leave_reason: e.target.value }))}>
                              {(LEAVE_REASONS || []).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label">Leave start date</label>
                              <input className="input" type="date" value={fmlaEmployee.start_date}
                                onChange={e => setFmlaEmployee(em => ({ ...em, start_date: e.target.value }))}/>
                            </div>
                            <div>
                              <label className="label">Leave end date</label>
                              <input className="input" type="date" value={fmlaEmployee.end_date}
                                onChange={e => setFmlaEmployee(em => ({ ...em, end_date: e.target.value }))}/>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id="intermittent" checked={fmlaEmployee.intermittent}
                              onChange={e => setFmlaEmployee(em => ({ ...em, intermittent: e.target.checked }))}
                              className="w-4 h-4 accent-kiaa-500"/>
                            <label htmlFor="intermittent" className="text-sm text-surface-600">Intermittent / reduced schedule leave</label>
                          </div>
                        </div>
                      )}

                      {fmlaNoticeType === 'eligibility' && (
                        <div className="border-t border-surface-100 pt-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">Eligibility determination</span>
                          </div>
                          <div className="flex gap-3 mb-3">
                            {[{v:true,l:'Eligible'},{v:false,l:'Not eligible'}].map(opt => (
                              <button key={String(opt.v)} onClick={() => setFmlaEligible(opt.v)}
                                className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${fmlaEligible === opt.v ? 'border-kiaa-500 bg-kiaa-50 text-kiaa-700' : 'border-surface-100 bg-white text-surface-500'}`}>
                                {opt.l}
                              </button>
                            ))}
                          </div>
                          {!fmlaEligible && (
                            <div className="space-y-2">
                              <div className="text-xs text-surface-400 mb-1">Reason(s) not eligible:</div>
                              {(INELIGIBLE_REASONS || []).map(r => (
                                <label key={r.id} className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4 accent-kiaa-500"
                                    checked={fmlaIneligibleReasons.includes(r.id)}
                                    onChange={e => setFmlaIneligibleReasons(prev =>
                                      e.target.checked ? [...prev, r.id] : prev.filter(x => x !== r.id)
                                    )}/>
                                  {r.label}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {fmlaNoticeType === 'designation' && (
                        <div className="border-t border-surface-100 pt-4">
                          <div className="flex gap-3">
                            {[{v:true,l:'Designated as FMLA'},{v:false,l:'Not designated'}].map(opt => (
                              <button key={String(opt.v)} onClick={() => setFmlaDesignated(opt.v)}
                                className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${fmlaDesignated === opt.v ? 'border-kiaa-500 bg-kiaa-50 text-kiaa-700' : 'border-surface-100 bg-white text-surface-500'}`}>
                                {opt.l}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {fmlaNoticeType === 'general' && (
                    <p className="text-sm text-surface-400">The General Notice must be posted at each worksite and included in the employee handbook. No employee-specific information is required.</p>
                  )}

                  <button className="btn btn-primary flex items-center gap-2" onClick={() => {
                    let html = ''
                    if (fmlaNoticeType === 'general') {
                      html = generateFmlaGeneralNoticeHtml({ company })
                    } else if (fmlaNoticeType === 'eligibility') {
                      html = generateFmlaEligibilityNoticeHtml({ company, employee: fmlaEmployee, eligible: fmlaEligible, ineligibleReasons: fmlaIneligibleReasons })
                    } else if (fmlaNoticeType === 'designation') {
                      html = generateFmlaDesignationNoticeHtml({ company, employee: fmlaEmployee, designated: fmlaDesignated })
                    } else if (fmlaNoticeType === 'medcert') {
                      html = generateFmlaMedCertRequestHtml({ company, employee: fmlaEmployee })
                    }
                    const w = window.open('', '_blank'); w.document.write(html); w.document.close()
                    logDoc('FMLA Notice', `${fmlaNoticeType} — ${fmlaEmployee.name || 'unnamed'}`)
                  }}>
                    <FileDown size={14}/> Generate notice
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'spd' && (
              <div className="space-y-5">
                <div className="card">
                  <h2 className="section-title flex items-center gap-2 mb-1"><BookOpen size={15}/> SPD Builder</h2>
                  <p className="text-surface-400 text-sm">
                    Generate your Summary Plan Description — a federally required document that explains your health plan to employees. ERISA requires distributing the SPD to all plan participants within 90 days of enrollment.
                  </p>
                </div>

                <div className="card space-y-4">
                  <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">Sections to include</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id:'eligibility', label:'Eligibility & enrollment' },
                      { id:'glance',      label:'Benefits at a glance' },
                      { id:'plans',       label:'Plan details' },
                      { id:'cobra',       label:'COBRA / continuation' },
                      { id:'fmla',        label:'FMLA / leave' },
                      { id:'erisa',       label:'ERISA rights & reporting' },
                      { id:'hipaa',       label:'HIPAA privacy' },
                      { id:'claims',      label:'Claims & appeals' },
                    ].map(s => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer p-2 rounded-lg hover:bg-surface-50">
                        <input type="checkbox" className="w-4 h-4 accent-kiaa-500"
                          checked={spdSections[s.id] ?? true}
                          onChange={e => setSpdSections(prev => ({ ...prev, [s.id]: e.target.checked }))}/>
                        {s.label}
                      </label>
                    ))}
                  </div>

                  <div className="border-t border-surface-100 pt-4">
                    <div className="alert-info text-xs">
                      <span>ℹ</span>
                      <span>The SPD is generated using your company's enrolled plans and current plan year rates. Make sure your plan elections are confirmed before generating.</span>
                    </div>
                  </div>

                  <button className="btn btn-primary flex items-center gap-2" onClick={() => {
                    const planListForSpd = (company?.plans || []).map(pid => PLAN_MAP[pid]).filter(Boolean)
                    const isAcaCompany = company?.group_type === 'aca_small_group'
                    const generatedDate = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric', timeZone:'Pacific/Honolulu' })
                    const html = generateSPDHtml({
                      company,
                      planList: planListForSpd,
                      sections: spdSections,
                      generatedDate,
                      isAca: isAcaCompany,
                      planYear: isAcaCompany ? acaPlanYearLong(acaPlanStartOf(company)) : planYearLong(oePlanYear),
                      planYearShort: isAcaCompany ? acaPlanYearLong(acaPlanStartOf(company)) : planYearLabel(oePlanYear),
                    })
                    const w = window.open('', '_blank'); w.document.write(html); w.document.close()
                    logDoc('SPD', `Generated for ${company?.name}`)
                  }}>
                    <FileDown size={14}/> Generate SPD
                  </button>
                </div>
              </div>
            )}
            {activeSection === 'aca' && (
              <div className="card">
                <AcaPremiumCalculator company={company} />
              </div>
            )}

            {activeSection === 'rates' && (
              <div className="space-y-5">
                <div className="card">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="section-title flex items-center gap-2 mb-1">
                        <FileText size={15}/> Premium Rate Sheet
                      </h2>
                      <p className="text-surface-400 text-sm">
                        Monthly premiums for your elected plans — Band {band}, plan year {oePlanYear}. You can update employee contribution amounts here at any time.
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn btn-sm btn-primary flex items-center gap-2" onClick={() => handleSave(false)} disabled={saving}>
                        {saving ? <><Loader size={13} className="animate-spin"/>Saving…</> : <><Save size={13}/>Save contributions</>}
                      </button>
                      {Object.keys(rates).length > 0 && (
                        <button className="btn btn-sm flex items-center gap-2" onClick={() => {
                          const html = generateCompanyRateSheet({ company, plans: PLANS, elections, rates, COMPCARE, kaiserRates, kaiserElections, oePlanYear, generatedDate: new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'Pacific/Honolulu'}) })
                          const w = window.open('','_blank'); w.document.write(html); w.document.close()
                        }}>
                          <Printer size={13}/> Print rate sheet
                        </button>
                      )}
                    </div>
                  </div>
                  {saved && (
                    <div className="flex items-center gap-2 bg-kiaa-50 text-kiaa-700 text-sm px-3 py-2 rounded-lg mt-3">
                      <CheckCircle size={13}/> Contribution amounts saved.
                    </div>
                  )}
                </div>

                {Object.keys(rates).length === 0 ? (
                  <div className="card text-center py-8">
                    <p className="text-surface-400 text-sm">Rates for your band have not been uploaded yet. Contact your KIAA administrator.</p>
                  </div>
                ) : (
                  <>
                    {/* HMSA Plans — only elected ones, grouped by class */}
                    {(() => {
                      const elected7a = PLANS_7A.filter(p => elections[p.id]?.elected && rates[p.id])
                      const elected7b = PLANS_7B.filter(p => elections[p.id]?.elected && rates[p.id])
                      const hasHmsa = elected7a.length > 0 || elected7b.length > 0

                      if (!hasHmsa) return (
                        <div className="card py-6 text-center">
                          <p className="text-surface-400 text-sm">No HMSA plans elected yet. Complete open enrollment to see your rates.</p>
                        </div>
                      )

                      return (
                        <>
                          {elected7a.length > 0 && (
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-xs font-bold bg-kiaa-800 text-white px-2.5 py-1 rounded">7(a)</span>
                                <span className="text-xs text-surface-400 font-medium">Equal to or better than the prevalent plan</span>
                              </div>
                              <div className="space-y-2">
                                {elected7a.map(plan => (
                                  <PlanElectionCard key={plan.id}
                                    plan={plan} election={elections[plan.id]}
                                    rate={rates[plan.id]} isLocked={false}
                                    onChange={updateElection} compCareElected={compCareElected}/>
                                ))}
                              </div>
                            </div>
                          )}

                          {elected7b.length > 0 && (
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-xs font-bold bg-surface-600 text-white px-2.5 py-1 rounded">7(b)</span>
                                <span className="text-xs text-surface-400 font-medium">Employer must pay one-half of dependent coverage cost</span>
                              </div>
                              <div className="space-y-2">
                                {elected7b.map(plan => (
                                  <PlanElectionCard key={plan.id}
                                    plan={plan} election={elections[plan.id]}
                                    rate={rates[plan.id]} isLocked={false}
                                    onChange={updateElection} compCareElected={compCareElected}/>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}

                    {/* Riders — only if elected */}
                    {elections['kiaa_riders']?.elected && rates['kiaa_riders'] && (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-bold bg-surface-600 text-white px-2.5 py-1 rounded">RIDERS</span>
                          <span className="text-xs text-surface-400 font-medium">Adult Dental · Vision · Group Life/AD&D</span>
                        </div>
                        <div className="card p-0 overflow-hidden">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Component</th>
                                <th className="text-right">Single</th>
                                <th className="text-right">2-Party</th>
                                <th className="text-right">Family</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { label: 'Drug',     s: rates['kiaa_riders'].premium_single,   tp: rates['kiaa_riders'].premium_two_party,   f: rates['kiaa_riders'].premium_family },
                                { label: 'Vision',   s: rates['kiaa_riders'].vision_single,    tp: rates['kiaa_riders'].vision_two_party,    f: rates['kiaa_riders'].vision_family },
                                { label: 'Dental',   s: rates['kiaa_riders'].dental_single,    tp: rates['kiaa_riders'].dental_two_party,    f: rates['kiaa_riders'].dental_family },
                                { label: 'Life/AD&D',s: rates['kiaa_riders'].life_single,      tp: rates['kiaa_riders'].life_two_party,      f: rates['kiaa_riders'].life_family },
                              ].map(row => (
                                <tr key={row.label}>
                                  <td className="font-medium text-surface-700">{row.label}</td>
                                  <td className="text-right font-mono text-sm">{fmt(row.s)}</td>
                                  <td className="text-right font-mono text-sm">{fmt(row.tp)}</td>
                                  <td className="text-right font-mono text-sm">{fmt(row.f)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* COMPCARE */}
                    {compCareElected && !isBand9(company) && (
                      <div className="card flex items-center gap-4 py-3">
                        <span className="text-xs font-bold bg-kiaa-600 text-white px-2.5 py-1 rounded">COMPCARE</span>
                        <span className="text-sm text-surface-600">Acupuncture · Massage · Active &amp; Fit</span>
                        <span className="ml-auto font-mono text-sm text-surface-700">{fmt(COMPCARE.tiers.single)}/mo per employee (all tiers)</span>
                      </div>
                    )}

                    {/* Kaiser — only if company has Kaiser and has elected plans */}
                    {kaiserRates.length > 0 && Object.values(kaiserElections).some(e => e.elected) && (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-2 h-2 rounded-full bg-kiaa-400"/>
                          <h3 className="font-display text-base text-kiaa-800">Kaiser Permanente Plans</h3>
                          {company?.kaiser_schedule && (
                            <span className="badge badge-aqua font-mono text-xs font-bold">Schedule {company.kaiser_schedule}</span>
                          )}
                        </div>
                        <div className="alert-info mb-3 text-xs text-kiaa-700">
                          <span>ℹ</span>
                          <span>Kaiser rates are specific to your company and schedule. Drug is included in the medical rate.</span>
                        </div>
                        <KaiserRateTable rates={kaiserRates.filter(r => kaiserElections[`${r.kaiser_plan_no}_${r.kaiser_package_type}`]?.elected)} schedule={company?.kaiser_schedule}/>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeSection === 'forms' && (
              <div className="space-y-4">
                <div className="card">
                  <h2 className="section-title flex items-center gap-2 mb-3"><BookOpen size={15}/> Forms &amp; resources</h2>
                  <input
                    value={formsSearch}
                    onChange={e => setFormsSearch(e.target.value)}
                    placeholder="Search forms and resources…"
                    className="input text-sm mb-3"
                  />
                  {forms.filter(f => f.url).filter(f =>
                    !formsSearch || f.name?.toLowerCase().includes(formsSearch.toLowerCase()) || f.description?.toLowerCase().includes(formsSearch.toLowerCase())
                  ).length === 0 ? (
                    <p className="text-surface-400 text-sm">{formsSearch ? 'No forms match your search.' : 'No forms available.'}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {forms.filter(f => f.url).filter(f =>
                        !formsSearch || f.name?.toLowerCase().includes(formsSearch.toLowerCase()) || f.description?.toLowerCase().includes(formsSearch.toLowerCase())
                      ).map(f => (
                        <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 border border-surface-100 rounded-lg px-3 py-2.5 hover:bg-kiaa-50 hover:border-kiaa-200 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-surface-700 truncate">{f.name}</div>
                            {f.description && <div className="text-xs text-surface-400 truncate">{f.description}</div>}
                          </div>
                          <ExternalLink size={13} className="text-kiaa-400 flex-shrink-0"/>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Document generation log */}
                {docLog.length > 0 && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="section-title mb-0">Recently generated documents</h2>
                      <button className="btn btn-sm text-xs" onClick={() => {
                        setDocLog([])
                        try { localStorage.removeItem('kiaa_doc_log') } catch {}
                      }}>Clear log</button>
                    </div>
                    <div className="space-y-1">
                      {docLog.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-50 text-xs">
                          <div>
                            <span className="font-semibold text-surface-700">{entry.type}</span>
                            {entry.detail && <span className="text-surface-400 ml-2">{entry.detail}</span>}
                          </div>
                          <span className="text-surface-400 flex-shrink-0 ml-3">{entry.ts}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-surface-400 mt-2">Stored locally on this device only. Not synced to KIAA.</p>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'handbook' && (
              isAca ? <HRHandbookACA /> : <HRHandbookMRG />
            )}

          </div>
          </div>
        )}
      </div>
    </div>
  )
}
