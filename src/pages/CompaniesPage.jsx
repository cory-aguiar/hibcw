import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PLAN_MAP } from '@/lib/plans'
import { Plus, Search, ChevronRight, Pencil, Trash2, Copy, Check, Download, X } from 'lucide-react'
import CompanyModal from '@/components/CompanyModal'

const BANDS = ['1','2','3','4','5','6','7','8','9']

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([])
  const [filtered,  setFiltered]  = useState([])
  const [search,    setSearch]    = useState('')
  const [filterType,   setFilterType]   = useState('all')   // all | merit_rated | aca_small_group
  const [filterStatus, setFilterStatus] = useState('all')   // all | active | inactive
  const [filterBand,   setFilterBand]   = useState('all')   // all | 1-9
  const [filterOE,     setFilterOE]     = useState('all')   // all | pending | confirmed | submitted
  const [filterKaiser, setFilterKaiser] = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [copiedId,  setCopiedId]  = useState(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    let out = companies
    if (search)              out = out.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name||'').toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_email||'').toLowerCase().includes(search.toLowerCase())
    )
    if (filterType   !== 'all') out = out.filter(c => (c.group_type || 'merit_rated') === filterType)
    if (filterStatus !== 'all') out = out.filter(c => (c.status || 'active') === filterStatus)
    if (filterBand   !== 'all') out = out.filter(c => String(c.band) === filterBand)
    if (filterOE     !== 'all') out = out.filter(c => c.oe_status === filterOE)
    if (filterKaiser)           out = out.filter(c => c.kaiser_eligible)
    setFiltered(out)
  }, [search, filterType, filterStatus, filterBand, filterOE, filterKaiser, companies])

  async function load() {
    const { data } = await supabase.from('companies').select('*').order('name')
    setCompanies(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  function clearFilters() {
    setSearch('')
    setFilterType('all')
    setFilterStatus('all')
    setFilterBand('all')
    setFilterOE('all')
    setFilterKaiser(false)
  }

  const hasActiveFilters = search || filterType !== 'all' || filterStatus !== 'all' ||
    filterBand !== 'all' || filterOE !== 'all' || filterKaiser

  function copyCode(id, code) {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function openAdd()      { setEditing(null); setModal(true) }
  function openEdit(c)    { setEditing(c);    setModal(true) }
  function closeModal()   { setModal(false);  setEditing(null) }
  async function onSaved(){ closeModal(); load() }

  async function deleteCompany(id) {
    if (!confirm('Remove this company and all associated tasks?')) return
    await supabase.from('companies').delete().eq('id', id)
    load()
  }

  function downloadCsv() {
    const headers = [
      'name','contact_name','contact_email','contact_phone',
      'address_line1','city','state','zip',
      'band','renewal_date','status',
      'kaiser_eligible','kaiser_schedule',
      'hmsa_group_no','kaiser_group_no','group_type','aca_quarter',
    ]
    const esc = v => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s
    }
    // Export filtered list, not all companies
    const rows = filtered.map(co => [
      co.name, co.contact_name, co.contact_email, co.contact_phone,
      co.address_line1, co.city, co.state, co.zip,
      co.band || '', co.renewal_date || '', co.status || 'active',
      co.kaiser_eligible ? 'yes' : 'no', co.kaiser_schedule || '',
      co.hmsa_group_no || '', co.kaiser_group_no || '', co.group_type || 'merit_rated',
      co.aca_quarter || '',
    ].map(esc).join(','))
    const csv  = [headers.join(','), ...rows].join('\n')
    const url  = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    const a    = Object.assign(document.createElement('a'), { href:url, download:`KIAA_Companies_${new Date().toISOString().slice(0,10)}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-700">Companies</h1>
          <p className="text-surface-400 text-sm mt-0.5">
            {hasActiveFilters
              ? <>{filtered.length} of {companies.length} shown</>
              : <>{companies.length} client{companies.length !== 1 ? 's' : ''} registered</>
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={downloadCsv}>
            <Download size={14}/> Export CSV{hasActiveFilters ? ` (${filtered.length})` : ''}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15}/> Add company
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="card mb-5 space-y-3">
        {/* Search row */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, contact, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter chips row */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Group type */}
          <div className="flex items-center gap-1 bg-surface-50 border border-surface-100 rounded-lg p-1">
            {[['all','All types'],['merit_rated','MRG'],['aca_small_group','ACA']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterType(v)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                  filterType === v
                    ? 'bg-kiaa-600 text-white font-semibold shadow-sm'
                    : 'text-surface-500 hover:text-kiaa-600'
                }`}>
                {l}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex items-center gap-1 bg-surface-50 border border-surface-100 rounded-lg p-1">
            {[['all','All status'],['active','Active'],['inactive','Inactive']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                  filterStatus === v
                    ? 'bg-kiaa-600 text-white font-semibold shadow-sm'
                    : 'text-surface-500 hover:text-kiaa-600'
                }`}>
                {l}
              </button>
            ))}
          </div>

          {/* OE Status */}
          <div className="flex items-center gap-1 bg-surface-50 border border-surface-100 rounded-lg p-1">
            <span className="text-xs text-surface-400 px-1.5 font-medium">OE:</span>
            {[['all','All'],['pending','Pending'],['confirmed','Confirmed'],['submitted','Submitted']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterOE(v)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                  filterOE === v
                    ? 'bg-kiaa-600 text-white font-semibold shadow-sm'
                    : 'text-surface-500 hover:text-kiaa-600'
                }`}>
                {l}
              </button>
            ))}
          </div>

          {/* Band selector — only relevant for MRG */}
          {filterType !== 'aca_small_group' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-surface-400 font-medium">Band:</span>
              <select
                className="input text-xs py-1 w-auto"
                value={filterBand}
                onChange={e => setFilterBand(e.target.value)}
              >
                <option value="all">All</option>
                {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}

          {/* Kaiser toggle */}
          <button
            onClick={() => setFilterKaiser(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filterKaiser
                ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                : 'bg-white text-surface-500 border-surface-200 hover:border-blue-400'
            }`}>
            Kaiser only
          </button>

          {/* Clear */}
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="text-xs px-2.5 py-1.5 rounded-full border border-surface-200 text-surface-400 hover:text-surface-600 hover:border-surface-300 flex items-center gap-1 transition-all">
              <X size={11}/> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-surface-400 text-sm">{hasActiveFilters ? 'No companies match these filters.' : 'No companies yet'}</p>
            {hasActiveFilters
              ? <button className="btn mt-3 mx-auto" onClick={clearFilters}><X size={13}/> Clear filters</button>
              : <button className="btn btn-primary mt-3 mx-auto" onClick={openAdd}><Plus size={14}/> Add first company</button>
            }
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Code</th>
                <th>Employees</th>
                <th>Plans enrolled</th>
                <th>Renewal date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/companies/${c.id}`} className="font-medium text-kiaa-600 hover:text-kiaa-800 flex items-center gap-1">
                      {c.name} <ChevronRight size={12} className="opacity-40"/>
                    </Link>
                    {c.contact_name && <div className="text-xs text-surface-400 mb-1">{c.contact_name}</div>}
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {/* Group type pill */}
                      {c.group_type === 'aca_small_group' ? (
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">ACA</span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-kiaa-100 text-kiaa-700">MRG</span>
                      )}
                      {/* Band pill */}
                      {c.band && (
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Band {c.band}</span>
                      )}
                      {/* ACA quarter pill */}
                      {c.aca_quarter && (
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Q{c.aca_quarter.split('-')[1]}</span>
                      )}
                      {/* OE status pill */}
                      {c.oe_status && c.oe_status !== 'pending' && (
                        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                          c.oe_status === 'submitted' ? 'bg-emerald-100 text-emerald-700' :
                          c.oe_status === 'confirmed' ? 'bg-sky-100 text-sky-700' :
                          'bg-surface-100 text-surface-500'
                        }`}>{c.oe_status.charAt(0).toUpperCase() + c.oe_status.slice(1)}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {c.company_code ? (
                      <button
                        onClick={() => copyCode(c.id, c.company_code)}
                        className="flex items-center gap-1.5 group"
                        title="Copy code"
                      >
                        <span className="font-mono text-sm font-bold bg-kiaa-50 text-kiaa-700 px-2.5 py-0.5 rounded tracking-widest border border-kiaa-200">
                          {c.company_code}
                        </span>
                        <span className="text-surface-300 group-hover:text-kiaa-500 transition-colors">
                          {copiedId === c.id ? <Check size={12} className="text-kiaa-500"/> : <Copy size={12}/>}
                        </span>
                      </button>
                    ) : <span className="text-surface-400 text-xs">—</span>}
                  </td>
                  <td className="text-surface-600">{c.headcount || c.employee_count}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.group_type === 'aca_small_group' ? (
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">ACA Small Group</span>
                      ) : (
                        <>
                          {(c.plans||[]).slice(0,3).map(pid => {
                            const plan = PLAN_MAP[pid]
                            const name = plan?.shortName || pid
                            // Color by plan family
                            const cls = pid.includes('ppp')
                              ? 'bg-kiaa-100 text-kiaa-700'
                              : pid.includes('compmed_a') || pid === 'aca_cm_a'
                              ? 'bg-teal-100 text-teal-700'
                              : pid.includes('compmed_b')
                              ? 'bg-cyan-100 text-cyan-700'
                              : pid.includes('hph_plus')
                              ? 'bg-emerald-100 text-emerald-700'
                              : pid.includes('hph_basic')
                              ? 'bg-green-100 text-green-700'
                              : pid.includes('riders')
                              ? 'bg-slate-100 text-slate-600'
                              : pid.includes('compcare')
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-surface-100 text-surface-600'
                            return (
                              <span key={pid} className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
                                {name}
                              </span>
                            )
                          })}
                          {(c.plans||[]).length > 3 && (
                            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-100 text-surface-500">+{c.plans.length-3}</span>
                          )}
                          {c.kaiser_eligible && (
                            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              Kaiser{c.kaiser_schedule ? ` Sch.${c.kaiser_schedule}` : ''}
                            </span>
                          )}
                          {(!c.plans || c.plans.length === 0) && !c.kaiser_eligible && (
                            <span className="text-xs text-surface-400">—</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="text-surface-500 text-sm">
                    {c.renewal_date ? (() => { const [y,m,d] = c.renewal_date.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) })() : '—'}
                  </td>
                  <td><span className={`status-${c.status}`}>{c.status}</span></td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button className="btn btn-sm btn-icon" onClick={() => openEdit(c)} title="Edit"><Pencil size={13}/></button>
                      <button className="btn btn-sm btn-icon btn-danger" onClick={() => deleteCompany(c.id)} title="Delete"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && <CompanyModal company={editing} onClose={closeModal} onSaved={onSaved} />}
    </div>
  )
}
