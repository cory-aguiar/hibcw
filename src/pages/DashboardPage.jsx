import { usePlanYear, planYearLong } from '@/lib/PlanYearContext'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getCompliance } from '@/lib/compliance'
import { PLAN_MAP } from '@/lib/plans'
import { Building2, ShieldAlert, CalendarClock, FileText, ArrowRight, Clock } from 'lucide-react'
import { format, isAfter, addDays } from 'date-fns'

export default function DashboardPage() {
  const { activePlanYear, activePlanStart, activePlanEnd } = usePlanYear()
  const [companies, setCompanies]   = useState([])
  const [tasks, setTasks]           = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: cos }, { data: tks }] = await Promise.all([
        supabase.from('companies').select('*').order('name'),
        supabase.from('tasks').select('*,companies(name)').eq('status','pending').order('due_date').limit(8),
      ])
      setCompanies(cos || [])
      setTasks(tks || [])
      setLoading(false)
    }
    load()
  }, [])

  const cobraCount  = companies.filter(c => getCompliance(c).fedCobra.required).length
  const fmlaCount   = companies.filter(c => getCompliance(c).fmla.required).length
  const erisakCount = companies.filter(c => getCompliance(c).erisa5500.required).length
  const upcoming    = companies.filter(c => {
    if (!c.renewal_date) return false
    const d = new Date(c.renewal_date)
    return isAfter(d, new Date()) && !isAfter(d, addDays(new Date(), 60))
  }).length

  if (loading) return <div className="p-8 text-surface-400">Loading…</div>

  return (
    <div className="p-8 page-enter">
      <div className="mb-7">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">Dashboard</h1>
        <p className="text-surface-400 text-sm mt-1">Plan year: {activePlanStart} – {activePlanEnd}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total companies', value: companies.length, icon: Building2, color: 'text-kiaa-600', to: '/companies' },
          { label: 'Federal COBRA required', value: cobraCount, icon: ShieldAlert, color: 'text-amber-600', to: '/compliance' },
          { label: 'FMLA required', value: fmlaCount, icon: ShieldAlert, color: 'text-amber-600', to: '/compliance' },
          { label: 'Renewals in 60 days', value: upcoming, icon: CalendarClock, color: 'text-kiaa-500', to: '/renewals' },
        ].map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="metric-card card-hover block">
            <div className="flex items-start justify-between">
              <span className="metric-label">{label}</span>
              <Icon size={16} className={`${color} opacity-60`} />
            </div>
            <div className={`metric-value ${color}`}>{value}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent companies */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Recent companies</h2>
            <Link to="/companies" className="text-xs text-kiaa-500 hover:text-kiaa-700 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {companies.length === 0 ? (
            <p className="text-surface-400 text-sm py-4 text-center">No companies yet — <Link to="/companies" className="text-kiaa-600">add one</Link></p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Company</th><th>Employees</th><th>Status</th></tr>
              </thead>
              <tbody>
                {companies.slice(0,6).map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/companies/${c.id}`} className="font-medium text-kiaa-600 hover:text-kiaa-800">{c.name}</Link>
                    </td>
                    <td className="text-surface-500">{c.employee_count}</td>
                    <td><span className={`status-${c.status}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pending tasks */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Pending tasks</h2>
            <Link to="/renewals" className="text-xs text-kiaa-500 hover:text-kiaa-700 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {tasks.length === 0 ? (
            <p className="text-surface-400 text-sm py-4 text-center">No pending tasks</p>
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 hover:bg-kiaa-50/50 transition-colors">
                  <Clock size={14} className="text-kiaa-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-700 truncate">{t.title}</div>
                    <div className="text-xs text-surface-400">{t.companies?.name}</div>
                  </div>
                  {t.due_date && (
                    <span className="text-xs text-surface-400 flex-shrink-0">
                      {format(new Date(t.due_date), 'MMM d')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ERISA callout */}
      {erisakCount > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <FileText size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-800">Form 5500 reminder</div>
            <div className="text-sm text-amber-700 mt-0.5">
              {erisakCount} {erisakCount === 1 ? 'company has' : 'companies have'} 100+ participants and must file Form 5500 annually.{' '}
              <Link to="/compliance" className="underline">View compliance dashboard</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
