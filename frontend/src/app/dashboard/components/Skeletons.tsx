// Skeletons component
const Shimmer = () => (
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-[#30363D]/50 to-transparent"></div>
);
  
const SkeletonCard = ({ className }: { className?: string }) => (
    <div data-testid="skeleton-card" className={`relative overflow-hidden rounded-xl bg-[#161B22] p-4 shadow ${className}`}>
        <Shimmer />
        <div className="h-6 w-3/4 rounded-lg bg-[#30363D]/50"></div>
        <div className="mt-4 h-4 w-1/2 rounded-lg bg-[#30363D]/50"></div>
        <div className="mt-2 h-4 w-1/4 rounded-lg bg-[#30363D]/50"></div>
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
        <div className="relative overflow-hidden rounded-xl bg-[#161B22] p-4 shadow h-96">
            <Shimmer />
            <div className="h-full w-full rounded-lg bg-[#30363D]/50"></div>
        </div>
    );
}

export function ListSkeleton({ title }: { title: string }) {
    return (
      <div className="rounded-xl bg-[#161B22] p-4">
        <h3 className="font-semibold text-white mb-4">{title}</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="relative overflow-hidden h-10 w-10 rounded-full bg-[#30363D]/50"><Shimmer /></div>
              <div className="flex-1 space-y-2">
                <div className="relative overflow-hidden h-4 w-3/4 rounded bg-[#30363D]/50"><Shimmer /></div>
                <div className="relative overflow-hidden h-4 w-1/2 rounded bg-[#30363D]/50"><Shimmer /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
}

export function FxTickerSkeleton() {
    return (
        <div className="relative overflow-hidden rounded-xl bg-[#161B22] p-4 shadow h-12">
            <Shimmer />
        </div>
    );
} 