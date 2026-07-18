import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Building2, ShieldCheck, FileText,
  GitCompare, BookOpen, CalendarClock, LogOut, Settings,
  FileSignature, ClipboardList, DollarSign, ClipboardCheck,
  Library, FileUp, Calculator, UserPlus, TrendingUp
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Companies',
    items: [
      { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/companies', icon: Building2,        label: 'Companies' },
      { to: '/import',    icon: FileUp,           label: 'Import Companies' },
      { to: '/prospects', icon: UserPlus,         label: 'Prospects', badge: true },
    ],
  },
  {
    label: 'Compliance & Notices',
    items: [
      { to: '/compliance', icon: ShieldCheck,   label: 'Compliance' },
      { to: '/cobra',      icon: FileSignature, label: 'COBRA Notices' },
      { to: '/fmla',       icon: ClipboardList, label: 'FMLA Notices' },
    ],
  },
  {
    label: 'Plans & Benefits',
    items: [
      { to: '/compare',    icon: GitCompare,     label: 'Plan Comparison' },
      { to: '/enrollment', icon: ClipboardCheck, label: 'Open Enrollment' },
      { to: '/documents',  icon: Library,        label: 'Document Library' },
    ],
  },
  {
    label: 'Premiums',
    items: [
      { to: '/premium-sheet', icon: TrendingUp, label: 'Premium Sheet' },
      { to: '/rates',         icon: DollarSign, label: 'Rate Sheet' },
      { to: '/aca-rates',     icon: DollarSign, label: 'ACA Rates' },
      { to: '/aca-calc',      icon: Calculator, label: 'Premium Calculator' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/spd',      icon: FileText,      label: 'SPD Builder' },
      { to: '/forms',    icon: BookOpen,      label: 'Forms & Links' },
      { to: '/renewals', icon: CalendarClock, label: 'Renewals & Tasks' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/handbook',  icon: BookOpen, label: 'Handbook' },
      { to: '/plan-year', icon: Settings, label: 'Plan Year' },
    ],
  },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [newProspects, setNewProspects] = useState(0)

  useEffect(() => {
    supabase.from('prospects').select('id', { count: 'exact', head: true })
      .eq('status', 'submitted')
      .then(({ count }) => setNewProspects(count || 0))
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase()
    || profile?.email?.[0]?.toUpperCase() || 'U'

  const displayName = profile?.full_name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || profile?.email?.split('@')[0]

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">

      {/* ── Sidebar ── */}
      <aside className="w-52 flex flex-col flex-shrink-0 bg-gradient-to-b from-kiaa-700 to-kiaa-800">

        {/* Logo */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <img
              src="/logowhite.png"
              alt="KIAA"
              className="w-7 h-7 object-contain flex-shrink-0"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <div>
              <div className="text-sm font-semibold text-white leading-tight" style={{ letterSpacing: '0.01em' }}>KIAA Connect</div>
              <div className="text-xs uppercase" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', fontSize: '9px' }}>Health Plan Platform</div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="px-3 mb-1 text-xs font-bold uppercase select-none" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', fontSize: '9px' }}>
                {group.label}
              </div>
              <div className="space-y-px">
                {group.items.map(({ to, icon: Icon, label, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `nav-link${isActive ? ' active' : ''}`
                    }
                  >
                    <Icon size={14} className="flex-shrink-0 opacity-80" />
                    <span className="flex-1 text-xs">{label}</span>
                    {badge && newProspects > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none" style={{ background: '#D97706', color: '#fff', fontSize: '9px' }}>
                        {newProspects}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-2 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/8'}`
            }
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#385262', border: '1.5px solid #6595B2', color: '#AAC5D5' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{displayName}</div>
              <div className="text-xs capitalize truncate" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px' }}>{profile?.role?.replace(/_/g, ' ')}</div>
            </div>
            <Settings size={11} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          </NavLink>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/10 mt-0.5"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="h-11 flex items-center justify-between px-8 bg-white flex-shrink-0" style={{ borderBottom: '1px solid #BED8E1' }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-surface-300" style={{ letterSpacing: '0.1em' }}>KIAA Connect</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-surface-300 bg-surface-50 border border-surface-100 rounded-full px-3 py-1 cursor-pointer" style={{ letterSpacing: '0.02em' }}>
              ⌘K Search
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
