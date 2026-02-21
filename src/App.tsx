import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { CheckInPage } from '@/components/checkin/CheckInPage'
import { ClientListPage } from '@/components/clients/ClientListPage'
import { ClientDetail } from '@/components/clients/ClientDetail'
import { ClientForm } from '@/components/clients/ClientForm'
import { VolunteerListPage } from '@/components/volunteers/VolunteerListPage'
import { VolunteerDetail } from '@/components/volunteers/VolunteerDetail'
import { VolunteerForm } from '@/components/volunteers/VolunteerForm'
import { VolunteerCheckIn } from '@/components/volunteers/VolunteerCheckIn'
import { VolunteerSchedule } from '@/components/volunteers/VolunteerSchedule'
import { VolunteerCalendar } from '@/components/volunteers/VolunteerCalendar'
import { ReportsPage } from '@/components/reports/ReportsPage'
import { InactiveClientsPage } from '@/components/reports/InactiveClientsPage'
import { SettingsPage } from '@/components/settings/SettingsPage'

const PASS = 'stmark'
const STORAGE_KEY = 'pantry-auth'

function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  if (authed) return <>{children}</>

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim().toLowerCase() === PASS) {
      localStorage.setItem(STORAGE_KEY, 'true')
      setAuthed(true)
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs space-y-4 rounded-xl bg-card p-6 shadow-lg"
      >
        <div className="text-center">
          <span className="text-3xl">🌾</span>
          <h1 className="mt-2 text-lg font-bold">St. Mark Food Pantry</h1>
          <p className="text-sm text-muted-foreground">Enter password to continue</p>
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false) }}
          placeholder="Password"
          autoFocus
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {error && <p className="text-sm text-destructive">Incorrect password</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Enter
        </button>
      </form>
    </div>
  )
}

export function App() {
  return (
    <LoginGate>
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="checkin" element={<CheckInPage />} />
        <Route path="clients" element={<ClientListPage />} />
        <Route path="clients/new" element={<ClientForm />} />
<Route path="clients/:id" element={<ClientDetail />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
        <Route path="volunteers" element={<VolunteerListPage />} />
        <Route path="volunteers/new" element={<VolunteerForm />} />
        <Route path="volunteers/checkin" element={<VolunteerCheckIn />} />
        <Route path="volunteers/schedule" element={<VolunteerSchedule />} />
        <Route path="volunteers/calendar" element={<VolunteerCalendar />} />
        <Route path="volunteers/:id" element={<VolunteerDetail />} />
        <Route path="volunteers/:id/edit" element={<VolunteerForm />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/inactive" element={<InactiveClientsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
    </LoginGate>
  )
}
