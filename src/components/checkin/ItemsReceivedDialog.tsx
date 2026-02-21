import { useState } from 'react';
import { db } from '@/db/database';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ItemsReceivedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  clientName: string;
}

export function ItemsReceivedDialog({
  open,
  onOpenChange,
  visitId,
  clientName,
}: ItemsReceivedDialogProps) {
  const [items, setItems] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!items.trim()) {
      onOpenChange(false);
      setItems('');
      return;
    }
    setSaving(true);
    try {
      await db.visits.update(visitId, { itemsReceived: items.trim() });
    } finally {
      setSaving(false);
      setItems('');
      onOpenChange(false);
    }
  };

  const handleSkip = () => {
    setItems('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Items Given</DialogTitle>
          <DialogDescription>
            What items were given to {clientName}? (Optional)
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={items}
          onChange={(e) => setItems(e.target.value)}
          placeholder="e.g., 2 bags rice, canned goods, produce box"
          rows={3}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleSkip} disabled={saving}>
            Skip
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
