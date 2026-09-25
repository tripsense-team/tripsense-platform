'use client';

import * as React from 'react';
import {
  Users,
  Mail,
  Shield,
  Trash2,
  LogOut,
  Copy,
  Check,
  Clock,
  Send,
  AlertCircle,
  Crown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { useTripCollaboration } from '../hooks/use-trip-collaboration';
import type { TripMemberRole } from '../types/collaboration';

interface TripMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripName: string;
}

export function TripMembersDialog({
  open,
  onOpenChange,
  tripId,
  tripName,
}: TripMembersDialogProps) {
  const router = useRouter();
  const {
    members,
    pendingInvitations,
    currentUserRole,
    isOwner,
    canInvite,
    inviteMember,
    isInviting,
    removeMember,
    isRemovingMember,
    leaveTrip,
    isLeavingTrip,
  } = useTripCollaboration(tripId);

  const [activeTab, setActiveTab] = React.useState<'members' | 'invite'>('members');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<TripMemberRole>('EDITOR');
  const [message, setMessage] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<{
    type: 'REMOVE' | 'LEAVE';
    memberId?: string;
    memberName?: string;
  } | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [copiedToken, setCopiedToken] = React.useState<string | null>(null);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!email || !email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    try {
      await inviteMember({
        email: email.trim(),
        role,
        message: message.trim() || undefined,
      });
      setFormSuccess(`Invitation sent to ${email}!`);
      setEmail('');
      setMessage('');
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Failed to send invitation. Please try again.';
      setFormError(errorMsg);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setActionError(null);
    try {
      if (confirmAction.type === 'REMOVE' && confirmAction.memberId) {
        await removeMember(confirmAction.memberId);
        setConfirmAction(null);
      } else if (confirmAction.type === 'LEAVE') {
        await leaveTrip();
        setConfirmAction(null);
        onOpenChange(false);
        router.push('/trips');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Action failed. Please try again.';
      setActionError(msg);
    }
  };

  const copyInviteLink = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/trips/join?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Users className="h-5 w-5 text-primary" />
            Trip Collaboration
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
            {tripName}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as 'members' | 'invite');
            setFormError(null);
            setFormSuccess(null);
          }}
          className="mt-2"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/60 p-1">
            <TabsTrigger
              value="members"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs"
            >
              Members ({members.length})
            </TabsTrigger>
            <TabsTrigger
              value="invite"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-2xs"
            >
              Invite ({pendingInvitations.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Members (TF-79, TF-80, TF-81) */}
          <TabsContent value="members" className="mt-4 space-y-4">
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-2xs transition-all hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {m.displayName
                        ? m.displayName.charAt(0).toUpperCase()
                        : m.email
                          ? m.email.charAt(0).toUpperCase()
                          : 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {m.displayName || m.email || `User (${m.userId.substring(0, 8)})`}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {m.role === 'OWNER' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            <Crown className="h-3 w-3" /> Owner
                          </span>
                        )}
                        {m.role === 'EDITOR' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            <Shield className="h-3 w-3" /> Editor
                          </span>
                        )}
                        {m.role === 'VIEWER' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            Viewer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (TF-80: Kick Member) */}
                  <div className="flex items-center gap-2">
                    {isOwner && m.role !== 'OWNER' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                        onClick={() =>
                          setConfirmAction({
                            type: 'REMOVE',
                            memberId: m.id,
                            memberName: m.displayName || m.email || 'this member',
                          })
                        }
                        disabled={isRemovingMember}
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {actionError && (
              <div className="rounded-2xl bg-destructive/10 p-3 text-xs font-bold text-destructive">
                {actionError}
              </div>
            )}

            {/* Inline Confirmation Card */}
            {confirmAction && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <p className="text-xs font-bold text-destructive">
                  {confirmAction.type === 'REMOVE'
                    ? `Are you sure you want to remove ${confirmAction.memberName} from the trip?`
                    : 'Are you sure you want to leave this shared trip? You will lose access.'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-xs font-bold flex-1"
                    onClick={() => setConfirmAction(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold flex-1"
                    onClick={executeConfirmAction}
                    disabled={isRemovingMember || isLeavingTrip}
                  >
                    {isRemovingMember || isLeavingTrip ? 'Processing...' : 'Confirm'}
                  </Button>
                </div>
              </div>
            )}

            {/* TF-81: Leave trip button for non-owners */}
            {!isOwner && currentUserRole !== 'NON_MEMBER' && !confirmAction && (
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/10 border-destructive/30 rounded-2xl font-bold text-sm h-10"
                  onClick={() =>
                    setConfirmAction({
                      type: 'LEAVE',
                    })
                  }
                  disabled={isLeavingTrip}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave this trip
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Invite Collaborator (TF-76, TF-79) */}
          <TabsContent value="invite" className="mt-4 space-y-4">
            {canInvite ? (
              <form onSubmit={handleSendInvite} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Collaborator Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="friend@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 rounded-2xl h-10 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Role & Permissions
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as TripMemberRole)}
                    aria-label="Role & Permissions"
                    className="w-full h-10 px-3 rounded-2xl border border-input bg-background text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-primary"
                  >
                    <option value="EDITOR">Editor (Can add & edit itinerary items)</option>
                    <option value="VIEWER">Viewer (Can view only)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Note / Message (Optional)
                  </label>
                  <Input
                    placeholder="Hey! Join me to plan our itinerary..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="rounded-2xl h-10 text-sm"
                  />
                </div>

                {formError && (
                  <div className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-xs font-bold text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4 shrink-0" />
                    {formSuccess}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isInviting || !email}
                  className="w-full rounded-2xl font-bold h-10 bg-primary text-primary-foreground"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isInviting ? 'Sending Invite...' : 'Send Invitation'}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl border border-border p-4 text-center text-xs text-muted-foreground">
                Only the trip owner and editors can invite collaborators.
              </div>
            )}

            {/* Pending Invitations list */}
            {pendingInvitations.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground mb-2">
                  Pending Invitations ({pendingInvitations.length})
                </p>
                <div className="max-h-[160px] overflow-y-auto space-y-2">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-2.5 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold truncate">{inv.inviteeEmail}</p>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                          <span className="font-semibold text-primary">({inv.role})</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg text-[11px] font-bold px-2"
                        onClick={() => copyInviteLink(inv.invitationToken)}
                      >
                        {copiedToken === inv.invitationToken ? (
                          <>
                            <Check className="mr-1 h-3 w-3 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            Link
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
