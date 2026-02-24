import { useEffect, useState } from 'react'
import type { Account } from '../api/client'
import { api } from '../api/client'

export interface Filters {
  accountId: string
  isRead: string
  postType: string
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

  const set = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  const activeCount = [filters.accountId, filters.isRead, filters.postType, filters.search].filter(Boolean).length

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
          onChange={e => set('search', e.target.value)}
          placeholder="Search..."
          className="w-full bg-deep/80 border border-slate-mid/60 rounded-lg pl-8 pr-3 py-2 text-sm text-mist placeholder:text-steel/60 focus:outline-none focus:border-cyan-glow/40 focus:bg-deep transition-all font-mono"
        />
      </div>

      {/* Account filter */}
      <div>
        <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
          Account
        </label>
        <select
          value={filters.accountId}
          onChange={e => set('accountId', e.target.value)}
          className="w-full bg-deep/80 border border-slate-mid/60 rounded-lg px-3 py-2 text-sm text-mist focus:outline-none focus:border-cyan-glow/40 transition-all font-mono appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="">All accounts</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>@{a.username}</option>
          ))}
        </select>
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
              onClick={() => set('isRead', opt.value)}
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

      {/* Post type */}
      <div>
        <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
          Type
        </label>
        <div className="flex flex-wrap gap-1">
          {[
            { value: '', label: 'All' },
            { value: 'tweet', label: 'Posts' },
            { value: 'retweet', label: 'RTs' },
            { value: 'quote', label: 'Quotes' },
            { value: 'reply', label: 'Replies' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => set('postType', opt.value)}
              className={`text-xs font-mono py-1 px-2.5 rounded-md transition-all duration-200 ${
                filters.postType === opt.value
                  ? 'bg-cyan-glow/12 text-cyan-glow'
                  : 'text-ash hover:text-fog hover:bg-slate-mid/30'
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
          onClick={() => onChange({ accountId: '', isRead: '', postType: '', search: '' })}
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
