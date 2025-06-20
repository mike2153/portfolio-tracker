import './globals.css'
import { Inter } from 'next/font/google'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'FinTech MVP - Financial Analytics Platform',
  description: 'A premium financial analytics platform for investment portfolio management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center">
                  <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600">
                    FinTech MVP
                  </Link>
                </div>
                <nav className="flex space-x-4">
                  <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md">
                    Dashboard
                  </Link>
                  <Link href="/portfolio" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md">
                    Portfolio
                  </Link>
                  <Link href="/analytics" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md">
                    Analytics
                  </Link>
                  <Link href="/dividends" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md">
                    Dividends
                  </Link>
                  <Link href="/auth" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Sign In
                  </Link>
                </nav>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
} 