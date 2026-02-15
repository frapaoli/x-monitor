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
  const toast = useToast()

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const data = await api.getAccounts({ per_page: '200' })
      setAccounts(data.accounts)
      setTotal(data.total)
    } catch {
      toast('Failed to load accounts')
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
      toast(`Added @${newUsername.trim()}`)
      fetchAccounts()
    } catch (err: any) {
      toast(err.message || 'Failed to add account')
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
      toast(`Imported ${success}/${usernames.length} accounts`)
      fetchAccounts()
    } catch {
      toast('Bulk import failed')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleDelete = async (account: Account) => {
    try {
      await api.deleteAccount(account.id)
      toast(`Removed @${account.username}`)
      fetchAccounts()
    } catch {
      toast('Failed to delete account')
    }
  }

  const handleToggle = async (account: Account) => {
    try {
      await api.updateAccount(account.id, { is_active: !account.is_active })
      fetchAccounts()
    } catch {
      toast('Failed to update account')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ghost">Monitored Accounts</h1>
          <p className="text-sm text-ash font-mono mt-0.5">{total} accounts</p>
        </div>
      </div>

      {/* Add account form */}
      <div className="mb-6 p-4 rounded-xl border border-slate-mid/50 bg-abyss">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Enter username (e.g. elonmusk)"
            className="flex-1 bg-deep border border-slate-mid rounded-lg px-3 py-2 text-sm text-mist placeholder:text-steel focus:outline-none focus:border-cyan-glow/50 transition-colors font-mono"
          />
          <button
            type="submit"
            disabled={adding || !newUsername.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-glow/10 border border-cyan-glow/30 text-cyan-glow text-sm font-mono font-medium hover:bg-cyan-glow/20 transition-colors disabled:opacity-40"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => setShowBulk(!showBulk)}
            className="px-3 py-2 rounded-lg border border-slate-mid text-ash text-sm font-mono hover:text-fog hover:border-slate-light/40 transition-colors"
          >
            Bulk
          </button>
        </form>

        {/* Bulk import */}
        {showBulk && (
          <div className="mt-4 pt-4 border-t border-slate-mid/40">
            <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
              Bulk import (one username per line)
            </label>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={5}
              placeholder={"elonmusk\nvitalikbuterin\nsamaltman"}
              className="w-full bg-deep border border-slate-mid rounded-lg px-3 py-2 text-sm text-mist placeholder:text-steel focus:outline-none focus:border-cyan-glow/50 transition-colors font-mono resize-y"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={handleBulk}
                disabled={bulkLoading || !bulkText.trim()}
                className="px-4 py-1.5 rounded-lg bg-cyan-glow/10 border border-cyan-glow/30 text-cyan-glow text-sm font-mono hover:bg-cyan-glow/20 transition-colors disabled:opacity-40"
              >
                {bulkLoading ? 'Importing...' : 'Import All'}
              </button>
              {bulkResults && (
                <span className="text-xs font-mono text-ash">
                  {bulkResults.filter(r => r.success).length} succeeded,{' '}
                  {bulkResults.filter(r => !r.success).length} failed
                </span>
              )}
            </div>
            {bulkResults && bulkResults.some(r => !r.success) && (
              <div className="mt-2 space-y-1">
                {bulkResults.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="text-xs font-mono text-rose">
                    @{r.username}: {r.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account table */}
      <div className="rounded-xl border border-slate-mid/50 overflow-hidden bg-abyss">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-mid/40">
                <th className="text-left text-[11px] font-mono text-ash uppercase tracking-wider px-4 py-3">Username</th>
                <th className="text-left text-[11px] font-mono text-ash uppercase tracking-wider px-4 py-3">Display Name</th>
                <th className="text-center text-[11px] font-mono text-ash uppercase tracking-wider px-4 py-3">Active</th>
                <th className="text-left text-[11px] font-mono text-ash uppercase tracking-wider px-4 py-3">Last Checked</th>
                <th className="text-right text-[11px] font-mono text-ash uppercase tracking-wider px-4 py-3">Posts</th>
                <th className="text-right text-[11px] font-mono text-ash uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-mid/30">
              {loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <span className="text-sm font-mono text-ash">Loading accounts...</span>
                  </td>
                </tr>
              )}
              {!loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <span className="text-sm font-mono text-ash">No accounts yet. Add one above.</span>
                  </td>
                </tr>
              )}
              {accounts.map(account => (
                <tr key={account.id} className="hover:bg-slate-mid/10 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-cyan-glow">@{account.username}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-fog">{account.display_name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(account)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        account.is_active ? 'bg-cyan-glow/30' : 'bg-slate-mid'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                          account.is_active ? 'translate-x-4.5 bg-cyan-glow' : 'translate-x-1 bg-steel'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-ash">
                      {account.last_checked_at
                        ? new Date(account.last_checked_at).toLocaleString()
                        : 'Never'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono text-fog">{account.post_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(account)}
                      className="text-xs font-mono text-steel hover:text-rose transition-colors px-2 py-1 rounded border border-transparent hover:border-rose/30"
                    >
                      Delete
                    </button>
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

export default function Accounts() {
  return (
    <ToastProvider>
      <AccountsInner />
    </ToastProvider>
  )
}
