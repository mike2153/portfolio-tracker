import './globals.css'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import SidebarLink from '@/components/SidebarLink'
import { ToastProvider } from '@/components/ui/Toast'
import { Providers } from '@/components/Providers'
import { AuthProvider } from '@/components/AuthProvider'
import { Home, BarChart2, Briefcase, Wrench, Users, Plus, Search, PlusCircle } from 'lucide-react'
import { patchConsole } from '@/lib/debug'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'FinSoft Portfolio-Tracker',
  description: 'A premium financial analytics platform for investment portfolio management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Disable verbose console output in production unless explicitly enabled
  patchConsole();

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-900 text-gray-200`}>
        <Providers>
          <AuthProvider>
            <ToastProvider>
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
                {/* User profile section can go here */}
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
                    <Link href="/auth" className="flex items-center gap-2 rounded-md border border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-700">
                      <span>Sign Up</span>
                    </Link>
                    {/* Currency switcher and user avatar can go here */}
                  </div>
                </header>
                <main className="p-6">
                  {children}
                </main>
              </div>
            </div>
          </ToastProvider>
        </AuthProvider>
        </Providers>
      </body>
    </html>
  )
} 