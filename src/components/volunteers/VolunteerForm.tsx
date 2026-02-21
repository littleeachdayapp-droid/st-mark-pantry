import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/db/database';
import { useSettings } from '@/contexts/SettingsContext';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import type { PantryDay, Volunteer } from '@/types';

export function VolunteerForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [recurringDays, setRecurringDays] = useState<PantryDay[]>([]);

  // Load existing volunteer data for edit mode
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadVolunteer() {
      const volunteer = await db.volunteers.get(id!);
      if (cancelled) return;

      if (!volunteer) {
        navigate('/volunteers', { replace: true });
        return;
      }

      setFirstName(volunteer.firstName);
      setLastName(volunteer.lastName);
      setPhone(volunteer.phone ?? '');
      setEmail(volunteer.email ?? '');
      setNotes(volunteer.notes ?? '');
      setRecurringDays(volunteer.recurringDays ?? []);
      setLoading(false);
    }

    loadVolunteer();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) return;

    setSaving(true);

    try {
      const now = new Date().toISOString();
      const volunteerData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        recurringDays: recurringDays.length > 0 ? recurringDays : undefined,
      };

      if (isEdit && id) {
        await db.volunteers.update(id, volunteerData);

        // Fire-and-forget sync to Supabase
        if (settings.notificationsEnabled && volunteerData.email) {
          apiPost('/api/volunteers/sync', {
            id,
            firstName: volunteerData.firstName,
            lastName: volunteerData.lastName,
            email: volunteerData.email,
            recurringDays: volunteerData.recurringDays,
          });
        }

        navigate(`/volunteers/${id}`);
      } else {
        const newVolunteer: Volunteer = {
          id: crypto.randomUUID(),
          ...volunteerData,
          createdAt: now,
        };
        await db.volunteers.add(newVolunteer);

        // Fire-and-forget sync to Supabase
        if (settings.notificationsEnabled && volunteerData.email) {
          apiPost('/api/volunteers/sync', {
            id: newVolunteer.id,
            firstName: volunteerData.firstName,
            lastName: volunteerData.lastName,
            email: volunteerData.email,
            recurringDays: volunteerData.recurringDays,
          });
        }

        navigate(`/volunteers/${newVolunteer.id}`);
      }
    } catch {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">
          {isEdit ? 'Edit Volunteer' : 'Add Volunteer'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Volunteer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="h-24 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] placeholder:text-muted-foreground resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this volunteer..."
            />
          </CardContent>
        </Card>

        {/* Regular Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Regular Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Which days does this volunteer regularly serve?
            </p>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurringDays.includes('Monday')}
                  onChange={(e) => {
                    if (e.target.checked) setRecurringDays([...recurringDays, 'Monday']);
                    else setRecurringDays(recurringDays.filter(d => d !== 'Monday'));
                  }}
                  className="rounded border-input"
                />
                Every Monday
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurringDays.includes('Friday')}
                  onChange={(e) => {
                    if (e.target.checked) setRecurringDays([...recurringDays, 'Friday']);
                    else setRecurringDays(recurringDays.filter(d => d !== 'Friday'));
                  }}
                  className="rounded border-input"
                />
                Every Friday
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurringDays.includes('Saturday')}
                  onChange={(e) => {
                    if (e.target.checked) setRecurringDays([...recurringDays, 'Saturday']);
                    else setRecurringDays(recurringDays.filter(d => d !== 'Saturday'));
                  }}
                  className="rounded border-input"
                />
                Every Saturday
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !firstName.trim() || !lastName.trim()}>
            <Save className="size-4" />
            {saving ? 'Saving...' : 'Save Volunteer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
