import type { Plan } from '@/lib/types'
import { getContactLink } from '@/lib/contact'

export default function PlanCard({ plan }: { plan: Plan }) {
  const link = getContactLink(plan.name)
  return (
    <div className={`relative flex flex-col rounded-xl border p-6 transition-all duration-150 ${
      plan.highlighted
        ? 'bg-[#2563EB] border-[#3B82F6]'
        : 'bg-[#18181B] border-[#27272A] hover:border-[#3F3F46]'
    }`}>
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#FAFAFA] text-[#09090B] text-xs font-bold px-3 py-0.5 rounded-full">Más popular</span>
        </div>
      )}
      <div className="mb-5">
        <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${plan.highlighted ? 'text-blue-100' : 'text-[#A1A1AA]'}`}>{plan.name}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-[#FAFAFA]">${plan.price_first_month}</span>
          <span className={`text-sm ${plan.highlighted ? 'text-blue-100' : 'text-[#A1A1AA]'}`}>USD</span>
        </div>
        <p className={`text-xs mt-1 ${plan.highlighted ? 'text-blue-100' : 'text-[#52525B]'}`}>primer mes · luego ${plan.price_monthly} USD/mes</p>
      </div>
      <p className={`text-sm leading-relaxed mb-5 ${plan.highlighted ? 'text-blue-50' : 'text-[#A1A1AA]'}`}>{plan.description}</p>
      <ul className="flex flex-col gap-2.5 flex-1 mb-6">
        {plan.features.map((f, i) => (
          <li key={i} className={`flex items-start gap-2 text-sm ${plan.highlighted ? 'text-blue-50' : 'text-[#D4D4D8]'}`}>
            <svg className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? 'text-white' : 'text-[#2563EB]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <a href={link} target="_blank" rel="noopener noreferrer"
        className={`block text-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          plan.highlighted ? 'bg-white text-[#2563EB] hover:bg-blue-50' : 'bg-[#27272A] text-[#FAFAFA] hover:bg-[#3F3F46] border border-[#3F3F46]'
        }`}>
        Contactar plan
      </a>
    </div>
  )
}
