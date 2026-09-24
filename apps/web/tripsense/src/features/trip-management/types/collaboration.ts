export type TripMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export type TripInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  role: TripMemberRole;
  joinedAt: string;
}

export interface TripInvitation {
  id: string;
  tripId: string;
  tripName: string;
  inviterUserId: string;
  inviteeEmail: string;
  role: TripMemberRole;
  status: TripInvitationStatus;
  invitationToken: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

export interface TripCollaborationSummary {
  members: TripMember[];
  pendingInvitations: TripInvitation[];
  currentUserRole: TripMemberRole | 'NON_MEMBER';
}

export interface InviteTripMemberRequest {
  email: string;
  role: TripMemberRole;
  message?: string;
}

export interface UpdateMemberRoleRequest {
  role: TripMemberRole;
}
