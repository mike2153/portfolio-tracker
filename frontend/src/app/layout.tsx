import './globals.css'
import { Inter } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import { Providers } from '@/components/Providers'
import { AuthProvider } from '@/components/AuthProvider'
import { patchConsole } from '@/lib/debug'
import ConditionalLayout from '@/components/ConditionalLayout'
import type { Metadata, Viewport } from 'next'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter'
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://portfoliotracker.com'),
  title: {
    template: '%s | Portfolio Tracker - Investment Portfolio Management',
    default: 'Portfolio Tracker - Investment Portfolio Management & Analytics',
  },
  description: 'Advanced portfolio tracking software with real-time analytics, performance metrics, and risk assessment. Track stocks, ETFs, and investments with professional-grade tools.',
  keywords: [
    'portfolio tracker',
    'investment tracking',
    'portfolio management',
    'stock portfolio',
    'investment analytics',
    'portfolio performance',
    'asset allocation',
    'investment dashboard',
    'financial analytics',
    'portfolio optimization',
    'risk assessment',
    'portfolio rebalancing'
  ],
  authors: [{ name: 'Portfolio Tracker Team' }],
  creator: 'Portfolio Tracker',
  publisher: 'Portfolio Tracker',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Portfolio Tracker',
    title: 'Portfolio Tracker - Investment Portfolio Management & Analytics',
    description: 'Advanced portfolio tracking software with real-time analytics, performance metrics, and risk assessment tools for investment management.',
    images: [
      {
        url: '/images/og-landing-page.jpg',
        width: 1200,
        height: 630,
        alt: 'Portfolio Tracker - Professional Investment Analytics Dashboard',
        type: 'image/jpeg',
      },
      {
        url: '/images/og-dashboard-preview.jpg',
        width: 1200,
        height: 630,
        alt: 'Portfolio Tracker Dashboard Preview - Real-time Analytics',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@portfoliotracker',
    creator: '@portfoliotracker',
    title: 'Portfolio Tracker - Investment Portfolio Management & Analytics',
    description: 'Advanced portfolio tracking with real-time analytics, performance metrics, and professional-grade tools for smart investors.',
    images: ['/images/twitter-card-landing.jpg'],
  },
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
  },
  category: 'finance',
  classification: 'Financial Technology',
  referrer: 'origin-when-cross-origin',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
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
      <body className={`${inter.className} text-gray-200`}>
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