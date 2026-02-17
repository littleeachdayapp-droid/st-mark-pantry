import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { searchClients } from '@/utils/search';
import type { Client } from '@/types';

export function PrintAllCards() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  const allClients = useLiveQuery(
    () => db.clients.orderBy('lastName').toArray(),
    []
  );

  if (allClients === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const filteredClients = query ? searchClients(allClients, query) : allClients;

  // Determine which clients to print: selected ones, or all visible if none selected
  const clientsToPrint: Client[] =
    selectedIds.size > 0
      ? allClients.filter((c) => selectedIds.has(c.id))
      : filteredClients;

  function toggleClient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredClients.map((c) => c.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handlePrint() {
    if (!printRef.current || clientsToPrint.length === 0) return;

    const cards = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Client QR Cards</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; }
            @page { margin: 0.25in; }
            .card-grid {
              display: grid;
              grid-template-columns: repeat(2, 3.5in);
              grid-auto-rows: 2in;
              gap: 0.25in;
              justify-content: center;
            }
            .qr-card {
              width: 3.5in;
              height: 2in;
              border: 1px solid #ddd;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 3px;
              padding: 6px;
              page-break-inside: avoid;
            }
            .qr-card .header {
              font-size: 7pt;
              font-weight: 600;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .qr-card .name {
              font-size: 11pt;
              font-weight: 700;
              color: #1a1a1a;
            }
            .qr-card .family {
              font-size: 8pt;
              color: #666;
            }
          </style>
        </head>
        <body>
          ${cards}
          <script>window.onload = function() { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Print QR Cards</h1>
        </div>
        <Button onClick={handlePrint} disabled={clientsToPrint.length === 0}>
          <Printer className="size-4" />
          Print {selectedIds.size > 0 ? `${selectedIds.size} Selected` : `All ${clientsToPrint.length}`}
        </Button>
      </div>

      {/* Search and selection controls */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>
          Select All
        </Button>
        {selectedIds.size > 0 && (
          <Button variant="outline" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''} selected
        </p>
      )}

      {/* Client selection list */}
      <div className="space-y-1">
        {filteredClients.map((client) => {
          const isSelected = selectedIds.has(client.id);
          return (
            <button
              key={client.id}
              type="button"
              onClick={() => toggleClient(client.id)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors ${
                isSelected
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-card border-border hover:bg-accent/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">
                  {client.firstName} {client.lastName}
                </span>
                <Badge variant="secondary" className="ml-2">
                  {client.numberInFamily}
                </Badge>
              </div>
              <div
                className={`size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/40'
                }`}
              >
                {isSelected && (
                  <svg
                    className="size-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {allClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            No clients yet. Add clients first to print QR cards.
          </p>
        </div>
      )}

      {/* Hidden print-ready content */}
      <div ref={printRef} className="hidden">
        <div className="card-grid">
          {clientsToPrint.map((client) => (
            <div key={client.id} className="qr-card">
              <div className="header">St. Mark Legacy Food Pantry</div>
              <QRCodeSVG value={client.id} size={90} level="M" />
              <div className="name">
                {client.firstName} {client.lastName}
              </div>
              <div className="family">Family of {client.numberInFamily}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
