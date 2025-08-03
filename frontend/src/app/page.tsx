import { Suspense } from 'react'
import { Hero } from './(landing)/components/Hero'
import { Features } from './(landing)/components/Features'
import { AppShowcase } from './(landing)/components/AppShowcase'
import { Testimonials } from './(landing)/components/Testimonials'
import { SocialProof } from './(landing)/components/SocialProof'
import { Pricing } from './(landing)/components/Pricing'
import { FinalCTA } from './(landing)/components/FinalCTA'
import { StructuredData } from './(landing)/components/StructuredData'
import { LandingHeader } from './(landing)/components/LandingHeader'

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <LandingHeader />
      <main className="relative">
        <Hero />
        <Features />
        <Suspense fallback={<div className="h-96 bg-gradient-to-b from-[#1E293B] to-[#0F172A] skeleton-loading rounded-lg" />}>
          <AppShowcase />
        </Suspense>
        <Suspense fallback={<div className="h-96 bg-gradient-to-b from-[#0F172A] to-[#1E293B] skeleton-loading rounded-lg" />}>
          <SocialProof />
        </Suspense>
        <Testimonials />
        <Pricing />
        <FinalCTA />
      </main>
    </>
  )
}