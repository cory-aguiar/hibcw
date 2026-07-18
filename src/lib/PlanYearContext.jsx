/**
 * PlanYearContext
 * Single source of truth for plan year values across the app.
 * Loaded once from app_config table on mount.
 *
 * Two separate plan years:
 *   activePlanYear — what employees see on /plans (current live year)
 *   oePlanYear     — what OE pages read/write (may be next year during OE season)
 *
 * KIAA admin can change these in Settings → Plan Year without a code deploy.
 *
 * Helper: planYearLabel(year) → '10/01/2025 – 09/30/2026'
 *         planYearLong(year)  → 'October 1, 2025 – September 30, 2026'
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Fallback defaults — used if app_config table not yet created
const DEFAULTS = {
  activePlanYear:  '2025-2026',
  oePlanYear:      '2025-2026',
  activePlanStart: '10/01/2025',
  activePlanEnd:   '09/30/2026',
  oePlanStart:     '10/01/2025',
  oePlanEnd:       '09/30/2026',
}

const PlanYearContext = createContext(DEFAULTS)

// Convert '2025-2026' → '10/01/2025 – 09/30/2026'
export function planYearLabel(year) {
  if (!year) return ''
  const [start, end] = year.split('-')
  return `10/01/${start} – 09/30/${end}`
}

// Convert '2025-2026' → 'October 1, 2025 – September 30, 2026'
export function planYearLong(year) {
  if (!year) return ''
  const [start, end] = year.split('-')
  return `October 1, ${start} – September 30, ${end}`
}

// Picks the correct anchor date for an ACA company's plan year.
// plan_effective_date is the authoritative, admin-set field (same one
// that drives the actual OE lock/unlock logic in the portal) — renewal_date
// is used as a fallback for companies that haven't had it set yet.
export function acaPlanStartOf(company) {
  return company?.plan_effective_date || company?.renewal_date || null
}

// ── ACA Small Group plan year helpers ────────────────────────
// Unlike MRG (one shared company-wide plan year, e.g. Oct 1 – Sep 30),
// each ACA Small Group company renews on its OWN anniversary date,
// stored in companies.renewal_date. Plan year = renewal_date through
// renewal_date + 1 year - 1 day.

function parseDateOnly(dateStr) {
  if (!dateStr) return null
  // Accepts 'YYYY-MM-DD' (from <input type="date"> / Postgres date) — parse
  // as local time, not UTC, to avoid off-by-one day errors.
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// renewalDate (string 'YYYY-MM-DD') -> { start: Date, end: Date } | null
export function acaPlanYearDates(renewalDate) {
  const start = parseDateOnly(renewalDate)
  if (!start) return null
  const end = new Date(start)
  end.setFullYear(end.getFullYear() + 1)
  end.setDate(end.getDate() - 1)
  return { start, end }
}

// renewalDate -> '7/15/2025 – 7/14/2026'
export function acaPlanYearLabel(renewalDate) {
  const dates = acaPlanYearDates(renewalDate)
  if (!dates) return 'Contact KIAA for plan year dates'
  const fmt = d => d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
  return `${fmt(dates.start)} – ${fmt(dates.end)}`
}

// renewalDate -> 'July 15, 2025 – July 14, 2026'
export function acaPlanYearLong(renewalDate) {
  const dates = acaPlanYearDates(renewalDate)
  if (!dates) return 'Contact KIAA for plan year dates'
  const fmt = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `${fmt(dates.start)} – ${fmt(dates.end)}`
}

// Which "YYYY-Q" rate quarter a renewal date falls into, e.g. '2025-3'
export function acaQuarterFromDate(renewalDate) {
  const d = parseDateOnly(renewalDate)
  if (!d) return null
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-${q}`
}

// ACA Open Enrollment window — opens `leadDays` before renewal, closes the
// day before the new plan year starts. leadDays varies per company in
// practice (max observed is 15) — 15 is used as the default lead time.
export function acaOeWindow(renewalDate, leadDays = 15) {
  const start = parseDateOnly(renewalDate)
  if (!start) return null
  const oeStart = new Date(start)
  oeStart.setDate(oeStart.getDate() - leadDays)
  const oeEnd = new Date(start)
  oeEnd.setDate(oeEnd.getDate() - 1)
  return { start: oeStart, end: oeEnd }
}

export function acaOeWindowLabel(renewalDate, leadDays = 15) {
  const w = acaOeWindow(renewalDate, leadDays)
  if (!w) return 'Contact KIAA for Open Enrollment dates'
  const fmt = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `${fmt(w.start)} – ${fmt(w.end)}`
}

export function PlanYearProvider({ children }) {
  const [config,  setConfig]  = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')

    if (error || !data?.length) {
      // Table doesn't exist yet or empty — use defaults silently
      setLoading(false)
      return
    }

    const map = Object.fromEntries(data.map(r => [r.key, r.value]))
    setConfig({
      activePlanYear:  map.active_plan_year  || DEFAULTS.activePlanYear,
      oePlanYear:      map.oe_plan_year      || DEFAULTS.oePlanYear,
      activePlanStart: map.active_plan_start || DEFAULTS.activePlanStart,
      activePlanEnd:   map.active_plan_end   || DEFAULTS.activePlanEnd,
      oePlanStart:     map.oe_plan_start     || DEFAULTS.oePlanStart,
      oePlanEnd:       map.oe_plan_end       || DEFAULTS.oePlanEnd,
    })
    setLoading(false)
  }

  async function updateConfig(key, value) {
    const { error } = await supabase
      .from('app_config')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
    if (!error) loadConfig()
    return error
  }

  return (
    <PlanYearContext.Provider value={{ ...config, loading, updateConfig, reload: loadConfig }}>
      {children}
    </PlanYearContext.Provider>
  )
}

export function usePlanYear() {
  return useContext(PlanYearContext)
}
