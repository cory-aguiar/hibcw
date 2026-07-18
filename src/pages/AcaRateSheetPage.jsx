/**
 * AcaRateSheetPage
 * Admin tool to upload and manage ACA Small Group age-based rate tables.
 * Rates are uploaded per quarter and stored in aca_rates table.
 * Supports upload from Excel (HMSA2026.xlsx format) or CSV.
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { Upload, Loader, CheckCircle, AlertCircle, Trash2, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'

const ACA_PLANS = [
  { id: 'aca_cm_a',    name: 'CompMED A',             short: 'CM-A' },
  { id: 'aca_hph_plus',name: 'Health Plan Hawaii Plus', short: 'HPH-A' },
  { id: 'aca_ppp',     name: 'PPP',                    short: 'PPP-A' },
]

const QUARTERS = [
  { value: '1', label: 'Q1 (Jan–Mar)' },
  { value: '2', label: 'Q2 (Apr–Jun)' },
  { value: '3', label: 'Q3 (Jul–Sep)' },
  { value: '4', label: 'Q4 (Oct–Dec)' },
]

export default function AcaRateSheetPage() {
  const { user } = useAuth()
  const [year,       setYear]       = useState('2026')
  const [quarter,    setQuarter]    = useState('1')
  const [loaded,     setLoaded]     = useState({}) // plan_id -> { min, max, count, sample }
  const [uploading,  setUploading]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [preview,    setPreview]    = useState(null) // { quarter, rows: [{plan_id, age, premium}] }
  const fileRef = useRef()

  const qKey = `${year}-${quarter}`

  useEffect(() => { loadExisting() }, [qKey])

  async function loadExisting() {
    setLoaded({})
    const { data } = await supabase.from('aca_rates').select('plan_id, age, premium')
      .eq('quarter', qKey).order('plan_id').order('age')
    if (!data?.length) return
    const grouped = {}
    data.forEach(r => {
      if (!grouped[r.plan_id]) grouped[r.plan_id] = []
      grouped[r.plan_id].push(r)
    })
    const summary = {}
    Object.entries(grouped).forEach(([pid, rows]) => {
      summary[pid] = {
        count:   rows.length,
        minAge:  Math.min(...rows.map(r => r.age)),
        maxAge:  Math.max(...rows.map(r => r.age)),
        minPrem: Math.min(...rows.map(r => parseFloat(r.premium))),
        maxPrem: Math.max(...rows.map(r => parseFloat(r.premium))),
      }
    })
    setLoaded(summary)
  }

  async function handleFile(file) {
    if (!file) return
    setError('')
    setPreview(null)
    setUploading(true)

    try {
      const ext = file.name.split('.').pop().toLowerCase()
      let rows = []

      if (ext === 'xlsx' || ext === 'xls') {
        // Read Excel — expect HMSA format with sheets Q1-26, Q2-26, etc.
        // Use FileReader for better browser compatibility
        const buf = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result)
          reader.onerror = reject
          reader.readAsBinaryString(file)
        })
        const wb = XLSX.read(buf, { type: 'binary' })
        // Find the sheet matching the selected quarter
        // Match sheet name — handles formats like Q1-26, Q1-2026, Q1 2026, Q1
        const sheetName = wb.SheetNames.find(n => {
          const nl = n.toLowerCase()
          return nl.startsWith(`q${quarter}-`) || nl.startsWith(`q${quarter} `) || nl === `q${quarter}`
        }) || wb.SheetNames[0]
        console.log('Using sheet:', sheetName, 'from available:', wb.SheetNames)
        const ws   = wb.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(ws)

        const planMap = { 'CM-A': 'aca_cm_a', 'HPH-A': 'aca_hph_plus', 'PPP-A': 'aca_ppp' }
        console.log('Sample row keys:', data[0] ? Object.keys(data[0]) : 'no data')
        console.log('Sample row:', data[0])
        data.forEach(row => {
          // Try every possible key name SheetJS might use
          const shortPlan = row['Short_Plan_Name'] || row['Short Plan Name'] || row['SHORT_PLAN_NAME']
          const planId = planMap[shortPlan]
          if (!planId) return
          const age = parseInt(row['Age'] ?? row['age'] ?? row['AGE'])
          // Try every possible premium key — SheetJS sometimes adds trailing spaces
          const premKey = Object.keys(row).find(k => k.trim() === 'Premium' || k.trim() === 'HMSA')
          const rawPrem = premKey ? row[premKey] : null
          const premium = Number(rawPrem)
          if (isNaN(age) || !premium || premium <= 0) return
          rows.push({ plan_id: planId, age, premium })
        })
      } else {
        // CSV: supports both quarter,plan_id,age,premium and plan_id,age,premium
        const text    = await file.text()
        const lines   = text.trim().replace(/\r/g, '').split('\n')
        const header  = lines[0].toLowerCase().split(',').map(h => h.trim())
        const hasQuarter = header.includes('quarter')
        const colPlan    = header.indexOf(hasQuarter ? 'plan_id' : 'plan_id')
        const colAge     = header.indexOf('age')
        const colPrem    = header.indexOf('premium')
        const colQuarter = header.indexOf('quarter')
        lines.slice(1).forEach(line => {
          const parts   = line.split(',')
          const plan_id = parts[colPlan]?.trim()
          const age     = parseInt(parts[colAge])
          const premium = parseFloat(parts[colPrem])
          const rowQ    = hasQuarter ? parts[colQuarter]?.trim() : qKey
          if (!plan_id || isNaN(age) || isNaN(premium) || premium <= 0) return
          // Only include rows matching the selected quarter
          if (rowQ && rowQ !== qKey) return
          rows.push({ plan_id, age, premium })
        })
      }

      if (!rows.length) { setError('No valid rows found in file.'); setUploading(false); return }

      // Deduplicate — keep last value per plan+age
      const deduped = {}
      rows.forEach(r => { deduped[`${r.plan_id}_${r.age}`] = r })
      rows = Object.values(deduped)

      setPreview({ quarter: qKey, rows })
      setUploading(false)
    } catch (e) {
      setError('Failed to read file: ' + e.message)
      setUploading(false)
    }
  }

  async function confirmAndSave() {
    if (!preview?.rows?.length) return
    setSaving(true)
    setError('')

    // Delete existing for this quarter
    await supabase.from('aca_rates').delete().eq('quarter', qKey)

    // Insert in batches of 200
    const rows = preview.rows
      .filter(r => r.age != null && !isNaN(r.age) && r.premium != null && !isNaN(r.premium) && r.premium > 0)
      .map(r => ({
        plan_year:  year,
        quarter:    qKey,
        plan_id:    r.plan_id,
        age:        r.age,
        premium:    parseFloat(parseFloat(r.premium).toFixed(2)),
        created_by: user.id,
      }))

    const BATCH = 200
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      console.log('Sample row:', JSON.stringify(batch[0]))
      const { error: err, status } = await supabase.from('aca_rates').insert(batch)
      if (err) {
        console.error('Insert error:', JSON.stringify(err), 'status:', status)
        setError('Save failed: ' + (err.message || err.details || err.hint || JSON.stringify(err)))
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setPreview(null)
    setSuccess(`${rows.length} rates saved for ${qKey}.`)
    setTimeout(() => setSuccess(''), 4000)
    loadExisting()
  }

  async function handleDelete() {
    if (!confirm(`Delete all ACA rates for ${qKey}?`)) return
    await supabase.from('aca_rates').delete().eq('quarter', qKey)
    loadExisting()
    setLoaded({})
  }

  const fmt = v => `$${parseFloat(v).toFixed(2)}`
  const hasRates = Object.keys(loaded).length > 0

  return (
    <div className="p-8 page-enter max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">ACA Rate Sheet Manager</h1>
        <p className="text-surface-400 text-sm mt-0.5">Upload quarterly age-based rates for ACA Small Group plans</p>
      </div>

      {/* Quarter selector */}
      <div className="card mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="label">Plan year</label>
            <input className="input w-24 font-mono" value={year}
              onChange={e => setYear(e.target.value)} placeholder="2026"/>
          </div>
          <div>
            <label className="label">Quarter</label>
            <select className="input" value={quarter} onChange={e => setQuarter(e.target.value)}>
              {QUARTERS.map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>
          <div className="pt-5">
            <span className="badge badge-aqua font-mono text-sm">Active: {qKey}</span>
          </div>
        </div>
      </div>

      {/* Current rates summary */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title mb-0">Rates on file — {qKey}</h2>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-icon" onClick={loadExisting} title="Refresh">
              <RefreshCw size={13}/>
            </button>
            {hasRates && (
              <button className="btn btn-sm btn-icon text-red-400 hover:text-red-600"
                onClick={handleDelete} title="Delete all rates for this quarter">
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        </div>

        {!hasRates ? (
          <p className="text-sm text-surface-400 italic">No rates loaded for {qKey}.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {ACA_PLANS.map(plan => {
              const s = loaded[plan.id]
              if (!s) return (
                <div key={plan.id} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl text-sm">
                  <span className="w-2 h-2 rounded-full bg-surface-300 flex-shrink-0"/>
                  <span className="text-surface-400">{plan.name} — not loaded</span>
                </div>
              )
              return (
                <div key={plan.id} className="flex items-center gap-3 p-3 bg-kiaa-50/50 rounded-xl text-sm">
                  <CheckCircle size={14} className="text-kiaa-500 flex-shrink-0"/>
                  <span className="font-medium text-surface-700 flex-1">{plan.name}</span>
                  <span className="text-surface-500 text-xs">
                    {s.count} ages &nbsp;·&nbsp; {fmt(s.minPrem)} – {fmt(s.maxPrem)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="card mb-5">
        <h2 className="section-title">Upload rates</h2>
        <p className="text-sm text-surface-400 mb-4">
          Upload the HMSA Excel rate sheet (HMSA2026.xlsx) or a CSV with columns:
          <code className="ml-1 text-xs bg-surface-100 px-1 py-0.5 rounded">plan_id, age, premium</code>
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
            <AlertCircle size={14}/>{error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-kiaa-50 text-kiaa-700 text-sm px-3 py-2.5 rounded-lg mb-4">
            <CheckCircle size={14}/>{success}
          </div>
        )}

        {!preview ? (
          <label className={`btn btn-primary cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploading
              ? <><Loader size={13} className="animate-spin"/> Reading file…</>
              : <><Upload size={13}/> Choose Excel or CSV file</>}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" ref={fileRef}
              onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }}
              disabled={uploading}/>
          </label>
        ) : (
          <div>
            <div className="mb-4">
              <div className="text-sm font-medium text-surface-700 mb-2">Preview — {preview.rows.length} rows ready to import</div>
              <div className="grid grid-cols-1 gap-2">
                {ACA_PLANS.map(plan => {
                  const planRows = preview.rows.filter(r => r.plan_id === plan.id)
                  if (!planRows.length) return null
                  const prems = planRows.map(r => r.premium)
                  return (
                    <div key={plan.id} className="flex items-center gap-3 p-3 bg-kiaa-50 rounded-xl text-sm">
                      <span className="w-2 h-2 rounded-full bg-kiaa-500 flex-shrink-0"/>
                      <span className="font-medium text-surface-700 flex-1">{plan.name}</span>
                      <span className="text-surface-500 text-xs">
                        {planRows.length} ages &nbsp;·&nbsp;
                        {fmt(Math.min(...prems))} – {fmt(Math.max(...prems))}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn btn-primary" onClick={confirmAndSave} disabled={saving}>
                {saving ? <><Loader size={13} className="animate-spin"/> Saving…</> : <><CheckCircle size={13}/> Save {preview.rows.length} rates</>}
              </button>
              <button className="btn" onClick={() => setPreview(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* CSV format reference */}
      <div className="card bg-surface-50 text-xs text-surface-500 space-y-1">
        <div className="font-medium text-surface-700 mb-2">CSV format (if not using HMSA Excel)</div>
        <div>Headers: <code className="bg-white px-1 rounded">plan_id,age,premium</code></div>
        <div>Plan IDs: <code className="bg-white px-1 rounded">aca_cm_a</code> · <code className="bg-white px-1 rounded">aca_hph_plus</code> · <code className="bg-white px-1 rounded">aca_ppp</code></div>
        <div>Ages: 0–99 &nbsp;·&nbsp; One row per plan per age</div>
      </div>
    </div>
  )
}
