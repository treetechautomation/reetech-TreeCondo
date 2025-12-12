"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { ChartTooltipContent } from "@/components/ui/chart"

const data = [
  { name: "Jan", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Feb", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Mar", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Apr", total: Math.floor(Math.random() * 10) + 1 },
  { name: "May", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Jun", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Jul", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Aug", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Sep", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Oct", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Nov", total: Math.floor(Math.random() * 10) + 1 },
  { name: "Dec", total: Math.floor(Math.random() * 10) + 1 },
]

export function Overview() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          cursor={false}
          content={<ChartTooltipContent 
            indicator="dot"
            formatter={(value, name, item) => (
              <div className="flex flex-col">
                <span className="font-medium">{item.payload.name}</span>
                <span className="text-muted-foreground">{value} incidents</span>
              </div>
            )}
           />}
        />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
