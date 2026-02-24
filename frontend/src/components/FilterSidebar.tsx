import { useEffect, useRef, useState } from 'react'
import type { Account } from '../api/client'
import { api } from '../api/client'

export interface Filters {
  accountIds: string[]
  isRead: string
  search: string
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
}

export default function FilterSidebar({ filters, onChange }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    api.getAccounts({ per_page: '200' }).then(r => setAccounts(r.accounts)).catch(() => {})
  }, [])

  const setField = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const toggleAccountId = (id: string) => {
    const next = filters.accountIds.includes(id)
      ? filters.accountIds.filter(a => a !== id)
      : [...filters.accountIds, id]
    setField('accountIds', next)
  }

  const activeCount = [
    filters.accountIds.length > 0 ? 'x' : '',
    filters.isRead,
    filters.search,
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={e => setField('search', e.target.value)}
          placeholder="Search..."
          className="w-full bg-deep/80 border border-slate-mid/60 rounded-lg pl-8 pr-3 py-2 text-sm text-mist placeholder:text-steel/60 focus:outline-none focus:border-cyan-glow/40 focus:bg-deep transition-all font-mono"
        />
      </div>

      {/* Account filter — multi-select */}
      <div>
        <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
          Accounts
        </label>
        <MultiAccountSelect
          accounts={accounts}
          selected={filters.accountIds}
          onToggle={toggleAccountId}
          onClear={() => setField('accountIds', [])}
        />
      </div>

      {/* Read status */}
      <div>
        <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
          Status
        </label>
        <div className="flex gap-1 p-0.5 rounded-lg bg-deep/60 border border-slate-mid/30">
          {[
            { value: '', label: 'All' },
            { value: 'false', label: 'Unread' },
            { value: 'true', label: 'Read' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setField('isRead', opt.value)}
              className={`flex-1 text-xs font-mono py-1.5 rounded-md transition-all duration-200 ${
                filters.isRead === opt.value
                  ? 'bg-cyan-glow/12 text-cyan-glow shadow-sm'
                  : 'text-ash hover:text-fog'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active filter count */}
      {activeCount > 0 && (
        <button
          onClick={() => onChange({ accountIds: [], isRead: '', search: '' })}
          className="flex items-center gap-1.5 text-[11px] font-mono text-ash hover:text-fog transition-colors w-full"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

function MultiAccountSelect({
  accounts,
  selected,
  onToggle,
  onClear,
}: {
  accounts: Account[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedAccounts = accounts.filter(a => selected.includes(a.id))

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-deep/80 border border-slate-mid/60 rounded-lg px-3 py-2 text-sm text-left font-mono transition-all hover:border-slate-light/50 focus:outline-none focus:border-cyan-glow/40 flex items-center gap-2 min-h-[38px]"
      >
        {selectedAccounts.length === 0 ? (
          <span className="text-steel/60">All accounts</span>
        ) : (
          <span className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedAccounts.map(a => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 bg-cyan-glow/10 text-cyan-glow text-[11px] px-1.5 py-0.5 rounded"
              >
                @{a.username}
                <svg
                  className="w-3 h-3 opacity-60 hover:opacity-100 cursor-pointer"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  onClick={e => { e.stopPropagation(); onToggle(a.id) }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            ))}
          </span>
        )}
        <svg className={`w-3.5 h-3.5 text-steel shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg bg-deep border border-slate-mid/60 shadow-xl max-h-52 overflow-y-auto animate-fade-in">
          {selected.length > 0 && (
            <button
              onClick={() => { onClear(); setOpen(false) }}
              className="w-full text-left text-[11px] font-mono text-ash hover:text-fog hover:bg-slate-mid/20 px-3 py-2 border-b border-slate-mid/30 transition-colors"
            >
              Clear selection
            </button>
          )}
          {accounts.map(a => {
            const isSelected = selected.includes(a.id)
            return (
              <button
                key={a.id}
                onClick={() => onToggle(a.id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm font-mono transition-colors ${
                  isSelected ? 'text-cyan-glow bg-cyan-glow/5' : 'text-fog hover:bg-slate-mid/20'
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-cyan-glow border-cyan-glow text-void' : 'border-slate-mid/60'
                }`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                @{a.username}
              </button>
            )
          })}
          {accounts.length === 0 && (
            <div className="px-3 py-3 text-xs font-mono text-steel text-center">No accounts</div>
          )}
        </div>
      )}
    </div>
  )
}
