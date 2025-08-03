import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Portfolio Tracker - Investment Portfolio Management & Analytics',
    short_name: 'Portfolio Tracker',
    description: 'Advanced portfolio tracking software with real-time analytics, performance metrics, and risk assessment tools for investment management.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#1E3A8A',
    orientation: 'portrait-primary',
    categories: ['finance', 'business', 'productivity'],
    lang: 'en-US',
    dir: 'ltr',
    scope: '/',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-512x512.png', 
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512', 
        type: 'image/png',
        purpose: 'any'
      }
    ],
    screenshots: [
      {
        src: '/screenshots/desktop-dashboard.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Portfolio Dashboard - Desktop View'
      },
      {
        src: '/screenshots/mobile-portfolio.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Portfolio View - Mobile'
      }
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'View your portfolio dashboard',
        url: '/dashboard',
        icons: [
          {
            src: '/shortcuts/dashboard.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      },
      {
        name: 'Portfolio',
        short_name: 'Portfolio', 
        description: 'Manage your portfolio holdings',
        url: '/portfolio',
        icons: [
          {
            src: '/shortcuts/portfolio.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      },
      {
        name: 'Analytics',
        short_name: 'Analytics',
        description: 'View detailed portfolio analytics',
        url: '/analytics',
        icons: [
          {
            src: '/shortcuts/analytics.png',
            sizes: '192x192', 
            type: 'image/png'
          }
        ]
      }
    ],
    related_applications: [
      {
        platform: 'play',
        url: 'https://play.google.com/store/apps/details?id=com.portfoliotracker.app',
        id: 'com.portfoliotracker.app'
      },
      {
        platform: 'itunes',
        url: 'https://apps.apple.com/app/portfolio-tracker/id123456789'
      }
    ],
    prefer_related_applications: false,
    display_override: ['standalone', 'minimal-ui', 'browser']
  }
}