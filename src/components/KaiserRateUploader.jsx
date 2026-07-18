import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, Loader, CheckCircle, AlertCircle, Save, RefreshCw } from 'lucide-react'


function fmt(v) {
  if (!v && v !== 0) return '—'
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function extractKaiserRates(base64Pdf) {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf }
          },
          {
            type: 'text',
            text: `Extract all Kaiser Permanente plan rates from this KIAA pricing sheet PDF.

Return ONLY a valid JSON array — no markdown, no backticks, no explanation.
Each object represents ONE plan (not one tier row). Fields:

- "schedule": the schedule letter (e.g. "B")
- "kaiser_plan_no": plan number as string (e.g. "320", "401")
- "package_type": "med_rx" if "Medical & Drug Package Only", "full" if "Full Package"
- "premium_single": TOTAL column for "Employee only" row
- "premium_two_party": TOTAL column for "Employee and one dependent" row
- "premium_family": TOTAL column for "Employee and family" row
- "medical_single": MEDICAL column for "Employee only" row
- "medical_two_party": MEDICAL column for "Employee and one dependent" row
- "medical_family": MEDICAL column for "Employee and family" row

All dollar values as numbers (no $ or commas). For Med/Rx plans, premium equals medical.

Example output:
[
  {
    "schedule":"B","kaiser_plan_no":"320","package_type":"med_rx",
    "premium_single":871.70,"premium_two_party":1741.40,"premium_family":2615.10,
    "medical_single":871.70,"medical_two_party":1741.40,"medical_family":2615.10
  },
  {
    "schedule":"B","kaiser_plan_no":"320","package_type":"full",
    "premium_single":916.94,"premium_two_party":1833.80,"premium_family":2751.46,
    "medical_single":871.70,"medical_two_party":1741.40,"medical_family":2615.10
  }
]`
          }
        ]
      }]
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${response.status}`)
  }

  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('No rates extracted from PDF')
  return parsed
}

export default function KaiserRateUploader({ company, onRatesExtracted, planYear = '2025-2026' }) {
  const PLAN_YEAR = planYear
  const [extracting, setExtracting] = useState(false)
  const [extracted,  setExtracted]  = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setError('')
    setExtracted(null)
    setSaved(false)
    setExtracting(true)

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload  = () => res(r.result.split(',')[1])
        r.onerror = () => rej(new Error('File read failed'))
        r.readAsDataURL(file)
      })
      const rows = await extractKaiserRates(base64)
      setExtracted(rows)
    } catch (e) {
      setError('Extraction failed: ' + e.message)
    } finally {
      setExtracting(false)
    }
  }

  function updateField(index, field, value) {
    setExtracted(prev => prev.map((r, i) =>
      i === index ? { ...r, [field]: field === 'schedule' || field === 'kaiser_plan_no' || field === 'package_type' ? value : (parseFloat(value) || 0) } : r
    ))
  }

  async function handleSave() {
    if (!extracted?.length) return
    setSaving(true)
    setError('')

    try {
      const rows = extracted.map(r => ({
        company_id:        company.id,
        plan_year:         PLAN_YEAR,
        schedule:          r.schedule,
        kaiser_plan_no:    r.kaiser_plan_no,
        package_type:      r.package_type,
        premium_single:    r.premium_single,
        premium_two_party: r.premium_two_party,
        premium_family:    r.premium_family,
        medical_single:    r.medical_single,
        medical_two_party: r.medical_two_party,
        medical_family:    r.medical_family,
      }))

      const { error: dbErr } = await supabase
        .from('kaiser_rates')
        .upsert(rows, { onConflict: 'company_id,plan_year,kaiser_plan_no,package_type' })

      if (dbErr) throw new Error('Save failed: ' + dbErr.message)

      // Update company kaiser_schedule
      const schedule = extracted[0]?.schedule
      if (schedule) {
        await supabase.from('companies').update({ kaiser_schedule: schedule }).eq('id', company.id)
      }

      setSaved(true)
      onRatesExtracted?.()
    } catch (e) {
      setError(e.message || 'Save failed — an unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg border border-red-100">
          <AlertCircle size={14} className="flex-shrink-0"/>{error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className={`btn btn-teal cursor-pointer ${extracting ? 'opacity-60 pointer-events-none' : ''}`}>
          {extracting
            ? <><Loader size={14} className="animate-spin"/> Extracting rates…</>
            : <><Upload size={14}/> Upload Kaiser Pricing Sheet PDF</>}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} disabled={extracting}/>
        </label>
        {extracted && (
          <button className="btn btn-sm" onClick={() => { setExtracted(null); setSaved(false) }}>
            <RefreshCw size={13}/> Clear
          </button>
        )}
      </div>

      {extracted && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={14} className="text-kiaa-500"/>
            <span className="text-xs font-medium text-surface-600">
              Extracted {extracted.length} plan{extracted.length !== 1 ? 's' : ''} — review and edit before saving
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-surface-100">
            <table className="w-full text-xs">
              <thead className="bg-surface-50">
                <tr>
                  <th className="text-left font-semibold text-surface-400 uppercase tracking-wide px-3 py-2">Plan</th>
                  <th className="text-left font-semibold text-surface-400 uppercase tracking-wide px-3 py-2">Type</th>
                  <th className="text-right font-semibold text-surface-400 uppercase tracking-wide px-3 py-2">Single</th>
                  <th className="text-right font-semibold text-surface-400 uppercase tracking-wide px-3 py-2">2-Party</th>
                  <th className="text-right font-semibold text-surface-400 uppercase tracking-wide px-3 py-2">Family</th>
                </tr>
              </thead>
              <tbody>
                {extracted.map((row, i) => (
                  <tr key={i} className="border-t border-surface-50 hover:bg-surface-50">
                    <td className="px-3 py-2 font-mono font-semibold text-surface-700">
                      Sch {row.schedule} · Plan {row.kaiser_plan_no}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge text-xs ${row.package_type === 'full' ? 'badge-aqua' : 'badge-gray'}`}>
                        {row.package_type === 'full' ? 'Full Pkg' : 'Med/Rx'}
                      </span>
                    </td>
                    {['single','two_party','family'].map(tier => (
                      <td key={tier} className="px-3 py-2 text-right">
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-1.5 text-surface-400 text-xs pointer-events-none">$</span>
                          <input type="number" step="0.01"
                            value={row[`premium_${tier}`]}
                            onChange={e => updateField(i, `premium_${tier}`, e.target.value)}
                            className="input text-right pl-4 pr-1 py-0.5 text-xs w-24 font-mono"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader size={14} className="animate-spin"/> Saving…</>
                : <><Save size={14}/> Save {extracted.length} plan{extracted.length !== 1 ? 's' : ''}</>}
            </button>
            {saved && (
              <span className="text-sm text-kiaa-500 flex items-center gap-1.5">
                <CheckCircle size={13}/> Rates saved successfully
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
