import { useState, createContext, useContext, useCallback } from 'react'

interface ToastItem {
  id: number
  message: string
}

const ToastContext = createContext<(msg: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string) => {
    const id = nextId++
    setToasts(t => [...t, { id, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2000)
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className="animate-fade-in bg-cyan-glow/15 border border-cyan-glow/30 text-cyan-bright text-sm font-mono px-4 py-2 rounded-lg backdrop-blur-md shadow-lg"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
