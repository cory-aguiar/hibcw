import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PLANS, RIDERS_PLAN, COMPCARE } from '@/lib/plans'
import {
  FileText, Upload, Trash2, ExternalLink, CheckCircle,
  Loader, AlertCircle, Info, Library
} from 'lucide-react'


// SBC links from HMSA website (fallback if no PDF uploaded)
const HMSA_SBC_LINKS = {
  ppp_full:       'https://www.hmsa.com/media/sbc-ppp.pdf',
  ppp_med:        'https://www.hmsa.com/media/sbc-ppp.pdf',
  compmed_a_full: 'https://www.hmsa.com/media/sbc-compmed-a.pdf',
  compmed_a_med:  'https://www.hmsa.com/media/sbc-compmed-a.pdf',
  compmed_b_full: 'https://www.hmsa.com/media/sbc-compmed-b.pdf',
  compmed_b_med:  'https://www.hmsa.com/media/sbc-compmed-b.pdf',
  hph_plus_full:  'https://www.hmsa.com/media/sbc-hph-plus.pdf',
  hph_basic_full: 'https://www.hmsa.com/media/sbc-hph-basic.pdf',
}

// Documents that need uploading
function getDocSlots(company, kaiserRates = []) {
  const electedPlanIds = company?.plans || []
  const slots = []

  // SPD — always one per company
  slots.push({
    key:     'spd__null',
    type:    'spd',
    planId:  null,
    label:   'Summary Plan Description (SPD)',
    sub:     'Company-wide document covering all elected plans',
    icon:    '📋',
    required: true,
  })

  // SBC for each elected HMSA medical plan
  PLANS.filter(p => electedPlanIds.includes(p.id) && p.hmsa_class !== 'riders').forEach(plan => {
    slots.push({
      key:    `sbc__${plan.id}`,
      type:   'sbc',
      planId: plan.id,
      label:  `SBC — ${plan.name}`,
      sub:    'Summary of Benefits and Coverage (HMSA)',
      icon:   '📄',
      required: true,
    })
  })

  // Benefit summary for Riders if elected
  if (electedPlanIds.includes('kiaa_riders')) {
    slots.push({
      key:    'benefit_summary__kiaa_riders',
      type:   'benefit_summary',
      planId: 'kiaa_riders',
      label:  'Benefit Summary — KIAA Riders Package',
      sub:    'Vision, Dental, Group Life/AD&D',
      icon:   '📑',
      required: false,
    })
  }

  // Benefit summary for COMPCARE if elected
  if (company?.compcare_elected) {
    slots.push({
      key:    'benefit_summary__compcare',
      type:   'benefit_summary',
      planId: 'compcare',
      label:  'Benefit Summary — COMPCARE',
      sub:    'Acupuncture, Massage, Active & Fit',
      icon:   '📑',
      required: false,
    })
  }

  // Kaiser SBCs — one per unique plan_no only.
  // Kaiser doesn't issue a separate "full package" SBC — package_type just
  // reflects whether HMSA Riders are bundled into the bill. The medical/drug
  // benefit (and its SBC) is identical either way, and Riders already get
  // their own Benefit Summary slot above.
  if (kaiserRates?.length) {
    const seen = new Set()
    kaiserRates.forEach(r => {
      if (seen.has(r.kaiser_plan_no)) return
      seen.add(r.kaiser_plan_no)
      const planId = `kaiser_${r.kaiser_plan_no}`
      slots.push({
        key:      `kaiser_sbc__${planId}`,
        type:     'kaiser_sbc',
        planId,
        label:    `SBC — Kaiser Permanente ${r.kaiser_plan_no}`,
        sub:      `Schedule ${r.schedule || company?.kaiser_schedule || '?'} · HMO · Medical & Drug`,
        icon:     '📄',
        required: true,
        isKaiser: true,
      })
    })
  }

  return slots
}

export default function CompanyDocuments({ company, kaiserRates = [], planYear = '2025-2026' }) {
  const PLAN_YEAR = planYear
  const [docs,     setDocs]     = useState({}) // key -> doc record
  const [loading,  setLoading]  = useState(true)
  const [uploading,setUploading]= useState({}) // key -> bool
  const [error,    setError]    = useState('')
  const [justSaved, setJustSaved] = useState(null) // slot.key that was just uploaded
  const fileRefs = useRef({})

  useEffect(() => {
    if (company?.id) loadDocs()
  }, [company?.id])

  async function loadDocs() {
    // Load company-specific docs (SPD)
    const { data: coDocs } = await supabase
      .from('company_documents')
      .select('*')
      .eq('company_id', company.id)
      .eq('plan_year', PLAN_YEAR)

    // Load global plan docs (SBCs + benefit summaries)
    const { data: planDocs } = await supabase
      .from('plan_documents')
      .select('*')
      .eq('plan_year', PLAN_YEAR)

    const d = {}
    // Global docs first (lower priority)
    ;(planDocs || []).forEach(doc => {
      d[`${doc.doc_type}__${doc.plan_id}`] = { ...doc, isGlobal: true }
    })
    // Company-specific docs override global
    ;(coDocs || []).forEach(doc => {
      d[`${doc.doc_type}__${doc.plan_id || 'null'}`] = { ...doc, isGlobal: false }
    })
    setDocs(d)
    setLoading(false)
  }

  async function handleUpload(slot, file) {
    if (!file) return
    setUploading(u => ({ ...u, [slot.key]: true }))
    setError('')

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData?.user) {
        throw new Error('Your session has expired — please refresh the page and log in again.')
      }
      const user = userData.user

      const ext  = file.name.split('.').pop()
      const path = `${company.id}/${PLAN_YEAR}/${slot.type}${slot.planId ? '_' + slot.planId : ''}.${ext}`

      // Upload to storage
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true })

      if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(path)

      // Save record
      const { error: dbErr } = await supabase
        .from('company_documents')
        .upsert({
          company_id:  company.id,
          doc_type:    slot.type,
          plan_id:     slot.planId,
          plan_year:   PLAN_YEAR,
          file_name:   file.name,
          file_url:    publicUrl,
          uploaded_by: user.id,
        }, { onConflict: 'company_id,doc_type,plan_id,plan_year' })

      if (dbErr) throw new Error(`Save failed: ${dbErr.message}`)

      await loadDocs()
      setJustSaved(slot.key)
      setTimeout(() => setJustSaved(k => k === slot.key ? null : k), 4000)
    } catch (e) {
      setError(e.message || 'Upload failed — an unexpected error occurred.')
    } finally {
      setUploading(u => ({ ...u, [slot.key]: false }))
    }
  }

  async function handleDelete(slot) {
    const doc = docs[slot.key]
    if (!doc) return
    await supabase.from('company_documents').delete().eq('id', doc.id)
    setDocs(d => { const n = { ...d }; delete n[slot.key]; return n })
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-surface-400 text-sm py-4">
      <Loader size={14} className="animate-spin"/> Loading documents…
    </div>
  )

  const slots = getDocSlots(company, kaiserRates)
  if (slots.length === 0) return (
    <div className="text-sm text-surface-400 italic">
      No plans elected yet. Complete Open Enrollment first to set up documents.
    </div>
  )

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
          <AlertCircle size={14}/>{error}
        </div>
      )}

      <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5 text-xs text-kiaa-700">
        <Info size={13} className="flex-shrink-0 mt-0.5"/>
        <div>
          Upload documents once per plan year. These will appear on the employee-facing plan page
          for employees to view and download.
          {!company.plans?.length && <strong> Complete Open Enrollment first to generate the document list.</strong>}
        </div>
      </div>

      {slots.map(slot => {
        const doc       = docs[slot.key]
        const isUploading = uploading[slot.key]

        return (
          <div key={slot.key}
            className={`flex items-center gap-4 p-3 border rounded-xl transition-all ${
              doc?.isGlobal ? 'border-kiaa-200 bg-kiaa-50/40' :
              doc ? 'border-kiaa-200 bg-kiaa-50' : 'border-surface-200 bg-white'
            }`}>
            {/* Icon + label */}
            <div className="text-lg flex-shrink-0">{slot.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-700 flex items-center gap-2">
                {slot.label}
                {slot.required && !doc && (
                  <span className="text-xs text-amber-600 font-normal">Required</span>
                )}
              </div>
              <div className="text-xs text-surface-400 mt-0.5">{slot.sub}</div>
              {doc && (
                <div className="text-xs text-kiaa-700 mt-1 flex items-center gap-1.5">
                  <CheckCircle size={11}/>
                  {doc.file_name}
                  <span className="text-surface-400">
                    · {new Date(doc.uploaded_at).toLocaleDateString()}
                  </span>
                  {justSaved === slot.key && (
                    <span className="badge badge-green text-xs ml-1">Saved</span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {doc && (
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="btn btn-sm btn-icon" title="View document">
                  <ExternalLink size={13}/>
                </a>
              )}
              {/* Only show upload/replace for SPD or if overriding a global doc */}
              {(slot.type === 'spd' || !doc || !doc.isGlobal) && (
                <button
                  className={`btn btn-sm ${doc && !doc.isGlobal ? '' : 'btn-teal'}`}
                  onClick={() => fileRefs.current[slot.key]?.click()}
                  disabled={isUploading}
                  title={doc && !doc.isGlobal ? 'Replace' : slot.type === 'spd' ? 'Upload SPD' : 'Upload'}>
                  {isUploading
                    ? <Loader size={13} className="animate-spin"/>
                    : <Upload size={13}/>}
                  {isUploading ? 'Uploading…' : doc && !doc.isGlobal ? 'Replace' : slot.type === 'spd' ? 'Upload SPD' : 'Upload'}
                </button>
              )}
              {/* Override button for global docs */}
              {doc?.isGlobal && slot.type !== 'spd' && (
                <button
                  className="btn btn-sm text-surface-400 hover:text-surface-600"
                  onClick={() => fileRefs.current[slot.key]?.click()}
                  disabled={isUploading}
                  title="Upload company-specific override">
                  <Upload size={13}/> Override
                </button>
              )}
              {doc && !doc.isGlobal && (
                <button className="btn btn-sm btn-icon text-red-400 hover:text-red-600"
                  onClick={() => handleDelete(slot)} title="Remove override">
                  <Trash2 size={13}/>
                </button>
              )}
              <input
                ref={el => fileRefs.current[slot.key] = el}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => { handleUpload(slot, e.target.files[0]); e.target.value = '' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
