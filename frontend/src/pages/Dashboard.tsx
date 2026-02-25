import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Account, RetrievalBatch, RetrievalBatchDetail } from '../api/client'
import { api } from '../api/client'
import PostCard from '../components/PostCard'
import { useToast } from '../components/Toast'

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [sinceDt, setSinceDt] = useState('')
  const [untilDt, setUntilDt] = useState('')
  const [fetching, setFetching] = useState(false)

  const [batches, setBatches] = useState<RetrievalBatch[]>([])
  const [batchesTotal, setBatchesTotal] = useState(0)
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<RetrievalBatchDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(1)
  const toast = useToast()

  useEffect(() => {
    api.getAccounts({ per_page: '200' }).then(r => setAccounts(r.accounts)).catch(() => {})
  }, [])

  useEffect(() => {
    api.getRetrievalDefaults().then(d => {
      setSinceDt(toLocalDatetime(d.since_dt))
      setUntilDt(toLocalDatetime(d.until_dt))
    }).catch(() => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      setSinceDt(toLocalDatetime(yesterday.toISOString()))
      setUntilDt(toLocalDatetime(now.toISOString()))
    })
  }, [])

  const fetchBatches = useCallback(async (page: number) => {
    setBatchesLoading(true)
    try {
      const data = await api.getRetrievals({ page: String(page), per_page: '20' })
      if (page === 1) {
        setBatches(data.retrievals)
      } else {
        setBatches(prev => [...prev, ...data.retrievals])
      }
      setBatchesTotal(data.total)
    } catch {
      toast('Failed to load retrievals', 'error')
    } finally {
      setBatchesLoading(false)
    }
  }, [toast])

  useEffect(() => {
    pageRef.current = 1
    fetchBatches(1)
  }, [fetchBatches])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !batchesLoading && batches.length < batchesTotal) {
          const nextPage = pageRef.current + 1
          pageRef.current = nextPage
          fetchBatches(nextPage)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchBatches, batchesLoading, batches.length, batchesTotal])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  const selectAllAccounts = () => {
    setSelectedAccountIds(accounts.map(a => a.id))
  }

  const handleFetch = async () => {
    if (selectedAccountIds.length === 0) {
      toast('Select at least one account', 'error')
      return
    }
    setFetching(true)
    try {
      const payload: { account_ids: string[]; since_dt?: string; until_dt?: string } = {
        account_ids: selectedAccountIds,
      }
      if (sinceDt) payload.since_dt = new Date(sinceDt).toISOString()
      if (untilDt) payload.until_dt = new Date(untilDt).toISOString()

      const batch = await api.createRetrieval(payload)
      toast('Retrieval started', 'success')

      setBatches(prev => [batch, ...prev])
      setBatchesTotal(t => t + 1)

      setExpandedBatchId(batch.id)
      setExpandedDetail(null)

      const pollStatus = async () => {
        try {
          const detail = await api.getRetrieval(batch.id)
          setBatches(prev => prev.map(b => b.id === batch.id ? {
            ...b,
            status: detail.status,
            error_message: detail.error_message,
            post_count: detail.post_count,
          } : b))
          if (detail.status !== 'running') {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current)
              pollTimerRef.current = null
            }
            setExpandedDetail(detail)
            if (untilDt) setSinceDt(untilDt)
            setUntilDt(toLocalDatetime(new Date().toISOString()))
          }
        } catch { /* ignore */ }
      }

      pollTimerRef.current = setInterval(pollStatus, 2000)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create retrieval', 'error')
    } finally {
      setFetching(false)
    }
  }

  const handleExpandBatch = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null)
      setExpandedDetail(null)
      return
    }
    setExpandedBatchId(batchId)
    setExpandedDetail(null)
    setDetailLoading(true)
    try {
      const detail = await api.getRetrieval(batchId)
      setExpandedDetail(detail)
    } catch {
      toast('Failed to load batch details', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const selectedAccounts = accounts.filter(a => selectedAccountIds.includes(a.id))
  const hasMore = batches.length < batchesTotal

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg">Feed</h1>
        <p className="text-sm text-fg-2 mt-1">Monitor and retrieve posts from tracked accounts</p>
      </div>

      {/* New Retrieval Panel */}
      <div className="rounded-xl bg-card border border-edge p-5 mb-8">
        <h2 className="text-sm font-medium text-fg mb-4">New Retrieval</h2>

        {/* Account picker */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-fg-2 mb-1.5">
            Accounts
          </label>
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
              className="w-full bg-surface border border-edge-2 rounded-lg px-3 py-2.5 text-sm text-left transition-colors hover:border-edge-3 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 flex items-center gap-2 min-h-[42px]"
            >
              {selectedAccounts.length === 0 ? (
                <span className="text-fg-3">Select accounts...</span>
              ) : (
                <span className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  {selectedAccounts.map(a => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 bg-accent-soft text-accent text-xs px-2 py-0.5 rounded-md font-medium"
                    >
                      @{a.username}
                      <svg
                        className="w-3 h-3 opacity-60 hover:opacity-100 cursor-pointer"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        onClick={e => { e.stopPropagation(); toggleAccount(a.id) }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  ))}
                </span>
              )}
              <svg className={`w-4 h-4 text-fg-3 shrink-0 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {accountDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg bg-card border border-edge-2 shadow-xl shadow-base/60 max-h-52 overflow-y-auto animate-fade-in">
                <button
                  onClick={() => {
                    if (selectedAccountIds.length === accounts.length) {
                      setSelectedAccountIds([])
                    } else {
                      selectAllAccounts()
                    }
                  }}
                  className="w-full text-left text-xs text-fg-2 hover:text-fg hover:bg-hover px-3 py-2 border-b border-edge transition-colors font-medium"
                >
                  {selectedAccountIds.length === accounts.length ? 'Deselect all' : 'Select all'}
                </button>
                {accounts.map(a => {
                  const isSelected = selectedAccountIds.includes(a.id)
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAccount(a.id)}
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                        isSelected ? 'text-accent bg-accent-soft' : 'text-fg-2 hover:bg-hover'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-accent border-accent text-white' : 'border-edge-3'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="font-mono text-[13px]">@{a.username}</span>
                    </button>
                  )
                })}
                {accounts.length === 0 && (
                  <div className="px-3 py-4 text-sm text-fg-3 text-center">
                    No accounts yet. <Link to="/accounts" className="text-accent hover:text-accent-2">Add some</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Time range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-fg-2 mb-1.5">Since</label>
            <input
              type="datetime-local"
              value={sinceDt}
              onChange={e => setSinceDt(e.target.value)}
              className="w-full bg-surface border border-edge-2 rounded-lg px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-2 mb-1.5">Until</label>
            <input
              type="datetime-local"
              value={untilDt}
              onChange={e => setUntilDt(e.target.value)}
              className="w-full bg-surface border border-edge-2 rounded-lg px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Fetch button */}
        <button
          onClick={handleFetch}
          disabled={fetching || selectedAccountIds.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-2 text-white text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {fetching ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Fetching...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Fetch Posts
            </>
          )}
        </button>
      </div>

      {/* Retrieval history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-fg">Retrieval History</h2>
          <span className="text-xs text-fg-3 font-mono tabular-nums">{batchesTotal} total</span>
        </div>

        {batches.map(batch => (
          <div key={batch.id} className="animate-fade-in">
            <BatchCard
              batch={batch}
              isExpanded={expandedBatchId === batch.id}
              detail={expandedBatchId === batch.id ? expandedDetail : null}
              detailLoading={expandedBatchId === batch.id && detailLoading}
              onToggle={() => handleExpandBatch(batch.id)}
            />
          </div>
        ))}

        {/* Loading skeleton */}
        {batchesLoading && batches.length === 0 && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl bg-card border border-edge p-4 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center gap-3">
                  <div className="h-3 w-32 skeleton" />
                  <div className="h-3 w-20 skeleton" />
                  <div className="ml-auto h-5 w-16 skeleton rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!batchesLoading && batches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-elevated flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-fg-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <p className="text-fg font-medium text-sm">No retrievals yet</p>
            <p className="text-fg-3 text-xs mt-1.5 max-w-[280px]">
              Select accounts above and fetch posts to get started
            </p>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && !batchesLoading && (
          <div ref={sentinelRef} className="h-1" />
        )}

        {/* Loading more */}
        {batchesLoading && batches.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-fg-3">Loading more...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BatchCard({
  batch,
  isExpanded,
  detail,
  detailLoading,
  onToggle,
}: {
  batch: RetrievalBatch
  isExpanded: boolean
  detail: RetrievalBatchDetail | null
  detailLoading: boolean
  onToggle: () => void
}) {
  const statusStyle = {
    running: 'text-warn bg-warn-soft border-warn/15',
    completed: 'text-ok bg-ok-soft border-ok/15',
    failed: 'text-err bg-err-soft border-err/15',
  }[batch.status] || 'text-fg-2 bg-hover border-edge'

  const statusIcon = {
    running: (
      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ),
    completed: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    failed: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  }[batch.status]

  return (
    <div className={`rounded-xl transition-all ${
      isExpanded
        ? 'bg-card border border-accent/15 shadow-lg shadow-accent/5'
        : 'bg-card border border-edge hover:border-edge-2'
    }`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3"
      >
        <svg className={`w-3.5 h-3.5 text-fg-3 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        <span className="text-xs font-mono text-fg-2 tabular-nums whitespace-nowrap">
          {new Date(batch.created_at).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>

        <span className="text-xs text-fg-3 truncate hidden sm:inline">
          {batch.since_dt ? formatDateShort(batch.since_dt) : '...'} — {batch.until_dt ? formatDateShort(batch.until_dt) : 'now'}
        </span>

        <span className="flex items-center gap-1 ml-auto shrink-0">
          {batch.accounts.slice(0, 3).map(a => (
            <span key={a.id} className="text-[10px] font-mono text-fg-3 bg-hover px-1.5 py-0.5 rounded">
              @{a.username}
            </span>
          ))}
          {batch.accounts.length > 3 && (
            <span className="text-[10px] text-fg-3">+{batch.accounts.length - 3}</span>
          )}
        </span>

        <span className="text-xs text-fg-2 font-mono tabular-nums whitespace-nowrap">
          {batch.post_count} post{batch.post_count !== 1 ? 's' : ''}
        </span>

        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full border ${statusStyle}`}>
          {statusIcon}
          {batch.status}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-edge">
          {batch.error_message && (
            <div className="mt-3 rounded-lg bg-err-soft border border-err/15 px-3 py-2">
              <p className="text-xs text-err/80">{batch.error_message}</p>
            </div>
          )}

          {detailLoading && (
            <div className="py-8 flex justify-center">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs text-fg-3">Loading posts...</span>
              </div>
            </div>
          )}

          {batch.status === 'running' && !detail && !detailLoading && (
            <div className="py-8 flex justify-center">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-warn" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs text-warn/80">Retrieval in progress...</span>
              </div>
            </div>
          )}

          {detail && detail.posts.length === 0 && batch.status === 'completed' && (
            <div className="py-6 text-center">
              <p className="text-xs text-fg-3">No posts found in this time range</p>
            </div>
          )}

          {detail && detail.posts.length > 0 && (
            <div className="mt-3 space-y-3">
              {detail.posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function toLocalDatetime(isoStr: string): string {
  const d = new Date(isoStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateShort(isoStr: string): string {
  return new Date(isoStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
