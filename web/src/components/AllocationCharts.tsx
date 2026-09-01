import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { BUCKET_ROWS } from '../lib/buckets.ts'
import { usd } from '../lib/format.ts'
import type { Allocation, Result } from '../lib/types.ts'

const chartConfig = {
  infra: { label: 'Infra', color: 'var(--chart-1)' },
  ef_fill: { label: 'EF fill', color: 'var(--chart-2)' },
  product: { label: 'Product', color: 'var(--chart-3)' },
  growth: { label: 'Growth', color: 'var(--chart-4)' },
  people: { label: 'People', color: 'var(--chart-6)' },
  infra_buffer: { label: 'Reserva', color: 'var(--chart-5)' },
  unallocated: { label: 'Sin asignar', color: 'var(--chart-7)' },
  planned: { label: 'Plan', color: 'var(--chart-1)' },
  actual: { label: 'Actual', color: 'var(--chart-3)' },
} satisfies ChartConfig

function pieData(allocation: Allocation): { bucket: string; value: number; fill: string }[] {
  return BUCKET_ROWS.filter((row) => allocation[row.key] > 0).map((row) => ({
    bucket: row.key,
    value: allocation[row.key],
    fill: row.color,
  }))
}

export function AllocationDonut({ result }: { result: Result }) {
  const data = pieData(result.allocation)
  if (data.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Reparto</CardTitle>
        <CardDescription>Cómo se parte el cash in de {usd(result.total_allocated)}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-72">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value) => usd(typeof value === 'number' ? value : Number(value))}
                />
              }
            />
            <Pie data={data} dataKey="value" nameKey="bucket" innerRadius={58} strokeWidth={2} />
            <ChartLegend content={<ChartLegendContent nameKey="bucket" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function VarianceChart({
  planned,
  actuals,
}: {
  planned: Allocation
  actuals: Record<string, number>
}) {
  const data = BUCKET_ROWS.map((row) => ({
    bucket: row.label,
    planned: planned[row.key],
    actual: actuals[row.key] ?? 0,
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Plan vs actual</CardTitle>
        <CardDescription>Dónde el mes se desvió del plan</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-[4/3] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickFormatter={(n: number) => usd(n)} />
            <YAxis type="category" dataKey="bucket" width={92} tickLine={false} axisLine={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => usd(typeof value === 'number' ? value : Number(value))}
                />
              }
            />
            <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
            <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
