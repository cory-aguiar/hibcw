import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PLAN_MAP, PLANS, RIDERS_PLAN, COMPCARE, isPlanCompCareEligible, groupKaiserRates, buildKaiserPlan, formatPhone, ACA_PLAN_BENEFITS, ACA_COMPARISON_FIELDS } from '@/lib/plans'

// Maps a plan_id to its guide family ID
function guideIdForPlan(planId) {
  if (!planId) return null
  if (planId.startsWith('ppp'))       return 'ppp'
  if (planId.startsWith('compmed_a')) return 'compmed_a'
  if (planId.startsWith('compmed_b')) return 'compmed_b'
  if (planId.startsWith('hph_plus'))  return 'hph_plus'
  if (planId.startsWith('hph_basic')) return 'hph_basic'
  return null
}

import { Download, ExternalLink, ChevronDown, ChevronUp, FileText, Info } from 'lucide-react'

import { usePlanYear, planYearLabel, planYearLong } from '@/lib/PlanYearContext'

function fmt(v) {
  if (!v && v !== 0) return '—'
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
}
function parseMoney(v) {
  return parseFloat(String(v).replace(/[$,]/g,'')) || 0
}

// ── Code entry screen ─────────────────────────────────────────
function CodeEntry({ onFound }) {
  const [code,    setCode]    = useState('')

  // Auto-fill and auto-submit code from URL ?code= param (used by Preview Portal button)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlCode = params.get('code')
    if (urlCode && urlCode.length >= 4) {
      setCode(urlCode.slice(0,6).toUpperCase())
      // Small delay to let state settle then auto-lookup
      setTimeout(() => {
        const btn = document.getElementById('code-submit-btn')
        if (btn) btn.click()
      }, 100)
    }
  }, [])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleLookup(e) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true); setError('')

    const { data, error: err } = await supabase
      .from('companies')
      .select('id,name,plans,company_code,status,band,compcare_elected,oe_status,benefits_contact_name,benefits_contact_email,benefits_contact_phone,oe_deadline,oe_instructions,logo_url,kaiser_eligible,kaiser_schedule,group_type,aca_quarter,hmsa_group_no')
      .eq('company_code', code.trim())
      .single()

    setLoading(false)
    if (err || !data) { setError('Company code not found. Please check with your HR department.'); return }
    if (data.status === 'inactive') { setError('This company is no longer active. Contact your HR department.'); return }
    if (data.group_type !== 'aca_small_group' && (!data.plans || data.plans.length === 0)) { setError('Your employer has not yet selected their health plans. Check back soon or contact your HR department.'); return }
    onFound(data)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif", padding:'24px', backgroundColor:'#EDF2F6', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='600' viewBox='0 0 900 600'%3E%3Cpath d='M0 300 C150 200 300 400 450 300 C600 200 750 400 900 300 L900 600 L0 600 Z' fill='%23385262' fill-opacity='0.04'/%3E%3Cpath d='M0 350 C120 260 280 450 450 350 C620 250 780 440 900 350 L900 600 L0 600 Z' fill='%236595B2' fill-opacity='0.035'/%3E%3Cpath d='M0 420 C180 330 320 500 500 410 C660 330 780 480 900 400 L900 600 L0 600 Z' fill='%23385262' fill-opacity='0.03'/%3E%3Cpath d='M0 80 C200 160 350 0 550 100 C700 180 800 60 900 120 L900 0 L0 0 Z' fill='%236595B2' fill-opacity='0.03'/%3E%3Cpath d='M0 40 C150 120 300 -20 500 60 C680 140 820 20 900 80 L900 0 L0 0 Z' fill='%23385262' fill-opacity='0.025'/%3E%3C/svg%3E")`, backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat' }}>
      <div style={{ textAlign:'center', marginBottom:'32px' }}>
        <img src='/logowhite.png' alt='KIAA' style={{ width:'200px', height:'200px', objectFit:'contain', margin:'0 auto 12px', display:'block', filter:'brightness(0) saturate(100%) invert(18%) sepia(28%) saturate(800%) hue-rotate(185deg) brightness(85%)' }}/>
        <div style={{ fontWeight:700, fontSize:'20px', color:'#385262' }}>KIAA Employee Benefits</div>
        <div style={{ fontSize:'13px', color:'#877C73', marginTop:'4px' }}>View your health plan options &amp; coverage details</div>
      </div>
      <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'16px', padding:'32px', width:'100%', maxWidth:'400px', boxShadow:'0 4px 24px rgba(108,107,104,0.10)' }}>
        <h1 style={{ fontWeight:700, fontSize:'18px', color:'#263944', marginBottom:'8px' }}>View your health plans</h1>
        <p style={{ fontSize:'13px', color:'#877C73', marginBottom:'20px', lineHeight:1.6 }}>
          Enter the company code your HR department provided. You'll be able to see your plan options, benefit details, and monthly premiums.
        </p>
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
          {['📋 Plan details','💊 Drug coverage','💰 Your premiums'].map(item => (
            <div key={item} style={{ flex:1, background:'#EDF2F6', borderRadius:'8px', padding:'8px 6px', textAlign:'center', fontSize:'10px', fontWeight:600, color:'#385262', lineHeight:1.3 }}>{item}</div>
          ))}
        </div>
        <form onSubmit={handleLookup}>
          <label style={{ display:'block', fontSize:'11px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6595B2', marginBottom:'6px' }}>
            Company code
          </label>
          <input
            type="text" inputMode="text" maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase().slice(0,6)); setError('') }}
            placeholder="XXXXXX" autoFocus
            style={{ width:'100%', padding:'14px', borderRadius:'8px', border:`2px solid ${error?'#E24B4A':code.length>=4?'#6595B2':'#BED8E1'}`, fontSize:'28px', fontFamily:'monospace', fontWeight:700, color:'#385262', letterSpacing:'0.3em', outline:'none', background:'#fff', textAlign:'center', marginBottom:'4px', transition:'border-color 0.15s' }}
          />
          {error && (
            <div style={{ background:'#FCEBEB', border:'0.5px solid #F09595', borderRadius:'8px', padding:'8px 12px', marginTop:'10px', fontSize:'12px', color:'#791F1F', display:'flex', gap:'7px' }}>
              <span>⚠</span>{error}
            </div>
          )}
          <button id="code-submit-btn" type="submit" disabled={loading||!code.trim()} style={{ width:'100%', marginTop:'16px', padding:'11px', background:loading||!code.trim()?'#84AAC1':'#6595B2', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:loading||!code.trim()?'not-allowed':'pointer' }}>
            {loading ? 'Looking up…' : 'View my plans →'}
          </button>
        </form>
        <p style={{ fontSize:'11px', color:'#84AAC1', textAlign:'center', marginTop:'18px', lineHeight:1.5 }}>
          Don't know your code? Ask your HR department.
        </p>
      </div>
      <p style={{ marginTop:'24px', fontSize:'11px', color:'#84AAC1' }}>
        Powered by KIAA Benefits OS
      </p>
    </div>
  )
}

// ── Plan card (employee view) ─────────────────────────────────
function PlanCard({ plan, election, rate, compCareElected, doc, guideDoc }) {
  const [open, setOpen] = useState(false)
  if (!election?.elected) return null

  const method   = election.contrib_method || 'fixed'
  const ccAddon  = compCareElected && isPlanCompCareEligible(plan.id) ? COMPCARE.tiers.single : 0

  function getEe(base, eeFixed, grossWage) {
    const adj = (parseMoney(base)||0) + ccAddon
    if (method === 'phca' && grossWage) {
      const pct15 = parseMoney(grossWage) * 0.015
      const cap50 = adj * 0.50
      return Math.min(pct15, cap50)
    }
    return parseMoney(eeFixed)
  }

  const tiers = [
    { label:'Employee only (Single)', total: (parseMoney(rate?.single)||0)+ccAddon,    ee: getEe(rate?.single,    election.ee_single,    election.gross_wage) },
    { label:'Employee + 1 (2-Party)', total: (parseMoney(rate?.two_party)||0)+ccAddon, ee: getEe(rate?.two_party, election.ee_two_party, election.gross_wage) },
    { label:'Employee + family',      total: (parseMoney(rate?.family)||0)+ccAddon,    ee: getEe(rate?.family,    election.ee_family,    election.gross_wage) },
  ]

  const hdrBg = plan.hmsa_class === '7b' ? '#334155' : '#385262'

  return (
    <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden', marginBottom:'12px' }}>
      {/* Header */}
      <div style={{ background: hdrBg, padding:'12px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <span style={{ background:'#84AAC1', color:'#385262', fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'9999px' }}>{plan.type}</span>
            <span style={{ background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', padding:'2px 6px', borderRadius:'4px' }}>{plan.hmsa_class_label}</span>
            {compCareElected && isPlanCompCareEligible(plan.id) && (
              <span style={{ background:'rgba(27,227,220,0.2)', color:'#84AAC1', fontSize:'10px', padding:'2px 6px', borderRadius:'4px' }}>+ COMPCARE</span>
            )}
          </div>
          {doc && (
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', padding:'3px 8px', borderRadius:'6px', textDecoration:'none' }}>
              <span>📄</span> SBC
            </a>
          )}
        </div>
        <div style={{ color:'#fff', fontWeight:600, fontSize:'14px' }}>{plan.name}</div>
        {plan.referralRequired && (
          <div style={{ color:'#FCD34D', fontSize:'10px', marginTop:'3px' }}>⚠ HMO — Referral required for specialist visits</div>
        )}
        {plan.hmsa_class === '7b' && (
          <div style={{ color:'rgba(255,255,255,0.6)', fontSize:'10px', marginTop:'3px' }}>7(b) Plan — Employer pays at least 50% of dependent coverage</div>
        )}
        {plan.package === 'Full Package' && (
          <div style={{ color:'#84AAC1', fontSize:'10px', marginTop:'3px' }}>✓ Includes dental, vision &amp; group life/AD&amp;D</div>
        )}
      </div>

      {/* Premium table */}
      <div style={{ padding:'12px 16px 0' }}>
        <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6595B2', marginBottom:'8px' }}>Monthly premiums</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Coverage</th>
              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Total</th>
              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>You pay</th>
              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Employer pays</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map(({ label, total, ee }) => {
              const er = Math.max(0, total - ee)
              return (
                <tr key={label} style={{ borderTop:'1px solid #EDF2F6' }}>
                  <td style={{ padding:'7px 0', color:'#555' }}>{label}</td>
                  <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#333' }}>{fmt(total)}</td>
                  <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#6595B2' }}>{fmt(ee)}</td>
                  <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#555' }}>{fmt(er)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {method === 'phca' && (
          <div style={{ fontSize:'10px', color:'#877C73', margin:'6px 0 10px', padding:'6px 10px', background:'#EDF2F6', borderRadius:'6px' }}>
            ℹ Employee contribution calculated using Hawaii PHCA 1.5% method (HRS § 393-15)
          </div>
        )}
        {method !== 'phca' && tiers.every(t => t.ee === 0) && tiers.some(t => t.total > 0) && (
          <div style={{ fontSize:'10px', color:'#92400E', margin:'6px 0 10px', padding:'8px 10px', background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:'6px', display:'flex', gap:'6px' }}>
            <span>⚠</span>
            <span>Employee contribution amounts have not been set yet. Contact your HR department for your actual out-of-pocket cost.</span>
          </div>
        )}
      </div>

      {/* Benefits summary toggle */}
      <button onClick={() => setOpen(o=>!o)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'#EDF2F6', border:'none', borderTop:'1px solid #EDF2F6', cursor:'pointer', fontSize:'12px', color:'#6595B2', fontWeight:600 }}>
        <span>Benefits at a glance</span>
        {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid #EDF2F6' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'12px' }}>
            {[
              ['Deductible', plan.deductible],
              ['OOP max (medical)', plan.oopMedical],
              ['PCP visit', plan.pcp],
              ['Specialist', plan.specialist],
              ['Emergency room', plan.er],
              ['Inpatient hospital', plan.hospital],
              ['Maternity', plan.maternity],
              ['Rx generic', plan.rxGeneric],
              ['Rx preferred', plan.rxPreferred],
              ['Out-of-network', plan.outOfNetwork],
            ].map(([label, val]) => (
              <div key={label} style={{ borderBottom:'1px solid #EDF2F6', paddingBottom:'6px' }}>
                <div style={{ fontSize:'10px', color:'#888', marginBottom:'1px' }}>{label}</div>
                <div style={{ fontWeight:500, color: val==='Not covered (emergency only)'?'#854F0B':'#385262' }}>{val}</div>
              </div>
            ))}
          </div>
          {doc && (
            <div style={{ marginTop:'10px', textAlign:'center' }}>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                style={{ color:'#6595B2', fontSize:'12px', fontWeight:600 }}>
                View full Summary of Benefits and Coverage ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ACA Plan Card ────────────────────────────────────────────
function AcaPlanCard({ plan, doc }) {
  const [glanceOpen, setGlanceOpen] = useState(false)
  if (!plan) return null
  const isHMO = plan.type === 'HMO'
  const color = isHMO ? '#78350F' : '#385262'
  const bg    = isHMO ? '#92400E' : '#6595B2'

  return (
    <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden', marginBottom:'12px' }}>
      <div style={{ background:bg, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ color:'#fff', fontWeight:600, fontSize:'14px' }}>{plan.name}</div>
          <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'11px', marginTop:'2px' }}>
            ACA Small Group · {plan.type} · Full Package incl. Riders
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', fontWeight:700, padding:'3px 8px', borderRadius:'6px' }}>ACA</span>
          {doc && (
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', padding:'3px 8px', borderRadius:'6px', textDecoration:'none' }}>
              📄 SBC
            </a>
          )}
        </div>
      </div>
      {isHMO && (
        <div style={{ background:'#FEF3C7', borderBottom:'0.5px solid #FDE68A', padding:'6px 16px', fontSize:'11px', color:'#92400E', display:'flex', alignItems:'center', gap:'6px' }}>
          ⚠ HMO Plan — Referral required for specialist visits. Out-of-network services not covered (emergency only).
        </div>
      )}
      <div style={{ padding:'10px 16px', fontSize:'12px', color:'#6B7280' }}>
        Age-based premiums — contact your HR department for your specific premium amount.
      </div>
      <button onClick={() => setGlanceOpen(o=>!o)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'#EDF2F6', border:'none', borderTop:'1px solid #EDF2F6', cursor:'pointer', fontSize:'12px', color:'#6595B2', fontWeight:600 }}>
        <span>Benefits at a glance</span>
        {glanceOpen ? '▲' : '▼'}
      </button>
      {glanceOpen && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid #EDF2F6' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'12px' }}>
            {[
              ['Deductible',       plan.deductible],
              ['OOP max (medical)',plan.oopMedical],
              ['OOP max (Rx)',     plan.oopRx],
              ['PCP visit',        plan.pcp],
              ['Specialist',       plan.specialist],
              ['Emergency room',   plan.er],
              ['Inpatient hospital',plan.hospital],
              ['Rx generic',       plan.rxGeneric],
              ['Rx preferred',     plan.rxPreferred],
              ['Out-of-network',   plan.outOfNetwork],
            ].map(([label, val]) => (
              <div key={label} style={{ borderBottom:'1px solid #EDF2F6', paddingBottom:'6px' }}>
                <div style={{ fontSize:'10px', color:'#888', marginBottom:'1px' }}>{label}</div>
                <div style={{ fontWeight:500, color: val && val.includes('Not covered') ? '#854F0B' : '#385262' }}>{val}</div>
              </div>
            ))}
          </div>
          {plan.referralRequired && (
            <div style={{ marginTop:'8px', background:'#FEF3C7', borderRadius:'6px', padding:'6px 10px', fontSize:'11px', color:'#92400E' }}>
              ⚠ Referral required to see a specialist.
            </div>
          )}
          {doc && (
            <div style={{ marginTop:'8px', textAlign:'center' }}>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                style={{ color:'#6595B2', fontSize:'12px', fontWeight:600 }}>
                View full Summary of Benefits and Coverage ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Riders/COMPCARE card ────────────────────────────────────
function AddonCard({ title, sub, rates, election, doc, color='#334155', isRiders=false }) {
  const [open, setOpen] = useState(false)
  if (!election?.elected) return null

  // Use premium_* for totals (medical_* = 0 for Riders after breakdown CSV import)
  const tiers = [
    { label:'Single',  total: parseMoney(rates?.premium_single    || rates?.single),    ee: parseMoney(election?.ee_single),    vision: rates?.vision_single    || 7.32,  dental: rates?.dental_single    || 33.56, life: rates?.life_single    || 4.36 },
    { label:'2-Party', total: parseMoney(rates?.premium_two_party || rates?.two_party), ee: parseMoney(election?.ee_two_party), vision: rates?.vision_two_party || 14.62, dental: rates?.dental_two_party || 73.42, life: rates?.life_two_party || 4.36 },
    { label:'Family',  total: parseMoney(rates?.premium_family    || rates?.family),    ee: parseMoney(election?.ee_family),    vision: rates?.vision_family    || 21.92, dental: rates?.dental_family    || 110.08, life: rates?.life_family   || 4.36 },
  ]

  return (
    <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden', marginBottom:'12px' }}>
      <div style={{ background: color, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ color:'#fff', fontWeight:600, fontSize:'14px' }}>{title}</div>
          <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'11px', marginTop:'2px' }}>{sub}</div>
        </div>
        {doc && (
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', padding:'3px 8px', borderRadius:'6px', textDecoration:'none' }}>
            <span>📄</span> Summary
          </a>
        )}
      </div>
      <div style={{ padding:'12px 16px 0', overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth: isRiders ? '420px' : 'auto' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Coverage</th>
              {isRiders && <>
                <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Vision</th>
                <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Dental</th>
                <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Life/AD&D</th>
              </>}
              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Total</th>
              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>You pay</th>
              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Employer pays</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map(({ label, total, ee, vision, dental, life }) => {
              const er = Math.max(0, total - ee)
              return (
                <tr key={label} style={{ borderTop:'1px solid #EDF2F6' }}>
                  <td style={{ padding:'7px 0', color:'#555' }}>{label}</td>
                  {isRiders && <>
                    <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#888', fontSize:'11px' }}>{fmt(vision)}</td>
                    <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#888', fontSize:'11px' }}>{fmt(dental)}</td>
                    <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#888', fontSize:'11px' }}>{fmt(life)}</td>
                  </>}
                  <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#333', fontWeight:600 }}>{total != null ? fmt(total) : 'N/A'}</td>
                  <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#6595B2' }}>{total != null ? fmt(ee) : 'N/A'}</td>
                  <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#555' }}>{total != null ? fmt(er) : 'N/A'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Benefits at a glance — Riders always visible */}
      {isRiders && (
        <div style={{ padding:'14px 16px', borderTop:'1px solid #EDF2F6' }}>
          <div style={{ fontSize:'10px', fontWeight:700, color:'#877C73', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'10px' }}>Benefits at a glance</div>

          {/* Vision */}
          <div style={{ marginBottom:'12px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#385262', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', paddingBottom:'4px', borderBottom:'2px solid #EDF2F6' }}>
              👁 Vision — HMSA Vision Network
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', fontSize:'11px' }}>
              {[
                ['Routine eye exam',     'Covered once per year',         '#385262'],
                ['Frames',               'Up to $150 per year',           '#334155'],
                ['Lenses (single)',      'Covered once per year',         '#334155'],
                ['Lenses (bifocal)',     'Covered once per year',         '#334155'],
                ['Contact lenses',       'Up to $150 (in lieu of lenses)','#334155'],
                ['Out-of-network',       'Reduced reimbursement',         '#888'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background:'#EDF2F6', borderRadius:'6px', padding:'6px 8px' }}>
                  <div style={{ color:'#888', fontSize:'9px', marginBottom:'2px' }}>{label}</div>
                  <div style={{ fontWeight:600, color, fontSize:'11px' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dental */}
          <div style={{ marginBottom:'12px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#385262', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', paddingBottom:'4px', borderBottom:'2px solid #EDF2F6' }}>
              🦷 Dental — HMSA Dental Network
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', fontSize:'11px' }}>
              {[
                ['Preventive',           '100% covered',                  '#385262'],
                ['Cleanings',            'Twice per year',                '#385262'],
                ['X-rays',               'Bitewings once per year',       '#334155'],
                ['Basic restorative',    '80% after deductible',          '#334155'],
                ['Fillings',             'Amalgam & composite',           '#334155'],
                ['Extractions',          '80% after deductible',          '#334155'],
                ['Major restorative',    '50% after deductible',          '#334155'],
                ['Crowns & bridges',     '50% after deductible',          '#334155'],
                ['Dentures',             '50% after deductible',          '#334155'],
                ['Annual deductible',    '$50 individual',                '#888'],
                ['Annual maximum',       '$1,500 per person',             '#888'],
                ['Orthodontia',          'Not covered',                   '#888'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background:'#EDF2F6', borderRadius:'6px', padding:'6px 8px' }}>
                  <div style={{ color:'#888', fontSize:'9px', marginBottom:'2px' }}>{label}</div>
                  <div style={{ fontWeight:600, color, fontSize:'11px' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Life & AD&D */}
          <div style={{ marginBottom:'10px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#385262', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', paddingBottom:'4px', borderBottom:'2px solid #EDF2F6' }}>
              🛡 Group Life & AD&D
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', fontSize:'11px' }}>
              {[
                ['Life benefit',         'Contact KIAA for amount',       '#334155'],
                ['AD&D benefit',         'Equal to life benefit',         '#334155'],
                ['Covered employees',    'All enrolled employees',        '#334155'],
                ['Dependent coverage',   'Not included',                  '#888'],
                ['Portability',          'May be available at separation','#888'],
                ['Beneficiary',          'Designate via HR',              '#888'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background:'#EDF2F6', borderRadius:'6px', padding:'6px 8px' }}>
                  <div style={{ color:'#888', fontSize:'9px', marginBottom:'2px' }}>{label}</div>
                  <div style={{ fontWeight:600, color, fontSize:'11px' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop:'8px', fontSize:'11px', color:'#475569', background:'#F8FAFC', borderRadius:'6px', padding:'8px 10px', display:'flex', gap:'6px' }}>
            <span>ℹ</span>
            <span>Coverage amounts shown are estimates. Refer to your Summary of Benefits or contact KIAA at (808) 961-5422 for exact limits, waiting periods, and network providers.</span>
          </div>
          {doc && (
            <div style={{ marginTop:'8px', textAlign:'center' }}>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                style={{ color:'#6595B2', fontSize:'12px', fontWeight:600 }}>
                View full Benefit Summary PDF ↗
              </a>
            </div>
          )}
        </div>
      )}

      {/* Summary link for non-Riders cards */}
      {!isRiders && doc && (
        <button onClick={() => setOpen(o=>!o)}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'#EDF2F6', border:'none', borderTop:'1px solid #EDF2F6', cursor:'pointer', fontSize:'12px', color:'#334155', fontWeight:600 }}>
          <span>View benefit summary</span>
          {open ? '▲' : '▼'}
        </button>
      )}
      {!isRiders && open && doc && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid #EDF2F6', textAlign:'center' }}>
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
            style={{ color:'#6595B2', fontSize:'13px', fontWeight:600 }}>
            Open Benefit Summary PDF ↗
          </a>
        </div>
      )}
    </div>
  )
}

// ── Main plan view ────────────────────────────────────────────
function PlanView({ company, onBack }) {
  const { activePlanYear, activePlanStart, activePlanEnd } = usePlanYear()
  const PLAN_YEAR = activePlanYear
  const [rates,     setRates]     = useState({})
  const [elections, setElections] = useState({})
  const [docs,        setDocs]        = useState({})
  const [carrierDocs, setCarrierDocs] = useState([])
  const [spd,         setSpd]         = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [spdOpen,   setSpdOpen]   = useState(false)
  const [tab,       setTab]       = useState('plans') // 'plans' | 'compare'
  const [highlight,    setHighlight]    = useState('')
  const [acaHighlight, setAcaHighlight] = useState('')
  const [kaiserRates,  setKaiserRates]  = useState([])
  const [kaiserElections, setKaiserElections] = useState({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    // Load rates for company's band
    if (company.band) {
      const { data: rateRows } = await supabase
        .from('rate_bands').select('*')
        .eq('plan_year', PLAN_YEAR).eq('band', company.band)
      const r = {}
      ;(rateRows || []).forEach(row => {
        r[row.plan_id] = { single: row.premium_single, two_party: row.premium_two_party, family: row.premium_family }
      })
      // Riders flat rate
      const { data: ridersRow } = await supabase
        .from('rate_bands').select('*')
        .eq('plan_year', PLAN_YEAR).eq('plan_id', 'kiaa_riders').eq('band', 0).maybeSingle()
      // Always set Riders rates — use DB if available, fall back to known flat rates
      const rsingle   = ridersRow?.premium_single    || 45.24
      const rtwo      = ridersRow?.premium_two_party || 92.40
      const rfamily   = ridersRow?.premium_family    || 136.36
      r['kiaa_riders'] = {
        single: rsingle, two_party: rtwo, family: rfamily,
        premium_single: rsingle, premium_two_party: rtwo, premium_family: rfamily,
        vision_single:    ridersRow?.vision_single    || 7.32,
        vision_two_party: ridersRow?.vision_two_party || 14.62,
        vision_family:    ridersRow?.vision_family    || 21.92,
        dental_single:    ridersRow?.dental_single    || 33.56,
        dental_two_party: ridersRow?.dental_two_party || 73.42,
        dental_family:    ridersRow?.dental_family    || 110.08,
        life_single:      ridersRow?.life_single      || 4.36,
        life_two_party:   ridersRow?.life_two_party   || 4.36,
        life_family:      ridersRow?.life_family      || 4.36,
      }
      setRates(r)
    }

    // Load elections
    const { data: elRows } = await supabase
      .from('company_elections').select('*')
      .eq('company_id', company.id).eq('plan_year', PLAN_YEAR)
    const e = {}
    ;(elRows || []).forEach(row => { e[row.plan_id] = row })
    setElections(e)

    // Load SPD from company_documents (company-specific)
    const { data: coDocRows } = await supabase
      .from('company_documents').select('*')
      .eq('company_id', company.id).eq('plan_year', PLAN_YEAR)
    const d = {}
    ;(coDocRows || []).forEach(doc => {
      const key = `${doc.doc_type}__${doc.plan_id || 'null'}`
      d[key] = doc
    })

    // Load SBCs and benefit summaries from plan_documents (global library)
    const { data: planDocRows } = await supabase
      .from('plan_documents').select('*')
      .eq('plan_year', PLAN_YEAR)
    ;(planDocRows || []).forEach(doc => {
      const key = `${doc.doc_type}__${doc.plan_id}`
      // Only use global doc if no company-specific override
      if (!d[key]) d[key] = doc
    })

    setDocs(d)
    setSpd(d['spd__null'] || null)

    // Load carrier documents (Group Life form, provider directories, etc.)
    const { data: cDocRows } = await supabase
      .from('carrier_documents').select('*')
      .order('doc_type').order('uploaded_at')
    setCarrierDocs(cDocRows || [])

    // Load Kaiser rates
    const { data: kr } = await supabase
      .from('kaiser_rates').select('*')
      .eq('company_id', company.id).eq('plan_year', PLAN_YEAR)
      .order('kaiser_plan_no').order('package_type')
    setKaiserRates(kr || [])

    // Load Kaiser elections
    const { data: keRows } = await supabase
      .from('company_elections').select('*')
      .eq('company_id', company.id).eq('plan_year', PLAN_YEAR)
      .eq('carrier', 'kaiser')
    const ke = {}
    ;(keRows || []).forEach(row => {
      const key = `${row.kaiser_plan_no}_${row.kaiser_package_type}`
      ke[key] = row
    })
    setKaiserElections(ke)

    setLoading(false)
  }

  // Use company.plans (set when OE submitted) as primary source
  // Fall back to elections table elected flag
  const electedPlanIds = company.plans?.length
    ? company.plans
    : PLANS.filter(p => elections[p.id]?.elected).map(p => p.id)
  const electedPlans = PLANS.filter(p => electedPlanIds.includes(p.id) && p.hmsa_class !== 'riders')
  const plans7a      = electedPlans.filter(p => p.hmsa_class === '7a')
  const plans7b      = electedPlans.filter(p => p.hmsa_class === '7b')
  // For ACA companies, riders/compcare come from elections table only (no company.plans array)
  const isAcaCompany  = company?.group_type === 'aca_small_group'
  const ridersElected = isAcaCompany
    ? !!elections['kiaa_riders']?.elected
    : (electedPlanIds.includes('kiaa_riders') || !!elections['kiaa_riders']?.elected)
  const compCareElected = isAcaCompany
    ? !!elections['compcare']?.elected
    : !!company.compcare_elected

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#F4F6FA', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <div style={{ color:'#6595B2', fontSize:'14px' }}>Loading your plans…</div>
    </div>
  )

  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", minHeight:'100vh', backgroundColor:'#EDF2F6', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='600' viewBox='0 0 900 600'%3E%3Cpath d='M0 300 C150 200 300 400 450 300 C600 200 750 400 900 300 L900 600 L0 600 Z' fill='%23385262' fill-opacity='0.04'/%3E%3Cpath d='M0 350 C120 260 280 450 450 350 C620 250 780 440 900 350 L900 600 L0 600 Z' fill='%236595B2' fill-opacity='0.035'/%3E%3Cpath d='M0 420 C180 330 320 500 500 410 C660 330 780 480 900 400 L900 600 L0 600 Z' fill='%23385262' fill-opacity='0.03'/%3E%3Cpath d='M0 80 C200 160 350 0 550 100 C700 180 800 60 900 120 L900 0 L0 0 Z' fill='%236595B2' fill-opacity='0.03'/%3E%3Cpath d='M0 40 C150 120 300 -20 500 60 C680 140 820 20 900 80 L900 0 L0 0 Z' fill='%23385262' fill-opacity='0.025'/%3E%3C/svg%3E")`, backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat' }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(90deg,#385262,#263944)', color:'#fff', padding:'13px 20px', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ maxWidth:'800px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={onBack} style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', borderRadius:'6px', padding:'5px 10px', fontSize:'12px', cursor:'pointer' }}>← Back</button>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              {company.logo_url && (
                <img src={company.logo_url} alt={company.name}
                  style={{ height:'36px', maxWidth:'120px', objectFit:'contain', filter:'brightness(0) invert(1)', flexShrink:0 }}/>
              )}
              <div>
                <div style={{ fontWeight:700, fontSize:'15px', color:'#fff' }}>{company.name}</div>
                <div style={{ fontSize:'11px', opacity:0.7, marginTop:'1px' }}>Plan year: Oct 1, 2025 – Sep 30, 2026</div>
              </div>
            </div>
          </div>
          {spd && (
            <a href={spd.file_url} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:'6px', background:'#84AAC1', color:'#385262', fontSize:'12px', fontWeight:700, padding:'6px 14px', borderRadius:'6px', textDecoration:'none' }}>
              📋 Download SPD
            </a>
          )}
        </div>
      </div>

      <div style={{ maxWidth:'800px', margin:'0 auto', padding:'16px' }}>

        {/* Company logo banner */}
        <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
          {company.logo_url && (
            <img src={company.logo_url} alt={company.name}
              style={{ maxHeight:'150px', maxWidth:'300px', objectFit:'contain', display:'block', margin:'0 auto 12px' }}/>
          )}
          <div style={{ fontWeight:700, fontSize:'18px', color:'#385262' }}>{company.name}</div>
          <div style={{ fontSize:'12px', color:'#877C73', marginTop:'2px' }}>Employee Benefits · Plan year 2025–2026</div>
        </div>

        {/* Tab bar — always visible */}
        {!loading && (
          <div style={{ display:'flex', gap:'0', marginBottom:'16px', background:'#fff', border:'1px solid #BED8E1', borderRadius:'10px', overflow:'hidden' }}>
            {[
              {id:'plans',   label:'📋 My Plans'},
              ...(electedPlans.length > 1 || company?.group_type === 'aca_small_group' ? [{id:'compare', label:'⚖️ Compare'}] : []),
              {id:'packet',  label:'📦 Enrollment Packet'},
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex:1, padding:'11px 16px', fontSize:'13px',
                  fontWeight: tab===t.id ? 700 : 400,
                  color: tab===t.id ? '#fff' : '#555',
                  background: tab===t.id ? '#6595B2' : '#fff',
                  border:'none', cursor:'pointer', transition:'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ textAlign:'center', padding:'40px', color:'#877C73', fontSize:'14px' }}>
            Loading your plans…
          </div>
        )}

        {/* ── ORIENTATION BANNER ── */}
        {!loading && (
          <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <span style={{ fontSize:'22px', flexShrink:0 }}>👋</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'14px', color:'#385262', marginBottom:'6px' }}>
                  Welcome to your employee benefits portal
                </div>
                <p style={{ fontSize:'13px', color:'#374151', lineHeight:1.7, margin:'0 0 12px' }}>
                  This page shows the health benefit plans your employer has selected for you.
                  Review your options, understand what you pay, and download your plan documents — all in one place.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'8px' }}>
                  {[
                    { icon:'📋', tab:'My Plans', desc:'View your enrolled plans, monthly premiums, and what you pay vs. your employer.' },
                    { icon:'⚖️', tab:'Compare Plans', desc:'See all your plans side by side to compare benefits, copays, and deductibles.' },
                    { icon:'📦', tab:'Enrollment Packet', desc:'Download your SBCs, benefit summaries, and enrollment forms.' },
                  ].map(({ icon, tab, desc }) => (
                    <div key={tab} style={{ background:'#F4F6FA', borderRadius:'8px', padding:'10px 12px' }}>
                      <div style={{ fontWeight:600, fontSize:'12px', color:'#6595B2', marginBottom:'3px' }}>{icon} {tab}</div>
                      <div style={{ fontSize:'11px', color:'#4B5563', lineHeight:1.5 }}>{desc}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:'12px', color:'#6B7280', lineHeight:1.6, margin:'12px 0 0' }}>
                  📞 Questions about your benefits? Contact your HR representative using the contact card on the <strong>My Plans</strong> tab.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ENROLLMENT INSTRUCTIONS ── */}
        {!loading && (company.oe_instructions || company.oe_deadline) && (
          <div style={{ background:'#FFF8E7', border:'1px solid #FDE68A', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <span style={{ fontSize:'20px', flexShrink:0 }}>📢</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'13px', color:'#78350F', marginBottom:'6px' }}>
                  Open Enrollment Information
                </div>
                {company.oe_deadline && (
                  <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'6px', padding:'4px 10px', marginBottom:'8px', fontSize:'12px', fontWeight:700, color:'#92400E' }}>
                    📅 Enrollment deadline: {new Date(company.oe_deadline + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
                  </div>
                )}
                {company.oe_instructions && (
                  <p style={{ fontSize:'13px', color:'#78350F', lineHeight:1.6, whiteSpace:'pre-wrap', margin:0 }}>
                    {company.oe_instructions}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BENEFITS CONTACT ── */}
        {!loading && company.benefits_contact_name && (
          <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', padding:'14px 16px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
            <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'#6595B2', display:'flex', alignItems:'center', justifyContent:'center', color:'#84AAC1', fontWeight:700, fontSize:'16px', flexShrink:0 }}>
              {company.benefits_contact_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:'160px' }}>
              <div style={{ fontSize:'10px', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'2px' }}>Questions? Contact your benefits representative</div>
              <div style={{ fontWeight:700, fontSize:'14px', color:'#385262' }}>{company.benefits_contact_name}</div>
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {company.benefits_contact_email && (
                <a href={`mailto:${company.benefits_contact_email}`}
                  style={{ display:'flex', alignItems:'center', gap:'5px', background:'#F4F6FA', border:'1px solid #BED8E1', borderRadius:'8px', padding:'6px 12px', fontSize:'12px', color:'#6595B2', textDecoration:'none', fontWeight:600 }}>
                  ✉️ {company.benefits_contact_email}
                </a>
              )}
              {company.benefits_contact_phone && (
                <a href={`tel:${company.benefits_contact_phone}`}
                  style={{ display:'flex', alignItems:'center', gap:'5px', background:'#F4F6FA', border:'1px solid #BED8E1', borderRadius:'8px', padding:'6px 12px', fontSize:'12px', color:'#6595B2', textDecoration:'none', fontWeight:600 }}>
                  📞 {formatPhone(company.benefits_contact_phone)}
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── MY PLANS TAB ── */}
        {!loading && tab === 'plans' && (
          <div>
            {/* ACA plan cards — shown for ACA companies */}
            {company?.group_type === 'aca_small_group' && Object.entries(elections||{})
              .filter(([planId, el]) => el?.elected && ACA_PLAN_BENEFITS[planId])
              .map(([planId]) => (
                <AcaPlanCard key={planId} plan={ACA_PLAN_BENEFITS[planId]} doc={docs[`sbc__${planId}`]} />
              ))
            }
            {/* SPD inline viewer */}
            {spd && (
              <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden', marginBottom:'16px' }}>
                <button onClick={() => setSpdOpen(o=>!o)}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'none', border:'none', cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontSize:'18px' }}>📋</span>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontWeight:700, fontSize:'14px', color:'#385262' }}>Summary Plan Description (SPD)</div>
                      <div style={{ fontSize:'11px', color:'#877C73', marginTop:'1px' }}>Your complete plan document</div>
                    </div>
                  </div>
                  <span style={{ color:'#6595B2', fontSize:'12px', fontWeight:600 }}>{spdOpen ? '▲ Hide' : '▼ View'}</span>
                </button>
                {spdOpen && (
                  <div style={{ borderTop:'1px solid #EDF2F6' }}>
                    <iframe src={spd.file_url} style={{ width:'100%', height:'600px', border:'none' }} title="SPD"/>
                  </div>
                )}
              </div>
            )}

            {electedPlans.length === 0 && !ridersElected && (
              <div style={{ textAlign:'center', padding:'40px', color:'#877C73' }}>
                <div style={{ fontSize:'32px', marginBottom:'12px' }}>📋</div>
                <div style={{ fontWeight:600, fontSize:'16px', color:'#385262', marginBottom:'8px' }}>Plans not yet available</div>
                <p style={{ fontSize:'13px' }}>Your employer hasn't finalized their plan selections yet.</p>
              </div>
            )}

            {plans7a.length > 0 && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'8px 0', fontSize:'12px' }}>
                  <span style={{ background:'#6595B2', color:'#84AAC1', fontWeight:700, fontSize:'10px', padding:'3px 10px', borderRadius:'4px' }}>7(a) Plans</span>
                  <span style={{ color:'#877C73' }}>Equal to or better than the prevalent plan</span>
                </div>
                {plans7a.map(plan => (
                  <PlanCard key={plan.id} plan={plan} election={elections[plan.id]} rate={rates[plan.id]} compCareElected={compCareElected} doc={docs[`sbc__${plan.id}`]} guideDoc={docs[`guide__${guideIdForPlan(plan.id)}`]}/>
                ))}
              </>
            )}

            {plans7b.length > 0 && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'16px 0 8px', fontSize:'12px' }}>
                  <span style={{ background:'#334155', color:'#fff', fontWeight:700, fontSize:'10px', padding:'3px 10px', borderRadius:'4px' }}>7(b) Plans</span>
                  <span style={{ color:'#877C73' }}>Employer must pay at least 50% of dependent coverage</span>
                </div>
                {plans7b.map(plan => (
                  <PlanCard key={plan.id} plan={plan} election={elections[plan.id]} rate={rates[plan.id]} compCareElected={compCareElected} doc={docs[`sbc__${plan.id}`]} guideDoc={docs[`guide__${guideIdForPlan(plan.id)}`]}/>
                ))}
              </>
            )}

            {/* Kaiser Permanente Plans */}
            {groupKaiserRates(kaiserRates).filter(g => kaiserElections[`${g.kaiser_plan_no}_${g.package_type}`]?.elected).length > 0 && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'16px 0 8px', fontSize:'12px' }}>
                  <span style={{ background:'#385262', color:'#84aac1', fontWeight:700, fontSize:'10px', padding:'3px 10px', borderRadius:'4px' }}>Kaiser Permanente</span>
                  <span style={{ color:'#877C73' }}>HMO — Referral required for specialist visits</span>
                </div>
                {groupKaiserRates(kaiserRates).map(group => {
                  const key      = `${group.kaiser_plan_no}_${group.package_type}`
                  const election = kaiserElections[key]
                  if (!election?.elected) return null
                  const isFull   = group.package_type === 'full'
                  const pkgLabel = isFull ? 'Full Package' : 'Med/Rx Package'
                  const method   = election.contrib_method || 'fixed'
                  const tierRows = [
                    { tier: 'Single',  total: parseMoney(group.premium_single) },
                    { tier: '2-Party', total: parseMoney(group.premium_two_party) },
                    { tier: 'Family',  total: parseMoney(group.premium_family) },
                  ].map(({ tier, total }) => {
                    const _total = total
                    let ee
                    if (method === 'phca' && election.gross_wage) {
                      const pct15 = parseMoney(election.gross_wage) * 0.015
                      const cap50 = total * 0.50
                      ee = Math.min(pct15, cap50)
                    } else {
                      const eeKey = tier === 'Single' ? 'ee_single' : tier === '2-Party' ? 'ee_two_party' : 'ee_family'
                      ee = parseMoney(election[eeKey])
                    }
                    return { label: tier, total, ee, er: Math.max(0, total - ee) }
                  })
                  // SBC doc
                  const sbcKey = `kaiser_sbc__kaiser_${group.kaiser_plan_no}`
                  const sbc    = docs[sbcKey]

                  return (
                    <div key={key} style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden', marginBottom:'12px' }}>
                      <div style={{ background:'#385262', padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                            <span style={{ background:'#FCD34D', color:'#92400E', fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'9999px' }}>HMO</span>
                            <span style={{ background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', padding:'2px 6px', borderRadius:'4px' }}>Kaiser</span>
                          </div>
                          {sbc && (
                            <a href={sbc.file_url} target="_blank" rel="noopener noreferrer"
                              style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', padding:'3px 8px', borderRadius:'6px', textDecoration:'none' }}>
                              📄 SBC
                            </a>
                          )}
                        </div>
                        <div style={{ color:'#fff', fontWeight:600, fontSize:'14px' }}>Kaiser Permanente {group.kaiser_plan_no} — {pkgLabel}</div>
                        <div style={{ color:'#FCD34D', fontSize:'10px', marginTop:'3px' }}>⚠ HMO — Referral required for specialist visits</div>
                        {isFull && <div style={{ color:'#84aac1', fontSize:'10px', marginTop:'2px' }}>✓ Includes HMSA Dental, Vision &amp; Group Life/AD&amp;D</div>}
                      </div>
                      <div style={{ padding:'12px 16px 0' }}>
                        <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6595B2', marginBottom:'8px' }}>Monthly premiums</div>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign:'left', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Coverage</th>
                              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Total</th>
                              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>You pay</th>
                              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Employer pays</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tierRows.map(({ label, total, ee, er }) => (
                              <tr key={label} style={{ borderTop:'1px solid #EDF2F6' }}>
                                <td style={{ padding:'7px 0', color:'#555' }}>{label}</td>
                                <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#333' }}>{fmt(total)}</td>
                                <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#6595B2' }}>{fmt(ee)}</td>
                                <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#555' }}>{fmt(er)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {method === 'phca' && (
                          <div style={{ fontSize:'10px', color:'#877C73', margin:'6px 0 10px', padding:'6px 10px', background:'#F4F6FA', borderRadius:'6px' }}>
                            ℹ Employee contribution calculated using Hawaii PHCA 1.5% method (HRS § 393-15)
                          </div>
                        )}
                        <div style={{ height:'12px' }}/>
                      </div>
                    </div>
                  )
                })}
              </>
            )}



            {ridersElected && RIDERS_PLAN && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'16px 0 8px', fontSize:'12px' }}>
                  <span style={{ background:'#475569', color:'#fff', fontWeight:700, fontSize:'10px', padding:'3px 10px', borderRadius:'4px' }}>Riders</span>
                  <span style={{ color:'#877C73' }}>
                    {isAcaCompany
                      ? 'KIAA Riders Package — Dental, Vision & Group Life/AD&D'
                      : 'Available to employees with outside medical coverage'}
                  </span>
                </div>
                <AddonCard
                  title={RIDERS_PLAN.name}
                  sub={isAcaCompany
                    ? 'Dental · Vision · Group Life/AD&D — included in all ACA Full Package plans'
                    : 'Standalone — for employees with outside medical coverage'}
                  rates={rates['kiaa_riders']} election={elections['kiaa_riders']}
                  doc={docs['benefit_summary__kiaa_riders']} color="#475569" isRiders={true}/>
              </>
            )}

            {compCareElected && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'16px 0 8px', fontSize:'12px' }}>
                  <span style={{ background:'#6595B2', color:'#84AAC1', fontWeight:700, fontSize:'10px', padding:'3px 10px', borderRadius:'4px' }}>Add-on</span>
                  <span style={{ color:'#877C73' }}>Included in all full package plan premiums</span>
                </div>
                <div style={{ background:'#F4F6FA', border:'1px solid #BED8E1', borderRadius:'12px', padding:'14px 16px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'14px', color:'#385262' }}>{COMPCARE.name}</div>
                    <div style={{ fontSize:'11px', color:'#877C73', marginTop:'2px' }}>{COMPCARE.note}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, marginLeft:'16px' }}>
                    <div style={{ fontSize:'10px', color:'#888' }}>Monthly add-on</div>
                    <div style={{ fontFamily:'monospace', fontWeight:700, color:'#6595B2', fontSize:'16px' }}>{fmt(COMPCARE.tiers.single)}</div>
                    <div style={{ fontSize:'10px', color:'#888' }}>per employee / all tiers</div>
                  </div>
                  {docs['benefit_summary__compcare'] && (
                    <a href={docs['benefit_summary__compcare'].file_url} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:'4px', background:'#6595B2', color:'#fff', fontSize:'11px', fontWeight:600, padding:'5px 10px', borderRadius:'6px', textDecoration:'none', marginLeft:'12px' }}>
                      📄 Summary
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── COMPARE PLANS TAB ── */}
        {/* ACA Compare Plans */}
        {!loading && tab === 'compare' && company?.group_type === 'aca_small_group' && (() => {
          const acaAvailable = Object.keys(ACA_PLAN_BENEFITS)
            .filter(id => elections[id]?.elected)
            .map(id => ACA_PLAN_BENEFITS[id])
          if (!acaAvailable.length) return (
            <div style={{ padding:'20px', textAlign:'center', color:'#888', fontSize:'13px', fontStyle:'italic' }}>
              No plans elected yet. Contact KIAA to set up your plans.
            </div>
          )
          // With only one plan elected, fall back to plan cards (nothing to compare)
          if (acaAvailable.length === 1) return (
            <div>
              <div style={{ fontWeight:700, fontSize:'13px', color:'#385262', marginBottom:'12px' }}>
                ACA Small Group — Only one plan enrolled
              </div>
              <AcaPlanCard plan={acaAvailable[0]} doc={docs[`sbc__${acaAvailable[0].id}`]} />
            </div>
          )
          // Side-by-side comparison table
          const ACA_ROWS = [
            { sec: 'Plan overview' },
            { key:'type',          label:'Plan type' },
            { key:'deductible',    label:'Deductible (ind / fam)' },
            { sec: 'Out-of-pocket maximums' },
            { key:'oopMedical',    label:'OOP max — medical' },
            { key:'oopRx',         label:'OOP max — Rx' },
            { sec: 'Office visits' },
            { key:'pcp',           label:'Primary care (PCP)' },
            { key:'specialist',    label:'Specialist' },
            { key:'referralRequired', label:'Referral required', format: v => v
                ? <span style={{color:'#92400E',background:'#FEF3C7',padding:'1px 7px',borderRadius:'9999px',fontSize:'10px',fontWeight:700}}>Yes</span>
                : <span style={{color:'#263944',background:'#EDF2F6',padding:'1px 7px',borderRadius:'9999px',fontSize:'10px',fontWeight:700}}>No</span> },
            { sec: 'Emergency & hospital' },
            { key:'er',            label:'Emergency room' },
            { key:'hospital',      label:'Inpatient hospital' },
            { key:'maternity',     label:'Maternity' },
            { sec: 'Prescription drugs' },
            { key:'rxGeneric',     label:'Generic (retail)' },
            { key:'rxPreferred',   label:'Preferred brand' },
            { sec: 'Network' },
            { key:'outOfNetwork',  label:'Out-of-network coverage' },
          ]
          return (
            <div>
              {/* Highlight picker */}
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
                <span style={{ fontSize:'11px', color:'#888', fontWeight:600 }}>Highlight a plan:</span>
                {acaAvailable.map(p => (
                  <button key={p.id} onClick={() => setAcaHighlight(h => h===p.id?'':p.id)}
                    style={{ padding:'4px 12px', borderRadius:'9999px', fontSize:'11px', cursor:'pointer',
                      border:`1.5px solid ${acaHighlight===p.id?'#6595B2':'#BED8E1'}`,
                      background: acaHighlight===p.id?'#6595B2':'#fff',
                      color: acaHighlight===p.id?'#fff':'#555',
                      fontWeight: acaHighlight===p.id?700:400 }}>
                    {p.shortName}
                  </button>
                ))}
              </div>
              <div style={{ overflowX:'auto' }}>
                <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:`${180+acaAvailable.length*160}px` }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign:'left', padding:'10px 12px', background:'#F4F6FA', color:'#6595B2', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', position:'sticky', left:0, minWidth:'160px' }}>Feature</th>
                        {acaAvailable.map(p => {
                          const isHL = p.id===acaHighlight
                          const isHMO = p.type === 'HMO'
                          return (
                            <th key={p.id} style={{ padding:'10px 10px', textAlign:'center', fontSize:'11px', fontWeight:600,
                              background: isHL?'#6595B2':'#F4F6FA', color: isHL?'#fff':'#385262', borderLeft:'1px solid #BED8E1' }}>
                              <div>{p.shortName}</div>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', marginTop:'3px' }}>
                                <span style={{ fontSize:'9px', fontWeight:700, padding:'1px 5px', borderRadius:'3px',
                                  background: isHMO?(isHL?'rgba(252,211,77,0.3)':'#FEF3C7'):(isHL?'rgba(27,227,220,0.2)':'#BED8E1'),
                                  color: isHMO?(isHL?'#FCD34D':'#92400E'):(isHL?'#84AAC1':'#6595B2') }}>
                                  {p.type}
                                </span>
                                {docs[`sbc__${p.id}`] && (
                                  <a href={docs[`sbc__${p.id}`].file_url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize:'9px', color: isHL?'#84AAC1':'#6595B2', textDecoration:'none',
                                      background: isHL?'rgba(255,255,255,0.15)':'#BED8E1', padding:'1px 5px', borderRadius:'3px' }}>
                                    📄 SBC
                                  </a>
                                )}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {ACA_ROWS.map((row, i) => {
                        if (row.sec) return (
                          <tr key={i}>
                            <td colSpan={acaAvailable.length+1}
                              style={{ padding:'6px 12px', background:'#385262', color:'#fff', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                              {row.sec}
                            </td>
                          </tr>
                        )
                        return (
                          <tr key={row.key} style={{ borderTop:'1px solid #EDF2F6' }}>
                            <td style={{ padding:'8px 12px', fontSize:'11px', color:'#555', fontWeight:500, position:'sticky', left:0, background:'#EDF2F6' }}>
                              {row.label}
                            </td>
                            {acaAvailable.map(p => {
                              const isHL = p.id===acaHighlight
                              const val = p[row.key]
                              return (
                                <td key={p.id} style={{ padding:'8px 10px', textAlign:'center', fontSize:'11px',
                                  background: isHL?'#F4F6FA':'#fff', color: isHL?'#385262':'#444',
                                  fontWeight: isHL?600:400, borderLeft:'1px solid #EDF2F6' }}>
                                  {row.format ? row.format(val) : (val ?? '—')}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                      {/* All ACA plans include Riders */}
                      <tr style={{ borderTop:'1px solid #EDF2F6', background:'#F4F6FA' }}>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:'#555', fontWeight:500, position:'sticky', left:0, background:'#F4F6FA' }}>
                          Coverage riders
                        </td>
                        {acaAvailable.map(p => (
                          <td key={p.id} style={{ padding:'8px 10px', textAlign:'center', fontSize:'11px', color:'#6595B2', fontWeight:600, borderLeft:'1px solid #EDF2F6' }}>
                            ✓ Dental · Vision · Life/AD&D
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ marginTop:'10px', fontSize:'11px', color:'#888', fontStyle:'italic' }}>
                ℹ All ACA Small Group plans are Full Package — Dental, Vision, and Group Life/AD&D Riders are included in every plan.
                Refer to your SBC for complete benefit details.
              </div>
            </div>
          )
        })()}

        {!loading && tab === 'compare' && electedPlans.length > 1 && (() => {
          const allComparePlans = electedPlans

          const ROWS = [
            { sec: 'Cost sharing' },
            { key:'deductible',   label:'Deductible (ind / fam)' },
            { key:'oopMedical',   label:'OOP max — medical' },
            { key:'oopRx',        label:'OOP max — Rx' },
            { key:'outOfNetwork', label:'Out-of-network' },
            { sec: 'Office visits' },
            { key:'pcp',          label:'Primary care' },
            { key:'specialist',   label:'Specialist' },
            { sec: 'Emergency & hospital' },
            { key:'er',           label:'Emergency room' },
            { key:'hospital',     label:'Inpatient hospital' },
            { key:'maternity',    label:'Maternity' },
            { sec: 'Prescription drugs' },
            { key:'rxGeneric',    label:'Generic (retail)' },
            { key:'rxPreferred',  label:'Preferred brand' },
            { sec: 'Included coverage' },
            { key:'riders',       label:'Coverage includes', format: v => Array.isArray(v) ? v.join(', ') : v },
          ]


          return (
            <div style={{ overflowX:'auto' }}>
              {/* Highlight picker */}
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
                <span style={{ fontSize:'11px', color:'#888', fontWeight:600 }}>Highlight a plan:</span>
                {allComparePlans.map(p => (
                  <button key={p.id} onClick={() => setHighlight(h => h===p.id?'':p.id)}
                    style={{ padding:'4px 12px', borderRadius:'9999px', fontSize:'11px', cursor:'pointer',
                      border:`1.5px solid ${highlight===p.id?'#6595B2':'#BED8E1'}`,
                      background: highlight===p.id?'#6595B2':'#fff',
                      color: highlight===p.id?'#fff':'#555',
                      fontWeight: highlight===p.id?700:400 }}>
                    {p.shortName}
                  </button>
                ))}
              </div>

              <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:`${180+allComparePlans.length*140}px` }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:'left', padding:'10px 12px', background:'#F4F6FA', color:'#6595B2', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', position:'sticky', left:0, minWidth:'160px' }}>Feature</th>
                      {allComparePlans.map(p => {
                        const isHL = p.id===highlight
                        const typeBg = p.type==='HMO'
                          ? (isHL?'rgba(252,211,77,0.3)':'#FEF3C7')
                          : p.type==='Add-on'
                          ? (isHL?'rgba(27,227,220,0.2)':'#BED8E1')
                          : (isHL?'rgba(27,227,220,0.2)':'#BED8E1')
                        const typeColor = p.type==='HMO'
                          ? (isHL?'#FCD34D':'#92400E')
                          : (isHL?'#84AAC1':'#6595B2')
                        const colBg = isHL?'#6595B2':'#F4F6FA'
                        const colColor = isHL?'#fff':'#385262'
                        return (
                          <th key={p.id} style={{ padding:'10px 10px', textAlign:'center', fontSize:'11px', fontWeight:600,
                            background: colBg, color: colColor, borderLeft:'1px solid #BED8E1' }}>
                            <div>{p.shortName}</div>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', marginTop:'3px' }}>
                              <span style={{ fontSize:'9px', fontWeight:700, padding:'1px 5px', borderRadius:'3px', background:typeBg, color:typeColor }}>
                                {p.type}
                              </span>
                              <span style={{ fontSize:'9px', opacity:0.7, fontWeight:400 }}>{p.hmsa_class_label}</span>
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, i) => {
                      if (row.sec) return (
                        <tr key={i}>
                          <td colSpan={allComparePlans.length+1} style={{ background:'#6595B2', color:'#fff', padding:'5px 12px', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                            {row.sec}
                          </td>
                        </tr>
                      )
                      return (
                        <tr key={i} style={{ borderBottom:'1px solid #EDF2F6' }}>
                          <td style={{ padding:'8px 12px', color:'#555', background:'#FAFEFE', fontSize:'11px', position:'sticky', left:0 }}>{row.label}</td>
                          {allComparePlans.map(p => {
                            const rawVal = p[row.key]
                            const val = row.format ? row.format(rawVal) : rawVal
                            const isHL = p.id===highlight
                            const isNA = val==='N/A'
                            const isFree = !isNA&&(val==='$0'||val==='No charge'||val==='Same as in-network'||(row.key==='deductible'&&(p.deductible==='$0'||p.deductible?.startsWith('$0 '))))
                            const isWarn = !isNA&&row.key==='outOfNetwork'&&val==='Not covered (emergency only)'
                            return (
                              <td key={p.id} style={{ padding:'8px 10px', textAlign:'center', fontSize:'11px',
                                background: isHL?'#BED8E1':'transparent',
                                fontWeight: isHL?600:400,
                                color: isNA?'#ccc':isFree?'#496B80':isWarn?'#854F0B':'#333',
                                borderLeft:'1px solid #EDF2F6',
                                fontStyle: isNA?'italic':'normal' }}>
                                {val}
                                {p.referralRequired&&row.key==='specialist'&&(
                                  <div style={{ fontSize:'9px', color:'#854F0B', marginTop:'2px' }}>⚠ Referral req.</div>
                                )}

                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    {/* SBC / Summary document row */}
                    <tr style={{ borderTop:'2px solid #BED8E1', background:'#F4F6FA' }}>
                      <td style={{ padding:'8px 12px', color:'#6595B2', fontSize:'11px', fontWeight:700, position:'sticky', left:0, background:'#F4F6FA' }}>📄 Document</td>
                      {allComparePlans.map(p => {
                        const doc = docs[`sbc__${p.id}`]
                        const docLabel = 'SBC'
                        return (
                          <td key={p.id} style={{ padding:'8px 10px', textAlign:'center', borderLeft:'1px solid #EDF2F6' }}>
                            {doc ? (
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                style={{ display:'inline-flex', alignItems:'center', gap:'3px', background:'#6595B2', color:'#fff', fontSize:'10px', fontWeight:700, padding:'4px 8px', borderRadius:'5px', textDecoration:'none' }}>
                                📄 {docLabel}
                              </a>
                            ) : (
                              <span style={{ fontSize:'10px', color:'#bbb' }}>—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:'10px', fontSize:'10px', color:'#888', fontStyle:'italic' }}>
                Click any SBC button for complete coverage details.
              </div>

              {/* Riders at-a-glance */}
              {/* Kaiser Permanente Plans */}
            {groupKaiserRates(kaiserRates).filter(g => kaiserElections[`${g.kaiser_plan_no}_${g.package_type}`]?.elected).length > 0 && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'16px 0 8px', fontSize:'12px' }}>
                  <span style={{ background:'#385262', color:'#84aac1', fontWeight:700, fontSize:'10px', padding:'3px 10px', borderRadius:'4px' }}>Kaiser Permanente</span>
                  <span style={{ color:'#877C73' }}>HMO — Referral required for specialist visits</span>
                </div>
                {groupKaiserRates(kaiserRates).map(group => {
                  const key      = `${group.kaiser_plan_no}_${group.package_type}`
                  const election = kaiserElections[key]
                  if (!election?.elected) return null
                  const isFull   = group.package_type === 'full'
                  const pkgLabel = isFull ? 'Full Package' : 'Med/Rx Package'
                  const method   = election.contrib_method || 'fixed'
                  const tierRows = [
                    { tier: 'Single',  total: parseMoney(group.premium_single) },
                    { tier: '2-Party', total: parseMoney(group.premium_two_party) },
                    { tier: 'Family',  total: parseMoney(group.premium_family) },
                  ].map(({ tier, total }) => {
                    const _total = total
                    let ee
                    if (method === 'phca' && election.gross_wage) {
                      const pct15 = parseMoney(election.gross_wage) * 0.015
                      const cap50 = total * 0.50
                      ee = Math.min(pct15, cap50)
                    } else {
                      const eeKey = tier === 'Single' ? 'ee_single' : tier === '2-Party' ? 'ee_two_party' : 'ee_family'
                      ee = parseMoney(election[eeKey])
                    }
                    return { label: tier, total, ee, er: Math.max(0, total - ee) }
                  })
                  // SBC doc
                  const sbcKey = `kaiser_sbc__kaiser_${group.kaiser_plan_no}`
                  const sbc    = docs[sbcKey]

                  return (
                    <div key={key} style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden', marginBottom:'12px' }}>
                      <div style={{ background:'#385262', padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                            <span style={{ background:'#FCD34D', color:'#92400E', fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'9999px' }}>HMO</span>
                            <span style={{ background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', padding:'2px 6px', borderRadius:'4px' }}>Kaiser</span>
                          </div>
                          {sbc && (
                            <a href={sbc.file_url} target="_blank" rel="noopener noreferrer"
                              style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'10px', padding:'3px 8px', borderRadius:'6px', textDecoration:'none' }}>
                              📄 SBC
                            </a>
                          )}
                        </div>
                        <div style={{ color:'#fff', fontWeight:600, fontSize:'14px' }}>Kaiser Permanente {group.kaiser_plan_no} — {pkgLabel}</div>
                        <div style={{ color:'#FCD34D', fontSize:'10px', marginTop:'3px' }}>⚠ HMO — Referral required for specialist visits</div>
                        {isFull && <div style={{ color:'#84aac1', fontSize:'10px', marginTop:'2px' }}>✓ Includes HMSA Dental, Vision &amp; Group Life/AD&amp;D</div>}
                      </div>
                      <div style={{ padding:'12px 16px 0' }}>
                        <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6595B2', marginBottom:'8px' }}>Monthly premiums</div>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign:'left', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Coverage</th>
                              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Total</th>
                              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>You pay</th>
                              <th style={{ textAlign:'right', padding:'4px 0', color:'#888', fontWeight:600, fontSize:'10px' }}>Employer pays</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tierRows.map(({ label, total, ee, er }) => (
                              <tr key={label} style={{ borderTop:'1px solid #EDF2F6' }}>
                                <td style={{ padding:'7px 0', color:'#555' }}>{label}</td>
                                <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#333' }}>{fmt(total)}</td>
                                <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#6595B2' }}>{fmt(ee)}</td>
                                <td style={{ padding:'7px 0', textAlign:'right', fontFamily:'monospace', color:'#555' }}>{fmt(er)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {method === 'phca' && (
                          <div style={{ fontSize:'10px', color:'#877C73', margin:'6px 0 10px', padding:'6px 10px', background:'#F4F6FA', borderRadius:'6px' }}>
                            ℹ Employee contribution calculated using Hawaii PHCA 1.5% method (HRS § 393-15)
                          </div>
                        )}
                        <div style={{ height:'12px' }}/>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {ridersElected && RIDERS_PLAN && (
                <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden', marginTop:'12px' }}>
                  <div style={{ background:'#475569', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ color:'#fff', fontWeight:700, fontSize:'13px' }}>KIAA Riders Package</div>
                      <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'11px', marginTop:'1px' }}>Vision · Dental · Group Life/AD&D</div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <span style={{ background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'9px', fontWeight:700, padding:'2px 7px', borderRadius:'9999px' }}>PPO</span>
                      <span style={{ background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:'9px', padding:'2px 7px', borderRadius:'9999px' }}>Riders</span>
                      {docs['benefit_summary__kiaa_riders'] && (
                        <a href={docs['benefit_summary__kiaa_riders'].file_url} target="_blank" rel="noopener noreferrer"
                          style={{ background:'#84AAC1', color:'#385262', fontSize:'10px', fontWeight:700, padding:'4px 8px', borderRadius:'5px', textDecoration:'none' }}>
                          📄 Summary
                        </a>
                      )}
                    </div>
                  </div>
                  <div style={{ padding:'12px 14px' }}>

                    {/* Vision */}
                    <div style={{ marginBottom:'12px' }}>
                      <div style={{ fontSize:'10px', fontWeight:700, color:'#385262', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', paddingBottom:'4px', borderBottom:'2px solid #EDF2F6' }}>
                        👁 Vision — HMSA Vision Network
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'5px' }}>
                        {[
                          ['Routine eye exam',    'Covered once per year',          '#385262'],
                          ['Frames',              'Up to $150 per year',            '#334155'],
                          ['Lenses (single)',     'Covered once per year',          '#334155'],
                          ['Lenses (bifocal)',    'Covered once per year',          '#334155'],
                          ['Contact lenses',      'Up to $150 (in lieu of lenses)', '#334155'],
                          ['Out-of-network',      'Reduced reimbursement',          '#888'],
                        ].map(([label, val, color]) => (
                          <div key={label} style={{ background:'#EDF2F6', borderRadius:'6px', padding:'5px 7px' }}>
                            <div style={{ fontSize:'9px', color:'#888', marginBottom:'2px' }}>{label}</div>
                            <div style={{ fontWeight:600, color, fontSize:'10px' }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dental */}
                    <div style={{ marginBottom:'12px' }}>
                      <div style={{ fontSize:'10px', fontWeight:700, color:'#385262', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', paddingBottom:'4px', borderBottom:'2px solid #EDF2F6' }}>
                        🦷 Dental — HMSA Dental Network
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'5px' }}>
                        {[
                          ['Preventive',          '100% covered',               '#385262'],
                          ['Cleanings',           'Twice per year',             '#385262'],
                          ['X-rays',              'Bitewings once per year',    '#334155'],
                          ['Basic restorative',   '80% after deductible',       '#334155'],
                          ['Fillings',            'Amalgam & composite',        '#334155'],
                          ['Extractions',         '80% after deductible',       '#334155'],
                          ['Major restorative',   '50% after deductible',       '#334155'],
                          ['Crowns & bridges',    '50% after deductible',       '#334155'],
                          ['Dentures',            '50% after deductible',       '#334155'],
                          ['Annual deductible',   '$50 individual',             '#888'],
                          ['Annual maximum',      '$1,500 per person',          '#888'],
                          ['Orthodontia',         'Not covered',                '#888'],
                        ].map(([label, val, color]) => (
                          <div key={label} style={{ background:'#EDF2F6', borderRadius:'6px', padding:'5px 7px' }}>
                            <div style={{ fontSize:'9px', color:'#888', marginBottom:'2px' }}>{label}</div>
                            <div style={{ fontWeight:600, color, fontSize:'10px' }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Life & AD&D */}
                    <div style={{ marginBottom:'10px' }}>
                      <div style={{ fontSize:'10px', fontWeight:700, color:'#385262', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', paddingBottom:'4px', borderBottom:'2px solid #EDF2F6' }}>
                        🛡 Group Life & AD&D
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'5px' }}>
                        {[
                          ['Life benefit',        'Contact HR for amount',       '#334155'],
                          ['AD&D benefit',        'Equal to life benefit',       '#334155'],
                          ['Covered employees',   'All enrolled employees',      '#334155'],
                          ['Dependent coverage',  'Not included',                '#888'],
                          ['Portability',         'May be available at separation','#888'],
                          ['Beneficiary',         'Designate via HR',            '#888'],
                        ].map(([label, val, color]) => (
                          <div key={label} style={{ background:'#EDF2F6', borderRadius:'6px', padding:'5px 7px' }}>
                            <div style={{ fontSize:'9px', color:'#888', marginBottom:'2px' }}>{label}</div>
                            <div style={{ fontWeight:600, color, fontSize:'10px' }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ fontSize:'11px', color:'#475569', background:'#F8FAFC', borderRadius:'6px', padding:'7px 10px', display:'flex', gap:'6px' }}>
                      <span>ℹ</span>
                      <span>This standalone Riders Package is for employees who have their own medical &amp; drug coverage outside of KIAA and only need dental, vision, and life/AD&amp;D benefits. <strong>Note: Dental, vision, and life/AD&amp;D are already included in all Full Package medical plans above.</strong></span>
                    </div>
                  </div>
                </div>
              )}



              {/* COMPCARE at-a-glance */}
              {compCareElected && (
                <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden', marginTop:'12px' }}>
                  <div style={{ background:'#6595B2', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ color:'#fff', fontWeight:700, fontSize:'13px' }}>COMPCARE</div>
                      <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'11px', marginTop:'1px' }}>Acupuncture · Massage · Active &amp; Fit</div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <span style={{ background:'#84AAC1', color:'#385262', fontSize:'9px', fontWeight:700, padding:'2px 7px', borderRadius:'9999px' }}>Add-on</span>
                      {docs['benefit_summary__compcare'] && (
                        <a href={docs['benefit_summary__compcare'].file_url} target="_blank" rel="noopener noreferrer"
                          style={{ background:'rgba(255,255,255,0.2)', color:'#fff', fontSize:'10px', fontWeight:700, padding:'4px 8px', borderRadius:'5px', textDecoration:'none' }}>
                          📄 Summary
                        </a>
                      )}
                    </div>
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:'10px', color:'#888', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>What's included</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'12px' }}>
                      {[
                        ['Acupuncture', 'Licensed acupuncture visits'],
                        ['Massage', 'Therapeutic massage sessions'],
                        ['Active & Fit', 'Gym membership network access'],
                        ['Cost', `$${COMPCARE.tiers.single.toFixed(2)}/mo per employee`],
                      ].map(([name, desc]) => (
                        <div key={name} style={{ borderBottom:'1px solid #EDF2F6', paddingBottom:'6px' }}>
                          <div style={{ fontSize:'10px', color:'#888', marginBottom:'1px' }}>{name}</div>
                          <div style={{ fontWeight:500, color:'#385262' }}>{desc}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop:'8px', fontSize:'11px', color:'#6595B2', background:'#F4F6FA', borderRadius:'6px', padding:'7px 10px' }}>
                      ℹ Applies to all full package plan tiers. Covers the employee subscriber only — dependents not covered for 2025–2026. Already included in your plan premiums shown above.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── ENROLLMENT PACKET TAB ── */}
        {!loading && tab === 'packet' && (
          <div style={{ padding:'4px 0' }}>



            {/* Enrollment form message */}
            <div style={{ background:'#F4F6FA', border:'1px solid #BED8E1', borderRadius:'12px', padding:'14px 16px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'22px', flexShrink:0 }}>📋</span>
              <div>
                <div style={{ fontWeight:700, fontSize:'13px', color:'#385262', marginBottom:'3px' }}>Enrollment Forms</div>
                <div style={{ fontSize:'12px', color:'#4B5563', lineHeight:1.6 }}>
                  To enroll in your benefits, please contact your HR department to obtain your enrollment forms.
                  Complete and return all forms to HR before your enrollment deadline.
                </div>
              </div>
            </div>

            {/* Categorized document sections */}
            {(() => {
              const hasRiders = elections['kiaa_riders']?.elected ||
                Object.entries(elections||{}).some(([id,el]) => el?.elected && PLAN_MAP[id]?.package === 'Full Package')

              const isAcaCompany = company?.group_type === 'aca_small_group'
              const ACA_PLAN_NAMES = { aca_cm_a:'ACA CompMED A', aca_hph_plus:'ACA HPH Plus', aca_ppp:'ACA PPP' }

              const planDocs = isAcaCompany ? [
                // ACA SBCs
                ...Object.entries(docs)
                  .filter(([k,d]) => k.startsWith('sbc__aca_') && d?.file_url && elections[k.replace('sbc__','')]?.elected)
                  .map(([k,d]) => ({ label:`SBC — ${ACA_PLAN_NAMES[k.replace('sbc__','')] || k.replace('sbc__','')}`, url:d.file_url, icon:'📄' })),
                // ACA GTBs
                ...Object.entries(docs)
                  .filter(([k,d]) => k.startsWith('guide__aca_') && d?.file_url && elections[k.replace('guide__','')]?.elected)
                  .map(([k,d]) => ({ label:`Guide to Benefits — ${ACA_PLAN_NAMES[k.replace('guide__','')] || k.replace('guide__','')}`, url:d.file_url, icon:'📘' })),
                // ACA other docs
                ...(docs['aca_drug_formulary']?.file_url ? [{ label:'ACA Drug Formulary', url:docs['aca_drug_formulary'].file_url, icon:'💊' }] : []),
                ...(docs['aca_plan_changes']?.file_url   ? [{ label:'ACA Plan Changes',   url:docs['aca_plan_changes'].file_url,   icon:'📋' }] : []),
              ] : [
                // MRG SBCs
                ...Object.entries(docs)
                  .filter(([k,d]) => k.startsWith('sbc__') && !k.startsWith('sbc__aca_') && d?.file_url && elections[k.replace('sbc__','')]?.elected)
                  .map(([k,d]) => ({ label:`SBC — ${PLAN_MAP[k.replace('sbc__','')]?.shortName || k.replace('sbc__','')}`, url:d.file_url, icon:'📄' })),
                // Kaiser SBCs
                ...Object.entries(docs)
                  .filter(([k,d]) => k.startsWith('kaiser_sbc__') && d?.file_url &&
                    kaiserRates.some(r => `kaiser_sbc__kaiser_${r.kaiser_plan_no}` === k &&
                      kaiserElections[`${r.kaiser_plan_no}_${r.package_type}`]?.elected))
                  .map(([k,d]) => {
                    const planNo = k.replace('kaiser_sbc__kaiser_','')
                    return { label:`SBC — Kaiser Permanente ${planNo}`, url:d.file_url, icon:'📄' }
                  }),
                // MRG GTBs
                ...(() => {
                  const seen = new Set()
                  return Object.entries(elections||{})
                    .filter(([id,el]) => el?.elected && PLAN_MAP[id])
                    .map(([id]) => ({ id, guideId: guideIdForPlan(id) }))
                    .filter(({guideId}) => guideId && !seen.has(guideId) && seen.add(guideId))
                    .map(({guideId}) => {
                      const d = docs[`guide__${guideId}`]
                      if (!d?.file_url) return null
                      const names = { ppp:'PPP', compmed_a:'CompMED A', compmed_b:'CompMED B', hph_plus:'HPH Plus', hph_basic:'HPH Basic' }
                      return { label:`Guide to Benefits — ${names[guideId]||guideId}`, url:d.file_url, icon:'📘' }
                    }).filter(Boolean)
                })(),
                // Vision, Dental, Drug guides
                ...['vision','dental','drug'].map(gid => {
                  const d = docs[`guide__${gid}`]
                  if (!d?.file_url || (gid !== 'drug' && !hasRiders)) return null
                  return { label:`Guide to Benefits — ${{vision:'Vision',dental:'Dental',drug:'Prescription Drug'}[gid]}`, url:d.file_url, icon:'📘' }
                }).filter(Boolean),
              ]

              const benefitSummaries = Object.entries(docs)
                .filter(([k,d]) => {
                  if (!k.startsWith('benefit_summary__') || !d?.file_url) return false
                  const pid = k.replace('benefit_summary__','')
                  return (pid==='kiaa_riders' && elections['kiaa_riders']?.elected) || (pid==='compcare' && compCareElected)
                })
                .map(([k,d]) => ({ label:`Benefit Summary — ${k.replace('benefit_summary__','').replace('kiaa_riders','KIAA Riders').replace('compcare','COMPCARE')}`, url:d.file_url, icon:'📑' }))

              const memberForms = carrierDocs
                .filter(d => (d.plan_year===null||d.plan_year===PLAN_YEAR) && ['member_form','form'].includes(d.doc_type) && !(d.carrier==='kaiser'&&!company.kaiser_eligible))
                .map(d => ({ label:d.label, url:d.file_url, icon:'📋' }))

              const groupLifeDocs = carrierDocs
                .filter(d => d.doc_type==='group_life_enrollment' && (d.plan_year===null||d.plan_year===PLAN_YEAR))
                .filter(() => hasRiders || groupKaiserRates(kaiserRates).some(g => kaiserElections[`${g.kaiser_plan_no}_${g.package_type}`]?.elected && g.package_type==='full'))
                .map(d => ({ label:d.label, url:d.file_url, icon:'📝' }))

              const otherDocs = [
                ...(spd ? [{ label:'Summary Plan Description (SPD)', url:spd.file_url, icon:'📋' }] : []),
                ...carrierDocs
                  .filter(d => (d.plan_year===null||d.plan_year===PLAN_YEAR) && ['provider_directory','drug_formulary','flyer','other'].includes(d.doc_type) && !(d.carrier==='kaiser'&&!company.kaiser_eligible))
                  .map(d => ({ label:d.label, url:d.file_url, icon:d.doc_type==='provider_directory'?'🏥':d.doc_type==='drug_formulary'?'💊':d.doc_type==='flyer'?'📰':'📎' })),
              ]

              const categories = [
                { title:'Plan Documents',    icon:'📄', items:planDocs },
                { title:'Benefit Summaries', icon:'📑', items:benefitSummaries },
                { title:'Member Forms',      icon:'📋', items:memberForms },
                { title:'Group Life',        icon:'📝', items:groupLifeDocs },
                { title:'Other Documents',   icon:'📎', items:otherDocs },
              ].filter(cat => cat.items.length > 0)

              if (categories.length === 0) return (
                <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', padding:'20px 16px', textAlign:'center', color:'#888', fontSize:'13px', fontStyle:'italic' }}>
                  No documents uploaded yet. Contact your HR representative.
                </div>
              )

              return categories.map(cat => (
                <div key={cat.title} style={{ marginBottom:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
                    <span style={{ fontSize:'14px' }}>{cat.icon}</span>
                    <span style={{ fontSize:'11px', fontWeight:700, color:'#877C73', textTransform:'uppercase', letterSpacing:'0.06em' }}>{cat.title}</span>
                  </div>
                  <div style={{ background:'#fff', border:'1px solid #BED8E1', borderRadius:'12px', overflow:'hidden' }}>
                    {cat.items.map((item, i) => (
                      <div key={item.label} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 16px', borderBottom: i < cat.items.length-1 ? '1px solid #EDF2F6' : 'none' }}>
                        <span style={{ fontSize:'16px', flexShrink:0 }}>{item.icon}</span>
                        <span style={{ flex:1, fontSize:'13px', color:'#1F2937', fontWeight:500 }}>{item.label}</span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          style={{ background:'#6595B2', color:'#fff', borderRadius:'6px', padding:'5px 12px', fontSize:'11px', fontWeight:600, textDecoration:'none', flexShrink:0 }}>
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop:'24px', padding:'12px 0', borderTop:'1px solid #BED8E1', fontSize:'11px', color:'#888', textAlign:'center', lineHeight:1.6 }}>
          {company?.group_type === 'aca_small_group' ? (
            <>Plans administered through KIAA Benefits. Contact KIAA at 808-935-9740 or <a href="mailto:admin@kiaahilo.org" style={{ color:'#6595B2' }}>admin@kiaahilo.org</a></>
          ) : (
            <>All plans administered by Hawaii Medical Service Association (HMSA) through KIAA Benefits.
            Contact HMSA at 1-800-776-4672 · <a href="https://www.hmsa.com" style={{ color:'#6595B2' }}>hmsa.com</a>
            <br/>Plan year: {activePlanStart} – {activePlanEnd}</>
          )}
        </div>
      </div>
    </div>
  )
}


export default function PublicComparePage() {
  const [company, setCompany] = useState(null)
  return company
    ? <PlanView company={company} onBack={() => setCompany(null)}/>
    : <CodeEntry onFound={setCompany}/>
}
