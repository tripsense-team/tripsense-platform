'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripCollaborationService } from '../services/collaboration-service';
import type {
  InviteTripMemberRequest,
  TripMemberRole,
} from '../types/collaboration';

export function useTripCollaboration(tripId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['trip-collaboration', tripId];

  const {
    data: summary,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => tripCollaborationService.getCollaborationSummary(tripId),
    enabled: !!tripId,
    staleTime: 30 * 1000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  // TF-76: Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: (request: InviteTripMemberRequest) =>
      tripCollaborationService.inviteMember(tripId, request),
    onSuccess: () => {
      invalidate();
    },
  });

  // TF-77: Accept mutation
  const acceptMutation = useMutation({
    mutationFn: (invitationId: string) =>
      tripCollaborationService.acceptInvitation(invitationId),
    onSuccess: () => {
      invalidate();
    },
  });

  // TF-78: Decline mutation
  const declineMutation = useMutation({
    mutationFn: (invitationId: string) =>
      tripCollaborationService.declineInvitation(invitationId),
    onSuccess: () => {
      invalidate();
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: TripMemberRole;
    }) =>
      tripCollaborationService.updateMemberRole(tripId, memberId, { role }),
    onSuccess: () => {
      invalidate();
    },
  });

  // TF-80: Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      tripCollaborationService.removeMember(tripId, memberId),
    onSuccess: () => {
      invalidate();
    },
  });

  // TF-81: Leave trip mutation
  const leaveTripMutation = useMutation({
    mutationFn: () => tripCollaborationService.leaveTrip(tripId),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['user-trips'] });
    },
  });

  const currentUserRole = summary?.currentUserRole ?? 'NON_MEMBER';
  const isOwner = currentUserRole === 'OWNER';
  const canEdit = isOwner || currentUserRole === 'EDITOR';
  const canInvite = canEdit;

  return {
    summary,
    members: summary?.members ?? [],
    pendingInvitations: summary?.pendingInvitations ?? [],
    currentUserRole,
    isOwner,
    canEdit,
    canInvite,
    isLoading,
    isError,
    error,
    refetch,
    // Mutations
    inviteMember: inviteMutation.mutateAsync,
    isInviting: inviteMutation.isPending,
    acceptInvitation: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    declineInvitation: declineMutation.mutateAsync,
    isDeclining: declineMutation.isPending,
    updateMemberRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,
    removeMember: removeMemberMutation.mutateAsync,
    isRemovingMember: removeMemberMutation.isPending,
    leaveTrip: leaveTripMutation.mutateAsync,
    isLeavingTrip: leaveTripMutation.isPending,
  };
}

export function useMyPendingInvitations(email?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['my-pending-invitations', email];

  const query = useQuery({
    queryKey,
    queryFn: () => tripCollaborationService.getMyPendingInvitations(email || undefined),
    enabled: Boolean(email),
    staleTime: 10 * 1000,
  });

  const acceptMutation = useMutation({
    mutationFn: (invitationId: string) =>
      tripCollaborationService.acceptInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-pending-invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['trip-collaboration'] });
      void queryClient.invalidateQueries({ queryKey: ['user-trips'] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (invitationId: string) =>
      tripCollaborationService.declineInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-pending-invitations'] });
    },
  });

  return {
    invitations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    acceptInvitation: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    declineInvitation: declineMutation.mutateAsync,
    isDeclining: declineMutation.isPending,
  };
}

