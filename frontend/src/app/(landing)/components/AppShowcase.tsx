'use client'

import { useState, useEffect } from 'react'
import { ProgressiveImage } from './ProgressiveImage'

interface Screenshot {
  id: string
  title: string
  description: string
  src: string
  placeholderSrc: string
  category: 'dashboard' | 'analytics' | 'mobile' | 'reports'
}

// Mock screenshot data - in a real app, these would be actual screenshots
const screenshots: Screenshot[] = [
  {
    id: 'dashboard-overview',
    title: 'Portfolio Dashboard',
    description: 'Real-time portfolio performance with professional metrics',
    src: '/images/dashboard-overview.png', // These would be real screenshots
    placeholderSrc: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxRTI5M0IiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzMzNDE1NSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFFMjkzQiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+',
    category: 'dashboard'
  },
  {
    id: 'analytics-deep-dive',
    title: 'Advanced Analytics',
    description: 'Institutional-grade risk metrics and performance analysis',
    src: '/images/analytics-view.png',
    placeholderSrc: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxRTI5M0IiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzMzNDE1NSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFFMjkzQiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+',
    category: 'analytics'
  },
  {
    id: 'mobile-app',
    title: 'Mobile Experience',
    description: 'Full portfolio access on your phone with real-time sync',
    src: '/images/mobile-app.png',
    placeholderSrc: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxRTI5M0IiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzMzNDE1NSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFFMjkzQiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNjAwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+',
    category: 'mobile'
  },
  {
    id: 'tax-reports',
    title: 'Tax & Reporting',
    description: 'Comprehensive reports ready for tax season and advisors',
    src: '/images/tax-reports.png',
    placeholderSrc: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxRTI5M0IiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzMzNDE1NSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFFMjkzQiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+',
    category: 'reports'
  }
]

const categories = [
  { id: 'all', label: 'All Views', icon: '📱' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'mobile', label: 'Mobile', icon: '📱' },
  { id: 'reports', label: 'Reports', icon: '📋' }
]

export const AppShowcase = () => {
  const [activeCategory, setActiveCategory] = useState('all')
  const [visibleScreenshots, setVisibleScreenshots] = useState<Set<string>>(new Set())

  const filteredScreenshots = activeCategory === 'all' 
    ? screenshots 
    : screenshots.filter(screenshot => screenshot.category === activeCategory)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-screenshot-id')
            if (id) {
              setVisibleScreenshots(prev => new Set([...prev, id]))
            }
          }
        })
      },
      { threshold: 0.2 }
    )

    document.querySelectorAll('[data-screenshot-id]').forEach((el) => {
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [activeCategory])

  return (
    <section className="py-24 bg-gradient-to-b from-[#1E293B] to-[#0F172A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-[#10B981]/20 border border-[#10B981]/30 rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-[#10B981] font-medium">See It In Action</span>
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Professional Portfolio Management{' '}
            <span className="bg-gradient-to-r from-[#10B981] to-[#059669] bg-clip-text text-transparent">
              Made Simple
            </span>
          </h2>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Experience the power of institutional-grade analytics in an intuitive, 
            beautifully designed interface that works on every device.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center bg-[#1E293B]/50 border border-[#334155]/50 rounded-xl p-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`
                  inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200 btn-micro
                  ${activeCategory === category.id
                    ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/25'
                    : 'text-gray-400 hover:text-white hover:bg-[#334155]/50'
                  }
                `}
              >
                <span>{category.icon}</span>
                <span>{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Screenshots Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {filteredScreenshots.map((screenshot, index) => (
            <div
              key={screenshot.id}
              data-screenshot-id={screenshot.id}
              className={`
                group relative transition-all duration-700 transform
                ${visibleScreenshots.has(screenshot.id)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-10'
                }
                ${screenshot.category === 'mobile' ? 'md:col-span-1 max-w-sm mx-auto' : ''}
              `}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Screenshot Container */}
              <div className="relative overflow-hidden rounded-2xl glass-morphism border border-[#334155]/50 
                            group-hover:border-[#10B981]/30 group-hover:shadow-xl group-hover:shadow-[#10B981]/20
                            transition-all duration-300 hover-3d">
                
                {/* Progressive Image */}
                <ProgressiveImage
                  src={screenshot.src}
                  placeholderSrc={screenshot.placeholderSrc}
                  alt={screenshot.title}
                  className="w-full h-64 md:h-80"
                  priority={index < 2} // Load first two images immediately
                />

                {/* Content Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 via-transparent to-transparent
                               opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-lg font-semibold text-white mb-2 transform translate-y-4 
                                  group-hover:translate-y-0 transition-transform duration-300">
                      {screenshot.title}
                    </h3>
                    <p className="text-sm text-gray-300 transform translate-y-4 group-hover:translate-y-0 
                                 transition-transform duration-300 delay-75">
                      {screenshot.description}
                    </p>
                  </div>
                </div>

                {/* Category Badge */}
                <div className="absolute top-4 left-4 bg-[#10B981]/20 backdrop-blur-sm border border-[#10B981]/30 
                               rounded-full px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-xs text-[#10B981] font-medium capitalize">
                    {screenshot.category}
                  </span>
                </div>

                {/* Interactive Corner */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#10B981]/20 to-transparent 
                               opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-bl-full">
                  <div className="absolute top-2 right-2 w-2 h-2 bg-[#10B981] rounded-full animate-ping"></div>
                </div>
              </div>

              {/* Description Card */}
              <div className="mt-6 p-4 rounded-xl glass-effect">
                <h3 className="text-lg font-semibold text-white mb-2">{screenshot.title}</h3>
                <p className="text-sm text-gray-400">{screenshot.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="inline-flex flex-col items-center space-y-4">
            <p className="text-gray-400">
              Ready to experience professional portfolio management?
            </p>
            <a 
              href="#pricing" 
              className="
                inline-flex items-center px-8 py-4 text-lg font-semibold text-white
                bg-gradient-to-r from-[#1E3A8A] to-[#1D4ED8]
                rounded-xl shadow-lg shadow-blue-500/25
                btn-micro hover-lift group
                relative overflow-hidden
              "
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] 
                             transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              
              {/* Button content */}
              <span className="relative z-10 flex items-center">
                Try It Free Today
                <svg className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" 
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>

              {/* Shimmer effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}