import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'

export default function Navbar() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const fetchUnread = () => {
      api.getUnreadCount().then(r => setUnread(r.count)).catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative px-3 py-1.5 text-sm font-medium rounded transition-colors ${
      isActive
        ? 'text-cyan-glow bg-cyan-glow/10'
        : 'text-fog hover:text-ghost hover:bg-slate-mid/50'
    }`

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-mid/60 bg-abyss/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-glow unread-dot" />
            <span className="font-mono text-sm font-semibold tracking-wider text-ghost">
              X<span className="text-cyan-glow">::</span>MON
            </span>
          </div>
          <div className="h-5 w-px bg-slate-light/40 mx-1" />
          <div className="flex items-center gap-1">
            <NavLink to="/" className={linkClass}>
              Feed
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-cyan-glow text-void text-[10px] font-bold px-1">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
            <NavLink to="/accounts" className={linkClass}>
              Accounts
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              Settings
            </NavLink>
          </div>
        </div>
        <div className="font-mono text-[11px] text-ash hidden sm:block">
          <KbdHint />
        </div>
      </div>
    </nav>
  )
}

function KbdHint() {
  return (
    <span className="flex items-center gap-2 opacity-60">
      <span><Kbd>j</Kbd><Kbd>k</Kbd> nav</span>
      <span><Kbd>c</Kbd> copy</span>
      <span><Kbd>o</Kbd> open</span>
    </span>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block px-1 py-0.5 text-[10px] rounded border border-slate-light/50 bg-slate-dark text-fog font-mono mx-0.5">
      {children}
    </kbd>
  )
}
