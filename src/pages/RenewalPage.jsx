import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { Plus, X, Save, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { format, isAfter, isBefore, addDays } from 'date-fns'

const STATUS_COLORS = { pending:'badge-amber', in_progress:'badge-blue', complete:'badge-green', dismissed:'badge-gray' }
const CAT_COLORS    = { renewal:'badge-aqua', cobra:'badge-red', fmla:'badge-blue', enrollment:'badge-green', compliance:'badge-amber', general:'badge-gray' }

export default function RenewalPage() {
  const [tasks,     setTasks]     = useState([])
  const [companies, setCompanies] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [filter,    setFilter]    = useState('pending')
  const { user, isStaff } = useAuth()

  const [form, setForm] = useState({
    company_id:'', title:'', description:'', due_date:'', category:'general', status:'pending'
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: tks }, { data: cos }] = await Promise.all([
      supabase.from('tasks').select('*,companies(name)').order('due_date', { nullsFirst: false }),
      supabase.from('companies').select('id,name').eq('status','active').order('name'),
    ])
    setTasks(tks || [])
    setCompanies(cos || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  const overdue   = tasks.filter(t => t.due_date && isBefore(new Date(t.due_date), new Date()) && t.status === 'pending').length
  const upcoming7 = tasks.filter(t => t.due_date && isAfter(new Date(t.due_date), new Date()) && isBefore(new Date(t.due_date), addDays(new Date(),7)) && t.status !== 'complete').length

  async function saveTask() {
    if (!form.title.trim() || !form.company_id) return
    setSaving(true)
    await supabase.from('tasks').insert({ ...form, created_by: user.id })
    setSaving(false)
    setModal(false)
    setForm({ company_id:'', title:'', description:'', due_date:'', category:'general', status:'pending' })
    load()
  }

  async function updateStatus(id, status) {
    await supabase.from('tasks').update({ status }).eq('id', id)
    load()
  }

  return (
    <div className="p-8 page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-700">Renewals &amp; Tasks</h1>
          <p className="text-surface-400 text-sm mt-0.5">Track deadlines, renewals, and compliance reminders</p>
        </div>
        {isStaff && <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> Add task</button>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="metric-card"><div className="metric-label">Overdue</div><div className="metric-value text-red-600">{overdue}</div></div>
        <div className="metric-card"><div className="metric-label">Due in 7 days</div><div className="metric-value text-amber-600">{upcoming7}</div></div>
        <div className="metric-card"><div className="metric-label">Total tasks</div><div className="metric-value">{tasks.length}</div></div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {['pending','in_progress','complete','all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`btn btn-sm capitalize ${filter === s ? 'btn-primary' : ''}`}>
            {s.replace('_',' ')}
          </button>
        ))}
      </div>

      {loading ? <div className="text-surface-400 text-sm">Loading…</div> : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="card text-center text-surface-400 text-sm py-8">No tasks found</div>
          ) : filtered.map(t => {
            const isOverdue = t.due_date && isBefore(new Date(t.due_date), new Date()) && t.status === 'pending'
            return (
              <div key={t.id} className={`card flex items-start gap-4 py-3 ${isOverdue ? 'border-red-200 bg-red-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-surface-700 text-sm">{t.title}</span>
                    <span className={`badge ${CAT_COLORS[t.category]}`}>{t.category}</span>
                    <span className={`badge ${STATUS_COLORS[t.status]}`}>{t.status.replace('_',' ')}</span>
                    {isOverdue && <span className="badge badge-red flex items-center gap-1"><AlertCircle size={10}/> Overdue</span>}
                  </div>
                  <div className="text-xs text-surface-400 mt-1">{t.companies?.name}{t.description ? ` — ${t.description}` : ''}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.due_date && (
                    <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-surface-400'}`}>
                      {format(new Date(t.due_date), 'MMM d, yyyy')}
                    </span>
                  )}
                  {isStaff && t.status !== 'complete' && (
                    <button className="btn btn-sm badge-green" onClick={() => updateStatus(t.id,'complete')}>
                      <CheckCircle size={12}/> Done
                    </button>
                  )}
                  {isStaff && t.status === 'pending' && (
                    <button className="btn btn-sm" onClick={() => updateStatus(t.id,'in_progress')}>
                      <Clock size={12}/> Start
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="font-display text-base font-semibold text-kiaa-700">Add task / reminder</h2>
              <button className="btn btn-icon" onClick={() => setModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="label">Company *</label>
                <select className="input" value={form.company_id} onChange={e => setForm(f=>({...f,company_id:e.target.value}))}>
                  <option value="">— select company —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Task title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Send COBRA election notice" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {['renewal','cobra','fmla','enrollment','compliance','general'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Due date</label>
                  <input className="input" type="date" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input h-16 resize-none" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTask} disabled={saving}>
                <Save size={14}/> {saving ? 'Saving…' : 'Save task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
