import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BUCKET_ROWS } from '../lib/buckets.ts'
import { shareOf, usd } from '../lib/format.ts'
import type { Result } from '../lib/types.ts'

export function AllocationTable({ result }: { result: Result }) {
  const total = result.total_allocated
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Tabla</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rubro</TableHead>
              <TableHead className="text-right">USD</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {BUCKET_ROWS.map((row) => {
              const amount = result.allocation[row.key]
              const off = amount === 0
              return (
                <TableRow key={row.key} className={off ? 'text-muted-foreground' : undefined}>
                  <TableCell>
                    <div>{row.label}</div>
                    <div className="text-xs text-muted-foreground whitespace-normal">{row.note}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{usd(amount)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {shareOf(amount, total)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{usd(total)}</TableCell>
              <TableCell className="text-right font-mono text-xs">100.0%</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
