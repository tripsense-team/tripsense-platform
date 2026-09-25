import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tripCollaborationService } from '../services/collaboration-service';
import { apiClient } from '@/services/api-client';

vi.mock('@/services/api-client', () => ({
  apiClient: vi.fn(),
}));

describe('tripCollaborationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invites a member to a trip (TF-76)', async () => {
    const mockInvitation = {
      id: 'inv-1',
      tripId: 'trip-1',
      inviteeEmail: 'alex@example.com',
      role: 'EDITOR',
      status: 'PENDING',
      invitationToken: 'token123',
    };

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockInvitation,
    });

    const result = await tripCollaborationService.inviteMember('trip-1', {
      email: 'alex@example.com',
      role: 'EDITOR',
      message: 'Join my trip!',
    });

    expect(apiClient).toHaveBeenCalledWith('/api/trips/trip-1/invitations', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex@example.com',
        role: 'EDITOR',
        message: 'Join my trip!',
      }),
    });
    expect(result).toEqual(mockInvitation);
  });

  it('accepts an invitation by token (TF-77)', async () => {
    const mockMember = {
      id: 'mem-1',
      tripId: 'trip-1',
      userId: 'user-1',
      role: 'EDITOR',
      joinedAt: '2026-09-24T15:00:00Z',
    };

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockMember,
    });

    const result = await tripCollaborationService.acceptInvitationByToken('token123');

    expect(apiClient).toHaveBeenCalledWith(
      '/api/trips/invitations/token/token123/accept',
      {
        method: 'POST',
      }
    );
    expect(result).toEqual(mockMember);
  });

  it('fetches user pending invitations (TF-77/78)', async () => {
    const mockInvitations = [
      {
        id: 'inv-1',
        tripId: 'trip-1',
        inviteeEmail: 'alex@example.com',
        role: 'EDITOR',
        status: 'PENDING',
        invitationToken: 'token123',
      },
    ];

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockInvitations,
    });

    const result = await tripCollaborationService.getMyPendingInvitations();

    expect(apiClient).toHaveBeenCalledWith('/api/trips/invitations/pending');
    expect(result).toEqual(mockInvitations);
  });

  it('declines an invitation (TF-78)', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: null,
    });

    await tripCollaborationService.declineInvitation('inv-1');

    expect(apiClient).toHaveBeenCalledWith(
      '/api/trips/invitations/inv-1/decline',
      {
        method: 'POST',
      }
    );
  });

  it('fetches trip collaboration summary (TF-79)', async () => {
    const mockSummary = {
      members: [
        {
          id: 'mem-1',
          tripId: 'trip-1',
          userId: 'owner-id',
          role: 'OWNER',
          joinedAt: '2026-09-24T15:00:00Z',
        },
      ],
      pendingInvitations: [],
      currentUserRole: 'OWNER',
    };

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockSummary,
    });

    const result = await tripCollaborationService.getCollaborationSummary('trip-1');

    expect(apiClient).toHaveBeenCalledWith('/api/trips/trip-1/collaboration');
    expect(result).toEqual(mockSummary);
  });

  it('removes a member from trip (TF-80)', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce(undefined);

    await tripCollaborationService.removeMember('trip-1', 'mem-2');

    expect(apiClient).toHaveBeenCalledWith(
      '/api/trips/trip-1/members/mem-2',
      {
        method: 'DELETE',
      }
    );
  });

  it('leaves a shared trip (TF-81)', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce(undefined);

    await tripCollaborationService.leaveTrip('trip-1');

    expect(apiClient).toHaveBeenCalledWith('/api/trips/trip-1/leave', {
      method: 'POST',
    });
  });
});
