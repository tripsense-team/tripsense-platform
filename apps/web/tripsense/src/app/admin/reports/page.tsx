"use client";

import * as React from "react";
import {
  Flag,
  AlertOctagon,
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  ShieldAlert,
  UserX,
  ExternalLink,
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

interface ReportItem {
  id: string;
  targetType: "COMMUNITY_POST" | "COMMENT" | "USER" | "HOTEL";
  targetTitle: string;
  reason: string;
  reportedBy: string;
  timestamp: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  status: "PENDING" | "RESOLVED" | "DISMISSED";
}

const initialReports: ReportItem[] = [
  {
    id: "rep-101",
    targetType: "COMMENT",
    targetTitle: "Comment on 'Tokyo Autumn Photo Trip'",
    reason: "Cryptocurrency investment spam and phishing URL in comment body",
    reportedBy: "alex.traveler@mindtrip.ai",
    timestamp: "18 mins ago",
    severity: "HIGH",
    status: "PENDING",
  },
  {
    id: "rep-102",
    targetType: "HOTEL",
    targetTitle: "Riverside Boutique Stay Da Nang",
    reason: "Incorrect phone number and fraudulent deposit request detected",
    reportedBy: "sarah.m@gmail.com",
    timestamp: "1 hour ago",
    severity: "HIGH",
    status: "PENDING",
  },
  {
    id: "rep-103",
    targetType: "COMMUNITY_POST",
    targetTitle: "Cheap tickets 100% discount",
    reason: "Automated bot mass posting unauthorized promotional content",
    reportedBy: "community_auto_mod",
    timestamp: "3 hours ago",
    severity: "MEDIUM",
    status: "PENDING",
  },
  {
    id: "rep-104",
    targetType: "USER",
    targetTitle: "User: @hacker_bot99",
    reason: "Repeated API rate-limit abuse attempting scraping",
    reportedBy: "security_gateway",
    timestamp: "Yesterday",
    severity: "LOW",
    status: "RESOLVED",
  },
];

export default function AdminReportsPage() {
  const [reports, setReports] = React.useState<ReportItem[]>(initialReports);
  const [statusFilter, setStatusFilter] = React.useState<string>("PENDING");

  const filteredReports = reports.filter((r) => {
    return statusFilter === "ALL" || r.status === statusFilter;
  });

  const resolveReport = (id: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "RESOLVED" } : r)),
    );
  };

  const dismissReport = (id: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "DISMISSED" } : r)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
              <AlertOctagon className="h-3.5 w-3.5 mr-1" /> Safety & Abuse Center
            </Badge>
            <span className="text-xs text-muted-foreground">Moderation Queue</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Flags</h1>
          <p className="text-sm text-muted-foreground">
            Investigate community flags, spam reports, and policy violation cases.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-destructive text-destructive-foreground font-mono text-xs px-3 py-1">
            {reports.filter((r) => r.status === "PENDING").length} Open Flags
          </Badge>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-xl w-fit text-xs">
        {["PENDING", "RESOLVED", "DISMISSED", "ALL"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === st
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {st === "PENDING" ? `Pending (${reports.filter((r) => r.status === "PENDING").length})` : st}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <Card className="bg-card border-border p-12 text-center text-muted-foreground text-xs">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            No reports in this category. Queue is clean!
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card key={report.id} className="bg-card border-border shadow-2xs overflow-hidden">
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-micro">
                      {report.id}
                    </Badge>
                    <Badge
                      className={
                        report.severity === "HIGH"
                          ? "bg-destructive/10 text-destructive border-destructive/20 text-micro"
                          : report.severity === "MEDIUM"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-micro"
                          : "bg-muted text-muted-foreground text-micro"
                      }
                    >
                      {report.severity} PRIORITY
                    </Badge>
                    <Badge variant="outline" className="bg-muted text-foreground text-micro">
                      {report.targetType}
                    </Badge>
                    <span className="text-micro text-muted-foreground font-mono">
                      Reported {report.timestamp} by {report.reportedBy}
                    </span>
                  </div>

                  <h3 className="font-bold text-foreground text-sm">{report.targetTitle}</h3>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                    <span className="font-semibold text-foreground">Violation Reason: </span>
                    {report.reason}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {report.status === "PENDING" ? (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => resolveReport(report.id)}
                        className="h-8 text-xs gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove & Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => dismissReport(report.id)}
                        className="h-8 text-xs gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Dismiss
                      </Button>
                    </>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        report.status === "RESOLVED"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {report.status}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
