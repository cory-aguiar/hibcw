import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PLAN_MAP } from '@/lib/plans'
import { getCompliance } from '@/lib/compliance'
import {
  generateCobraInitialNoticeHtml,
  generateCobraElectionNoticeHtml,
  QUALIFYING_EVENTS,
} from '@/lib/cobraHtmlGenerator'
import {
  FileDown, AlertTriangle, Info, Plus, Trash2, ChevronDown, ChevronUp
} from 'lucide-react'

function addDays(dateStr, days) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function today() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Pacific/Honolulu' })
}

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' })
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-surface-100 rounded-xl overflow-hidden mb-4">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-50 hover:bg-kiaa-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-medium text-surface-700 text-sm">{title}</span>
        {open ? <ChevronUp size={14} className="text-surface-400"/> : <ChevronDown size={14} className="text-surface-400"/>}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}

export default function CobraPage() {
  const [companies, setCompanies]     = useState([])
  const [selected,  setSelected]      = useState('')
  const [noticeType,setNoticeType]    = useState('election') // 'initial' | 'election'

  // Election notice fields
  const [participant, setParticipant] = useState({
    name: '', address: '', city: '', state: 'HI', zip: '', dob: '',
  })
  const [dependents,  setDependents]  = useState([])
  const [qEvent,      setQEvent]      = useState('termination')
  const [eventDate,   setEventDate]   = useState(todayISO())
  const [coverageLostDate, setCovLost]= useState('')
  const [noticeDate,  setNoticeDate]  = useState(todayISO())

  useEffect(() => {
    supabase.from('companies').select('*').order('name')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  const company   = companies.find(c => c.id === selected)
  const planList  = (company?.plans || []).map(pid => PLAN_MAP[pid]).filter(Boolean)
  const comp      = company ? getCompliance(company) : null
  const cobraApplies = comp?.fedCobra?.required

  // Auto-calc election deadline (60 days from notice date)
  const electionDeadline = noticeDate ? addDays(noticeDate, 60) : ''
  const noticeDateFmt    = noticeDate
    ? (() => { const [y,m,d] = (noticeDate||'').split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) })()
    : today()
  const generatedDate = today()

  function setParticipantField(key, val) {
    setParticipant(p => ({ ...p, [key]: val }))
  }

  function addDependent() {
    setDependents(d => [...d, { name: '', relationship: 'Spouse', dob: '' }])
  }

  function updateDependent(i, key, val) {
    setDependents(d => d.map((dep, idx) => idx === i ? { ...dep, [key]: val } : dep))
  }

  function removeDependent(i) {
    setDependents(d => d.filter((_, idx) => idx !== i))
  }

  function downloadInitial() {
    if (!company) return
    const html = generateCobraInitialNoticeHtml({
      company, planList, noticeDate: noticeDateFmt, generatedDate
    })
    download(html, `COBRA_Initial_Notice_${safeName(company.name)}_${new Date().getFullYear()}.html`)
  }

  function downloadElection() {
    if (!company || !participant.name) return
    const eventDateFmt = eventDate
      ? (() => { const [y,m,d] = (eventDate||'').split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) })()
      : ''
    const covLostFmt = coverageLostDate
      ? (() => { const [y,m,d] = (coverageLostDate||'').split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) })()
      : ''
    const html = generateCobraElectionNoticeHtml({
      company, planList,
      participant: { ...participant, dependents },
      qualifyingEvent: qEvent,
      eventDate: eventDateFmt,
      coverageLostDate: covLostFmt,
      electionDeadline,
      noticeDate: noticeDateFmt,
      generatedDate,
    })
    download(html, `COBRA_Election_Notice_${safeName(participant.name)}_${new Date().getFullYear()}.html`)
  }

  function download(html, filename) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function safeName(s) {
    return (s || '').replace(/[^a-zA-Z0-9]/g, '_')
  }

  return (
    <div className="p-8 page-enter max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">COBRA Notice Builder</h1>
        <p className="text-surface-400 text-sm mt-0.5">
          Generate federally compliant COBRA continuation coverage notices
        </p>
      </div>

      {/* Legal context card */}
      <div className="card bg-kiaa-50 border-kiaa-200 mb-6">
        <div className="flex gap-3">
          <Info size={15} className="text-kiaa-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-kiaa-700 space-y-1">
            <div><strong>General / Initial Notice</strong> — Must be provided to new enrollees within <strong>90 days</strong> of coverage start. Informs participants of future COBRA rights.</div>
            <div><strong>Election Notice</strong> — Must be provided within <strong>14 days</strong> of learning of a qualifying event. Starts the 60-day election window. Includes the detachable Election Form.</div>
            <div className="text-xs text-kiaa-600 mt-1">ERISA § 606 | 29 CFR § 2590.606 | Federal COBRA applies to employers with 20+ employees.</div>
          </div>
        </div>
      </div>

      {/* Step 1: Company */}
      <Section title="Step 1 — Select company">
        <div>
          <label className="label">Company</label>
          <select className="input" value={selected}
            onChange={e => setSelected(e.target.value)}>
            <option value="">— choose a company —</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.employee_count} employees)
              </option>
            ))}
          </select>
        </div>

        {company && !cobraApplies && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>{company.name}</strong> has fewer than 20 employees — federal COBRA does not apply.
              Hawaii state continuation coverage requirements may apply. Contact the Hawaii Insurance
              Division at (808) 586-2790 for state-specific guidance.
            </div>
          </div>
        )}

        {company && planList.length === 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
            <AlertTriangle size={14} className="text-amber-600" />
            No plans are assigned to this company. Go to Companies and assign plans first.
          </div>
        )}

        {company && planList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-surface-400 mr-1">Plans:</span>
            {planList.map(p => (
              <span key={p.id} className="badge badge-aqua text-xs">{p.shortName}</span>
            ))}
          </div>
        )}
      </Section>

      {/* Step 2: Notice type */}
      <Section title="Step 2 — Notice type">
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'initial',  label: 'General / Initial Notice',
              desc: 'For new enrollees — within 90 days of coverage start' },
            { id: 'election', label: 'COBRA Election Notice',
              desc: 'When a qualifying event occurs — within 14 days of notification' },
          ].map(({ id, label, desc }) => (
            <button
              key={id}
              onClick={() => setNoticeType(id)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                noticeType === id
                  ? 'border-kiaa-600 bg-kiaa-50'
                  : 'border-surface-200 bg-white hover:border-kiaa-300'
              }`}
            >
              <div className={`font-medium text-sm mb-1 ${noticeType === id ? 'text-kiaa-700' : 'text-surface-700'}`}>
                {label}
              </div>
              <div className="text-xs text-surface-400">{desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Step 3: Notice date */}
      <Section title="Step 3 — Notice date">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date of this notice</label>
            <input className="input" type="date" value={noticeDate}
              onChange={e => setNoticeDate(e.target.value)} />
            <p className="text-xs text-surface-400 mt-1">
              {noticeType === 'initial'
                ? 'Must be within 90 days of coverage start date'
                : 'Must be within 14 days of learning of the qualifying event'}
            </p>
          </div>
          {noticeType === 'election' && (
            <div>
              <label className="label">Election deadline (auto-calculated)</label>
              <input className="input bg-surface-100 cursor-default"
                value={electionDeadline} readOnly />
              <p className="text-xs text-surface-400 mt-1">60 days from notice date</p>
            </div>
          )}
        </div>
      </Section>

      {/* Step 4a: Qualifying event (election only) */}
      {noticeType === 'election' && (
        <Section title="Step 4 — Qualifying event">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Qualifying event</label>
              <select className="input" value={qEvent} onChange={e => setQEvent(e.target.value)}>
                {QUALIFYING_EVENTS.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date of qualifying event</label>
              <input className="input" type="date" value={eventDate}
                onChange={e => setEventDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Date coverage ends / ended</label>
              <input className="input" type="date" value={coverageLostDate}
                onChange={e => setCovLost(e.target.value)} />
            </div>
            <div>
              <label className="label">Maximum COBRA duration</label>
              <input className="input bg-surface-100 cursor-default"
                value={
                  qEvent === 'termination' || qEvent === 'reduction'
                    ? '18 months' : '36 months'
                } readOnly />
            </div>
          </div>
        </Section>
      )}

      {/* Step 4b / 5: Participant info (election only) */}
      {noticeType === 'election' && (
        <Section title="Step 5 — Participant information">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full name *</label>
              <input className="input" value={participant.name}
                onChange={e => setParticipantField('name', e.target.value)}
                placeholder="Jane Doe" />
            </div>
            <div className="col-span-2">
              <label className="label">Mailing address</label>
              <input className="input" value={participant.address}
                onChange={e => setParticipantField('address', e.target.value)}
                placeholder="123 Kamehameha Ave" />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={participant.city}
                onChange={e => setParticipantField('city', e.target.value)}
                placeholder="Hilo" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">State</label>
                <input className="input" value={participant.state}
                  onChange={e => setParticipantField('state', e.target.value)}
                  placeholder="HI" maxLength={2} />
              </div>
              <div>
                <label className="label">ZIP</label>
                <input className="input" value={participant.zip}
                  onChange={e => setParticipantField('zip', e.target.value)}
                  placeholder="96720" />
              </div>
            </div>
            <div>
              <label className="label">Date of birth</label>
              <input className="input" type="date" value={participant.dob}
                onChange={e => setParticipantField('dob', e.target.value)} />
            </div>
          </div>

          {/* Dependents */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Covered dependents</label>
              <button className="btn btn-sm" onClick={addDependent}>
                <Plus size={12}/> Add dependent
              </button>
            </div>
            {dependents.length === 0 && (
              <p className="text-xs text-surface-400 italic">
                No dependents added. Only the employee will be listed as a qualified beneficiary.
              </p>
            )}
            {dependents.map((dep, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 mb-2 items-end">
                <div className="col-span-2">
                  <label className="label">Full name</label>
                  <input className="input" value={dep.name}
                    onChange={e => updateDependent(i, 'name', e.target.value)}
                    placeholder="John Doe" />
                </div>
                <div>
                  <label className="label">Relationship</label>
                  <select className="input" value={dep.relationship}
                    onChange={e => updateDependent(i, 'relationship', e.target.value)}>
                    <option>Spouse</option>
                    <option>Domestic partner</option>
                    <option>Dependent child</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="label">Date of birth</label>
                    <input className="input" type="date" value={dep.dob}
                      onChange={e => updateDependent(i, 'dob', e.target.value)} />
                  </div>
                  <button className="btn btn-sm btn-danger btn-icon mt-5"
                    onClick={() => removeDependent(i)}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Generate */}
      <div className="card mt-2">
        <h2 className="section-title">Generate notice</h2>
        <div className="flex flex-wrap gap-3">
          {noticeType === 'initial' ? (
            <button
              className="btn btn-teal"
              onClick={downloadInitial}
              disabled={!selected || planList.length === 0}
            >
              <FileDown size={15}/>
              Download General / Initial Notice
            </button>
          ) : (
            <button
              className="btn btn-teal"
              onClick={downloadElection}
              disabled={!selected || planList.length === 0 || !participant.name}
            >
              <FileDown size={15}/>
              Download Election Notice + Election Form
            </button>
          )}
        </div>
        <p className="text-xs text-surface-400 mt-3">
          The downloaded HTML file opens in any browser. Use File → Print → Save as PDF to create
          a print-ready letter-size document. The Election Notice includes a detachable Election Form
          on a separate page.
          {noticeType === 'election' && !participant.name && (
            <span className="text-amber-600"> Enter the participant's name to enable download.</span>
          )}
        </p>
      </div>
    </div>
  )
}
