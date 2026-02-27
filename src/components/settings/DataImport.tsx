import { useState, useRef, useMemo, useCallback } from 'react';
import { parseExcelFile } from '@/lib/excel';
import { db } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';
import type { Client, Address } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientField =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'email'
  | 'street'
  | 'city'
  | 'state'
  | 'zip'
  | 'notes'
  | 'numberInFamily';

interface ColumnMapping {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  numberInFamily: string;
  fullName: string; // combined name column
}

interface DuplicateInfo {
  rowIndex: number;
  row: Record<string, string>;
  existingClient: Client;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

type Step = 'upload' | 'map' | 'import';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<ClientField | 'fullName', string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  phone: 'Phone',
  email: 'Email',
  street: 'Street',
  city: 'City',
  state: 'State',
  zip: 'Zip',
  notes: 'Notes',
  numberInFamily: 'Family Size',
  fullName: 'Full Name (auto-split)',
};

const FIELD_ORDER: (ClientField | 'fullName')[] = [
  'fullName',
  'firstName',
  'lastName',
  'phone',
  'email',
  'street',
  'city',
  'state',
  'zip',
  'notes',
  'numberInFamily',
];

const SKIP_VALUE = '';

// ---------------------------------------------------------------------------
// Auto-detect mapping patterns
// ---------------------------------------------------------------------------

const AUTO_DETECT_PATTERNS: Record<
  ClientField | 'fullName',
  string[]
> = {
  firstName: ['first name', 'first', 'fname', 'first_name', 'firstname'],
  lastName: ['last name', 'last', 'lname', 'last_name', 'lastname', 'surname'],
  phone: ['phone', 'telephone', 'phone number', 'phone_number', 'mobile', 'cell', 'cell phone'],
  email: ['email', 'email address', 'email_address', 'e-mail', 'e_mail'],
  street: ['street', 'address', 'street address', 'address1', 'address_1', 'street_address', 'address 1'],
  city: ['city', 'town'],
  state: ['state', 'st'],
  zip: ['zip', 'zipcode', 'zip code', 'zip_code', 'postal', 'postal code', 'postal_code'],
  notes: ['notes', 'comments', 'comment', 'note'],
  numberInFamily: [
    'family size',
    'family_size',
    'familysize',
    'household size',
    'household_size',
    'householdsize',
    'number in family',
    'number_in_family',
    'members',
    '# in family',
  ],
  fullName: ['name', 'full name', 'full_name', 'fullname', 'client name', 'client_name'],
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function emptyMapping(): ColumnMapping {
  return {
    firstName: SKIP_VALUE,
    lastName: SKIP_VALUE,
    phone: SKIP_VALUE,
    email: SKIP_VALUE,
    street: SKIP_VALUE,
    city: SKIP_VALUE,
    state: SKIP_VALUE,
    zip: SKIP_VALUE,
    notes: SKIP_VALUE,
    numberInFamily: SKIP_VALUE,
    fullName: SKIP_VALUE,
  };
}

async function parseFile(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const data = await file.arrayBuffer();
  return parseExcelFile(data);
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping = emptyMapping();
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  const used = new Set<number>();

  // Check specific fields first (firstName, lastName, etc.) before fullName
  // so that "first name" doesn't accidentally match "name" pattern in fullName
  const fieldPriority: (ClientField | 'fullName')[] = [
    'firstName',
    'lastName',
    'phone',
    'email',
    'street',
    'city',
    'state',
    'zip',
    'notes',
    'numberInFamily',
    'fullName',
  ];

  for (const field of fieldPriority) {
    const patterns = AUTO_DETECT_PATTERNS[field];
    for (const pattern of patterns) {
      const idx = lowerHeaders.findIndex(
        (h, i) => !used.has(i) && h === pattern
      );
      if (idx !== -1) {
        mapping[field] = headers[idx];
        used.add(idx);
        break;
      }
    }
  }

  // If fullName is set but firstName/lastName are also set, prefer specific fields
  if (mapping.fullName && mapping.firstName && mapping.lastName) {
    mapping.fullName = SKIP_VALUE;
  }

  return mapping;
}

function splitFullName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { first: '', last: '' };

  // Handle "Last, First" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((s) => s.trim());
    return {
      first: parts[1] || '',
      last: parts[0] || '',
    };
  }

  // Handle "First Last" or "First Middle Last" format
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  }
  return {
    first: parts[0],
    last: parts.slice(1).join(' '),
  };
}

function rowToClient(
  row: Record<string, string>,
  mapping: ColumnMapping
): Omit<Client, 'id' | 'createdAt' | 'updatedAt'> | null {
  let firstName = mapping.firstName ? (row[mapping.firstName] || '').trim() : '';
  let lastName = mapping.lastName ? (row[mapping.lastName] || '').trim() : '';

  // Handle full name column if firstName and lastName are empty
  if (mapping.fullName && !firstName && !lastName) {
    const fullNameVal = (row[mapping.fullName] || '').trim();
    const split = splitFullName(fullNameVal);
    firstName = split.first;
    lastName = split.last;
  }

  // Skip rows without at least a first name or last name
  if (!firstName && !lastName) {
    return null;
  }

  const address: Address = {
    street: mapping.street ? (row[mapping.street] || '').trim() : '',
    city: mapping.city ? (row[mapping.city] || '').trim() : '',
    state: mapping.state ? (row[mapping.state] || '').trim() || 'TX' : 'TX',
    zip: mapping.zip ? (row[mapping.zip] || '').trim() : '',
  };

  const rawFamilySize = mapping.numberInFamily
    ? (row[mapping.numberInFamily] || '').trim()
    : '';
  const numberInFamily = parseInt(rawFamilySize, 10) || 1;

  const phone = mapping.phone ? (row[mapping.phone] || '').trim() || undefined : undefined;
  const email = mapping.email ? (row[mapping.email] || '').trim() || undefined : undefined;
  const notes = mapping.notes ? (row[mapping.notes] || '').trim() || undefined : undefined;

  return {
    firstName,
    lastName,
    phone,
    email,
    address,
    familyMembers: [],
    numberInFamily: Math.max(1, numberInFamily),
    notes,
  };
}

function isDuplicate(
  client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>,
  existing: Client
): boolean {
  const firstMatch =
    client.firstName.toLowerCase() === existing.firstName.toLowerCase();
  const lastMatch =
    client.lastName.toLowerCase() === existing.lastName.toLowerCase();

  if (!firstMatch || !lastMatch) return false;

  // If both have phone numbers, use that as a stronger signal
  if (client.phone && existing.phone) {
    const cleanNew = client.phone.replace(/\D/g, '');
    const cleanExisting = existing.phone.replace(/\D/g, '');
    if (cleanNew && cleanExisting) {
      return cleanNew === cleanExisting || cleanNew.endsWith(cleanExisting) || cleanExisting.endsWith(cleanNew);
    }
  }

  // Name match alone is enough to flag as potential duplicate
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DataImportProps {
  onComplete?: () => void;
}

export function DataImport({ onComplete }: DataImportProps) {
  // Step tracking
  const [step, setStep] = useState<Step>('upload');

  // Step 1: Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Step 2: Map
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping());

  // Step 3: Import
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [duplicatesChecked, setDuplicatesChecked] = useState(false);

  // ---------------------------------------------------------------------------
  // Step 1: File handling
  // ---------------------------------------------------------------------------

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setParseError('Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    setParseError('');
    setFileName(file.name);

    try {
      const result = await parseFile(file);
      if (result.headers.length === 0) {
        setParseError('The file appears to be empty or has no column headers.');
        return;
      }
      if (result.rows.length === 0) {
        setParseError('The file has column headers but no data rows.');
        return;
      }
      setHeaders(result.headers);
      setRows(result.rows);

      // Auto-detect column mapping
      const detected = autoDetectMapping(result.headers);
      setMapping(detected);
    } catch {
      setParseError('Failed to parse the file. Make sure it is a valid spreadsheet.');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Step 2: Mapping
  // ---------------------------------------------------------------------------

  const updateMapping = useCallback(
    (field: keyof ColumnMapping, value: string) => {
      setMapping((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const hasNameMapping = useMemo(() => {
    const hasFirst = mapping.firstName !== SKIP_VALUE;
    const hasLast = mapping.lastName !== SKIP_VALUE;
    const hasFull = mapping.fullName !== SKIP_VALUE;
    return (hasFirst || hasLast) || hasFull;
  }, [mapping.firstName, mapping.lastName, mapping.fullName]);

  // Preview of mapped data (first 3 rows)
  const mappedPreview = useMemo(() => {
    return rows.slice(0, 3).map((row) => rowToClient(row, mapping));
  }, [rows, mapping]);

  // ---------------------------------------------------------------------------
  // Step 3: Duplicate detection + import
  // ---------------------------------------------------------------------------

  const validRows = useMemo(() => {
    return rows
      .map((row, index) => ({ row, index, client: rowToClient(row, mapping) }))
      .filter(
        (item): item is { row: Record<string, string>; index: number; client: NonNullable<ReturnType<typeof rowToClient>> } =>
          item.client !== null
      );
  }, [rows, mapping]);

  const checkDuplicates = useCallback(async () => {
    const existingClients = await db.clients.toArray();
    const found: DuplicateInfo[] = [];

    for (const item of validRows) {
      const match = existingClients.find((existing) =>
        isDuplicate(item.client, existing)
      );
      if (match) {
        found.push({
          rowIndex: item.index,
          row: item.row,
          existingClient: match,
        });
      }
    }

    setDuplicates(found);
    setDuplicatesChecked(true);
  }, [validRows]);

  const newCount = useMemo(() => {
    if (!duplicatesChecked) return validRows.length;
    const dupIndices = new Set(duplicates.map((d) => d.rowIndex));
    return validRows.filter((r) => !dupIndices.has(r.index)).length;
  }, [validRows, duplicates, duplicatesChecked]);

  const skippedCount = useMemo(() => {
    return rows.length - validRows.length;
  }, [rows.length, validRows.length]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportProgress(0);

    const dupIndices = new Set(
      skipDuplicates ? duplicates.map((d) => d.rowIndex) : []
    );

    const toImport = validRows.filter((r) => !dupIndices.has(r.index));
    let imported = 0;
    let errors = 0;

    const batchSize = 50;
    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize);
      const now = new Date().toISOString();

      const clients: Client[] = batch.map((item) => ({
        id: crypto.randomUUID(),
        ...item.client,
        createdAt: now,
        updatedAt: now,
      }));

      try {
        await db.clients.bulkAdd(clients);
        imported += clients.length;
      } catch {
        // Try one at a time if bulk fails
        for (const client of clients) {
          try {
            await db.clients.add(client);
            imported++;
          } catch {
            errors++;
          }
        }
      }

      setImportProgress(
        Math.round(((i + batch.length) / toImport.length) * 100)
      );
    }

    setImportProgress(100);
    setImportResult({
      imported,
      skipped: dupIndices.size + skippedCount,
      errors,
    });
    setImporting(false);
  }, [validRows, duplicates, skipDuplicates, skippedCount]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goToMap = useCallback(() => {
    setStep('map');
  }, []);

  const goToImport = useCallback(async () => {
    setStep('import');
    setDuplicatesChecked(false);
    setImportResult(null);
    await checkDuplicates();
  }, [checkDuplicates]);

  const goBack = useCallback(() => {
    if (step === 'map') setStep('upload');
    if (step === 'import') {
      setStep('map');
      setDuplicatesChecked(false);
      setImportResult(null);
    }
  }, [step]);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setParseError('');
    setMapping(emptyMapping());
    setDuplicates([]);
    setSkipDuplicates(true);
    setImporting(false);
    setImportProgress(0);
    setImportResult(null);
    setDuplicatesChecked(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ---------------------------------------------------------------------------
  // Step indicators
  // ---------------------------------------------------------------------------

  const steps: { key: Step; label: string; number: number }[] = [
    { key: 'upload', label: 'Upload', number: 1 },
    { key: 'map', label: 'Map Columns', number: 2 },
    { key: 'import', label: 'Import', number: 3 },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-5" />
          Import Clients from Spreadsheet
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                    i < stepIndex
                      ? 'bg-primary text-primary-foreground'
                      : i === stepIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i < stepIndex ? (
                    <Check className="size-3.5" />
                  ) : (
                    s.number
                  )}
                </div>
                <span
                  className={`text-sm ${
                    i === stepIndex
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="size-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <Upload className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                Drop a spreadsheet here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports .csv, .xlsx, and .xls files
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {parseError && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {/* File info + preview */}
            {rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{fileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {headers.length} columns
                    </Badge>
                    <Badge variant="secondary">{rows.length} rows</Badge>
                  </div>
                </div>

                {/* Preview table */}
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {headers.map((h) => (
                          <th
                            key={h}
                            className="whitespace-nowrap px-3 py-2 text-left font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b last:border-b-0">
                          {headers.map((h) => (
                            <td
                              key={h}
                              className="max-w-[200px] truncate whitespace-nowrap px-3 py-1.5"
                            >
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Showing first 5 of {rows.length} rows
                  </p>
                )}

                <div className="flex justify-end">
                  <Button onClick={goToMap}>
                    Next: Map Columns
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 'map' && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Map your spreadsheet columns to client fields. Fields set to
              "(skip)" will be ignored.
            </p>

            {/* Mapping dropdowns */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELD_ORDER.map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label
                    htmlFor={`map-${field}`}
                    className="text-xs"
                  >
                    {FIELD_LABELS[field]}
                    {(field === 'firstName' || field === 'lastName') && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <select
                    id={`map-${field}`}
                    value={mapping[field]}
                    onChange={(e) => updateMapping(field, e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value={SKIP_VALUE}>(skip)</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Hint about full name */}
            {mapping.fullName !== SKIP_VALUE && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  The "{mapping.fullName}" column will be split into first/last name.
                  "Last, First" and "First Last" formats are supported.
                  {(mapping.firstName !== SKIP_VALUE || mapping.lastName !== SKIP_VALUE) && (
                    <span className="block mt-1 font-medium">
                      Note: Separate first/last name columns take priority over the full name column.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {!hasNameMapping && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  You must map at least a first name, last name, or full name column to continue.
                </AlertDescription>
              </Alert>
            )}

            {/* Preview of mapped data */}
            {hasNameMapping && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Preview (first 3 rows)</p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">
                          First Name
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Last Name
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Phone
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Email
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Address
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Family Size
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedPreview.map((client, i) =>
                        client ? (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-3 py-1.5">
                              {client.firstName || (
                                <span className="text-muted-foreground italic">
                                  empty
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {client.lastName || (
                                <span className="text-muted-foreground italic">
                                  empty
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {client.phone || (
                                <span className="text-muted-foreground italic">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {client.email || (
                                <span className="text-muted-foreground italic">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="max-w-[200px] truncate px-3 py-1.5">
                              {[
                                client.address.street,
                                client.address.city,
                                client.address.state,
                                client.address.zip,
                              ]
                                .filter(Boolean)
                                .join(', ') || (
                                <span className="text-muted-foreground italic">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {client.numberInFamily}
                            </td>
                          </tr>
                        ) : (
                          <tr key={i} className="border-b last:border-b-0">
                            <td
                              colSpan={6}
                              className="px-3 py-1.5 text-muted-foreground italic"
                            >
                              Row skipped (no name)
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button onClick={goToImport} disabled={!hasNameMapping}>
                Next: Review & Import
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Import */}
        {step === 'import' && (
          <div className="space-y-5">
            {/* Import result */}
            {importResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">Import Complete</p>
                    <p className="text-sm text-muted-foreground">
                      Imported {importResult.imported} client
                      {importResult.imported !== 1 ? 's' : ''}
                      {importResult.skipped > 0 && (
                        <>, skipped {importResult.skipped}</>
                      )}
                      {importResult.errors > 0 && (
                        <>, {importResult.errors} error{importResult.errors !== 1 ? 's' : ''}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={reset}>
                    Import More
                  </Button>
                  {onComplete && (
                    <Button onClick={onComplete}>
                      Done
                      <Check className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : importing ? (
              /* Progress */
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <p className="text-sm font-medium">Importing clients...</p>
                </div>
                <div className="mx-auto max-w-xs">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    {importProgress}%
                  </p>
                </div>
              </div>
            ) : (
              /* Review before import */
              <div className="space-y-4">
                {!duplicatesChecked ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="size-5 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Checking for duplicates...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold">{rows.length}</p>
                        <p className="text-xs text-muted-foreground">
                          Total Rows
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold text-primary">
                          {skipDuplicates ? newCount : validRows.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          To Import
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold text-yellow-600">
                          {duplicates.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Duplicates
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold text-muted-foreground">
                          {skippedCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Invalid Rows
                        </p>
                      </div>
                    </div>

                    {/* Duplicate handling */}
                    {duplicates.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="size-4 text-yellow-600" />
                            <p className="text-sm font-medium">
                              {duplicates.length} potential duplicate
                              {duplicates.length !== 1 ? 's' : ''} found
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={skipDuplicates}
                              onChange={(e) =>
                                setSkipDuplicates(e.target.checked)
                              }
                              className="rounded border-input"
                            />
                            Skip duplicates
                          </label>
                        </div>

                        {/* Duplicate list */}
                        <div className="max-h-48 overflow-y-auto rounded-md border">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="sticky top-0 border-b bg-muted/80">
                                <th className="px-3 py-2 text-left font-medium">
                                  Row
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                  Import Name
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                  Existing Client
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {duplicates.map((dup) => {
                                const mapped = rowToClient(dup.row, mapping);
                                return (
                                  <tr
                                    key={dup.rowIndex}
                                    className="border-b last:border-b-0"
                                  >
                                    <td className="px-3 py-1.5 text-muted-foreground">
                                      {dup.rowIndex + 1}
                                    </td>
                                    <td className="px-3 py-1.5">
                                      {mapped
                                        ? `${mapped.firstName} ${mapped.lastName}`
                                        : 'Invalid row'}
                                    </td>
                                    <td className="px-3 py-1.5">
                                      {dup.existingClient.firstName}{' '}
                                      {dup.existingClient.lastName}
                                      {dup.existingClient.phone && (
                                        <span className="ml-1 text-muted-foreground">
                                          ({dup.existingClient.phone})
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Skipped rows warning */}
                    {skippedCount > 0 && (
                      <Alert>
                        <AlertTriangle className="size-4" />
                        <AlertDescription>
                          {skippedCount} row{skippedCount !== 1 ? 's' : ''} will
                          be skipped because they are missing both first and last
                          name.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* No valid rows */}
                    {validRows.length === 0 && (
                      <Alert variant="destructive">
                        <X className="size-4" />
                        <AlertDescription>
                          No valid rows to import. Every row is missing a name.
                          Go back and check your column mapping.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={goBack}>
                        <ArrowLeft className="size-4" />
                        Back
                      </Button>
                      <Button
                        onClick={handleImport}
                        disabled={
                          (skipDuplicates ? newCount : validRows.length) === 0
                        }
                      >
                        <Upload className="size-4" />
                        Import{' '}
                        {skipDuplicates ? newCount : validRows.length} Client
                        {(skipDuplicates ? newCount : validRows.length) !== 1
                          ? 's'
                          : ''}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
