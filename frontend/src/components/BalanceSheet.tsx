'use client'

import { FinancialReport } from '@/types'

interface BalanceSheetProps {
  data: FinancialReport[]
}

const formatNumber = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === 'None' || value === '') return 'N/A'
  const num = Number(value)
  if (isNaN(num)) return 'N/A'
  return num.toLocaleString()
}

// Helper to calculate and format percentage change
const calculateGrowth = (current: number | null, previous: number | null): React.ReactNode => {
    if (current === null || previous === null || previous === 0) {
      return <span className="text-gray-400">-</span>
    }
  
    const growth = ((current - previous) / Math.abs(previous)) * 100
  
    // Don't show for massive, meaningless changes
    if (Math.abs(growth) > 5000) {
      return <span className="text-gray-400">-</span>
    }
  
    const growthColor = growth >= 0 ? 'text-green-600' : 'text-red-600'
    const growthSign = growth >= 0 ? '+' : ''
  
    return (
      <span className={growthColor}>
        {growthSign}{growth.toFixed(1)}%
      </span>
    )
}

const BalanceSheetItem = ({ label, currentValue, previousValue }: { label: string, currentValue: string | number | null | undefined, previousValue: string | number | null | undefined }) => {
    
    const currentNum = (currentValue && currentValue !== 'None') ? Number(currentValue) : null
    const previousNum = (previousValue && previousValue !== 'None') ? Number(previousValue) : null

    return (
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">{label}</span>
            <div className="text-right">
                <span className="font-medium text-gray-800">{formatNumber(currentValue)}</span>
                <div className="text-xs h-4">
                    {calculateGrowth(currentNum, previousNum)}
                </div>
            </div>
        </div>
    )
}

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold text-gray-700 pb-2 mb-2 border-b-2 border-blue-500">
      🔹 {title}
    </h3>
    <div className="space-y-1">{children}</div>
  </div>
)

export default function BalanceSheet({ data }: BalanceSheetProps) {
  if (!data || data.length === 0) {
    return <p className="text-center text-gray-500 py-8">Balance sheet data is not available for this period.</p>
  }

  const report = data[0]
  const priorReport = data.length > 1 ? data[1] : null

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="text-sm text-gray-500 mb-4">
        <p><strong>Fiscal Date Ending:</strong> {report.fiscalDateEnding}</p>
        <p><strong>Reported Currency:</strong> {report.reportedCurrency}</p>
        {priorReport && <p className="text-xs italic">Growth is compared to period ending {priorReport.fiscalDateEnding}</p>}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div>
          <Section title="Assets">
            <BalanceSheetItem label="Total Assets" currentValue={report.totalAssets} previousValue={priorReport?.totalAssets} />
            <BalanceSheetItem label="Total Current Assets" currentValue={report.totalCurrentAssets} previousValue={priorReport?.totalCurrentAssets} />
            <BalanceSheetItem label="Cash & Equivalents" currentValue={report.cashAndCashEquivalentsAtCarryingValue} previousValue={priorReport?.cashAndCashEquivalentsAtCarryingValue} />
            <BalanceSheetItem label="Cash & Short Term Investments" currentValue={report.cashAndShortTermInvestments} previousValue={priorReport?.cashAndShortTermInvestments} />
            <BalanceSheetItem label="Short Term Investments" currentValue={report.shortTermInvestments} previousValue={priorReport?.shortTermInvestments} />
            <BalanceSheetItem label="Current Net Receivables" currentValue={report.currentNetReceivables} previousValue={priorReport?.currentNetReceivables} />
            <BalanceSheetItem label="Inventory" currentValue={report.inventory} previousValue={priorReport?.inventory} />
            <BalanceSheetItem label="Other Current Assets" currentValue={report.otherCurrentAssets} previousValue={priorReport?.otherCurrentAssets} />
            <BalanceSheetItem label="Total Non-Current Assets" currentValue={report.totalNonCurrentAssets} previousValue={priorReport?.totalNonCurrentAssets} />
            <BalanceSheetItem label="Property, Plant, Equipment" currentValue={report.propertyPlantEquipment} previousValue={priorReport?.propertyPlantEquipment} />
            <BalanceSheetItem label="Intangible Assets" currentValue={report.intangibleAssets} previousValue={priorReport?.intangibleAssets} />
            <BalanceSheetItem label="Goodwill" currentValue={report.goodwill} previousValue={priorReport?.goodwill} />
            <BalanceSheetItem label="Long Term Investments" currentValue={report.longTermInvestments} previousValue={priorReport?.longTermInvestments} />
            <BalanceSheetItem label="Other Non-Current Assets" currentValue={report.otherNonCurrentAssets} previousValue={priorReport?.otherNonCurrentAssets} />
          </Section>
        </div>

        <div>
          <Section title="Liabilities">
            <BalanceSheetItem label="Total Liabilities" currentValue={report.totalLiabilities} previousValue={priorReport?.totalLiabilities} />
            <BalanceSheetItem label="Total Current Liabilities" currentValue={report.totalCurrentLiabilities} previousValue={priorReport?.totalCurrentLiabilities} />
            <BalanceSheetItem label="Current Accounts Payable" currentValue={report.currentAccountsPayable} previousValue={priorReport?.currentAccountsPayable} />
            <BalanceSheetItem label="Short Term Debt" currentValue={report.shortTermDebt} previousValue={priorReport?.shortTermDebt} />
            <BalanceSheetItem label="Current Long Term Debt" currentValue={report.currentLongTermDebt} previousValue={priorReport?.currentLongTermDebt} />
            <BalanceSheetItem label="Other Current Liabilities" currentValue={report.otherCurrentLiabilities} previousValue={priorReport?.otherCurrentLiabilities} />
            <BalanceSheetItem label="Total Non-Current Liabilities" currentValue={report.totalNonCurrentLiabilities} previousValue={priorReport?.totalNonCurrentLiabilities} />
            <BalanceSheetItem label="Long Term Debt" currentValue={report.longTermDebt} previousValue={priorReport?.longTermDebt} />
            <BalanceSheetItem label="Capital Lease Obligations" currentValue={report.capitalLeaseObligations} previousValue={priorReport?.capitalLeaseObligations} />
            <BalanceSheetItem label="Total Short/Long Term Debt" currentValue={report.shortLongTermDebtTotal} previousValue={priorReport?.shortLongTermDebtTotal} />
            <BalanceSheetItem label="Other Non-Current Liabilities" currentValue={report.otherNonCurrentLiabilities} previousValue={priorReport?.otherNonCurrentLiabilities} />
          </Section>
        </div>
        
        <div>
          <Section title="Equity">
            <BalanceSheetItem label="Total Shareholder Equity" currentValue={report.totalShareholderEquity} previousValue={priorReport?.totalShareholderEquity} />
            <BalanceSheetItem label="Retained Earnings" currentValue={report.retainedEarnings} previousValue={priorReport?.retainedEarnings} />
            <BalanceSheetItem label="Treasury Stock" currentValue={report.treasuryStock} previousValue={priorReport?.treasuryStock} />
            <BalanceSheetItem label="Common Stock" currentValue={report.commonStock} previousValue={priorReport?.commonStock} />
            <BalanceSheetItem label="Common Stock Shares Outstanding" currentValue={report.commonStockSharesOutstanding} previousValue={priorReport?.commonStockSharesOutstanding} />
          </Section>
        </div>
      </div>
    </div>
  )
} 