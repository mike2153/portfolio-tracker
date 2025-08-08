'use client'

import { useState, useEffect } from 'react'

interface Statistic {
  id: string
  number: string
  label: string
  suffix?: string
}

const statistics: Statistic[] = [
  { id: "active-investors", number: "10,000", label: "Active Investors", suffix: "+" },
  { id: "assets-tracked", number: "50M", label: "Assets Tracked", suffix: "+" },
  { id: "uptime", number: "99.9", label: "Uptime", suffix: "%" },
  { id: "user-rating", number: "4.8", label: "User Rating", suffix: "/5" }
]

const trustBadges = [
  {
    id: "soc2",
    name: "SOC 2 Compliant",
    description: "Security certification for financial services",
    icon: "🛡️"
  },
  {
    id: "ssl",
    name: "256-bit SSL",
    description: "Bank-level encryption for all data",
    icon: "🔒"
  },
  {
    id: "banks",
    name: "12,000+ Banks",
    description: "Connected financial institutions",
    icon: "🏦"
  },
  {
    id: "realtime",
    name: "Real-time Data",
    description: "Live market data feeds",
    icon: "⚡"
  }
]

interface UserCount {
  count: number
  recentUsers: string[]
}

export const SocialProof = () => {
  const [userCount, setUserCount] = useState<UserCount>({
    count: 9847,
    recentUsers: ["Sarah M.", "David K.", "Jessica L.", "Michael R."]
  })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    
    // Simulate live user count updates
    const interval = setInterval(() => {
      setUserCount(prev => ({
        count: prev.count + Math.floor(Math.random() * 3),
        recentUsers: prev.recentUsers // Keep same users for demo
      }))
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-16 bg-gradient-to-b from-[#1E293B] to-[#0F172A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Live User Activity */}
        <div className="text-center mb-12">
          <div className={`
            inline-flex items-center space-x-3 bg-[#10B981]/10 border border-[#10B981]/20 
            rounded-full px-6 py-3 transition-all duration-1000
            ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
          `}>
            <div className="flex -space-x-2">
              {userCount.recentUsers.slice(0, 3).map((user) => (
                <div 
                  key={user}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-white text-xs font-medium border-2 border-[#0F172A]"
                >
                  {user.split(' ').map(n => n[0]).join('')}
                </div>
              ))}
            </div>
            <div className="text-sm">
              <span className="text-[#10B981] font-semibold">{userCount.count.toLocaleString()}</span>
              <span className="text-gray-300"> investors trust Portfolio Tracker</span>
            </div>
            <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {statistics.map((stat, index) => (
            <div 
              key={stat.id}
              className={`
                text-center transition-all duration-700 transform
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
              `}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="bg-gradient-to-br from-[#1E293B]/50 to-[#0F172A]/50 backdrop-blur-sm border border-[#334155]/30 rounded-xl p-6 hover:border-[#10B981]/30 transition-colors duration-300">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {stat.number}
                  <span className="text-[#10B981]">{stat.suffix}</span>
                </div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {trustBadges.map((badge, index) => (
            <div 
              key={badge.id}
              className={`
                text-center group transition-all duration-700 transform
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
              `}
              style={{ transitionDelay: `${(index + 4) * 100}ms` }}
            >
              <div className="bg-[#1E293B]/30 border border-[#334155]/30 rounded-lg p-4 group-hover:border-[#10B981]/30 group-hover:bg-[#10B981]/5 transition-all duration-300">
                <div className="text-2xl mb-3 group-hover:scale-110 transition-transform duration-300">
                  {badge.icon}
                </div>
                <h4 className="text-sm font-semibold text-white mb-2">
                  {badge.name}
                </h4>
                <p className="text-xs text-gray-400">
                  {badge.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity Feed */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-gray-400">
            <svg className="w-4 h-4 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>
              Recent sign-ups: {userCount.recentUsers.slice(0, 2).join(', ')} and {userCount.recentUsers.length - 2} others joined today
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}