import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PLANS, RIDERS_PLAN } from '@/lib/plans'
import {
  Save, Upload, Download, CheckCircle, AlertCircle,
  Loader, Info, FileText, X, Eye, Sparkles
} from 'lucide-react'

import { usePlanYear, planYearLabel, planYearLong } from '@/lib/PlanYearContext'
import { isBand9 } from '@/lib/plans'
const BANDS = [1,2,3,4,5,6,7,8]
const TIERS = [
  { key: 'premium_single',    label: 'Single' },
  { key: 'premium_two_party', label: '2-Party' },
  { key: 'premium_family',    label: 'Family' },
]

function parseCurrency(v) {
  return parseFloat(String(v).replace(/[$,]/g, '')) || 0
}

function fmtCurrency(v) {
  if (v === '' || v === null || v === undefined) return ''
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Try to detect band number from filename
function detectBand(filename) {
  const name = filename.toLowerCase()
  const patterns = [
    /band[\s_-]*([1-8])/i,
    /group[\s_-]*([1-8])/i,
    /tier[\s_-]*([1-8])/i,
    /([1-8])[\s_-]*band/i,
    /\b([1-8])\b/,
  ]
  for (const p of patterns) {
    const m = name.match(p)
    if (m) return parseInt(m[1])
  }
  return null
}

// Claude extraction prompt
const EXTRACTION_PROMPT = (band) => `You are extracting HMSA health insurance premium rates from a rate sheet PDF for Band ${band}.

Extract the MONTHLY PREMIUMS for each plan, coverage tier, and benefit component (HMSA/medical, Vision, Dental, GL/Life, Total). 

The HMSA plans to look for are:
- CompMED A Full (may appear as "CompMED A" with dental/vision riders, or "438")  
- CompMED A Medical Only (may appear as "CompMED A Med Only" or "438 Med")
- CompMED B Full (may appear as "CompMED B" with dental/vision riders, or "435")
- CompMED B Medical Only (may appear as "CompMED B Med Only" or "435 Med")  
- HPH Basic Full (may appear as "HPH Basic", "HMO", or "K-I")
- PPP Full (may appear as "PPP" with dental/vision riders, or "431")
- PPP Medical Only (may appear as "PPP Med Only" or "431 Med")

Coverage tiers to find for each plan:
- Single (employee only, 1-party)
- Two-Party (employee + 1 dependent, 2-party)  
- Family (employee + 2 or more dependents)

Return ONLY a JSON object in this exact format, no other text:
{
  "band": ${band},
  "rates": {
    "compmed_a_full":  { "single": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "two_party": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "family": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0} },
    "compmed_a_med":   { "single": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "two_party": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "family": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0} },
    "compmed_b_full":  { "single": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "two_party": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "family": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0} },
    "compmed_b_med":   { "single": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "two_party": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "family": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0} },
    "hph_basic_full":  { "single": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "two_party": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "family": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0} },
    "hph_plus_full":   { "single": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "two_party": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "family": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0} },
    "ppp_full":        { "single": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "two_party": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "family": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0} },
    "ppp_med":         { "single": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "two_party": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0}, "family": {"hmsa":0,"vision":0,"dental":0,"life":0,"total":0} }
  }
}

If a plan is not found in the document, use 0 for all values.
All values must be numbers. Do not include $ signs or commas.`

export default function RateSheetPage() {
  const { oePlanYear, oePlanStart, oePlanEnd } = usePlanYear()
  const PLAN_YEAR = oePlanYear
  const [rates,   setRates]   = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')
  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'manual' | 'csv'

  // PDF upload state
  const [pdfFiles,    setPdfFiles]    = useState([]) // [{file, band, status, result, error}]
  const [processing,  setProcessing]  = useState(false)
  const [previewRates,setPreviewRates]= useState(null)
  const [showPreview, setShowPreview] = useState(false)

  const dropRef  = useRef()
  const fileRef  = useRef()
  const csvRef   = useRef()

  useEffect(() => { loadRates() }, [])

  async function loadRates() {
    const { data } = await supabase
      .from('rate_bands').select('*').eq('plan_year', PLAN_YEAR)
    // Load riders flat rate if saved
    const ridersRow = (data || []).find(r => r.plan_id === 'kiaa_riders')
    if (ridersRow) {
      setRidersRates({
        premium_single:    ridersRow.premium_single,
        premium_two_party: ridersRow.premium_two_party,
        premium_family:    ridersRow.premium_family,
      })
    }
    const r = {}
    PLANS.filter(p => !p.flatRate).forEach(p => {
      r[p.id] = {}
      BANDS.forEach(b => { r[p.id][b] = { premium_single:'', premium_two_party:'', premium_family:'' } })
    })
    ;(data || []).forEach(row => {
      if (r[row.plan_id]?.[row.band]) {
        r[row.plan_id][row.band] = {
          premium_single:    row.premium_single,
          premium_two_party: row.premium_two_party,
          premium_family:    row.premium_family,
        }
      }
    })
    setRates(r)
    setLoading(false)
  }

  // ── PDF Upload & Processing ────────────────────────────────
  function handleDrop(e) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    addFiles(files)
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf')
    addFiles(files)
    e.target.value = ''
  }

  function addFiles(files) {
    const newEntries = files.map(file => ({
      id:     Math.random().toString(36).slice(2),
      file,
      band:   detectBand(file.name) || '',
      status: 'ready', // ready | processing | done | error
      result: null,
      error:  null,
    }))
    setPdfFiles(prev => {
      // Avoid duplicates by name
      const existing = new Set(prev.map(f => f.file.name))
      return [...prev, ...newEntries.filter(f => !existing.has(f.file.name))]
    })
  }

  function setBand(id, band) {
    setPdfFiles(prev => prev.map(f => f.id === id ? { ...f, band } : f))
  }

  function removeFile(id) {
    setPdfFiles(prev => prev.filter(f => f.id !== id))
  }

  // Convert file to base64
  function toBase64(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload  = () => res(reader.result.split(',')[1])
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
  }

  async function processAllPDFs() {
    // Validate all files have a band assigned
    const missing = pdfFiles.filter(f => !f.band)
    if (missing.length > 0) {
      setError(`Please assign a band number to all PDFs before processing.`)
      return
    }
    const bands = pdfFiles.map(f => parseInt(f.band))
    const dupes  = bands.filter((b,i) => bands.indexOf(b) !== i)
    if (dupes.length > 0) {
      setError(`Duplicate band assignments: Band ${[...new Set(dupes)].join(', ')}. Each band should have one PDF.`)
      return
    }

    setProcessing(true)
    setError('')

    // Process each PDF through Claude
    const updatedFiles = [...pdfFiles]
    for (let i = 0; i < updatedFiles.length; i++) {
      const entry = updatedFiles[i]
      updatedFiles[i] = { ...entry, status: 'processing' }
      setPdfFiles([...updatedFiles])

      try {
        const base64 = await toBase64(entry.file)

        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: base64 }
                },
                {
                  type: 'text',
                  text: EXTRACTION_PROMPT(entry.band)
                }
              ]
            }]
          })
        })

        const data = await response.json()
        const text = data.content?.find(c => c.type === 'text')?.text || ''

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('Could not parse rates from PDF')

        const result = JSON.parse(jsonMatch[0])
        updatedFiles[i] = { ...updatedFiles[i], status: 'done', result }

      } catch (err) {
        updatedFiles[i] = { ...updatedFiles[i], status: 'error', error: err.message }
      }

      setPdfFiles([...updatedFiles])
    }

    setProcessing(false)

    // Build preview rates from all successful results
    const preview = JSON.parse(JSON.stringify(rates)) // deep clone current rates
    updatedFiles.forEach(entry => {
      if (entry.status === 'done' && entry.result?.rates) {
        const band = parseInt(entry.band)
        Object.entries(entry.result.rates).forEach(([planId, tiers]) => {
          if (preview[planId] && preview[planId][band]) {
            const toRow = (t) => typeof t === 'object' && t !== null && 'hmsa' in t ? t : { hmsa: t || 0, vision: 0, dental: 0, life: 0, total: t || 0 }
            const s = toRow(tiers.single), tp = toRow(tiers.two_party), f = toRow(tiers.family)
            preview[planId][band] = {
              premium_single:    s.total    || s.hmsa || 0,
              premium_two_party: tp.total   || tp.hmsa || 0,
              premium_family:    f.total    || f.hmsa || 0,
              medical_single:    s.hmsa     || 0,
              medical_two_party: tp.hmsa    || 0,
              medical_family:    f.hmsa     || 0,
              vision_single:     s.vision   || 0,
              vision_two_party:  tp.vision  || 0,
              vision_family:     f.vision   || 0,
              dental_single:     s.dental   || 0,
              dental_two_party:  tp.dental  || 0,
              dental_family:     f.dental   || 0,
              life_single:       s.life     || 0,
              life_two_party:    tp.life    || 0,
              life_family:       f.life     || 0,
            }
          }
        })
      }
    })

    const successCount = updatedFiles.filter(f => f.status === 'done').length
    if (successCount > 0) {
      setPreviewRates(preview)
      setShowPreview(true)
    } else {
      setError('No PDFs were processed successfully. Check the errors above.')
    }
  }

  async function confirmAndSave(ratesToSave) {
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()

    const rows = []
    PLANS.forEach(p => {
      BANDS.forEach(b => {
        const v = ratesToSave[p.id]?.[b]
        if (!v) return
        rows.push({
          plan_year:         PLAN_YEAR,
          plan_id:           p.id,
          band:              b,
          premium_single:    parseCurrency(v.premium_single),
          premium_two_party: parseCurrency(v.premium_two_party),
          premium_family:    parseCurrency(v.premium_family),
          medical_single:    parseCurrency(v.medical_single    || v.premium_single),
          medical_two_party: parseCurrency(v.medical_two_party || v.premium_two_party),
          medical_family:    parseCurrency(v.medical_family    || v.premium_family),
          vision_single:     parseCurrency(v.vision_single    || 0),
          vision_two_party:  parseCurrency(v.vision_two_party || 0),
          vision_family:     parseCurrency(v.vision_family    || 0),
          dental_single:     parseCurrency(v.dental_single    || 0),
          dental_two_party:  parseCurrency(v.dental_two_party || 0),
          dental_family:     parseCurrency(v.dental_family    || 0),
          life_single:       parseCurrency(v.life_single      || 0),
          life_two_party:    parseCurrency(v.life_two_party   || 0),
          life_family:       parseCurrency(v.life_family      || 0),
          created_by:        user.id,
        })
      })
    })

    const { error: err } = await supabase
      .from('rate_bands')
      .upsert(rows, { onConflict: 'plan_year,plan_id,band' })

    setSaving(false)
    if (err) { setError(err.message); return }

    setRates(ratesToSave)
    setShowPreview(false)
    setPdfFiles([])
    setPreviewRates(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function setRate(planId, band, tier, val) {
    setRates(r => ({
      ...r,
      [planId]: { ...r[planId], [band]: { ...r[planId][band], [tier]: val } }
    }))
    setSaved(false)
  }

  // ── CSV ────────────────────────────────────────────────────
  const CSV_HEADERS = 'plan_id,band,single_total,two_party_total,family_total,single_hmsa,two_party_hmsa,family_hmsa,single_vision,two_party_vision,family_vision,single_dental,two_party_dental,family_dental,single_life,two_party_life,family_life'

  function downloadTemplate() {
    const rows = [CSV_HEADERS]
    PLANS.forEach(p => BANDS.forEach(b => rows.push(`${p.id},${b},0.00,0.00,0.00`)))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    a.download = `KIAA_Rate_Sheet_Template_${PLAN_YEAR}.csv`
    a.click()
  }

  function downloadCurrent() {
    const rows = [CSV_HEADERS]
    PLANS.forEach(p => BANDS.forEach(b => {
      const v = rates[p.id]?.[b]
      rows.push([p.id,b,parseCurrency(v?.premium_single),parseCurrency(v?.premium_two_party),parseCurrency(v?.premium_family),parseCurrency(v?.medical_single||0),parseCurrency(v?.medical_two_party||0),parseCurrency(v?.medical_family||0),parseCurrency(v?.vision_single||0),parseCurrency(v?.vision_two_party||0),parseCurrency(v?.vision_family||0),parseCurrency(v?.dental_single||0),parseCurrency(v?.dental_two_party||0),parseCurrency(v?.dental_family||0),parseCurrency(v?.life_single||0),parseCurrency(v?.life_two_party||0),parseCurrency(v?.life_family||0)].join(','))
    }))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    a.download = `KIAA_Rate_Sheet_${PLAN_YEAR}.csv`
    a.click()
  }

  function handleCsvImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const lines = ev.target.result.trim().split('\n')
        if (!lines[0].toLowerCase().includes('plan_id')) {
          setError('Invalid CSV — please use the downloaded template.')
          return
        }
        const newRates = JSON.parse(JSON.stringify(rates))
        let count = 0
        lines.slice(1).forEach(line => {
          // Skip comment/separator rows
          if (line.startsWith('#') || line.trim() === '') return
          const cols = line.split(',').map(s => s.trim().replace(/[$]/g, ''))
          // Support both 5-col (plan_id,band,s,2p,f) and
          // 6-col (plan_id,plan_name,band,s,2p,f) formats
          let plan_id, band, single, two, family
          let s_hmsa=0, tp_hmsa=0, f_hmsa=0, s_vis=0, tp_vis=0, f_vis=0
          let s_den=0, tp_den=0, f_den=0, s_life=0, tp_life=0, f_life=0
          if (cols.length >= 6 && isNaN(parseInt(cols[1]))) {
            ;[plan_id, , band, single, two, family] = cols
          } else {
            ;[plan_id, band, single, two, family] = cols
          }
          if (cols.length >= 17) {
            s_hmsa=cols[5];tp_hmsa=cols[6];f_hmsa=cols[7]
            s_vis=cols[8];tp_vis=cols[9];f_vis=cols[10]
            s_den=cols[11];tp_den=cols[12];f_den=cols[13]
            s_life=cols[14];tp_life=cols[15];f_life=cols[16]
          }
          if (!plan_id || !band) return
          let b = parseInt(band)
          // kiaa_riders is stored at band=0 regardless of input band
          if (plan_id === 'kiaa_riders') b = 0
          if (!newRates[plan_id]) return
          if (plan_id !== 'kiaa_riders' && (b < 1 || b > 9)) return
          newRates[plan_id][b] = {
            premium_single:    parseFloat(single)   || 0,
            premium_two_party: parseFloat(two)      || 0,
            premium_family:    parseFloat(family)   || 0,
            medical_single:    parseFloat(s_hmsa)   || parseFloat(single) || 0,
            medical_two_party: parseFloat(tp_hmsa)  || parseFloat(two)    || 0,
            medical_family:    parseFloat(f_hmsa)   || parseFloat(family) || 0,
            vision_single:     parseFloat(s_vis)    || 0,
            vision_two_party:  parseFloat(tp_vis)   || 0,
            vision_family:     parseFloat(f_vis)    || 0,
            dental_single:     parseFloat(s_den)    || 0,
            dental_two_party:  parseFloat(tp_den)   || 0,
            dental_family:     parseFloat(f_den)    || 0,
            life_single:       parseFloat(s_life)   || 0,
            life_two_party:    parseFloat(tp_life)  || 0,
            life_family:       parseFloat(f_life)   || 0,
          }
          count++
        })
        setPreviewRates(newRates)
        setShowPreview(true)
        setError('')
      } catch(err) { setError('Error reading CSV: ' + err.message) }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-surface-400">
      <Loader size={16} className="animate-spin"/>Loading rate sheet…
    </div>
  )

  // ── Preview modal ──────────────────────────────────────────
  if (showPreview && previewRates) {
    return (
      <div className="p-8 page-enter">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <button className="btn btn-sm" onClick={() => setShowPreview(false)}>← Back</button>
            <h1 className="font-display text-2xl font-semibold text-kiaa-700">Review extracted rates</h1>
          </div>
          <p className="text-surface-400 text-sm">Review the rates below. You can edit any cell before saving.</p>
        </div>

        {error && <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4"><AlertCircle size={14}/>{error}</div>}

        <div className="space-y-4 mb-6">
          {PLANS.map(plan => (
            <div key={plan.id} className="card p-0 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-kiaa-700 text-white">
                <span className="bg-kiaa-aqua text-kiaa-800 text-xs font-bold px-2.5 py-0.5 rounded-full">{plan.type}</span>
                <span className="font-display font-semibold text-sm">{plan.name}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{minWidth:'600px'}}>
                  <thead>
                    <tr className="border-b border-surface-100">
                      <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 py-2 bg-surface-50 w-20">Band</th>
                      {TIERS.map(t => <th key={t.key} className="text-center text-xs font-semibold text-surface-400 uppercase tracking-wider px-3 py-2 bg-surface-50">{t.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {BANDS.map(band => {
                      const v = previewRates[plan.id]?.[band] || {}
                      const hasData = parseCurrency(v.premium_single) > 0
                      return (
                        <tr key={band} className={`border-b border-surface-50 ${!hasData ? 'opacity-40' : ''}`}>
                          <td className="px-4 py-2">
                            <span className="text-xs font-semibold text-kiaa-700 bg-kiaa-50 border border-kiaa-200 px-2 py-0.5 rounded">
                              Band {band}
                            </span>
                          </td>
                          {TIERS.map(t => (
                            <td key={t.key} className="px-3 py-1.5 text-center">
                              <div className="relative inline-flex items-center">
                                <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  value={previewRates[plan.id]?.[band]?.[t.key] ?? ''}
                                  onChange={e => setPreviewRates(prev => ({
                                    ...prev,
                                    [plan.id]: { ...prev[plan.id], [band]: { ...prev[plan.id][band], [t.key]: e.target.value }}
                                  }))}
                                  className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono"
                                  placeholder="0.00"
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button className="btn btn-primary btn-lg" onClick={() => confirmAndSave(previewRates)} disabled={saving}>
            {saving ? <><Loader size={15} className="animate-spin"/>Saving…</> : <><CheckCircle size={15}/>Confirm &amp; save all rates</>}
          </button>
          <button className="btn" onClick={() => setShowPreview(false)}>Go back</button>
          {saved && <span className="text-sm text-kiaa-500 flex items-center gap-1.5"><CheckCircle size={13}/>Saved!</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 page-enter">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Rate Sheet Manager</h1>
        <p className="text-surface-400 text-sm mt-0.5">HMSA total premiums · Plan year {oePlanStart} – {oePlanEnd}</p>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4"><AlertCircle size={14}/>{error}</div>}
      {saved && <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm px-3 py-2.5 rounded-lg mb-4"><CheckCircle size={14}/>Rate sheet saved successfully.</div>}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-surface-100 pb-0">
        {[
          { id:'upload', icon: Sparkles, label:'Upload PDFs', sub:'Recommended' },
          { id:'csv',    icon: Upload,   label:'Import CSV',  sub:'' },
          { id:'manual', icon: FileText, label:'Manual entry',sub:'' },
        ].map(({ id, icon: Icon, label, sub }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-kiaa-600 text-kiaa-700'
                : 'border-transparent text-surface-400 hover:text-surface-600'
            }`}>
            <Icon size={14}/>
            {label}
            {sub && <span className="text-xs bg-kiaa-100 text-kiaa-700 px-1.5 py-0.5 rounded-full font-normal">{sub}</span>}
          </button>
        ))}
      </div>

      {/* ── PDF UPLOAD TAB ── */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="card bg-kiaa-50 border-kiaa-200">
            <div className="flex items-start gap-3">
              <Sparkles size={15} className="text-kiaa-600 flex-shrink-0 mt-0.5"/>
              <div className="text-sm text-kiaa-700 space-y-1">
                <div><strong>AI-powered rate extraction.</strong> Drop your 8 HMSA rate PDFs (one per band) and Claude will read the tables and extract all rates automatically.</div>
                <div>After extraction you'll see a preview to review and edit before saving. No manual data entry needed.</div>
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-kiaa-300 rounded-2xl p-10 text-center cursor-pointer hover:border-kiaa-500 hover:bg-kiaa-50 transition-all"
          >
            <Upload size={28} className="text-kiaa-400 mx-auto mb-3"/>
            <div className="font-medium text-surface-700 mb-1">Drop your HMSA rate PDFs here</div>
            <div className="text-sm text-surface-400">or click to browse · Up to 8 PDFs (one per band)</div>
            <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFileSelect}/>
          </div>

          {/* File list */}
          {pdfFiles.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 bg-surface-50 border-b border-surface-100 flex items-center justify-between">
                <span className="text-sm font-medium text-surface-700">{pdfFiles.length} PDF{pdfFiles.length !== 1 ? 's' : ''} ready</span>
                <span className="text-xs text-surface-400">Assign a band number to each file</span>
              </div>
              {pdfFiles.map(entry => (
                <div key={entry.id} className="flex items-center gap-4 px-4 py-3 border-b border-surface-50 last:border-0">
                  <FileText size={16} className={`flex-shrink-0 ${
                    entry.status === 'done'       ? 'text-emerald-500' :
                    entry.status === 'error'      ? 'text-red-500'     :
                    entry.status === 'processing' ? 'text-kiaa-500'    : 'text-surface-400'
                  }`}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-700 truncate">{entry.file.name}</div>
                    <div className="text-xs text-surface-400">{(entry.file.size / 1024).toFixed(0)} KB</div>
                    {entry.status === 'error' && <div className="text-xs text-red-600 mt-0.5">{entry.error}</div>}
                    {entry.status === 'done'  && <div className="text-xs text-emerald-600 mt-0.5">✓ Rates extracted successfully</div>}
                  </div>
                  {/* Band selector */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="text-xs text-surface-400">Band:</label>
                    <select
                      className="input py-1 text-sm w-28"
                      value={entry.band}
                      onChange={e => setBand(entry.id, e.target.value)}
                      disabled={processing || entry.status === 'done'}
                    >
                      <option value="">— select —</option>
                      {BANDS.map(b => <option key={b} value={b}>Band {b}</option>)}
                    </select>
                  </div>
                  {entry.status === 'processing' && <Loader size={15} className="animate-spin text-kiaa-500 flex-shrink-0"/>}
                  {entry.status !== 'processing' && (
                    <button onClick={() => removeFile(entry.id)} className="btn btn-icon btn-sm text-surface-400 hover:text-red-500">
                      <X size={14}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {pdfFiles.length > 0 && !processing && !pdfFiles.every(f => f.status === 'done') && (
            <button className="btn btn-primary btn-lg" onClick={processAllPDFs}
              disabled={pdfFiles.some(f => !f.band)}>
              <Sparkles size={15}/>
              Extract rates from {pdfFiles.length} PDF{pdfFiles.length !== 1 ? 's' : ''}
            </button>
          )}

          {processing && (
            <div className="flex items-center gap-3 text-kiaa-700 text-sm">
              <Loader size={16} className="animate-spin"/>
              Reading PDFs… this may take up to a minute
            </div>
          )}

          {pdfFiles.length > 0 && pdfFiles.every(f => f.status === 'done') && (
            <button className="btn btn-teal btn-lg" onClick={() => setShowPreview(true)}>
              <Eye size={15}/> Review extracted rates
            </button>
          )}
        </div>
      )}

      {/* ── CSV TAB ── */}
      {activeTab === 'csv' && (
        <div className="space-y-4">
          <div className="card bg-kiaa-50 border-kiaa-200">
            <div className="flex items-start gap-3">
              <Info size={14} className="text-kiaa-600 flex-shrink-0 mt-0.5"/>
              <div className="text-sm text-kiaa-700">
                Download the template, fill in your rates in Excel or Google Sheets, then import it back.
                The template has all 56 rows pre-labelled (7 plans × 8 bands).
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn" onClick={downloadTemplate}><Download size={14}/>Download template</button>
            <button className="btn" onClick={downloadCurrent}><Download size={14}/>Export current rates</button>
            <button className="btn btn-teal" onClick={() => csvRef.current?.click()}>
              <Upload size={14}/>Import CSV
            </button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport}/>
          </div>
        </div>
      )}

      {/* ── MANUAL TAB ── */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="flex gap-3 mb-2">
            <button className="btn btn-primary" onClick={() => confirmAndSave(rates)} disabled={saving}>
              {saving ? <><Loader size={14} className="animate-spin"/>Saving…</> : <><Save size={14}/>Save rate sheet</>}
            </button>
          </div>
          {PLANS.map(plan => (
            <div key={plan.id} className="card p-0 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-kiaa-700 text-white">
                <span className="bg-kiaa-aqua text-kiaa-800 text-xs font-bold px-2.5 py-0.5 rounded-full">{plan.type}</span>
                <span className="font-display font-semibold text-sm">{plan.name}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{minWidth:'600px'}}>
                  <thead>
                    <tr className="border-b border-surface-100">
                      <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 py-2 bg-surface-50 w-20">Band</th>
                      {TIERS.map(t => <th key={t.key} className="text-center text-xs font-semibold text-surface-400 uppercase tracking-wider px-3 py-2 bg-surface-50">{t.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {BANDS.map(band => (
                      <tr key={band} className="border-b border-surface-50 hover:bg-kiaa-50/30">
                        <td className="px-4 py-2">
                          <span className="text-xs font-semibold text-kiaa-700 bg-kiaa-50 border border-kiaa-200 px-2 py-0.5 rounded">Band {band}</span>
                        </td>
                        {TIERS.map(t => (
                          <td key={t.key} className="px-3 py-1.5 text-center">
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                              <input
                                type="number" min="0" step="0.01"
                                value={rates[plan.id]?.[band]?.[t.key] ?? ''}
                                onChange={e => setRate(plan.id, band, t.key, e.target.value)}
                                className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono"
                                placeholder="0.00"
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {/* Riders Package flat rate */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-surface-700 text-white">
              <span className="bg-kiaa-aqua text-kiaa-800 text-xs font-bold px-2.5 py-0.5 rounded-full">RIDERS</span>
              <span className="font-display font-semibold text-sm">KIAA Riders Package — Vision, Dental, Group Life/AD&D</span>
              <span className="text-surface-300 text-xs ml-auto">Flat rate — same for all companies &amp; bands</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{minWidth:'500px'}}>
                <thead>
                  <tr className="border-b border-surface-100">
                    <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 py-2 bg-surface-50">Tier</th>
                    {TIERS.map(t => <th key={t.key} className="text-center text-xs font-semibold text-surface-400 uppercase tracking-wider px-3 py-2 bg-surface-50">{t.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Employee only (Single)',         key: 'premium_single' },
                    { label: 'Employee + 1 dependent (2-Party)', key: 'premium_two_party' },
                    { label: 'Employee + family (Family)',     key: 'premium_family' },
                  ].map(({ label, key }) => (
                    <tr key={key} className="border-b border-surface-50">
                      <td className="px-4 py-2 text-surface-600">{label}</td>
                      <td colSpan={3} className="px-3 py-1.5 text-center">
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-2 text-surface-400 text-xs pointer-events-none">$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={ridersRates[key] ?? ''}
                            onChange={e => setRidersRates(r => ({...r, [key]: e.target.value}))}
                            className="input text-right pl-5 pr-2 py-1 text-sm w-28 font-mono"
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-surface-50 text-xs text-surface-400 border-t border-surface-100">
              Vision: $7.32 | Dental: $33.56 | Group Life/AD&D: $4.36 per employee
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => confirmAndSave(rates)} disabled={saving}>
            {saving ? <><Loader size={14} className="animate-spin"/>Saving…</> : <><Save size={14}/>Save rate sheet</>}
          </button>
        </div>
      )}
    </div>
  )
}
