import { useState } from 'react'
import type { Reply } from '../api/client'
import { api } from '../api/client'
import { useToast } from './Toast'

interface Props {
  replies: Reply[]
  postLlmStatus: string
  onRegenerate: () => void
  onReplyUpdate?: (updated: Reply) => void
}

export default function ReplyList({ replies, postLlmStatus, onRegenerate, onReplyUpdate }: Props) {
  const toast = useToast()
  const [regenerating, setRegenerating] = useState(false)
  const [localReplies, setLocalReplies] = useState<Reply[]>(replies)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (replies !== localReplies && replies.length > 0 && replies[0]?.id !== localReplies[0]?.id) {
    setLocalReplies(replies)
  }

  const handleCopy = async (text: string, _index: number, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleFavorite = async (reply: Reply) => {
    try {
      const updated = await api.updateReply(reply.id, { is_favorite: !reply.is_favorite })
      setLocalReplies(prev => prev.map(r => r.id === reply.id ? updated : r))
      onReplyUpdate?.(updated)
    } catch {
      toast('Failed to update', 'error')
    }
  }

  const handleUsed = async (reply: Reply) => {
    try {
      const updated = await api.updateReply(reply.id, { was_used: true })
      setLocalReplies(prev => prev.map(r => r.id === reply.id ? updated : r))
      onReplyUpdate?.(updated)
      toast('Marked as used', 'success')
    } catch {
      toast('Failed to update', 'error')
    }
  }

  if (postLlmStatus === 'processing') {
    return (
      <div className="mt-3 rounded-lg bg-elevated/50 border border-edge p-4">
        <div className="flex items-center gap-3">
          <Spinner />
          <div>
            <span className="text-sm text-fg-2">Generating replies...</span>
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-1 w-8 rounded-full skeleton" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (postLlmStatus === 'failed') {
    return (
      <div className="mt-3 rounded-lg bg-err-soft border border-err/15 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-err" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-err">Generation failed</span>
          </div>
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-2 px-3 py-1.5 rounded-lg border border-accent/20 hover:bg-accent-soft transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (postLlmStatus === 'pending' || localReplies.length === 0) {
    return (
      <div className="mt-3 rounded-lg bg-elevated/30 border border-edge p-4">
        <div className="flex items-center gap-2 text-fg-3">
          <svg className="w-3.5 h-3.5 animate-pulse-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">Replies pending...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-fg-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-xs text-fg-3">
            {localReplies.length} replies
          </span>
        </div>
        <button
          onClick={async () => {
            setRegenerating(true)
            try { await onRegenerate() } finally { setRegenerating(false) }
          }}
          disabled={regenerating}
          className="flex items-center gap-1.5 text-xs text-fg-3 hover:text-accent transition-colors disabled:opacity-40"
        >
          <svg className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>

      {/* Reply items */}
      <div className="rounded-lg border border-edge overflow-hidden bg-card/50">
        {localReplies.map((reply, idx) => (
          <div
            key={reply.id}
            className={`flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-hover/50 ${
              idx > 0 ? 'border-t border-edge' : ''
            } ${reply.was_used ? 'bg-ok-soft/30' : ''}`}
          >
            {/* Index */}
            <span className={`font-mono text-[11px] w-5 pt-0.5 shrink-0 text-right tabular-nums ${
              reply.is_favorite ? 'text-warn' : 'text-fg-4'
            }`}>
              {reply.reply_index}
            </span>

            {/* Reply text */}
            <p className="text-sm text-fg-2 leading-relaxed flex-1 min-w-0 whitespace-pre-wrap">
              {reply.reply_text}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
              <button
                onClick={() => handleFavorite(reply)}
                className={`p-1.5 rounded-md transition-colors ${
                  reply.is_favorite
                    ? 'text-warn bg-warn-soft'
                    : 'text-fg-4 hover:text-warn hover:bg-warn-soft/50'
                }`}
                title="Favorite"
              >
                <svg className="w-3.5 h-3.5" fill={reply.is_favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              <button
                onClick={() => handleUsed(reply)}
                className={`p-1.5 rounded-md transition-colors ${
                  reply.was_used
                    ? 'text-ok bg-ok-soft'
                    : 'text-fg-4 hover:text-ok hover:bg-ok-soft/50'
                }`}
                title="Mark as used"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <div className="relative">
                {copiedId === reply.id && (
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-mono text-accent bg-card border border-accent/20 px-1.5 py-0.5 rounded whitespace-nowrap animate-fade-in">
                    Copied!
                  </span>
                )}
                <button
                  onClick={() => handleCopy(reply.reply_text, reply.reply_index, reply.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    copiedId === reply.id
                      ? 'text-accent bg-accent-soft'
                      : 'text-fg-4 hover:text-accent hover:bg-accent-soft/50'
                  }`}
                  title="Copy to clipboard"
                >
                  {copiedId === reply.id ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
