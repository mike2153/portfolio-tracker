'use client'

import { useState, useEffect } from 'react'

interface Testimonial {
  id: string
  name: string
  role: string
  company: string
  content: string
  rating: number
  portfolioSize: string
  avatar: string
}

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    role: "Senior Portfolio Manager",
    company: "Wealth Management Inc.",
    content: "Portfolio Tracker transformed how I manage client portfolios. The professional-grade analytics rival what we use at institutional level, but with a much cleaner interface. The real-time risk assessment has caught several potential issues before they became problems.",
    rating: 5,
    portfolioSize: "$2.3M managed",
    avatar: "SJ"
  },
  {
    id: "2", 
    name: "Michael Chen",
    role: "Individual Investor",
    company: "Tech Entrepreneur",
    content: "After trying every portfolio app on the market, Portfolio Tracker is the only one that actually helps me make better investment decisions. The Sharpe ratio calculations and diversification analysis are spot-on. Worth every penny.",
    rating: 5,
    portfolioSize: "$890K portfolio",
    avatar: "MC"
  },
  {
    id: "3",
    name: "Dr. Emily Rodriguez",
    role: "Retired Physician",
    company: "Private Investor",
    content: "I was skeptical about financial apps, but the bank-level security and professional metrics won me over. The tax reporting features alone saved me hundreds in accounting fees. My financial advisor is impressed with the insights I bring to our meetings.",
    rating: 5,
    portfolioSize: "$1.8M portfolio",
    avatar: "ER"
  },
  {
    id: "4",
    name: "David Kim",
    role: "Financial Advisor",
    company: "Independent RIA",
    content: "I recommend Portfolio Tracker to all my clients. The platform bridges the gap between consumer apps and institutional tools. The performance attribution and risk metrics help my clients understand their investments better than any other tool I've used.",
    rating: 5,
    portfolioSize: "$15M+ AUM",
    avatar: "DK"
  },
  {
    id: "5",
    name: "Jennifer Walsh",
    role: "Investment Analyst",
    company: "Fortune 500 Company",
    content: "The portfolio optimization suggestions have improved my personal portfolio's risk-adjusted returns by 18%. As someone who works with institutional tools daily, I can confidently say this rivals platforms costing 10x more.",
    rating: 5,
    portfolioSize: "$650K portfolio",
    avatar: "JW"
  },
  {
    id: "6",
    name: "Robert Martinez",
    role: "Retiree",
    company: "Former CFO",
    content: "Portfolio Tracker gives me the confidence I need in retirement. The drawdown analysis and stress testing features help me sleep better knowing my portfolio can weather market volatility. The customer support is exceptional too.",
    rating: 5,
    portfolioSize: "$1.2M portfolio",
    avatar: "RM"
  }
]

export const Testimonials = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [isAutoPlay, setIsAutoPlay] = useState(true)
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (isAutoPlay) {
      const interval = setInterval(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
      }, 5000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [isAutoPlay])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0')
            setVisibleCards(prev => new Set([...prev, index]))
          }
        })
      },
      { threshold: 0.2 }
    )

    document.querySelectorAll('[data-testimonial-index]').forEach((el) => {
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-5 h-5 ${i < rating ? 'text-[#F59E0B]' : 'text-gray-600'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))
  }

  return (
    <section id="testimonials" className="py-24 bg-gradient-to-b from-[#0F172A] to-[#1E293B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-[#10B981]/20 border border-[#10B981]/30 rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-[#10B981] font-medium">Trusted by Professionals</span>
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            What Our Users Say
          </h2>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            From individual investors to financial professionals, see why thousands choose Portfolio Tracker
          </p>

          {/* Overall Rating */}
          <div className="inline-flex items-center space-x-4 bg-[#1E293B]/50 border border-[#334155]/30 rounded-lg px-6 py-3">
            <div className="flex items-center space-x-1">
              {renderStars(5)}
            </div>
            <div className="text-white font-semibold">4.8/5</div>
            <div className="text-sm text-gray-400">from 150+ reviews</div>
          </div>
        </div>

        {/* Featured Testimonial */}
        <div className="mb-16">
          <div className="
            bg-gradient-to-br from-[#1E293B]/80 to-[#0F172A]/80 
            backdrop-blur-xl border border-[#334155]/50 
            rounded-2xl p-8 lg:p-12 shadow-2xl
            max-w-4xl mx-auto
          ">
            <div className="text-center">
              {/* Quote */}
              <div className="text-4xl text-[#10B981]/30 mb-6">&ldquo;</div>
              <blockquote className="text-xl lg:text-2xl text-white leading-relaxed mb-8">
                {testimonials[currentTestimonial]?.content}
              </blockquote>
              
              {/* Rating */}
              <div className="flex justify-center items-center space-x-1 mb-6">
                {renderStars(testimonials[currentTestimonial]?.rating || 5)}
              </div>

              {/* Author */}
              <div className="flex items-center justify-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-white font-semibold">
                  {testimonials[currentTestimonial]?.avatar}
                </div>
                <div className="text-left">
                  <div className="text-white font-semibold">{testimonials[currentTestimonial]?.name}</div>
                  <div className="text-sm text-gray-400">{testimonials[currentTestimonial]?.role}</div>
                  <div className="text-sm text-[#10B981]">{testimonials[currentTestimonial]?.portfolioSize}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonial Navigation */}
          <div className="flex justify-center items-center space-x-4 mt-8">
            <button
              onClick={() => setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
              className="p-2 rounded-full bg-[#1E293B] border border-[#334155] hover:border-[#10B981]/50 text-gray-400 hover:text-[#10B981] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex space-x-2">
              {testimonials.map((testimonial, index) => (
                <button
                  key={testimonial.id}
                  onClick={() => {
                    setCurrentTestimonial(index)
                    setIsAutoPlay(false)
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentTestimonial ? 'bg-[#10B981]' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)}
              className="p-2 rounded-full bg-[#1E293B] border border-[#334155] hover:border-[#10B981]/50 text-gray-400 hover:text-[#10B981] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Testimonial Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.slice(0, 6).map((testimonial, index) => (
            <div
              key={testimonial.id}
              data-testimonial-index={index}
              className={`
                transition-all duration-700 transform
                ${visibleCards.has(index) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
              `}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="
                h-full p-6 rounded-xl border border-[#334155]/50
                bg-gradient-to-br from-[#1E293B]/30 to-[#0F172A]/30
                backdrop-blur-sm hover:border-[#10B981]/30
                transition-colors duration-300
              ">
                {/* Rating */}
                <div className="flex items-center space-x-1 mb-4">
                  {renderStars(testimonial.rating)}
                </div>

                {/* Quote */}
                <blockquote className="text-gray-300 mb-6 leading-relaxed">
                  &ldquo;{testimonial.content.slice(0, 120)}&hellip;&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-white font-medium text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{testimonial.name}</div>
                    <div className="text-xs text-gray-400">{testimonial.role}</div>
                    <div className="text-xs text-[#10B981]">{testimonial.portfolioSize}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}