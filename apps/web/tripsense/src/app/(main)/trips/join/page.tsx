'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users, CheckCircle2, XCircle, ArrowRight, Loader2, Sparkles, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/loading-state';
import { tripCollaborationService } from '@/features/trip-management/services/collaboration-service';
import type { TripInvitationPreview } from '@/features/trip-management/types';
import { useAuth } from '@/features/auth';

function JoinTripContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();

  const [loading, setLoading] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(true);
  const [preview, setPreview] = React.useState<TripInvitationPreview | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [joinedTripId, setJoinedTripId] = React.useState<string | null>(null);
  const [declined, setDeclined] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) {
      setPreviewLoading(false);
      return;
    }
    let active = true;
    tripCollaborationService
      .previewInvitation(token)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Invitation is invalid or expired.');
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const returnUrl = token ? `/trips/join?token=${token}` : '/trips/join';
  const authUrl = (mode: 'signin' | 'signup') => {
    const params = new URLSearchParams({
      [mode]: 'true',
      returnUrl,
    });
    if (preview?.inviteeEmail) params.set('email', preview.inviteeEmail);
    return `/?${params.toString()}`;
  };
  const accountMismatch = Boolean(
    isAuthenticated &&
      user?.email &&
      preview?.inviteeEmail &&
      user.email.toLowerCase() !== preview.inviteeEmail.toLowerCase(),
  );

  const switchToInvitedAccount = async (mode: 'signin' | 'signup') => {
    setLoading(true);
    try {
      await logout();
      router.replace(authUrl(mode));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    if (!isAuthenticated) {
      setError('Please log in or register to accept this trip invitation.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const member = await tripCollaborationService.acceptInvitationByToken(token);
      setSuccess(true);
      setJoinedTripId(member.tripId);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to accept invitation. The invitation may be invalid or expired.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      await tripCollaborationService.declineInvitationByToken(token);
      setDeclined(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to decline invitation.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
          <XCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
          <h1 className="text-xl font-bold">Invalid Invitation Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No invitation token was found in the URL. Please check your invitation email.
          </p>
          <Button
            className="mt-6 rounded-2xl font-bold w-full"
            onClick={() => router.push('/trips')}
          >
            Go to Trips
          </Button>
        </div>
      </div>
    );
  }

  if (previewLoading || authLoading) {
    return <LoadingState className="min-h-[60vh]" text="Checking invitation..." />;
  }

  if (success && joinedTripId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-emerald-500/30 bg-card p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-4">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to the Trip!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You have successfully joined the trip as a collaborator. You can now view and edit the itinerary with your team.
          </p>
          <Button
            className="mt-6 rounded-2xl font-bold w-full bg-primary text-primary-foreground h-11"
            onClick={() => router.push(`/trips/${joinedTripId}`)}
          >
            Open Trip Itinerary <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">Invitation Declined</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You have declined the invitation to join this trip.
          </p>
          <Button
            variant="outline"
            className="mt-6 rounded-2xl font-bold w-full h-11"
            onClick={() => router.push('/trips')}
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[65vh] items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-border bg-card p-8 shadow-xl text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="h-8 w-8" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Collaboration Invitation
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            You&apos;re invited to collaborate{preview?.tripName ? ` on ${preview.tripName}` : ' on a trip'}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Join this trip to co-plan itinerary items, places, and schedules together in real-time.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl bg-destructive/10 p-3 text-xs font-bold text-destructive text-left">
            {error}
          </div>
        )}

        <div className="pt-2 space-y-2.5">
          {accountMismatch ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-left text-sm text-amber-800 dark:text-amber-300">
                This invitation is for <strong>{preview?.inviteeEmail}</strong>, but you are signed in as <strong>{user?.email}</strong>.
              </div>
              <Button
                disabled={loading}
                onClick={() => switchToInvitedAccount('signup')}
                className="w-full rounded-2xl font-bold h-11"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign out & create invited account'}
              </Button>
              <Button variant="outline" disabled={loading} onClick={() => switchToInvitedAccount('signin')} className="w-full rounded-2xl font-bold h-11">
                Log in with {preview?.inviteeEmail}
              </Button>
            </div>
          ) : !isAuthenticated ? (
            <div className="space-y-2.5">
              <Button
                onClick={() => router.push(authUrl('signup'))}
                className="w-full rounded-2xl font-bold h-11 bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all"
              >
                Create account for {preview?.inviteeEmail ?? 'invited email'}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(authUrl('signin'))}
                className="w-full rounded-2xl font-bold h-11"
              >
                <LogIn className="mr-2 h-4 w-4" /> Already have an account? Log in
              </Button>
            </div>
          ) : (
            <Button
              disabled={loading}
              onClick={handleAccept}
              className="w-full rounded-2xl font-bold h-11 bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Accept & Join Trip'
              )}
            </Button>
          )}

          {!accountMismatch && isAuthenticated && (
            <Button
              variant="ghost"
              disabled={loading}
              onClick={handleDecline}
              className="w-full rounded-2xl font-bold h-10 text-muted-foreground hover:text-destructive"
            >
              Decline Invitation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JoinTripPage() {
  return (
    <React.Suspense fallback={<LoadingState className="min-h-[60vh]" text="Loading invitation..." />}>
      <JoinTripContent />
    </React.Suspense>
  );
}
