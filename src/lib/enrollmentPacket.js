/**
 * enrollmentPacket.js
 * 
 * Assembles the digital enrollment packet for a company.
 * Used by CompanyDetailPage, ClientPortalPage, and PublicComparePage.
 *
 * Packet contents are determined by what the company offers:
 *   - HMSA plans elected → HMSA carrier collateral
 *   - Kaiser plans elected → Kaiser carrier collateral
 *   - Any Full Package or Riders → Group Life enrollment form (HMSA doc)
 *   - Per-plan SBCs from plan_documents (global), including Kaiser
 *   - Company-specific overrides (SPD, and rare Kaiser SBC overrides) from company_documents
 *   - Company SPD from company_documents
 */

import { supabase } from '@/lib/supabase'
import { PLANS } from '@/lib/plans'

const RIDERS_PLAN_IDS = ['kiaa_riders', 'ppp_full', 'compmed_a_full', 'hph_plus_full', 'compmed_b_full', 'hph_basic_full']

/**
 * Returns true if the company has any plan that includes Riders
 * (full package HMSA or Kaiser full package)
 */
function companyHasRiders(electedPlanIds, kaiserRates, kaiserElections) {
  const hmsaRiders = electedPlanIds.some(id => RIDERS_PLAN_IDS.includes(id))
  const kaiserFull = (kaiserRates || []).some(r =>
    r.package_type === 'full' &&
    kaiserElections?.[`${r.kaiser_plan_no}_${r.package_type}`]?.elected
  )
  return hmsaRiders || kaiserFull
}

/**
 * Load the full enrollment packet for a company.
 * Returns { hmsa, kaiser, spd, hasHmsa, hasKaiser, hasRiders }
 */
export async function loadEnrollmentPacket({ company, planYear, kaiserRates = [], kaiserElections = {} }) {
  const electedPlanIds  = company?.plans || []
  const hasHmsa         = electedPlanIds.length > 0
  const hasKaiser       = company?.kaiser_eligible && kaiserRates.length > 0
  const hasRiders       = companyHasRiders(electedPlanIds, kaiserRates, kaiserElections)

  // Load all carrier documents
  const { data: cDocs } = await supabase
    .from('carrier_documents')
    .select('*')
    .order('doc_type')
    .order('uploaded_at')

  const allCarrierDocs = cDocs || []

  // Load plan-level SBCs + benefit summaries
  const { data: planDocs } = await supabase
    .from('plan_documents')
    .select('*')
    .eq('plan_year', planYear)

  const planDocMap = {}
  ;(planDocs || []).forEach(d => {
    planDocMap[`${d.doc_type}__${d.plan_id}`] = d
  })

  // Load company-specific documents (SPD + Kaiser SBCs)
  const { data: compDocs } = await supabase
    .from('company_documents')
    .select('*')
    .eq('company_id', company.id)
    .eq('plan_year', planYear)

  const compDocMap = {}
  ;(compDocs || []).forEach(d => {
    compDocMap[`${d.doc_type}__${d.plan_id || 'null'}`] = d
  })

  // ── HMSA packet ──────────────────────────────────────────────
  const hmsaPacket = []

  if (hasHmsa) {
    // Per-plan SBCs
    PLANS.filter(p => electedPlanIds.includes(p.id) && p.hmsa_class !== 'riders').forEach(plan => {
      const doc = planDocMap[`sbc__${plan.id}`]
      hmsaPacket.push({
        label:    `SBC — ${plan.name}`,
        docType:  'sbc',
        planName: plan.name,
        badge:    plan.type,
        doc,
      })
    })

    // Riders benefit summary
    if (electedPlanIds.includes('kiaa_riders') || electedPlanIds.some(id => id.endsWith('_full'))) {
      const doc = planDocMap['benefit_summary__kiaa_riders']
      hmsaPacket.push({
        label:   'Benefit Summary — KIAA Riders Package',
        docType: 'benefit_summary',
        doc,
      })
    }

    // COMPCARE benefit summary
    if (company?.compcare_elected) {
      const doc = planDocMap['benefit_summary__compcare']
      hmsaPacket.push({
        label:   'Benefit Summary — COMPCARE',
        docType: 'benefit_summary',
        doc,
      })
    }

    // HMSA carrier collateral (filtered by plan year or evergreen)
    allCarrierDocs
      .filter(d => d.carrier === 'hmsa' && d.doc_type !== 'group_life_enrollment')
      .filter(d => d.plan_year === null || d.plan_year === planYear)
      .forEach(d => hmsaPacket.push({ label: d.label, docType: d.doc_type, doc: d, isCarrier: true }))
  }

  // Group Life enrollment form — HMSA doc, but included if Riders anywhere
  if (hasRiders) {
    const groupLifeDocs = allCarrierDocs.filter(d =>
      d.carrier === 'hmsa' && d.doc_type === 'group_life_enrollment'
    )
    groupLifeDocs.forEach(d => hmsaPacket.push({ label: d.label, docType: d.doc_type, doc: d, isCarrier: true }))
  }

  // ── Kaiser packet ────────────────────────────────────────────
  const kaiserPacket = []

  if (hasKaiser) {
    // Per-plan Kaiser SBCs — one per plan_no. Kaiser has no separate "full
    // package" SBC (package_type only reflects Riders bundling for billing),
    // and the doc is global (plan_documents) with optional per-company
    // override (company_documents), same convention as HMSA SBCs.
    const seen = new Set()
    kaiserRates.forEach(r => {
      if (seen.has(r.kaiser_plan_no)) return
      seen.add(r.kaiser_plan_no)
      const planId = `kaiser_${r.kaiser_plan_no}`
      const doc    = compDocMap[`kaiser_sbc__${planId}`] || planDocMap[`kaiser_sbc__${planId}`]
      kaiserPacket.push({
        label:    `SBC — Kaiser Permanente ${r.kaiser_plan_no}`,
        docType:  'kaiser_sbc',
        planId,
        badge:    'HMO',
        doc,
      })
    })

    // Kaiser carrier collateral
    allCarrierDocs
      .filter(d => d.carrier === 'kaiser' && d.doc_type !== 'group_life_enrollment')
      .filter(d => d.plan_year === null || d.plan_year === planYear)
      .forEach(d => kaiserPacket.push({ label: d.label, docType: d.doc_type, doc: d, isCarrier: true }))
  }

  // ── SPD ──────────────────────────────────────────────────────
  const spd = compDocMap['spd__null']

  return {
    hmsa:      hmsaPacket,
    kaiser:    kaiserPacket,
    spd,
    hasHmsa,
    hasKaiser,
    hasRiders,
  }
}

/**
 * Download all documents for a carrier as a ZIP.
 * Uses JSZip loaded dynamically to keep bundle size small.
 */
export async function downloadPacketAsZip({ packet, companyName, carrier }) {
  const items = packet.filter(item => item.doc?.file_url)
  if (!items.length) {
    alert('No documents available to download yet.')
    return
  }

  const JSZip  = (await import('jszip')).default
  const zip    = new JSZip()
  const folder = zip.folder(`${companyName} — ${carrier.toUpperCase()} Enrollment Packet`)

  await Promise.all(items.map(async (item, i) => {
    const response = await fetch(item.doc.file_url)
    const blob     = await response.blob()
    const ext      = item.doc.file_name?.split('.').pop() || 'pdf'
    const safeName = item.label.replace(/[^a-zA-Z0-9 &—–-]/g, '').trim()
    folder.file(`${String(i+1).padStart(2,'0')} ${safeName}.${ext}`, blob)
  }))

  const content = await zip.generateAsync({ type: 'blob' })
  const url     = URL.createObjectURL(content)
  const a       = document.createElement('a')
  a.href        = url
  a.download    = `${companyName} — ${carrier.toUpperCase()} Enrollment Packet.zip`
  a.click()
  URL.revokeObjectURL(url)
}
