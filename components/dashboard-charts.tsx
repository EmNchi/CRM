'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardChartsProps {
  metrics: {
    leadsByPipeline: Record<string, number>
    leadsByStage: Record<string, number>
    revenueByPipeline: Record<string, number>
    revenueByStage: Record<string, number>
    leadsOverTime: Array<{ date: string; count: number }>
    topTechnicians: Array<{ name: string; leads: number; revenue: number }>
    tagDistribution: Record<string, number>
    paymentMethodStats: {
      cash: number
      card: number
      none: number
    }
  } | null
  loading: boolean
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function DashboardCharts({ metrics, loading }: DashboardChartsProps) {
  // calculeaza raza pentru pie chart in functie de dimensiunea ecranului
  const [pieRadius, setPieRadius] = useState(60)

  useEffect(() => {
    const updatePieRadius = () => {
      if (window.innerWidth < 640) {
        setPieRadius(50)
      } else if (window.innerWidth < 768) {
        setPieRadius(70)
      } else {
        setPieRadius(80)
      }
    }

    updatePieRadius()
    window.addEventListener('resize', updatePieRadius)
    return () => window.removeEventListener('resize', updatePieRadius)
  }, [])

  // transforma datele pentru grafice
  const pipelineData = metrics ? Object.entries(metrics.leadsByPipeline)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6) : []

  const stageData = metrics ? Object.entries(metrics.leadsByStage)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value) : []

  const revenueData = metrics ? Object.entries(metrics.revenueByPipeline)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6) : []

  // revenue pe stage - metrica importanta pentru analitic economic/contabil
  const revenueByStageData = metrics?.revenueByStage ? Object.entries(metrics.revenueByStage)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8) : []

  const chartConfig = {
    leads: {
      label: 'Lead-uri',
      color: 'hsl(var(--chart-1))',
    },
    revenue: {
      label: 'Revenue (RON)',
      color: 'hsl(var(--chart-2))',
    },
  }

  if (loading) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="hidden lg:block">
            <CardHeader>
              <Skeleton className="h-5 sm:h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] sm:h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
      {/* Lead-uri pe Pipeline */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Lead-uri pe Pipeline</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Distribuția lead-urilor pe departamente</CardDescription>
        </CardHeader>
        <CardContent>
          {pipelineData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-leads)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Nu există date
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue pe Pipeline */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Revenue pe Pipeline</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Valoarea totală pe departamente</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={10}
                    className="text-xs"
                  />
                  <YAxis fontSize={10} className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] sm:h-[250px] md:h-[300px] text-muted-foreground text-sm">
              Nu există date
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead-uri pe Timp */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Lead-uri Noi (Ultimele 30 Zile)</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Evoluția lead-urilor noi pe timp</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.leadsOverTime && metrics.leadsOverTime.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.leadsOverTime}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-leads)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--color-leads)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getDate()}/${date.getMonth() + 1}`
                    }}
                    fontSize={10}
                    className="text-xs"
                  />
                  <YAxis fontSize={10} className="text-xs" />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    labelFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString('ro-RO')
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="var(--color-leads)" 
                    fillOpacity={1}
                    fill="url(#colorLeads)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] sm:h-[250px] md:h-[300px] text-muted-foreground text-sm">
              Nu există date
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metode de plata - Cash vs Card */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Metode de Plată</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Distribuția lead-urilor după metoda de plată</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.paymentMethodStats && (metrics.paymentMethodStats.cash > 0 || metrics.paymentMethodStats.card > 0 || metrics.paymentMethodStats.none > 0) ? (
            <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Cash', value: metrics.paymentMethodStats.cash },
                      { name: 'Card', value: metrics.paymentMethodStats.card },
                      { name: 'Nespecificat', value: metrics.paymentMethodStats.none }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={pieRadius}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Cash', value: metrics.paymentMethodStats.cash },
                      { name: 'Card', value: metrics.paymentMethodStats.card },
                      { name: 'Nespecificat', value: metrics.paymentMethodStats.none }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#3b82f6' : '#6b7280'} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] sm:h-[250px] md:h-[300px] text-muted-foreground text-sm">
              Nu există date
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

