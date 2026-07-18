import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { Plus, ExternalLink, Trash2, X, Save } from 'lucide-react'

const CATEGORIES = [
  { id: 'enrollment', label: 'Enrollment',  icon: '📋' },
  { id: 'cobra',      label: 'COBRA',        icon: '🛡️' },
  { id: 'fmla',       label: 'FMLA',         icon: '🏥' },
  { id: 'hipaa',      label: 'HIPAA',        icon: '🔒' },
  { id: 'hmsa',       label: 'HMSA',         icon: '🏢' },
  { id: 'other',      label: 'Other',        icon: '📎' },
]

export default function FormsPage() {
  const [forms,   setForms]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const { isStaff } = useAuth()

  const [newForm, setNewForm] = useState({ name:'', category:'enrollment', url:'', description:'' })
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('forms').select('*').eq('is_active', true).order('name')
    setForms(data || [])
    setLoading(false)
  }

  async function saveForm() {
    if (!newForm.name.trim()) return
    setSaving(true)
    await supabase.from('forms').insert({ ...newForm })
    setSaving(false)
    setModal(false)
    setNewForm({ name:'', category:'enrollment', url:'', description:'' })
    load()
  }

  async function deleteForm(id) {
    if (!confirm('Remove this form?')) return
    await supabase.from('forms').update({ is_active: false }).eq('id', id)
    load()
  }

  return (
    <div className="p-8 page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-700">Forms &amp; Links</h1>
          <p className="text-surface-400 text-sm mt-0.5">Enrollment forms, COBRA notices, FMLA docs, and HMSA resources</p>
        </div>
        {isStaff && (
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={15}/> Add form / link
          </button>
        )}
      </div>

      {loading ? <div className="text-surface-400 text-sm">Loading…</div> : (
        <div className="space-y-6">
          {CATEGORIES.map(cat => {
            const items = forms.filter(f => f.category === cat.id)
            if (!items.length) return null
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{cat.icon}</span>
                  <h2 className="font-display font-semibold text-kiaa-700 text-sm uppercase tracking-wide">{cat.label}</h2>
                  <span className="badge badge-gray">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(f => (
                    <div key={f.id} className="card card-hover flex items-start gap-3 py-3 px-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-surface-700 text-sm">{f.name}</div>
                        {f.description && <div className="text-xs text-surface-400 mt-0.5">{f.description}</div>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {f.url
                          ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-teal"><ExternalLink size={12}/> Open</a>
                          : <span className="text-xs text-surface-400">No URL</span>}
                        {isStaff && (
                          <button className="btn btn-sm btn-icon btn-danger" onClick={() => deleteForm(f.id)}><Trash2 size={12}/></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add modal */}
      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="font-display text-base font-semibold text-kiaa-700">Add form / link</h2>
              <button className="btn btn-icon" onClick={() => setModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="label">Form name *</label>
                <input className="input" value={newForm.name} onChange={e => setNewForm(f=>({...f,name:e.target.value}))} placeholder="COBRA Election Notice" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={newForm.category} onChange={e => setNewForm(f=>({...f,category:e.target.value}))}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">URL / JotForm link</label>
                <input className="input" type="url" value={newForm.url} onChange={e => setNewForm(f=>({...f,url:e.target.value}))} placeholder="https://form.jotform.com/…" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input h-16 resize-none" value={newForm.description} onChange={e => setNewForm(f=>({...f,description:e.target.value}))} placeholder="Brief description" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>
                <Save size={14}/> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
