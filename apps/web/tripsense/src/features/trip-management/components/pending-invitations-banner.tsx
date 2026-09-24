'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Check, X, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useMyPendingInvitations } from '../hooks/use-trip-collaboration';

export function PendingInvitationsBanner() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const {
    invitations,
    acceptInvitation,
    declineInvitation,
    isAccepting,
    isDeclining,
  } = useMyPendingInvitations(user?.email);

  const [activeActionId, setActiveActionId] = React.useState<string | null>(null);
  const [successNotice, setSuccessNotice] = React.useState<string | null>(null);

  if (!invitations || invitations.length === 0) {
    return null;
  }

  const handleAccept = async (invitationId: string, tripId: string) => {
    try {
      setActiveActionId(invitationId);
      await acceptInvitation(invitationId);
      setSuccessNotice('You have joined the trip successfully! Redirecting...');
      setTimeout(() => {
        router.push(`/trips/${tripId}`);
        router.refresh();
      }, 1000);
    } catch {
      // Error handled by query
    } finally {
      setActiveActionId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      setActiveActionId(invitationId);
      await declineInvitation(invitationId);
    } catch {
      // Error handled by query
    } finally {
      setActiveActionId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4">
      {successNotice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          {successNotice}
        </div>
      )}
      <div className="space-y-3">
        {invitations.map((inv) => (
          <div
            key={inv.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm backdrop-blur-xs"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-black tracking-normal">
                    Trip Invitation: {inv.tripName || 'Trip collaboration'}
                  </h4>
                  <Badge variant="secondary" className="rounded-full text-xs font-semibold">
                    <Shield className="mr-1 h-3 w-3" />
                    {inv.role}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {inv.message ? `"${inv.message}"` : `You have been invited to collaborate as an ${inv.role}.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs font-semibold text-destructive hover:bg-destructive/10"
                disabled={activeActionId === inv.id && isDeclining}
                onClick={() => handleDecline(inv.id)}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Decline
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-full px-4 text-xs font-bold"
                disabled={activeActionId === inv.id && isAccepting}
                onClick={() => handleAccept(inv.id, inv.tripId)}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                {activeActionId === inv.id && isAccepting ? 'Joining...' : 'Accept'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
