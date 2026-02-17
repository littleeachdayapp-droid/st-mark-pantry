import { useState } from 'react';
import { db } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, FileText } from 'lucide-react';
import { formatDate, getMonthRange } from '@/utils/dateHelpers';
import type { Client } from '@/types';

interface VisitRow {
  date: string;
  dayOfWeek: string;
  clientName: string;
  familySize: number;
  servedBy: string;
  notes: string;
}

export function PrintVisitLog() {
  const { start: defaultStart, end: defaultEnd } = getMonthRange();
  const [fromDate, setFromDate] = useState(defaultStart);
  const [toDate, setToDate] = useState(defaultEnd);
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const visits = await db.visits
        .where('date')
        .between(fromDate, toDate, true, true)
        .sortBy('date');

      const clients = await db.clients.toArray();
      const clientMap = new Map<string, Client>();
      for (const c of clients) {
        clientMap.set(c.id, c);
      }

      const visitRows: VisitRow[] = visits.map((v) => {
        const client = clientMap.get(v.clientId);
        const dateObj = new Date(
          parseInt(v.date.slice(0, 4)),
          parseInt(v.date.slice(5, 7)) - 1,
          parseInt(v.date.slice(8, 10))
        );
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);

        return {
          date: v.date,
          dayOfWeek: dayName,
          clientName: client
            ? `${client.firstName} ${client.lastName}`
            : 'Unknown Client',
          familySize: client?.numberInFamily ?? 0,
          servedBy: v.servedBy || '',
          notes: v.notes || '',
        };
      });

      setRows(visitRows);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const uniqueClients = new Set(rows.map((r) => r.clientName)).size;

  const fromFormatted = fromDate ? formatDate(fromDate) : '';
  const toFormatted = toDate ? formatDate(toDate) : '';

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          #print-area table { font-size: 11px; }
          #print-area th, #print-area td { padding: 4px 8px; }
          @page { margin: 0.5in; }
        }
      `}</style>

      <div className="space-y-4">
        {/* Controls (hidden when printing) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Print Visit Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="from-date">From</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-date">To</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={loading || !fromDate || !toDate}>
                <FileText className="size-4" />
                {loading ? 'Loading...' : 'Generate'}
              </Button>
              {generated && rows.length > 0 && (
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="size-4" />
                  Print
                </Button>
              )}
            </div>

            {generated && rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No visits found in the selected date range.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Printable area */}
        {generated && rows.length > 0 && (
          <div id="print-area" className="bg-white rounded-lg border p-6">
            <div className="text-center mb-4">
              <h1 className="text-xl font-bold">
                St. Mark Legacy Food Pantry — Visit Log
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {fromFormatted} through {toFormatted}
              </p>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 px-2 font-semibold">Date</th>
                  <th className="text-left py-2 px-2 font-semibold">Day</th>
                  <th className="text-left py-2 px-2 font-semibold">Client Name</th>
                  <th className="text-right py-2 px-2 font-semibold">Family Size</th>
                  <th className="text-left py-2 px-2 font-semibold">Served By</th>
                  <th className="text-left py-2 px-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0
                        ? 'border-b border-gray-200'
                        : 'border-b border-gray-200 bg-gray-50'
                    }
                  >
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{row.dayOfWeek}</td>
                    <td className="py-1.5 px-2">{row.clientName}</td>
                    <td className="py-1.5 px-2 text-right">{row.familySize}</td>
                    <td className="py-1.5 px-2">{row.servedBy}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 pt-3 border-t border-gray-300 flex gap-6 text-sm">
              <p>
                <span className="font-semibold">Total Visits:</span> {rows.length}
              </p>
              <p>
                <span className="font-semibold">Unique Clients:</span> {uniqueClients}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
