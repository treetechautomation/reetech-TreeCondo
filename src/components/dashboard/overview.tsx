"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useState, useEffect } from "react";

const chartConfig = {
  total: {
    label: "Incidentes",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export function Overview() {
  const [data, setData] = useState<any[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  useEffect(() => {
    // Using Portuguese month abbreviations
    const ptMonths = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    setMonths(ptMonths);
    
    setData(
      ptMonths.map((month) => ({
        name: month,
        total: Math.floor(Math.random() * 10) + 1,
      }))
    );
  }, []);

  if (data.length === 0) {
    return <div style={{height: 350}} />; // or a loading indicator
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
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
                    <span className="text-muted-foreground">{value} incidentes</span>
                  </div>
                )}
              />}
            />
            <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
    </ChartContainer>
  )
}
