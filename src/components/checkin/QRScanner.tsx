import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, Check, AlertTriangle } from 'lucide-react';
import type { Client, PantryDay } from '@/types';

interface QRScannerProps {
  selectedDay: PantryDay | null;
  selectedDate: string;
  onCheckIn: (client: Client) => Promise<void>;
}

export function QRScanner({ selectedDay, selectedDate, onCheckIn }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [scannedClient, setScannedClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const containerIdRef = useRef<string>('qr-reader-' + Math.random().toString(36).slice(2));

  // Start scanning
  const startScanning = useCallback(async () => {
    setError(null);
    setScannedClient(null);
    setAlreadyCheckedIn(false);

    try {
      // Dynamically import html5-qrcode to avoid DOM access at module level
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(containerIdRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          // Stop scanning after successful read
          try {
            await scanner.stop();
          } catch {
            // ignore stop errors
          }
          setScanning(false);

          // Look up client by the scanned ID
          const client = await db.clients.get(decodedText);
          if (!client) {
            setError('Unknown QR code. Client not found.');
            return;
          }

          // Check if already checked in today
          const existingVisit = await db.visits
            .where('[clientId+date]')
            .equals([client.id, selectedDate])
            .first();

          setScannedClient(client);
          setAlreadyCheckedIn(!!existingVisit);
        },
        () => {
          // Ignore scan failures (no QR in frame)
        }
      );
      setScanning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start camera');
    }
  }, [selectedDate]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  // Handle check-in of scanned client
  const handleCheckIn = async () => {
    if (!scannedClient) return;
    setCheckingIn(true);
    try {
      await onCheckIn(scannedClient);
      setScannedClient(null);
      setAlreadyCheckedIn(false);
    } finally {
      setCheckingIn(false);
    }
  };

  // Reset for next scan
  const resetScan = () => {
    setScannedClient(null);
    setError(null);
    setAlreadyCheckedIn(false);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Scanner viewport — always in the DOM so html5-qrcode can find it */}
        <div
          id={containerIdRef.current}
          className={scanning ? 'rounded-lg overflow-hidden' : 'hidden'}
        />

        {/* Start scanning button */}
        {!scanning && !scannedClient && !error && (
          <Button
            onClick={startScanning}
            disabled={!selectedDay}
            className="w-full"
            variant="outline"
          >
            <Camera className="size-4" />
            Scan QR Code
          </Button>
        )}

        {/* Stop scanning button */}
        {scanning && (
          <Button onClick={stopScanning} variant="outline" className="w-full">
            <CameraOff className="size-4" />
            Stop Scanner
          </Button>
        )}

        {/* Scanned result */}
        {scannedClient && (
          <div className="text-center space-y-3">
            <p className="text-lg font-bold">
              {scannedClient.firstName} {scannedClient.lastName}
            </p>
            <Badge variant="secondary">
              Family of {scannedClient.numberInFamily}
            </Badge>
            {alreadyCheckedIn ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Check className="size-4" />
                  Already checked in today
                </p>
                <Button variant="outline" onClick={resetScan} className="w-full">
                  Scan Another
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                >
                  <Check className="size-4" />
                  {checkingIn ? 'Checking In...' : 'Check In'}
                </Button>
                <Button variant="ghost" onClick={resetScan} className="w-full">
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center space-y-3">
            <p className="text-sm text-destructive flex items-center justify-center gap-1">
              <AlertTriangle className="size-4" />
              {error}
            </p>
            <Button variant="outline" onClick={resetScan} className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
