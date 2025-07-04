'use client'

import { useAuth } from './AuthProvider'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import SidebarLink from './SidebarLink'
import { Home, BarChart2, Briefcase, Wrench, Users, Plus, Search, PlusCircle } from 'lucide-react'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { user } = useAuth()
  const pathname = usePathname()

  console.log('[ConditionalLayout] 🔍 Rendering decision check:')
  console.log('[ConditionalLayout] - User present:', !!user)
  console.log('[ConditionalLayout] - User email:', user?.email)
  console.log('[ConditionalLayout] - Current pathname:', pathname)
  console.log('[ConditionalLayout] - Is auth page:', pathname === '/auth')

  // For auth page, show simple layout without sidebar
  if (pathname === '/auth') {
    console.log('[ConditionalLayout] ✅ Rendering auth layout (no sidebar)')
    return <div className="min-h-screen">{children}</div>
  }

  // For authenticated users, show full app layout with sidebar
  if (user) {
    console.log('[ConditionalLayout] ✅ Rendering authenticated layout (with sidebar)')
    return (
      <div className="flex h-screen">
        {/* Sidebar Navigation */}
        <aside className="w-64 flex-shrink-0 bg-gray-800 p-6 flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-10">FinSoft</h1>
            <nav className="space-y-2">
              <SidebarLink href="/dashboard" icon={<Home className="h-5 w-5" />}>Dashboard</SidebarLink>
              <SidebarLink href="/analytics" icon={<BarChart2 className="h-5 w-5" />}>Analytics</SidebarLink>
              <SidebarLink href="/portfolio" icon={<Briefcase className="h-5 w-5" />}>Portfolio</SidebarLink>
              <SidebarLink href="/transactions" icon={<PlusCircle className="h-5 w-5" />}>Transactions</SidebarLink>
              <SidebarLink href="/research" icon={<Search className="h-5 w-5" />}>Research</SidebarLink>
              <SidebarLink href="/tools" icon={<Wrench className="h-5 w-5" />}>Tools</SidebarLink>
              <SidebarLink href="/community" icon={<Users className="h-5 w-5" />}>Community</SidebarLink>
            </nav>
          </div>
          {/* User profile section */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.email}</p>
                <p className="text-xs text-gray-400">Authenticated</p>
              </div>
            </div>
            <button 
              onClick={() => {
                console.log('[ConditionalLayout] 🚪 User clicking sign out')
                // We'll add sign out functionality here
              }}
              className="mt-3 w-full text-left text-sm text-gray-400 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-700 bg-gray-800/50 px-6 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700">
                <Search className="h-4 w-4" />
                <span>Search...</span>
                <span className="ml-4 text-xs">⌘K</span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
              <span className="text-sm text-gray-400">Welcome, {user.email}</span>
            </div>
          </header>
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    )
  }

  // For unauthenticated users on protected routes, show loading or redirect message
  console.log('[ConditionalLayout] ⏳ Unauthenticated user on protected route, showing redirect message')
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-4">Authentication Required</h2>
        <p className="text-gray-400 mb-6">Please sign in to access this page.</p>
        <Link 
          href="/auth" 
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  )
}