/**
 * Compliance threshold calculations.
 *
 * Federal thresholds use different employee counts:
 *
 * COBRA  — based on FTE count (part-time employees counted as fractions).
 *           Threshold: 20 FTEs on a typical business day in the prior year.
 *           29 CFR § 2590.606 / IRC § 4980B
 *
 * FMLA   — based on total headcount (all employees on payroll within 75 miles),
 *           NOT FTEs. Part-time and seasonal workers count as whole employees.
 *           Threshold: 50 employees. 29 CFR § 825.105
 *
 * ERISA  — based on plan participants (enrolled employees + enrolled dependents),
 *           not employees. When participant count is unknown we fall back to
 *           headcount as a conservative estimate.
 *           Threshold: 100 participants for Form 5500 filing. 29 CFR § 2520.104-46
 *
 * Hawaii PHCA / TDI — all Hawaii employers regardless of size.
 */
export function getCompliance(company) {
  // Support both old (employee_count only) and new (fte + headcount) schemas
  const fte          = parseFloat(company?.fte_count)        || parseInt(company?.employee_count) || 0
  const headcount    = parseInt(company?.headcount)          || parseInt(company?.employee_count) || 0
  const participants = parseInt(company?.plan_participants)  || headcount  // fall back to headcount

  return {
    fedCobra:   {
      required:  fte >= 20,
      threshold: 20,
      label:     'Federal COBRA',
      basis:     'FTE count',
      value:     fte,
      note:      `${fte} FTEs (threshold: 20)`,
    },
    hiCobra:    {
      required:  fte > 0 && fte < 20,
      threshold: 20,
      label:     'HI State Continuation',
      basis:     'FTE count',
      value:     fte,
      note:      'Applies when FTE count < 20',
    },
    fmla:       {
      required:  headcount >= 50,
      threshold: 50,
      label:     'Federal FMLA',
      basis:     'Total headcount',
      value:     headcount,
      note:      `${headcount} employees within 75 miles (threshold: 50)`,
    },
    erisa5500:  {
      required:  participants >= 100,
      threshold: 100,
      label:     'ERISA Form 5500',
      basis:     'Plan participants',
      value:     participants,
      note:      `${participants} participants (threshold: 100)`,
    },
    phca:       {
      required:  headcount > 0,
      threshold: 1,
      label:     'Hawaii PHCA',
      basis:     'All HI employers',
      value:     headcount,
      note:      'Required for all Hawaii employers',
    },
    tdi:        {
      required:  headcount > 0,
      threshold: 1,
      label:     'Hawaii TDI',
      basis:     'All HI employers',
      value:     headcount,
      note:      'Required for all Hawaii employers',
    },
  }
}

// Legacy helper — accepts just a count number for backward compatibility
export function getComplianceByCount(employeeCount) {
  return getCompliance({ employee_count: employeeCount })
}

export function getComplianceSummary(company) {
  const c = getCompliance(company)
  const issues = []
  if (c.fedCobra.required)  issues.push('Federal COBRA notices required')
  if (c.hiCobra.required)   issues.push('Hawaii state continuation coverage may apply')
  if (c.fmla.required)      issues.push('FMLA policy and notices required')
  if (c.erisa5500.required) issues.push('Annual Form 5500 filing required')
  if (c.phca.required)      issues.push('Hawaii PHCA coverage required')
  if (c.tdi.required)       issues.push('Hawaii TDI coverage required')
  return issues
}

export function getSPDCobraText(company) {
  const fte = parseFloat(company?.fte_count) || parseInt(company?.employee_count) || 0
  if (fte >= 20) {
    return `Federal COBRA applies. With ${fte} FTEs, ${company.name} is subject to federal COBRA continuation coverage requirements (threshold: 20 FTEs). Employees and covered dependents may continue health coverage for up to 18 months (36 months for certain qualifying events) following a qualifying event. The employer must notify HMSA within 30 days of a qualifying event. Employees have 60 days to elect COBRA continuation at 100% of the applicable premium plus a 2% administrative fee.`
  }
  return `Federal COBRA does not apply (${fte} FTEs — fewer than the 20 FTE threshold). However, Hawaii state continuation coverage may apply. Contact the Hawaii Insurance Division at (808) 586-2790 for applicable state continuation requirements. All Hawaii employers should review their continuation obligations under state law.`
}

export function getSPDFmlaText(company) {
  const headcount = parseInt(company?.headcount) || parseInt(company?.employee_count) || 0
  if (headcount >= 50) {
    return `Federal FMLA applies. With ${headcount} employees on payroll, ${company.name} meets the 50-employee headcount threshold. Eligible employees (12+ months of service, 1,250+ hours in the prior year) may take up to 12 weeks of unpaid, job-protected leave per year for qualifying reasons. Health coverage must be maintained during FMLA leave under the same terms and conditions as active employees. Hawaii Temporary Disability Insurance (TDI) and the Hawaii Prepaid Health Care Act (PHCA) also apply.`
  }
  return `Federal FMLA does not apply (${headcount} total employees — fewer than the 50-employee headcount threshold). However, Hawaii Temporary Disability Insurance (TDI) applies to all Hawaii employers and provides partial wage replacement for employees unable to work due to a non-work-related illness or injury, including pregnancy. The Hawaii Prepaid Health Care Act (PHCA) also requires health care coverage for eligible employees. Contact the Hawaii Department of Labor and Industrial Relations for details.`
}

export function getSPDErisaText(company) {
  const participants = parseInt(company?.plan_participants) || parseInt(company?.headcount) || parseInt(company?.employee_count) || 0
  if (participants >= 100) {
    return `ERISA applies and ${company.name} is required to file Form 5500 annually (${participants} plan participants — threshold: 100). Plan documents must be made available to participants upon written request within 30 days. The plan is subject to all ERISA fiduciary, reporting, and disclosure requirements.`
  }
  return `ERISA applies to this plan. With fewer than 100 plan participants (${participants} estimated), ${company.name} qualifies for the small plan exemption from Form 5500 annual filing. All other ERISA requirements remain in effect: the Summary Plan Description must be distributed to participants, claims and appeals procedures must be followed, and fiduciary duties apply to plan administrators.`
}

export const COMPLIANCE_COLORS = {
  required: 'comp-required',
  exempt:   'comp-exempt',
  na:       'comp-na',
  warn:     'comp-warn',
}
