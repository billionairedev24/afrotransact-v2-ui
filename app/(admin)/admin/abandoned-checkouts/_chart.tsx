"use client"

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface DailyPoint {
  day: string
  abandoned: number
  recovered: number
}

export function RecoveryChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="day" stroke="#6B7280" tick={{ fontSize: 11 }} />
          <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="abandoned"
            stroke="#1A1C1C"
            strokeWidth={2}
            dot={false}
            name="Abandoned"
          />
          <Line
            type="monotone"
            dataKey="recovered"
            stroke="#D4A24C"
            strokeWidth={2}
            dot={false}
            name="Recovered"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
