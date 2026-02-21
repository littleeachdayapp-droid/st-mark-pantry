import { useRef, useState } from 'react'
import { Download, Upload, FileSpreadsheet, Info, Package, Bell, CloudUpload, CloudDownload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { db } from '@/db/database'
import { useSettings } from '@/contexts/SettingsContext'
import { apiPost } from '@/lib/api'
import { DataImport } from './DataImport'
import { GoogleSheetsExport } from './GoogleSheetsExport'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingDown, setSyncingDown] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const exportJSON = async () => {
    try {
      const clients = await db.clients.toArray()
      const visits = await db.visits.toArray()
      const volunteers = await db.volunteers.toArray()
      const volunteerShifts = await db.volunteerShifts.toArray()
      const volunteerSignups = await db.volunteerSignups.toArray()
      const data = {
        clients,
        visits,
        volunteers,
        volunteerShifts,
        volunteerSignups,
        exportedAt: new Date().toISOString(),
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pantry-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      showMessage('success', 'Data exported successfully.')
    } catch {
      showMessage('error', 'Failed to export data.')
    }
  }

  const importJSON = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!data.clients || !data.visits) {
        throw new Error('Invalid backup file format.')
      }

      await db.transaction('rw', [db.clients, db.visits, db.volunteers, db.volunteerShifts, db.volunteerSignups], async () => {
        await db.clients.clear()
        await db.visits.clear()
        await db.volunteers.clear()
        await db.volunteerShifts.clear()
        await db.volunteerSignups.clear()

        if (data.clients?.length) await db.clients.bulkAdd(data.clients)
        if (data.visits?.length) await db.visits.bulkAdd(data.visits)
        if (data.volunteers?.length) await db.volunteers.bulkAdd(data.volunteers)
        if (data.volunteerShifts?.length) await db.volunteerShifts.bulkAdd(data.volunteerShifts)
        if (data.volunteerSignups?.length) await db.volunteerSignups.bulkAdd(data.volunteerSignups)
      })

      const signupCount = data.volunteerSignups?.length ?? 0
      showMessage('success', `Imported ${data.clients.length} clients, ${data.visits.length} visits, ${signupCount} signups.`)
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to import data.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const syncAllVolunteers = async () => {
    setSyncing(true)
    try {
      const volunteers = await db.volunteers.toArray()
      if (volunteers.length === 0) {
        showMessage('error', 'No volunteers to sync.')
        return
      }

      const payload = volunteers.map((v) => ({
        id: v.id,
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        recurringDays: v.recurringDays,
        recurringSlots: v.recurringSlots,
      }))

      const result = await apiPost('/api/volunteers/sync-all', { volunteers: payload })
      if (result.ok) {
        const data = result.data as { synced?: number; failed?: number }
        showMessage('success', `Synced ${data.synced ?? volunteers.length} volunteers to cloud.`)
      } else {
        showMessage('error', result.error || 'Failed to sync volunteers.')
      }
    } catch {
      showMessage('error', 'Failed to sync volunteers.')
    } finally {
      setSyncing(false)
    }
  }

  const syncFromCloud = async () => {
    setSyncingDown(true)
    try {
      const lastSync = localStorage.getItem('lastCloudSync') || undefined
      const url = lastSync
        ? `/api/public/sync-down?since=${encodeURIComponent(lastSync)}`
        : '/api/public/sync-down'

      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch from cloud')
      const data = await res.json() as {
        ok: boolean
        volunteers: Array<{
          id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          recurring_days: string[]
          recurring_slots: string[]
        }>
        signups: Array<{
          id: string
          volunteer_id: string
          date: string
          day_of_week: string
          role: string | null
          status: string
          created_at: string
        }>
        syncedAt: string
      }

      if (!data.ok) throw new Error('Sync failed')

      let newVolunteers = 0
      let updatedVolunteers = 0
      let newSignups = 0

      // Build ID mapping: Supabase ID → local ID (for email-matched volunteers)
      const idMap: Record<string, string> = {}

      // Process volunteers
      for (const sv of data.volunteers) {
        // Try to find by ID first
        const existingById = await db.volunteers.get(sv.id)
        if (existingById) {
          // Update existing
          await db.volunteers.update(sv.id, {
            firstName: sv.first_name,
            lastName: sv.last_name,
            email: sv.email || undefined,
            phone: sv.phone || undefined,
            recurringDays: sv.recurring_days as import('@/types').PantryDay[],
            recurringSlots: sv.recurring_slots,
          })
          idMap[sv.id] = sv.id
          updatedVolunteers++
          continue
        }

        // Try to find by email (case-insensitive)
        if (sv.email) {
          const allVolunteers = await db.volunteers.toArray()
          const emailMatch = allVolunteers.find(
            (v) => v.email && v.email.toLowerCase() === sv.email!.toLowerCase()
          )
          if (emailMatch) {
            // Update existing local volunteer, map Supabase ID → local ID
            await db.volunteers.update(emailMatch.id, {
              firstName: sv.first_name,
              lastName: sv.last_name,
              phone: sv.phone || undefined,
              recurringDays: sv.recurring_days as import('@/types').PantryDay[],
              recurringSlots: sv.recurring_slots,
            })
            idMap[sv.id] = emailMatch.id
            updatedVolunteers++
            continue
          }
        }

        // New volunteer — create locally with Supabase ID
        await db.volunteers.add({
          id: sv.id,
          firstName: sv.first_name,
          lastName: sv.last_name,
          email: sv.email || undefined,
          phone: sv.phone || undefined,
          recurringDays: sv.recurring_days as import('@/types').PantryDay[],
          recurringSlots: sv.recurring_slots,
          createdAt: new Date().toISOString(),
        })
        idMap[sv.id] = sv.id
        newVolunteers++
      }

      // Process signups
      for (const ss of data.signups) {
        const localVolunteerId = idMap[ss.volunteer_id] || ss.volunteer_id

        // Check for duplicate by volunteerId+date compound index
        const existing = await db.volunteerSignups
          .where('[volunteerId+date]')
          .equals([localVolunteerId, ss.date])
          .first()

        if (existing) continue

        await db.volunteerSignups.add({
          id: ss.id,
          volunteerId: localVolunteerId,
          date: ss.date,
          dayOfWeek: ss.day_of_week as import('@/types').PantryDay,
          role: ss.role || undefined,
          status: ss.status as 'signed-up' | 'cancelled',
          createdAt: ss.created_at,
        })
        newSignups++
      }

      localStorage.setItem('lastCloudSync', data.syncedAt)
      showMessage(
        'success',
        `Synced from cloud: ${newVolunteers} new volunteers, ${updatedVolunteers} updated, ${newSignups} new signups.`
      )
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to sync from cloud.')
    } finally {
      setSyncingDown(false)
    }
  }

  const exportExcel = async () => {
    try {
      const clients = await db.clients.toArray()
      const visits = await db.visits.toArray()

      const clientRows = clients.map((c) => ({
        ID: c.id,
        'First Name': c.firstName,
        'Last Name': c.lastName,
        Phone: c.phone || '',
        Email: c.email || '',
        Street: c.address.street,
        City: c.address.city,
        State: c.address.state,
        ZIP: c.address.zip,
        'Family Size': c.numberInFamily,
        Notes: c.notes || '',
        'Created At': c.createdAt,
      }))

      const visitRows = visits.map((v) => ({
        ID: v.id,
        'Client ID': v.clientId,
        Date: v.date,
        Day: v.dayOfWeek,
        'Items Received': v.itemsReceived || '',
        'Served By': v.servedBy || '',
        Notes: v.notes || '',
        'Checked In At': v.checkedInAt,
      }))

      const wb = XLSX.utils.book_new()
      const clientsSheet = XLSX.utils.json_to_sheet(clientRows)
      const visitsSheet = XLSX.utils.json_to_sheet(visitRows)
      XLSX.utils.book_append_sheet(wb, clientsSheet, 'Clients')
      XLSX.utils.book_append_sheet(wb, visitsSheet, 'Visits')
      XLSX.writeFile(wb, `pantry-export-${new Date().toISOString().split('T')[0]}.xlsx`)
      showMessage('success', 'Excel file exported successfully.')
    } catch {
      showMessage('error', 'Failed to export Excel file.')
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-4" />
            Features
          </CardTitle>
          <CardDescription>Enable or disable optional features.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="inventory-toggle" className="text-sm font-medium">
                Inventory Tracking
              </Label>
              <p className="text-xs text-muted-foreground">
                Record items given during check-in
              </p>
            </div>
            <Switch
              id="inventory-toggle"
              checked={settings.inventoryEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ inventoryEnabled: checked === true })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Email Notifications
          </CardTitle>
          <CardDescription>Send confirmation and reminder emails to volunteers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-toggle" className="text-sm font-medium">
                Enable Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Sync volunteer data to send automated reminders
              </p>
            </div>
            <Switch
              id="notifications-toggle"
              checked={settings.notificationsEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ notificationsEnabled: checked === true })
              }
            />
          </div>
          {settings.notificationsEnabled && (
            <>
              <Button
                onClick={syncAllVolunteers}
                variant="outline"
                className="w-full justify-start"
                disabled={syncing}
              >
                <CloudUpload className="size-4" />
                {syncing ? 'Syncing...' : 'Sync All Volunteers to Cloud'}
              </Button>
              <Button
                onClick={syncFromCloud}
                variant="outline"
                className="w-full justify-start"
                disabled={syncingDown}
              >
                <CloudDownload className="size-4" />
                {syncingDown ? 'Syncing...' : 'Sync from Cloud'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Back up and restore your pantry data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={exportJSON} variant="outline" className="w-full justify-start">
            <Download className="size-4" />
            Export All Data (JSON)
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importJSON(file)
            }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full justify-start"
            disabled={importing}
          >
            <Upload className="size-4" />
            {importing ? 'Importing...' : 'Import Data (JSON)'}
          </Button>

          <Button onClick={exportExcel} variant="outline" className="w-full justify-start">
            <FileSpreadsheet className="size-4" />
            Export Clients (Excel)
          </Button>
        </CardContent>
      </Card>

      {/* Import from Spreadsheet */}
      <DataImport onComplete={() => showMessage('success', 'Import completed!')} />

      {/* Google Sheets Export */}
      <GoogleSheetsExport />

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">St. Mark Legacy Food Pantry</p>
          <p>Version v1.0.0</p>
          <p>All data is stored locally on this device.</p>
        </CardContent>
      </Card>
    </div>
  )
}
