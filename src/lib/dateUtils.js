// ── Date utilities for KIAA Connect ──────────────────────────
// All dates are treated as Hawaii Standard Time (HST, UTC-10).
// Hawaii does not observe Daylight Saving Time.
//
// KEY RULE: Never use `new Date(dateString)` where dateString is
// a plain date like '2026-07-01' — JS parses it as UTC midnight
// which becomes the prior day at HST (UTC-10).
// Instead always use parseHST() or fmtDate() from this file.

const HST_LOCALE = 'en-US'
const HST_TZ     = 'Pacific/Honolulu'

/**
 * Parse a YYYY-MM-DD string as a local HST date (no timezone shift).
 * Returns a Date with time set to 00:00:00 local.
 */
export function parseHST(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Return today's date in HST as a YYYY-MM-DD string.
 */
export function todayHST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: HST_TZ }) // en-CA gives YYYY-MM-DD
}

/**
 * Format a YYYY-MM-DD string for display.
 * @param {string} dateStr
 * @param {object} opts  Intl.DateTimeFormat options (default: long month, day, year)
 */
export function fmtDate(dateStr, opts = { month: 'long', day: 'numeric', year: 'numeric' }) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(HST_LOCALE, opts)
}

/**
 * Format a YYYY-MM-DD string as short (e.g. "Jul 1, 2026").
 */
export function fmtDateShort(dateStr) {
  return fmtDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Format a timestamp (ISO string or Date) for display in HST.
 */
export function fmtTimestamp(ts, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(HST_LOCALE, { ...opts, timeZone: HST_TZ })
}

/**
 * Get the ACA rate quarter string from a YYYY-MM-DD date string.
 * Parses directly to avoid UTC shift.
 */
export function getAcaQuarter(dateStr) {
  if (!dateStr) return null
  const [y, m] = dateStr.split('-').map(Number)
  if (m <= 3)  return `${y}-1`
  if (m <= 6)  return `${y}-2`
  if (m <= 9)  return `${y}-3`
  return `${y}-4`
}

/**
 * Enforce 1st of month on a YYYY-MM-DD string.
 */
export function firstOfMonth(dateStr) {
  if (!dateStr) return dateStr
  const [y, m] = dateStr.split('-')
  return `${y}-${m}-01`
}

/**
 * Calculate age at a given reference date, both as YYYY-MM-DD strings.
 */
export function calcAge(dobStr, refDateStr) {
  if (!dobStr || !refDateStr) return null
  const [dy, dm, dd] = dobStr.split('-').map(Number)
  const [ry, rm, rd] = refDateStr.split('-').map(Number)
  let age = ry - dy
  if (rm < dm || (rm === dm && rd < dd)) age--
  return age
}

/**
 * Compare two YYYY-MM-DD strings. Returns negative, 0, or positive.
 */
export function compareDates(a, b) {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  return a.localeCompare(b)
}

/**
 * Check if today (HST) is between two YYYY-MM-DD date strings (inclusive).
 */
export function isTodayBetween(openDateStr, closeDateStr) {
  const today = todayHST()
  return compareDates(today, openDateStr) >= 0 && compareDates(today, closeDateStr) <= 0
}
