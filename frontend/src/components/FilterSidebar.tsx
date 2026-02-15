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

  return (
    <div className="space-y-5">
      {/* Search */}
      <div>
        <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
          Search
        </label>
        <input
          type="text"
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          placeholder="Search posts..."
          className="w-full bg-deep border border-slate-mid rounded-lg px-3 py-2 text-sm text-mist placeholder:text-steel focus:outline-none focus:border-cyan-glow/50 transition-colors font-mono"
        />
      </div>

      {/* Account filter */}
      <div>
        <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
          Account
        </label>
        <select
          value={filters.accountId}
          onChange={e => set('accountId', e.target.value)}
          className="w-full bg-deep border border-slate-mid rounded-lg px-3 py-2 text-sm text-mist focus:outline-none focus:border-cyan-glow/50 transition-colors font-mono"
        >
          <option value="">All accounts</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              @{a.username}
            </option>
          ))}
        </select>
      </div>

      {/* Read status */}
      <div>
        <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
          Status
        </label>
        <div className="flex gap-1">
          {[
            { value: '', label: 'All' },
            { value: 'false', label: 'Unread' },
            { value: 'true', label: 'Read' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => set('isRead', opt.value)}
              className={`flex-1 text-xs font-mono py-1.5 rounded-lg border transition-colors ${
                filters.isRead === opt.value
                  ? 'border-cyan-glow/40 bg-cyan-glow/10 text-cyan-glow'
                  : 'border-slate-mid text-ash hover:text-fog hover:border-slate-light/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Post type */}
      <div>
        <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
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
              className={`text-xs font-mono py-1 px-2.5 rounded-lg border transition-colors ${
                filters.postType === opt.value
                  ? 'border-cyan-glow/40 bg-cyan-glow/10 text-cyan-glow'
                  : 'border-slate-mid text-ash hover:text-fog hover:border-slate-light/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
