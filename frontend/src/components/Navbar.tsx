import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { api } from '../api/client'

const navItems = [
  {
    to: '/',
    label: 'Feed',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
    hasBadge: true,
  },
  {
    to: '/accounts',
    label: 'Accounts',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function Navbar() {
  const [unread, setUnread] = useState(0)
  const location = useLocation()

  useEffect(() => {
    const fetchUnread = () => {
      api.getUnreadCount().then(r => setUnread(r.count)).catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-mid/40 bg-void/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-cyan-glow unread-dot" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-cyan-glow blur-sm opacity-60" />
            </div>
            <span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-ghost group-hover:text-white transition-colors">
              X<span className="text-cyan-glow">::</span>MON
            </span>
          </NavLink>

          <div className="h-5 w-px bg-slate-light/20" />

          {/* Nav links */}
          <div className="flex items-center gap-0.5">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() => {
                  const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
                  return `relative flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-cyan-glow bg-cyan-glow/8'
                      : 'text-ash hover:text-fog hover:bg-slate-mid/30'
                  }`
                }}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
                {item.hasBadge && unread > 0 && (
                  <span className="absolute -top-1 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-cyan-glow text-void text-[10px] font-bold font-mono px-1 shadow-lg shadow-cyan-glow/30">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Kbd hints - only on Feed page, desktop */}
        {location.pathname === '/' && (
          <div className="hidden md:flex items-center gap-3 font-mono text-[11px] text-steel">
            <span className="flex items-center gap-1">
              <Kbd>J</Kbd><Kbd>K</Kbd>
              <span className="text-ash/60">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>C</Kbd>
              <span className="text-ash/60">copy</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>O</Kbd>
              <span className="text-ash/60">open</span>
            </span>
          </div>
        )}
      </div>
    </nav>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center w-5 h-5 text-[10px] rounded border border-slate-light/30 bg-slate-dark/80 text-fog font-mono leading-none">
      {children}
    </kbd>
  )
}
