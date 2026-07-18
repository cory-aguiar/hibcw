import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function MembershipCardsSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-6 border border-kiaa-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-kiaa-50 hover:bg-kiaa-100/60 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-kiaa-700 text-kiaa-300 flex items-center justify-center flex-shrink-0 text-sm">🪪</div>
          <div>
            <div className="font-semibold text-kiaa-800 text-sm">Understanding your HMSA membership cards</div>
            <div className="text-xs text-kiaa-600 mt-0.5">Full Package members receive 2 cards — learn when to use each one</div>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-kiaa-500 flex-shrink-0"/> : <ChevronDown size={16} className="text-kiaa-500 flex-shrink-0"/>}
      </button>

      {open && (
        <div className="px-5 py-5 bg-white space-y-8">

          {/* Card 1 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-blue-800 bg-blue-100 px-3 py-1 rounded-full uppercase tracking-wide">Card 1 — Medical / Drug</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <img
                src="/MEDRX.png"
                alt="HMSA Medical/Drug membership card"
                className="w-full rounded-xl border border-surface-100 shadow-sm"
                style={{maxWidth:'380px'}}
              />
              <div className="space-y-3">
                <p className="text-sm text-surface-600 leading-relaxed">
                  This card has all your key codes — Medical, Drug, Dental, Vision, and pharmacy (Rx) information.
                </p>
                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Use this card for</div>
                {[
                  ['🩺','Doctor & specialist visits','Primary care, specialists, urgent care, emergency room'],
                  ['💊','Prescriptions','Give this card to the pharmacist — they use the RxBIN, RxPCN, and RxGRP codes'],
                  ['🏥','Hospital & surgery','Inpatient stays, outpatient procedures, lab work, imaging'],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="flex items-start gap-3 bg-blue-50 rounded-xl p-3">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-blue-900">{title}</div>
                      <div className="text-xs text-blue-700 mt-0.5">{desc}</div>
                    </div>
                  </div>
                ))}
                {/* Pediatric dental & vision note */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="text-xs font-semibold text-indigo-800 mb-1">Why are Dental and Vision codes on this card?</div>
                  <div className="text-xs text-indigo-700 leading-relaxed">
                    Under the ACA, <strong className="text-indigo-900">minor dependents (children under 19)</strong> are covered for <strong className="text-indigo-900">pediatric dental and vision</strong> as part of their medical plan — not through the Riders plan. The Dental (<strong>217</strong>) and Vision (<strong>0JE</strong>) codes on this card are used exclusively for pediatric dental and vision services for enrolled minor dependents.
                    <br/><br/>
                    For <strong className="text-indigo-900">adult dental and vision</strong> coverage, employees must use the <strong className="text-indigo-900">Riders card</strong> (Card 2).
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-surface-100"/>

          {/* Card 2 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-kiaa-800 bg-kiaa-100 px-3 py-1 rounded-full uppercase tracking-wide">Card 2 — Riders (Adult Dental & Vision)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <img
                src="/RIDERS.png"
                alt="HMSA Riders membership card for adult Dental and Vision"
                className="w-full rounded-xl border border-surface-100 shadow-sm"
                style={{maxWidth:'380px'}}
              />
              <div className="space-y-3">
                <p className="text-sm text-surface-600 leading-relaxed">
                  This card has two codes — Dental and Vision — for <strong className="text-surface-700">adult</strong> dental and vision coverage. Adult dental and vision providers use a separate billing system from medical, so HMSA issues a dedicated card.
                </p>
                <div className="text-xs bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-800 leading-relaxed">
                  <strong>Who gets this card:</strong> Employees enrolled in a <strong>Full Package</strong> ACA plan receive both cards. Employees on a <strong>Medical Only</strong> plan receive the Medical/Drug card only — they do not have adult Dental or Vision coverage.
                </div>
                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Use this card for</div>
                {[
                  ['🦷','Adult dental appointments','Cleanings, fillings, extractions, orthodontia — for adults only'],
                  ['👁️','Adult eye exams & eyewear','Annual eye exams, prescription glasses, contact lenses — for adults only'],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="flex items-start gap-3 bg-kiaa-50 rounded-xl p-3">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-kiaa-800">{title}</div>
                      <div className="text-xs text-kiaa-600 mt-0.5">{desc}</div>
                    </div>
                  </div>
                ))}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="text-xs font-semibold text-indigo-800 mb-1">Minor dependents — do not use this card</div>
                  <div className="text-xs text-indigo-700 leading-relaxed">
                    Children under 19 enrolled on the plan have <strong className="text-indigo-900">pediatric dental and vision</strong> coverage through their medical plan. For their dental and vision appointments, use the <strong className="text-indigo-900">Medical/Drug card</strong> (Card 1), not this card.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-surface-100"/>

          {/* Quick reference */}
          <div>
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Quick reference</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Medical / Drug card</div>
                <div className="text-xs text-blue-700 leading-relaxed">
                  Doctor visits · Specialists · Urgent care · ER · Lab & imaging · Prescriptions · Hospital · Surgery
                  <div className="mt-1.5 pt-1.5 border-t border-blue-200 text-indigo-700">
                    + Pediatric dental & vision <span className="text-indigo-500">(minor dependents under 19 only)</span>
                  </div>
                </div>
              </div>
              <div className="bg-kiaa-50 rounded-xl p-3 border border-kiaa-200">
                <div className="text-xs font-semibold text-kiaa-800 uppercase tracking-wide mb-2">Riders card</div>
                <div className="text-xs text-kiaa-700 leading-relaxed">
                  Adult dental cleanings · Fillings · Orthodontia · Adult eye exams · Glasses · Contacts
                  <div className="mt-1.5 pt-1.5 border-t border-kiaa-200 text-amber-700">
                    Adults only — not for minor dependents
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-surface-400 text-center">
              Questions about your coverage? Call HMSA member services or KIAA at <strong className="text-surface-600">(808) 961-5422</strong>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

