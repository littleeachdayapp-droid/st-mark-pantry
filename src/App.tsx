import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { CheckInPage } from '@/components/checkin/CheckInPage'
import { ClientListPage } from '@/components/clients/ClientListPage'
import { ClientDetail } from '@/components/clients/ClientDetail'
import { ClientForm } from '@/components/clients/ClientForm'
import { PrintAllCards } from '@/components/clients/PrintAllCards'
import { VolunteerListPage } from '@/components/volunteers/VolunteerListPage'
import { VolunteerDetail } from '@/components/volunteers/VolunteerDetail'
import { VolunteerForm } from '@/components/volunteers/VolunteerForm'
import { VolunteerCheckIn } from '@/components/volunteers/VolunteerCheckIn'
import { VolunteerSchedule } from '@/components/volunteers/VolunteerSchedule'
import { ReportsPage } from '@/components/reports/ReportsPage'
import { InactiveClientsPage } from '@/components/reports/InactiveClientsPage'
import { SettingsPage } from '@/components/settings/SettingsPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="checkin" element={<CheckInPage />} />
        <Route path="clients" element={<ClientListPage />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/cards" element={<PrintAllCards />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
        <Route path="volunteers" element={<VolunteerListPage />} />
        <Route path="volunteers/new" element={<VolunteerForm />} />
        <Route path="volunteers/checkin" element={<VolunteerCheckIn />} />
        <Route path="volunteers/schedule" element={<VolunteerSchedule />} />
        <Route path="volunteers/:id" element={<VolunteerDetail />} />
        <Route path="volunteers/:id/edit" element={<VolunteerForm />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/inactive" element={<InactiveClientsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
