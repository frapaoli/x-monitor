import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Post } from '../api/client'
import { api } from '../api/client'
import PostCard from '../components/PostCard'
import BulkActionBar from '../components/BulkActionBar'
import FilterSidebar, { type Filters } from '../components/FilterSidebar'
import { ToastProvider, useToast } from '../components/Toast'

function DashboardInner() {
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const pageRef = useRef(1)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const selectionActive = selectedIds.size > 0

  const [filters, setFilters] = useState<Filters>({
    accountIds: [],
    isRead: '',
    search: '',
  })

  const hasActiveFilters = filters.accountIds.length > 0 || !!filters.isRead || !!filters.search

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => clearTimeout(t)
  }, [filters.search])

  const fetchPosts = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(p),
        per_page: '20',
        is_archived: 'false',
      }
      if (filters.accountIds.length > 0) params.account_ids = filters.accountIds.join(',')
      if (filters.isRead) params.is_read = filters.isRead
      if (debouncedSearch) params.search = debouncedSearch

      const data = await api.getPosts(params)
      if (p === 1) {
        setPosts(data.posts)
      } else {
        setPosts(prev => [...prev, ...data.posts])
      }
      setTotal(data.total)
    } catch {
      toast('Failed to load posts', 'error')
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters.accountIds), filters.isRead, debouncedSearch, toast])

  useEffect(() => {
    pageRef.current = 1
    setSelectedIds(new Set())
    fetchPosts(1)
  }, [fetchPosts])

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          const nextPage = pageRef.current + 1
          pageRef.current = nextPage
          fetchPosts(nextPage)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchPosts, loading])

  const handleRefresh = async () => {
    setRefreshing(true)
    pageRef.current = 1
    setSelectedIds(new Set())
    await fetchPosts(1)
    setRefreshing(false)
    setFocusIdx(-1)
  }

  // Lock body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(posts.map(p => p.id)))
  }, [posts])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Bulk action handlers
  const handleBulkMarkRead = useCallback(async () => {
    if (bulkLoading) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedIds)
      await api.bulkUpdatePosts(ids, { is_read: true })
      setPosts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, is_read: true } : p))
      toast(`Marked ${ids.length} as read`, 'success')
      setSelectedIds(new Set())
    } catch {
      toast('Bulk update failed', 'error')
    } finally {
      setBulkLoading(false)
    }
  }, [selectedIds, bulkLoading, toast])

  const handleBulkMarkUnread = useCallback(async () => {
    if (bulkLoading) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedIds)
      await api.bulkUpdatePosts(ids, { is_read: false })
      setPosts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, is_read: false } : p))
      toast(`Marked ${ids.length} as unread`, 'success')
      setSelectedIds(new Set())
    } catch {
      toast('Bulk update failed', 'error')
    } finally {
      setBulkLoading(false)
    }
  }, [selectedIds, bulkLoading, toast])

  const handleBulkArchive = useCallback(async () => {
    if (bulkLoading) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedIds)
      await api.bulkUpdatePosts(ids, { is_archived: true })
      setPosts(prev => prev.filter(p => !selectedIds.has(p.id)))
      setTotal(t => t - ids.length)
      setFocusIdx(prev => Math.min(prev, posts.length - ids.length - 1))
      toast(`Archived ${ids.length} posts`, 'success')
      setSelectedIds(new Set())
    } catch {
      toast('Bulk archive failed', 'error')
    } finally {
      setBulkLoading(false)
    }
  }, [selectedIds, bulkLoading, posts.length, toast])

  const handlePostUpdate = (updated: Post) => {
    if (updated.is_archived) {
      setPosts(prev => prev.filter(p => p.id !== updated.id))
      setTotal(t => t - 1)
      setSelectedIds(prev => {
        if (!prev.has(updated.id)) return prev
        const next = new Set(prev)
        next.delete(updated.id)
        return next
      })
    } else {
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

      switch (e.key) {
        case 'j':
          setFocusIdx(prev => {
            const next = Math.min(prev + 1, posts.length - 1)
            cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return next
          })
          break
        case 'k':
          setFocusIdx(prev => {
            const next = Math.max(prev - 1, 0)
            cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return next
          })
          break
        case 'c':
          if (focusIdx >= 0 && posts[focusIdx]?.replies?.length > 0) {
            navigator.clipboard.writeText(posts[focusIdx].replies[0].reply_text)
            toast('Copied reply #1', 'success')
          }
          break
        case 'o':
          if (focusIdx >= 0) {
            window.open(posts[focusIdx].post_url, '_blank')
          }
          break
        case 'r':
          if (focusIdx >= 0) {
            api.updatePost(posts[focusIdx].id, { is_read: true }).then(updated => {
              handlePostUpdate(updated)
              toast('Marked as read', 'success')
            })
          }
          break
        case 'a':
          if (focusIdx >= 0) {
            api.updatePost(posts[focusIdx].id, { is_archived: true }).then(updated => {
              handlePostUpdate(updated)
              toast('Archived', 'success')
            })
          }
          break
        case '?':
          setShortcutModalOpen(prev => !prev)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [posts, focusIdx, toast])

  const hasMore = posts.length < total

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 space-y-5">
            <FilterSidebar filters={filters} onChange={setFilters} />

            {/* Stats */}
            <div className="p-3.5 rounded-xl glass-card">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-mono text-ash/70 uppercase tracking-widest">Total</span>
                <span className="text-lg font-mono font-bold text-ghost tabular-nums">{total}</span>
              </div>
              <div className="mt-2 h-px bg-gradient-to-r from-cyan-glow/20 via-cyan-glow/5 to-transparent" />
              <div className="mt-2 text-[10px] font-mono text-ash/60">
                {posts.length} loaded
              </div>
            </div>
          </div>
        </aside>

        {/* Main feed */}
        <div className="flex-1 min-w-0">
          {/* Feed header with refresh */}
          <div className="flex items-center justify-between mb-4">
            {/* Mobile filter button */}
            <div className="lg:hidden">
              <button
                onClick={() => setDrawerOpen(true)}
                className="text-sm font-mono text-fog hover:text-ghost flex items-center gap-1.5 select-none px-2.5 py-1.5 rounded-lg hover:bg-slate-mid/20 transition-all"
              >
                <svg className="w-4 h-4 text-ash" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow" />
                )}
              </button>
            </div>

            {/* Desktop: just show count */}
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-sm font-mono text-ash">
                {total > 0 && `${posts.length} of ${total}`}
              </span>
            </div>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-mono text-ash hover:text-cyan-glow px-2.5 py-1.5 rounded-lg hover:bg-cyan-glow/5 transition-all disabled:opacity-40"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Posts */}
          <div className="space-y-3">
            {posts.map((post, i) => (
              <div key={post.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}>
                <PostCard
                  ref={el => { cardRefs.current[i] = el }}
                  post={post}
                  focused={i === focusIdx}
                  selected={selectedIds.has(post.id)}
                  selectionActive={selectionActive}
                  onUpdate={handlePostUpdate}
                  onToggleSelect={toggleSelect}
                />
              </div>
            ))}
          </div>

          {/* Loading skeleton (initial) */}
          {loading && posts.length === 0 && (
            <div className="space-y-3 py-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-xl bg-abyss/80 border border-slate-mid/20 p-4 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full skeleton" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-32 skeleton" />
                      <div className="h-2.5 w-20 skeleton" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full skeleton" />
                    <div className="h-3 w-4/5 skeleton" />
                    <div className="h-3 w-3/5 skeleton" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty states */}
          {!loading && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-slate-mid/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              {!hasActiveFilters ? (
                <>
                  <p className="text-fog font-medium text-sm">Welcome to X Monitor</p>
                  <p className="text-ash text-xs mt-1.5 max-w-[280px]">
                    Start by adding accounts to monitor on the{' '}
                    <Link to="/accounts" className="text-cyan-glow hover:text-cyan-bright transition-colors">
                      Accounts page
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-fog font-medium text-sm">No matching posts</p>
                  <p className="text-ash text-xs mt-1.5 max-w-[240px]">No posts match your current filters</p>
                  <button
                    onClick={() => setFilters({ accountIds: [], isRead: '', search: '' })}
                    className="mt-3 text-xs font-mono text-cyan-glow hover:text-cyan-bright px-3 py-1.5 rounded-lg border border-cyan-glow/20 hover:bg-cyan-glow/5 transition-all"
                  >
                    Clear Filters
                  </button>
                </>
              )}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && !loading && (
            <div ref={sentinelRef} className="h-1" />
          )}

          {/* Loading indicator for more posts */}
          {loading && posts.length > 0 && (
            <div className="flex justify-center py-6">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-cyan-glow" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs font-mono text-ash">Loading more...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-void/70 animate-fade-backdrop" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-abyss border-r border-slate-mid/40 p-5 animate-slide-in-left overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-mono font-semibold text-ghost">Filters</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-ash hover:text-fog hover:bg-slate-mid/20 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <FilterSidebar filters={filters} onChange={f => { setFilters(f); }} />
          </div>
        </div>
      )}

      {/* Keyboard shortcut modal */}
      {shortcutModalOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-void/80 backdrop-blur-sm animate-fade-backdrop"
          onClick={() => setShortcutModalOpen(false)}
        >
          <div
            className="bg-abyss border border-slate-mid/50 rounded-xl p-6 w-80 animate-fade-in-scale"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-ghost mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2.5">
              {[
                ['J / K', 'Navigate posts'],
                ['O', 'Open in X'],
                ['R', 'Mark as read'],
                ['A', 'Archive'],
                ['C', 'Copy first reply'],
                ['?', 'Toggle this modal'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-ash font-mono">{desc}</span>
                  <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 text-[11px] rounded border border-slate-light/30 bg-slate-dark/80 text-fog font-mono px-1.5">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShortcutModalOpen(false)}
              className="mt-5 w-full text-xs font-mono text-ash hover:text-fog py-2 rounded-lg hover:bg-slate-mid/20 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={posts.length}
        disabled={bulkLoading}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onMarkRead={handleBulkMarkRead}
        onMarkUnread={handleBulkMarkUnread}
        onArchive={handleBulkArchive}
      />
    </div>
  )
}

export default function Dashboard() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  )
}
