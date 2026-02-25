import { useCallback, useEffect, useRef, useState } from 'react'
import type { Settings as SettingsType } from '../api/client'
import { api } from '../api/client'
import { useToast } from '../components/Toast'

const MODELS = [
  { value: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6' },
  { value: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Meta Llama 3.3 70B Instruct (free)' },
]

type FieldStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [loading, setLoading] = useState(true)

  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [repliesCount, setRepliesCount] = useState(10)
  const [apiKey, setApiKey] = useState('')
  const [xApiKey, setXApiKey] = useState('')

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
      <div className="p-4 sm:p-6 md:p-8 max-w-2xl">
        <div className="h-6 w-24 skeleton mb-6" />
        <div className="rounded-xl bg-card border border-edge p-6">
          <div className="space-y-4">
            <div className="h-4 w-40 skeleton" />
            <div className="h-10 w-full skeleton" />
            <div className="h-10 w-full skeleton" />
            <div className="h-32 w-full skeleton" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg">Settings</h1>
        <p className="text-sm text-fg-2 mt-1">Configure AI models, prompts, and API keys</p>
      </div>

      <div className="space-y-6">
        {/* AI Configuration */}
        <div className="rounded-xl bg-card border border-edge p-5 space-y-5">
          <h2 className="text-sm font-medium text-fg">AI Configuration</h2>

          {/* Model */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-fg-2">LLM Model</label>
              <SaveIndicator status={fieldStatus['openrouter_model']} />
            </div>
            <select
              value={model}
              onChange={e => {
                const v = e.target.value
                setModel(v)
                saveField('openrouter_model', v)
              }}
              className="w-full bg-surface border border-edge-2 rounded-lg px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2355556a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Replies per post */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-fg-2">
                Replies per post: <span className="text-accent tabular-nums font-mono">{repliesCount}</span>
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
            <div className="flex justify-between text-[10px] text-fg-4 mt-1 font-mono">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* System prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-fg-2">System Prompt</label>
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
              className="w-full bg-surface border border-edge-2 rounded-lg px-3.5 py-3 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors font-mono resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* API Keys */}
        <div className="rounded-xl bg-card border border-edge p-5 space-y-4">
          <h2 className="text-sm font-medium text-fg">API Keys</h2>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-fg-2">OpenRouter</label>
              <SaveIndicator status={fieldStatus['openrouter_api_key']} />
            </div>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onBlur={() => { if (apiKey) saveField('openrouter_api_key', apiKey) }}
                placeholder={settings?.openrouter_api_key ? 'Key configured' : 'Enter API key'}
                className="w-full bg-surface border border-edge-2 rounded-lg px-3 py-2.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
              />
              {settings?.openrouter_api_key && !apiKey && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-ok" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-fg-2">TwitterAPI.io</label>
              <SaveIndicator status={fieldStatus['x_api_key']} />
            </div>
            <div className="relative">
              <input
                type="password"
                value={xApiKey}
                onChange={e => setXApiKey(e.target.value)}
                onBlur={() => { if (xApiKey) saveField('x_api_key', xApiKey) }}
                placeholder={settings?.x_api_key ? 'Key configured' : 'Enter API key'}
                className="w-full bg-surface border border-edge-2 rounded-lg px-3 py-2.5 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
              />
              {settings?.x_api_key && !xApiKey && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-ok" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-fg-4">
            Keys are saved on blur. Leave blank to keep existing keys.
          </p>
        </div>
      </div>
    </div>
  )
}

function SaveIndicator({ status }: { status?: FieldStatus }) {
  if (!status || status === 'idle') return null
  return (
    <span className={`text-[11px] font-medium animate-fade-in ${
      status === 'saving' ? 'text-fg-3' :
      status === 'saved' ? 'text-ok' :
      'text-err'
    }`}>
      {status === 'saving' ? 'Saving...' :
       status === 'saved' ? 'Saved' :
       'Error'}
    </span>
  )
}
