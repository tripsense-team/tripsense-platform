"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MoreVertical,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  fetchAdminUsers,
  fetchAdminUserTripCounts,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../api/admin-users-api";
import type {
  AdminTargetUserStatus,
  AdminUserItem,
  AdminUserPageResponse,
  AdminUserRole,
  AdminUserStatus,
} from "../types/admin-users.types";

const PAGE_SIZE = 20;
const FALLBACK_LOAD_ERROR = "__ADMIN_USERS_LOAD_ERROR__";

type PendingConfirmation =
  | { type: "status"; user: AdminUserItem; targetStatus: AdminTargetUserStatus }
  | { type: "role"; user: AdminUserItem; targetRole: AdminUserRole };

function getDisplayLabel(user: AdminUserItem): string {
  if (user.displayName && user.displayName.trim().length > 0) {
    return user.displayName.trim();
  }
  return user.email.split("@")[0] || user.email;
}

function getInitials(label: string): string {
  const clean = label.trim();
  return clean.length >= 2 ? clean.slice(0, 2).toUpperCase() : clean.toUpperCase() || "U";
}

function formatJoinedDate(iso: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 10);
}

export function AdminUsersView() {
  const { t } = useTranslation();
  const currentAdminId = useAuthStore((state) => state.user?.id ?? null);

  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"ALL" | AdminUserRole>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | AdminUserStatus>("ALL");
  const [page, setPage] = React.useState(0);

  const [pageData, setPageData] = React.useState<AdminUserPageResponse | null>(null);
  const [tripCounts, setTripCounts] = React.useState<Record<string, number> | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [pendingAction, setPendingAction] = React.useState<PendingConfirmation | null>(null);
  const [isMutating, setIsMutating] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = searchInput.trim();
        if (prev !== next) {
          setIsLoading(true);
          setPage(0);
        }
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadUsers = React.useCallback(
    async (targetPage = page, signal?: { cancelled: boolean }) => {
      try {
        const result = await fetchAdminUsers({
          page: targetPage,
          size: PAGE_SIZE,
          search: debouncedSearch,
          role: roleFilter,
          status: statusFilter,
        });
        if (signal?.cancelled) return;
        setPageData(result);
        setLoadError(null);

        const userIds = result.items.map((item) => item.id);
        const counts = await fetchAdminUserTripCounts(userIds);
        if (!signal?.cancelled) {
          setTripCounts(counts);
        }
      } catch (err) {
        if (!signal?.cancelled) {
          setLoadError(getSafeErrorMessage(err, FALLBACK_LOAD_ERROR));
        }
      } finally {
        if (!signal?.cancelled) {
          setIsLoading(false);
        }
      }
    },
    [debouncedSearch, page, roleFilter, statusFilter],
  );

  React.useEffect(() => {
    const signal = { cancelled: false };
    void (async () => {
      await loadUsers(page, signal);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [loadUsers, page]);

  const handleRefresh = () => {
    setIsLoading(true);
    void loadUsers(page);
  };

  const handleRoleFilterChange = (nextRole: "ALL" | AdminUserRole) => {
    if (nextRole !== roleFilter) {
      setIsLoading(true);
    }
    setRoleFilter(nextRole);
    setPage(0);
  };

  const handleStatusFilterChange = (nextStatus: "ALL" | AdminUserStatus) => {
    if (nextStatus !== statusFilter) {
      setIsLoading(true);
    }
    setStatusFilter(nextStatus);
    setPage(0);
  };

  const executeConfirmedAction = async () => {
    if (!pendingAction) return;
    setIsMutating(true);
    const displayLabel = getDisplayLabel(pendingAction.user);

    try {
      if (pendingAction.type === "status") {
        await updateAdminUserStatus(pendingAction.user.id, pendingAction.targetStatus);
        toast.success(
          t("admin.users.actions.statusUpdated", { name: displayLabel }) ||
            `Updated status for ${displayLabel}`,
        );
      } else {
        await updateAdminUserRole(pendingAction.user.id, pendingAction.targetRole);
        toast.success(
          t("admin.users.actions.roleUpdated", { name: displayLabel }) ||
            `Updated role for ${displayLabel}`,
        );
      }
      setPendingAction(null);
      await loadUsers(page);
    } catch (err) {
      toast.error(
        getSafeErrorMessage(
          err,
          t("admin.users.actions.updateError") || "Could not update user account.",
        ),
      );
    } finally {
      setIsMutating(false);
    }
  };

  const getRoleLabel = (role: AdminUserRole) => {
    if (role === "ADMIN") return t("admin.users.roles.admin") || "Administrator";
    if (role === "PARTNER") return t("admin.users.roles.partner") || "Partner";
    return t("admin.users.roles.user") || "User";
  };

  const getStatusLabel = (status: AdminUserStatus) => {
    if (status === "ACTIVE") return t("admin.users.status.active") || "Active";
    if (status === "INACTIVE") return t("admin.users.status.suspended") || "Suspended";
    return t("admin.users.status.unverified") || "Unverified";
  };

  const items = pageData?.items ?? [];
  const summary = pageData?.summary;
  const totalPages = pageData?.totalPages ?? 0;
  const totalElements = pageData?.totalElements ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Users className="h-3.5 w-3.5 mr-1" /> {t("admin.users.directory") || "Directory"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t("admin.users.management") || "User Management"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("admin.users.title") || "User Accounts"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.users.subtitle") ||
              "Manage user roles, verify accounts, and oversee platform access."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary text-primary-foreground font-mono text-xs px-3 py-1">
            {t("admin.users.totalUsers", { count: summary?.totalUsers ?? totalElements }) ||
              `Total: ${summary?.totalUsers ?? totalElements} Users`}
          </Badge>
          {summary && (
            <>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs"
              >
                {t("admin.users.summary.active", { count: summary.activeUsers })}
              </Badge>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-mono text-xs"
              >
                {t("admin.users.summary.unverified", { count: summary.unverifiedUsers })}
              </Badge>
              <Badge
                variant="outline"
                className="bg-destructive/10 text-destructive border-destructive/20 font-mono text-xs"
              >
                {t("admin.users.summary.suspended", { count: summary.inactiveUsers })}
              </Badge>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {t("admin.users.refresh") || "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between bg-card border border-border p-4 rounded-xl shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("admin.users.searchPlaceholder") || "Search by name or email..."}
            aria-label={t("admin.users.searchPlaceholder") || "Search by name or email..."}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs flex-wrap">
            <span className="text-muted-foreground px-2 font-medium">
              {t("admin.users.roleFilter") || "Role:"}
            </span>
            {(["ALL", "USER", "PARTNER", "ADMIN"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleFilterChange(role)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  roleFilter === role
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {role === "ALL" ? t("admin.users.all") || "All" : getRoleLabel(role)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs flex-wrap">
            <span className="text-muted-foreground px-2 font-medium">
              {t("admin.users.statusFilter") || "Status:"}
            </span>
            {(["ALL", "ACTIVE", "INACTIVE", "UNVERIFIED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleStatusFilterChange(st)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === st
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "ALL" ? t("admin.users.all") || "All" : getStatusLabel(st)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error State */}
      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              {loadError === FALLBACK_LOAD_ERROR
                ? t("admin.users.loadError") || "Could not load users from the server."
                : loadError}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            {t("admin.users.refresh") || "Refresh"}
          </Button>
        </div>
      )}

      {/* Users Table */}
      <Card className="bg-card border-border shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-micro tracking-wider font-semibold">
              <tr>
                <th className="p-4">{t("admin.users.table.user") || "User"}</th>
                <th className="p-4">{t("admin.users.table.role") || "Role"}</th>
                <th className="p-4">{t("admin.users.table.status") || "Status"}</th>
                <th className="p-4">{t("admin.users.status.verified") || "Verified"}</th>
                <th className="p-4">{t("admin.users.table.provider") || "Provider"}</th>
                <th className="p-4">{t("admin.users.table.trips") || "Trips"}</th>
                <th className="p-4">{t("admin.users.table.joined") || "Joined"}</th>
                <th className="p-4 text-right">{t("admin.users.table.actions") || "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && items.length === 0 ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="p-4" colSpan={8}>
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {t("admin.users.empty") || "No users match your criteria."}
                  </td>
                </tr>
              ) : (
                items.map((user) => {
                  const label = getDisplayLabel(user);
                  const isSelf = currentAdminId !== null && currentAdminId === user.id;
                  const nextToggleStatus: AdminTargetUserStatus =
                    user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                  const tripCount =
                    tripCounts === null ? null : (tripCounts[user.id] ?? 0);

                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border">
                            {user.avatarUrl && (
                              <AvatarImage src={user.avatarUrl} alt={label} />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {getInitials(label)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                              <span className="truncate">{label}</span>
                              {isSelf && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-primary/30 bg-primary/5 text-primary"
                                >
                                  {t("admin.users.actions.currentAccount") || "Current session"}
                                </Badge>
                              )}
                            </div>
                            <div className="text-micro text-muted-foreground flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant="outline"
                            className={
                              user.role === "ADMIN"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                : user.role === "PARTNER"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                  : "bg-muted text-muted-foreground border-border"
                            }
                          >
                            {getRoleLabel(user.role)}
                          </Badge>
                          {user.partnerEnrolled && user.role !== "PARTNER" && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              + {t("admin.users.partnerEnrolled") || "Partner Enrolled"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <Badge
                          className={
                            user.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : user.status === "UNVERIFIED"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                          }
                        >
                          {getStatusLabel(user.status)}
                        </Badge>
                      </td>

                      <td className="p-4">
                        {user.status !== "UNVERIFIED" ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t("admin.users.status.verified") || "Verified"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Clock className="h-3.5 w-3.5" />
                            {t("admin.users.status.unverified") || "Unverified"}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {user.authProvider === "GOOGLE"
                            ? t("admin.users.provider.google") || "Google"
                            : t("admin.users.provider.local") || "Email"}
                        </Badge>
                      </td>

                      <td className="p-4 font-mono font-medium text-foreground">
                        {tripCount === null ? "—" : tripCount}
                      </td>

                      <td className="p-4 text-muted-foreground font-mono">
                        {formatJoinedDate(user.createdAt)}
                      </td>

                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              aria-label={`${t("admin.users.table.actions") || "Actions"}: ${label}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 text-xs">
                            <DropdownMenuItem
                              disabled={isSelf && nextToggleStatus === "INACTIVE"}
                              onClick={() =>
                                setPendingAction({
                                  type: "status",
                                  user,
                                  targetStatus: nextToggleStatus,
                                })
                              }
                              className="cursor-pointer"
                            >
                              {user.status === "ACTIVE" ? (
                                <span className="flex items-center gap-2 text-destructive">
                                  <UserX className="h-4 w-4" />
                                  {t("admin.users.actions.suspend") || "Suspend Account"}
                                </span>
                              ) : (
                                <span className="flex items-center gap-2 text-emerald-600">
                                  <UserCheck className="h-4 w-4" />
                                  {user.status === "INACTIVE"
                                    ? t("admin.users.actions.reactivate") || "Reactivate Account"
                                    : t("admin.users.actions.activate") || "Activate Account"}
                                </span>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={user.role === "USER" || isSelf}
                              onClick={() =>
                                setPendingAction({
                                  type: "role",
                                  user,
                                  targetRole: "USER",
                                })
                              }
                              className="cursor-pointer"
                            >
                              {t("admin.users.actions.makeUser") || "Make User"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={user.role === "PARTNER" || isSelf}
                              onClick={() =>
                                setPendingAction({
                                  type: "role",
                                  user,
                                  targetRole: "PARTNER",
                                })
                              }
                              className="cursor-pointer"
                            >
                              {t("admin.users.actions.makePartner") || "Make Partner"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={user.role === "ADMIN"}
                              onClick={() =>
                                setPendingAction({
                                  type: "role",
                                  user,
                                  targetRole: "ADMIN",
                                })
                              }
                              className="cursor-pointer font-semibold text-purple-600"
                            >
                              {t("admin.users.actions.makeAdmin") || "Make Admin"}
                            </DropdownMenuItem>
                            {isSelf && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    {t("admin.users.actions.selfProtected") ||
                                      "Self-protection active"}
                                  </span>
                                </div>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              {t("admin.users.pagination.pageOf", {
                page: page + 1,
                total: totalPages,
                count: totalElements,
              }) || `Page ${page + 1} of ${totalPages} (${totalElements} users)`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 0 || isLoading}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                className="h-8 gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t("admin.users.pagination.prev") || "Previous"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages || isLoading}
                onClick={() => setPage((prev) => prev + 1)}
                className="h-8 gap-1 text-xs"
              >
                {t("admin.users.pagination.next") || "Next"}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !isMutating) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "status"
                ? t("admin.users.actions.confirmStatusTitle") || "Confirm account status change"
                : t("admin.users.actions.confirmRoleTitle") || "Confirm role change"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction &&
                (pendingAction.type === "status"
                  ? t("admin.users.actions.confirmStatusDesc", {
                      name: getDisplayLabel(pendingAction.user),
                      status: getStatusLabel(pendingAction.targetStatus),
                    })
                  : t("admin.users.actions.confirmRoleDesc", {
                      name: getDisplayLabel(pendingAction.user),
                      role: getRoleLabel(pendingAction.targetRole),
                    }))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>
              {t("admin.users.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutating}
              onClick={(e) => {
                e.preventDefault();
                void executeConfirmedAction();
              }}
              className={
                pendingAction?.type === "status" && pendingAction.targetStatus === "INACTIVE"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {t("admin.users.actions.confirm") || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
