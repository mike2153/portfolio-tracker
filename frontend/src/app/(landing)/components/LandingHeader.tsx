'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

export const LandingHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header 
      className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${isScrolled 
          ? 'bg-[#0F172A]/95 backdrop-blur-md border-b border-[#1E3A8A]/20 shadow-lg' 
          : 'bg-transparent'
        }
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1E3A8A] to-[#10B981] flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-sm">PT</span>
              </div>
              <span className="text-xl font-bold text-white group-hover:text-[#10B981] transition-colors">
                Portfolio Tracker
              </span>
            </Link>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            <a 
              href="#features" 
              className="text-gray-300 hover:text-[#10B981] transition-colors duration-200 font-medium"
            >
              Features
            </a>
            <a 
              href="#testimonials" 
              className="text-gray-300 hover:text-[#10B981] transition-colors duration-200 font-medium"
            >
              Reviews
            </a>
            <a 
              href="#pricing" 
              className="text-gray-300 hover:text-[#10B981] transition-colors duration-200 font-medium"
            >
              Pricing
            </a>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            {/* Trust Badge */}
            <div className="hidden lg:flex items-center space-x-2 text-xs text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Bank-level Security</span>
            </div>

            {/* Login Button - Secondary */}
            <Link
              href="/auth"
              className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors duration-200"
            >
              Login
            </Link>

            {/* Primary CTA */}
            <Link
              href="/auth"
              className="
                inline-flex items-center px-6 py-2.5 text-sm font-semibold text-white
                bg-gradient-to-r from-[#1E3A8A] to-[#1D4ED8]
                rounded-lg shadow-lg shadow-blue-500/25
                hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105
                transition-all duration-200
                border border-[#1E3A8A]/50
              "
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-gray-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}