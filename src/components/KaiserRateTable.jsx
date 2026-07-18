/**
 * KaiserRateTable
 * Display-only rate table for Kaiser Permanente plans.
 * Matches rate_bands pattern — tiers are columns, not rows.
 */

function fmt(v) {
  if (!v && v !== 0) return '—'
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function KaiserRateTable({ rates = [], schedule }) {
  if (!rates.length) return (
    <div className="text-sm text-surface-400 italic">No Kaiser rates loaded yet.</div>
  )

  // Sort: med_rx before full, then by plan number
  const sorted = [...rates].sort((a, b) => {
    if (a.kaiser_plan_no !== b.kaiser_plan_no) return a.kaiser_plan_no.localeCompare(b.kaiser_plan_no)
    return a.package_type === 'med_rx' ? -1 : 1
  })

  return (
    <div className="space-y-4">
      {schedule && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-400">Kaiser Schedule:</span>
          <span className="badge badge-aqua font-mono font-bold">Schedule {schedule}</span>
        </div>
      )}

      {sorted.map(row => {
        const isFull   = row.package_type === 'full'
        const pkgLabel = isFull ? 'Full Package' : 'Med/Rx Package'
        const headerCls= isFull ? 'bg-kiaa-600' : 'bg-surface-700'

        const tiers = [
          { label: 'Single',  total: row.premium_single,    medical: row.medical_single },
          { label: '2-Party', total: row.premium_two_party, medical: row.medical_two_party },
          { label: 'Family',  total: row.premium_family,    medical: row.medical_family },
        ]

        return (
          <div key={`${row.kaiser_plan_no}_${row.package_type}`}
            className="border border-surface-100 rounded-xl overflow-hidden">
            <div className={`${headerCls} flex items-center gap-3 px-4 py-3`}>
              <span className="badge bg-white/20 text-white border-0 text-xs font-bold">HMO</span>
              <span className="font-display font-semibold text-sm text-white flex-1">
                Kaiser Permanente {row.kaiser_plan_no} — {pkgLabel}
              </span>
              {isFull && (
                <span className="text-xs text-white/60">Incl. HMSA Riders</span>
              )}
            </div>

            <table className="w-full text-sm">
              <thead className="bg-surface-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 py-2 w-28">Tier</th>
                  <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 py-2">Medical</th>
                  {isFull && (
                    <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 py-2">Riders</th>
                  )}
                  <th className="text-right text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(({ label, total, medical }) => {
                  const riders = isFull ? (parseFloat(total) - parseFloat(medical)) : null
                  return (
                    <tr key={label} className="border-t border-surface-50 hover:bg-surface-50">
                      <td className="px-4 py-2.5 text-surface-700 font-medium">{label}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-surface-600">{fmt(medical)}</td>
                      {isFull && (
                        <td className="px-4 py-2.5 text-right font-mono text-surface-400 text-xs">{fmt(riders)}</td>
                      )}
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-kiaa-700">{fmt(total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {isFull && (
              <div className="px-4 py-2 bg-kiaa-50 border-t border-kiaa-100 text-xs text-kiaa-700">
                Riders = HMSA Vision + Dental + Group Life/AD&D (flat rate, same for all companies)
              </div>
            )}
          </div>
        )
      })}

      <p className="text-xs text-surface-400 italic">
        * Total premiums exclude KIAA Administrative Fee of $4.00 per employee per month
      </p>
    </div>
  )
}
