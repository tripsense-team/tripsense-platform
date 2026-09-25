import { apiClient } from '@/services/api-client';
import type {
  ApiResponse,
  TripCollaborationSummary,
  TripInvitation,
  TripMember,
  InviteTripMemberRequest,
  UpdateMemberRoleRequest,
} from '../types';

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  return (await request).data;
}

export const tripCollaborationService = {
  // TF-76: Send trip invitation
  inviteMember(
    tripId: string,
    payload: InviteTripMemberRequest
  ): Promise<TripInvitation> {
    return unwrap(
      apiClient<ApiResponse<TripInvitation>>(`/api/trips/${tripId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
  },

  // TF-76/79: List invitations for a trip
  getTripInvitations(tripId: string): Promise<TripInvitation[]> {
    return unwrap(
      apiClient<ApiResponse<TripInvitation[]>>(
        `/api/trips/${tripId}/invitations`
      )
    );
  },

  // TF-77/78: Get current user's pending invitations
  getMyPendingInvitations(): Promise<TripInvitation[]> {
    return unwrap(
      apiClient<ApiResponse<TripInvitation[]>>(
        '/api/trips/invitations/pending'
      )
    );
  },

  // TF-77: Accept trip invitation
  acceptInvitation(invitationId: string): Promise<TripMember> {
    return unwrap(
      apiClient<ApiResponse<TripMember>>(
        `/api/trips/invitations/${invitationId}/accept`,
        {
          method: 'POST',
        }
      )
    );
  },

  // TF-77 (by token): Accept invitation
  acceptInvitationByToken(token: string): Promise<TripMember> {
    return unwrap(
      apiClient<ApiResponse<TripMember>>(
        `/api/trips/invitations/token/${token}/accept`,
        {
          method: 'POST',
        }
      )
    );
  },

  // TF-78: Decline trip invitation
  async declineInvitation(invitationId: string): Promise<void> {
    await apiClient<ApiResponse<void>>(
      `/api/trips/invitations/${invitationId}/decline`,
      {
        method: 'POST',
      }
    );
  },

  // TF-78 (by token): Decline invitation
  async declineInvitationByToken(token: string): Promise<void> {
    await apiClient<ApiResponse<void>>(
      `/api/trips/invitations/token/${token}/decline`,
      {
        method: 'POST',
      }
    );
  },

  // TF-79: Get trip members
  getTripMembers(tripId: string): Promise<TripMember[]> {
    return unwrap(
      apiClient<ApiResponse<TripMember[]>>(`/api/trips/${tripId}/members`)
    );
  },

  // TF-79: Get collaboration summary (members + pending invites + current user role)
  getCollaborationSummary(tripId: string): Promise<TripCollaborationSummary> {
    return unwrap(
      apiClient<ApiResponse<TripCollaborationSummary>>(
        `/api/trips/${tripId}/collaboration`
      )
    );
  },

  // Update member role
  updateMemberRole(
    tripId: string,
    memberId: string,
    payload: UpdateMemberRoleRequest
  ): Promise<TripMember> {
    return unwrap(
      apiClient<ApiResponse<TripMember>>(
        `/api/trips/${tripId}/members/${memberId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      )
    );
  },

  // TF-80: Remove member from trip (Owner only)
  async removeMember(tripId: string, memberId: string): Promise<void> {
    await apiClient<void>(`/api/trips/${tripId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },

  // TF-81: Leave a shared trip
  async leaveTrip(tripId: string): Promise<void> {
    await apiClient<void>(`/api/trips/${tripId}/leave`, {
      method: 'POST',
    });
  },
};
