"use client";

import * as React from "react";
import Link from "next/link";
import {
  MessageSquare,
  Calendar,
  Clock,
  Users,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getBusinessInquiries, getCustomerInquiries } from "../services/partner-api";
import type { GuideInquiryDto, GuideInquiryState } from "../types";

interface GuideInquiriesListViewProps {
  businessId?: string; // If provided, shows inquiries for business (partner view); else customer inquiries
}

export function GuideInquiriesListView({ businessId }: GuideInquiriesListViewProps) {
  const [inquiries, setInquiries] = React.useState<GuideInquiryDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filterState, setFilterState] = React.useState<string>("ALL");

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const stateParam = filterState === "ALL" ? undefined : filterState;
      const list = businessId
        ? await getBusinessInquiries(businessId, stateParam)
        : await getCustomerInquiries(stateParam);
      setInquiries(list || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách yêu cầu");
    } finally {
      setLoading(false);
    }
  }, [businessId, filterState]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const getStateBadge = (state: GuideInquiryState) => {
    switch (state) {
      case "SUBMITTED":
        return <Badge variant="secondary">Mới nhận</Badge>;
      case "IN_DISCUSSION":
        return <Badge variant="outline" className="border-blue-500/30 text-blue-600">Đang trao đổi</Badge>;
      case "PROPOSAL_SENT":
        return <Badge variant="outline" className="border-amber-500/30 text-amber-600">Đã gửi đề xuất</Badge>;
      case "CONTACT_AGREED":
        return <Badge className="bg-emerald-600 text-white">Đã kết nối liên hệ</Badge>;
      case "CLOSED":
        return <Badge variant="outline" className="text-muted-foreground">Đã đóng</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
          <Link href={businessId ? "/partner" : "/trips"}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {businessId ? "Quay lại Trung tâm Đối tác" : "Quay lại Chuyến đi"}
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {businessId ? "Yêu cầu tư vấn từ Du khách" : "Các yêu cầu tư vấn của bạn"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Xem chi tiết nhu cầu, trao đổi trực tiếp và gửi phương án thiết kế lộ trình.
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Làm mới
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border/60 text-xs">
        {["ALL", "SUBMITTED", "IN_DISCUSSION", "PROPOSAL_SENT", "CONTACT_AGREED", "CLOSED"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilterState(s)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterState === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {s === "ALL" && "Tất cả"}
              {s === "SUBMITTED" && "Mới gửi"}
              {s === "IN_DISCUSSION" && "Đang trao đổi"}
              {s === "PROPOSAL_SENT" && "Có đề xuất"}
              {s === "CONTACT_AGREED" && "Đã kết nối"}
              {s === "CLOSED" && "Đã đóng"}
            </button>
          ),
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border/60 bg-muted/40" />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">Chưa có yêu cầu tư vấn nào</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {businessId
              ? "Khi du khách quan tâm đến bài quảng bá của bạn, các yêu cầu sẽ xuất hiện tại đây."
              : "Bạn chưa gửi yêu cầu tư vấn nào đến các hướng dẫn viên địa phương."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <Link key={inq.id} href={`/guide-inquiries/${inq.id}`} className="block group">
              <Card className="border-border/80 transition-all group-hover:border-primary/50 group-hover:shadow-xs">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-foreground text-sm">
                        Yêu cầu #{inq.id.slice(0, 8)}
                      </span>
                      {getStateBadge(inq.state)}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {inq.requirements.goals}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-primary" /> {inq.requirements.dateFrom} → {inq.requirements.dateTo}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-primary" /> {inq.requirements.adults} người lớn
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-primary" /> {inq.requirements.durationMinutes} phút
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <Button variant="ghost" size="sm" className="h-8 text-xs group-hover:bg-primary/10 group-hover:text-primary">
                      Xem chi tiết <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
