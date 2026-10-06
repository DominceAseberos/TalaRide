import type { ReactNode } from 'react';
import { Bell, ChevronRight, LayoutDashboard, LogOut, RefreshCw, ShieldCheck, Users, BusFront, CreditCard, CircleHelp, Settings, Building2 } from 'lucide-react';

export type OpsSection = 'overview' | 'drivers' | 'vehicles' | 'transactions' | 'lostItems' | 'issues' | 'fares' | 'groups' | 'members';
const icons = { overview: LayoutDashboard, drivers: Users, vehicles: BusFront, transactions: CreditCard, lostItems: Bell, issues: CircleHelp, fares: Settings, groups: Building2, members: Users };

export function OpsLayout({ title, person, role, group, active, sections, onSelect, onSignOut, onRefresh, loading, children }: {
  title: string; person: string; role: 'admin' | 'operator'; group?: string; active: OpsSection;
  sections: { id: OpsSection; label: string; count?: number }[]; onSelect: (key: OpsSection) => void;
  onSignOut?: () => void; onRefresh?: () => void; loading?: boolean; children: ReactNode;
}) {
  const activeLabel = sections.find(item => item.id === active)?.label || 'Overview';
  return <div className="min-h-screen bg-[#f4f6f9] text-slate-800 lg:flex">
    <aside className="flex w-full flex-col bg-[#263746] text-white lg:min-h-screen lg:w-64 lg:shrink-0">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded bg-[#367fa9] text-lg font-bold">T</span>
        <div><p className="font-semibold leading-5">TalaRide</p><p className="mt-0.5 text-xs text-slate-300">{role === 'admin' ? 'Administration' : group || 'TODA Operator'}</p></div>
      </div>
      <div className="hidden px-5 py-5 lg:block"><p className="text-[11px] uppercase tracking-wider text-slate-400">Signed in as</p><p className="mt-1 truncate text-sm font-medium">{person}</p><span className="mt-2 inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-200"><ShieldCheck className="h-3 w-3" />{role}</span></div>
      <nav aria-label="Portal navigation" className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:py-0">
        <p className="hidden px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400 lg:block">Main navigation</p>
        {sections.map(section => {
          const Icon = icons[section.id]; const selected = active === section.id;
          return <button key={section.id} onClick={() => onSelect(section.id)} aria-current={selected ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-3 rounded px-3 py-2.5 text-left text-sm transition lg:w-full ${selected ? 'bg-[#367fa9] text-white' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`}>
            <Icon className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">{section.label}</span>{section.count !== undefined && <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] ${selected ? 'bg-white/20' : 'bg-white/10'}`}>{section.count}</span>}
          </button>;
        })}
      </nav>
      <div className="hidden border-t border-white/10 p-3 lg:block"><button onClick={onSignOut} className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" />Sign out</button></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="flex min-h-[68px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div><p className="text-sm font-semibold text-slate-800">{title}</p><p className="mt-0.5 text-xs text-slate-500 lg:hidden">{person} · {role}</p></div>
        <div className="flex items-center gap-2">{onRefresh && <button onClick={onRefresh} disabled={loading} title="Refresh data" className="rounded border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>}<button onClick={onSignOut} className="rounded border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 lg:hidden">Sign out</button></div>
      </header>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6"><span>Portal</span><ChevronRight className="h-3 w-3" /><span className="font-medium text-slate-700">{activeLabel}</span>{group && role === 'operator' && <><span className="mx-1 text-slate-300">/</span><span>{group}</span></>}</div>
      <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6">{children}</main>
    </div>
  </div>;
}
