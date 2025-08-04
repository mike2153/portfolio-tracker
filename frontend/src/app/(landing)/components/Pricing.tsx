'use client'

import Link from 'next/link'
import { useState } from 'react'

interface PricingTier {
  id: string
  name: string
  description: string
  price: number
  yearlyPrice: number
  features: string[]
  limitations?: string[]
  popular?: boolean
  cta: string
  badge?: string
}

const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free Trial",
    description: "Perfect for getting started with portfolio tracking",
    price: 0,
    yearlyPrice: 0,
    features: [
      "Connect up to 3 investment accounts",
      "Basic portfolio analytics",
      "Real-time portfolio tracking",
      "Mobile and web access",
      "Email support"
    ],
    limitations: [
      "Limited to $100K portfolio value",
      "Basic performance metrics only"
    ],
    cta: "Start Free Trial",
    badge: "14 days free"
  },
  {
    id: "professional",
    name: "Professional",
    description: "For serious investors who want comprehensive analytics",
    price: 19,
    yearlyPrice: 190,
    features: [
      "Unlimited investment accounts",
      "Advanced analytics (Sharpe, Alpha, Beta)",
      "Risk assessment & optimization",
      "Tax-loss harvesting insights", 
      "Historical performance analysis",
      "Portfolio rebalancing alerts",
      "Priority email & chat support",
      "CSV/PDF report exports"
    ],
    popular: true,
    cta: "Start Professional Trial",
    badge: "Most popular"
  },
  {
    id: "enterprise",
    name: "Wealth Manager",
    description: "For financial advisors and wealth management firms",
    price: 99,
    yearlyPrice: 990,
    features: [
      "Everything in Professional",
      "Multi-client portfolio management",
      "White-label reporting",
      "API access for custom integrations",
      "Advanced risk modeling",
      "Compliance reporting tools",
      "Dedicated account manager",
      "Phone support & training"
    ],
    cta: "Contact Sales",
    badge: "For teams"
  }
]

export const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false)
  const [hoveredTier, setHoveredTier] = useState<string | null>(null)

  const getPrice = (tier: PricingTier) => {
    if (tier.price === 0) return "Free"
    const price = isYearly ? tier.yearlyPrice : tier.price
    const period = isYearly ? "year" : "month"
    return `$${price}/${period}`
  }

  const getSavings = (tier: PricingTier) => {
    if (tier.price === 0) return null
    const yearlySavings = (tier.price * 12) - tier.yearlyPrice
    const percentSaving = Math.round((yearlySavings / (tier.price * 12)) * 100)
    return { amount: yearlySavings, percent: percentSaving }
  }

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-[#1E293B] to-[#0F172A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-[#1E3A8A]/20 border border-[#1E3A8A]/30 rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-[#10B981] font-medium">Simple, Transparent Pricing</span>
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Choose Your{' '}
            <span className="bg-gradient-to-r from-[#10B981] to-[#059669] bg-clip-text text-transparent">
              Investment Journey
            </span>
          </h2>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Start free, upgrade when you need more. No hidden fees, cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-[#1E293B]/50 border border-[#334155]/50 rounded-lg p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                !isYearly 
                  ? 'bg-[#10B981] text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all relative ${
                isYearly 
                  ? 'bg-[#10B981] text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="absolute -top-2 -right-2 bg-[#F59E0B] text-xs px-1.5 py-0.5 rounded-full text-white">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier, _index) => {
            const savings = getSavings(tier)
            const isHovered = hoveredTier === tier.id
            
            return (
              <div
                key={tier.id}
                onMouseEnter={() => setHoveredTier(tier.id)}
                onMouseLeave={() => setHoveredTier(null)}
                className={`
                  relative rounded-2xl transition-all duration-300 transform hover-3d
                  ${tier.popular 
                    ? 'bg-transparent border border-[#30363D] border-2 border-[#10B981]/50 scale-105 animate-glow-pulse' 
                    : 'bg-transparent border border-[#30363D] border border-[#334155]/50 hover:border-[#10B981]/30'
                  }
                  ${isHovered ? 'scale-110 shadow-2xl shadow-[#10B981]/30' : ''}
                `}
              >
                {/* Popular Badge */}
                {tier.badge && (
                  <div className={`
                    absolute -top-4 left-1/2 transform -translate-x-1/2 
                    px-4 py-1 rounded-full text-xs font-semibold
                    ${tier.popular 
                      ? 'bg-[#10B981] text-white' 
                      : 'bg-[#1E3A8A] text-white'
                    }
                  `}>
                    {tier.badge}
                  </div>
                )}

                <div className="p-8">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                    <p className="text-gray-400 text-sm mb-6">{tier.description}</p>
                    
                    {/* Price */}
                    <div className="mb-4">
                      <div className="text-4xl font-bold text-white mb-2">
                        {getPrice(tier)}
                      </div>
                      {isYearly && savings && (
                        <div className="text-sm text-[#10B981]">
                          Save ${savings.amount}/year ({savings.percent}% off)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-4 mb-8">
                    <div className="text-sm font-semibold text-white mb-3">What&apos;s included:</div>
                    {tier.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start space-x-3">
                        <div className="w-5 h-5 rounded-full bg-[#10B981]/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg className="w-3 h-3 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}

                    {/* Limitations */}
                    {tier.limitations && (
                      <>
                        <div className="text-sm font-semibold text-gray-400 mb-3 mt-6">Limitations:</div>
                        {tier.limitations.map((limitation, limitIndex) => (
                          <div key={limitIndex} className="flex items-start space-x-3">
                            <div className="w-5 h-5 rounded-full bg-[#F59E0B]/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                              <svg className="w-3 h-3 text-[#F59E0B]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                              </svg>
                            </div>
                            <span className="text-sm text-gray-400">{limitation}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Enhanced CTA Button with Micro-interactions */}
                  <Link
                    href={tier.id === "enterprise" ? "/contact" : "/auth"}
                    className={`
                      w-full inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg
                      btn-micro group relative overflow-hidden
                      ${tier.popular
                        ? 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-lg shadow-[#10B981]/25 hover:shadow-xl hover:shadow-[#10B981]/40'
                        : 'bg-transparent border border-[#30363D] text-white hover:bg-transparent border border-[#30363D] border border-[#334155] hover:border-[#10B981]/50'
                      }
                    `}
                  >
                    {/* Animated background for popular tier */}
                    {tier.popular && (
                      <div className="absolute inset-0 bg-gradient-to-r from-[#059669] to-[#047857] 
                                     transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                    )}
                    
                    {/* Animated background for other tiers */}
                    {!tier.popular && (
                      <div className="absolute inset-0 bg-gradient-to-r from-[#334155]/70 to-[#475569]/70 
                                     transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></div>
                    )}
                    
                    {/* Button content */}
                    <span className="relative z-10 flex items-center">
                      {tier.cta}
                      {tier.id !== "enterprise" && (
                        <svg className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:translate-x-1" 
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                      {tier.id === "enterprise" && (
                        <svg className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:scale-110" 
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      )}
                    </span>

                    {/* Shimmer effect for popular tier */}
                    {tier.popular && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                      </div>
                    )}
                  </Link>

                  {/* Risk Reversal for Paid Plans */}
                  {tier.price > 0 && tier.id !== "enterprise" && (
                    <div className="text-center mt-4">
                      <div className="text-xs text-gray-400">
                        ✓ 14-day money-back guarantee • ✓ Cancel anytime • ✓ No setup fees
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 text-center">
          <h3 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h3>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-left">
              <h4 className="text-white font-semibold mb-2">Can I change plans anytime?</h4>
              <p className="text-gray-400 text-sm">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately with prorated billing.</p>
            </div>
            <div className="text-left">
              <h4 className="text-white font-semibold mb-2">Is my financial data secure?</h4>
              <p className="text-gray-400 text-sm">Absolutely. We use bank-level 256-bit SSL encryption and never store your banking credentials.</p>
            </div>
            <div className="text-left">
              <h4 className="text-white font-semibold mb-2">Do you offer refunds?</h4>
              <p className="text-gray-400 text-sm">Yes, we offer a 14-day money-back guarantee for all paid plans, no questions asked.</p>
            </div>
            <div className="text-left">
              <h4 className="text-white font-semibold mb-2">What brokers do you support?</h4>
              <p className="text-gray-400 text-sm">We support 12,000+ financial institutions including all major brokers like Fidelity, Schwab, E*TRADE, and more.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}