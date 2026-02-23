import { useEffect, useState } from 'react'
import type { Settings as SettingsType, ScraperStatus } from '../api/client'
import { api } from '../api/client'
import { ToastProvider, useToast } from '../components/Toast'

const MODELS = [
  { value: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'anthropic/claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2' },
]

function SettingsInner() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [polling, setPolling] = useState(false)

  // Form state
  const [interval, setInterval_] = useState(30)
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [repliesCount, setRepliesCount] = useState(10)
  const [apiKey, setApiKey] = useState('')
  const [xApiKey, setXApiKey] = useState('')

  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, status] = await Promise.all([
        api.getSettings(),
        api.getScraperStatus().catch(() => null),
      ])
      setSettings(s)
      setScraperStatus(status)
      setInterval_(s.polling_interval_minutes)
      setModel(s.openrouter_model)
      setPrompt(s.system_prompt)
      setRepliesCount(s.replies_per_post)
      setApiKey('')
      setXApiKey('')
    } catch {
      toast('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // Refresh scraper status periodically
  useEffect(() => {
    const t = window.setInterval(() => {
      api.getScraperStatus().then(setScraperStatus).catch(() => {})
    }, 10000)
    return () => window.clearInterval(t)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const data: any = {
        polling_interval_minutes: interval,
        openrouter_model: model,
        system_prompt: prompt,
        replies_per_post: repliesCount,
      }
      if (apiKey) data.openrouter_api_key = apiKey
      if (xApiKey) data.x_api_key = xApiKey
      await api.updateSettings(data)
      toast('Settings saved')
      setApiKey('')
      setXApiKey('')
    } catch {
      toast('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handlePollNow = async () => {
    setPolling(true)
    try {
      const result = await api.triggerPoll()
      toast(result.message)
    } catch {
      toast('Failed to trigger poll')
    } finally {
      setPolling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="font-mono text-sm text-fog">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <h1 className="text-xl font-bold text-ghost">Settings</h1>

      {/* Scraper Status */}
      <div className="rounded-xl border border-slate-mid/50 bg-abyss p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ghost uppercase tracking-wider font-mono">Scraper Status</h2>
          <button
            onClick={handlePollNow}
            disabled={polling}
            className="px-3 py-1.5 rounded-lg bg-cyan-glow/10 border border-cyan-glow/30 text-cyan-glow text-xs font-mono font-medium hover:bg-cyan-glow/20 transition-colors disabled:opacity-40"
          >
            {polling ? 'Starting...' : 'Poll Now'}
          </button>
        </div>
        {scraperStatus?.status_message && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
            <p className="text-xs font-mono text-amber-400">{scraperStatus.status_message}</p>
          </div>
        )}
        {scraperStatus ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatusItem
              label="Status"
              value={scraperStatus.is_running ? 'Running' : 'Idle'}
              color={scraperStatus.is_running ? 'text-emerald' : 'text-fog'}
            />
            <StatusItem
              label="Last Run"
              value={scraperStatus.last_run_at ? new Date(scraperStatus.last_run_at).toLocaleString() : 'Never'}
            />
            <StatusItem
              label="Duration"
              value={scraperStatus.last_run_duration_seconds != null ? `${Math.round(scraperStatus.last_run_duration_seconds)}s` : '—'}
            />
            <StatusItem
              label="Accounts Checked"
              value={scraperStatus.accounts_checked != null ? String(scraperStatus.accounts_checked) : '—'}
            />
            <StatusItem
              label="Posts Found"
              value={scraperStatus.posts_found != null ? String(scraperStatus.posts_found) : '—'}
            />
            <StatusItem
              label="Next Run"
              value={scraperStatus.next_run_at ? new Date(scraperStatus.next_run_at).toLocaleTimeString() : '—'}
            />
          </div>
        ) : (
          <p className="text-sm text-ash font-mono">Status unavailable</p>
        )}
      </div>

      {/* Configuration */}
      <div className="rounded-xl border border-slate-mid/50 bg-abyss p-5 space-y-5">
        <h2 className="text-sm font-semibold text-ghost uppercase tracking-wider font-mono">Configuration</h2>

        {/* Polling interval */}
        <div>
          <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
            Polling Interval: <span className="text-cyan-glow">{interval} min</span>
          </label>
          <input
            type="range"
            min={15}
            max={120}
            step={5}
            value={interval}
            onChange={e => setInterval_(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-mid rounded-full appearance-none cursor-pointer accent-cyan-glow"
          />
          <div className="flex justify-between text-[10px] font-mono text-steel mt-1">
            <span>15m</span>
            <span>120m</span>
          </div>
        </div>

        {/* LLM Model */}
        <div>
          <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
            LLM Model
          </label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-full bg-deep border border-slate-mid rounded-lg px-3 py-2 text-sm text-mist focus:outline-none focus:border-cyan-glow/50 transition-colors font-mono"
          >
            {MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label} ({m.value})</option>
            ))}
          </select>
        </div>

        {/* Replies per post */}
        <div>
          <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
            Replies per post: <span className="text-cyan-glow">{repliesCount}</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={repliesCount}
            onChange={e => setRepliesCount(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-mid rounded-full appearance-none cursor-pointer accent-cyan-glow"
          />
          <div className="flex justify-between text-[10px] font-mono text-steel mt-1">
            <span>1</span>
            <span>20</span>
          </div>
        </div>

        {/* System prompt */}
        <div>
          <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
            System Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={8}
            className="w-full bg-deep border border-slate-mid rounded-lg px-3 py-2 text-sm text-mist placeholder:text-steel focus:outline-none focus:border-cyan-glow/50 transition-colors font-mono resize-y leading-relaxed"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
            OpenRouter API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={settings?.openrouter_api_key || 'Enter API key to update'}
            className="w-full bg-deep border border-slate-mid rounded-lg px-3 py-2 text-sm text-mist placeholder:text-steel focus:outline-none focus:border-cyan-glow/50 transition-colors font-mono"
          />
          <p className="text-[10px] font-mono text-steel mt-1">Leave blank to keep current key</p>
        </div>

        {/* TwitterAPI.io API Key */}
        <div>
          <label className="block text-[11px] font-mono text-ash uppercase tracking-wider mb-1.5">
            TwitterAPI.io API Key
          </label>
          <input
            type="password"
            value={xApiKey}
            onChange={e => setXApiKey(e.target.value)}
            placeholder={settings?.x_api_key || 'Enter TwitterAPI.io key to update'}
            className="w-full bg-deep border border-slate-mid rounded-lg px-3 py-2 text-sm text-mist placeholder:text-steel focus:outline-none focus:border-cyan-glow/50 transition-colors font-mono"
          />
          <p className="text-[10px] font-mono text-steel mt-1">Leave blank to keep current key</p>
        </div>

        {/* Save */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-cyan-glow text-void text-sm font-mono font-semibold hover:bg-cyan-bright transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusItem({ label, value, color = 'text-fog' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-ash uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-mono font-medium mt-0.5 ${color}`}>{value}</div>
    </div>
  )
}

export default function Settings() {
  return (
    <ToastProvider>
      <SettingsInner />
    </ToastProvider>
  )
}
