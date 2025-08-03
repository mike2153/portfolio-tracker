'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

export const FinalCTA = () => {
  const [userCount, setUserCount] = useState(10247)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    
    // Simulate real-time user count updates
    const interval = setInterval(() => {
      setUserCount(prev => prev + Math.floor(Math.random() * 2))
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-24 bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#10B981]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main CTA Content */}
        <div className={`
          text-center transition-all duration-1000 transform
          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
        `}>
          
          {/* Urgency Element */}
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 mb-8">
            <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
            <span className="text-sm text-white/90">
              {userCount.toLocaleString()} investors have joined this month
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Ready to Take Control of Your{' '}
            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Financial Future?
            </span>
          </h2>

          {/* Subheadline */}
          <p className="text-xl text-white/80 mb-8 leading-relaxed max-w-2xl mx-auto">
            Join thousands of smart investors who&apos;ve transformed their portfolio management 
            with professional-grade analytics.
          </p>

          {/* Value Props */}
          <div className="flex flex-wrap justify-center gap-6 mb-12 text-white/90">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Free 14-day trial</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">No credit card required</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Setup in 2 minutes</span>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="space-y-4">
            <Link
              href="/auth"
              className="
                inline-flex items-center px-12 py-4 text-lg font-bold text-[#0F172A]
                bg-white rounded-xl shadow-2xl
                hover:scale-105 hover:shadow-3xl
                transition-all duration-300
                group
              "
            >
              Start Your Free Trial Now
              <svg className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>

            {/* Alternative CTA */}
            <div className="text-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center text-white/80 hover:text-white text-sm font-medium transition-colors"
              >
                or explore the live demo first
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4M9 10V9a2 2 0 012-2h2a2 2 0 012 2v1" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Risk Reversal */}
          <div className="mt-8 text-sm text-white/70">
            Start free, upgrade only when you&apos;re ready. Cancel anytime with just one click.
          </div>
        </div>

        {/* Trust Indicators */}
        <div className={`
          mt-16 transition-all duration-1000 delay-300 transform
          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
        `}>
          <div className="text-center mb-8">
            <div className="text-sm text-white/60 mb-4">Trusted by investors at</div>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              {/* Placeholder for company logos */}
              <div className="px-6 py-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
                <span className="text-white/80 font-semibold text-sm">Vanguard</span>
              </div>
              <div className="px-6 py-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
                <span className="text-white/80 font-semibold text-sm">Fidelity</span>
              </div>
              <div className="px-6 py-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
                <span className="text-white/80 font-semibold text-sm">Schwab</span>
              </div>
              <div className="px-6 py-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
                <span className="text-white/80 font-semibold text-sm">E*TRADE</span>
              </div>
            </div>
          </div>

          {/* Final Security Badge */}
          <div className="text-center">
            <div className="inline-flex items-center space-x-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg px-6 py-3">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-white/80">Bank-level Security</span>
              </div>
              
              <div className="w-px h-6 bg-white/20"></div>
              
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-white/80">SOC 2 Certified</span>
              </div>
              
              <div className="w-px h-6 bg-white/20"></div>
              
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-white/80">GDPR Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 pt-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            
            {/* Company */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white to-gray-300 flex items-center justify-center">
                  <span className="text-[#0F172A] font-bold text-sm">PT</span>
                </div>
                <span className="text-lg font-bold text-white">Portfolio Tracker</span>
              </div>
              <p className="text-white/70 text-sm">
                Professional-grade portfolio analytics for smart investors.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="/dashboard" className="hover:text-white transition-colors">Demo</a></li>
                <li><a href="/api" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="/help" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="/contact" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="/security" className="hover:text-white transition-colors">Security</a></li>
                <li><a href="/status" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/cookies" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center">
            <div className="text-white/60 text-sm">
              © 2025 Portfolio Tracker. All rights reserved.
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-white/60 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                </svg>
              </a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </section>
  )
}