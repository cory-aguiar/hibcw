import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ACA_PLAN_BENEFITS, FEIN_DOL_JOTFORM_URL } from '@/lib/plans'
import { useParams } from 'react-router-dom'
import {
  ChevronDown, ChevronUp, CheckCircle, AlertCircle,
  Plus, Trash2, Download, Upload, Loader, Info, ArrowRight, Printer
} from 'lucide-react'

const RIDERS = {
  single:    45.24,
  two_party: 92.40,
  family:    136.36,
  dental:  { single: 33.56, two_party: 73.42, family: 110.08 },
  vision:  { single: 7.32,  two_party: 14.62, family: 21.92  },
  life:    { single: 4.36,  two_party: 4.36,  family: 4.36   },
}

const ACA_PLANS = [
  { id: 'aca_ppp',      shortName: 'ACA PPP',      type: 'PPO',    color: '#0d6965', bg: '#e6f7f6' },
  { id: 'aca_cm_a',     shortName: 'CompMED A',    type: 'PPO',    color: '#5b21b6', bg: '#ede9fe' },
  { id: 'aca_hph_plus', shortName: 'HPH Plus',     type: 'HMO',    color: '#78350f', bg: '#fef3c7' },
]

function fmt(n) {
  if (n == null) return '—'
  return '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(dateStr, opts = { month: 'long', day: 'numeric', year: 'numeric' }) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts)
}

function maskPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length < 4)  return digits
  if (digits.length < 7)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

function getAge(dob, refDate) {
  if (!dob || !refDate) return null
  const [dy, dm, dd] = dob.split('-').map(Number)
  const [ry, rm, rd] = refDate.split('-').map(Number)
  let age = ry - dy
  if (rm < dm || (rm === dm && rd < dd)) age--
  return age
}

function getRidersTier(member, allMembers) {
  if (member.type !== 'employee') return null
  const deps = allMembers.filter(m => m.emp_id === member.emp_id && m.type !== 'employee')
  const adultDeps = deps.filter(m => {
    const age = getAge(m.dob, member.refDate || new Date().toISOString().slice(0,10))
    return age == null || age > 18
  })
  if (adultDeps.length === 0) return 'single'
  if (adultDeps.length === 1) return 'two_party'
  return 'family'
}

function calcMedicalPremium(age, planId, ratesMap) {
  if (age == null || !planId || !ratesMap) return null
  const lookupAge = age <= 0 ? 0 : age >= 65 ? 65 : age
  // ratesMap is { 'aca_ppp': { 0: 186.44, 26: 432.76, ... }, 'aca_cm_a': {...}, ... }
  const planRates = ratesMap[planId]
  if (!planRates) return null
  // Find exact age or closest pediatric (age 0 for children)
  if (age <= 14) return planRates[0] ?? null
  return planRates[lookupAge] ?? null
}

// CSV template
const CSV_TEMPLATE = `emp_id,type,sex,dob\nEMP-001,employee,F,1982-03-15\nEMP-001,dependent_spouse,M,1980-07-22\nEMP-001,dependent_child,F,2018-05-10\nEMP-002,employee,M,1990-11-04`

export default function ProspectPage() {
  const { token } = useParams()
  const [prospect, setProspect]   = useState(null)
  const [notFound, setNotFound]   = useState(false)
  const [step, setStep]           = useState(1)
  const [saving, setSaving]       = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [phase2,    setPhase2]    = useState(false)  // approval received, show acceptance UI
  const [accepted,  setAccepted]  = useState(false)  // fully accepted
  const [declining, setDeclining] = useState(false)  // showing decline form
  const [declined,  setDeclined]  = useState(false)  // fully declined
  const [declineReason,   setDeclineReason]   = useState('')
  const [declineComment,  setDeclineComment]  = useState('')
  const [declineSaving,   setDeclineSaving]   = useState(false)
  const [declineError,    setDeclineError]    = useState('')
  const [acaAcknowledged, setAcaAcknowledged] = useState(false)
  const [acaExpanded,     setAcaExpanded]     = useState(true)
  const [electedPlans,    setElectedPlans]    = useState([])
  const [acceptedChecks,  setAcceptedChecks]  = useState({})
  const [acceptSaving,    setAcceptSaving]    = useState(false)
  const [acceptError,     setAcceptError]     = useState('')
  const [typedSignature,  setTypedSignature]  = useState('')
  const [rates, setRates]         = useState({})

  // Form state
  const [company, setCompany] = useState({
    name: '', address: '', city: '', state: 'HI', zip: '',
    contact_name: '', contact_phone: '', contact_email: '',
    start_date: '', fein_filed: false, dol_filed: false,
  })
  const [census, setCensus]     = useState([])
  const [newMember, setNewMember] = useState({ emp_id:'', type:'employee', sex:'F', dob:'' })
  const [csvError, setCsvError] = useState('')
  const [errors, setErrors]     = useState({})
  const [planDocs, setPlanDocs] = useState({})
  const [disabledDeps, setDisabledDeps] = useState({}) // { memberId: true } for disabled dependent checkbox
  const fileRef = useRef()

  // Load plan documents (SBCs + benefit summaries)
  useEffect(() => {
    supabase.from('plan_documents').select('plan_id, doc_type, file_url, file_name')
      .in('plan_id', ['aca_ppp','aca_cm_a','aca_hph_plus','kiaa_riders'])
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(d => {
          if (!map[d.plan_id]) map[d.plan_id] = {}
          map[d.plan_id][d.doc_type] = d
        })
        setPlanDocs(map)
      })
  }, [])

  useEffect(() => {
    if (!token) return
    supabase.from('prospects').select('*').eq('token', token).maybeSingle()
      .then(({ data }) => {
        if (!data) { setNotFound(true); return }
        setProspect(data)
        if (data.census) setCensus(data.census)
        if (data.company_name) setCompany(c => ({ ...c,
          name: data.company_name || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || 'HI',
          zip: data.zip || '',
          contact_name: data.contact_name || '',
          contact_phone: data.contact_phone || '',
          contact_email: data.contact_email || '',
          start_date: data.start_date || '',
          fein_filed: data.fein_filed || false,
          dol_filed: data.dol_filed || false,
        }))
        if (data.status === 'submitted') setSubmitted(true)
        if (data.status === 'approved')  { setSubmitted(true); setPhase2(true) }
        if (data.status === 'accepted')  { setSubmitted(true); setPhase2(true); setAccepted(true) }
        if (data.status === 'declined')  { setSubmitted(true); setPhase2(true); setDeclined(true) }
        if (data.elected_plans) setElectedPlans(data.elected_plans)
      })
  }, [token])

  // Load ACA rates when start date known
  useEffect(() => {
    if (!company.start_date) return
    const q = getQuarterFromDate(company.start_date)
    if (!q) return
    supabase.from('aca_rates').select('plan_id, age, premium').eq('quarter', q)
      .then(({ data }) => {
        // Build map: { 'aca_ppp': { 0: 186.44, 26: 432.76, ... }, ... }
        const map = {}
        ;(data || []).forEach(r => {
          if (!map[r.plan_id]) map[r.plan_id] = {}
          map[r.plan_id][parseInt(r.age)] = parseFloat(r.premium)
        })
        setRates(map)
      })
  }, [company.start_date])

  function getQuarterFromDate(dateStr) {
    if (!dateStr) return null
    // Parse as local date to avoid UTC timezone shift
    const [y, m] = dateStr.split('-').map(Number)
    if (m <= 3)  return `${y}-1`
    if (m <= 6)  return `${y}-2`
    if (m <= 9)  return `${y}-3`
    return `${y}-4`
  }

  function enforceFirstOfMonth(dateStr) {
    if (!dateStr) return dateStr
    const [y, m] = dateStr.split('-')
    return `${y}-${m}-01`
  }

  function addMember() {
    if (!newMember.emp_id || !newMember.dob) return
    setCensus(c => [...c, { ...newMember, id: Date.now() }])
    setNewMember({ emp_id: '', type: 'employee', sex: 'F', dob: '' })
  }

  function removeMember(id) { setCensus(c => c.filter(m => m.id !== id)) }

  function handleCSVUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const lines = ev.target.result.trim().split('\n').slice(1)
        const parsed = lines.map((line, i) => {
          const [emp_id, type, sex, dob] = line.split(',').map(s => s.trim())
          if (!emp_id || !type || !dob) throw new Error(`Row ${i+2}: missing required fields`)
          return { emp_id, type, sex: sex || 'F', dob, id: Date.now() + i }
        })
        setCensus(parsed)
        setCsvError('')
      } catch(err) {
        setCsvError(err.message)
      }
    }
    reader.readAsText(file)
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'kiaa_census_template.csv'
    a.click(); URL.revokeObjectURL(url)
  }

  function validateStep(s) {
    const e = {}
    if (s === 1) {
      if (!company.name)          e.name = 'Required'
      if (!company.contact_name)  e.contact_name = 'Required'
      if (!company.contact_email) e.contact_email = 'Required'
      if (!company.contact_phone) e.contact_phone = 'Required'
      if (!company.start_date)    e.start_date = 'Required'
    }
    if (s === 2) {
      if (!company.fein_filed) e.fein = 'You must attest that your company has a valid FEIN to proceed'
      if (!company.dol_filed)  e.dol  = 'You must attest that your company has a valid DOL number to proceed'
    }
    if (s === 3) {
      const empCount = census.filter(m => m.type === 'employee').length
      if (empCount === 0) e.census = 'Add at least one employee to continue.'
      if (empCount === 1) e.census = 'minimum_two'
      // Block if any over-26 child is not marked disabled
      const refDate = company.start_date || new Date().toISOString().slice(0,10)
      const unresolved = census.filter(m => {
        if (m.type !== 'dependent_child') return false
        const age = getAge(m.dob, refDate)
        return age != null && age >= 26 && !disabledDeps[m.id]
      })
      if (unresolved.length > 0) e.over26 = unresolved.length
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function nextStep(s) {
    if (!validateStep(s)) return
    setStep(s + 1)
    window.scrollTo(0, 0)
  }

  async function handleSubmit() {
    if (!validateStep(3)) { setStep(3); return }
    setSaving(true)
    const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const code  = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => CHARS[b % CHARS.length]).join('')

    await supabase.from('prospects').update({
      company_name:  company.name,
      address:       company.address,
      city:          company.city,
      state:         company.state,
      zip:           company.zip,
      contact_name:  company.contact_name,
      contact_phone: company.contact_phone,
      contact_email: company.contact_email,
      start_date:    company.start_date,
      fein_filed:    company.fein_filed,
      dol_filed:     company.dol_filed,
      census:        census.map(m => ({ ...m, disabled_dependent: disabledDeps[m.id] || false })),
      status:        'submitted',
      company_code:  code,
      submitted_at:  new Date().toISOString(),
    }).eq('token', token)

    const emailData = {
      contactName:      company.contact_name,
      companyName:      company.name,
      contactEmail:     company.contact_email,
      contactPhone:     company.contact_phone,
      startDate:        company.start_date,
      censusCount:      census.length,
      employeeCount:    census.filter(m => m.type === 'employee').length,
      feinFiled:        company.fein_filed,
      dolFiled:         company.dol_filed,
      companyCode:      code,
      jotformUrl:       FEIN_DOL_JOTFORM_URL,
    }

    // Send confirmation to prospect
    if (company.contact_email) {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'prospect_confirmation',
          to:   company.contact_email,
          data: emailData,
        }),
      }).catch(err => console.error('Prospect email error:', err))
    }

    // Send notification to KIAA admins
    const { data: admins } = await supabase
      .from('profiles').select('email')
      .eq('role', 'super_admin')
    const adminEmails = (admins || []).map(a => a.email).filter(Boolean)
    if (adminEmails.length > 0) {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin_notification',
          to:   adminEmails,
          data: { ...emailData, notes: prospect?.notes || '', token, disabledDeps },
        }),
      }).catch(err => console.error('Admin email error:', err))
    }

    setSaving(false)
    setSubmitted(true)
  }

  // ── Quote calculation ──────────────────────────────────────
  const employees = census.filter(m => m.type === 'employee')
  const quoteRows = census.map(m => {
    const age  = getAge(m.dob, company.start_date || new Date().toISOString().slice(0,10))
    const tier = m.type === 'employee' ? getRidersTier(m, census.map(x => ({...x, refDate: company.start_date}))) : null
    const premiums = {}
    ACA_PLANS.forEach(p => {
      premiums[p.id] = calcMedicalPremium(age, p.id, rates)
    })
    const isMinorChild = m.type === 'dependent_child' && age != null && age <= 18
    return { ...m, age, tier, premiums, isMinorChild }
  })

  const totals = {}
  ACA_PLANS.forEach(p => {
    totals[p.id] = quoteRows.reduce((sum, r) => sum + (r.premiums[p.id] || 0), 0)
  })
  const ridersTotalMonthly = quoteRows
    .filter(r => r.type === 'employee' && r.tier)
    .reduce((sum, r) => sum + (RIDERS[r.tier] || 0), 0)

  const hasRates = Object.keys(rates).length > 0

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="card max-w-md text-center py-12">
        <AlertCircle size={40} className="text-amber-400 mx-auto mb-4"/>
        <div className="font-display font-bold text-xl text-surface-700 mb-2">Link not found</div>
        <p className="text-surface-400 text-sm">This quote link is invalid or has expired. Contact KIAA at (808) 961-5422.</p>
      </div>
    </div>
  )

  const ACKNOWLEDGMENTS = [
    { id: 'plan_year',   label: 'I acknowledge the plan year and coverage start date', sub: `Coverage begins ${fmtDate(company.start_date)} and runs through ${company.start_date ? (() => { const [y,m,d] = company.start_date.split('-').map(Number); return new Date(y+1,m-1,d-1).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) })() : '—'}. The plan year is 12 months and renews annually.` },
    { id: 'rates',       label: 'I acknowledge the plans selected and confirmed rates', sub: 'Rates have been reviewed and confirmed by KIAA.' },
    { id: 'admin_fee',   label: 'I acknowledge the KIAA administrative fee of $4.00 per enrolled employee per month', sub: 'This fee is charged by KIAA in addition to HMSA premiums and is not included in the premium totals shown.' },
    { id: 'membership',  label: 'I acknowledge that annual KIAA membership is required to participate in these health plans', sub: 'A KIAA representative will provide membership details and annual dues.' },
    { id: 'authorized',  label: `I confirm that I am authorized to make this election on behalf of ${company.name || 'this company'}`, sub: '' },
  ]

  const allChecked   = ACKNOWLEDGMENTS.every(a => acceptedChecks[a.id])
  const anyPlanSelected = electedPlans.length > 0
  const expectedName = company.contact_name?.trim() || ''
  const nameMatches  = typedSignature.trim().toLowerCase() === expectedName.toLowerCase() && typedSignature.trim().length > 0
  const canAccept    = allChecked && anyPlanSelected && nameMatches

  async function handleAccept() {
    if (!canAccept) return
    setAcceptSaving(true)

    // Capture IP address server-side
    let acceptedIp = 'Not recorded'
    try {
      const ipRes = await fetch('/api/get-ip')
      const ipData = await ipRes.json()
      acceptedIp = ipData.ip || 'Not recorded'
    } catch { /* non-blocking */ }

    const ackLabels = ACKNOWLEDGMENTS.map(a => a.label)
    await supabase.from('prospects').update({
      status:           'accepted',
      accepted_at:      new Date().toISOString(),
      accepted_by_name: typedSignature.trim(),
      accepted_by_email:company.contact_email,
      accepted_ip:      acceptedIp,
      elected_plans:    electedPlans,
      acknowledgments:  ackLabels,
    }).eq('token', token)

    // Send next steps email
    const quarter = getQuarterFromDate(company.start_date)
    const qLabel  = quarter ? `Q${quarter.split('-')[1]} ${quarter.split('-')[0]}` : '—'
    const { data: docs } = await supabase.from('plan_documents')
      .select('file_url').eq('doc_type','enrollment_form').eq('plan_id','aca_enrollment').maybeSingle()

    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'prospect_next_steps',
        to:   company.contact_email,
        data: {
          contactName:      company.contact_name,
          companyName:      company.name,
          contactEmail:     company.contact_email,
          startDate:        company.start_date,
          companyCode:      prospect?.company_code,
          quarter:          qLabel,
          electedPlans,
          enrolledEmployees:census.filter(m=>m.type==='employee').length,
          enrollmentFormUrl:docs?.file_url || null,
        }
      })
    }).catch(console.error)

    setAcceptSaving(false)
    setAccepted(true)
  }

  const DECLINE_REASONS = [
    'Pricing is too high for our budget',
    'We chose a different carrier or health plan',
    'We no longer need group health coverage',
    'The coverage start date doesn\'t work for us',
    'We need more time to decide',
    'Other reason',
  ]

  async function handleDecline() {
    if (!declineReason) { setDeclineError('Please select a reason for declining.'); return }
    setDeclineSaving(true); setDeclineError('')

    await supabase.from('prospects').update({
      status:          'declined',
      decline_reason:  declineReason,
      decline_comment: declineComment.trim() || null,
      declined_at:     new Date().toISOString(),
    }).eq('token', token)

    // Notify admins
    const { data: admins } = await supabase.from('profiles').select('email').eq('role','super_admin')
    const adminEmails = (admins||[]).map(a=>a.email).filter(Boolean)
    if (adminEmails.length > 0) {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'prospect_declined',
          to:   adminEmails,
          data: {
            companyName:    company.name,
            contactName:    company.contact_name,
            contactEmail:   company.contact_email,
            contactPhone:   company.contact_phone,
            startDate:      company.start_date,
            companyCode:    prospect?.company_code,
            declineReason,
            declineComment: declineComment.trim() || null,
            token,
          }
        })
      }).catch(console.error)
    }

    setDeclineSaving(false)
    setDeclined(true)
    setDeclining(false)
  }

  // ── Declined confirmation screen ──
  if (declined && phase2) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4">
      <div className="card max-w-lg text-center py-12 px-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={36} className="text-red-500"/>
        </div>
        <div className="font-display font-bold text-2xl text-surface-700 mb-2">Quote declined</div>
        <p className="text-surface-600 mb-4">Thank you for letting us know. A KIAA representative may follow up to see if there's anything we can do to help.</p>
        <p className="text-surface-400 text-sm">Changed your mind? Call KIAA at <strong className="text-surface-600">(808) 961-5422</strong> — we can reopen your quote at any time.</p>
      </div>
    </div>
  )

  // ── Decline form screen ──
  if (declining && phase2 && !declined) return (
    <div className="min-h-screen bg-surface-50">
      <div className="bg-kiaa-700 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-white text-lg">KIAA Connect</div>
          <div className="text-kiaa-300 text-xs">ACA Small Group — quote response</div>
        </div>
        <div className="text-kiaa-400 text-xs text-right hidden sm:block">
          <div>Kanoelehua Industrial Area Association</div>
          <div>(808) 961-5422 · kiaahilo.org</div>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">

        <div className="card border-l-4 border-red-400">
          <div className="font-display font-bold text-xl text-surface-700 mb-1">Decline this quote</div>
          <p className="text-surface-400 text-sm">We're sorry to hear that. Please let us know why — a KIAA representative may follow up to see if we can help.</p>
        </div>

        {/* Quote being declined */}
        <div className="card py-3 px-4">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Quote being declined</div>
          <div className="font-semibold text-surface-700">{company.name}</div>
          <div className="text-xs text-surface-400 mt-0.5">
            Coverage start: {fmtDate(company.start_date)} · Code: {prospect?.company_code}
          </div>
        </div>

        {/* Reason selection */}
        <div className="card space-y-3">
          <div className="text-sm font-semibold text-surface-700">Reason for declining <span className="text-red-400">*</span></div>
          <div className="space-y-2">
            {DECLINE_REASONS.map(reason => (
              <label key={reason}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  declineReason === reason ? 'border-red-400 bg-red-50' : 'border-surface-100 hover:border-red-200'
                }`}>
                <input type="radio" name="decline_reason" value={reason} readOnly
                  checked={declineReason === reason}
                  onChange={() => setDeclineReason(reason)}
                  className="w-4 h-4 accent-red-500 flex-shrink-0"/>
                <span className="text-sm text-surface-700">{reason}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="label">Additional comments <span className="text-surface-400 font-normal">(optional)</span></label>
            <textarea className="input min-h-[90px]" style={{resize:'vertical'}}
              placeholder="Tell us more about your decision — this helps us improve our offerings..."
              value={declineComment}
              onChange={e => setDeclineComment(e.target.value)}/>
          </div>

          {declineError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              <AlertCircle size={14}/>{declineError}
            </div>
          )}

          <button className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
            onClick={handleDecline} disabled={declineSaving}>
            {declineSaving ? <><Loader size={14} className="animate-spin"/>Submitting…</> : 'Submit decline & notify KIAA'}
          </button>

          <div className="text-center">
            <button className="text-sm text-kiaa-600 hover:underline" onClick={() => setDeclining(false)}>
              ← Changed your mind? Go back and accept the quote
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (accepted && phase2) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4">
      <div className="card max-w-lg text-center py-12 px-8">
        <div className="w-16 h-16 bg-kiaa-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={36} className="text-kiaa-600"/>
        </div>
        <div className="font-display font-bold text-2xl text-kiaa-700 mb-2">Quote accepted!</div>
        <p className="text-surface-600 mb-4">Your acceptance has been recorded. Check your email for enrollment form instructions and next steps.</p>
        <div className="bg-kiaa-50 border border-kiaa-100 rounded-xl p-4 text-left text-sm space-y-2 mb-6">
          <div className="font-semibold text-kiaa-700 mb-1">What's next:</div>
          <div className="flex items-start gap-2 text-surface-600"><span className="text-kiaa-500 font-bold">1.</span> Check your email for enrollment form download instructions</div>
          <div className="flex items-start gap-2 text-surface-600"><span className="text-kiaa-500 font-bold">2.</span> Return completed forms via Paubox or fax to (808) 935-9740 by the deadline</div>
          <div className="flex items-start gap-2 text-surface-600"><span className="text-kiaa-500 font-bold">3.</span> Register on KIAA Connect using your company code to track enrollment</div>
        </div>
        <a href={`https://connect.kiaahilo.org/register`}
          className="btn btn-primary w-full justify-center text-sm py-3 flex items-center gap-2">
          Register on KIAA Connect →
        </a>
        <p className="text-surface-400 text-xs mt-4">Questions? Call KIAA at <strong>(808) 961-5422</strong></p>
      </div>
    </div>
  )

  if (submitted && !phase2) return (
    <div className="min-h-screen bg-surface-50">
      <div className="bg-kiaa-700 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-white text-lg">KIAA Connect</div>
          <div className="text-kiaa-300 text-xs">ACA Small Group enrollment</div>
        </div>
        <div className="text-kiaa-400 text-xs text-right hidden sm:block">
          <div>Kanoelehua Industrial Area Association</div>
          <div>(808) 961-5422 · kiaahilo.org</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        <div className="bg-kiaa-50 border border-kiaa-300 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle size={22} className="text-kiaa-600 flex-shrink-0 mt-0.5"/>
          <div>
            <div className="font-semibold text-kiaa-700 text-base mb-1">Thank you, {company.name}!</div>
            <div className="text-kiaa-600 text-sm leading-relaxed">Your company information and census have been submitted to KIAA. We'll review your information and be in touch within 2 business days.</div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 font-semibold text-surface-700 text-sm">Your progress</div>
          {[
            { num:'✓', label:'Company information submitted', sub:`Submitted ${new Date(prospect?.submitted_at||new Date()).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'Pacific/Honolulu'})}`, done:true, warn:false },
            { num:'✓', label:'Census submitted', sub:`${census.length} member${census.length!==1?'s':''} · ${census.filter(m=>m.type==='employee').length} employees`, done:true, warn:false },
            { num:'!', label:'Action required — complete your FEIN & DOL filing', sub:'Your quote cannot be prepared until KIAA receives your FEIN and Hawaii DOL number. Use the secure JotForm link below — this must be completed before KIAA can deliver your quote.', done:false, warn:true },
            { num:'4', label:'KIAA review & quote preparation', sub:'KIAA will review your census, confirm rates with HMSA, and prepare your quote', done:false, warn:false },
            { num:'5', label:'Review & accept your quote', sub:"You'll receive an email with your confirmed quote to review and accept", done:false, warn:false },
            { num:'6', label:'Register & submit enrollment forms', sub:'Create your KIAA Connect account and return signed enrollment forms', done:false, warn:false },
          ].map((s,i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b border-surface-50 last:border-0 ${!s.done && !s.warn ? 'opacity-45' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                s.done ? 'bg-emerald-500 text-white' :
                s.warn ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                'bg-surface-100 text-surface-400'
              }`}>{s.num}</div>
              <div>
                <div className={`text-sm font-medium ${s.warn ? 'text-amber-700' : 'text-surface-700'}`}>{s.label}</div>
                <div className="text-xs text-surface-400 mt-0.5 leading-snug">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{borderWidth:'1.5px',borderColor:'#f59e0b',background:'#fef9ec'}}>
          <div className="font-semibold text-amber-800 text-sm mb-2 flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0"/> Complete your FEIN &amp; DOL filing now
          </div>
          <p className="text-amber-700 text-xs leading-relaxed mb-4">
            HMSA requires your Federal Employer Identification Number (FEIN) and Hawaii Department of Labor number before your enrollment can be processed. <strong className="text-amber-800">KIAA cannot prepare or deliver your quote until this information is received.</strong> Please complete the secure form as soon as possible.
          </p>
          <a href={FEIN_DOL_JOTFORM_URL} target="_blank" rel="noopener noreferrer"
            className="btn btn-primary w-full justify-center flex items-center gap-2 text-sm py-2.5">
            Complete FEIN &amp; DOL filing →
          </a>
          <p className="text-xs text-amber-700 mt-2 text-center">Your information is transmitted securely and not stored on KIAA Connect</p>
        </div>

        <div className="card text-center py-5">
          <div className="font-semibold text-surface-700 mb-1">Questions about your submission?</div>
          <p className="text-surface-400 text-sm mb-4">Call us at (808) 961-5422 or email admin@kiaahilo.org</p>
          <a href="tel:+18089615422" className="btn btn-primary inline-flex items-center gap-2">
            📞 Call KIAA · (808) 961-5422
          </a>
        </div>

      </div>
    </div>
  )

  function downloadQuotePDF() {
    const quarter = getQuarterFromDate(company.start_date)
    const planColors = { aca_ppp:'#0d6965', aca_cm_a:'#5b21b6', aca_hph_plus:'#78350f' }
    const planBgs    = { aca_ppp:'#e6f7f6', aca_cm_a:'#ede9fe', aca_hph_plus:'#fef3c7' }
    const planLabels = { aca_ppp:'ACA PPP (PPO)', aca_cm_a:'CompMED A (PPO)', aca_hph_plus:'HPH Plus (HMO)' }

    const memberRows = quoteRows.map(row => {
      const isDep = row.type !== 'employee'
      const typeLabel = row.type==='employee'?'Employee':row.type==='dependent_spouse'?'Dep. spouse':'Dep. child'
      const typeColor = row.type==='employee'?'#0d6965':row.type==='dependent_spouse'?'#5b21b6':'#78350f'
      const typeBg    = row.type==='employee'?'#e6f7f6':row.type==='dependent_spouse'?'#ede9fe':'#fef3c7'
      const ridersCell = row.type==='employee'&&row.tier
        ? `$${RIDERS[row.tier].toFixed(2)}<br/><small style="color:#9ca3af">${TIER_LABEL[row.tier]}</small>`
        : row.isMinorChild ? '<span style="color:#059669">Pediatric ✓</span>' : '—'
      return `<tr style="${isDep?'background:#fafafa;':''}">
        <td style="padding:7px 10px;${isDep?'padding-left:22px;':''}font-size:12px;">
          <span style="font-family:monospace;color:#9ca3af;font-size:11px;">${row.emp_id}</span>
          <span style="background:${typeBg};color:${typeColor};font-size:10px;font-weight:bold;padding:1px 5px;border-radius:3px;margin:0 4px;">${typeLabel}</span>
          <span style="color:#9ca3af;font-size:11px;">age ${row.age??'—'}</span>
        </td>
        ${ACA_PLANS.map(p => `<td style="padding:7px 8px;text-align:right;font-family:monospace;font-size:12px;">${row.premiums[p.id]!=null?'$'+row.premiums[p.id].toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</td>`).join('')}
        <td style="padding:7px 8px;text-align:right;font-size:12px;">${ridersCell}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>Quote — ${company.name}</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#111;}
        table{width:100%;border-collapse:collapse;}
        th,td{border-bottom:1px solid #f0f0f0;}
        @media print{@page{margin:20mm}}
      </style>
    </head><body>
      <div style="background:#08403e;color:#fff;padding:20px 24px;border-radius:8px;margin-bottom:20px;">
        <div style="font-size:20px;font-weight:bold;margin-bottom:4px;">KIAA Connect</div>
        <div style="font-size:13px;opacity:.7;">Kanoelehua Industrial Area Association · Benefits Administration</div>
      </div>
      <h2 style="margin:0 0 4px;font-size:18px;">Estimated monthly premium quote</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">
        ${company.name} · ${fmtDate(company.start_date)} · ${quarter} rates · ${census.filter(m=>m.type==='employee').length} employees
      </p>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 10px;background:#f9fafb;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;">Member</th>
            ${ACA_PLANS.map(p=>`<th style="text-align:right;padding:8px 8px;background:${planBgs[p.id]};color:${planColors[p.id]};font-size:11px;text-transform:uppercase;">${planLabels[p.id]}</th>`).join('')}
            <th style="text-align:right;padding:8px 8px;background:#f3f4f6;color:#374151;font-size:11px;text-transform:uppercase;">Riders</th>
          </tr>
        </thead>
        <tbody>
          ${memberRows}
          <tr style="background:#f9fafb;font-weight:bold;">
            <td style="padding:9px 10px;font-size:13px;">Medical total</td>
            ${ACA_PLANS.map(p=>`<td style="padding:9px 8px;text-align:right;font-family:monospace;color:${planColors[p.id]};">${totals[p.id]>0?'$'+totals[p.id].toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</td>`).join('')}
            <td style="padding:9px 8px;text-align:right;font-family:monospace;color:#374151;">${ridersTotalMonthly>0?'$'+ridersTotalMonthly.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</td>
          </tr>
          <tr style="background:#e6f7f6;font-weight:bold;">
            <td style="padding:9px 10px;font-size:13px;color:#08403e;">Plan + Riders combined</td>
            ${ACA_PLANS.map(p=>`<td style="padding:9px 8px;text-align:right;font-family:monospace;font-size:14px;color:#08403e;">${totals[p.id]>0?'$'+(totals[p.id]+ridersTotalMonthly).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</td>`).join('')}
            <td style="padding:9px 8px;"></td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top:16px;font-size:11px;color:#9ca3af;line-height:1.6;">
        ✦ Pediatric dental &amp; vision (age ≤18) included in all ACA plans at no added cost.<br/>
        ✦ Riders (Dental · Vision · Group Life/AD&amp;D) are a standalone optional add-on.<br/>
        ✦ KIAA admin fee of $4.00 per enrolled employee/month is <em>not</em> included above.<br/>
        ✦ Annual KIAA membership required. Estimates based on ${quarter} HMSA rates.<br/>
        ✦ Final premiums confirmed at enrollment subject to HMSA approval.
      </div>
      <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;font-size:12px;color:#374151;">
        Questions? Contact KIAA at (808) 961-5422 · admin@kiaahilo.org · 820 Piilani St., Suite 201, Hilo, HI 96720
      </div>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  if (!prospect && !notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <Loader size={24} className="animate-spin text-kiaa-400"/>
    </div>
  )

  // ── PHASE 2: Acceptance UI (triggered by KIAA approval) ──
  if (phase2 && !accepted) {
    const ACA_PLAN_OPTIONS = [
      { id: 'ACA PPP',       type: 'PPO', desc: 'Preferred Provider — in & out of network, no referral required' },
      { id: 'ACA CompMED A', type: 'PPO', desc: 'CompMED/PPO — in & out of network, no referral required' },
      { id: 'ACA HPH Plus',  type: 'HMO', desc: 'Health Plan Hawaii Plus — HMO, referral required' },
      { id: 'KIAA Riders',   type: 'ADD-ON', desc: 'Dental · Vision · Group Life/AD&D — enrolled separately by KIAA' },
    ]
    const planYear = company.start_date ? (() => {
      const [y,m,d] = company.start_date.split('-').map(Number)
      return `${fmtDate(company.start_date)} — ${new Date(y+1,m-1,d-1).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`
    })() : '—'

    return (
      <div className="min-h-screen bg-surface-50">
        <div className="bg-kiaa-700 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-white text-lg">KIAA Connect</div>
            <div className="text-kiaa-300 text-xs">ACA Small Group — quote acceptance</div>
          </div>
          <div className="text-kiaa-400 text-xs text-right hidden sm:block">
            <div>Kanoelehua Industrial Area Association</div>
            <div>(808) 961-5422 · kiaahilo.org</div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

          {/* Phase progress bar */}
          <div className="flex gap-0 mb-2 border border-surface-100 rounded-xl overflow-hidden bg-white">
            {[
              { num: '✓', label: 'Quote submitted',   done: true,  active: false },
              { num: '✓', label: 'KIAA review',        done: true,  active: false },
              { num: '3', label: 'Accept quote',       done: false, active: true  },
              { num: '4', label: 'Register',           done: false, active: false },
            ].map((s, i) => (
              <div key={i} className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium border-r border-surface-100 last:border-r-0 ${
                s.active ? 'bg-kiaa-700 text-kiaa-aqua' :
                s.done   ? 'bg-white text-emerald-600' : 'bg-white text-surface-400'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  s.active ? 'bg-kiaa-aqua text-kiaa-700' :
                  s.done   ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-500'
                }`}>{s.num}</div>
                <span className="hidden sm:block">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Approved banner */}
          <div className="bg-kiaa-50 border border-kiaa-300 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-kiaa-600 flex-shrink-0"/>
            <div>
              <div className="font-semibold text-kiaa-700 text-sm">Quote approved by KIAA</div>
              <div className="text-xs text-surface-500 mt-0.5">Rates confirmed · {company.name}</div>
            </div>
          </div>

          {/* Quote details summary */}
          <div className="card space-y-2">
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Confirmed quote details</div>
            {[
              ['Company',        company.name || '—'],
              ['Coverage start', fmtDate(company.start_date)],
              ['Plan year',      planYear],
              ['Rate quarter',   getQuarterFromDate(company.start_date) ? `Q${getQuarterFromDate(company.start_date).split('-')[1]} ${getQuarterFromDate(company.start_date).split('-')[0]}` : '—'],
              ['KIAA admin fee', '$4.00 per enrolled employee/month'],
              ['Annual membership', 'Required · KIAA will provide details'],
            ].map(([l,v]) => (
              <div key={l} className="flex justify-between text-sm border-b border-surface-50 pb-1.5 last:border-0">
                <span className="text-surface-400">{l}</span>
                <span className="font-semibold text-surface-700">{v}</span>
              </div>
            ))}
          </div>

          {/* Plan selection */}
          <div className="card">
            <div className="font-semibold text-surface-700 mb-1">Select your plan(s)</div>
            <p className="text-xs text-surface-400 mb-3">Choose the health plan(s) you want to offer your employees. You may offer more than one.</p>
            <div className="space-y-2">
              {ACA_PLAN_OPTIONS.map(plan => {
                const sel = electedPlans.includes(plan.id)
                return (
                  <label key={plan.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    sel ? 'border-kiaa-400 bg-kiaa-50' : 'border-surface-100 hover:border-kiaa-200'
                  }`} onClick={() => setElectedPlans(prev => sel ? prev.filter(p=>p!==plan.id) : [...prev, plan.id])}>
                    <input type="checkbox" readOnly checked={sel} className="w-4 h-4 accent-kiaa-600 flex-shrink-0"/>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-surface-700">{plan.id}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          plan.type==='HMO' ? 'bg-amber-100 text-amber-700' :
                          plan.type==='ADD-ON' ? 'bg-slate-100 text-slate-700' : 'bg-kiaa-100 text-kiaa-700'
                        }`}>{plan.type}</span>
                      </div>
                      <div className="text-xs text-surface-400 mt-0.5">{plan.desc}</div>
                    </div>
                  </label>
                )
              })}
            </div>
            {!anyPlanSelected && <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><AlertCircle size={11}/> Select at least one plan to continue.</p>}
          </div>

          {/* Acknowledgments */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 font-semibold text-surface-700 text-sm">Acknowledgments</div>
            {ACKNOWLEDGMENTS.map(ack => (
              <div key={ack.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-surface-50 last:border-0 cursor-pointer transition-all ${acceptedChecks[ack.id] ? 'bg-kiaa-50' : 'hover:bg-surface-50'}`}
                onClick={() => setAcceptedChecks(c => ({ ...c, [ack.id]: !c[ack.id] }))}>
                <input type="checkbox" readOnly checked={!!acceptedChecks[ack.id]}
                  className="w-4 h-4 accent-kiaa-600 mt-0.5 flex-shrink-0"/>
                <div>
                  <div className="text-sm text-surface-700 leading-snug">{ack.label}</div>
                  {ack.sub && <div className="text-xs text-surface-400 mt-1 leading-snug">{ack.sub}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          {acceptError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">
              <AlertCircle size={14}/>{acceptError}
            </div>
          )}

          {/* Typed signature */}
          <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-3">
            <div className="font-semibold text-surface-700 text-sm">Electronic signature</div>
            <p className="text-xs text-surface-500 leading-relaxed">
              To accept this quote, type your full legal name exactly as it appears on your submission:{' '}
              <strong className="text-surface-700">{company.contact_name}</strong>
            </p>
            <input
              type="text"
              className="input font-serif text-xl text-kiaa-700 tracking-wide"
              style={{fontFamily:'Georgia,serif', fontSize:'20px'}}
              placeholder="Type your full name here…"
              value={typedSignature}
              onChange={e => setTypedSignature(e.target.value)}
            />
            {typedSignature.trim().length > 0 && (
              nameMatches ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle size={13}/> Name matches — ready to accept
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle size={13}/> Name doesn't match — must be exactly "{company.contact_name}"
                </div>
              )
            )}
          </div>

          {/* Legal notice */}
          <div className="text-xs text-surface-400 leading-relaxed px-1">
            By typing your name and clicking "Accept quote" below, you are providing an electronic signature and acknowledging all items above on behalf of {company.name}. This constitutes a legally binding electronic acceptance under the Electronic Signatures in Global and National Commerce Act (E-SIGN). The date, time, and IP address of this acceptance will be recorded by KIAA.
          </div>

          <button className="btn btn-primary w-full justify-center text-base py-3 flex items-center gap-2"
            onClick={handleAccept}
            disabled={acceptSaving || !canAccept}>
            {acceptSaving
              ? <><Loader size={16} className="animate-spin"/>Saving…</>
              : !allChecked
                ? <>Check all acknowledgments to continue</>
                : !anyPlanSelected
                  ? <>Select at least one plan to continue</>
                  : !nameMatches
                    ? <>Signature required to accept</>
                    : <>Accept quote — {typedSignature.trim()} →</>
            }
          </button>

          <button className="w-full py-2.5 text-sm text-surface-400 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5 mt-1"
            onClick={() => setDeclining(true)}>
            I'd like to decline this quote
          </button>

          {(!allChecked || !anyPlanSelected || !nameMatches) && !acceptSaving && (
            <p className="text-xs text-amber-600 text-center">
              {!anyPlanSelected ? 'Select at least one plan. ' : ''}
              {!allChecked ? 'Check all acknowledgments. ' : ''}
              {allChecked && anyPlanSelected && !nameMatches ? 'Type your full name to sign.' : ''}
            </p>
          )}
        </div>
      </div>
    )
  }

  const STEPS = [
    { num: 1, label: 'Company info' },
    { num: 2, label: 'Compliance' },
    { num: 3, label: 'Census' },
    { num: 4, label: 'Submit' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="bg-kiaa-700 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-white text-lg">KIAA Connect</div>
          <div className="text-kiaa-300 text-xs">ACA Small Group — prospective member quote</div>
        </div>
        <div className="text-kiaa-400 text-xs text-right hidden sm:block">
          <div>Kanoelehua Industrial Area Association</div>
          <div>(808) 961-5422 · kiaahilo.org</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Step bar */}
        <div className="flex gap-0 mb-8 border border-surface-100 rounded-xl overflow-hidden bg-white">
          {STEPS.map((s, i) => (
            <div key={s.num} className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium border-r border-surface-100 last:border-r-0 transition-all ${
              step === s.num ? 'bg-kiaa-700 text-kiaa-aqua' :
              step > s.num  ? 'bg-white text-emerald-600' : 'bg-white text-surface-400'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.num ? 'bg-kiaa-aqua text-kiaa-700' :
                step > s.num  ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-500'
              }`}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="hidden sm:block">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── STEP 1: Company Info ── */}
        {step === 1 && (
          <div className="card space-y-4">
            <div>
              <h2 className="font-display font-bold text-xl text-kiaa-700 mb-1">Company information</h2>
              <p className="text-surface-400 text-sm">Tell us about your company so we can prepare your quote.</p>
            </div>

            {/* ACA Education Panel */}
            <div className="rounded-xl overflow-hidden border border-kiaa-200" style={{background:'#f0fafa'}}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-kiaa-100/50"
                style={{background:'#e6f7f6',borderBottom: acaExpanded ? '0.5px solid #b3e0de' : 'none'}}
                onClick={() => setAcaExpanded(v => !v)}>
                <Info size={15} className="text-kiaa-700 flex-shrink-0"/>
                <span className="text-sm font-semibold text-kiaa-800 flex-1">About ACA Small Group plans — what to expect</span>
                <span className="text-xs font-semibold bg-kiaa-700 text-kiaa-300 px-2 py-0.5 rounded-full">Read before continuing</span>
                <span className="text-kiaa-500 text-sm ml-1">{acaExpanded ? '▲' : '▼'}</span>
              </button>

              {acaExpanded && (
                <div className="px-4 py-4 space-y-5">

                  {/* ACA History */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">📜</span>
                      <span className="text-xs font-semibold text-kiaa-700 uppercase tracking-wider">What is the Affordable Care Act?</span>
                    </div>
                    <p className="text-sm text-surface-600 leading-relaxed mb-3">The Affordable Care Act (ACA), signed into law in 2010, reformed the U.S. health insurance system to expand access to affordable coverage. For small employers, the ACA created a dedicated small group market with standardized plans, guaranteed issue — meaning you cannot be denied coverage — and age-based community rates.</p>
                    <div className="bg-white rounded-xl border border-kiaa-100 p-3 space-y-3">
                      {[
                        ['2010','ACA signed into law','Created minimum coverage standards, required insurers to cover pre-existing conditions, and established the small group market.'],
                        ['2014','ACA small group rules took effect','Employers with 1–50 full-time employees gained access to ACA Small Group plans with standardized benefits and age-based rates.'],
                        ['Today','KIAA administers ACA plans in Hawaii','KIAA coordinates ACA Small Group enrollment with HMSA, managing the full process from your initial application through ongoing administration.'],
                      ].map(([year, title, desc], i, a) => (
                        <div key={year} className="flex gap-3">
                          <div className="w-5 h-5 rounded-full bg-kiaa-700 text-kiaa-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-kiaa-700 mb-0.5">{year} — {title}</div>
                            <div className="text-xs text-surface-500 leading-relaxed">{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* How premiums work */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">💰</span>
                      <span className="text-xs font-semibold text-kiaa-700 uppercase tracking-wider">How ACA premiums are determined</span>
                    </div>
                    <p className="text-sm text-surface-600 leading-relaxed mb-3">Unlike traditional group plans where everyone pays a flat rate, ACA Small Group premiums are <strong className="text-surface-700">age-based</strong> — each enrolled member's monthly cost is calculated individually using their date of birth.</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {[
                        ['What drives your premium','Each person\'s age at the coverage start date determines their rate. Older members pay more than younger members on the same plan.'],
                        ['What doesn\'t affect the rate','Health history, prior claims, or pre-existing conditions cannot affect your premium. ACA plans are guaranteed issue.'],
                      ].map(([t,d]) => (
                        <div key={t} className="bg-white rounded-xl border border-kiaa-100 p-3">
                          <div className="text-xs font-semibold text-kiaa-700 mb-1">{t}</div>
                          <div className="text-xs text-surface-500 leading-relaxed">{d}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 bg-kiaa-100 rounded-xl px-3 py-2 flex-wrap">
                      <span className="text-xs font-medium bg-kiaa-700 text-kiaa-300 px-2 py-1 rounded-lg">Employee A — age 28</span>
                      <span className="text-xs text-kiaa-700">pays less than</span>
                      <span className="text-xs font-medium bg-kiaa-700 text-kiaa-300 px-2 py-1 rounded-lg">Employee B — age 52</span>
                      <span className="text-xs text-kiaa-700">on the same plan</span>
                    </div>
                  </div>

                  {/* Why census matters */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">👥</span>
                      <span className="text-xs font-semibold text-kiaa-700 uppercase tracking-wider">Why we need your full census</span>
                    </div>
                    <p className="text-sm text-surface-600 leading-relaxed">Because premiums are calculated per person, KIAA needs the <strong className="text-surface-700">date of birth</strong> of every employee and dependent you want to enroll. This is how we calculate your group's total monthly premium. The more accurate your census, the more accurate your quote.</p>
                  </div>

                  {/* Acknowledgment */}
                  <label className="flex items-start gap-3 bg-white border border-kiaa-200 rounded-xl p-3 cursor-pointer">
                    <input type="checkbox" checked={acaAcknowledged} onChange={e => setAcaAcknowledged(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-kiaa-600 flex-shrink-0"/>
                    <span className="text-sm text-surface-600 leading-relaxed">
                      I understand that ACA Small Group premiums are age-based and calculated individually per enrolled member. I'll provide accurate dates of birth for all employees and dependents.
                    </span>
                  </label>

                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label">Company name <span className="text-red-400">*</span></label>
                <input className={`input ${errors.name ? 'border-red-300' : ''}`}
                  value={company.name} placeholder="e.g. Aloha Bakery LLC"
                  onChange={e => setCompany(c => ({ ...c, name: e.target.value }))}/>
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="label">Street address</label>
                <input className="input" value={company.address} placeholder="123 Main St"
                  onChange={e => setCompany(c => ({ ...c, address: e.target.value }))}/>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="label">City</label>
                  <input className="input" value={company.city} placeholder="Hilo"
                    onChange={e => setCompany(c => ({ ...c, city: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={company.state}
                    onChange={e => setCompany(c => ({ ...c, state: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">ZIP</label>
                  <input className="input" value={company.zip} placeholder="96720"
                    onChange={e => setCompany(c => ({ ...c, zip: e.target.value }))}/>
                </div>
              </div>
            </div>

            <div className="border-t border-surface-100 pt-4">
              <div className="text-sm font-semibold text-surface-600 mb-3">Primary contact</div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="label">Contact name <span className="text-red-400">*</span></label>
                  <input className={`input ${errors.contact_name ? 'border-red-300' : ''}`}
                    value={company.contact_name} placeholder="Full name"
                    onChange={e => setCompany(c => ({ ...c, contact_name: e.target.value }))}/>
                  {errors.contact_name && <p className="text-xs text-red-500 mt-1">{errors.contact_name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Work email <span className="text-red-400">*</span></label>
                    <input className={`input ${errors.contact_email ? 'border-red-300' : ''}`}
                      type="email" value={company.contact_email} placeholder="hr@company.com"
                      onChange={e => setCompany(c => ({ ...c, contact_email: e.target.value }))}/>
                    {errors.contact_email && <p className="text-xs text-red-500 mt-1">{errors.contact_email}</p>}
                  </div>
                  <div>
                    <label className="label">Phone <span className="text-red-400">*</span></label>
                    <input className={`input ${errors.contact_phone ? 'border-red-300' : ''}`}
                      value={company.contact_phone} placeholder="(808) 555-0100"
                      onChange={e => setCompany(c => ({ ...c, contact_phone: maskPhone(e.target.value) }))}/>
                    {errors.contact_phone && <p className="text-xs text-red-500 mt-1">{errors.contact_phone}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-surface-100 pt-4">
              <label className="label">Desired coverage start date <span className="text-red-400">*</span></label>
              <input type="date" className={`input max-w-xs ${errors.start_date ? 'border-red-300' : ''}`}
                value={company.start_date}
                onChange={e => {
                  const corrected = enforceFirstOfMonth(e.target.value)
                  setCompany(c => ({ ...c, start_date: corrected }))
                }}/>
              {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date}</p>}
              <p className="text-xs text-surface-400 mt-1">Coverage always begins on the 1st of the month. If you select a different day it will be corrected to the 1st.</p>
            </div>

            <div className="flex justify-end pt-2">
              <button className="btn btn-primary flex items-center gap-2" onClick={() => nextStep(1)}>
                Next <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Compliance ── */}
        {step === 2 && (
          <div className="card space-y-4">
            <div>
              <h2 className="font-display font-bold text-xl text-kiaa-700 mb-1">Compliance</h2>
              <p className="text-surface-400 text-sm">Hawaii state and federal filings required for group health plan enrollment. Both are required to participate in KIAA health plans.</p>
            </div>

            {/* Sole proprietor warning — show when neither is checked */}
            {!company.fein_filed && !company.dol_filed && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>
                <div className="text-sm text-red-800">
                  <div className="font-semibold mb-1">Are you a sole proprietor?</div>
                  If your company does not have a FEIN and DOL number, you are likely operating as a sole proprietor. KIAA is unable to offer group health plan coverage to sole proprietors. Please visit the{' '}
                  <a href="https://www.healthcare.gov/small-businesses/choose-and-enroll/shop-marketplace/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    Health Insurance Marketplace
                  </a>{' '}
                  for individual or small business health plan alternatives.
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${company.fein_filed ? 'border-kiaa-400 bg-kiaa-50' : 'border-surface-100 hover:border-kiaa-200'}`}
                onClick={() => setCompany(c => ({ ...c, fein_filed: !c.fein_filed }))}>
                <input type="checkbox" checked={company.fein_filed} readOnly
                  className="w-4 h-4 accent-kiaa-600 mt-0.5 flex-shrink-0"/>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-surface-700">I attest that my company has a valid Federal Employer Identification Number (FEIN) <span className="text-red-400">*</span></div>
                  <div className="text-xs text-surface-500 mt-1">A FEIN is a 9-digit number assigned by the IRS to identify your business for tax purposes (format: XX-XXXXXXX). It is required for all group health plan enrollments.</div>
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 mt-2">
                    ⚠ A FEIN is <strong>not</strong> the same as a Social Security Number (SSN). If you only have an SSN, you are likely a sole proprietor and KIAA cannot offer group coverage.
                  </div>
                  <div className="text-xs text-surface-400 mt-1.5 italic">For security, we do not collect your FEIN here. KIAA will send you a secure link to provide it as part of the enrollment process.</div>
                </div>
              </div>
              {errors.fein && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11}/>{errors.fein}</p>}

              <div className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${company.dol_filed ? 'border-kiaa-400 bg-kiaa-50' : 'border-surface-100 hover:border-kiaa-200'}`}
                onClick={() => setCompany(c => ({ ...c, dol_filed: !c.dol_filed }))}>
                <input type="checkbox" checked={company.dol_filed} readOnly
                  className="w-4 h-4 accent-kiaa-600 mt-0.5 flex-shrink-0"/>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-surface-700">I attest that my company has a valid Hawaii Department of Labor (DOL) number <span className="text-red-400">*</span></div>
                  <div className="text-xs text-surface-500 mt-1">Required for Hawaii employers participating in group health plan programs. Your DOL number confirms your business is registered with the Hawaii Department of Labor and Industrial Relations (DLIR).</div>
                  <div className="text-xs text-surface-400 mt-1.5 italic">For security, we do not collect your DOL number here. KIAA will send you a secure link to provide it as part of the enrollment process.</div>
                </div>
              </div>
              {errors.dol && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11}/>{errors.dol}</p>}
            </div>

            <div className="bg-kiaa-50 border border-kiaa-100 rounded-xl p-4 flex items-start gap-3">
              <Info size={16} className="text-kiaa-600 flex-shrink-0 mt-0.5"/>
              <div className="text-sm text-kiaa-800">
                <strong>Why we ask:</strong> Both a FEIN and DOL number are required by HMSA to enroll a company in a group health plan. We do not collect these numbers here — a KIAA representative will send you a secure link to provide this information after you submit your quote request.
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button className="btn flex items-center gap-2" onClick={() => setStep(1)}>
                <ArrowRight size={14} className="rotate-180"/> Back
              </button>
              <button className="btn btn-primary flex items-center gap-2" onClick={() => nextStep(2)}>
                Next <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Census ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-display font-bold text-xl text-kiaa-700 mb-1">Employee census</h2>
              <p className="text-surface-400 text-sm">Add all employees and their dependents. Each person's age on the coverage start date determines their premium. Download the CSV template to fill out offline, or add members manually below.</p>
            </div>

            {/* DOB reminder */}
            <div className="flex items-start gap-3 bg-kiaa-50 border border-kiaa-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-kiaa-600 flex-shrink-0 mt-0.5"/>
              <div>
                <div className="text-sm font-semibold text-kiaa-700 mb-1">Date of birth is required for every member</div>
                <div className="text-xs text-kiaa-600 leading-relaxed">ACA premiums are age-based — each person's monthly cost is calculated from their date of birth. Please enter accurate dates of birth for all employees and dependents. Missing or incorrect dates will affect your quote.</div>
              </div>
            </div>

            {/* CSV upload */}
            <div className="card">
              <div className="text-sm font-semibold text-surface-600 mb-3">Upload census file</div>
              <div className="flex gap-3">
                <button className="btn flex items-center gap-2 flex-1 justify-center" onClick={downloadTemplate}>
                  <Download size={14}/> Download CSV template
                </button>
                <button className="btn flex items-center gap-2 flex-1 justify-center" onClick={() => fileRef.current.click()}>
                  <Upload size={14}/> Upload completed CSV
                </button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload}/>
              </div>
              {csvError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle size={12}/>{csvError}</p>}
            </div>

            {/* Manual entry */}
            <div className="card">
              <div className="text-sm font-semibold text-surface-600 mb-2">Add member manually</div>

              {/* Instructions */}
              <div className="bg-kiaa-50 border border-kiaa-100 rounded-xl px-3 py-3 mb-4 text-xs text-kiaa-700 space-y-1.5">
                <div className="font-semibold text-kiaa-700 mb-1 flex items-center gap-1.5"><Info size={13}/> How to add members</div>
                <div className="flex items-start gap-2"><span className="font-bold flex-shrink-0">1.</span><span>Add each <strong>employee</strong> first — assign them a unique Employee ID (e.g. EMP-001, EMP-002).</span></div>
                <div className="flex items-start gap-2"><span className="font-bold flex-shrink-0">2.</span><span>To add a <strong>dependent</strong> (spouse or child) for that employee, use the <strong>same Employee ID</strong> as their employee. This links the dependent to the correct employee for Riders tier calculation.</span></div>
                <div className="flex items-start gap-2"><span className="font-bold flex-shrink-0">3.</span><span>Children age 18 and under are covered for pediatric dental & vision under the ACA plan — no Riders premium needed for them.</span></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <div>
                  <label className="label">Employee ID</label>
                  <input className="input text-sm" placeholder="EMP-001"
                    value={newMember.emp_id}
                    onChange={e => setNewMember(m => ({ ...m, emp_id: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input text-sm" value={newMember.type}
                    onChange={e => setNewMember(m => ({ ...m, type: e.target.value }))}>
                    <option value="employee">Employee</option>
                    <option value="dependent_spouse">Dep. spouse</option>
                    <option value="dependent_child">Dep. child</option>
                  </select>
                </div>
                <div>
                  <label className="label">Sex</label>
                  <select className="input text-sm" value={newMember.sex}
                    onChange={e => setNewMember(m => ({ ...m, sex: e.target.value }))}>
                    <option value="F">Female</option>
                    <option value="M">Male</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date of birth</label>
                  <input type="date" className="input text-sm" value={newMember.dob}
                    onChange={e => setNewMember(m => ({ ...m, dob: e.target.value }))}/>
                </div>
              </div>
              <button className="btn btn-primary flex items-center gap-2 text-sm" onClick={addMember}
                disabled={!newMember.emp_id || !newMember.dob}>
                <Plus size={14}/> Add to census
              </button>
            </div>

            {errors.census === 'minimum_two' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>
                <div className="text-sm text-red-800">
                  <div className="font-semibold mb-1">Minimum 2 enrolled employees required</div>
                  KIAA requires a minimum of <strong>two (2) enrolled employees</strong> to participate in the group health plans. If you only have one employee, KIAA is unable to offer group coverage at this time.
                  Please visit <a href="https://www.hmsa.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">hmsa.com</a> for individual health plan alternatives.
                </div>
              </div>
            )}
            {errors.census && errors.census !== 'minimum_two' && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">
                <AlertCircle size={14}/>{errors.census}
              </div>
            )}

            {census.length > 0 && (() => {
              const refDate = company.start_date || new Date().toISOString().slice(0,10)
              const over26Issues = census.filter(m => {
                if (m.type !== 'dependent_child') return false
                const age = getAge(m.dob, refDate)
                return age != null && age >= 26 && !disabledDeps[m.id]
              })
              return (
                <div className="space-y-3">
                  <div className="card p-0 overflow-hidden">
                    <div className="px-4 py-3 bg-surface-50 border-b border-surface-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-surface-600">Census — {census.length} member{census.length !== 1 ? 's' : ''}</span>
                      <span className="text-xs text-surface-400">{census.filter(m => m.type === 'employee').length} employee{census.filter(m => m.type === 'employee').length !== 1 ? 's' : ''}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-100">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">ID</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">Type</th>
                          <th className="px-3 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">Sex</th>
                          <th className="px-3 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">DOB</th>
                          <th className="px-3 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider text-center">Age</th>
                          <th className="px-3 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {census.map(m => {
                          const age = getAge(m.dob, refDate)
                          const isDependent = m.type !== 'employee'
                          const isChild = m.type === 'dependent_child'
                          const isOver26   = isChild && age != null && age >= 26
                          const isDisabled = disabledDeps[m.id]
                          const rowBg = isOver26 && !isDisabled ? 'bg-red-50' : isOver26 && isDisabled ? 'bg-amber-50' : ''
                          const turnDate = isChild && m.dob ? (() => {
                            const [by, bm, bd] = m.dob.split('-').map(Number)
                            return new Date(by + 26, bm - 1, bd).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
                          })() : null
                          // turnsAt26: child is 25 and turns 26 during the coverage year
                          const turnsAt26 = isChild && age === 25 && !isOver26 && (() => {
                            if (!refDate) return false
                            const [by] = m.dob.split('-').map(Number)
                            const [ry] = refDate.split('-').map(Number)
                            return (by + 26) === ry
                          })()

                          return (
                            <tr key={m.id} className={`border-b border-surface-50 last:border-0 ${rowBg}`}>
                              <td className={`px-4 py-2.5 font-mono text-xs text-surface-500 ${isDependent ? 'pl-8' : ''}`}>{m.emp_id}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  m.type === 'employee' ? 'bg-kiaa-100 text-kiaa-700' :
                                  m.type === 'dependent_spouse' ? 'bg-violet-100 text-violet-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {m.type === 'employee' ? 'Employee' : m.type === 'dependent_spouse' ? 'Dep. spouse' : 'Dep. child'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center text-surface-600 text-xs">{m.sex}</td>
                              <td className="px-3 py-2.5 text-center font-mono text-xs text-surface-500">{m.dob}</td>
                              <td className={`px-3 py-2.5 text-center font-semibold text-sm ${
                                isOver26 ? 'text-red-600' : turnsAt26 ? 'text-amber-600' : 'text-surface-700'
                              }`}>{age ?? '—'}</td>

                              {/* Status column */}
                              <td className="px-3 py-2.5">
                                {isOver26 && !isDisabled && (
                                  <div>
                                    <div className="flex items-center gap-1 text-xs font-semibold text-red-700 mb-1.5">
                                      <AlertCircle size={12}/> Over 26 — not eligible
                                    </div>
                                    <div className="text-xs text-red-600 mb-2 leading-snug">
                                      Dependent children may only be covered up to age 26.
                                    </div>
                                    <label className="flex items-start gap-2 p-2 bg-white border border-red-200 rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
                                      <input type="checkbox" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 accent-amber-600"
                                        checked={!!isDisabled}
                                        onChange={e => setDisabledDeps(d => ({ ...d, [m.id]: e.target.checked }))}/>
                                      <span className="text-xs text-red-800 leading-snug">
                                        This dependent qualifies as a <strong>disabled dependent</strong> — totally disabled before age 26, unable to self-sustain. KIAA will contact you to verify with HMSA.
                                      </span>
                                    </label>
                                  </div>
                                )}
                                {isOver26 && isDisabled && (
                                  <div>
                                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 mb-1.5">
                                      <Info size={12}/> Flagged — disabled dependent
                                    </div>
                                    <label className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
                                      <input type="checkbox" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 accent-amber-600"
                                        checked={true}
                                        onChange={e => setDisabledDeps(d => ({ ...d, [m.id]: e.target.checked }))}/>
                                      <span className="text-xs text-amber-800 leading-snug">
                                        Marked as disabled dependent. KIAA will follow up to verify eligibility with HMSA.
                                      </span>
                                    </label>
                                  </div>
                                )}
                                {turnsAt26 && !isOver26 && (
                                  <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                                    <AlertCircle size={11} className="flex-shrink-0 mt-0.5"/>
                                    <span>Turns 26 on {turnDate}. Coverage ends at end of that month.</span>
                                  </div>
                                )}
                                {!isOver26 && !turnsAt26 && (
                                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                                    <CheckCircle size={11}/> Eligible{isChild && age != null && age <= 18 ? ' · pediatric' : ''}
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-right">
                                <button onClick={() => removeMember(m.id)} className={`transition-colors ${isOver26 ? 'text-red-400 hover:text-red-600' : 'text-surface-300 hover:text-red-400'}`}>
                                  <Trash2 size={13}/>
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Over-26 summary banner */}
                  {over26Issues.length > 0 && (
                    <div className="border border-red-300 rounded-xl px-4 py-3 bg-red-50 space-y-2">
                      <div className="font-semibold text-red-800 text-sm flex items-center gap-2">
                        <AlertCircle size={15}/> {over26Issues.length} census issue{over26Issues.length > 1 ? 's' : ''} must be resolved before proceeding
                      </div>
                      {over26Issues.map(m => (
                        <div key={m.id} className="flex items-start gap-2 text-xs text-red-700">
                          <span className="flex-shrink-0 text-red-400">✕</span>
                          <span>
                            <strong>{m.emp_id} dep. child (age {getAge(m.dob, refDate)})</strong> — over age 26 and not eligible for standard enrollment.
                            Either remove this dependent or check the disabled dependent box to flag for KIAA review.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="flex justify-between">
              <button className="btn flex items-center gap-2" onClick={() => setStep(2)}>
                <ArrowRight size={14} className="rotate-180"/> Back
              </button>
              <button className="btn btn-primary flex items-center gap-2" onClick={() => nextStep(3)}>
                Next — review &amp; submit <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Submit ── */}
        {step === 4 && (
          <div className="card space-y-4">
            <div>
              <h2 className="font-display font-bold text-xl text-kiaa-700 mb-1">Review &amp; submit</h2>
              <p className="text-surface-400 text-sm">Review your information before submitting to KIAA. A representative will contact you within 2 business days.</p>
            </div>

            {/* Summary */}
            <div className="bg-surface-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-surface-500">Company</span><span className="font-semibold">{company.name}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Contact</span><span>{company.contact_name} · {company.contact_email}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Coverage start</span><span className="font-semibold text-kiaa-700">{company.start_date ? fmtDate(company.start_date) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Census</span><span>{census.length} members ({census.filter(m=>m.type==='employee').length} employees)</span></div>
              <div className="flex justify-between"><span className="text-surface-500">FEIN attested</span><span className={company.fein_filed ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>{company.fein_filed ? '✓ Yes' : 'Not attested'}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">DOL number attested</span><span className={company.dol_filed ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>{company.dol_filed ? '✓ Yes' : 'Not attested'}</span></div>
            </div>

            {/* JotForm reminder */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="font-semibold text-amber-800 text-sm mb-1 flex items-center gap-2">
                <AlertCircle size={15}/> Your FEIN &amp; DOL filing is required before your quote can be delivered
              </div>
              <p className="text-amber-700 text-xs leading-relaxed">
                After submitting, you must complete the secure JotForm with your Federal Employer Identification Number (FEIN) and Hawaii DOL number. <strong className="text-amber-800">KIAA cannot prepare or deliver your quote until this information is received.</strong> A link will be included in your confirmation email.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-surface-50 rounded-xl border border-surface-100">
                <input type="checkbox" id="confirm1" className="w-4 h-4 mt-0.5 accent-kiaa-600 flex-shrink-0"/>
                <label htmlFor="confirm1" className="text-sm text-surface-700 cursor-pointer">
                  I confirm the census information submitted is accurate to the best of my knowledge.
                </label>
              </div>
              <div className="flex items-start gap-3 p-4 bg-surface-50 rounded-xl border border-surface-100">
                <input type="checkbox" id="confirm2" className="w-4 h-4 mt-0.5 accent-kiaa-600 flex-shrink-0"/>
                <label htmlFor="confirm2" className="text-sm text-surface-700 cursor-pointer">
                  I understand KIAA will review my census and prepare a quote. I'll receive an email to review and accept the quote before enrollment is finalized.
                </label>
              </div>
            </div>

            <button className="btn btn-primary w-full justify-center text-base py-3 flex items-center gap-2"
              onClick={handleSubmit} disabled={saving}>
              {saving ? <><Loader size={16} className="animate-spin"/>Submitting…</> : <>Submit to KIAA</>}
            </button>

            <div className="flex justify-between items-center pt-2">
              <button className="btn flex items-center gap-2 text-sm" onClick={() => setStep(3)}>
                <ArrowRight size={14} className="rotate-180"/> Back to census
              </button>
              <p className="text-xs text-surface-400 text-right">
                You'll receive a confirmation email with next steps including your FEIN/DOL filing link.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
