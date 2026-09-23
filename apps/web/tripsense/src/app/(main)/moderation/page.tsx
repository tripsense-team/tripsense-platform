import { AuthGuard, UserRole } from "@/features/auth";
import { CommunityModerationScreen } from "@/features/social-post";

export const metadata = {
  title: "Kiểm duyệt Community | TripSense",
};

export default function ModerationPage() {
  return (
    <AuthGuard allowedRoles={[UserRole.ADMIN, UserRole.MODERATOR]}>
      <CommunityModerationScreen />
    </AuthGuard>
  );
}
