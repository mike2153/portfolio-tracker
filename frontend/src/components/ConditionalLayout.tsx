'use client'

import { useAuth } from './AuthProvider'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { Home, Briefcase, Plus, Search, PlusCircle, Star, Menu, X, Settings, ChevronDown, DollarSign } from 'lucide-react'
import Image from 'next/image'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { user, signOut, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [addDropdownOpen, setAddDropdownOpen] = useState(false)
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false)
  const addDropdownRef = useRef<HTMLDivElement>(null)
  const settingsDropdownRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setAddDropdownOpen(false)
      }
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setSettingsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  // For auth page and home page, show simple layout without navigation
  if (pathname === '/auth' || pathname === '/') {
    return <div className="min-h-screen">{children}</div>
  }

  // Navigation items - Analytics removed and consolidated into Portfolio
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/portfolio', icon: Briefcase, label: 'Portfolio' },
    { href: '/watchlist', icon: Star, label: 'Watchlist' },
    { href: '/research', icon: Search, label: 'Research' },
  ]

  // For authenticated users, show full app layout with top navigation
  if (user) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-50 w-full backdrop-blur-xl" style={{ 
          borderBottom: '1px solid var(--color-divider)', 
          background: 'var(--frost-bg)' 
        }}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-24 items-center justify-between">
              {/* Left section - Logo */}
              <div className="flex items-center">
                <Link href="/dashboard" className="flex items-center">
                  <Image 
                    src="/logo.png" 
                    alt="Portfolio Tracker Logo" 
                    width={500} 
                    height={100} 
                    className="h-24 w-auto object-contain"
                  />
                </Link>
              </div>

              {/* Center section - Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-2xl transition-all duration-300 ${
                        isActive
                          ? 'text-white'
                          : 'hover:text-white'
                      }`}
                      style={{
                        background: isActive ? 'var(--color-btn-bg)' : 'transparent',
                        color: isActive ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                        boxShadow: isActive ? '0 4px 16px rgba(0, 0, 0, 0.3)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--color-bg-surface)';
                          e.currentTarget.style.color = 'var(--color-text-main)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text-muted)';
                        }
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              {/* Right section - Search, Add button, User */}
              <div className="flex items-center gap-4">
                {/* Add dropdown */}
                <div className="relative" ref={addDropdownRef}>
                  <button 
                    onClick={() => setAddDropdownOpen(!addDropdownOpen)}
                    className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all duration-300"
                    style={{
                      background: 'var(--color-accent-purple)',
                      color: 'white',
                      boxShadow: '0 4px 16px rgba(178, 165, 255, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(178, 165, 255, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(178, 165, 255, 0.3)';
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  
                  {addDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl backdrop-blur-xl shadow-2xl z-50" style={{
                      background: 'var(--frost-bg)',
                      border: '1px solid var(--color-divider)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                    }}>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            router.push('/portfolio?tab=transactions&add=true')
                            setAddDropdownOpen(false)
                          }}
                          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300"
                          style={{ color: 'var(--color-text-muted)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-bg-surface)';
                            e.currentTarget.style.color = 'var(--color-text-main)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                          }}
                        >
                          <PlusCircle className="h-4 w-4" />
                          Add Transaction
                        </button>
                        <button
                          onClick={() => {
                            router.push('/portfolio?tab=transactions&add=true&type=dividend')
                            setAddDropdownOpen(false)
                          }}
                          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300"
                          style={{ color: 'var(--color-text-muted)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-bg-surface)';
                            e.currentTarget.style.color = 'var(--color-text-main)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                          }}
                        >
                          <DollarSign className="h-4 w-4" />
                          Add Dividend
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Settings dropdown */}
                <div className="relative" ref={settingsDropdownRef}>
                  <button
                    onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                    className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800/50"
                  >
                    <Settings className="h-5 w-5" />
                  </button>

                  {settingsDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl backdrop-blur-xl shadow-2xl z-50" style={{
                      background: 'var(--frost-bg)',
                      border: '1px solid var(--color-divider)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                    }}>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            router.push('/settings/profile')
                            setSettingsDropdownOpen(false)
                          }}
                          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300"
                          style={{ color: 'var(--color-text-muted)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-bg-surface)';
                            e.currentTarget.style.color = 'var(--color-text-main)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                          }}
                        >
                          Profile Settings
                        </button>
                        <button
                          onClick={() => {
                            router.push('/settings/account')
                            setSettingsDropdownOpen(false)
                          }}
                          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300"
                          style={{ color: 'var(--color-text-muted)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-bg-surface)';
                            e.currentTarget.style.color = 'var(--color-text-main)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                          }}
                        >
                          Account Settings
                        </button>
                        <div className="border-t border-gray-700 my-1"></div>
                        <button
                          onClick={async () => {
                            setSettingsDropdownOpen(false)
                            await signOut()
                          }}
                          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300"
                          style={{ color: 'var(--color-text-muted)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-bg-surface)';
                            e.currentTarget.style.color = 'var(--color-text-main)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                          }}
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* User profile */}
                <div className="hidden md:flex items-center gap-3 border-l border-gray-700 pl-4">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">{user.email}</span>
                  </div>
                </div>

                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden rounded-md p-2 text-gray-400 hover:text-white hover:bg-gray-800/50"
                >
                  {mobileMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-700">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 text-base font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
              <div className="border-t border-gray-700 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white text-base font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{user.email}</p>
                    <button 
                      onClick={signOut}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    )
  }

  // For unauthenticated users on protected routes
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-4">Authentication Required</h2>
        <p className="text-gray-400 mb-6">Please sign in to access this page.</p>
        <Link 
          href="/auth" 
          className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  )
}