/**
 * EnrollmentPacket
 * Renders the digital enrollment packet for a company.
 * Shows HMSA and Kaiser sections with individual download links
 * and a "Download all as ZIP" button per carrier.
 *
 * Used in: CompanyDetailPage (Documents tab), ClientPortalPage, PublicComparePage
 */

import { useEffect, useState } from 'react'
import { loadEnrollmentPacket, downloadPacketAsZip } from '@/lib/enrollmentPacket'
import { Download, FileText, ExternalLink, Package, Loader, AlertCircle, CheckCircle } from 'lucide-react'

const DOC_TYPE_ICONS = {
  sbc:                   '📄',
  kaiser_sbc:            '📄',
  benefit_summary:       '📋',
  provider_directory:    '🏥',
  drug_formulary:        '💊',
  group_life_enrollment: '📝',
  flyer:                 '📰',
  other:                 '📎',
}

const DOC_TYPE_LABELS = {
  sbc:                   'SBC',
  kaiser_sbc:            'SBC',
  benefit_summary:       'Summary',
  provider_directory:    'Directory',
  drug_formulary:        'Formulary',
  group_life_enrollment: 'Enrollment Form',
  flyer:                 'Flyer',
  other:                 'Document',
}

function PacketSection({ title, color, items, companyName, carrier, hasKaiser }) {
  const [downloading, setDownloading] = useState(false)
  const available = items.filter(i => i.doc?.file_url)
  const missing   = items.filter(i => !i.doc?.file_url)

  async function handleZip() {
    setDownloading(true)
    await downloadPacketAsZip({ packet: items, companyName, carrier })
    setDownloading(false)
  }

  if (!items.length) return null

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`}/>
          <h3 className="font-display font-semibold text-surface-700 text-sm">{title}</h3>
          <span className="badge badge-gray text-xs">{available.length} of {items.length} available</span>
        </div>
        {available.length > 0 && (
          <button
            onClick={handleZip}
            disabled={downloading}
            className="btn btn-sm btn-teal"
          >
            {downloading
              ? <><Loader size={12} className="animate-spin"/> Preparing ZIP…</>
              : <><Download size={12}/> Download all ({available.length})</>}
          </button>
        )}
      </div>

      {/* Document list */}
      <div className="card p-0 overflow-hidden divide-y divide-surface-50">
        {items.map((item, i) => {
          const hasDoc = !!item.doc?.file_url
          return (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 transition-colors ${
              hasDoc ? 'hover:bg-surface-50' : 'opacity-60'
            }`}>
              <span className="text-base flex-shrink-0" aria-hidden="true">
                {DOC_TYPE_ICONS[item.docType] || '📄'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${hasDoc ? 'text-surface-700' : 'text-surface-400'}`}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="badge badge-gray text-xs">{item.badge}</span>
                  )}
                  {item.isCarrier && (
                    <span className="badge badge-aqua text-xs">All companies</span>
                  )}
                </div>
                {!hasDoc && (
                  <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                    <AlertCircle size={10}/> Not uploaded yet
                  </div>
                )}
              </div>

              {hasDoc && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-surface-400 hidden sm:block">
                    {DOC_TYPE_LABELS[item.docType]}
                  </span>
                  <a
                    href={item.doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm flex items-center gap-1.5"
                    title="Download"
                  >
                    <Download size={12}/> Download
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {missing.length > 0 && (
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
          <AlertCircle size={11}/>
          {missing.length} document{missing.length !== 1 ? 's' : ''} not yet uploaded — contact KIAA.
        </p>
      )}
    </div>
  )
}

export default function EnrollmentPacket({ company, planYear, kaiserRates = [], kaiserElections = {} }) {
  const [packet,  setPacket]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!company?.id) return
    load()
  }, [company?.id, planYear])

  async function load() {
    setLoading(true)
    try {
      const result = await loadEnrollmentPacket({ company, planYear, kaiserRates, kaiserElections })
      setPacket(result)
    } catch (e) {
      setError('Failed to load packet: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-surface-400 text-sm py-4">
      <Loader size={14} className="animate-spin"/> Loading enrollment packet…
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
      <AlertCircle size={14}/>{error}
    </div>
  )

  if (!packet) return null

  const { hmsa, kaiser, spd, hasHmsa, hasKaiser } = packet
  const totalAvailable = [...hmsa, ...kaiser].filter(i => i.doc?.file_url).length
  const totalItems     = hmsa.length + kaiser.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Package size={15} className="text-kiaa-600"/>
        <span className="font-display font-semibold text-surface-700">Digital Enrollment Packet</span>
        <span className="badge badge-gray text-xs">{totalAvailable} / {totalItems} docs available</span>
      </div>

      <div className="flex items-start gap-2 bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5 text-xs text-kiaa-700 mb-5">
        <Package size={12} className="flex-shrink-0 mt-0.5"/>
        This packet replaces the physical enrollment folder. Share the company code with employees
        so they can access plans and download documents directly at <strong>/plans</strong>.
      </div>

      {/* SPD */}
      {spd ? (
        <div className="flex items-center gap-3 border border-kiaa-200 bg-kiaa-50 rounded-xl px-4 py-3 mb-5">
          <span className="text-base" aria-hidden="true">📋</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-kiaa-700">Summary Plan Description (SPD)</div>
            <div className="text-xs text-kiaa-500 mt-0.5">{spd.file_name}</div>
          </div>
          <a href={spd.file_url} target="_blank" rel="noopener noreferrer"
            className="btn btn-sm btn-teal">
            <Download size={12}/> Download SPD
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 mb-5">
          <AlertCircle size={14} className="text-amber-500 flex-shrink-0"/>
          <div className="text-xs text-amber-700 flex-1">
            SPD not uploaded yet — upload it on the Documents tab.
          </div>
        </div>
      )}

      {/* HMSA section */}
      {hasHmsa && hmsa.length > 0 && (
        <PacketSection
          title="HMSA Plans"
          color="bg-kiaa-500"
          items={hmsa}
          companyName={company.name}
          carrier="hmsa"
        />
      )}

      {/* Kaiser section */}
      {hasKaiser && kaiser.length > 0 && (
        <PacketSection
          title="Kaiser Permanente Plans"
          color="bg-blue-500"
          items={kaiser}
          companyName={company.name}
          carrier="kaiser"
        />
      )}

      {!hasHmsa && !hasKaiser && (
        <div className="text-sm text-surface-400 italic text-center py-6">
          No plans elected yet. Complete Open Enrollment to build the packet.
        </div>
      )}
    </div>
  )
}
