"use client";

import * as React from "react";
import {
  Users,
  Search,
  Filter,
  Shield,
  UserCheck,
  UserX,
  MoreVertical,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/i18n";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PARTNER" | "USER";
  status: "ACTIVE" | "SUSPENDED";
  verified: boolean;
  joinedAt: string;
  avatar?: string;
  tripsCount: number;
}

const initialUsers: UserItem[] = [
  {
    id: "usr-1",
    name: "Gia Bao",
    email: "giabaoworking362004@gmail.com",
    role: "ADMIN",
    status: "ACTIVE",
    verified: true,
    joinedAt: "2026-08-12",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=GiaBao",
    tripsCount: 14,
  },
  {
    id: "usr-2",
    name: "Alex Traveler",
    email: "alex.traveler@mindtrip.ai",
    role: "USER",
    status: "ACTIVE",
    verified: true,
    joinedAt: "2026-09-01",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    tripsCount: 6,
  },
  {
    id: "usr-3",
    name: "Hanoi Luxury Suites",
    email: "manager@hanoiluxury.vn",
    role: "PARTNER",
    status: "ACTIVE",
    verified: true,
    joinedAt: "2026-09-15",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=HanoiSuites",
    tripsCount: 0,
  },
  {
    id: "usr-4",
    name: "Sarah Miller",
    email: "sarah.m@gmail.com",
    role: "USER",
    status: "ACTIVE",
    verified: true,
    joinedAt: "2026-09-20",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    tripsCount: 3,
  },
  {
    id: "usr-5",
    name: "Spam Bot 2026",
    email: "promo@cheapairfares.xyz",
    role: "USER",
    status: "SUSPENDED",
    verified: false,
    joinedAt: "2026-09-28",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bot",
    tripsCount: 0,
  },
];

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = React.useState<UserItem[]>(initialUsers);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchStatus = statusFilter === "ALL" || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const toggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }
          : u,
      ),
    );
  };

  const changeUserRole = (id: string, newRole: "ADMIN" | "PARTNER" | "USER") => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Users className="h-3.5 w-3.5 mr-1" /> {t("admin.users.directory") || "Directory"}
            </Badge>
            <span className="text-xs text-muted-foreground">{t("admin.users.management") || "User Management"}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("admin.users.title") || "User Accounts"}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.users.subtitle") || "Manage user roles, verify accounts, and oversee platform access."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-primary text-primary-foreground font-mono text-xs px-3 py-1">
            {t("admin.users.totalUsers", { count: users.length }) || `Total: ${users.length} Users`}
          </Badge>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card border border-border p-4 rounded-xl shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("admin.users.searchPlaceholder") || "Search by name or email..."}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs">
            <span className="text-muted-foreground px-2 font-medium">{t("admin.users.roleFilter") || "Role:"}</span>
            {["ALL", "USER", "PARTNER", "ADMIN"].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  roleFilter === role
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {role === "ALL"
                  ? (t("admin.users.all") || "ALL")
                  : role === "ADMIN"
                  ? (t("admin.users.roles.admin") || "Admin")
                  : role === "PARTNER"
                  ? (t("admin.users.roles.partner") || "Partner")
                  : (t("admin.users.roles.user") || "User")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs">
            <span className="text-muted-foreground px-2 font-medium">{t("admin.users.statusFilter") || "Status:"}</span>
            {["ALL", "ACTIVE", "SUSPENDED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === st
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "ALL"
                  ? (t("admin.users.all") || "ALL")
                  : st === "ACTIVE"
                  ? (t("admin.users.status.active") || "ACTIVE")
                  : (t("admin.users.status.suspended") || "SUSPENDED")}
              </button>
            ))}
          </div>
        </div>
      </div>

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
                <th className="p-4">{t("admin.users.table.trips") || "Trips"}</th>
                <th className="p-4">{t("admin.users.table.joined") || "Joined Date"}</th>
                <th className="p-4 text-right">{t("admin.users.table.actions") || "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {t("admin.users.empty") || "No users match your criteria."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {user.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground">{user.name}</div>
                          <div className="text-micro text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
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
                        {user.role === "ADMIN"
                          ? t("admin.users.roles.admin")
                          : user.role === "PARTNER"
                          ? t("admin.users.roles.partner")
                          : t("admin.users.roles.user")}
                      </Badge>
                    </td>

                    <td className="p-4">
                      <Badge
                        className={
                          user.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {user.status === "ACTIVE"
                          ? t("admin.users.status.active")
                          : t("admin.users.status.suspended")}
                      </Badge>
                    </td>

                    <td className="p-4">
                      {user.verified ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t("admin.users.status.verified") || "Verified"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" /> {t("admin.users.status.unverified") || "Unverified"}
                        </span>
                      )}
                    </td>

                    <td className="p-4 font-mono font-medium text-foreground">
                      {user.tripsCount}
                    </td>

                    <td className="p-4 text-muted-foreground font-mono">
                      {user.joinedAt}
                    </td>

                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-xs">
                          <DropdownMenuItem
                            onClick={() => toggleUserStatus(user.id)}
                            className="cursor-pointer"
                          >
                            {user.status === "ACTIVE" ? (
                              <span className="flex items-center gap-2 text-destructive">
                                <UserX className="h-4 w-4" /> {t("admin.users.actions.suspend") || "Suspend Account"}
                              </span>
                            ) : (
                              <span className="flex items-center gap-2 text-emerald-600">
                                <UserCheck className="h-4 w-4" /> {t("admin.users.actions.reactivate") || t("admin.users.actions.activate") || "Reactivate Account"}
                              </span>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => changeUserRole(user.id, "USER")}
                            className="cursor-pointer"
                          >
                            {t("admin.users.actions.makeUser") || "Make Standard User"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => changeUserRole(user.id, "PARTNER")}
                            className="cursor-pointer"
                          >
                            {t("admin.users.actions.makePartner") || "Make Partner"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => changeUserRole(user.id, "ADMIN")}
                            className="cursor-pointer font-semibold text-purple-600"
                          >
                            {t("admin.users.actions.makeAdmin") || "Make Administrator"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
