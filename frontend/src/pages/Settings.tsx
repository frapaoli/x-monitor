import { useCallback, useEffect, useRef, useState } from 'react'
import type { Settings as SettingsType } from '../api/client'
import { api } from '../api/client'
import { ToastProvider, useToast } from '../components/Toast'

const MODELS = [
  { value: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6' },
  { value: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Meta Llama 3.3 70B Instruct (free)' },
]

type FieldStatus = 'idle' | 'saving' | 'saved' | 'error'

function SettingsInner() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [repliesCount, setRepliesCount] = useState(10)
  const [apiKey, setApiKey] = useState('')
  const [xApiKey, setXApiKey] = useState('')

  // Field status tracking
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({})
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const s = await api.getSettings()
      setSettings(s)
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout)
      Object.values(savedTimers.current).forEach(clearTimeout)
    }
  }, [])

  const saveField = useCallback(async (key: string, value: unknown) => {
    setFieldStatus(prev => ({ ...prev, [key]: 'saving' }))
    try {
      await api.updateSettings({ [key]: value })
      setFieldStatus(prev => ({ ...prev, [key]: 'saved' }))
      if (savedTimers.current[key]) clearTimeout(savedTimers.current[key])
      savedTimers.current[key] = setTimeout(() => {
        setFieldStatus(prev => ({ ...prev, [key]: 'idle' }))
      }, 2000)
    } catch {
      setFieldStatus(prev => ({ ...prev, [key]: 'error' }))
    }
  }, [])

  const debouncedSave = useCallback((key: string, value: unknown, delay: number) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => saveField(key, value), delay)
  }, [saveField])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="h-5 w-24 skeleton" />
        <div className="rounded-xl bg-abyss/80 border border-slate-mid/20 p-6">
          <div className="space-y-4">
            <div className="h-4 w-40 skeleton" />
            <div className="h-8 w-full skeleton" />
            <div className="h-8 w-full skeleton" />
            <div className="h-32 w-full skeleton" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <h1 className="text-lg font-bold text-ghost mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Section 1 — AI Configuration */}
        <div className="rounded-xl glass-card p-5 space-y-5">
          <h2 className="text-xs font-semibold text-ghost uppercase tracking-widest font-mono">AI Configuration</h2>

          {/* Model */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono text-ash/80 uppercase tracking-widest">
                LLM Model
              </label>
              <SaveIndicator status={fieldStatus['openrouter_model']} />
            </div>
            <select
              value={model}
              onChange={e => {
                const v = e.target.value
                setModel(v)
                saveField('openrouter_model', v)
              }}
              className="w-full bg-deep/80 border border-slate-mid/50 rounded-lg px-3 py-2.5 text-sm text-mist focus:outline-none focus:border-cyan-glow/40 transition-all font-mono appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Replies per post */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono text-ash/80 uppercase tracking-widest">
                Replies per post: <span className="text-cyan-glow tabular-nums">{repliesCount}</span>
              </label>
              <SaveIndicator status={fieldStatus['replies_per_post']} />
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={repliesCount}
              onChange={e => {
                const v = Number(e.target.value)
                setRepliesCount(v)
                saveField('replies_per_post', v)
              }}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] font-mono text-steel/60 mt-1">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* System prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono text-ash/80 uppercase tracking-widest">
                System Prompt
              </label>
              <SaveIndicator status={fieldStatus['system_prompt']} />
            </div>
            <textarea
              value={prompt}
              onChange={e => {
                const v = e.target.value
                setPrompt(v)
                debouncedSave('system_prompt', v, 800)
              }}
              rows={10}
              className="w-full bg-deep/80 border border-slate-mid/50 rounded-lg px-3.5 py-3 text-sm text-mist placeholder:text-steel/40 focus:outline-none focus:border-cyan-glow/40 transition-all font-mono resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Section 2 — API Keys */}
        <div className="rounded-xl glass-card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-ghost uppercase tracking-widest font-mono">API Keys</h2>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono text-ash/80 uppercase tracking-widest">
                OpenRouter
              </label>
              <SaveIndicator status={fieldStatus['openrouter_api_key']} />
            </div>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onBlur={() => { if (apiKey) saveField('openrouter_api_key', apiKey) }}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono text-ash/80 uppercase tracking-widest">
                TwitterAPI.io
              </label>
              <SaveIndicator status={fieldStatus['x_api_key']} />
            </div>
            <div className="relative">
              <input
                type="password"
                value={xApiKey}
                onChange={e => setXApiKey(e.target.value)}
                onBlur={() => { if (xApiKey) saveField('x_api_key', xApiKey) }}
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

          <p className="text-[10px] font-mono text-steel/50">
            Keys are saved on blur. Leave blank to keep current keys.
          </p>
        </div>
      </div>
    </div>
  )
}

function SaveIndicator({ status }: { status?: FieldStatus }) {
  if (!status || status === 'idle') return null
  return (
    <span className={`text-[10px] font-mono animate-fade-in ${
      status === 'saving' ? 'text-ash' :
      status === 'saved' ? 'text-emerald' :
      'text-rose'
    }`}>
      {status === 'saving' ? 'Saving...' :
       status === 'saved' ? 'Saved' :
       'Error'}
    </span>
  )
}

export default function Settings() {
  return (
    <ToastProvider>
      <SettingsInner />
    </ToastProvider>
  )
}
