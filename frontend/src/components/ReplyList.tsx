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

  // Sync with parent when replies prop changes
  if (replies !== localReplies && replies.length > 0 && replies[0]?.id !== localReplies[0]?.id) {
    setLocalReplies(replies)
  }

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text)
    toast(`Copied reply #${index}`)
  }

  const handleFavorite = async (reply: Reply) => {
    try {
      const updated = await api.updateReply(reply.id, { is_favorite: !reply.is_favorite })
      setLocalReplies(prev => prev.map(r => r.id === reply.id ? updated : r))
      onReplyUpdate?.(updated)
    } catch {
      toast('Failed to update')
    }
  }

  const handleUsed = async (reply: Reply) => {
    try {
      const updated = await api.updateReply(reply.id, { was_used: true })
      setLocalReplies(prev => prev.map(r => r.id === reply.id ? updated : r))
      onReplyUpdate?.(updated)
      toast('Marked as used')
    } catch {
      toast('Failed to update')
    }
  }

  if (postLlmStatus === 'processing') {
    return (
      <div className="mt-3 p-4 border border-slate-mid rounded-lg bg-deep/50">
        <div className="flex items-center gap-2 text-sm text-fog">
          <Spinner />
          <span className="font-mono">Generating replies...</span>
        </div>
      </div>
    )
  }

  if (postLlmStatus === 'failed') {
    return (
      <div className="mt-3 p-4 border border-rose/30 rounded-lg bg-rose/5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-rose font-mono">Generation failed</span>
          <button
            onClick={onRegenerate}
            className="text-xs font-mono text-cyan-glow hover:text-cyan-bright px-2 py-1 rounded border border-cyan-glow/30 hover:bg-cyan-glow/10 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (postLlmStatus === 'pending' || localReplies.length === 0) {
    return (
      <div className="mt-3 p-4 border border-slate-mid rounded-lg bg-deep/50">
        <span className="text-sm text-ash font-mono">Replies pending...</span>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono text-ash uppercase tracking-wider">
          Replies ({localReplies.length})
        </span>
        <button
          onClick={async () => {
            setRegenerating(true)
            try { await onRegenerate() } finally { setRegenerating(false) }
          }}
          disabled={regenerating}
          className="text-[11px] font-mono text-cyan-dim hover:text-cyan-glow transition-colors disabled:opacity-40"
        >
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>
      <div className="border border-slate-mid/70 rounded-lg overflow-hidden divide-y divide-slate-mid/40">
        {localReplies.map((reply) => (
          <div
            key={reply.id}
            className="group flex items-start gap-3 px-3 py-2.5 hover:bg-slate-mid/20 transition-colors"
          >
            <span className="font-mono text-[11px] text-ash w-5 pt-0.5 shrink-0 text-right">
              {reply.reply_index}.
            </span>
            <p className="text-sm text-fog leading-relaxed flex-1 min-w-0">
              {reply.reply_text}
            </p>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleFavorite(reply)}
                className={`p-1 rounded transition-colors ${
                  reply.is_favorite ? 'text-amber' : 'text-steel hover:text-amber'
                }`}
                title="Favorite"
              >
                <svg className="w-3.5 h-3.5" fill={reply.is_favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              <button
                onClick={() => handleUsed(reply)}
                className={`p-1 rounded transition-colors ${
                  reply.was_used ? 'text-emerald' : 'text-steel hover:text-emerald'
                }`}
                title="Mark as used"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={() => handleCopy(reply.reply_text, reply.reply_index)}
                className="p-1 rounded text-steel hover:text-cyan-glow transition-colors"
                title="Copy to clipboard"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-cyan-glow" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
