import { useCallback, useEffect, useRef, useState } from 'react'
import type { Post } from '../api/client'
import { api } from '../api/client'
import PostCard from '../components/PostCard'
import FilterSidebar, { type Filters } from '../components/FilterSidebar'
import { ToastProvider, useToast } from '../components/Toast'

function DashboardInner() {
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [focusIdx, setFocusIdx] = useState(-1)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const toast = useToast()

  const [filters, setFilters] = useState<Filters>({
    accountId: '',
    isRead: '',
    postType: '',
    search: '',
  })

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
      if (filters.accountId) params.account_id = filters.accountId
      if (filters.isRead) params.is_read = filters.isRead
      if (filters.postType) params.post_type = filters.postType
      if (debouncedSearch) params.search = debouncedSearch

      const data = await api.getPosts(params)
      if (p === 1) {
        setPosts(data.posts)
      } else {
        setPosts(prev => [...prev, ...data.posts])
      }
      setTotal(data.total)
    } catch (e) {
      toast('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [filters.accountId, filters.isRead, filters.postType, debouncedSearch, toast])

  useEffect(() => {
    setPage(1)
    fetchPosts(1)
  }, [fetchPosts])

  const handlePostUpdate = (updated: Post) => {
    if (updated.is_archived) {
      setPosts(prev => prev.filter(p => p.id !== updated.id))
      setTotal(t => t - 1)
    } else {
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
    }
  }

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchPosts(next)
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
            toast('Copied reply #1')
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
              toast('Marked as read')
            })
          }
          break
        case 'a':
          if (focusIdx >= 0) {
            api.updatePost(posts[focusIdx].id, { is_archived: true }).then(updated => {
              handlePostUpdate(updated)
              toast('Archived')
            })
          }
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
          <div className="sticky top-20">
            <FilterSidebar filters={filters} onChange={setFilters} />
            <div className="mt-6 p-3 rounded-lg border border-slate-mid/40 bg-deep/30">
              <div className="text-[10px] font-mono text-ash uppercase tracking-wider mb-1">Stats</div>
              <div className="text-xl font-mono font-bold text-ghost">{total}</div>
              <div className="text-[11px] font-mono text-ash">posts total</div>
            </div>
          </div>
        </aside>

        {/* Main feed */}
        <div className="flex-1 min-w-0">
          {/* Mobile filters */}
          <div className="lg:hidden mb-4">
            <details className="group">
              <summary className="cursor-pointer text-sm font-mono text-fog hover:text-ghost flex items-center gap-1">
                <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Filters
              </summary>
              <div className="mt-3 p-4 border border-slate-mid/40 rounded-lg bg-deep/50">
                <FilterSidebar filters={filters} onChange={setFilters} />
              </div>
            </details>
          </div>

          {/* Posts */}
          <div className="space-y-4">
            {posts.map((post, i) => (
              <div key={post.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                <PostCard
                  ref={el => { cardRefs.current[i] = el }}
                  post={post}
                  focused={i === focusIdx}
                  onUpdate={handlePostUpdate}
                />
              </div>
            ))}
          </div>

          {/* Loading / Load more */}
          {loading && posts.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-fog font-mono text-sm">
                <svg className="animate-spin h-5 w-5 text-cyan-glow" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading posts...
              </div>
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3 opacity-20">0</div>
              <p className="text-fog font-mono text-sm">No posts found</p>
              <p className="text-ash text-xs mt-1">Try adjusting your filters or add accounts to monitor</p>
            </div>
          )}

          {hasMore && !loading && (
            <div className="flex justify-center py-6">
              <button
                onClick={loadMore}
                className="font-mono text-sm text-cyan-dim hover:text-cyan-glow px-6 py-2 rounded-lg border border-cyan-dim/30 hover:border-cyan-glow/40 hover:bg-cyan-glow/5 transition-colors"
              >
                Load more ({posts.length}/{total})
              </button>
            </div>
          )}

          {loading && posts.length > 0 && (
            <div className="flex justify-center py-4">
              <svg className="animate-spin h-5 w-5 text-cyan-glow" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>
      </div>
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
