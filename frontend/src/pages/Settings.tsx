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
      toast('Failed to load settings', 'error')
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
      toast('Settings saved', 'success')
      setApiKey('')
      setXApiKey('')
    } catch {
      toast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePollNow = async () => {
    setPolling(true)
    try {
      const result = await api.triggerPoll()
      toast(result.message, 'success')
    } catch {
      toast('Failed to trigger poll', 'error')
    } finally {
      setPolling(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="h-5 w-24 skeleton" />
        <div className="rounded-xl bg-abyss/80 border border-slate-mid/20 p-6">
          <div className="space-y-4">
            <div className="h-4 w-40 skeleton" />
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-2.5 w-16 skeleton" />
                  <div className="h-4 w-20 skeleton" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-abyss/80 border border-slate-mid/20 p-6">
          <div className="space-y-5">
            <div className="h-4 w-32 skeleton" />
            <div className="h-8 w-full skeleton" />
            <div className="h-8 w-full skeleton" />
            <div className="h-32 w-full skeleton" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <h1 className="text-lg font-bold text-ghost mb-6">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Scraper status + API keys */}
        <div className="lg:col-span-1 space-y-6">
          {/* Scraper Status */}
          <div className="rounded-xl glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-ghost uppercase tracking-widest font-mono">Scraper</h2>
              {scraperStatus && (
                <div className={`flex items-center gap-1.5 text-[11px] font-mono ${
                  scraperStatus.is_running ? 'text-emerald' : 'text-ash'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    scraperStatus.is_running ? 'bg-emerald unread-dot' : 'bg-steel'
                  }`} />
                  {scraperStatus.is_running ? 'Running' : 'Idle'}
                </div>
              )}
            </div>

            {scraperStatus?.status_message && (
              <div className="mb-4 rounded-lg bg-amber/5 border border-amber/15 px-3 py-2">
                <p className="text-[11px] font-mono text-amber/80 leading-relaxed">{scraperStatus.status_message}</p>
              </div>
            )}

            {scraperStatus ? (
              <div className="space-y-3">
                <StatusRow label="Last run" value={
                  scraperStatus.last_run_at ? formatRelative(scraperStatus.last_run_at) : 'Never'
                } />
                <StatusRow label="Duration" value={
                  scraperStatus.last_run_duration_seconds != null
                    ? `${Math.round(scraperStatus.last_run_duration_seconds)}s`
                    : '—'
                } />
                <StatusRow label="Checked" value={
                  scraperStatus.accounts_checked != null ? String(scraperStatus.accounts_checked) : '—'
                } />
                <StatusRow label="Found" value={
                  scraperStatus.posts_found != null ? String(scraperStatus.posts_found) : '—'
                } />
                <StatusRow label="Next run" value={
                  scraperStatus.next_run_at ? new Date(scraperStatus.next_run_at).toLocaleTimeString() : '—'
                } />

                <div className="pt-2">
                  <button
                    onClick={handlePollNow}
                    disabled={polling || scraperStatus.is_running}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-cyan-glow/8 border border-cyan-glow/20 text-cyan-glow text-xs font-mono font-medium hover:bg-cyan-glow/12 hover:border-cyan-glow/30 transition-all disabled:opacity-30"
                  >
                    {polling ? (
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {polling ? 'Starting...' : 'Poll Now'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ash font-mono">Status unavailable</p>
            )}
          </div>

          {/* API Keys */}
          <div className="rounded-xl glass-card p-5 space-y-4">
            <h2 className="text-xs font-semibold text-ghost uppercase tracking-widest font-mono">API Keys</h2>

            <div>
              <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
                OpenRouter
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={settings?.openrouter_api_key ? 'key configured' : 'Enter key'}
                  className="w-full bg-deep/80 border border-slate-mid/50 rounded-lg px-3 py-2.5 text-sm text-mist placeholder:text-steel/40 focus:outline-none focus:border-cyan-glow/40 transition-all font-mono"
                />
                {settings?.openrouter_api_key && !apiKey && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-3.5 h-3.5 text-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
                TwitterAPI.io
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={xApiKey}
                  onChange={e => setXApiKey(e.target.value)}
                  placeholder={settings?.x_api_key ? 'key configured' : 'Enter key'}
                  className="w-full bg-deep/80 border border-slate-mid/50 rounded-lg px-3 py-2.5 text-sm text-mist placeholder:text-steel/40 focus:outline-none focus:border-cyan-glow/40 transition-all font-mono"
                />
                {settings?.x_api_key && !xApiKey && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-3.5 h-3.5 text-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Configuration */}
        <div className="lg:col-span-2">
          <div className="rounded-xl glass-card p-5 space-y-6">
            <h2 className="text-xs font-semibold text-ghost uppercase tracking-widest font-mono">Configuration</h2>

            {/* LLM Model + Replies per post - side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
                  LLM Model
                </label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-deep/80 border border-slate-mid/50 rounded-lg px-3 py-2.5 text-sm text-mist focus:outline-none focus:border-cyan-glow/40 transition-all font-mono appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                >
                  {MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
                  Replies per post: <span className="text-cyan-glow tabular-nums">{repliesCount}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={repliesCount}
                  onChange={e => setRepliesCount(Number(e.target.value))}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-[10px] font-mono text-steel/60 mt-1">
                  <span>1</span>
                  <span>20</span>
                </div>
              </div>
            </div>

            {/* Polling interval */}
            <div>
              <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
                Polling Interval: <span className="text-cyan-glow tabular-nums">{interval} min</span>
              </label>
              <input
                type="range"
                min={15}
                max={120}
                step={5}
                value={interval}
                onChange={e => setInterval_(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] font-mono text-steel/60 mt-1">
                <span>15m</span>
                <span>120m</span>
              </div>
            </div>

            {/* System prompt */}
            <div>
              <label className="block text-[10px] font-mono text-ash/80 uppercase tracking-widest mb-1.5">
                System Prompt
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={10}
                className="w-full bg-deep/80 border border-slate-mid/50 rounded-lg px-3.5 py-3 text-sm text-mist placeholder:text-steel/40 focus:outline-none focus:border-cyan-glow/40 transition-all font-mono resize-y leading-relaxed"
              />
            </div>

            {/* Save */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] font-mono text-steel/50">
                {apiKey || xApiKey ? 'API key will be updated' : 'Leave API key fields blank to keep current keys'}
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-cyan-glow text-void text-sm font-mono font-semibold hover:bg-cyan-bright transition-all disabled:opacity-40 shadow-lg shadow-cyan-glow/20 hover:shadow-cyan-glow/30"
              >
                {saving && (
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-mono text-ash/60">{label}</span>
      <span className="text-[12px] font-mono text-fog tabular-nums">{value}</span>
    </div>
  )
}

function formatRelative(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function Settings() {
  return (
    <ToastProvider>
      <SettingsInner />
    </ToastProvider>
  )
}
