'use client'

import GainLossCard from './GainLossCard'

export default function DailyMovers() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <GainLossCard type="gainers" />
      <GainLossCard type="losers" />
    </div>
  )
}
