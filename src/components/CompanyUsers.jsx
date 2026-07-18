import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Users, Loader, AlertCircle, ShieldOff, ShieldCheck, Trash2, Mail, Phone
} from 'lucide-react'

export default function CompanyUsers({ company }) {
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [busyId,    setBusyId]    = useState(null)   // user id currently being acted on
  const [confirmDelete, setConfirmDelete] = useState(null) // user pending delete confirmation

  useEffect(() => {
    if (company?.id) loadUsers()
  }, [company?.id])

  async function loadUsers() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, full_name, phone, role, access_revoked, created_at')
      .eq('company_id', company.id)
      .eq('role', 'hr_client')
      .order('created_at')

    if (err) setError(err.message)
    setUsers(data || [])
    setLoading(false)
  }

  async function callApi(path, body) {
    const res = await fetch(path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Request failed')
    return json
  }

  async function handleRevokeToggle(user) {
    setBusyId(user.id)
    setError('')
    try {
      await callApi('/api/revoke-access', {
        userId: user.id,
        action: user.access_revoked ? 'restore' : 'revoke',
      })
      await loadUsers()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(user) {
    setBusyId(user.id)
    setError('')
    try {
      await callApi('/api/delete-user', { userId: user.id })
      setConfirmDelete(null)
      await loadUsers()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-surface-400 text-sm py-4">
      <Loader size={14} className="animate-spin"/> Loading users…
    </div>
  )

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
          <AlertCircle size={14}/>{error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="text-sm text-surface-400 italic flex items-center gap-2">
          <Users size={14}/> No HR users have registered for this company yet.
        </div>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-surface-50">
          {users.map(user => {
            const isBusy = busyId === user.id
            const name   = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email

            return (
              <div key={user.id}
                className={`flex items-center gap-4 px-4 py-3 ${user.access_revoked ? 'bg-red-50/30' : 'bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-700 flex items-center gap-2">
                    {name}
                    {user.access_revoked && (
                      <span className="badge badge-red text-xs">Access revoked</span>
                    )}
                  </div>
                  <div className="text-xs text-surface-400 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Mail size={11}/>{user.email}</span>
                    {user.phone && <span className="flex items-center gap-1"><Phone size={11}/>{user.phone}</span>}
                    <span>Registered {new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    className={`btn btn-sm ${user.access_revoked ? 'btn-teal' : ''}`}
                    onClick={() => handleRevokeToggle(user)}
                    disabled={isBusy}
                    title={user.access_revoked ? 'Restore access' : 'Revoke access'}>
                    {isBusy
                      ? <Loader size={13} className="animate-spin"/>
                      : user.access_revoked ? <ShieldCheck size={13}/> : <ShieldOff size={13}/>}
                    {user.access_revoked ? 'Restore access' : 'Revoke access'}
                  </button>

                  {confirmDelete === user.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-600">Permanently delete?</span>
                      <button className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
                        onClick={() => handleDelete(user)} disabled={isBusy}>
                        {isBusy ? <Loader size={13} className="animate-spin"/> : 'Confirm'}
                      </button>
                      <button className="btn btn-sm" onClick={() => setConfirmDelete(null)} disabled={isBusy}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-icon text-red-400 hover:text-red-600"
                      onClick={() => setConfirmDelete(user.id)} disabled={isBusy} title="Delete permanently">
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs text-surface-400 mt-2">
        <strong>Revoke access</strong> blocks sign-in immediately but keeps the account and can be undone.{' '}
        <strong>Delete</strong> permanently removes the account and cannot be undone.
      </div>
    </div>
  )
}
