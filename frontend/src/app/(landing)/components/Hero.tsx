'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useABTest } from '../lib/ab-testing'
import { useAnalytics } from '../lib/analytics'

export const Hero = () => {
  const [isVisible, setIsVisible] = useState(false)
  const { variant: headlineVariant, variantId: headlineVariantId } = useABTest('landing_hero_headline')
  const { variant: ctaVariant, variantId: ctaVariantId } = useABTest('cta_button_text')
  const analytics = useAnalytics()
  
  useEffect(() => {
    setIsVisible(true)
    
    // Track A/B test exposure
    if (headlineVariantId !== 'control') {
      analytics.trackABTest({
        test_id: 'landing_hero_headline',
        variant: headlineVariantId,
        event_type: 'view'
      })
    }
    
    if (ctaVariantId !== 'start_free_trial') {
      analytics.trackABTest({
        test_id: 'cta_button_text',
        variant: ctaVariantId,
        event_type: 'view'
      })
    }
  }, [headlineVariantId, ctaVariantId, analytics])

  const handleCTAClick = () => {
    analytics.trackConversion({
      action: 'cta_click',
      category: 'landing_page',
      label: 'hero_cta',
      custom_parameters: {
        cta_variant: ctaVariantId,
        headline_variant: headlineVariantId
      }
    })
  }

  const handleSecondaryClick = () => {
    analytics.trackInteraction('secondary_cta', 'click', 'see_how_it_works')
  }

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#1E3A8A]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-[#F59E0B]/10 rounded-full blur-2xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left Column - Content */}
          <div className={`space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            
            {/* Trust Badge */}
            <div className="inline-flex items-center space-x-2 bg-[#1E3A8A]/20 border border-[#1E3A8A]/30 rounded-full px-4 py-2">
              <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-300">Trusted by 10,000+ investors</span>
            </div>

            {/* Main Headline - A/B Testing Optimized */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
              <span className="text-white">
                {headlineVariant.headline?.split(' ').slice(0, -2).join(' ') || 'Stop Guessing About Your'}
              </span>{' '}
              <span className="bg-gradient-to-r from-[#10B981] to-[#059669] bg-clip-text text-transparent">
                {headlineVariant.headline?.split(' ').slice(-2).join(' ') || 'Portfolio Performance'}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-2xl">
              {headlineVariant.subheadline || 'Get real-time insights, track gains/losses, and make confident investment decisions with professional-grade analytics you can trust.'}
            </p>

            {/* Value Props - Quick wins */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center space-x-2 text-gray-300">
                <div className="w-4 h-4 bg-[#10B981] rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                </div>
                <span>Bank-level security</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <div className="w-4 h-4 bg-[#10B981] rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                </div>
                <span>2-minute setup</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <div className="w-4 h-4 bg-[#10B981] rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                </div>
                <span>No credit card required</span>
              </div>
            </div>

            {/* Enhanced CTA Buttons with Micro-interactions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                href="/auth"
                onClick={handleCTAClick}
                className="
                  inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white
                  bg-gradient-to-r from-[#1E3A8A] to-[#1D4ED8]
                  rounded-xl shadow-lg shadow-blue-500/25
                  border border-[#1E3A8A]/50
                  btn-micro hover-lift group
                  relative overflow-hidden
                "
              >
                {/* Animated background effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                
                {/* Button content */}
                <span className="relative z-10 flex items-center">
                  {ctaVariant.ctaText || 'Start Free Trial'}
                  <svg className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>

                {/* Shimmer effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                </div>
              </Link>
              
              <Link
                href="#features"
                onClick={handleSecondaryClick}
                className="
                  inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-medium text-gray-300
                  glass-effect hover:glass-morphism
                  rounded-xl hover:text-white
                  btn-micro group
                  relative overflow-hidden
                "
              >
                {/* Hover background */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#334155]/50 to-[#475569]/50 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></div>
                
                {/* Button content */}
                <span className="relative z-10 flex items-center">
                  See How It Works
                  <svg className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4M9 10V9a2 2 0 012-2h2a2 2 0 012 2v1" />
                  </svg>
                </span>
              </Link>
            </div>

            {/* Risk Reversal */}
            <p className="text-sm text-gray-400">
              ✓ 14-day free trial • ✓ Cancel anytime • ✓ Setup in under 5 minutes
            </p>
          </div>

          {/* Right Column - Enhanced 3D Dashboard Preview */}
          <div className={`relative transition-all duration-1000 delay-300 order-first lg:order-last mt-8 lg:mt-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="relative perspective-1000">
              {/* Enhanced 3D Floating Animation Container */}
              <div className="animate-float-3d hover-3d">
                {/* Main Dashboard Card with enhanced effects */}
                <div className="
                  glass-morphism hover-tilt animate-glow-pulse
                  rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl
                  transform-gpu will-change-transform
                ">
                  {/* Portfolio Overview with enhanced animations */}
                  <div className="mb-6">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 gradient-text-green">Portfolio Overview</h3>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="glass-effect rounded-lg p-2 sm:p-3 lg:p-4 hover-lift animate-slide-in-bottom">
                        <div className="text-xs sm:text-sm text-gray-400">Total Value</div>
                        <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#10B981] animate-shimmer">$284,592</div>
                        <div className="text-xs sm:text-sm text-[#10B981] flex items-center">
                          +12.5% 
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      </div>
                      <div className="glass-effect rounded-lg p-2 sm:p-3 lg:p-4 hover-lift animate-slide-in-bottom" style={{animationDelay: '0.1s'}}>
                        <div className="text-xs sm:text-sm text-gray-400">Today&apos;s Change</div>
                        <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#10B981] animate-shimmer">+$3,247</div>
                        <div className="text-xs sm:text-sm text-[#10B981] flex items-center">
                          +1.16% 
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 animate-bounce" style={{animationDelay: '0.2s'}} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Performance Metrics */}
                  <div className="space-y-3">
                    {[
                      { label: 'Sharpe Ratio', value: '1.24', positive: true },
                      { label: 'Beta', value: '0.85', positive: true },
                      { label: 'Max Drawdown', value: '-8.2%', positive: false }
                    ].map((metric, index) => (
                      <div key={metric.label} className="flex justify-between items-center hover-lift" style={{animationDelay: `${index * 0.1}s`}}>
                        <span className="text-sm text-gray-400">{metric.label}</span>
                        <span className={`font-medium ${metric.positive ? 'text-white' : 'text-[#EF4444]'}`}>
                          {metric.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Enhanced Animated Chart */}
                  <div className="mt-6 h-24 glass-effect rounded-lg flex items-end justify-around p-2 overflow-hidden relative">
                    {/* Background grid */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="h-full grid grid-rows-4 border-r border-gray-600/30">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="border-b border-gray-600/30"></div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Animated data bars */}
                    {[40, 65, 45, 80, 55, 90, 70, 85].map((height, i) => (
                      <div 
                        key={i} 
                        className="relative z-10 animate-data-stream rounded-sm bg-gradient-to-t from-[#10B981] to-[#34D399]"
                        style={{ 
                          height: `${height}%`, 
                          width: '10px',
                          animationDelay: `${i * 200}ms`,
                          boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                        }}
                      />
                    ))}
                    
                    {/* Flowing data line overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 50">
                      <path
                        d="M5,40 Q20,25 35,30 T65,20 T95,35"
                        stroke="url(#lineGradient)"
                        strokeWidth="2"
                        fill="none"
                        className="animate-pulse"
                      />
                      <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" style={{stopColor: '#10B981', stopOpacity: 0.8}} />
                          <stop offset="50%" style={{stopColor: '#34D399', stopOpacity: 1}} />
                          <stop offset="100%" style={{stopColor: '#10B981', stopOpacity: 0.8}} />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Enhanced Floating Status Cards */}
              <div className="absolute -top-6 -right-6 animate-float-delayed hover-3d">
                <div className="glass-morphism rounded-lg p-3 hover-lift">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
                    <div>
                      <div className="text-xs text-gray-400">Real-time Updates</div>
                      <div className="text-sm text-[#10B981] font-semibold">Live Data</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="absolute -bottom-6 -left-6 animate-float-delayed-2 hover-3d">
                <div className="glass-morphism rounded-lg p-3 hover-lift">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-[#1E3A8A] rounded flex items-center justify-center">
                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Security</div>
                      <div className="text-sm text-blue-400 font-semibold">256-bit SSL</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional floating analytics cards */}
              <div className="absolute top-1/2 -left-8 animate-float hover-3d" style={{animationDelay: '1s'}}>
                <div className="glass-morphism rounded-lg p-2 hover-lift">
                  <div className="text-xs text-gray-400">Performance</div>
                  <div className="text-sm text-yellow-400 font-semibold">+18.2%</div>
                </div>
              </div>

              <div className="absolute top-1/3 -right-8 animate-float-delayed hover-3d" style={{animationDelay: '2s'}}>
                <div className="glass-morphism rounded-lg p-2 hover-lift">
                  <div className="text-xs text-gray-400">Risk Score</div>
                  <div className="text-sm text-emerald-400 font-semibold">Low</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  )
}