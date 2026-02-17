import { NavLink } from 'react-router-dom'
import {
  ClipboardCheck,
  Users,
  HandHeart,
  BarChart3,
  Settings,
} from 'lucide-react'

const tabs = [
  { to: '/', label: 'Check-In', icon: ClipboardCheck, end: true },
  { to: '/clients', label: 'Clients', icon: Users, end: false },
  { to: '/volunteers', label: 'Volunteers', icon: HandHeart, end: false },
  { to: '/reports', label: 'Reports', icon: BarChart3, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export function BottomNav() {
  return (
    <nav className="border-t bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                isActive
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              }`
            }
          >
            <tab.icon className="size-6" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
