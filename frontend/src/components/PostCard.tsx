import { useState } from 'react'
import type { Post } from '../api/client'
import { api } from '../api/client'
import ReplyList from './ReplyList'

interface Props {
  post: Post
}

export default function PostCard({ post }: Props) {
  const [currentPost, setCurrentPost] = useState(post)
  const [expanded, setExpanded] = useState(false)
  const [imgIdx, setImgIdx] = useState<number | null>(null)
  const [imgError, setImgError] = useState(false)

  const timeAgo = formatTimeAgo(currentPost.posted_at)

  const handleRegenerate = async () => {
    const updated = await api.regenerateReplies(currentPost.id)
    setCurrentPost(updated)
  }

  const postTypeConfig: Record<string, { label: string; style: string }> = {
    tweet: { label: 'POST', style: 'text-accent bg-accent-soft' },
    retweet: { label: 'RT', style: 'text-ok bg-ok-soft' },
    quote: { label: 'QT', style: 'text-info bg-info-soft' },
    reply: { label: 'RE', style: 'text-warn bg-warn-soft' },
  }

  const { label: postTypeLabel, style: postTypeStyle } =
    postTypeConfig[currentPost.post_type] || { label: currentPost.post_type.toUpperCase(), style: 'text-fg-2 bg-hover' }

  const replyCount = currentPost.replies?.length || 0

  return (
    <>
      <div className="rounded-xl bg-card border border-edge hover:border-edge-2 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            {currentPost.account_profile_image_url && !imgError ? (
              <img
                src={currentPost.account_profile_image_url}
                alt={`@${currentPost.account_username}`}
                className="w-9 h-9 rounded-full shrink-0 border border-edge-2 object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-elevated flex items-center justify-center text-[11px] font-semibold text-fg-2 uppercase shrink-0 border border-edge-2">
                {currentPost.account_username.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-fg truncate">
                  {currentPost.account_display_name || currentPost.account_username}
                </span>
                <span className="text-xs text-fg-3 font-mono truncate">@{currentPost.account_username}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 ml-3">
            <span className={`font-mono text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-md ${postTypeStyle}`}>
              {postTypeLabel}
            </span>
            <span className="text-[11px] text-fg-3 font-mono tabular-nums" title={new Date(currentPost.posted_at).toLocaleString()}>{timeAgo}</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-4">
          {currentPost.text_content && (
            <p className="text-[13.5px] leading-relaxed text-fg/85 whitespace-pre-wrap mt-1">
              {currentPost.text_content}
            </p>
          )}

          {/* Media */}
          {currentPost.has_media && currentPost.media_local_paths && currentPost.media_local_paths.length > 0 && (
            <div className={`mt-3 grid gap-1.5 ${
              currentPost.media_local_paths.length === 1 ? 'grid-cols-1' :
              'grid-cols-2'
            }`}>
              {currentPost.media_local_paths.map((path, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`relative overflow-hidden rounded-lg border border-edge hover:border-edge-2 transition-all ${
                    currentPost.media_local_paths!.length === 1 ? 'max-h-80' :
                    currentPost.media_local_paths!.length === 3 && i === 0 ? 'row-span-2' : ''
                  }`}
                >
                  <img
                    src={`/media/${path.split('/data/media/')[1] || path}`}
                    alt={`Post media ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            <a
              href={currentPost.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-fg-3 hover:text-fg-2 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-hover"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open
            </a>

            <button
              onClick={() => setExpanded(!expanded)}
              className={`ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                expanded ? 'text-accent bg-accent-soft' : 'text-fg-3 hover:text-fg-2 hover:bg-hover'
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
              replies={currentPost.replies}
              postLlmStatus={currentPost.llm_status}
              onRegenerate={handleRegenerate}
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {imgIdx !== null && currentPost.media_local_paths && (
        <Lightbox
          paths={currentPost.media_local_paths}
          currentIdx={imgIdx}
          onClose={() => setImgIdx(null)}
          onNavigate={setImgIdx}
        />
      )}
    </>
  )
}

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

  return (
    <div
      className="fixed inset-0 z-[90] bg-base/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-fg-2 hover:text-fg transition-colors z-10 rounded-lg hover:bg-hover"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {total > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-mono text-fg-2 bg-card px-3 py-1 rounded-full border border-edge">
          {currentIdx + 1} / {total}
        </span>
      )}

      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card text-fg-2 hover:text-fg hover:bg-elevated transition-colors z-10 border border-edge"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {total > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card text-fg-2 hover:text-fg hover:bg-elevated transition-colors z-10 border border-edge"
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
