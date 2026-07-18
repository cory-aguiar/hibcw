import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { FEIN_DOL_JOTFORM_URL } from '@/lib/plans'
import {
  Plus, ExternalLink, Copy, CheckCircle, Loader, Users,
  FileText, Clock, Trash2, ChevronDown, ChevronUp, ArrowLeft,
  Send, AlertCircle, Info, Printer, Upload
} from 'lucide-react'

const RIDERS = { single: 45.24, two_party: 92.40, family: 136.36 }
const TIER_LABEL = { single: 'Single', two_party: '2-Party', family: 'Family' }
const ACA_PLANS = [
  { id: 'aca_ppp',      label: 'ACA PPP',    color: 'text-teal-700',   bg: 'bg-teal-50'  },
  { id: 'aca_cm_a',     label: 'CompMED A',  color: 'text-violet-700', bg: 'bg-violet-50' },
  { id: 'aca_hph_plus', label: 'HPH Plus',   color: 'text-amber-700',  bg: 'bg-amber-50' },
]

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2,'0')).join('')
}

function fmtDate(s) {
  if (!s) return '—'
  const [y,m,d] = s.split('-').map(Number)
  return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
}

function fmtMoney(n) {
  if (n == null || n === 0) return '—'
  return '$' + n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
}

function getAge(dob, refDate) {
  if (!dob || !refDate) return null
  const [dy,dm,dd] = dob.split('-').map(Number)
  const [ry,rm,rd] = refDate.split('-').map(Number)
  let age = ry - dy
  if (rm < dm || (rm === dm && rd < dd)) age--
  return age
}

function getRidersTier(member, allMembers, refDate) {
  if (member.type !== 'employee') return null
  const deps = allMembers.filter(m => m.emp_id === member.emp_id && m.type !== 'employee')
  const adultDeps = deps.filter(m => {
    const age = getAge(m.dob, refDate)
    return age == null || age > 18
  })
  if (adultDeps.length === 0) return 'single'
  if (adultDeps.length === 1) return 'two_party'
  return 'family'
}

// ── Print acceptance record ──────────────────────────────────
function printAcceptanceRecord(prospect, quoteRows, totals, ridersTotal) {
  const planColors = { aca_ppp:'#0d6965', aca_cm_a:'#5b21b6', aca_hph_plus:'#78350f' }
  const planBgs    = { aca_ppp:'#e6f7f6', aca_cm_a:'#ede9fe', aca_hph_plus:'#fef3c7' }
  const planLabels = { aca_ppp:'ACA PPP', aca_cm_a:'CompMED A', aca_hph_plus:'HPH Plus' }
  const checklist  = prospect.review_checklist || {}

  const quarter = (() => {
    if (!prospect.start_date) return '—'
    const [y,m] = prospect.start_date.split('-').map(Number)
    return `Q${m<=3?1:m<=6?2:m<=9?3:4} ${y}`
  })()

  const planYear = (() => {
    if (!prospect.start_date) return '—'
    const [y,m,d] = prospect.start_date.split('-').map(Number)
    const end = new Date(y+1,m-1,d-1).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    return `${fmtDate(prospect.start_date)} — ${end}`
  })()

  const acceptedDt = prospect.accepted_at ? new Date(prospect.accepted_at) : null
  const acceptedDate = acceptedDt ? acceptedDt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'Pacific/Honolulu'}) : '—'
  const acceptedTime = acceptedDt ? acceptedDt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'Pacific/Honolulu'}) + ' HST' : '—'

  const ck = (key) => checklist[key] ? '✓ Verified' : '—'

  const memberRows = (quoteRows||[]).map(row => {
    const isDep = row.type !== 'employee'
    const typeLabel = row.type==='employee'?'Employee':row.type==='dependent_spouse'?'Dep. Spouse':'Dep. Child'
    const typeColor = row.type==='employee'?'#0d6965':row.type==='dependent_spouse'?'#5b21b6':'#78350f'
    const ridersCell = row.type==='employee'&&row.tier
      ? `$${RIDERS[row.tier].toFixed(2)} (${TIER_LABEL[row.tier]})`
      : row.isMinorChild ? 'Pediatric ✓' : '—'
    return `<tr style="${isDep?'background:#fafafa;':''}">
      <td style="padding:6px 8px;font-size:11px;${isDep?'padding-left:20px;':''}border-bottom:1px solid #f0f0f0;">
        <span style="font-family:monospace;color:#9ca3af;">${row.emp_id}</span>
        <span style="margin-left:6px;font-size:10px;font-weight:600;color:${typeColor};">${typeLabel}</span>
        <span style="margin-left:4px;color:#9ca3af;font-size:11px;">age ${row.age??'—'}</span>
      </td>
      ${ACA_PLANS.map(p=>`<td style="padding:6px 8px;text-align:right;font-family:monospace;font-size:11px;border-bottom:1px solid #f0f0f0;">${row.premiums?.[p.id]!=null?fmtMoney(row.premiums[p.id]):'—'}</td>`).join('')}
      <td style="padding:6px 8px;text-align:right;font-size:11px;border-bottom:1px solid #f0f0f0;">${ridersCell}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Quote Acceptance Record — ${prospect.company_name || prospect.prospect_name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px;max-width:900px;margin:0 auto;}
  @page{margin:20mm;size:letter;}
  @media print{body{padding:0;}}
  h1{font-size:22px;color:#08403e;margin-bottom:2px;}
  h2{font-size:13px;font-weight:600;color:#374151;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e5e7eb;padding-bottom:4px;}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #08403e;}
  .hdr-right{text-align:right;font-size:11px;color:#6b7280;}
  .accepted-banner{background:#e6f7f6;border:1.5px solid #0d6965;border-radius:6px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;}
  .check{font-size:20px;color:#0d6965;}
  .accepted-title{font-size:14px;font-weight:700;color:#08403e;}
  .accepted-sub{font-size:11px;color:#3d5c5b;margin-top:2px;}
  table{width:100%;border-collapse:collapse;margin-bottom:4px;}
  th{padding:7px 8px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#6b7280;}
  th.r{text-align:right;}
  td{padding:7px 8px;font-size:12px;border-bottom:1px solid #f3f4f6;}
  tr.total-row td{font-weight:600;background:#f9fafb;border-top:2px solid #e5e7eb;}
  tr.combined-row td{font-weight:600;background:#e6f7f6;color:#08403e;}
  .detail-table td:first-child{color:#6b7280;width:220px;}
  .detail-table td:last-child{font-weight:600;}
  .ack-item{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #f3f4f6;}
  .ack-check{color:#059669;font-size:14px;flex-shrink:0;}
  .sig-box{border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-top:8px;background:#f9fafb;}
  .sig-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:12px;}
  .sig-row:last-child{border-bottom:none;}
  .sig-row .l{color:#6b7280;}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;line-height:1.6;}
  .record-id{font-family:monospace;font-size:10px;color:#9ca3af;}
  .note{font-size:10px;color:#9ca3af;font-style:italic;margin-top:4px;}
  .section{margin-bottom:20px;}
  .verified{color:#059669;font-weight:600;}
  .not-verified{color:#9ca3af;}
</style>
</head>
<body>

  <div class="hdr">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="https://connect.kiaahilo.org/logowhite.png" alt="KIAA" style="width:64px;height:64px;object-fit:contain;filter:invert(1) brightness(0);flex-shrink:0;"/>
      <div>
        <h1>KIAA Connect</h1>
        <div style="font-size:12px;color:#6b7280;">Kanoelehua Industrial Area Association · Benefits Administration</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px;">820 Piilani St., Suite 201 · Hilo, HI 96720 · (808) 961-5422</div>
      </div>
    </div>
    <div class="hdr-right">
      <div style="font-size:16px;font-weight:700;color:#08403e;">Quote Acceptance Record</div>
      <div>Generated: ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'Pacific/Honolulu'})} at ${new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'Pacific/Honolulu'})} HST</div>
      <div class="record-id">Record ID: ${prospect.id}</div>
    </div>
  </div>

  <div class="accepted-banner">
    <div class="check">✅</div>
    <div>
      <div class="accepted-title">Quote accepted — ${prospect.company_name || prospect.prospect_name}</div>
      <div class="accepted-sub">Electronically accepted by ${prospect.accepted_by_name||'—'} on ${acceptedDate} at ${acceptedTime}</div>
    </div>
  </div>

  <!-- Company & enrollment details -->
  <div class="section">
    <h2>Company &amp; enrollment details</h2>
    <table class="detail-table"><tbody>
      ${[
        ['Company name',        prospect.company_name || prospect.prospect_name || '—'],
        ['Primary contact',     prospect.contact_name || '—'],
        ['Contact email',       prospect.contact_email || '—'],
        ['Contact phone',       prospect.contact_phone || '—'],
        ['Address',             [prospect.address,prospect.city,prospect.state,prospect.zip].filter(Boolean).join(', ')||'—'],
        ['Coverage start date', fmtDate(prospect.start_date)],
        ['Plan year',           planYear],
        ['Rate quarter',        `${quarter} — confirmed by KIAA &amp; HMSA`],
        ['Enrolled employees',  `${(prospect.census||[]).filter(m=>m.type==='employee').length} employees`],
        ['Census members',      `${(prospect.census||[]).length} total members`],
        ['FEIN attested',       prospect.fein_filed ? 'Yes — attested by applicant' : 'Not attested'],
        ['DOL attested',        prospect.dol_filed  ? 'Yes — attested by applicant' : 'Not attested'],
        ['Company code',        prospect.company_code || '—'],
      ].map(([l,v])=>`<tr><td>${l}</td><td>${v}</td></tr>`).join('')}
    </tbody></table>
  </div>

  <!-- KIAA pre-approval verification -->
  <div class="section">
    <h2>KIAA pre-approval verification</h2>
    <table class="detail-table"><tbody>
      <tr><td>DCCA business name search</td><td class="${checklist.dcca_search?'verified':'not-verified'}">${checklist.dcca_search?'✓ Completed':'Not recorded'}</td></tr>
      <tr><td>Business name matches submission</td><td class="${checklist.dcca_name_match?'verified':'not-verified'}">${checklist.dcca_name_match?'✓ Verified':'Not recorded'}</td></tr>
      <tr><td>Business active/good standing (DCCA)</td><td class="${checklist.dcca_active?'verified':'not-verified'}">${checklist.dcca_active?'✓ Confirmed':'Not recorded'}</td></tr>
      ${prospect.dcca_doc_url ? `<tr><td>DCCA document</td><td class="verified">✓ On file — <a href="${prospect.dcca_doc_url}" style="color:#0d6965;">View document</a></td></tr>` : ''}
      <tr><td>FEIN received</td><td class="${checklist.fein_received?'verified':'not-verified'}">${checklist.fein_received?'✓ Received via JotForm':'Not recorded'}</td></tr>
      <tr><td>Hawaii DOL number received</td><td class="${checklist.dol_received?'verified':'not-verified'}">${checklist.dol_received?'✓ Received via JotForm':'Not recorded'}</td></tr>
      <tr><td>Census minimum verified (2+ employees)</td><td class="${checklist.census_minimum?'verified':'not-verified'}">${checklist.census_minimum?'✓ Verified':'Not recorded'}</td></tr>
      <tr><td>Age validation reviewed</td><td class="${checklist.census_age_ok?'verified':'not-verified'}">${checklist.census_age_ok?'✓ Reviewed':'Not recorded'}</td></tr>
      <tr><td>Quote confirmed with HMSA</td><td class="${checklist.quote_confirmed?'verified':'not-verified'}">${checklist.quote_confirmed?'✓ Confirmed':'Not recorded'}</td></tr>
    </tbody></table>
  </div>

  <!-- Elected plans -->
  <div class="section">
    <h2>Elected plans</h2>
    <table class="detail-table"><tbody>
      ${(prospect.elected_plans||[]).map(p=>`<tr><td>${p}</td><td class="verified">✓ Selected by member</td></tr>`).join('') || '<tr><td colspan="2" style="color:#9ca3af;font-style:italic;">No plans recorded</td></tr>'}
    </tbody></table>
  </div>

  <!-- Premium breakdown -->
  ${(quoteRows||[]).length > 0 ? `
  <div class="section">
    <h2>Confirmed monthly premium breakdown</h2>
    <table>
      <thead><tr>
        <th style="width:30%;">Member</th>
        ${ACA_PLANS.map(p=>`<th class="r" style="background:${planBgs[p.id]};color:${planColors[p.id]};">${planLabels[p.id]}</th>`).join('')}
        <th class="r" style="background:#f3f4f6;color:#374151;">Riders</th>
      </tr></thead>
      <tbody>
        ${memberRows}
        <tr class="total-row">
          <td>Medical total</td>
          ${ACA_PLANS.map(p=>`<td style="text-align:right;font-family:monospace;color:${planColors[p.id]};">${totals[p.id]>0?fmtMoney(totals[p.id]):'—'}</td>`).join('')}
          <td style="text-align:right;font-family:monospace;color:#374151;">${ridersTotal>0?fmtMoney(ridersTotal):'—'}</td>
        </tr>
        <tr class="combined-row">
          <td>Plan + Riders combined</td>
          ${ACA_PLANS.map(p=>`<td style="text-align:right;font-family:monospace;">${totals[p.id]>0?fmtMoney(totals[p.id]+ridersTotal):'—'}</td>`).join('')}
          <td></td>
        </tr>
      </tbody>
    </table>
    <p class="note">✦ Premiums confirmed by KIAA and HMSA for ${quarter}. ✦ KIAA admin fee of $4.00 per enrolled employee/month not included. ✦ Annual KIAA membership required.</p>
  </div>` : ''}

  <!-- Acknowledgments -->
  <div class="section">
    <h2>Member acknowledgments</h2>
    ${(prospect.acknowledgments||[]).map(ack=>`
      <div class="ack-item">
        <span class="ack-check">☑</span>
        <span>${ack}</span>
      </div>`).join('') || '<p style="color:#9ca3af;font-style:italic;">No acknowledgments recorded</p>'}
  </div>

  <!-- Electronic signature record -->
  <div class="section">
    <h2>Electronic signature record</h2>
    <div class="sig-box">
      <div class="sig-row"><span class="l">Accepted by</span><span>${prospect.accepted_by_name||'—'}</span></div>
      <div class="sig-row"><span class="l">Email address</span><span>${prospect.accepted_by_email||prospect.contact_email||'—'}</span></div>
      <div class="sig-row"><span class="l">Date</span><span>${acceptedDate}</span></div>
      <div class="sig-row"><span class="l">Time</span><span>${acceptedTime}</span></div>
      <div class="sig-row"><span class="l">IP address</span><span style="font-family:monospace;">${prospect.accepted_ip||'Not recorded'}</span></div>
      <div class="sig-row"><span class="l">Company code</span><span style="font-family:monospace;">${prospect.company_code||'—'}</span></div>
      <div class="sig-row"><span class="l">Record ID</span><span style="font-family:monospace;">${prospect.id}</span></div>
    </div>
    <p style="font-size:10px;color:#6b7280;margin-top:8px;line-height:1.5;">
      By submitting the online acceptance form, ${prospect.accepted_by_name||'the applicant'} electronically acknowledged and accepted all terms listed above on behalf of ${prospect.company_name||prospect.prospect_name}. This record is maintained by KIAA as evidence of acceptance and may be used for enrollment and compliance purposes.
    </p>
  </div>

  <div class="footer">
    <div>Kanoelehua Industrial Area Association · 820 Piilani St., Suite 201 · Hilo, HI 96720 · (808) 961-5422</div>
    <div>This document is an official KIAA Connect acceptance record. Record ID: ${prospect.id}</div>
  </div>

</body>
</html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 600)
}

// ── Prospect detail view ─────────────────────────────────────
function ProspectDetail({ prospect, onBack, onUpdate, onDelete }) {
  const [rates,       setRates]       = useState({})
  const [deleting,    setDeleting]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [converting,  setConverting]  = useState(false)
  const [resending,   setResending]   = useState(false)
  const [approving,   setApproving]   = useState(false)
  const [sent,        setSent]        = useState(false)
  const [approved,    setApproved]    = useState(false)

  const refDate = prospect.start_date || new Date().toLocaleDateString('en-CA',{timeZone:'Pacific/Honolulu'})

  useEffect(() => {
    if (!prospect.start_date) return
    const [y,m] = prospect.start_date.split('-').map(Number)
    const q = m<=3?`${y}-1`:m<=6?`${y}-2`:m<=9?`${y}-3`:`${y}-4`
    supabase.from('aca_rates').select('plan_id,age,premium').eq('quarter',q)
      .then(({ data }) => {
        const map = {}
        ;(data||[]).forEach(r => {
          if (!map[r.plan_id]) map[r.plan_id] = {}
          map[r.plan_id][parseInt(r.age)] = parseFloat(r.premium)
        })
        setRates(map)
      })
  }, [prospect.start_date])

  function getMedPremium(age, planId) {
    if (age == null || !planId || !rates[planId]) return null
    const lookupAge = age <= 14 ? 0 : age >= 65 ? 65 : age
    return rates[planId][lookupAge] ?? null
  }

  const census = prospect.census || []
  const quoteRows = census.map(m => {
    const age  = getAge(m.dob, refDate)
    const tier = m.type === 'employee' ? getRidersTier(m, census, refDate) : null
    const premiums = {}
    ACA_PLANS.forEach(p => { premiums[p.id] = getMedPremium(age, p.id) })
    return { ...m, age, tier, premiums, isMinorChild: m.type === 'dependent_child' && age != null && age <= 18 }
  })

  const totals = {}
  ACA_PLANS.forEach(p => {
    totals[p.id] = quoteRows.reduce((s,r) => s+(r.premiums[p.id]||0), 0)
  })
  const ridersTotal = quoteRows
    .filter(r => r.type==='employee' && r.tier)
    .reduce((s,r) => s+(RIDERS[r.tier]||0), 0)

  const { cls: statusCls, label: statusLabel } = {
    pending:   { cls:'bg-surface-100 text-surface-600',  label:'Link sent'  },
    submitted: { cls:'bg-amber-100 text-amber-700',       label:'Submitted'  },
    approved:  { cls:'bg-blue-100 text-blue-700',         label:'Approved'   },
    accepted:  { cls:'bg-kiaa-100 text-kiaa-700',         label:'Accepted'   },
    converted: { cls:'bg-emerald-100 text-emerald-700',   label:'Converted'  },
    declined:  { cls:'bg-red-100 text-red-700',           label:'Declined'   },
  }[prospect.status] || { cls:'bg-surface-100 text-surface-600', label:prospect.status }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('prospects').delete().eq('id', prospect.id)
    setDeleting(false)
    onDelete(prospect.id)
  }

  const [showConvert,   setShowConvert]   = useState(false)
  const [convertData,   setConvertData]   = useState(null)
  const [convertError,  setConvertError]  = useState('')
  const [convertSaving, setConvertSaving] = useState(false)
  const [checklist,     setChecklist]     = useState(prospect.review_checklist || {})
  const [dccaDoc,       setDccaDoc]       = useState(prospect.dcca_doc_url || null)
  const [dccaUploading, setDccaUploading] = useState(false)
  const dccaRef = useRef()

  function openConvert() {
    // Pre-fill from prospect data
    const [y,m] = (prospect.start_date||'').split('-').map(Number)
    const isAca = (prospect.census||[]).filter(m=>m.type==='employee').length < 50
    setConvertData({
      name:          prospect.company_name || prospect.prospect_name || '',
      contact_name:  prospect.contact_name || '',
      contact_email: prospect.contact_email || '',
      contact_phone: prospect.contact_phone || '',
      address:       prospect.address || '',
      city:          prospect.city || '',
      state:         prospect.state || 'HI',
      zip:           prospect.zip || '',
      group_type:    isAca ? 'aca_small_group' : 'merit_rated',
      aca_quarter:   prospect.start_date ? `${y}-${m<=3?1:m<=6?2:m<=9?3:4}` : '',
      plan_year_start: prospect.start_date || '',
      plan_year_end:   prospect.start_date ? (() => {
        const [py,pm,pd] = prospect.start_date.split('-').map(Number)
        return new Date(py+1,pm-1,pd-1).toISOString().slice(0,10)
      })() : '',
      plans:         prospect.elected_plans || [],
      company_code:  prospect.company_code || '',
      notes:         prospect.notes || '',
      hmsa_group_no: '',
      band:          '',
    })
    setShowConvert(true)
  }

  async function handleConvertSubmit() {
    if (!convertData.name) { setConvertError('Company name is required'); return }
    setConvertSaving(true); setConvertError('')
    try {
      // Create the company record
      const { data: co, error } = await supabase.from('companies').insert({
        name:            convertData.name.trim(),
        contact_name:    convertData.contact_name.trim() || null,
        contact_email:   convertData.contact_email.trim() || null,
        contact_phone:   convertData.contact_phone.trim() || null,
        address:         convertData.address.trim() || null,
        notes:           convertData.notes.trim() || null,
        group_type:      convertData.group_type || 'aca_small_group',
        aca_quarter:     convertData.aca_quarter || null,
        plan_year_start: convertData.plan_year_start || null,
        plan_year_end:   convertData.plan_year_end || null,
        plans:           convertData.plans || [],
        company_code:    convertData.company_code || null,
        hmsa_group_no:   convertData.hmsa_group_no || null,
        band:            convertData.band ? parseInt(convertData.band) : null,
        employee_count:  (prospect.census||[]).filter(m=>m.type==='employee').length || 1,
        status:          'active',
      }).select().single()

      if (error) throw error

      // Link any registered users with this company code to the new company
      if (convertData.company_code) {
        await supabase.from('profiles')
          .update({ company_id: co.id })
          .is('company_id', null)
          .eq('email', prospect.contact_email)
      }

      // Mark prospect as converted
      await supabase.from('prospects')
        .update({ status: 'converted', company_id: co.id })
        .eq('id', prospect.id)

      setConvertSaving(false)
      setShowConvert(false)
      onUpdate({ ...prospect, status: 'converted' })
    } catch(err) {
      setConvertError(err.message || 'Failed to create company. Please try again.')
      setConvertSaving(false)
    }
  }

  async function handleResend() {
    setResending(true)
    // Build email data same as ProspectPage submit
    const quarter = (() => {
      if (!prospect.start_date) return '—'
      const [y,m] = prospect.start_date.split('-').map(Number)
      const q = m<=3?1:m<=6?2:m<=9?3:4
      return `Q${q} ${y}`
    })()
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        type: 'prospect_confirmation',
        to:   prospect.contact_email,
        data: {
          contactName:        prospect.contact_name,
          companyName:        prospect.company_name,
          contactEmail:       prospect.contact_email,
          contactPhone:       prospect.contact_phone,
          startDate:          prospect.start_date,
          censusCount:        census.length,
          employeeCount:      census.filter(m=>m.type==='employee').length,
          feinFiled:          prospect.fein_filed,
          dolFiled:           prospect.dol_filed,
          companyCode:        prospect.company_code,
          quoteRows,
          totals:             { ...totals, quarter },
          ridersTotalMonthly: ridersTotal,
          quarter,
          jotformUrl:         FEIN_DOL_JOTFORM_URL,
        }
      })
    }).catch(console.error)
    setResending(false)
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  async function handleSendApproval() {
    if (!prospect.contact_email) return
    setApproving(true)
    const quarter = (() => {
      if (!prospect.start_date) return '—'
      const [y,m] = prospect.start_date.split('-').map(Number)
      return `Q${m<=3?1:m<=6?2:m<=9?3:4} ${y}`
    })()

    // Calculate deadlines from start date
    const deadlines = (() => {
      if (!prospect.start_date) return {}
      const [y,m] = prospect.start_date.split('-').map(Number)
      const prevM = m === 1 ? 12 : m - 1
      const prevY = m === 1 ? y - 1 : y
      const hmsa  = `${prevY}-${String(prevM).padStart(2,'0')}-10`
      const forms = `${prevY}-${String(prevM).padStart(2,'0')}-05`
      const [hy,hm,hd] = hmsa.split('-').map(Number)
      const [fy,fm,fd] = forms.split('-').map(Number)
      return {
        hmsa:  new Date(hy,hm-1,hd).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),
        forms: new Date(fy,fm-1,fd).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),
      }
    })()

    // Mark approval sent in DB
    const now = new Date().toISOString()
    await supabase.from('prospects')
      .update({ status: 'approved', approval_sent_at: now })
      .eq('id', prospect.id)
    onUpdate({ ...prospect, status: 'approved', approval_sent_at: now })

    // Send approval email
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'prospect_approval',
        to:   prospect.contact_email,
        data: {
          contactName:   prospect.contact_name,
          companyName:   prospect.company_name,
          contactEmail:  prospect.contact_email,
          startDate:     prospect.start_date,
          companyCode:   prospect.company_code,
          quarter,
          deadlines,
          token:         prospect.token,
          quoteRows,
          totals:        { ...totals, quarter },
          ridersTotalMonthly: ridersTotal,
        }
      })
    }).catch(console.error)

    setApproving(false)
    setApproved(true)
    setTimeout(() => setApproved(false), 3000)
  }

  async function saveChecklist(newChecklist) {
    setChecklist(newChecklist)
    await supabase.from('prospects')
      .update({ review_checklist: newChecklist })
      .eq('id', prospect.id)
    onUpdate({ ...prospect, review_checklist: newChecklist })
  }

  async function handleDccaUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setDccaUploading(true)
    const path = `dcca/${prospect.id}/${file.name}`
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
      const url = urlData.publicUrl
      setDccaDoc(url)
      await supabase.from('prospects').update({ dcca_doc_url: url }).eq('id', prospect.id)
      onUpdate({ ...prospect, dcca_doc_url: url })
    }
    setDccaUploading(false)
  }

  return (
    <div className="p-8 page-enter max-w-5xl">
      {/* Back + header */}
      <button className="btn flex items-center gap-2 mb-6 text-sm" onClick={onBack}>
        <ArrowLeft size={14}/> Back to prospects
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-700 mb-1">
            {prospect.company_name || prospect.prospect_name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
            {prospect.company_code && (
              <span className="text-xs font-mono font-bold bg-kiaa-100 text-kiaa-700 px-2 py-0.5 rounded-full">
                Code: {prospect.company_code}
              </span>
            )}
            <span className="text-xs text-surface-400">
              Submitted {new Date(prospect.submitted_at || prospect.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Pacific/Honolulu'})}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {prospect.contact_email && (
            <button className="btn text-sm flex items-center gap-1.5" onClick={handleResend} disabled={resending}>
              {resending ? <Loader size={13} className="animate-spin"/> : sent ? <CheckCircle size={13} className="text-emerald-500"/> : <Send size={13}/>}
              {sent ? 'Sent!' : 'Resend email'}
            </button>
          )}
          {prospect.status === 'submitted' && prospect.contact_email && (() => {
            const ITEMS = ['dcca_search','dcca_name_match','dcca_active','fein_received','dol_received','census_minimum','census_age_ok','quote_confirmed']
            const allDone = ITEMS.every(k => checklist[k])
            const remaining = ITEMS.filter(k => !checklist[k]).length
            return (
              <button className={`btn text-sm flex items-center gap-1.5 ${allDone ? 'text-blue-600 border-blue-200 hover:bg-blue-50' : 'text-surface-400 border-surface-200 cursor-not-allowed'}`}
                onClick={allDone ? handleSendApproval : undefined} disabled={approving || !allDone}
                title={!allDone ? `Complete all checklist items first (${remaining} remaining)` : 'Send approval link'}>
                {approving ? <Loader size={13} className="animate-spin"/> : approved ? <CheckCircle size={13} className="text-blue-500"/> : <Send size={13}/>}
                {approved ? 'Approval sent!' : allDone ? 'Send approval link' : `Send approval link (${remaining} items remaining)`}
              </button>
            )
          })()}
          {prospect.status === 'approved' && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
              <CheckCircle size={13}/> Approval link sent {prospect.approval_sent_at ? new Date(prospect.approval_sent_at).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'Pacific/Honolulu'}) : ''}
            </div>
          )}
          {prospect.status === 'accepted' && (
            <div className="flex items-center gap-1.5 text-xs text-kiaa-600 bg-kiaa-50 border border-kiaa-200 px-3 py-1.5 rounded-lg">
              <CheckCircle size={13}/> Accepted by {prospect.accepted_by_name || prospect.contact_name} on {prospect.accepted_at ? new Date(prospect.accepted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Pacific/Honolulu'}) : '—'}
            </div>
          )}
          {(prospect.status === 'submitted' || prospect.status === 'approved' || prospect.status === 'accepted') && (
            <button className="btn text-sm text-emerald-600 border-emerald-200 hover:bg-emerald-50 flex items-center gap-1.5"
              onClick={e => { e.stopPropagation(); openConvert() }}>
              <CheckCircle size={13}/> Convert to member
            </button>
          )}
          {prospect.status === 'declined' && (
            <button className="btn text-sm text-kiaa-600 border-kiaa-200 hover:bg-kiaa-50 flex items-center gap-1.5"
              onClick={async () => {
                await supabase.from('prospects').update({ status:'submitted' }).eq('id', prospect.id)
                onUpdate({ ...prospect, status:'submitted' })
              }}>
              <ArrowLeft size={13}/> Reopen prospect
            </button>
          )}
        </div>
      </div>

      {/* Convert to member modal */}
      {showConvert && convertData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-4">
            <div className="bg-kiaa-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <div className="font-display font-semibold text-white text-base">Convert to member</div>
                <div className="text-kiaa-300 text-xs mt-0.5">Review and confirm company details before creating the member record</div>
              </div>
              <button className="text-kiaa-400 hover:text-white" onClick={() => setShowConvert(false)}>✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {convertError && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
                  <AlertCircle size={14}/>{convertError}
                </div>
              )}

              <div>
                <label className="label">Company name <span className="text-red-400">*</span></label>
                <input className="input" value={convertData.name}
                  onChange={e => setConvertData(d => ({...d, name: e.target.value}))}/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contact name</label>
                  <input className="input" value={convertData.contact_name}
                    onChange={e => setConvertData(d => ({...d, contact_name: e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Contact phone</label>
                  <input className="input" value={convertData.contact_phone}
                    onChange={e => setConvertData(d => ({...d, contact_phone: e.target.value}))}/>
                </div>
              </div>

              <div>
                <label className="label">Contact email</label>
                <input className="input" type="email" value={convertData.contact_email}
                  onChange={e => setConvertData(d => ({...d, contact_email: e.target.value}))}/>
              </div>

              <div>
                <label className="label">Address</label>
                <input className="input" value={convertData.address}
                  onChange={e => setConvertData(d => ({...d, address: e.target.value}))}/>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="label">City</label>
                  <input className="input" value={convertData.city}
                    onChange={e => setConvertData(d => ({...d, city: e.target.value}))}/>
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={convertData.state}
                    onChange={e => setConvertData(d => ({...d, state: e.target.value}))}/>
                </div>
                <div>
                  <label className="label">ZIP</label>
                  <input className="input" value={convertData.zip}
                    onChange={e => setConvertData(d => ({...d, zip: e.target.value}))}/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Group type</label>
                  <select className="input" value={convertData.group_type}
                    onChange={e => setConvertData(d => ({...d, group_type: e.target.value}))}>
                    <option value="aca_small_group">ACA Small Group</option>
                    <option value="merit_rated">Merit Rated Group (MRG)</option>
                  </select>
                </div>
                {convertData.group_type === 'aca_small_group' ? (
                  <div>
                    <label className="label">ACA quarter</label>
                    <input className="input" value={convertData.aca_quarter} placeholder="e.g. 2026-3"
                      onChange={e => setConvertData(d => ({...d, aca_quarter: e.target.value}))}/>
                  </div>
                ) : (
                  <div>
                    <label className="label">Band (1–9)</label>
                    <input className="input" type="number" min="1" max="9" value={convertData.band}
                      onChange={e => setConvertData(d => ({...d, band: e.target.value}))}/>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Plan year start</label>
                  <input type="date" className="input" value={convertData.plan_year_start}
                    onChange={e => setConvertData(d => ({...d, plan_year_start: e.target.value}))}/>
                </div>
                <div>
                  <label className="label">Plan year end</label>
                  <input type="date" className="input" value={convertData.plan_year_end}
                    onChange={e => setConvertData(d => ({...d, plan_year_end: e.target.value}))}/>
                </div>
              </div>

              <div>
                <label className="label">HMSA group number <span className="text-surface-400 font-normal">(assigned by HMSA at enrollment)</span></label>
                <input className="input" placeholder="e.g. 12345" value={convertData.hmsa_group_no}
                  onChange={e => setConvertData(d => ({...d, hmsa_group_no: e.target.value}))}/>
              </div>

              <div>
                <label className="label">Company code</label>
                <input className="input font-mono bg-surface-50 text-surface-500" value={convertData.company_code} readOnly/>
                <p className="text-xs text-surface-400 mt-1">Pre-filled from prospect record. HR contact will use this to log in.</p>
              </div>

              {convertData.plans?.length > 0 && (
                <div>
                  <label className="label">Elected plans</label>
                  <div className="flex flex-wrap gap-2">
                    {convertData.plans.map(p => (
                      <span key={p} className="text-xs bg-kiaa-100 text-kiaa-700 px-2 py-1 rounded-full font-medium">{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-surface-100 flex gap-3">
              <button className="btn flex-1" onClick={() => setShowConvert(false)}>Cancel</button>
              <button className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={handleConvertSubmit} disabled={convertSaving}>
                {convertSaving ? <><Loader size={14} className="animate-spin"/>Creating…</> : <><CheckCircle size={14}/>Create member record</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Company + enrollment details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Company</div>
          {[
            ['Name',    prospect.company_name || prospect.prospect_name],
            ['Address', [prospect.address, prospect.city, prospect.state, prospect.zip].filter(Boolean).join(', ') || '—'],
            ['Contact', prospect.contact_name || '—'],
            ['Email',   prospect.contact_email || '—'],
            ['Phone',   prospect.contact_phone || '—'],
            ['Notes',   prospect.notes || '—'],
          ].map(([l,v]) => (
            <div key={l} className="flex justify-between py-1.5 border-b border-surface-50 last:border-0 text-sm gap-4">
              <span className="text-surface-400 flex-shrink-0">{l}</span>
              <span className="text-surface-700 text-right break-all">{v}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Enrollment</div>
          {[
            ['Coverage start', fmtDate(prospect.start_date)],
            ['Rate quarter',   (() => { if (!prospect.start_date) return '—'; const [y,m] = prospect.start_date.split('-').map(Number); return `Q${m<=3?1:m<=6?2:m<=9?3:4} ${y}` })()],
            ['FEIN attested',  prospect.fein_filed ? '✓ Yes' : 'Not attested'],
            ['DOL attested',   prospect.dol_filed  ? '✓ Yes' : 'Not attested'],
            ['Census',         `${census.length} member${census.length!==1?'s':''} · ${census.filter(m=>m.type==='employee').length} employees`],
            ['Company code',   prospect.company_code || '—'],
          ].map(([l,v]) => (
            <div key={l} className="flex justify-between py-1.5 border-b border-surface-50 last:border-0 text-sm">
              <span className="text-surface-400">{l}</span>
              <span className={`font-semibold ${v?.toString().startsWith('✓') ? 'text-emerald-600' : 'text-surface-700'}`}>{v}</span>
            </div>
          ))}
          {census.some(m=>m.disabled_dependent) && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5"/>
              {census.filter(m=>m.disabled_dependent).length} disabled dependent{census.filter(m=>m.disabled_dependent).length>1?'s':''} flagged — HMSA verification required
            </div>
          )}
          {prospect.status === 'declined' && prospect.decline_reason && (
            <div className="mt-3 border border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-600 px-3 py-2 text-xs font-semibold text-white">Decline reason</div>
              <div className="px-3 py-2 bg-red-50">
                <div className="text-sm font-semibold text-red-700">{prospect.decline_reason}</div>
                {prospect.decline_comment && (
                  <div className="text-xs text-red-600 mt-1 italic">"{prospect.decline_comment}"</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin review checklist */}
      {prospect.status !== 'converted' && (
        <div className="mb-6">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Admin review checklist</div>
          <div className="card p-0 overflow-hidden">
            {/* Progress bar */}
            {(() => {
              const ITEMS = [
                'dcca_search','dcca_name_match','dcca_active',
                'fein_received','dol_received',
                'census_minimum','census_age_ok','quote_confirmed'
              ]
              const done = ITEMS.filter(k => checklist[k]).length
              const allDone = done === ITEMS.length
              return (
                <>
                  <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-surface-700">Pre-approval checklist</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {done} of {ITEMS.length} complete
                    </span>
                  </div>

                  {/* Business verification */}
                  <div className="px-4 pt-3 pb-1">
                    <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Business verification</div>
                  </div>
                  {[
                    { key:'dcca_search', label:'DCCA business name search completed', sub:'Verify at dcca.hawaii.gov/breg — confirm company is registered in Hawaii' },
                    { key:'dcca_name_match', label:'Business name matches census submission', sub:'Name on DCCA registry matches the company name submitted' },
                    { key:'dcca_active', label:'Business is in active/good standing status', sub:'DCCA status must be Active — not Dissolved, Expired, or Revoked' },
                  ].map(item => (
                    <div key={item.key}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-surface-50 cursor-pointer transition-all ${checklist[item.key] ? 'bg-emerald-50/50' : 'hover:bg-surface-50'}`}
                      onClick={() => saveChecklist({ ...checklist, [item.key]: !checklist[item.key] })}>
                      <input type="checkbox" readOnly checked={!!checklist[item.key]}
                        className="w-4 h-4 mt-0.5 accent-kiaa-600 flex-shrink-0"/>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${checklist[item.key] ? 'line-through text-surface-400' : 'text-surface-700'}`}>{item.label}</div>
                        <div className="text-xs text-surface-400 mt-0.5">{item.sub}</div>
                        {/* DCCA upload on first item */}
                        {item.key === 'dcca_search' && (
                          <div className="mt-2" onClick={e => e.stopPropagation()}>
                            {dccaDoc ? (
                              <div className="flex items-center gap-2">
                                <a href={dccaDoc} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-kiaa-600 hover:underline flex items-center gap-1">
                                  <FileText size={12}/> View DCCA document
                                </a>
                                <button className="text-xs text-surface-400 hover:text-red-500"
                                  onClick={() => { setDccaDoc(null); supabase.from('prospects').update({dcca_doc_url:null}).eq('id',prospect.id) }}>
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <button className="text-xs text-kiaa-600 hover:text-kiaa-800 flex items-center gap-1 border border-kiaa-200 rounded px-2 py-1 hover:bg-kiaa-50"
                                onClick={() => dccaRef.current?.click()} disabled={dccaUploading}>
                                {dccaUploading ? <><Loader size={11} className="animate-spin"/> Uploading…</> : <><Upload size={11}/> Upload DCCA search result</>}
                              </button>
                            )}
                            <input ref={dccaRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleDccaUpload}/>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* FEIN & DOL */}
                  <div className="px-4 pt-3 pb-1">
                    <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">FEIN &amp; DOL filing</div>
                  </div>
                  {[
                    { key:'fein_received', label:'FEIN received via JotForm', sub:'Check JotForm submissions for the company\'s Federal Employer Identification Number' },
                    { key:'dol_received',  label:'Hawaii DOL number received via JotForm', sub:'Confirm Department of Labor registration number has been submitted' },
                  ].map(item => (
                    <div key={item.key}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-surface-50 cursor-pointer transition-all ${checklist[item.key] ? 'bg-emerald-50/50' : 'hover:bg-surface-50'}`}
                      onClick={() => saveChecklist({ ...checklist, [item.key]: !checklist[item.key] })}>
                      <input type="checkbox" readOnly checked={!!checklist[item.key]}
                        className="w-4 h-4 mt-0.5 accent-kiaa-600 flex-shrink-0"/>
                      <div>
                        <div className={`text-sm font-medium ${checklist[item.key] ? 'line-through text-surface-400' : 'text-surface-700'}`}>{item.label}</div>
                        <div className="text-xs text-surface-400 mt-0.5">{item.sub}</div>
                      </div>
                    </div>
                  ))}

                  {/* Census review */}
                  <div className="px-4 pt-3 pb-1">
                    <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Census &amp; quote review</div>
                  </div>
                  {[
                    { key:'census_minimum', label:'Employee count meets minimum (2 employees)', sub:'ACA Small Group requires a minimum of 2 enrolled employees' },
                    { key:'census_age_ok',  label:'Age validation reviewed — no unresolved over-26 dependents', sub:'Any flagged disabled dependents noted for HMSA verification' },
                    { key:'quote_confirmed',label:'Quote calculated and confirmed with HMSA', sub:'Age-based premiums verified for all enrolled members for the coverage quarter' },
                  ].map(item => (
                    <div key={item.key}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-surface-50 last:border-0 cursor-pointer transition-all ${checklist[item.key] ? 'bg-emerald-50/50' : 'hover:bg-surface-50'}`}
                      onClick={() => saveChecklist({ ...checklist, [item.key]: !checklist[item.key] })}>
                      <input type="checkbox" readOnly checked={!!checklist[item.key]}
                        className="w-4 h-4 mt-0.5 accent-kiaa-600 flex-shrink-0"/>
                      <div>
                        <div className={`text-sm font-medium ${checklist[item.key] ? 'line-through text-surface-400' : 'text-surface-700'}`}>{item.label}</div>
                        <div className="text-xs text-surface-400 mt-0.5">{item.sub}</div>
                      </div>
                    </div>
                  ))}

                  {!allDone && (
                    <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center gap-2">
                      <AlertCircle size={13}/> Complete all {ITEMS.length} items before sending the approval link. {ITEMS.length - done} remaining.
                    </div>
                  )}
                  {allDone && (
                    <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 text-xs text-emerald-700 flex items-center gap-2">
                      <CheckCircle size={13}/> All items complete — ready to send approval link.
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Census table */}
      {census.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Census</div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm" style={{tableLayout:'fixed'}}>
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50">
                  {['ID','Type','Sex','DOB','Age','Status'].map((h,i) => (
                    <th key={h} className={`px-3 py-2 text-xs font-semibold text-surface-400 uppercase tracking-wider ${i>1?'text-center':''} ${i===0?'text-left':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {census.map((m,i) => {
                  const age = getAge(m.dob, refDate)
                  const isDep = m.type !== 'employee'
                  const prevM = census[i-1]
                  const newGroup = isDep && (!prevM || prevM.emp_id !== m.emp_id)
                  return (
                    <>
                      {i>0 && m.type==='employee' && (
                        <tr key={`sp-${i}`}><td colSpan={6} className="py-0.5 bg-surface-50 border-b border-surface-100"/></tr>
                      )}
                      <tr key={m.id||i} className={`border-b border-surface-50 last:border-0 ${isDep?'bg-surface-50/50':''}`}>
                        <td className={`px-3 py-2 font-mono text-xs text-surface-500 ${isDep?'pl-6':''}`}>{m.emp_id}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                            m.type==='employee'?'bg-kiaa-100 text-kiaa-700':
                            m.type==='dependent_spouse'?'bg-violet-100 text-violet-700':'bg-amber-100 text-amber-700'
                          }`}>
                            {m.type==='employee'?'Employee':m.type==='dependent_spouse'?'Dep. spouse':'Dep. child'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-surface-600 text-xs">{m.sex}</td>
                        <td className="px-3 py-2 font-mono text-xs text-surface-500">{m.dob}</td>
                        <td className={`px-3 py-2 text-center font-semibold text-sm ${
                          m.type === 'dependent_child' && age != null && age >= 26 ? 'text-red-600' :
                          m.type === 'dependent_child' && age === 25 ? 'text-amber-600' : 'text-surface-700'
                        }`}>{age??'—'}</td>
                        <td className="px-3 py-2 text-xs">
                          {m.disabled_dependent
                            ? <span className="text-amber-600 flex items-center gap-1"><AlertCircle size={11}/> Disabled dep.</span>
                            : m.type === 'dependent_child' && age != null && age >= 26
                              ? <span className="text-red-600">Over 26</span>
                              : m.type === 'dependent_child' && age != null && age <= 18
                                ? <span className="text-emerald-600">Pediatric ✓</span>
                                : <span className="text-emerald-600">✓ Eligible</span>
                          }
                        </td>
                      </tr>
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quote table */}
      {census.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
            Quote — {(() => { if (!prospect.start_date) return '—'; const [y,m] = prospect.start_date.split('-').map(Number); return `Q${m<=3?1:m<=6?2:m<=9?3:4} ${y}` })()} rates
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm" style={{tableLayout:'fixed'}}>
              <thead>
                <tr className="border-b border-surface-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider bg-surface-50" style={{width:'28%'}}>Member</th>
                  {ACA_PLANS.map(p => (
                    <th key={p.id} className={`px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider ${p.color} ${p.bg}`} style={{width:'17%'}}>
                      {p.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-600" style={{width:'18%'}}>Riders</th>
                </tr>
              </thead>
              <tbody>
                {quoteRows.map((row,i) => {
                  const prev = quoteRows[i-1]
                  return (
                    <>
                      {i>0 && row.type==='employee' && (
                        <tr key={`sp-${i}`}><td colSpan={5} className="py-0.5 bg-surface-50 border-b border-surface-100"/></tr>
                      )}
                      <tr key={row.id||i} className={`border-b border-surface-50 last:border-0 ${row.type!=='employee'?'bg-surface-50/50':''}`}>
                        <td className={`px-3 py-2 ${row.type!=='employee'?'pl-6':''}`}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs text-surface-400">{row.emp_id}</span>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                              row.type==='employee'?'bg-kiaa-100 text-kiaa-700':
                              row.type==='dependent_spouse'?'bg-violet-100 text-violet-700':'bg-amber-100 text-amber-700'
                            }`}>
                              {row.type==='employee'?'Emp':row.type==='dependent_spouse'?'Spouse':'Child'}
                            </span>
                            <span className="text-xs text-surface-400">age {row.age??'—'}</span>
                          </div>
                        </td>
                        {ACA_PLANS.map(p => (
                          <td key={p.id} className="px-3 py-2 text-right font-mono text-sm">
                            {row.premiums[p.id]!=null ? fmtMoney(row.premiums[p.id]) : <span className="text-surface-300">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right">
                          {row.type==='employee'&&row.tier ? (
                            <div>
                              <span className="font-mono text-sm">{fmtMoney(RIDERS[row.tier])}</span>
                              <div className="text-xs text-surface-400">{TIER_LABEL[row.tier]}</div>
                            </div>
                          ) : row.isMinorChild ? (
                            <span className="text-xs text-emerald-600 font-medium">Pediatric ✓</span>
                          ) : (
                            <span className="text-surface-300 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    </>
                  )
                })}
                <tr className="border-t-2 border-surface-200 bg-surface-50">
                  <td className="px-3 py-2.5 text-sm font-semibold text-surface-700">Medical total</td>
                  {ACA_PLANS.map(p => (
                    <td key={p.id} className={`px-3 py-2.5 text-right font-mono text-sm font-semibold ${p.color}`}>
                      {totals[p.id]>0 ? fmtMoney(totals[p.id]) : '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-slate-700">
                    {ridersTotal>0 ? fmtMoney(ridersTotal) : '—'}
                  </td>
                </tr>
                <tr className="bg-kiaa-50 border-t border-kiaa-100">
                  <td className="px-3 py-2 text-sm font-semibold text-kiaa-700">Plan + Riders combined</td>
                  {ACA_PLANS.map(p => (
                    <td key={p.id} className="px-3 py-2 text-right font-mono text-sm font-semibold text-kiaa-700">
                      {totals[p.id]>0 ? fmtMoney(totals[p.id]+ridersTotal) : '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2"/>
                </tr>
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-surface-100 bg-white text-xs text-surface-400 italic space-y-0.5">
              <div>✦ KIAA admin fee of $4.00 per enrolled employee/month not included above.</div>
              <div>✦ Estimates based on {(() => { if (!prospect.start_date) return '—'; const [y,m] = prospect.start_date.split('-').map(Number); return `Q${m<=3?1:m<=6?2:m<=9?3:4} ${y}` })()} HMSA rates. Final premiums confirmed at enrollment.</div>
            </div>
          </div>
        </div>
      )}

      {/* Acceptance record */}
      {prospect.accepted_at && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Acceptance record</div>
            <button className="btn text-xs flex items-center gap-1.5" onClick={() => printAcceptanceRecord(prospect, quoteRows, totals, ridersTotal)}>
              <Printer size={13}/> Print acceptance record
            </button>
          </div>
          <div className="card border-2 border-kiaa-300 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-surface-100">
              <CheckCircle size={18} className="text-kiaa-600"/>
              <span className="font-semibold text-kiaa-700">Quote accepted</span>
              <span className="text-xs text-surface-400 ml-auto">
                {new Date(prospect.accepted_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'Pacific/Honolulu'})} at {new Date(prospect.accepted_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'Pacific/Honolulu'})} HST
              </span>
            </div>
            {[
              ['Accepted by',   prospect.accepted_by_name || '—'],
              ['Email',         prospect.accepted_by_email || '—'],
              ['IP address',    prospect.accepted_ip || '—'],
              ['Company code',  prospect.company_code || '—'],
              ['Elected plans', (prospect.elected_plans || []).join(' · ') || '—'],
            ].map(([l,v]) => (
              <div key={l} className="flex justify-between text-sm">
                <span className="text-surface-400">{l}</span>
                <span className="font-semibold text-surface-700 text-right font-mono text-xs">{v}</span>
              </div>
            ))}
            {prospect.acknowledgments && (
              <div className="pt-2 border-t border-surface-100">
                <div className="text-xs text-surface-400 mb-2">Acknowledgments confirmed</div>
                {(prospect.acknowledgments || []).map((ack, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-surface-600 mb-1">
                    <CheckCircle size={11} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
                    <span>{ack}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ProspectsPage ────────────────────────────────────────
export default function ProspectsPage() {
  const { profile } = useAuth()
  const [prospects,   setProspects]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [creating,    setCreating]    = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [copied,      setCopied]      = useState(null)
  const [selected,    setSelected]    = useState(null)
  const [newName,     setNewName]     = useState('')
  const [newEmail,    setNewEmail]    = useState('')
  const [newNote,     setNewNote]     = useState('')

  useEffect(() => {
    supabase.from('prospects').select('*').order('created_at',{ascending:false})
      .then(({ data }) => { setProspects(data||[]); setLoading(false) })
  }, [])

  async function createProspect() {
    if (!newName.trim()) return
    setCreating(true)
    const token = generateToken()
    const { data, error } = await supabase.from('prospects').insert({
      token, prospect_name: newName.trim(),
      contact_email: newEmail.trim()||null,
      notes: newNote.trim()||null,
      status: 'pending', created_by: profile?.id,
    }).select().single()
    setCreating(false)
    if (!error && data) {
      setProspects(p => [data,...p])
      setShowNew(false); setNewName(''); setNewEmail(''); setNewNote('')
    }
  }

  function copyLink(token, e) {
    e.stopPropagation()
    navigator.clipboard.writeText(`${window.location.origin}/prospect/${token}`)
    setCopied(token); setTimeout(() => setCopied(null), 2000)
  }

  const statusColors = {
    pending:   { cls:'bg-surface-100 text-surface-600',  label:'Link sent'  },
    submitted: { cls:'bg-amber-100 text-amber-700',       label:'Submitted'  },
    approved:  { cls:'bg-blue-100 text-blue-700',         label:'Approved'   },
    accepted:  { cls:'bg-kiaa-100 text-kiaa-700',         label:'Accepted'   },
    converted: { cls:'bg-emerald-100 text-emerald-700',   label:'Converted'  },
    declined:  { cls:'bg-red-100 text-red-700',           label:'Declined'   },
  }

  if (selected) {
    return (
      <ProspectDetail
        prospect={selected}
        onBack={() => setSelected(null)}
        onUpdate={updated => {
          setProspects(ps => ps.map(p => p.id===updated.id ? updated : p))
          setSelected(updated)
        }}
        onDelete={id => {
          setProspects(ps => ps.filter(p => p.id!==id))
          setSelected(null)
        }}
      />
    )
  }

  return (
    <div className="p-8 page-enter">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-kiaa-700">Prospective Members</h1>
          <p className="text-surface-400 text-sm mt-0.5">Generate quote links for ACA Small Group prospects</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowNew(true)}>
          <Plus size={14}/> New prospect link
        </button>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-display font-bold text-lg text-kiaa-700 mb-4">Create prospect link</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Company / prospect name <span className="text-red-400">*</span></label>
                <input className="input" placeholder="e.g. Aloha Bakery LLC"
                  value={newName} onChange={e => setNewName(e.target.value)}/>
              </div>
              <div>
                <label className="label">Contact email (optional)</label>
                <input className="input" type="email" placeholder="hr@company.com"
                  value={newEmail} onChange={e => setNewEmail(e.target.value)}/>
              </div>
              <div>
                <label className="label">Notes (internal)</label>
                <input className="input" placeholder="e.g. Referred by DLIR, ~12 employees"
                  value={newNote} onChange={e => setNewNote(e.target.value)}/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn flex-1" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={createProspect} disabled={creating || !newName.trim()}>
                {creating ? <><Loader size={14} className="animate-spin"/>Creating…</> : 'Generate link'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total prospects', value:prospects.length,                                   color:'text-kiaa-600'  },
          { label:'Submitted',       value:prospects.filter(p=>p.status==='submitted').length,  color:'text-amber-600' },
          { label:'Converted',       value:prospects.filter(p=>p.status==='converted').length,  color:'text-emerald-600'},
          { label:'Pending',         value:prospects.filter(p=>p.status==='pending').length,    color:'text-surface-500'},
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center py-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-surface-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader size={24} className="animate-spin text-surface-400 mx-auto"/></div>
      ) : prospects.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={36} className="text-surface-300 mx-auto mb-3"/>
          <div className="font-semibold text-surface-500">No prospects yet</div>
          <p className="text-surface-400 text-sm mt-1">Create a prospect link to send to a potential member</p>
        </div>
      ) : (
        <div className="space-y-3">
          {prospects.map(p => {
            const { cls, label } = statusColors[p.status] || statusColors.pending
            const created = new Date(p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Pacific/Honolulu'})
            const isNew = p.status === 'submitted'
            return (
              <div key={p.id}
                className={`card hover:shadow-md cursor-pointer transition-all group ${isNew ? 'border-amber-300 bg-amber-50/30' : 'hover:border-kiaa-300'}`}
                onClick={() => setSelected(p)}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      p.status==='converted' ? 'bg-emerald-100 text-emerald-700' :
                      p.status==='accepted'  ? 'bg-kiaa-100 text-kiaa-700' :
                      p.status==='approved'  ? 'bg-blue-100 text-blue-700' :
                      p.status==='submitted' ? 'bg-amber-100 text-amber-700' :
                                               'bg-surface-100 text-surface-500'
                    }`}>
                      {(p.company_name || p.prospect_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-surface-700 truncate">{p.company_name || p.prospect_name || 'Unnamed prospect'}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cls}`}>{label}</span>
                        {p.company_code && (
                          <span className="text-xs font-mono font-bold bg-kiaa-100 text-kiaa-700 px-2 py-0.5 rounded-full flex-shrink-0">
                            {p.company_code}
                          </span>
                        )}
                        {isNew && (
                          <span className="text-xs font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full flex-shrink-0 animate-pulse">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-surface-400">
                        {p.contact_name  && <span className="flex items-center gap-1">👤 {p.contact_name}</span>}
                        {p.contact_email && <span className="flex items-center gap-1">✉ {p.contact_email}</span>}
                        {p.contact_phone && <span className="flex items-center gap-1">📞 {p.contact_phone}</span>}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-surface-400 mt-1">
                        {p.start_date && <span>📅 Coverage start: <strong className="text-surface-600">{fmtDate(p.start_date)}</strong></span>}
                        {p.census      && <span>👥 {p.census.length} members · {p.census.filter(m=>m.type==='employee').length} employees</span>}
                        {p.notes       && <span className="italic truncate max-w-xs">📝 {p.notes}</span>}
                        {p.status === 'declined' && p.decline_reason && (
                          <span className="text-red-600">❌ {p.decline_reason}</span>
                        )}
                      </div>
                      <div className="text-xs text-surface-300 mt-1">Created {created}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button className="btn text-xs flex items-center gap-1.5" onClick={e => copyLink(p.token, e)}>
                      {copied===p.token ? <><CheckCircle size={13} className="text-emerald-500"/>Copied!</> : 'Copy link'}
                    </button>
                    <a href={`${window.location.origin}/prospect/${p.token}`} target="_blank" rel="noopener noreferrer"
                      className="btn text-xs flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <ExternalLink size={13}/> View form
                    </a>
                    <span className="text-xs text-surface-300 hidden sm:flex items-center gap-1 group-hover:text-kiaa-500 transition-colors">
                      View submission →
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
