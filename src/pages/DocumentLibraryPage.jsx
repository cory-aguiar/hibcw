import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PLANS, RIDERS_PLAN, COMPCARE } from '@/lib/plans'
import {
  Upload, Trash2, ExternalLink, CheckCircle,
  Loader, AlertCircle, Info, Library, Plus, Package
} from 'lucide-react'
import { usePlanYear } from '@/lib/PlanYearContext'

const PLAN_YEAR_EVERGREEN = 'evergreen'

// All HMSA plan document slots (SBCs + benefit summaries)
const PLAN_DOC_SLOTS = [
  {
    section:    'HMSA Summary of Benefits & Coverage (SBC)',
    sub:        'Upload once — automatically available to all companies on each plan',
    slots: PLANS.map(p => ({
      key:        `sbc__${p.id}`,
      type:       'sbc',
      planId:     p.id,
      label:      p.name,
      badge:      p.type,
      badgeClass: p.type === 'HMO' ? 'badge-amber' : 'badge-aqua',
      classLabel: p.hmsa_class_label,
    }))
  },
  {
    section: 'Benefit Summaries',
    sub:     'KIAA-created summaries for plans without an HMSA SBC',
    slots: [
      {
        key:        'benefit_summary__kiaa_riders',
        type:       'benefit_summary',
        planId:     'kiaa_riders',
        label:      'KIAA Riders Package — Vision, Dental, Group Life/AD&D',
        badge:      'Riders',
        badgeClass: 'badge-gray',
        classLabel: '',
      },
      {
        key:        'benefit_summary__compcare',
        type:       'benefit_summary',
        planId:     'compcare',
        label:      'COMPCARE — Acupuncture, Massage, Active & Fit',
        badge:      'Add-on',
        badgeClass: 'badge-aqua',
        classLabel: '',
      },
    ]
  },
  {
    section: 'Guide to Benefits',
    sub:     'One guide per plan — applies to both Med Only and Full Package variants. Separate guides for Vision, Dental, and Drug.',
    slots: [
      { key:'guide__ppp',       type:'guide', planId:'ppp',       label:'Preferred Provider Plan (PPP)',         badge:'PPO',  badgeClass:'badge-aqua' },
      { key:'guide__compmed_a', type:'guide', planId:'compmed_a', label:'CompMED A',                             badge:'PPO',  badgeClass:'badge-aqua' },
      { key:'guide__compmed_b', type:'guide', planId:'compmed_b', label:'CompMED B',                             badge:'PPO',  badgeClass:'badge-aqua' },
      { key:'guide__hph_plus',  type:'guide', planId:'hph_plus',  label:'Health Plan Hawaii Plus (HPH Plus)',    badge:'HMO',  badgeClass:'badge-amber' },
      { key:'guide__hph_basic', type:'guide', planId:'hph_basic', label:'Health Plan Hawaii Basic (HPH Basic)',  badge:'HMO',  badgeClass:'badge-amber' },
      { key:'guide__vision',    type:'guide', planId:'vision',    label:'Vision Benefits',                       badge:'Riders', badgeClass:'badge-gray' },
      { key:'guide__dental',    type:'guide', planId:'dental',    label:'Dental Benefits',                       badge:'Riders', badgeClass:'badge-gray' },
      { key:'guide__drug',      type:'guide', planId:'drug',      label:'Prescription Drug Benefits',            badge:'Rx',   badgeClass:'badge-aqua' },
    ]
  },
  {
    section: 'ACA Small Group — SBCs',
    sub:     'Summary of Benefits and Coverage for ACA Small Group plans',
    aca:     true,
    slots: [
      { key:'sbc__aca_cm_a',     type:'sbc', planId:'aca_cm_a',     label:'ACA CompMED A',              badge:'PPO', badgeClass:'badge-aqua' },
      { key:'sbc__aca_hph_plus', type:'sbc', planId:'aca_hph_plus', label:'ACA Health Plan Hawaii Plus', badge:'HMO', badgeClass:'badge-amber' },
      { key:'sbc__aca_ppp',      type:'sbc', planId:'aca_ppp',      label:'ACA PPP',                    badge:'PPO', badgeClass:'badge-aqua' },
    ]
  },
  {
    section: 'ACA Small Group — Guide to Benefits',
    sub:     'Plan-specific guides for ACA Small Group plans',
    aca:     true,
    slots: [
      { key:'guide__aca_cm_a',     type:'guide', planId:'aca_cm_a',     label:'ACA CompMED A',              badge:'PPO', badgeClass:'badge-aqua' },
      { key:'guide__aca_hph_plus', type:'guide', planId:'aca_hph_plus', label:'ACA Health Plan Hawaii Plus', badge:'HMO', badgeClass:'badge-amber' },
      { key:'guide__aca_ppp',      type:'guide', planId:'aca_ppp',      label:'ACA PPP',                    badge:'PPO', badgeClass:'badge-aqua' },
    ]
  },
  {
    section: 'ACA Small Group — Other Documents',
    sub:     'Drug formulary, plan changes, and other ACA-specific documents',
    aca:     true,
    slots: [
      { key:'aca_drug_formulary', type:'aca_drug_formulary', planId:'aca_drug',   label:'ACA Drug Formulary',  badge:'Rx',  badgeClass:'badge-aqua' },
      { key:'aca_plan_changes',   type:'aca_plan_changes',   planId:'aca_changes', label:'ACA Plan Changes',   badge:'Doc', badgeClass:'badge-gray' },
    ]
  },
]

// Carrier document type labels
const DOC_TYPE_LABELS = {
  provider_directory:    'Provider Directory',
  drug_formulary:        'Drug Formulary',
  benefit_summary:       'Benefit Summary',
  group_life_enrollment: 'Group Life Enrollment Form',
  flyer:                 'Informational Flyer',
  member_form:           'Member Form',
  form:                  'Form',
  other:                 'Other',
}

const CARRIER_DOC_TYPES = [
  { value: 'provider_directory',    label: 'Provider Directory' },
  { value: 'drug_formulary',        label: 'Drug Formulary' },
  { value: 'benefit_summary',       label: 'Benefit Summary' },
  { value: 'group_life_enrollment', label: 'Group Life Enrollment Form' },
  { value: 'flyer',                 label: 'Informational Flyer' },
  { value: 'member_form',           label: 'Member Form' },
  { value: 'form',                   label: 'Form' },
  { value: 'other',                 label: 'Other' },
]

function CarrierDocSection({ carrier, carrierLabel, carrierColor, docs, planYear, onReload }) {
  const [uploading,  setUploading]  = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState({ doc_type: 'provider_directory', label: '', description: '', is_evergreen: false })
  const [error,      setError]      = useState('')
  const [deleting,   setDeleting]   = useState(null)
  const fileRef = useRef()

  async function handleUpload(file) {
    if (!file || !form.label) { setError('Please fill in the document label before uploading.'); return }
    setUploading(true)
    setError('')

    try {
      const year     = form.is_evergreen ? PLAN_YEAR_EVERGREEN : planYear
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path     = `carrier/${carrier}/${year}/${Date.now()}_${safeName}`

      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (upErr) throw new Error('Upload failed: ' + upErr.message)

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

      const { error: dbErr } = await supabase.from('carrier_documents').insert({
        carrier,
        doc_type:    form.doc_type,
        plan_year:   form.is_evergreen ? null : planYear,
        label:       form.label,
        description: form.description || null,
        file_name:   file.name,
        file_url:    publicUrl,
      })

      if (dbErr) throw new Error('Save failed: ' + dbErr.message)

      setShowForm(false)
      setForm({ doc_type: 'provider_directory', label: '', description: '', is_evergreen: false })
      onReload()
    } catch (e) {
      setError(e.message || 'Upload failed — an unexpected error occurred.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.label}"?`)) return
    setDeleting(doc.id)
    await supabase.from('carrier_documents').delete().eq('id', doc.id)
    setDeleting(null)
    onReload()
  }

  async function handleReplace(doc, file) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const year     = doc.plan_year || PLAN_YEAR_EVERGREEN
      const path     = `carrier/${doc.carrier}/${year}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (upErr) throw new Error('Upload failed: ' + upErr.message)
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('carrier_documents')
        .update({ file_name: file.name, file_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', doc.id)
      if (dbErr) throw new Error('Update failed: ' + dbErr.message)
      onReload()
    } catch (e) {
      setError(e.message || 'Upload failed — an unexpected error occurred.')
    } finally {
      setUploading(false)
    }
  }

  const carrierDocs = docs.filter(d => d.carrier === carrier)

  // Group by doc_type for display
  const grouped = {}
  carrierDocs.forEach(d => {
    if (!grouped[d.doc_type]) grouped[d.doc_type] = []
    grouped[d.doc_type].push(d)
  })

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${carrierColor}`}/>
            <h2 className="font-display font-semibold text-surface-800 text-base">{carrierLabel} Collateral</h2>
            {carrierDocs.length > 0 && (
              <span className="badge badge-gray text-xs">{carrierDocs.length} doc{carrierDocs.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <p className="text-xs text-surface-400 mt-0.5 ml-4">
            Available to all companies offering {carrierLabel} plans — included automatically in enrollment packets
          </p>
        </div>
        <button className="btn btn-sm btn-teal" onClick={() => setShowForm(s => !s)}>
          <Plus size={13}/> Add document
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="card border-kiaa-200 bg-kiaa-50 mb-4">
          <h3 className="text-sm font-semibold text-kiaa-700 mb-3">Add {carrierLabel} document</h3>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3 border border-red-100">
              <AlertCircle size={13}/>{error}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="label">Document type</label>
              <select className="input" value={form.doc_type}
                onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                {CARRIER_DOC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Display label <span className="text-red-400">*</span></label>
              <input className="input" placeholder={`e.g. "${carrierLabel} Provider Directory 2025-2026"`}
                value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Description <span className="text-surface-400">(optional)</span></label>
              <input className="input" placeholder="Short subtitle shown under the document name"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}/>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id={`evergreen-${carrier}`} checked={form.is_evergreen}
                onChange={e => setForm(f => ({ ...f, is_evergreen: e.target.checked }))}
                className="w-4 h-4 accent-kiaa-400"/>
              <label htmlFor={`evergreen-${carrier}`} className="text-sm text-surface-600 cursor-pointer">
                Evergreen document <span className="text-xs text-surface-400">(not plan-year specific — e.g. Group Life enrollment form)</span>
              </label>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <label className={`btn btn-primary cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploading
                  ? <><Loader size={13} className="animate-spin"/> Uploading…</>
                  : <><Upload size={13}/> Choose PDF &amp; upload</>}
                <input type="file" accept=".pdf" className="hidden" ref={fileRef}
                  onChange={e => { handleUpload(e.target.files[0]); e.target.value = '' }} disabled={uploading}/>
              </label>
              <button className="btn btn-sm" onClick={() => { setShowForm(false); setError('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Document list */}
      {carrierDocs.length === 0 ? (
        <div className="card text-sm text-surface-400 italic text-center py-6">
          No {carrierLabel} collateral uploaded yet. Click "Add document" to get started.
        </div>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-surface-50">
          {Object.entries(grouped).map(([docType, typeDocs]) => (
            <div key={docType}>
              <div className="px-4 py-2 bg-surface-50 text-xs font-semibold text-surface-500 uppercase tracking-wide">
                {DOC_TYPE_LABELS[docType] || docType}
              </div>
              {typeDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-4 px-4 py-3 bg-kiaa-50/50 hover:bg-kiaa-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-kiaa-500 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-surface-700">{doc.label}</span>
                      {doc.plan_year === null
                        ? <span className="badge badge-gray text-xs">Evergreen</span>
                        : <span className="badge badge-aqua text-xs">{doc.plan_year}</span>}
                    </div>
                    {doc.description && (
                      <div className="text-xs text-surface-500 mt-0.5">{doc.description}</div>
                    )}
                    <div className="text-xs text-kiaa-700 mt-0.5 flex items-center gap-1.5">
                      <CheckCircle size={11}/>{doc.file_name}
                      <span className="text-surface-400">
                        · {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-sm btn-icon" title="View">
                      <ExternalLink size={13}/>
                    </a>
                    <label className="btn btn-sm cursor-pointer" title="Replace PDF">
                      <Upload size={12}/> Replace
                      <input type="file" accept=".pdf" className="hidden"
                        onChange={e => { handleReplace(doc, e.target.files[0]); e.target.value='' }}/>
                    </label>
                    <button className="btn btn-sm btn-icon text-red-400 hover:text-red-600"
                      onClick={() => handleDelete(doc)}
                      disabled={deleting === doc.id}
                      title="Delete">
                      {deleting === doc.id
                        ? <Loader size={13} className="animate-spin"/>
                        : <Trash2 size={13}/>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DocumentLibraryPage() {
  const { oePlanYear } = usePlanYear()
  const PLAN_YEAR = oePlanYear

  const [docs,          setDocs]          = useState({})
  const [carrierDocs,   setCarrierDocs]   = useState([])
  const [extLinks,      setExtLinks]      = useState([])
  const [kaiserPlanNos, setKaiserPlanNos] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [uploading,     setUploading]     = useState({})
  const [error,         setError]         = useState('')
  const [saved,         setSaved]         = useState('')
  const [activeSection, setActiveSection] = useState('plan')
  const [newLink,       setNewLink]       = useState({ label: '', url: '', description: '' })
  const [addingLink,    setAddingLink]    = useState(false)
  const [showLinkForm,  setShowLinkForm]  = useState(false)
  const fileRefs = useRef({})

  useEffect(() => { loadAll() }, [PLAN_YEAR])

  async function loadAll() {
    const [{ data: planDocs }, { data: cDocs }, { data: links }, { data: kRates }] = await Promise.all([
      supabase.from('plan_documents').select('*').eq('plan_year', PLAN_YEAR),
      supabase.from('carrier_documents').select('*').order('carrier').order('doc_type').order('uploaded_at'),
      supabase.from('document_links').select('*').order('created_at'),
      supabase.from('kaiser_rates').select('kaiser_plan_no').eq('plan_year', PLAN_YEAR),
    ])
    const d = {}
    ;(planDocs || []).forEach(doc => { d[`${doc.doc_type}__${doc.plan_id}`] = doc })
    setDocs(d)
    setCarrierDocs(cDocs || [])
    setExtLinks(links || [])
    setKaiserPlanNos([...new Set((kRates || []).map(r => r.kaiser_plan_no))].sort())
    setLoading(false)
  }

  async function handleAddLink() {
    if (!newLink.label.trim() || !newLink.url.trim()) return
    setAddingLink(true)
    await supabase.from('document_links').insert({
      label:       newLink.label.trim(),
      url:         newLink.url.trim(),
      description: newLink.description.trim() || null,
    })
    setNewLink({ label: '', url: '', description: '' })
    setShowLinkForm(false)
    setAddingLink(false)
    loadAll()
  }

  async function handleDeleteLink(id) {
    if (!confirm('Delete this link?')) return
    await supabase.from('document_links').delete().eq('id', id)
    loadAll()
  }

  async function handleUpload(slot, file) {
    if (!file) return
    setUploading(u => ({ ...u, [slot.key]: true }))
    setError('')

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `global/${PLAN_YEAR}/${slot.planId}_${slot.type}_${safeName}`

    const { error: upErr } = await supabase.storage
      .from('documents').upload(path, file, { upsert: true })
    if (upErr) { setError('Upload failed: ' + upErr.message); setUploading(u => ({ ...u, [slot.key]: false })); return }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

    const { error: dbErr } = await supabase.from('plan_documents').upsert({
      plan_id:   slot.planId,
      doc_type:  slot.type,
      plan_year: PLAN_YEAR,
      file_name: file.name,
      file_url:  publicUrl,
    }, { onConflict: 'plan_id,doc_type,plan_year' })

    if (dbErr) { setError('Save failed: ' + dbErr.message); setUploading(u => ({ ...u, [slot.key]: false })); return }

    setSaved(slot.key)
    setTimeout(() => setSaved(''), 3000)
    setUploading(u => ({ ...u, [slot.key]: false }))
    loadAll()
  }

  async function handleDelete(slot) {
    if (!confirm(`Delete "${slot.label}"?`)) return
    const doc = docs[slot.key]
    if (!doc) return
    await supabase.from('plan_documents').delete().eq('id', doc.id)
    loadAll()
  }

  const kaiserSection = kaiserPlanNos.length > 0 ? {
    section: 'Kaiser Permanente — SBCs',
    sub:     'Upload once per plan number — automatically available to every company offering that Kaiser plan, regardless of Med/Rx or Full Package billing',
    slots: kaiserPlanNos.map(no => ({
      key:        `kaiser_sbc__kaiser_${no}`,
      type:       'kaiser_sbc',
      planId:     `kaiser_${no}`,
      label:      `Kaiser Permanente ${no}`,
      badge:      'HMO',
      badgeClass: 'badge-amber',
      classLabel: '',
    }))
  } : null

  const ALL_SECTIONS = kaiserSection
    ? [PLAN_DOC_SLOTS[0], kaiserSection, ...PLAN_DOC_SLOTS.slice(1)]
    : PLAN_DOC_SLOTS

  const allSlots    = ALL_SECTIONS.flatMap(s => s.slots)
  const uploaded    = allSlots.filter(s => docs[s.key]).length
  const total       = allSlots.length

  if (loading) return <div className="p-8 text-surface-400">Loading…</div>

  const SECTIONS = [
    { id: 'plan',    label: 'Plan Documents',               sub: 'SBCs & benefit summaries' },
    { id: 'carrier', label: 'Enrollment Packet Collateral', sub: 'Carrier-level documents' },
    { id: 'links',   label: 'External Links',               sub: 'JotForms & external resources' },
  ]

  return (
    <div className="p-8 page-enter max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Library size={20} className="text-kiaa-600"/>
        <div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-700">Document Library</h1>
          <p className="text-surface-400 text-sm mt-0.5">Plan year: {PLAN_YEAR}</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 border-b border-surface-100">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeSection === s.id
                ? 'border-kiaa-600 text-kiaa-700'
                : 'border-transparent text-surface-400 hover:text-surface-600'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── PLAN DOCUMENTS TAB ── */}
      {activeSection === 'plan' && (
        <>
          {/* Progress */}
          <div className="card mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-surface-700">Upload progress</span>
              <span className="text-sm text-surface-500">{uploaded} / {total} documents</span>
            </div>
            <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
              <div className="bg-kiaa-600 h-2 rounded-full transition-all"
                style={{ width: `${(uploaded/total)*100}%` }}/>
            </div>
            {uploaded < total && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠ {total - uploaded} document{total-uploaded!==1?'s':''} still needed.
                Employees won't see download links for missing documents.
              </p>
            )}
            {uploaded === total && (
              <p className="text-xs text-kiaa-600 mt-2 flex items-center gap-1">
                <CheckCircle size={12}/> All documents uploaded — employees can access them at /plans
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
              <AlertCircle size={14}/>{error}
            </div>
          )}

          <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5 text-xs text-kiaa-700 mb-5">
            <Info size={13} className="flex-shrink-0 mt-0.5"/>
            <div>
              Documents uploaded here are <strong>shared across all companies</strong> — you only need to upload each SBC once per plan year, including Kaiser.
              Company-specific SPDs are uploaded separately on each company's detail page, and any Kaiser SBC can be overridden per-company there too if a plan ever varies.
            </div>
          </div>

          {ALL_SECTIONS.map(section => (
            <div key={section.section} className="mb-6">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-semibold text-surface-800 text-base">{section.section}</h2>
                  {section.aca && <span className="badge badge-aqua text-xs">ACA</span>}
                </div>
                <p className="text-xs text-surface-400 mt-0.5">{section.sub}</p>
              </div>
              <div className="card p-0 overflow-hidden divide-y divide-surface-50">
                {section.slots.map(slot => {
                  const doc         = docs[slot.key]
                  const isUploading = uploading[slot.key]
                  const justSaved   = saved === slot.key
                  return (
                    <div key={slot.key} className={`flex items-center gap-4 px-4 py-3 transition-colors ${doc ? 'bg-kiaa-50/50' : 'bg-white hover:bg-surface-50/50'}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${doc ? 'bg-kiaa-500' : 'bg-surface-300'}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-surface-700">{slot.label}</span>
                          <span className={`badge ${slot.badgeClass}`}>{slot.badge}</span>
                          {slot.classLabel && <span className="text-xs text-surface-400">{slot.classLabel}</span>}
                        </div>
                        {doc ? (
                          <div className="text-xs text-kiaa-700 mt-0.5 flex items-center gap-1.5">
                            <CheckCircle size={11}/>{doc.file_name}
                            <span className="text-surface-400">
                              · {new Date(doc.uploaded_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-surface-400 mt-0.5">No document uploaded</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {justSaved && (
                          <span className="text-xs text-kiaa-600 flex items-center gap-1">
                            <CheckCircle size={12}/> Saved
                          </span>
                        )}
                        {doc && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="btn btn-sm btn-icon" title="View">
                            <ExternalLink size={13}/>
                          </a>
                        )}
                        <button
                          className={`btn btn-sm ${doc ? '' : 'btn-teal'}`}
                          onClick={() => fileRefs.current[slot.key]?.click()}
                          disabled={isUploading} title={doc ? 'Replace' : 'Upload'}>
                          {isUploading
                            ? <><Loader size={13} className="animate-spin"/> Uploading…</>
                            : <><Upload size={13}/> {doc ? 'Replace' : 'Upload'}</>}
                        </button>
                        {doc && (
                          <button className="btn btn-sm btn-icon text-red-400 hover:text-red-600"
                            onClick={() => handleDelete(slot)} title="Delete">
                            <Trash2 size={13}/>
                          </button>
                        )}
                        <input ref={el => fileRefs.current[slot.key] = el}
                          type="file" accept=".pdf" className="hidden"
                          onChange={e => { handleUpload(slot, e.target.files[0]); e.target.value='' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="card bg-surface-50 text-xs text-surface-500 space-y-1">
            <div className="font-medium text-surface-700 mb-2">How documents appear to employees</div>
            <div>• <strong>SBCs</strong> — appear as a "SBC" download button on each plan card at /plans</div>
            <div>• <strong>Benefit Summaries</strong> — appear as a "Summary" download button on the Riders/COMPCARE card</div>
            <div>• <strong>SPD</strong> — uploaded per-company from the Company Detail page; appears inline at the top of /plans</div>
            <div className="pt-1 text-surface-400">All documents are public URLs — no login required for employees to download.</div>
          </div>
        </>
      )}

      {/* ── CARRIER COLLATERAL TAB ── */}
      {activeSection === 'carrier' && (
        <>
          <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5 text-xs text-kiaa-700 mb-6">
            <Package size={13} className="flex-shrink-0 mt-0.5"/>
            <div>
              Carrier collateral is included automatically in the <strong>digital enrollment packet</strong> for any company that offers that carrier's plans.
              Documents marked <strong>Evergreen</strong> are not plan-year specific and always included.
              The Group Life enrollment form is included for any company with Full Package or Riders plans (HMSA or Kaiser).
            </div>
          </div>

          <CarrierDocSection
            carrier="hmsa"
            carrierLabel="HMSA"
            carrierColor="bg-kiaa-500"
            docs={carrierDocs}
            planYear={PLAN_YEAR}
            onReload={loadAll}
          />

          <CarrierDocSection
            carrier="kaiser"
            carrierLabel="Kaiser Permanente"
            carrierColor="bg-blue-500"
            docs={carrierDocs}
            planYear={PLAN_YEAR}
            onReload={loadAll}
          />
        </>
      )}

      {/* ── EXTERNAL LINKS TAB ── */}
      {activeSection === 'links' && (
        <>
          <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5 text-xs text-kiaa-700 mb-6">
            <ExternalLink size={13} className="flex-shrink-0 mt-0.5"/>
            <div>
              External links stored here appear automatically in the <strong>HR portal Forms &amp; resources</strong> section. Add the Group Life enrollment JotForm and any other external resources here.
            </div>
          </div>

          <div className="card p-0 overflow-hidden mb-4">
            <div className="px-4 py-3 bg-surface-50 border-b border-surface-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-surface-700">External links</span>
              <button className="btn btn-sm btn-teal flex items-center gap-1.5"
                onClick={() => setShowLinkForm(v => !v)}>
                <Plus size={13}/> Add link
              </button>
            </div>

            {showLinkForm && (
              <div className="px-4 py-4 border-b border-surface-100 bg-kiaa-50/40 space-y-3">
                <div>
                  <label className="label">Label <span className="text-red-400">*</span></label>
                  <input className="input" placeholder="e.g. Group Life/AD&D Enrollment"
                    value={newLink.label} onChange={e => setNewLink(l => ({ ...l, label: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">URL <span className="text-red-400">*</span></label>
                  <input className="input" type="url" placeholder="https://form.jotform.com/…"
                    value={newLink.url} onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">Description <span className="text-surface-400 font-normal">(optional)</span></label>
                  <input className="input" placeholder="Short description shown to HR users"
                    value={newLink.description} onChange={e => setNewLink(l => ({ ...l, description: e.target.value }))}/>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-teal flex items-center gap-1.5"
                    onClick={handleAddLink} disabled={addingLink || !newLink.label || !newLink.url}>
                    {addingLink ? <><Loader size={13} className="animate-spin"/>Saving…</> : <><CheckCircle size={13}/>Save link</>}
                  </button>
                  <button className="btn" onClick={() => { setShowLinkForm(false); setNewLink({ label:'', url:'', description:'' }) }}>Cancel</button>
                </div>
              </div>
            )}

            {extLinks.length === 0 && !showLinkForm && (
              <div className="px-4 py-8 text-center text-surface-400 text-sm">
                No external links yet. Add the Group Life enrollment JotForm to get started.
              </div>
            )}

            {extLinks.map(link => (
              <div key={link.id} className="flex items-center gap-3 px-4 py-3 border-b border-surface-50 last:border-0 hover:bg-surface-50/50">
                <ExternalLink size={14} className="text-kiaa-400 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-700">{link.label}</div>
                  {link.description && <div className="text-xs text-surface-400 mt-0.5">{link.description}</div>}
                  <div className="text-xs text-kiaa-600 mt-0.5 truncate">{link.url}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={link.url} target="_blank" rel="noopener noreferrer"
                    className="btn btn-sm flex items-center gap-1.5">
                    <ExternalLink size={12}/> Open
                  </a>
                  <button className="btn btn-sm btn-icon text-red-400 hover:text-red-600"
                    onClick={() => handleDeleteLink(link.id)}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
