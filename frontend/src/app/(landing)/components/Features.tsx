'use client'

import { useState, useRef, useEffect } from 'react'

interface Feature {
  icon: string
  title: string
  description: string
  benefits: string[]
  stats?: string
}

const features: Feature[] = [
  {
    icon: "📊",
    title: "Real-time Portfolio Analytics",
    description: "Live portfolio performance tracking with institutional-grade metrics and instant updates.",
    benefits: [
      "Track across multiple brokers in one place",
      "Professional metrics (Sharpe, Alpha, Beta)",
      "Real-time profit/loss calculations"
    ],
    stats: "Updates every 15 seconds"
  },
  {
    icon: "🛡️",
    title: "Bank-Level Security",
    description: "Your financial data is protected with the same security used by major banks.",
    benefits: [
      "256-bit SSL encryption",
      "SOC 2 Type II compliance",
      "Never store banking passwords"
    ],
    stats: "Zero security incidents"
  },
  {
    icon: "📈",
    title: "Advanced Risk Assessment",
    description: "Comprehensive portfolio risk analysis with personalized recommendations.",
    benefits: [
      "Portfolio diversification analysis",
      "Risk-adjusted return calculations", 
      "Asset allocation recommendations"
    ],
    stats: "15+ risk metrics"
  },
  {
    icon: "⚡",
    title: "Instant Setup",
    description: "Connect your investment accounts securely in under 2 minutes.",
    benefits: [
      "Connect 12,000+ financial institutions",
      "Automatic transaction import",
      "One-click portfolio sync"
    ],
    stats: "2-minute average setup"
  },
  {
    icon: "📱",
    title: "Multi-Platform Access",
    description: "Access your portfolio anywhere with our responsive web and mobile apps.",
    benefits: [
      "Real-time sync across devices",
      "Offline data access",
      "Push notifications for alerts"
    ],
    stats: "99.9% uptime"
  },
  {
    icon: "📋",
    title: "Tax-Ready Reports",
    description: "Generate detailed reports for tax season and investment analysis.",
    benefits: [
      "Tax-loss harvesting insights",
      "Downloadable CSV/PDF reports",
      "Historical performance analysis"
    ],
    stats: "One-click exports"
  }
]

export const Features = () => {
  const [_activeFeature, setActiveFeature] = useState(0)
  const [visibleFeatures, setVisibleFeatures] = useState<Set<number>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0')
            setVisibleFeatures(prev => new Set([...prev, index]))
          }
        })
      },
      { threshold: 0.3 }
    )

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  const attachObserver = (element: HTMLDivElement | null, index: number) => {
    if (element && observerRef.current) {
      element.setAttribute('data-index', index.toString())
      observerRef.current.observe(element)
    }
  }

  return (
    <section id="features" className="py-24 bg-gradient-to-b from-[#0F172A] to-[#1E293B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-[#1E3A8A]/20 border border-[#1E3A8A]/30 rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-[#10B981] font-medium">Why Portfolio Tracker?</span>
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-[#10B981] to-[#059669] bg-clip-text text-transparent">
              Master Your Investments
            </span>
          </h2>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Professional-grade tools that were once only available to fund managers, 
            now accessible to individual investors.
          </p>
        </div>

        {/* Enhanced Features Grid with Advanced Micro-interactions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              ref={(el) => attachObserver(el, index)}
              className={`
                relative group cursor-pointer
                transition-all duration-700 transform
                ${visibleFeatures.has(index) 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-10'
                }
              `}
              style={{ transitionDelay: `${index * 100}ms` }}
              onMouseEnter={() => setActiveFeature(index)}
            >
              {/* Enhanced Feature Card with 3D Effects */}
              <div className="
                h-full p-8 rounded-2xl border border-[#334155]/50
                glass-morphism hover-3d btn-micro
                group-hover:border-[#10B981]/30 group-hover:shadow-xl group-hover:shadow-[#10B981]/20
                transition-all duration-300
                relative overflow-hidden
              ">
                
                {/* Animated background on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 via-transparent to-[#1E3A8A]/5 
                               opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Enhanced Icon with floating effect */}
                <div className="relative z-10 text-4xl mb-6 group-hover:animate-float transition-all duration-300 
                               transform group-hover:scale-110 group-hover:rotate-6">
                  <div className="relative">
                    {feature.icon}
                    {/* Icon glow effect */}
                    <div className="absolute inset-0 bg-[#10B981]/20 rounded-full blur-xl opacity-0 
                                    group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
                  </div>
                </div>

                {/* Enhanced Title with shimmer effect */}
                <h3 className="relative z-10 text-xl font-semibold text-white mb-4 
                               group-hover:text-[#10B981] transition-colors duration-300
                               overflow-hidden">
                  <span className="relative">
                    {feature.title}
                    {/* Shimmer overlay on hover */}
                    <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent
                                    translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                  </span>
                </h3>

                {/* Enhanced Description */}
                <p className="relative z-10 text-gray-300 mb-6 leading-relaxed 
                               group-hover:text-gray-200 transition-colors duration-300">
                  {feature.description}
                </p>

                {/* Enhanced Benefits List with staggered animations */}
                <ul className="relative z-10 space-y-3 mb-6">
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <li 
                      key={benefitIndex} 
                      className="flex items-start space-x-3 transition-all duration-300 
                                 group-hover:translate-x-2"
                      style={{ transitionDelay: `${benefitIndex * 50}ms` }}
                    >
                      <div className="w-4 h-4 bg-[#10B981]/20 rounded-full flex items-center justify-center 
                                      mt-0.5 flex-shrink-0 group-hover:bg-[#10B981]/40 transition-colors duration-300">
                        <div className="w-2 h-2 bg-[#10B981] rounded-full group-hover:animate-pulse"></div>
                      </div>
                      <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Enhanced Stats Badge */}
                {feature.stats && (
                  <div className="relative z-10 inline-flex items-center space-x-2 
                                  bg-[#10B981]/10 border border-[#10B981]/20 rounded-full px-3 py-1
                                  group-hover:bg-[#10B981]/20 group-hover:border-[#10B981]/40
                                  group-hover:shadow-lg group-hover:shadow-[#10B981]/25
                                  transition-all duration-300">
                    <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse 
                                    group-hover:animate-bounce"></div>
                    <span className="text-xs text-[#10B981] font-medium group-hover:text-[#34D399] 
                                     transition-colors duration-300">
                      {feature.stats}
                    </span>
                  </div>
                )}

                {/* Interactive corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#10B981]/10 to-transparent 
                               opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-bl-full"></div>
                
                {/* Floating particles effect */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i}
                      className="absolute w-1 h-1 bg-[#10B981] rounded-full opacity-0 
                                 group-hover:opacity-100 group-hover:animate-float"
                      style={{
                        left: `${20 + i * 30}%`,
                        top: `${30 + i * 20}%`,
                        animationDelay: `${i * 0.5}s`,
                        animationDuration: '3s'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Enhanced Bottom CTA Section */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center space-x-4 group">
            <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
              Ready to get started?
            </div>
            <a 
              href="#pricing" 
              className="
                inline-flex items-center px-6 py-3 text-sm font-semibold text-white
                bg-gradient-to-r from-[#1E3A8A] to-[#1D4ED8]
                rounded-lg shadow-lg shadow-blue-500/25
                btn-micro hover-lift group
                relative overflow-hidden
              "
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] 
                             transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              
              {/* Button content */}
              <span className="relative z-10 flex items-center">
                See Pricing
                <svg className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:translate-x-1" 
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