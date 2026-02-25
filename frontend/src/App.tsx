import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-base">
        <Sidebar />
        <main className="flex-1 min-w-0 pt-14 md:pt-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}
