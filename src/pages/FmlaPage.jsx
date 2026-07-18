import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCompliance } from '@/lib/compliance'
import {
  generateFmlaGeneralNoticeHtml,
  generateFmlaEligibilityNoticeHtml,
  generateFmlaDesignationNoticeHtml,
  generateFmlaMedCertRequestHtml,
  INELIGIBLE_REASONS,
  LEAVE_REASONS,
} from '@/lib/fmlaHtmlGenerator'
import { FileDown, AlertTriangle, Info, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

const NOTICE_TYPES = [
  {
    id:       'general',
    label:    'General Notice',
    sub:      'Post at each worksite + include in handbook',
    deadline: 'Always required — no specific deadline',
    law:      '29 CFR § 825.300(a)',
    color:    'border-kiaa-300 bg-kiaa-50',
    activeColor: 'border-kiaa-600 bg-kiaa-600',
  },
  {
    id:       'eligibility',
    label:    'Eligibility & Rights Notice',
    sub:      'Sent to specific employee upon leave request',
    deadline: 'Within 5 business days of leave request',
    law:      '29 CFR § 825.300(b)(c)',
    color:    'border-surface-200 bg-white',
    activeColor: 'border-kiaa-600 bg-kiaa-600',
  },
  {
    id:       'designation',
    label:    'Designation Notice',
    sub:      'Employer\'s official FMLA determination',
    deadline: 'Within 5 business days of sufficient information',
    law:      '29 CFR § 825.300(d)',
    color:    'border-surface-200 bg-white',
    activeColor: 'border-kiaa-600 bg-kiaa-600',
  },
  {
    id:       'medcert',
    label:    'Medical Certification Request',
    sub:      'Request certification from healthcare provider',
    deadline: 'Within 5 business days; employee has 15 days to return',
    law:      '29 CFR § 825.305',
    color:    'border-surface-200 bg-white',
    activeColor: 'border-kiaa-600 bg-kiaa-600',
  },
]

function Section({ title, open, onToggle, children }) {
  return (
    <div className="border border-surface-100 rounded-xl overflow-hidden mb-3">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-surface-50 hover:bg-kiaa-50 transition-colors text-left"
        onClick={onToggle}>
        <span className="font-medium text-surface-700 text-sm">{title}</span>
        {open ? <ChevronUp size={14} className="text-surface-400"/> : <ChevronDown size={14} className="text-surface-400"/>}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}

function today() {
  return new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
}
function todayISO() { return new Date().toISOString().split('T')[0] }
function addBusinessDays(n) {
  const d = new Date(); let added = 0
  while (added < n) { d.setDate(d.getDate()+1); if (d.getDay()!==0&&d.getDay()!==6) added++ }
  return d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})
}
function addCalDays(n) {
  const d = new Date(); d.setDate(d.getDate()+n)
  return d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})
}
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})
}
function safeName(s) { return (s||'').replace(/[^a-zA-Z0-9]/g,'_') }
function download(html, filename) {
  const blob = new Blob([html],{type:'text/html;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

export default function FmlaPage() {
  const [companies, setCompanies] = useState([])
  const [selected,  setSelected]  = useState('')
  const [noticeType,setNoticeType]= useState('general')
  const [sections,  setSections]  = useState({ company:true, employee:true, leave:true, details:true })

  // Employee fields
  const [emp, setEmp] = useState({ name:'', address:'', city:'', state:'HI', zip:'', dob:'' })

  // Leave fields
  const [leaveReason,     setLeaveReason]     = useState(LEAVE_REASONS[5])
  const [leaveStartDate,  setLeaveStartDate]  = useState(todayISO())
  const [leaveEndDate,    setLeaveEndDate]     = useState('')
  const [noticeDate,      setNoticeDate]       = useState(todayISO())

  // Eligibility fields
  const [isEligible,      setIsEligible]      = useState(true)
  const [ineligibleReas,  setIneligibleReas]  = useState([])
  const [isContinuous,    setIsContinuous]    = useState(true)
  const [isIntermittent,  setIsIntermittent]  = useState(false)
  const [isReduced,       setIsReduced]       = useState(false)
  const [medCertReq,      setMedCertReq]      = useState(true)
  const [paidLeaveReq,    setPaidLeaveReq]    = useState(false)
  const [paidLeaveTypes,  setPaidLeaveTypes]  = useState('vacation, sick leave')

  // Designation fields
  const [isDesignated,    setIsDesignated]    = useState(true)
  const [notDesigReason,  setNotDesigReason]  = useState('')
  const [weeksApproved,   setWeeksApproved]   = useState('')
  const [returnDate,      setReturnDate]      = useState('')
  const [fitnessCert,     setFitnessCert]     = useState(false)

  // Med cert fields
  const [certType, setCertType] = useState('employee')

  useEffect(() => {
    supabase.from('companies').select('*').order('name')
      .then(({ data }) => setCompanies(data||[]))
  }, [])

  const company    = companies.find(c => c.id === selected)
  const comp       = company ? getCompliance(company) : null
  const fmlaApplies = comp?.fmla?.required

  const noticeDateFmt = fmtDate(noticeDate) || today()
  const generatedDate = today()
  const medCertDue    = addCalDays(15)
  const eligDeadline  = addBusinessDays(5)

  function toggle(key) { setSections(s => ({...s, [key]: !s[key]})) }
  function setEmpField(k,v) { setEmp(e => ({...e, [k]:v})) }
  function toggleReason(r) {
    setIneligibleReas(s => s.includes(r) ? s.filter(x=>x!==r) : [...s, r])
  }

  function handleDownload() {
    if (!company) return
    const shared = { company, noticeDate: noticeDateFmt, generatedDate }
    const empData = { ...emp }
    const leaveFmt = fmtDate(leaveStartDate)
    const endFmt   = fmtDate(leaveEndDate)

    if (noticeType === 'general') {
      download(
        generateFmlaGeneralNoticeHtml(shared),
        `FMLA_General_Notice_${safeName(company.name)}_${new Date().getFullYear()}.html`
      )
    } else if (noticeType === 'eligibility') {
      download(
        generateFmlaEligibilityNoticeHtml({
          ...shared, employee: empData,
          isEligible, ineligibleReasons: ineligibleReas.map(r => INELIGIBLE_REASONS.find(x=>x.value===r)?.label),
          leaveReason, leaveStartDate: leaveFmt, leaveEndDate: endFmt,
          isContinuous, isIntermittent, isReducedSchedule: isReduced,
          medCertRequired: medCertReq, medCertDueDate: medCertDue,
          paidLeaveRequired: paidLeaveReq, paidLeaveTypes,
        }),
        `FMLA_Eligibility_Notice_${safeName(emp.name||'Employee')}_${new Date().getFullYear()}.html`
      )
    } else if (noticeType === 'designation') {
      download(
        generateFmlaDesignationNoticeHtml({
          ...shared, employee: empData,
          isDesignated, notDesignatedReason: notDesigReason,
          leaveReason, leaveStartDate: leaveFmt, leaveEndDate: endFmt,
          weeksApproved, returnToWorkDate: fmtDate(returnDate),
          fitnessForDutyRequired: fitnessCert,
          paidLeaveRequired: paidLeaveReq, paidLeaveTypes,
        }),
        `FMLA_Designation_Notice_${safeName(emp.name||'Employee')}_${new Date().getFullYear()}.html`
      )
    } else if (noticeType === 'medcert') {
      download(
        generateFmlaMedCertRequestHtml({
          ...shared, employee: empData,
          certType, leaveReason, leaveStartDate: leaveFmt,
          certDueDate: medCertDue,
        }),
        `FMLA_MedCert_Request_${safeName(emp.name||'Employee')}_${new Date().getFullYear()}.html`
      )
    }
  }

  const needsEmployee = noticeType !== 'general'
  const canDownload   = company && (noticeType === 'general' || emp.name.trim())

  return (
    <div className="p-8 page-enter max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">FMLA Notice Builder</h1>
        <p className="text-surface-400 text-sm mt-0.5">Generate all four federally required FMLA notices</p>
      </div>

      {/* Info card */}
      <div className="card bg-kiaa-50 border-kiaa-200 mb-6">
        <div className="flex gap-3">
          <Info size={15} className="text-kiaa-600 flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-kiaa-700 space-y-1">
            <div><strong>General Notice</strong> — Post at every worksite + include in handbook. No specific deadline.</div>
            <div><strong>Eligibility & Rights</strong> — Sent to employee within <strong>5 business days</strong> of leave request.</div>
            <div><strong>Designation Notice</strong> — Official FMLA determination within <strong>5 business days</strong> of sufficient information.</div>
            <div><strong>Medical Certification</strong> — Request within 5 business days; employee has <strong>15 calendar days</strong> to return.</div>
            <div className="text-xs text-kiaa-600 pt-0.5">Federal FMLA applies to employers with 50+ employees | 29 CFR § 825.300</div>
          </div>
        </div>
      </div>

      {/* Step 1: Company */}
      <Section title="Step 1 — Select company" open={sections.company} onToggle={() => toggle('company')}>
        <div>
          <label className="label">Company</label>
          <select className="input" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">— choose a company —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.headcount || c.employee_count} employees)</option>)}
          </select>
        </div>
        {company && !fmlaApplies && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-amber-600"/>
            <div><strong>{company.name}</strong> has fewer than 50 employees — federal FMLA does not apply.
            Hawaii TDI and PHCA still apply. Consult Hawaii DLIR at (808) 586-8844 for state leave requirements.</div>
          </div>
        )}
      </Section>

      {/* Step 2: Notice type */}
      <Section title="Step 2 — Notice type" open={true} onToggle={() => {}}>
        <div className="grid grid-cols-2 gap-3">
          {NOTICE_TYPES.map(t => (
            <button key={t.id} onClick={() => setNoticeType(t.id)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                noticeType === t.id ? 'border-kiaa-600 bg-kiaa-50' : 'border-surface-200 bg-white hover:border-kiaa-300'
              }`}>
              <div className={`font-medium text-sm mb-1 ${noticeType === t.id ? 'text-kiaa-700' : 'text-surface-700'}`}>{t.label}</div>
              <div className="text-xs text-surface-400 mb-1">{t.sub}</div>
              <div className={`text-xs font-medium ${noticeType === t.id ? 'text-kiaa-600' : 'text-amber-600'}`}>{t.deadline}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Step 3: Date */}
      <Section title="Step 3 — Notice date" open={sections.leave} onToggle={() => toggle('leave')}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date of this notice</label>
            <input className="input" type="date" value={noticeDate} onChange={e => setNoticeDate(e.target.value)}/>
          </div>
          {noticeType !== 'general' && (
            <div>
              <label className="label">Auto-calculated deadline</label>
              <input className="input bg-surface-100 cursor-default"
                value={noticeType === 'medcert' ? `Employee must return by: ${medCertDue}` : `Due: ${eligDeadline}`}
                readOnly/>
            </div>
          )}
        </div>
      </Section>

      {/* Employee info (all except general) */}
      {needsEmployee && (
        <Section title="Step 4 — Employee information" open={sections.employee} onToggle={() => toggle('employee')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Employee full name *</label>
              <input className="input" value={emp.name} onChange={e => setEmpField('name',e.target.value)} placeholder="Jane Doe"/>
            </div>
            <div className="col-span-2">
              <label className="label">Mailing address</label>
              <input className="input" value={emp.address} onChange={e => setEmpField('address',e.target.value)} placeholder="123 Kamehameha Ave"/>
            </div>
            <div><label className="label">City</label><input className="input" value={emp.city} onChange={e => setEmpField('city',e.target.value)} placeholder="Hilo"/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">State</label><input className="input" value={emp.state} onChange={e => setEmpField('state',e.target.value)} maxLength={2}/></div>
              <div><label className="label">ZIP</label><input className="input" value={emp.zip} onChange={e => setEmpField('zip',e.target.value)} placeholder="96720"/></div>
            </div>
          </div>
        </Section>
      )}

      {/* Leave details (all except general) */}
      {needsEmployee && (
        <Section title="Step 5 — Leave details" open={sections.details} onToggle={() => toggle('details')}>
          <div>
            <label className="label">Reason for leave</label>
            <select className="input" value={leaveReason} onChange={e => setLeaveReason(e.target.value)}>
              {LEAVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Leave start date</label>
              <input className="input" type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)}/></div>
            <div><label className="label">Expected return date</label>
              <input className="input" type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)}/></div>
          </div>

          {/* Eligibility-specific */}
          {noticeType === 'eligibility' && (
            <>
              <div>
                <label className="label">Eligibility determination</label>
                <div className="flex gap-3 mt-1">
                  {[{v:true,l:'Eligible'},{v:false,l:'Not eligible'}].map(({v,l}) => (
                    <button key={l} onClick={() => setIsEligible(v)}
                      className={`btn btn-sm ${isEligible===v ? 'btn-primary' : ''}`}>{l}</button>
                  ))}
                </div>
              </div>
              {!isEligible && (
                <div>
                  <label className="label">Reason(s) not eligible</label>
                  {INELIGIBLE_REASONS.map(r => (
                    <label key={r.value} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                      <input type="checkbox" checked={ineligibleReas.includes(r.value)}
                        onChange={() => toggleReason(r.value)}/>
                      {r.label}
                    </label>
                  ))}
                </div>
              )}
              <div>
                <label className="label">Leave type</label>
                <div className="flex gap-3 mt-1 flex-wrap">
                  {[
                    [isContinuous,   setIsContinuous,   'Continuous block'],
                    [isIntermittent, setIsIntermittent, 'Intermittent'],
                    [isReduced,      setIsReduced,      'Reduced schedule'],
                  ].map(([val, setter, label]) => (
                    <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)}/>{label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Medical certification required?</label>
                  <div className="flex gap-3 mt-1">
                    {[{v:true,l:'Yes'},{v:false,l:'No'}].map(({v,l}) => (
                      <button key={l} onClick={() => setMedCertReq(v)}
                        className={`btn btn-sm ${medCertReq===v ? 'btn-primary' : ''}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Paid leave required concurrently?</label>
                  <div className="flex gap-3 mt-1">
                    {[{v:true,l:'Yes'},{v:false,l:'No'}].map(({v,l}) => (
                      <button key={l} onClick={() => setPaidLeaveReq(v)}
                        className={`btn btn-sm ${paidLeaveReq===v ? 'btn-primary' : ''}`}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              {paidLeaveReq && (
                <div>
                  <label className="label">Paid leave types</label>
                  <input className="input" value={paidLeaveTypes} onChange={e => setPaidLeaveTypes(e.target.value)} placeholder="vacation, sick leave"/>
                </div>
              )}
            </>
          )}

          {/* Designation-specific */}
          {noticeType === 'designation' && (
            <>
              <div>
                <label className="label">FMLA designation</label>
                <div className="flex gap-3 mt-1">
                  {[{v:true,l:'Designated as FMLA-protected'},{v:false,l:'NOT designated'}].map(({v,l}) => (
                    <button key={l} onClick={() => setIsDesignated(v)}
                      className={`btn btn-sm ${isDesignated===v ? 'btn-primary' : ''}`}>{l}</button>
                  ))}
                </div>
              </div>
              {!isDesignated && (
                <div>
                  <label className="label">Reason not designated</label>
                  <input className="input" value={notDesigReason} onChange={e => setNotDesigReason(e.target.value)} placeholder="e.g. condition does not qualify as serious health condition"/>
                </div>
              )}
              {isDesignated && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Weeks of FMLA approved</label>
                    <input className="input" type="number" min="1" max="26" value={weeksApproved} onChange={e => setWeeksApproved(e.target.value)} placeholder="e.g. 6"/>
                  </div>
                  <div>
                    <label className="label">Expected return to work</label>
                    <input className="input" type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}/>
                  </div>
                  <div>
                    <label className="label">Paid leave concurrent?</label>
                    <div className="flex gap-3 mt-1">
                      {[{v:true,l:'Yes'},{v:false,l:'No'}].map(({v,l}) => (
                        <button key={l} onClick={() => setPaidLeaveReq(v)}
                          className={`btn btn-sm ${paidLeaveReq===v ? 'btn-primary' : ''}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Fitness-for-duty cert. required?</label>
                    <div className="flex gap-3 mt-1">
                      {[{v:true,l:'Yes'},{v:false,l:'No'}].map(({v,l}) => (
                        <button key={l} onClick={() => setFitnessCert(v)}
                          className={`btn btn-sm ${fitnessCert===v ? 'btn-primary' : ''}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Med cert specific */}
          {noticeType === 'medcert' && (
            <div>
              <label className="label">Certification type</label>
              <div className="flex gap-3 mt-1">
                {[{v:'employee',l:'Employee\'s own condition (WH-380-E)'},{v:'family',l:'Family member\'s condition (WH-380-F)'}].map(({v,l}) => (
                  <button key={v} onClick={() => setCertType(v)}
                    className={`btn btn-sm ${certType===v ? 'btn-primary' : ''}`}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Generate */}
      <div className="card mt-2">
        <h2 className="section-title">Generate notice</h2>
        <button className="btn btn-teal" onClick={handleDownload} disabled={!canDownload}>
          <FileDown size={15}/>
          Download {NOTICE_TYPES.find(t => t.id === noticeType)?.label}
        </button>
        <p className="text-xs text-surface-400 mt-3">
          Opens in any browser — use File → Print → Save as PDF for a letter-size document.
          {!company && <span className="text-amber-600"> Select a company to enable download.</span>}
          {company && needsEmployee && !emp.name.trim() && <span className="text-amber-600"> Enter the employee's name to enable download.</span>}
        </p>
      </div>
    </div>
  )
}
