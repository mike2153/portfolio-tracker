import './globals.css'
import { Inter } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import { Providers } from '@/components/Providers'
import { AuthProvider } from '@/components/AuthProvider'
import { patchConsole } from '@/lib/debug'
import ConditionalLayout from '@/components/ConditionalLayout'

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
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
            </ToastProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
} 