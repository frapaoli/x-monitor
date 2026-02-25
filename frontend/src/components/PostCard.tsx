import { forwardRef, useEffect, useState } from 'react'
import type { Post } from '../api/client'
import { api } from '../api/client'
import { useToast } from './Toast'
import ReplyList from './ReplyList'

interface Props {
  post: Post
  focused: boolean
  selected: boolean
  selectionActive: boolean
  onUpdate: (post: Post) => void
  onToggleSelect: (id: string) => void
}

const PostCard = forwardRef<HTMLDivElement, Props>(({ post, focused, selected, selectionActive, onUpdate, onToggleSelect }, ref) => {
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [imgIdx, setImgIdx] = useState<number | null>(null)
  const [imgError, setImgError] = useState(false)

  const timeAgo = formatTimeAgo(post.posted_at)

  const handleMarkRead = async () => {
    const updated = await api.updatePost(post.id, { is_read: !post.is_read })
    onUpdate(updated)
    toast(updated.is_read ? 'Marked as read' : 'Marked as unread', 'success')
  }

  const handleArchive = async () => {
    const updated = await api.updatePost(post.id, { is_archived: true })
    onUpdate(updated)
    toast('Archived', 'success')
  }

  const handleRegenerate = async () => {
    const updated = await api.regenerateReplies(post.id)
    onUpdate(updated)
  }

  const postTypeLabel = {
    tweet: 'POST',
    retweet: 'RT',
    quote: 'QT',
    reply: 'RE',
  }[post.post_type] || post.post_type.toUpperCase()

  const postTypeStyle = {
    tweet: 'text-cyan-glow bg-cyan-glow/8',
    retweet: 'text-emerald bg-emerald/8',
    quote: 'text-violet bg-violet/8',
    reply: 'text-amber bg-amber/8',
  }[post.post_type] || 'text-fog bg-fog/8'

  const replyCount = post.replies?.length || 0

  return (
    <>
      <div
        ref={ref}
        className={`group relative rounded-xl transition-all duration-200 overflow-hidden ${
          selected
            ? 'ring-1 ring-cyan-glow/50 bg-cyan-glow/5'
            : focused
              ? 'ring-1 ring-cyan-glow/30 bg-deep shadow-lg shadow-cyan-glow/5'
              : 'bg-abyss/80 hover:bg-deep/50 border border-slate-mid/30 hover:border-slate-mid/50'
        }`}
      >
        {/* Unread indicator - left edge glow */}
        {!post.is_read && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-glow" />
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Selection checkbox */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(post.id) }}
              className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                selected
                  ? 'bg-cyan-glow border-cyan-glow text-void'
                  : 'border-slate-mid/50 hover:border-fog/50 text-transparent'
              } ${
                selectionActive ? 'opacity-100' : 'opacity-60'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            {/* Avatar */}
            {post.account_profile_image_url && !imgError ? (
              <img
                src={post.account_profile_image_url}
                alt={`@${post.account_username}`}
                className="w-9 h-9 rounded-full shrink-0 ring-1 ring-slate-light/20 object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-mid to-slate-dark flex items-center justify-center text-[11px] font-bold text-fog/80 uppercase shrink-0 ring-1 ring-slate-light/20">
                {post.account_username.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-semibold text-ghost truncate">
                  {post.account_display_name || post.account_username}
                </span>
                <span className="text-xs text-ash font-mono truncate">@{post.account_username}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className={`font-mono text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded ${postTypeStyle}`}>
              {postTypeLabel}
            </span>
            <span className="text-[11px] text-ash font-mono tabular-nums" title={new Date(post.posted_at).toLocaleString()}>{timeAgo}</span>
            {!post.is_read && (
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-glow unread-dot" />
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-3.5">
          {post.text_content && (
            <p className="text-[13.5px] leading-[1.65] text-mist/90 whitespace-pre-wrap mt-1">
              {post.text_content}
            </p>
          )}

          {/* Media */}
          {post.has_media && post.media_local_paths && post.media_local_paths.length > 0 && (
            <div className={`mt-3 grid gap-1.5 ${
              post.media_local_paths.length === 1 ? 'grid-cols-1' :
              post.media_local_paths.length === 2 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {post.media_local_paths.map((path, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`relative overflow-hidden rounded-lg border border-slate-mid/30 hover:border-cyan-glow/20 transition-all group ${
                    post.media_local_paths!.length === 1 ? 'max-h-80' :
                    post.media_local_paths!.length === 3 && i === 0 ? 'row-span-2' : ''
                  }`}
                >
                  <img
                    src={`/media/${path.split('/data/media/')[1] || path}`}
                    alt={`Post media ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-void/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}

          {/* Actions bar */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-dim hover:text-cyan-glow transition-all px-2.5 py-1.5 rounded-lg hover:bg-cyan-glow/5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open
            </a>

            <div className="w-px h-4 bg-slate-mid/30" />

            <button
              onClick={handleMarkRead}
              className={`inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1.5 rounded-lg transition-all ${
                post.is_read
                  ? 'text-ash hover:text-fog hover:bg-slate-mid/20'
                  : 'text-fog hover:text-ghost hover:bg-slate-mid/20'
              }`}
            >
              {post.is_read ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {post.is_read ? 'Unread' : 'Read'}
            </button>

            <button
              onClick={handleArchive}
              className="inline-flex items-center gap-1 text-xs font-mono text-ash px-2.5 py-1.5 rounded-lg hover:text-rose hover:bg-rose/5 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Archive
            </button>

            {/* Reply toggle - right aligned */}
            <button
              onClick={() => setExpanded(!expanded)}
              className={`ml-auto inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg transition-all ${
                expanded ? 'text-cyan-dim' : 'text-ash hover:text-fog'
              }`}
            >
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {replyCount > 0 ? `${replyCount} replies` : 'Replies'}
            </button>
          </div>

          {/* Replies */}
          {expanded && (
            <ReplyList
              replies={post.replies}
              postLlmStatus={post.llm_status}
              onRegenerate={handleRegenerate}
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {imgIdx !== null && post.media_local_paths && (
        <Lightbox
          paths={post.media_local_paths}
          currentIdx={imgIdx}
          onClose={() => setImgIdx(null)}
          onNavigate={setImgIdx}
        />
      )}
    </>
  )
})

PostCard.displayName = 'PostCard'
export default PostCard

function Lightbox({
  paths,
  currentIdx,
  onClose,
  onNavigate,
}: {
  paths: string[]
  currentIdx: number
  onClose: () => void
  onNavigate: (idx: number) => void
}) {
  const total = paths.length
  const path = paths[currentIdx]

  const goPrev = () => onNavigate((currentIdx - 1 + total) % total)
  const goNext = () => onNavigate((currentIdx + 1) % total)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div
      className="fixed inset-0 z-[90] bg-void/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-fog hover:text-white transition-colors z-10"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Counter badge */}
      {total > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-mono text-fog bg-void/80 px-3 py-1 rounded-full border border-slate-mid/40">
          {currentIdx + 1} / {total}
        </span>
      )}

      {/* Left arrow */}
      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-void/60 text-fog hover:text-white hover:bg-void/80 transition-all z-10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Right arrow */}
      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-void/60 text-fog hover:text-white hover:bg-void/80 transition-all z-10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <img
        src={`/media/${path.split('/data/media/')[1] || path}`}
        alt="Full size"
        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl animate-fade-in-scale"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString()
}
