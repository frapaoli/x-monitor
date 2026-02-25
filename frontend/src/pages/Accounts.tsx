import { useEffect, useMemo, useState } from 'react'
import type { Account, BulkResult } from '../api/client'
import { api } from '../api/client'
import { useToast } from '../components/Toast'

export default function Accounts() {
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
  const [searchQuery, setSearchQuery] = useState('')
  const toast = useToast()

  const activeCount = accounts.filter(a => a.is_active).length
  const pausedCount = accounts.length - activeCount

  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts
    const q = searchQuery.toLowerCase()
    return accounts.filter(a =>
      a.username.toLowerCase().includes(q) ||
      (a.display_name && a.display_name.toLowerCase().includes(q))
    )
  }, [accounts, searchQuery])

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
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-fg">Accounts</h1>
          <p className="text-sm text-fg-2 mt-1">
            {total > 0 ? (
              <>
                <span className="text-ok">{activeCount} active</span>
                {pausedCount > 0 && <span className="text-fg-3 ml-2">{pausedCount} paused</span>}
              </>
            ) : (
              'Add X accounts to start monitoring'
            )}
          </p>
        </div>
      </div>

      {/* Add account */}
      <div className="mb-6 rounded-xl bg-card border border-edge p-5">
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3 font-mono text-sm">@</span>
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="username"
              className="w-full bg-surface border border-edge-2 rounded-lg pl-7 pr-3 py-2.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newUsername.trim()}
            className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-2 text-white text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
            className={`px-3 py-2.5 rounded-lg border text-sm transition-colors ${
              showBulk
                ? 'border-accent/25 text-accent bg-accent-soft'
                : 'border-edge-2 text-fg-3 hover:text-fg-2 hover:border-edge-3'
            }`}
            title="Bulk import"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </form>

        {/* Bulk import */}
        {showBulk && (
          <div className="mt-4 pt-4 border-t border-edge animate-fade-in">
            <label className="block text-xs font-medium text-fg-2 mb-2">
              Bulk import — one username per line
            </label>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={4}
              placeholder={"elonmusk\nvitalikbuterin\nsamaltman"}
              className="w-full bg-surface border border-edge-2 rounded-lg px-3 py-2.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors font-mono resize-y"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleBulk}
                disabled={bulkLoading || !bulkText.trim()}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-2 text-white text-sm font-medium transition-colors disabled:opacity-30"
              >
                {bulkLoading ? 'Importing...' : 'Import All'}
              </button>
              {bulkResults && (
                <span className="text-xs text-fg-2">
                  <span className="text-ok font-medium">{bulkResults.filter(r => r.success).length} ok</span>
                  {bulkResults.some(r => !r.success) && (
                    <span className="text-err font-medium ml-2">{bulkResults.filter(r => !r.success).length} failed</span>
                  )}
                </span>
              )}
            </div>
            {bulkResults && bulkResults.some(r => !r.success) && (
              <div className="mt-2 space-y-1">
                {bulkResults.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="text-xs text-err/80 flex items-center gap-1.5">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="font-mono">@{r.username}</span>: {r.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search filter */}
      {accounts.length > 5 && (
        <div className="mb-4 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter accounts..."
            className="w-full bg-surface border border-edge-2 rounded-lg pl-10 pr-3 py-2.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>
      )}

      {/* Account list */}
      <div className="rounded-xl overflow-hidden bg-card border border-edge">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-edge">
                <th className="text-left text-xs font-medium text-fg-3 px-4 py-3">Account</th>
                <th className="text-center text-xs font-medium text-fg-3 px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-fg-3 px-4 py-3">Posts</th>
                <th className="text-right text-xs font-medium text-fg-3 px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm text-fg-3">Loading accounts...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-elevated flex items-center justify-center mb-1">
                        <svg className="w-5 h-5 text-fg-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="text-sm text-fg">No accounts yet</span>
                      <span className="text-xs text-fg-3">Add a username above to start monitoring</span>
                    </div>
                  </td>
                </tr>
              )}
              {filteredAccounts.map((account, i) => (
                <tr
                  key={account.id}
                  className={`transition-colors hover:bg-hover/50 ${i > 0 ? 'border-t border-edge' : ''}`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {account.profile_image_url ? (
                        <img
                          src={account.profile_image_url}
                          alt={`@${account.username}`}
                          className={`w-8 h-8 rounded-full shrink-0 border object-cover ${
                            account.is_active ? 'border-edge-2' : 'border-edge opacity-50'
                          }`}
                        />
                      ) : (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold uppercase shrink-0 border ${
                          account.is_active
                            ? 'bg-accent-soft text-accent border-accent/20'
                            : 'bg-hover text-fg-3 border-edge'
                        }`}>
                          {account.username.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className={`text-sm font-mono block truncate ${account.is_active ? 'text-fg' : 'text-fg-3'}`}>@{account.username}</span>
                        {account.display_name && (
                          <span className="text-xs text-fg-3 block truncate">{account.display_name}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(account)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 ${
                          account.is_active
                            ? 'bg-accent/25'
                            : 'bg-elevated'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                            account.is_active
                              ? 'translate-x-4.5 bg-accent'
                              : 'translate-x-1 bg-fg-3'
                          }`}
                        />
                      </button>
                      <span className={`text-[11px] font-medium ${account.is_active ? 'text-ok' : 'text-fg-3'}`}>
                        {account.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-mono text-fg-2 tabular-nums">{account.post_count}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {deleteConfirm === account.id ? (
                      <div className="flex items-center gap-1 justify-end animate-fade-in">
                        <button
                          onClick={() => handleDelete(account)}
                          className="text-xs font-medium text-err px-2.5 py-1 rounded-md bg-err-soft hover:bg-err/15 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs font-medium text-fg-3 px-2.5 py-1 rounded-md hover:bg-hover transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(account.id)}
                        className="text-fg-4 hover:text-err px-2 py-1 rounded-md hover:bg-err-soft transition-colors"
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
