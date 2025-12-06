'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Plus, 
  ArrowUpRight,
  ArrowDownRight,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  loading?: boolean
}

function StatCard({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon: Icon, 
  iconColor = 'text-blue-600',
  loading 
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn('h-4 w-4', iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 sm:h-8 w-24" />
            <Skeleton className="h-3 sm:h-4 w-32" />
          </div>
        ) : (
          <>
            <div className="text-xl sm:text-2xl font-bold">{value}</div>
            {change !== undefined && changeLabel && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-1",
                change >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {change >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                <span>
                  {Math.abs(change)}% {changeLabel}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface DashboardStatsProps {
  metrics: {
    totalLeads: number
    totalRevenue: number
    urgentLeads: number
    newLeadsToday: number
    conversionRate: number
    averageLeadValue: number
  } | null
  loading: boolean
}

export function DashboardStats({ metrics, loading }: DashboardStatsProps) {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Lead-uri"
        value={metrics?.totalLeads.toLocaleString() || '0'}
        change={12}
        changeLabel="față de luna trecută"
        icon={Users}
        iconColor="text-blue-600"
        loading={loading}
      />
      <StatCard
        title="Revenue Total"
        value={`${(metrics?.totalRevenue || 0).toFixed(2)} RON`}
        change={8}
        changeLabel="față de luna trecută"
        icon={DollarSign}
        iconColor="text-emerald-600"
        loading={loading}
      />
      <StatCard
        title="Lead-uri Urgente"
        value={metrics?.urgentLeads || 0}
        change={-5}
        changeLabel="față de ieri"
        icon={AlertTriangle}
        iconColor="text-red-600"
        loading={loading}
      />
      <StatCard
        title="Lead-uri Noi Astăzi"
        value={metrics?.newLeadsToday || 0}
        change={15}
        changeLabel="față de ieri"
        icon={Plus}
        iconColor="text-purple-600"
        loading={loading}
      />
    </div>
  )
}

