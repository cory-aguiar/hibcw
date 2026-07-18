import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { PLAN_MAP, isBand9, formatPhone } from '@/lib/plans'
import { getCompliance, getComplianceSummary } from '@/lib/compliance'
import { ArrowLeft, Pencil, Plus, CheckCircle, Clock, Calculator, FileText, Link2, Copy, Check, ClipboardCheck, Eye, FolderOpen, Upload, Loader, Zap, Users } from 'lucide-react'
import CompanyDocuments from '@/components/CompanyDocuments'
import CompanyUsers from '@/components/CompanyUsers'
import CompanyModal from '@/components/CompanyModal'
import KaiserRateUploader from '@/components/KaiserRateUploader'
import KaiserRateTable from '@/components/KaiserRateTable'
import EnrollmentPacket from '@/components/EnrollmentPacket'

import { usePlanYear, planYearLabel, planYearLong } from '@/lib/PlanYearContext'

export default function CompanyDetailPage() {
  const { oePlanYear } = usePlanYear()
  const PLAN_YEAR = oePlanYear
  const { id } = useParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'staff'

  const [company,      setCompany]      = useState(null)
  const [tasks,        setTasks]        = useState([])
  const [kaiserRates,  setKaiserRates]  = useState([])
  const [modal,        setModal]        = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [copied,       setCopied]       = useState(false)
  const [bandEdit,     setBandEdit]     = useState(false)
  const [bandVal,      setBandVal]      = useState('')
  const [logoUploading,setLogoUploading]= useState(false)
  const [activeTab,    setActiveTab]    = useState('overview')

  // Kaiser schedule inline edit
  const [scheduleEdit, setScheduleEdit] = useState(false)
  const [scheduleVal,  setScheduleVal]  = useState('')
  // Kaiser eligible toggle saving state
  const [savingEligible, setSavingEligible] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: co }, { data: tks }, { data: kr }] = await Promise.all([
      supabase.from('companies').select('*').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('company_id', id).order('due_date'),
      supabase.from('kaiser_rates').select('*')
        .eq('company_id', id).eq('plan_year', PLAN_YEAR)
        .order('kaiser_plan_no').order('package_type'),
    ])
    setCompany(co)
    setTasks(tks || [])
    setKaiserRates(kr || [])
    setLoading(false)
  }

  async function handleLogoUpload(file) {
    if (!file) return
    setLogoUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `logos/${company.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: true })
    if (upErr) { alert('Upload failed: ' + upErr.message); setLogoUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('companies').update({ logo_url: publicUrl }).eq('id', id)
    if (dbErr) { alert('Save failed: ' + dbErr.message); setLogoUploading(false); return }
    setCompany(prev => ({ ...prev, logo_url: publicUrl }))
    setLogoUploading(false)
  }

  async function saveBand() {
    if (!bandVal) { alert('No band selected — please choose a band from the dropdown first.'); return }
    const { error: bandErr } = await supabase.from('companies').update({ band: parseInt(bandVal) }).eq('id', id)
    if (bandErr) { alert('Band save failed: ' + bandErr.message); return }
    setCompany(prev => ({ ...prev, band: parseInt(bandVal) }))
    setBandEdit(false)
    load()
  }

  async function saveSchedule() {
    const { error } = await supabase.from('companies')
      .update({ kaiser_schedule: scheduleVal.toUpperCase() || null }).eq('id', id)
    if (error) { alert('Save failed: ' + error.message); return }
    setCompany(prev => ({ ...prev, kaiser_schedule: scheduleVal.toUpperCase() || null }))
    setScheduleEdit(false)
    load()
  }

  async function toggleKaiserEligible() {
    setSavingEligible(true)
    const newVal = !company.kaiser_eligible
    const { error } = await supabase.from('companies').update({ kaiser_eligible: newVal }).eq('id', id)
    if (error) { alert('Save failed: ' + error.message); setSavingEligible(false); return }
    setCompany(prev => ({ ...prev, kaiser_eligible: newVal }))
    setSavingEligible(false)
  }

  function copyLink() {
    const url = `${window.location.origin}/plans`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function updateTaskStatus(tid, status) {
    await supabase.from('tasks').update({ status }).eq('id', tid)
    load()
  }

  if (loading) return <div className="p-8 text-surface-400">Loading…</div>
  if (!company) return <div className="p-8 text-surface-400">Company not found.</div>

  const comp     = getCompliance(company)
  const planList = (company.plans || []).map(pid => PLAN_MAP[pid]).filter(Boolean)
  const pending  = tasks.filter(t => t.status !== 'complete' && t.status !== 'dismissed')
  const completed= tasks.filter(t => t.status === 'complete')

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'documents', label: 'Documents' },
    ...(isAdmin ? [{ id: 'users', label: 'Users' }] : []),
    ...(company.kaiser_eligible || isAdmin ? [{ id: 'kaiser', label: 'Kaiser Permanente', highlight: company.kaiser_eligible }] : []),
  ]

  return (
    <div className="p-8 page-enter">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/companies" className="btn btn-sm btn-icon"><ArrowLeft size={14}/></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-kiaa-700">{company.name}</h1>
            {company.kaiser_eligible && (
              <span className="badge badge-blue text-xs">Kaiser eligible</span>
            )}
          </div>
          <p className="text-surface-400 text-sm">{company.employee_count} employees &nbsp;·&nbsp; <span className={`status-${company.status}`}>{company.status}</span></p>
        </div>
        <button className="btn" onClick={() => setModal(true)}><Pencil size={14}/> Edit</button>
        <Link to="/enrollment" className="btn btn-teal"><ClipboardCheck size={14}/> Open Enrollment</Link>
        <a href={`/plans?code=${company.company_code}`} target="_blank" rel="noopener noreferrer" className="btn"><Eye size={14}/> Preview portal</a>
        <Link to="/spd" className="btn btn-primary"><FileText size={14}/> Build SPD</Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-surface-100">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'border-kiaa-600 text-kiaa-700'
                : 'border-transparent text-surface-400 hover:text-surface-600'
            }`}
          >
            {t.label}
            {t.highlight && <span className="w-1.5 h-1.5 rounded-full bg-kiaa-400 inline-block"/>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left col */}
          <div className="space-y-5">
            {/* Employee plan link */}
            {company.company_code && (
              <div className="card border-kiaa-200 bg-kiaa-50">
                <h2 className="section-title flex items-center gap-2">
                  <Link2 size={14} className="text-kiaa-600"/> Employee plan link
                </h2>
                <p className="text-xs text-surface-500 mb-3 leading-relaxed">
                  Share this with employees so they can view their plans — no account needed.
                </p>
                <div className="flex items-center gap-2 bg-white border border-kiaa-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-surface-500 flex-shrink-0">URL:</span>
                  <span className="text-xs font-mono text-kiaa-700 flex-1 truncate">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/plans
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white border border-kiaa-200 rounded-lg px-3 py-2 mt-2">
                  <span className="text-xs text-surface-500 flex-shrink-0">Code:</span>
                  <span className="text-2xl font-mono font-bold text-kiaa-700 tracking-widest flex-1">
                    {company.company_code}
                  </span>
                </div>
                <button onClick={copyLink} className="btn btn-teal w-full justify-center mt-3 text-xs">
                  {copied ? <><Check size={13}/> Copied!</> : <><Copy size={13}/> Copy link</>}
                </button>
                <p className="text-xs text-surface-400 mt-2 text-center">
                  Employees go to the URL and enter their code
                </p>
                {/* Logo upload */}
                <div className="mt-3 pt-3 border-t border-kiaa-200">
                  <div className="text-xs font-medium text-kiaa-700 mb-2">Company logo for employee page</div>
                  {company.logo_url && (
                    <div className="flex items-center justify-center bg-white border border-kiaa-200 rounded-lg p-3 mb-2">
                      <img src={company.logo_url} alt="Company logo" className="max-h-16 max-w-full object-contain"/>
                    </div>
                  )}
                  <label className={`btn btn-sm w-full justify-center cursor-pointer ${logoUploading ? 'opacity-50' : ''}`}>
                    {logoUploading
                      ? <><Loader size={13} className="animate-spin"/> Uploading…</>
                      : <><Upload size={13}/> {company.logo_url ? 'Replace logo' : 'Upload logo'}</>}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => handleLogoUpload(e.target.files[0])} disabled={logoUploading}/>
                  </label>
                  <p className="text-xs text-surface-400 mt-1 text-center">PNG, JPG, or SVG · Shown on employee plan page</p>
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="card">
              <h2 className="section-title">Contact</h2>
              {[
                ['Name',    company.contact_name],
                ['Email',   company.contact_email],
                ['Phone',   formatPhone(company.contact_phone)],
                ['Address', [company.address_line1, company.address_line2].filter(Boolean).join(', ')],
                ['City/State/ZIP', [company.city, company.state, company.zip].filter(Boolean).join(', ')],
                ['Renewal', company.renewal_date ? (() => { const [y,m,d] = company.renewal_date.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) })() : null],
                ['Notes',   company.notes],
                ['OE Status', null],
              ].filter(([,v]) => v !== undefined && v !== null && v !== '').map(([k,v]) => (
                <div key={k} className="flex gap-3 text-sm py-1.5 border-b border-surface-50 last:border-0">
                  <span className="text-surface-400 w-20 flex-shrink-0">{k}</span>
                  <span className="text-surface-700">{v}</span>
                </div>
              ))}

              {/* OE Status with unlock button */}
              <div className="flex gap-3 text-sm py-1.5 border-b border-surface-50 items-center">
                <span className="text-surface-400 w-20 flex-shrink-0">OE Status</span>
                <div className="flex items-center gap-2 flex-1">
                  <span className={`badge ${
                    company.oe_status === 'confirmed' ? 'badge-green' :
                    company.oe_status === 'submitted' ? 'badge-amber' :
                    'badge-gray'
                  }`}>
                    {company.oe_status ? company.oe_status.charAt(0).toUpperCase() + company.oe_status.slice(1) : 'Pending'}
                  </span>
                  {company.oe_status && company.oe_status !== 'pending' && profile?.role === 'super_admin' && (
                    <button
                      className="text-xs text-surface-400 hover:text-red-500 underline transition-colors"
                      onClick={async () => {
                        if (!confirm(`Reset OE status to Pending for ${company.name}? This will allow plan elections to be changed.`)) return
                        const { error } = await supabase
                          .from('companies')
                          .update({ oe_status: 'pending' })
                          .eq('id', company.id)
                        if (!error) setCompany(c => ({ ...c, oe_status: 'pending' }))
                      }}>
                      Reset to Pending
                    </button>
                  )}
                </div>
              </div>

              {[
                ['Group type', company.group_type ? (({'merit_rated':'Merit Rated Group (MRG)','aca_small_group':'ACA Small Group (ACA)'})[company.group_type] || company.group_type) : null],
                ['ACA Quarter', company.group_type === 'aca_small_group' ? (company.aca_quarter || 'Not set') : null],
                ['HMSA Group #', company.hmsa_group_no],
                ['Kaiser Group #', company.kaiser_group_no],
              ].filter(([,v]) => v).map(([k,v]) => (
                <div key={k} className="flex gap-3 text-sm py-1.5 border-b border-surface-50 last:border-0">
                  <span className="text-surface-400 w-20 flex-shrink-0">{k}</span>
                  <span className="text-surface-700">{v}</span>
                </div>
              ))}

              {/* ACA OE Window — editable by admin */}
              {company.group_type === 'aca_small_group' && (
                <div className="mt-3 pt-3 border-t border-surface-100">
                  <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                    ACA Open Enrollment window
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: 'oe_open_date',       label: 'OE opens',             help: 'Date HR portal OE becomes available' },
                      { key: 'oe_close_date',      label: 'OE closes',            help: 'Last day HR can submit elections' },
                      { key: 'plan_effective_date',label: 'Plan effective date',   help: 'New plan year start date for this company' },
                    ].map(({ key, label, help }) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-surface-400 text-xs w-32 flex-shrink-0">{label}</span>
                        <div className="flex-1">
                          <input type="date" className="input text-sm py-1.5"
                            value={company[key] || ''}
                            onChange={async e => {
                              const val = e.target.value || null
                              const { error } = await supabase
                                .from('companies').update({ [key]: val }).eq('id', company.id)
                              if (!error) setCompany(c => ({ ...c, [key]: val }))
                            }}/>
                          <p className="text-xs text-surface-400 mt-0.5">{help}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {company.oe_open_date && company.oe_close_date && (
                    <div className="mt-3 flex items-center gap-2 bg-kiaa-50 border border-kiaa-100 rounded-xl px-3 py-2 text-xs text-kiaa-700">
                      <span>📅</span>
                      <span>
                        OE window: <strong>{new Date(company.oe_open_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</strong>
                        {' → '}
                        <strong>{new Date(company.oe_close_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</strong>
                        {company.plan_effective_date && (
                          <> · Effective <strong>{new Date(company.plan_effective_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</strong></>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Benefits contact (employee-facing) */}
              {(company.benefits_contact_name || company.benefits_contact_email || company.benefits_contact_phone) && (
                <div className="mt-2 pt-2 border-t border-surface-100">
                  <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1.5">
                    Benefits contact <span className="font-normal normal-case">(shown on /plans)</span>
                  </div>
                  {[
                    ['Name',  company.benefits_contact_name],
                    ['Email', company.benefits_contact_email],
                    ['Phone', formatPhone(company.benefits_contact_phone)],
                  ].filter(([,v]) => v).map(([k,v]) => (
                    <div key={k} className="flex gap-3 text-sm py-1 border-b border-surface-50 last:border-0">
                      <span className="text-surface-400 w-20 flex-shrink-0">{k}</span>
                      <span className="text-surface-700">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* HMSA Band */}
              <div className="flex gap-3 text-sm py-1.5 items-center border-b border-surface-50">
                <span className="text-surface-400 w-20 flex-shrink-0">HMSA Band</span>
                {bandEdit ? (
                  <div className="flex items-center gap-2">
                    <select className="input py-0.5 text-sm w-24" value={bandVal}
                      onChange={e => setBandVal(e.target.value)} autoFocus>
                      <option value="">— none —</option>
                      {[1,2,3,4,5,6,7,8].map(b => <option key={b} value={b}>Band {b}</option>)}
                      <option value={9}>Band 9 — Riders Only</option>
                    </select>
                    <button className="btn btn-sm btn-primary py-0.5" onClick={saveBand}>Save</button>
                    <button className="btn btn-sm py-0.5" onClick={() => setBandEdit(false)}>Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {company.band
                      ? <span className="badge badge-aqua font-semibold">Band {company.band}{company.band === 9 ? ' — Riders Only' : ''}</span>
                      : <span className="text-amber-600 text-xs">Not assigned</span>}
                    {isAdmin && (
                      <button className="text-xs text-kiaa-500 hover:text-kiaa-700 underline"
                        onClick={() => { setBandVal(company.band ? String(company.band) : ''); setBandEdit(true) }}>
                        {company.band ? 'Change' : 'Set band'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Kaiser eligible toggle */}
              {isAdmin && (
                <div className="flex gap-3 text-sm py-1.5 items-center">
                  <span className="text-surface-400 w-20 flex-shrink-0">Kaiser</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleKaiserEligible}
                      disabled={savingEligible}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        company.kaiser_eligible ? 'bg-kiaa-500' : 'bg-surface-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                        company.kaiser_eligible ? 'translate-x-4' : 'translate-x-0'
                      }`}/>
                    </button>
                    <span className="text-xs text-surface-500">
                      {company.kaiser_eligible ? 'Kaiser eligible' : 'HMSA only'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Employee count */}
            <div className="card">
              <h2 className="section-title flex items-center gap-2">
                <Calculator size={14} className="text-kiaa-600"/> Employee count
              </h2>
              {company.ft_employees != null ? (
                <div className="space-y-1.5 text-sm">
                  {[
                    ['Full-time (30+ hrs/wk)', company.ft_employees, 'employees'],
                    ['Part-time', company.pt_employees
                      ? `${company.pt_employees} employees @ ${company.pt_avg_hrs || '?'} hrs/wk avg` : null, ''],
                    ['Seasonal', company.seasonal_employees
                      ? `${company.seasonal_employees} employees @ ${company.seasonal_avg_hrs || '?'} hrs/wk avg` : null, ''],
                  ].filter(([,v]) => v != null && v !== '' && v !== 0).map(([k,v,u]) => (
                    <div key={k} className="flex gap-3 py-1.5 border-b border-surface-50 last:border-0">
                      <span className="text-surface-400 flex-1">{k}</span>
                      <span className="text-surface-700 font-medium">{v}{u ? ' ' + u : ''}</span>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-t border-surface-100 grid grid-cols-2 gap-2">
                    <div className="bg-kiaa-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-surface-400">FTE count</div>
                      <div className="text-base font-semibold text-kiaa-700">{company.fte_count ?? company.employee_count}</div>
                      <div className="text-xs text-surface-400">for COBRA</div>
                    </div>
                    <div className="bg-surface-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-surface-400">Headcount</div>
                      <div className="text-base font-semibold text-surface-700">{company.headcount ?? company.employee_count}</div>
                      <div className="text-xs text-surface-400">for FMLA</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-surface-400 italic">
                  No worksheet data — edit company to enter employee figures.
                </div>
              )}
            </div>

            {/* Compliance */}
            <div className="card">
              <h2 className="section-title">Compliance</h2>
              <div className="space-y-2">
                {[
                  { label:'Federal COBRA',   req: comp.fedCobra.required,  sub: comp.fedCobra.note },
                  { label:'HI State Continuation',   req: comp.hiCobra.required,   note:'May apply', sub: '' },
                  { label:'Federal FMLA',    req: comp.fmla.required,      sub: comp.fmla.note },
                  { label:'ERISA Form 5500', req: comp.erisa5500.required, sub: comp.erisa5500.note },
                  { label:'Hawaii PHCA',     req: true,  sub: 'All HI employers' },
                  { label:'Hawaii TDI',      req: true,  sub: 'All HI employers' },
                ].map(({ label, req, note, sub }) => (
                  <div key={label} className="py-1.5 border-b border-surface-50 last:border-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-surface-600">{label}</span>
                      {req
                        ? <span className={`badge ${note ? 'badge-blue' : 'badge-amber'}`}>{note || 'Required'}</span>
                        : <span className="badge badge-green">Exempt</span>}
                    </div>
                    {sub && <div className="text-xs text-surface-400 mt-0.5">{sub}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="lg:col-span-2 space-y-5">
            {/* Plans */}
            <div className="card">
              <h2 className="section-title">Enrolled plans</h2>
              {company.group_type === 'aca_small_group' ? (
                <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5 text-sm text-kiaa-700">
                  <span>ℹ</span>
                  <div>
                    <div className="font-semibold mb-0.5">ACA Small Group</div>
                    <div className="text-xs text-kiaa-600">Plan elections managed through Open Enrollment. Age-based premiums · Full Package incl. Riders.</div>
                  </div>
                </div>
              ) : planList.length === 0 && !company.kaiser_eligible ? (
                <p className="text-surface-400 text-sm">No plans assigned yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {planList.map(p => {
                    const isRiders = p.id === 'kiaa_riders'
                    return (
                      <div key={p.id} className="border border-surface-100 rounded-xl p-3 text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-surface-700">{p.name}</span>
                          <span className="badge badge-aqua">{p.type}</span>
                        </div>
                        <div className="text-xs text-surface-500 space-y-0.5">
                          {isRiders ? (
                            <div>Vision · Dental · Group Life/AD&amp;D</div>
                          ) : (
                            <>
                              <div>Deductible: {p.deductible} &nbsp;·&nbsp; OOP: {p.oopMedical}</div>
                              <div>PCP: {p.pcp} &nbsp;·&nbsp; ER: {p.er}</div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {/* Kaiser plans */}
                  {company.kaiser_eligible && kaiserRates.length > 0 && (
                    <>
                      {[...new Set(kaiserRates.map(r => `${r.kaiser_plan_no}_${r.package_type}`))].map(key => {
                        const row = kaiserRates.find(r => `${r.kaiser_plan_no}_${r.package_type}` === key)
                        const isFull = row.package_type === 'full'
                        return (
                          <div key={key} className="border border-blue-100 bg-blue-50/30 rounded-xl p-3 text-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-surface-700">
                                Kaiser Permanente {row.kaiser_plan_no} {isFull ? 'Full Package' : 'Med/Rx Package'}
                              </span>
                              <span className="badge badge-amber text-xs">HMO</span>
                              <span className="badge badge-blue text-xs">Kaiser</span>
                            </div>
                            <div className="text-xs text-surface-500 space-y-0.5">
                              <div>
                                Single {row.premium_single ? `$${parseFloat(row.premium_single).toFixed(2)}` : '—'} &nbsp;·&nbsp;
                                2-Party {row.premium_two_party ? `$${parseFloat(row.premium_two_party).toFixed(2)}` : '—'} &nbsp;·&nbsp;
                                Family {row.premium_family ? `$${parseFloat(row.premium_family).toFixed(2)}` : '—'}
                              </div>
                              {isFull && <div>Includes HMSA Vision · Dental · Group Life/AD&amp;D</div>}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                  {company.kaiser_eligible && kaiserRates.length === 0 && (
                    <div className="border border-blue-100 rounded-xl p-3 text-sm text-surface-400 italic">
                      Kaiser eligible — no rates loaded yet
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tasks */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title mb-0">Tasks &amp; reminders</h2>
                <Link to="/renewals" className="btn btn-sm"><Plus size={13}/> Add task</Link>
              </div>
              {pending.length === 0 && completed.length === 0 ? (
                <p className="text-surface-400 text-sm">No tasks yet.</p>
              ) : (
                <div className="space-y-2">
                  {pending.map(t => (
                    <div key={t.id} className="flex items-center gap-3 border border-surface-100 rounded-lg px-3 py-2.5">
                      <button onClick={() => updateTaskStatus(t.id,'complete')} className="text-surface-300 hover:text-kiaa-500 transition-colors flex-shrink-0">
                        <CheckCircle size={16}/>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-surface-700">{t.title}</div>
                      </div>
                      <span className={`badge badge-gray text-xs`}>{t.category}</span>
                      {t.due_date && <span className="text-xs text-surface-400">{new Date(t.due_date).toLocaleDateString()}</span>}
                    </div>
                  ))}
                  {completed.slice(0,3).map(t => (
                    <div key={t.id} className="flex items-center gap-3 border border-surface-50 rounded-lg px-3 py-2 opacity-50">
                      <CheckCircle size={16} className="text-kiaa-400 flex-shrink-0"/>
                      <span className="text-sm text-surface-500 line-through">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === 'documents' && (
        <div className="max-w-2xl space-y-5">
          {/* Digital enrollment packet */}
          <div className="card">
            <EnrollmentPacket
              company={company}
              planYear={PLAN_YEAR}
              kaiserRates={kaiserRates}
              kaiserElections={{}}
            />
          </div>
          {/* Upload / manage documents */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2">
              <FolderOpen size={14} className="text-kiaa-600"/> Manage documents
            </h2>
            <CompanyDocuments company={company} kaiserRates={kaiserRates} planYear={PLAN_YEAR}/>
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === 'users' && (
        <div className="max-w-2xl">
          <div className="card">
            <h2 className="section-title flex items-center gap-2">
              <Users size={14} className="text-kiaa-600"/> HR users
            </h2>
            <CompanyUsers company={company}/>
          </div>
        </div>
      )}

      {/* ── KAISER TAB ── */}
      {activeTab === 'kaiser' && (
        <div className="max-w-2xl space-y-5">

          {/* Kaiser eligible toggle */}
          <div className="card">
            <h2 className="section-title flex items-center gap-2">
              <Zap size={14} className="text-kiaa-600"/> Kaiser Permanente Eligibility
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-surface-700 font-medium">
                  {company.kaiser_eligible ? 'This company offers Kaiser Permanente plans' : 'Kaiser Permanente not enabled'}
                </div>
                <div className="text-xs text-surface-400 mt-0.5">
                  {company.kaiser_eligible
                    ? 'Upload the Kaiser pricing sheet PDF below to load rates.'
                    : 'Enable to allow Kaiser plan elections for this company.'}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={toggleKaiserEligible}
                  disabled={savingEligible}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    company.kaiser_eligible ? 'bg-kiaa-500' : 'bg-surface-200'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    company.kaiser_eligible ? 'translate-x-5' : 'translate-x-0'
                  }`}/>
                </button>
              )}
            </div>
          </div>

          {company.kaiser_eligible && (
            <>
              {/* Schedule assignment */}
              {isAdmin && (
                <div className="card">
                  <h2 className="section-title">Kaiser Schedule</h2>
                  <p className="text-xs text-surface-400 mb-3">
                    The Schedule letter assigned by Kaiser on this company's pricing sheet (e.g. "B").
                    This is a reference label — rates are stored per-company, not shared.
                  </p>
                  {scheduleEdit ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text" maxLength={4}
                        value={scheduleVal}
                        onChange={e => setScheduleVal(e.target.value.toUpperCase())}
                        className="input w-20 font-mono text-center uppercase text-lg font-bold"
                        placeholder="B"
                        autoFocus
                      />
                      <button className="btn btn-primary btn-sm" onClick={saveSchedule}>Save</button>
                      <button className="btn btn-sm" onClick={() => setScheduleEdit(false)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {company.kaiser_schedule
                        ? <span className="badge badge-aqua font-mono text-lg px-4 py-1 font-bold">Schedule {company.kaiser_schedule}</span>
                        : <span className="text-amber-600 text-sm">Not assigned</span>}
                      <button
                        className="text-xs text-kiaa-500 hover:text-kiaa-700 underline"
                        onClick={() => { setScheduleVal(company.kaiser_schedule || ''); setScheduleEdit(true) }}
                      >
                        {company.kaiser_schedule ? 'Change' : 'Set schedule'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* PDF Upload */}
              {isAdmin && (
                <div className="card">
                  <h2 className="section-title flex items-center gap-2">
                    <Upload size={14} className="text-kiaa-600"/> Upload Kaiser Pricing Sheet
                  </h2>
                  <p className="text-xs text-surface-400 mb-4">
                    Upload the Schedule PDF from Kaiser. Rates will be extracted automatically and saved to this company.
                    You can review and edit before saving.
                  </p>
                  <KaiserRateUploader company={company} onRatesExtracted={load} planYear={PLAN_YEAR}/>
                </div>
              )}

              {/* Rate table */}
              <div className="card">
                <h2 className="section-title">Kaiser Rates — {oePlanYear}</h2>
                {kaiserRates.length === 0 ? (
                  <div className="text-sm text-surface-400 italic">
                    No Kaiser rates loaded yet. Upload the pricing sheet PDF above.
                  </div>
                ) : (
                  <KaiserRateTable rates={kaiserRates} schedule={company.kaiser_schedule}/>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {modal && <CompanyModal company={company} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }}/>}
    </div>
  )
}
