// Plan year label — update this when new plan year is configured
// Runtime value comes from PlanYearContext; this is a static fallback for display
export const CURRENT_PLAN_YEAR_LABEL = '10/01/2025 – 09/30/2026'

// Single source of truth for the FEIN & DOL filing link shown to ACA
// prospects (both on-screen and in their confirmation email) and used by
// staff when resending from the Prospects admin list. Update here only —
// every place that needs it imports this constant.
export const FEIN_DOL_JOTFORM_URL = 'https://form.jotform.com/kiaa'

// Phone number formatter — formats as (###) ###-####
export function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3)  return digits.length ? `(${digits}` : ''
  if (digits.length <= 6)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

// Band 9 — Riders only, no medical coverage
// Companies on Band 9 can only elect the standalone Riders Package. No 7(a)/7(b), no COMPCARE, no Kaiser.
export function isBand9(company) {
  return Number(company?.band) === 9
}

/**
 * KIAA Connect — HMSA Plans
 * Plan year is now config-driven via PlanYearContext.
 * planYear fields in plan objects are display-only strings.
 *
 * 7(a) Plans — equal to or better than the prevalent plan
 * 7(b) Plans — more limited benefits; employer must pay half of dependent coverage
 *
 * Order matches HMSA pricing sheet and KIAA display preference.
 */

export const PLANS = [
  // ── 7(a) PLANS ──────────────────────────────────────────────

  {
    id:               'ppp_med',
    name:             'Preferred Provider Plan - A (Medical Only)',
    shortName:        'PPP Med Only',
    displayOrder:     1,
    hmsa_class:       '7a',
    hmsa_class_label: '7(a)',
    type:             'PPO',
    package:          'Medical Only',
    codes:            'MED 431, KIAA',
    deductible:       '$0 in-net / $100 ind OON',
    oopMedical:       '$2,500 / $7,500',
    oopRx:            '—',
    pcp:              '$12 copay',
    specialist:       '$12 copay',
    er:               '$75 copay',
    hospital:         '10% coinsurance',
    maternity:        '10% coinsurance',
    rxGeneric:        '$7 copay',
    rxPreferred:      '$30 copay',
    outOfNetwork:     '30% coinsurance',
    referralRequired: false,
    riders:           ['Medical'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
  },
  {
    id:               'ppp_full',
    name:             'Preferred Provider Plan - A (Full Package)',
    shortName:        'PPP Full',
    displayOrder:     2,
    hmsa_class:       '7a',
    hmsa_class_label: '7(a)',
    type:             'PPO',
    package:          'Full Package',
    codes:            'MED 431 / DRG 697 / VIS 0GQ / DEN M90',
    deductible:       '$0 in-net / $100 ind OON',
    oopMedical:       '$2,500 / $7,500',
    oopRx:            '$3,600 / $4,200',
    pcp:              '$12 copay',
    specialist:       '$12 copay',
    er:               '$75 copay',
    hospital:         '10% coinsurance',
    maternity:        '10% coinsurance',
    rxGeneric:        '$7 copay',
    rxPreferred:      '$30 copay',
    outOfNetwork:     '30% coinsurance',
    referralRequired: false,
    riders:           ['Medical', 'Dental', 'Vision'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
  },
  {
    id:               'compmed_a_med',
    name:             'CompMED A (Medical Only)',
    shortName:        'CompMED A Med',
    displayOrder:     3,
    hmsa_class:       '7a',
    hmsa_class_label: '7(a)',
    type:             'PPO',
    package:          'Medical Only',
    codes:            'MED 438, KIAA',
    deductible:       '$0',
    oopMedical:       '$2,500 / $7,500',
    oopRx:            '—',
    pcp:              '$14 copay',
    specialist:       '$14 copay',
    er:               '$100 copay',
    hospital:         '20% coinsurance',
    maternity:        '10% coinsurance',
    rxGeneric:        '$7 copay',
    rxPreferred:      '$30 copay',
    outOfNetwork:     'Same as in-network',
    referralRequired: false,
    riders:           ['Medical'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
  },
  {
    id:               'compmed_a_full',
    name:             'CompMED A (Full Package)',
    shortName:        'CompMED A Full',
    displayOrder:     4,
    hmsa_class:       '7a',
    hmsa_class_label: '7(a)',
    type:             'PPO',
    package:          'Full Package',
    codes:            'MED 438 / DRG 697 / VIS 0GQ / DEN M90',
    deductible:       '$0',
    oopMedical:       '$2,500 / $7,500',
    oopRx:            '$3,600 / $4,200',
    pcp:              '$14 copay',
    specialist:       '$14 copay',
    er:               '$100 copay',
    hospital:         '20% coinsurance',
    maternity:        '10% coinsurance',
    rxGeneric:        '$7 copay',
    rxPreferred:      '$30 copay',
    outOfNetwork:     'Same as in-network',
    referralRequired: false,
    riders:           ['Medical', 'Dental', 'Vision'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
  },
  {
    id:               'hph_plus_full',
    name:             'Health Plan Hawaii Plus (Full Package)',
    shortName:        'HPH Plus',
    displayOrder:     5,
    hmsa_class:       '7a',
    hmsa_class_label: '7(a)',
    type:             'HMO',
    package:          'Full Package',
    codes:            'MED R-G / DRG 699 / VIS 0HK / DEN M90',
    deductible:       '$0',
    oopMedical:       '$2,500 / $7,500',
    oopRx:            '$3,600 / $4,200',
    pcp:              '$20 copay',
    specialist:       '$20 copay + referral required',
    er:               '$75 copay',
    hospital:         '$75 copay/day',
    maternity:        'No charge (professional)',
    rxGeneric:        '$7 copay',
    rxPreferred:      '$30 copay',
    outOfNetwork:     'Not covered (emergency only)',
    referralRequired: true,
    riders:           ['Medical', 'Dental', 'Vision'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
  },

  // ── 7(b) PLANS ──────────────────────────────────────────────

  {
    id:               'compmed_b_med',
    name:             'CompMED B (Medical Only)',
    shortName:        'CompMED B Med',
    displayOrder:     6,
    hmsa_class:       '7b',
    hmsa_class_label: '7(b)',
    type:             'PPO',
    package:          'Medical Only',
    codes:            'MED 435, KIAA',
    deductible:       '$350 / $1,050',
    oopMedical:       '$3,000 / $9,000',
    oopRx:            '—',
    pcp:              '$17 copay',
    specialist:       '$17 copay',
    er:               '$100 copay',
    hospital:         '20% coinsurance',
    maternity:        '20% coinsurance',
    rxGeneric:        '$7 copay',
    rxPreferred:      '$30 copay',
    outOfNetwork:     'Same as in-network',
    referralRequired: false,
    riders:           ['Medical'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
    note:             'Employer must pay one-half of the cost for dependent coverage.',
  },
  {
    id:               'compmed_b_full',
    name:             'CompMED B (Full Package)',
    shortName:        'CompMED B Full',
    displayOrder:     7,
    hmsa_class:       '7b',
    hmsa_class_label: '7(b)',
    type:             'PPO',
    package:          'Full Package',
    codes:            'MED 435 / DRG 697 / VIS 0GQ / DEN M90',
    deductible:       '$350 / $1,050',
    oopMedical:       '$3,000 / $9,000',
    oopRx:            '$3,600 / $4,200',
    pcp:              '$17 copay',
    specialist:       '$17 copay',
    er:               '$100 copay',
    hospital:         '20% coinsurance',
    maternity:        '20% coinsurance',
    rxGeneric:        '$7 copay',
    rxPreferred:      '$30 copay',
    outOfNetwork:     'Same as in-network',
    referralRequired: false,
    riders:           ['Medical', 'Dental', 'Vision'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
    note:             'Employer must pay one-half of the cost for dependent coverage.',
  },
  {
    id:               'hph_basic_full',
    name:             'Health Plan Hawaii Basic (Full Package)',
    shortName:        'HPH Basic',
    displayOrder:     8,
    hmsa_class:       '7b',
    hmsa_class_label: '7(b)',
    type:             'HMO',
    package:          'Full Package',
    codes:            'MED K-I / DRG 706 / VIS 0HK / DEN M90',
    deductible:       '$350 / $1,050',
    oopMedical:       '$3,000 / $9,000',
    oopRx:            '$3,600 / $4,200',
    pcp:              '$20 copay',
    specialist:       '$20 copay + referral required',
    er:               '$75 copay',
    hospital:         '20% coinsurance',
    maternity:        'No charge (professional)',
    rxGeneric:        '$7 copay',
    rxPreferred:      '$30 copay',
    outOfNetwork:     'Not covered (emergency only)',
    referralRequired: true,
    riders:           ['Medical', 'Dental', 'Vision'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
    note:             'Employer must pay one-half of the cost for dependent coverage.',
  },
  // ── KIAA RIDERS PACKAGE ─────────────────────────────────────

  {
    id:               'kiaa_riders',
    name:             'KIAA Riders Package (Vision, Dental, Group Life)',
    shortName:        'Riders Package',
    displayOrder:     9,
    hmsa_class:       'riders',
    hmsa_class_label: 'Riders',
    type:             'PPO',
    package:          'Riders Only',
    codes:            'VIS 0GQ / DEN M90 / LIFE AD&D',
    deductible:       'N/A',
    oopMedical:       'N/A',
    oopRx:            'N/A',
    pcp:              'N/A',
    specialist:       'N/A',
    er:               'N/A',
    hospital:         'N/A',
    maternity:        'N/A',
    rxGeneric:        'N/A',
    rxPreferred:      'N/A',
    outOfNetwork:     'N/A',
    referralRequired: false,
    riders:           ['Dental', 'Vision', 'Life/AD&D'],
    planYear:         CURRENT_PLAN_YEAR_LABEL,
    flatRate:         true,
    flatRates: {
      single:    45.24,
      two_party: 92.40,
      family:    136.36,
    },
    note: 'Available to employees with outside medical/drug coverage. Includes Vision, Dental, and Group Life w/ AD&D.',
  },
]

export const PLAN_MAP     = Object.fromEntries(PLANS.map(p => [p.id, p]))

// ── KAISER PERMANENTE ────────────────────────────────────────
// Kaiser rates are company-specific (per Schedule), not shared.
// These templates provide display metadata; actual rates come from kaiser_rates table.

export const KAISER_PLAN_TEMPLATES = {
  med_rx: {
    carrier:          'kaiser',
    type:             'HMO',
    package:          'Medical & Drug Only',
    packageType:      'med_rx',
    referralRequired: true,
    planYear:         CURRENT_PLAN_YEAR_LABEL,
    note:             'Medical and Drug benefits through Kaiser Permanente HMO network. No out-of-network coverage (emergency only).',
    riders:           ['Medical', 'Drug'],
  },
  full: {
    carrier:          'kaiser',
    type:             'HMO',
    package:          'Full Package',
    packageType:      'full',
    referralRequired: true,
    planYear:         CURRENT_PLAN_YEAR_LABEL,
    note:             'Kaiser Medical & Drug with HMSA Dental, Vision, and Group Life with AD&D.',
    riders:           ['Medical', 'Drug', 'Dental', 'Vision', 'Life/AD&D'],
  },
}

/**
 * Build a display plan object from a kaiser_rates row.
 * Used in OE page, portal, and employee /plans page.
 */
// Kaiser plan benefit details for comparison table
// These are common across all Kaiser HMO plans — company-specific premiums
// come from kaiser_rates table loaded per company
export const KAISER_COMPARISON_FIELDS = [
  { key: 'type',             label: 'Plan type' },
  { key: 'package',          label: 'Package' },
  { key: 'deductible',       label: 'Deductible (ind/fam)' },
  { key: 'oopMedical',       label: 'OOP max – medical' },
  { key: 'oopRx',            label: 'OOP max – Rx' },
  { key: 'pcp',              label: 'PCP visit' },
  { key: 'specialist',       label: 'Specialist' },
  { key: 'er',               label: 'Emergency room' },
  { key: 'hospital',         label: 'Inpatient hospital' },
  { key: 'maternity',        label: 'Maternity' },
  { key: 'rxGeneric',        label: 'Rx generic (retail)' },
  { key: 'rxPreferred',      label: 'Rx preferred (retail)' },
  { key: 'outOfNetwork',     label: 'Out-of-network' },
  { key: 'referralRequired', label: 'Referral required' },
  { key: 'riders',           label: 'Coverage riders',
    format: v => Array.isArray(v) ? v.join(', ') : v },
]

// Static Kaiser HMO benefit details
// Plan numbers (320, 401) vary per company — these are the common HMO benefit structures
// Actual plan-specific values should be verified against current Kaiser SBCs
export const KAISER_PLAN_BENEFITS = {
  med_rx: {
    type:             'HMO',
    package:          'Medical & Drug Only',
    deductible:       '$0',
    oopMedical:       '$1,500 / $3,000',
    oopRx:            'Included in OOP',
    pcp:              '$15 copay',
    specialist:       '$15 copay (referral req.)',
    er:               '$100 copay',
    hospital:         '$0',
    maternity:        '$0',
    rxGeneric:        '$10 copay',
    rxPreferred:      '$20 copay',
    outOfNetwork:     'Not covered (emergency only)',
    referralRequired: true,
    riders:           ['Medical', 'Drug'],
    note:             'Benefit details are general estimates. Refer to company-specific Kaiser SBC for exact values.',
  },
  full: {
    type:             'HMO',
    package:          'Full Package',
    deductible:       '$0',
    oopMedical:       '$1,500 / $3,000',
    oopRx:            'Included in OOP',
    pcp:              '$15 copay',
    specialist:       '$15 copay (referral req.)',
    er:               '$100 copay',
    hospital:         '$0',
    maternity:        '$0',
    rxGeneric:        '$10 copay',
    rxPreferred:      '$20 copay',
    outOfNetwork:     'Not covered (emergency only)',
    referralRequired: true,
    riders:           ['Medical', 'Drug', 'Vision', 'Dental', 'Life/AD&D'],
    note:             'Includes HMSA Vision, Dental & Group Life/AD&D. Refer to company-specific Kaiser SBC for exact values.',
  },
}

export function buildKaiserPlan(row) {
  const tmpl = KAISER_PLAN_TEMPLATES[row.package_type]
  if (!tmpl) return null
  const pkgLabel = row.package_type === 'full' ? 'Full Package' : 'Med/Rx Package'
  return {
    ...tmpl,
    id:        `kaiser_${row.kaiser_plan_no}_${row.package_type}`,
    name:      `Kaiser Permanente ${row.kaiser_plan_no} ${pkgLabel}`,
    shortName: `Kaiser ${row.kaiser_plan_no} ${row.package_type === 'full' ? 'Full' : 'Med/Rx'}`,
    planNo:    row.kaiser_plan_no,
    schedule:  row.schedule,
  }
}

/**
 * Each kaiser_rates row IS one plan (tiers stored as columns, like rate_bands).
 * Returns sorted array: med_rx before full, then by plan number.
 */
export function groupKaiserRates(rows = []) {
  return [...rows].sort((a, b) => {
    if (a.kaiser_plan_no !== b.kaiser_plan_no) return a.kaiser_plan_no.localeCompare(b.kaiser_plan_no)
    return a.package_type === 'med_rx' ? -1 : 1
  })
}
export const PLANS_7A     = PLANS.filter(p => p.hmsa_class === '7a')
export const PLANS_7B     = PLANS.filter(p => p.hmsa_class === '7b')
export const PLANS_MEDICAL = PLANS.filter(p => p.hmsa_class !== 'riders')
export const RIDERS_PLAN   = PLANS.find(p => p.id === 'kiaa_riders')

/**
 * COMPCARE — company-elected a-la-carte benefit
 * Acupuncture, Massage, Active & Fit
 * Plan year 2025-2026: Employee only tier, $6.76/month
 * Only applies to Full Package plans (not Medical Only, not Riders)
 */
export const COMPCARE = {
  id:          'compcare',
  name:        'COMPCARE (Acupuncture, Massage, Active & Fit)',
  shortName:   'COMPCARE',
  premium:     6.76,           // per employee per month
  tiers: {
    single:    6.76,   // employee only
    two_party: 6.76,   // employee portion applies to all tiers
    family:    6.76,   // employee portion applies to all tiers
  },
  eligiblePlanIds: [           // only full package plans
    'ppp_full',
    'compmed_a_full',
    'hph_plus_full',
    'hph_basic_full',
    'compmed_b_full',
  ],
  note: 'COMPCARE ($6.76/mo) applies to all coverage tiers — the employee is always a covered subscriber. Dependents are not covered by COMPCARE for the 2025–2026 plan year.',
}

export function isPlanCompCareEligible(planId) {
  return COMPCARE.eligiblePlanIds.includes(planId)
}

export const COMPARISON_FIELDS = [
  { key: 'hmsa_class_label', label: 'HMSA classification' },
  { key: 'type',             label: 'Plan type' },
  { key: 'package',          label: 'Package' },
  { key: 'deductible',       label: 'Deductible (ind/fam)' },
  { key: 'oopMedical',       label: 'OOP max – medical' },
  { key: 'oopRx',            label: 'OOP max – Rx' },
  { key: 'pcp',              label: 'PCP visit' },
  { key: 'specialist',       label: 'Specialist' },
  { key: 'er',               label: 'Emergency room' },
  { key: 'hospital',         label: 'Inpatient hospital' },
  { key: 'maternity',        label: 'Maternity' },
  { key: 'rxGeneric',        label: 'Rx generic (retail)' },
  { key: 'rxPreferred',      label: 'Rx preferred (retail)' },
  { key: 'outOfNetwork',     label: 'Out-of-network' },
  { key: 'riders',           label: 'Coverage riders',
    format: v => Array.isArray(v) ? v.join(', ') : v },
]

// ── ACA Small Group Plan Benefit Details ─────────────────────
// Source: HMSA Small Business SBCs 2026
export const ACA_PLAN_BENEFITS = {
  aca_ppp: {
    id:               'aca_ppp',
    name:             'Preferred Provider Plan – A',
    shortName:        'ACA PPP',
    type:             'PPO',
    package:          'ACA Small Group',
    deductible:       '$0 in-net / $100 ind OON',
    oopMedical:       '$2,500 / $7,500',
    oopRx:            '$7,650 / $12,800',
    pcp:              '$12 copay',
    specialist:       '$12 copay',
    er:               '$12 copay + 20% coinsurance',
    hospital:         '10% coinsurance',
    maternity:        '10% coinsurance',
    rxGeneric:        '$7 copay (retail)',
    rxPreferred:      '$50 copay (retail)',
    outOfNetwork:     'Yes — 30% coinsurance',
    referralRequired: false,
  },
  aca_cm_a: {
    id:               'aca_cm_a',
    name:             'CompMED A',
    shortName:        'ACA CompMED A',
    type:             'CompMED',
    package:          'ACA Small Group',
    deductible:       '$0',
    oopMedical:       '$2,500 / $7,500',
    oopRx:            '$7,650 / $12,800',
    pcp:              '$14 copay',
    specialist:       '$14 copay',
    er:               '$20 copay + 20% coinsurance',
    hospital:         '20% coinsurance',
    maternity:        '10% coinsurance',
    rxGeneric:        '$7 copay (retail)',
    rxPreferred:      '$50 copay (retail)',
    outOfNetwork:     'Yes — same rate as in-network',
    referralRequired: false,
  },
  aca_hph_plus: {
    id:               'aca_hph_plus',
    name:             'Health Plan Hawaii Plus',
    shortName:        'ACA HPH Plus',
    type:             'HMO',
    package:          'ACA Small Group',
    deductible:       '$0',
    oopMedical:       '$2,500 / $7,500',
    oopRx:            '$7,650 / $12,800',
    pcp:              '$20 copay',
    specialist:       '$20 copay (referral req.)',
    er:               '$100 copay',
    hospital:         '10% coinsurance',
    maternity:        '10% coinsurance',
    rxGeneric:        '$7 copay (retail)',
    rxPreferred:      '$50 copay (retail)',
    outOfNetwork:     'Not covered (emergency only)',
    referralRequired: true,
  },
}

export const ACA_COMPARISON_FIELDS = [
  { key: 'type',             label: 'Plan type' },
  { key: 'deductible',       label: 'Deductible (ind/fam)' },
  { key: 'oopMedical',       label: 'OOP max – medical' },
  { key: 'oopRx',            label: 'OOP max – Rx' },
  { key: 'pcp',              label: 'PCP visit' },
  { key: 'specialist',       label: 'Specialist' },
  { key: 'er',               label: 'Emergency room' },
  { key: 'hospital',         label: 'Inpatient hospital' },
  { key: 'maternity',        label: 'Maternity' },
  { key: 'rxGeneric',        label: 'Rx generic (retail)' },
  { key: 'rxPreferred',      label: 'Rx preferred (retail)' },
  { key: 'outOfNetwork',     label: 'Out-of-network' },
  { key: 'referralRequired', label: 'Referral required' },
]
