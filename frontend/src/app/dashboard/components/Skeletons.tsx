// Skeletons component  
const SkeletonCard = ({ className }: { className?: string }) => (
    <div data-testid="skeleton-card" className={`bg-transparent border border-[#30363D] rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#30363D]/50">
            <div className="w-6 h-6 bg-[#30363D] rounded"></div>
          </div>
          <div className="flex-1">
            <div className="h-4 bg-[#30363D] rounded mb-2"></div>
            <div className="h-8 bg-[#30363D] rounded mb-2"></div>
            <div className="h-3 bg-[#30363D] rounded w-3/4"></div>
          </div>
        </div>
    </div>
);

export function KPIGridSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div className="bg-transparent border border-[#30363D] rounded-xl p-6 h-96">
            <div className="h-full w-full rounded-lg bg-[#30363D]/50"></div>
        </div>
    );
}

export function ListSkeleton({ title }: { title: string }) {
    return (
      <div className="bg-transparent border border-[#30363D] rounded-xl p-6">
        <h3 className="font-semibold gradient-text-green mb-4">{title}</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-[#30363D]/50"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-[#30363D]/50"></div>
                <div className="h-4 w-1/2 rounded bg-[#30363D]/50"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
}

export function FxTickerSkeleton() {
    return (
        <div className="bg-transparent border border-[#30363D] rounded-xl p-4 h-12">
            <div className="h-4 w-full rounded bg-[#30363D]/50"></div>
        </div>
    );
} 