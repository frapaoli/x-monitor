import { useEffect, useState } from 'react'
import type { Account, BulkResult } from '../api/client'
import { api } from '../api/client'
import { ToastProvider, useToast } from '../components/Toast'

function AccountsInner() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [newUsername, setNewUsername] = useState('')
  const [adding, setAdding] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const toast = useToast()

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const data = await api.getAccounts({ per_page: '200' })
      setAccounts(data.accounts)
      setTotal(data.total)
    } catch {
      toast('Failed to load accounts', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAccounts() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim()) return
    setAdding(true)
    try {
      await api.createAccount(newUsername.trim())
      setNewUsername('')
      toast(`Added @${newUsername.trim()}`, 'success')
      fetchAccounts()
    } catch (err: any) {
      toast(err.message || 'Failed to add account', 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleBulk = async () => {
    const usernames = bulkText.split('\n').map(u => u.trim()).filter(Boolean)
    if (usernames.length === 0) return
    setBulkLoading(true)
    setBulkResults(null)
    try {
      const result = await api.bulkCreateAccounts(usernames)
      setBulkResults(result.results)
      const success = result.results.filter(r => r.success).length
      toast(`Imported ${success}/${usernames.length} accounts`, 'success')
      fetchAccounts()
    } catch {
      toast('Bulk import failed', 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleDelete = async (account: Account) => {
    try {
      await api.deleteAccount(account.id)
      toast(`Removed @${account.username}`, 'success')
      setDeleteConfirm(null)
      fetchAccounts()
    } catch {
      toast('Failed to delete account', 'error')
    }
  }

  const handleToggle = async (account: Account) => {
    try {
      await api.updateAccount(account.id, { is_active: !account.is_active })
      fetchAccounts()
    } catch {
      toast('Failed to update account', 'error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-ghost">Monitored Accounts</h1>
          <p className="text-xs text-ash font-mono mt-1">{total} account{total !== 1 ? 's' : ''} tracked</p>
        </div>
      </div>

      {/* Add account */}
      <div className="mb-6 rounded-xl glass-card p-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-steel font-mono text-sm">@</span>
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="username"
              className="w-full bg-deep/80 border border-slate-mid/50 rounded-lg pl-7 pr-3 py-2.5 text-sm text-mist placeholder:text-steel/50 focus:outline-none focus:border-cyan-glow/40 focus:bg-deep transition-all font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newUsername.trim()}
            className="px-5 py-2.5 rounded-lg bg-cyan-glow/10 border border-cyan-glow/25 text-cyan-glow text-sm font-mono font-medium hover:bg-cyan-glow/15 hover:border-cyan-glow/35 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {adding ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => setShowBulk(!showBulk)}
            className={`px-3 py-2.5 rounded-lg border text-sm font-mono transition-all ${
              showBulk
                ? 'border-cyan-glow/25 text-cyan-glow bg-cyan-glow/5'
                : 'border-slate-mid/50 text-ash hover:text-fog hover:border-slate-light/30'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </form>

        {/* Bulk import */}
        {showBulk && (
          <div className="mt-4 pt-4 border-t border-slate-mid/20 animate-fade-in">
            <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-2">
              Bulk import — one username per line
            </label>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={4}
              placeholder={"elonmusk\nvitalikbuterin\nsamaltman"}
              className="w-full bg-deep/80 border border-slate-mid/50 rounded-lg px-3 py-2.5 text-sm text-mist placeholder:text-steel/40 focus:outline-none focus:border-cyan-glow/40 transition-all font-mono resize-y"
            />
            <div className="mt-2.5 flex items-center gap-3">
              <button
                onClick={handleBulk}
                disabled={bulkLoading || !bulkText.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-glow/10 border border-cyan-glow/25 text-cyan-glow text-sm font-mono hover:bg-cyan-glow/15 transition-all disabled:opacity-30"
              >
                {bulkLoading ? 'Importing...' : 'Import All'}
              </button>
              {bulkResults && (
                <span className="text-xs font-mono text-ash">
                  <span className="text-emerald">{bulkResults.filter(r => r.success).length} ok</span>
                  {bulkResults.some(r => !r.success) && (
                    <span className="text-rose ml-2">{bulkResults.filter(r => !r.success).length} failed</span>
                  )}
                </span>
              )}
            </div>
            {bulkResults && bulkResults.some(r => !r.success) && (
              <div className="mt-2 space-y-1">
                {bulkResults.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="text-xs font-mono text-rose/80 flex items-center gap-1.5">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    @{r.username}: {r.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account list */}
      <div className="rounded-xl overflow-hidden glass-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-mid/30">
                <th className="text-left text-[10px] font-mono text-ash/70 uppercase tracking-widest px-4 py-3">Account</th>
                <th className="text-center text-[10px] font-mono text-ash/70 uppercase tracking-widest px-4 py-3">Active</th>
                <th className="text-left text-[10px] font-mono text-ash/70 uppercase tracking-widest px-4 py-3 hidden sm:table-cell">Last Checked</th>
                <th className="text-right text-[10px] font-mono text-ash/70 uppercase tracking-widest px-4 py-3">Posts</th>
                <th className="text-right text-[10px] font-mono text-ash/70 uppercase tracking-widest px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-cyan-glow" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm font-mono text-ash">Loading...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-mid/20 flex items-center justify-center mb-1">
                        <svg className="w-5 h-5 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="text-sm text-fog">No accounts yet</span>
                      <span className="text-xs text-ash">Add a username above to start monitoring</span>
                    </div>
                  </td>
                </tr>
              )}
              {accounts.map((account, i) => (
                <tr
                  key={account.id}
                  className={`transition-colors hover:bg-slate-mid/8 ${i > 0 ? 'border-t border-slate-mid/15' : ''}`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0 ring-1 ${
                        account.is_active
                          ? 'bg-gradient-to-br from-cyan-glow/20 to-cyan-dim/10 text-cyan-glow ring-cyan-glow/20'
                          : 'bg-slate-mid/30 text-steel ring-slate-mid/30'
                      }`}>
                        {account.username.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-mono text-cyan-glow block truncate">@{account.username}</span>
                        {account.display_name && (
                          <span className="text-xs text-ash block truncate">{account.display_name}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => handleToggle(account)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 ${
                        account.is_active
                          ? 'bg-cyan-glow/25 shadow-sm shadow-cyan-glow/20'
                          : 'bg-slate-mid/60'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                          account.is_active
                            ? 'translate-x-4.5 bg-cyan-glow shadow-sm shadow-cyan-glow/40'
                            : 'translate-x-1 bg-steel'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className="text-xs font-mono text-ash tabular-nums">
                      {account.last_checked_at
                        ? formatRelativeTime(account.last_checked_at)
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-mono text-fog tabular-nums">{account.post_count}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {deleteConfirm === account.id ? (
                      <div className="flex items-center gap-1 justify-end animate-fade-in">
                        <button
                          onClick={() => handleDelete(account)}
                          className="text-[11px] font-mono text-rose px-2 py-1 rounded-md bg-rose/10 hover:bg-rose/15 transition-all"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-[11px] font-mono text-ash px-2 py-1 rounded-md hover:bg-slate-mid/20 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(account.id)}
                        className="text-xs font-mono text-steel/60 hover:text-rose px-2 py-1 rounded-md hover:bg-rose/5 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function Accounts() {
  return (
    <ToastProvider>
      <AccountsInner />
    </ToastProvider>
  )
}
