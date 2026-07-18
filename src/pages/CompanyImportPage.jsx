import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, Download, CheckCircle, AlertCircle, Loader, Info } from 'lucide-react'

const TEMPLATE_HEADERS = [
  'name',
  'contact_name',
  'contact_email',
  'contact_phone',
  'address_line1',
  'city',
  'state',
  'zip',
  'band',
  'renewal_date',
  'status',
  'kaiser_eligible',
  'kaiser_schedule',
  'hmsa_group_no',
  'kaiser_group_no',
  'group_type',
  'aca_quarter',
].join(',')

const TEMPLATE_EXAMPLE = [
  'Aloha Staffing LLC',
  'Jane Smith',
  'jane@aloha.com',
  '808-555-0101',
  '123 Kamehameha Ave',
  'Hilo',
  'HI',
  '96720',
  '2',
  '2026-10-01',
  'active',
  'no',
  '',
  'G12345',
  '',
  'merit_rated',
  '',
].join(',')

const TEMPLATE_EXAMPLE_KAISER = [
  'Big Island Energy',
  'John Dela Cruz',
  'j@bie.com',
  '808-555-0142',
  '74-5620 Palani Rd',
  'Kailua-Kona',
  'HI',
  '96740',
  '3',
  '2026-10-01',
  'active',
  'yes',
  'B',
  'G67890',
  'K-00123',
  'merit_rated',
  '',
].join(',')

const TEMPLATE_EXAMPLE_ACA = [
  'Hilo Flowers LLC',
  'Maria Santos',
  'maria@hiloflowers.com',
  '808-555-0199',
  '456 Waianuenue Ave',
  'Hilo',
  'HI',
  '96720',
  '',
  '',
  'active',
  'no',
  '',
  'G99001',
  '',
  'aca_small_group',
  '2026-1',
].join(',')

function parseCsv(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'))
  return lines.slice(1)
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''))
      const obj = {}
      headers.forEach((h, i) => { obj[h] = vals[i] || '' })
      return obj
    })
}

export default function CompanyImportPage() {
  const [rows,     setRows]     = useState([])
  const [preview,  setPreview]  = useState(false)
  const [importing,setImporting]= useState(false)
  const [results,  setResults]  = useState([]) // {name, status, error}
  const [csvError, setCsvError] = useState('')
  const fileRef = useRef()

  function downloadTemplate() {
    const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE, TEMPLATE_EXAMPLE_KAISER, TEMPLATE_EXAMPLE_ACA].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    a.download = 'KIAA_Company_Import_Template.csv'
    a.click()
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = parseCsv(ev.target.result)
        setRows(parsed)
        setPreview(true)
        setCsvError('')
        setResults([])
      } catch(err) {
        setCsvError(err.message)
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  function handlePaste(e) {
    try {
      const parsed = parseCsv(e.target.value)
      setRows(parsed)
      setPreview(true)
      setCsvError('')
      setResults([])
    } catch(err) {
      setCsvError(err.message)
    }
  }

  async function handleImport() {
    setImporting(true)
    setResults([])
    const { data: { user } } = await supabase.auth.getUser()
    const res = []

    for (const row of rows) {
      if (!row.name?.trim()) {
        res.push({ name: '(blank)', status: 'skipped', error: 'No company name' })
        continue
      }

      // Generate random 4-digit company code
      const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => CHARS[b % CHARS.length]).join('')

      const payload = {
        name:          row.name.trim(),
        contact_name:  row.contact_name  || null,
        contact_email: row.contact_email || null,
        contact_phone: row.contact_phone || null,
        address_line1: row.address_line1 || null,
        city:          row.city          || null,
        state:         row.state         || 'HI',
        zip:           row.zip           || null,
        band:            row.band ? parseInt(row.band) : null,
        renewal_date:    row.renewal_date   || null,
        status:          row.status         || 'active',
        kaiser_eligible:  row.kaiser_eligible?.toLowerCase() === 'yes',
        kaiser_schedule:  row.kaiser_schedule?.toUpperCase() || null,
        hmsa_group_no:    row.hmsa_group_no   || null,
        kaiser_group_no:  row.kaiser_group_no  || null,
        group_type:       row.group_type       || 'merit_rated',
        aca_quarter:      row.aca_quarter       || null,
        company_code:  code,
        created_by:    user.id,
      }

      // Check if company already exists by name (case-insensitive)
      const { data: existing } = await supabase
        .from('companies')
        .select('id, company_code')
        .ilike('name', row.name.trim())
        .maybeSingle()

      if (existing) {
        // Update existing — preserve company_code and created_by
        const { company_code: _cc, created_by: _cb, ...updatePayload } = payload
        const { error: upErr } = await supabase
          .from('companies')
          .update(updatePayload)
          .eq('id', existing.id)
        res.push({
          name: row.name,
          status: upErr ? 'error' : 'updated',
          error: upErr?.message,
          code: existing.company_code,
        })
      } else {
        // Insert new company
        const { error: insErr } = await supabase
          .from('companies')
          .insert(payload)
        res.push({
          name: row.name,
          status: insErr ? 'error' : 'imported',
          error: insErr?.message,
          code,
        })
      }
    }

    setImporting(false)
    setResults(res)
    setPreview(false)
  }

  const successCount = results.filter(r => r.status === 'imported' || r.status === 'updated').length
  const errorCount   = results.filter(r => r.status === 'error').length

  return (
    <div className="p-8 page-enter max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Bulk Company Import</h1>
        <p className="text-surface-400 text-sm mt-0.5">
          Pre-load companies before they register — upload a CSV or paste data directly
        </p>
      </div>

      <div className="card bg-kiaa-50 border-kiaa-200 mb-6">
        <div className="flex items-start gap-3">
          <Info size={14} className="text-kiaa-600 flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-kiaa-700 space-y-1">
            <div>Companies are pre-loaded with a <strong>random 4-digit code</strong> automatically assigned. Share the code with each HR contact so they can register at <strong>/register</strong>.</div>
            <div>Required field: <strong>name</strong>. All other fields are optional but recommended. Use <strong>band 9</strong> for Riders-only companies (no medical coverage).</div>
            <div>If a company name already exists, the import will update their information.</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button className="btn" onClick={downloadTemplate}>
          <Download size={14}/> Download template
        </button>
        <button className="btn btn-teal" onClick={() => fileRef.current?.click()}>
          <Upload size={14}/> Upload CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile}/>
      </div>

      {/* Paste area */}
      {!preview && results.length === 0 && (
        <div className="card">
          <label className="label">Or paste CSV data directly</label>
          <textarea
            className="input font-mono text-xs"
            rows={8}
            placeholder={`${TEMPLATE_HEADERS}\n${TEMPLATE_EXAMPLE_ACA}\n...`}
            onChange={handlePaste}
          />
        </div>
      )}

      {csvError && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mt-4">
          <AlertCircle size={14}/>{csvError}
        </div>
      )}

      {/* Preview table */}
      {preview && rows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 bg-surface-50 border-b border-surface-100 flex items-center justify-between">
            <span className="text-sm font-medium text-surface-700">{rows.length} companies ready to import</span>
            <div className="flex gap-2">
              <button className="btn btn-sm" onClick={() => { setPreview(false); setRows([]) }}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleImport} disabled={importing}>
                {importing ? <><Loader size={13} className="animate-spin"/> Importing…</> : `Import ${rows.length} companies`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Band</th>
                  <th>Renewal</th>
                  <th>Status</th>
                  <th>Kaiser</th>
                  <th>Schedule</th>
                  <th>HMSA Group #</th>
                  <th>Kaiser Group #</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="font-medium">{row.name || <span className="text-red-500">Missing!</span>}</td>
                    <td>{row.contact_name || '—'}</td>
                    <td>{row.contact_email || '—'}</td>
                    <td>{row.city || '—'}</td>
                    <td>{row.band ? <span className="badge badge-aqua">Band {row.band}{row.band === '9' ? ' — Riders' : ''}</span> : '—'}</td>
                    <td>{row.renewal_date || '—'}</td>
                    <td><span className={`badge ${row.status === 'active' || !row.status ? 'badge-green' : 'badge-gray'}`}>{row.status || 'active'}</span></td>
                    <td>{row.kaiser_eligible?.toLowerCase() === 'yes' ? <span className="badge badge-blue">Yes</span> : <span className="text-surface-400 text-xs">—</span>}</td>
                    <td>{row.kaiser_schedule ? <span className="badge badge-aqua font-mono">{row.kaiser_schedule.toUpperCase()}</span> : <span className="text-surface-400 text-xs">—</span>}</td>
                    <td><span className="text-xs font-mono text-surface-600">{row.hmsa_group_no || '—'}</span></td>
                    <td><span className="text-xs font-mono text-surface-600">{row.kaiser_group_no || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 bg-surface-50 border-b border-surface-100 flex items-center gap-4">
            <span className="text-sm font-medium text-surface-700">Import complete</span>
            {successCount > 0 && <span className="badge badge-green">{successCount} imported</span>}
            {errorCount   > 0 && <span className="badge badge-red">{errorCount} errors</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Company code</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.name}</td>
                    <td>
                      <span className={`badge ${
                        r.status === 'imported' ? 'badge-green' :
                        r.status === 'updated'  ? 'badge-amber' :
                        r.status === 'skipped'  ? 'badge-gray'  : 'badge-red'
                      }`}>{r.status}</span>
                    </td>
                    <td>
                      {r.code
                        ? <span className="font-mono text-sm bg-kiaa-50 text-kiaa-700 px-2 py-0.5 rounded tracking-widest">{r.code}</span>
                        : '—'}
                    </td>
                    <td className="text-xs text-surface-400">{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {successCount > 0 && (
            <div className="px-4 py-3 bg-kiaa-50 border-t border-kiaa-200 text-xs text-kiaa-700">
              ✓ Share each company's 4-digit code with their HR contact. They register at <strong>/register</strong>.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
