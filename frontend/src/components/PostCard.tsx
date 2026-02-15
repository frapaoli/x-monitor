import { forwardRef, useState } from 'react'
import type { Post } from '../api/client'
import { api } from '../api/client'
import { useToast } from './Toast'
import ReplyList from './ReplyList'

interface Props {
  post: Post
  focused: boolean
  onUpdate: (post: Post) => void
}

const PostCard = forwardRef<HTMLDivElement, Props>(({ post, focused, onUpdate }, ref) => {
  const toast = useToast()
  const [expanded, setExpanded] = useState(true)
  const [imgOpen, setImgOpen] = useState<string | null>(null)

  const timeAgo = formatTimeAgo(post.posted_at)

  const handleMarkRead = async () => {
    const updated = await api.updatePost(post.id, { is_read: !post.is_read })
    onUpdate(updated)
    toast(updated.is_read ? 'Marked as read' : 'Marked as unread')
  }

  const handleArchive = async () => {
    const updated = await api.updatePost(post.id, { is_archived: true })
    onUpdate(updated)
    toast('Archived')
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

  const postTypeColor = {
    tweet: 'text-cyan-glow',
    retweet: 'text-emerald',
    quote: 'text-violet',
    reply: 'text-amber',
  }[post.post_type] || 'text-fog'

  return (
    <>
      <div
        ref={ref}
        className={`border rounded-xl transition-all duration-200 ${
          focused
            ? 'border-cyan-glow/40 bg-deep shadow-lg shadow-cyan-glow/5'
            : 'border-slate-mid/50 bg-abyss hover:border-slate-light/40'
        } ${!post.is_read ? 'border-l-2 border-l-cyan-glow' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-mid flex items-center justify-center text-xs font-bold text-fog uppercase">
              {post.account_username.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-ghost truncate">
                  {post.account_display_name || post.account_username}
                </span>
                <span className="text-xs text-ash font-mono">@{post.account_username}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`font-mono text-[10px] font-semibold tracking-wider ${postTypeColor}`}>
              {postTypeLabel}
            </span>
            <span className="text-[11px] text-ash font-mono">{timeAgo}</span>
            {!post.is_read && (
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-glow unread-dot" />
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-3">
          {post.text_content && (
            <p className="text-sm leading-relaxed text-mist whitespace-pre-wrap">
              {post.text_content}
            </p>
          )}

          {/* Media */}
          {post.has_media && post.media_local_paths && post.media_local_paths.length > 0 && (
            <div className="mt-2.5 flex gap-2 overflow-x-auto">
              {post.media_local_paths.map((path, i) => (
                <button
                  key={i}
                  onClick={() => setImgOpen(path)}
                  className="shrink-0 rounded-lg overflow-hidden border border-slate-mid/50 hover:border-cyan-glow/30 transition-colors"
                >
                  <img
                    src={`/media/${path.split('/data/media/')[1] || path}`}
                    alt={`Post media ${i + 1}`}
                    className="h-32 w-auto object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Actions bar */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-dim hover:text-cyan-glow transition-colors px-2 py-1 rounded border border-cyan-dim/30 hover:border-cyan-glow/40 hover:bg-cyan-glow/5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open on X
            </a>
            <button
              onClick={handleMarkRead}
              className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded border transition-colors ${
                post.is_read
                  ? 'text-ash border-slate-mid/40 hover:text-fog hover:border-slate-light/40'
                  : 'text-fog border-slate-light/40 hover:text-ghost hover:border-fog/40'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {post.is_read ? 'Read' : 'Mark read'}
            </button>
            <button
              onClick={handleArchive}
              className="inline-flex items-center gap-1 text-xs font-mono text-ash px-2 py-1 rounded border border-slate-mid/40 hover:text-rose hover:border-rose/30 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Archive
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-auto text-xs font-mono text-ash hover:text-fog transition-colors"
            >
              {expanded ? 'Collapse' : 'Expand'} replies
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
      {imgOpen && (
        <div
          className="fixed inset-0 z-[90] bg-void/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setImgOpen(null)}
        >
          <img
            src={`/media/${imgOpen.split('/data/media/')[1] || imgOpen}`}
            alt="Full size"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  )
})

PostCard.displayName = 'PostCard'
export default PostCard

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
