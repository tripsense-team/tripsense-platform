"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  UserCheck,
  MessageSquare,
  FileCheck,
  RotateCcw,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addInquiryMessage,
  decideInquiryProposal,
  getInquiryContacts,
  getInquiryDetail,
  revokeContactConsent,
  sendInquiryProposal,
} from "../services/partner-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import type {
  GuideInquiryDto,
  GuideProposalInput,
  InquiryContactsDto,
  ProposalDecisionRequest,
} from "../types";

interface GuideInquiryDetailViewProps {
  inquiryId: string;
}

export function GuideInquiryDetailView({ inquiryId }: GuideInquiryDetailViewProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [inquiry, setInquiry] = React.useState<GuideInquiryDto | null>(null);
  const [contacts, setContacts] = React.useState<InquiryContactsDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Proposal modal state
  const [proposalModalOpen, setProposalModalOpen] = React.useState(false);
  const [program, setProgram] = React.useState("");
  const [estimatedPrice, setEstimatedPrice] = React.useState(1500000);
  const [proposalExplanation, setProposalExplanation] = React.useState("");
  const [proposalSubmitting, setProposalSubmitting] = React.useState(false);

  // Message reply state
  const [replyMessage, setReplyMessage] = React.useState("");
  const [replySending, setReplySending] = React.useState(false);

  // Consent revoking state
  const [revoking, setRevoking] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [inq, cnt] = await Promise.all([
        getInquiryDetail(inquiryId),
        getInquiryContacts(inquiryId).catch(() => null),
      ]);
      setInquiry(inq);
      setContacts(cnt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải chi tiết yêu cầu tư vấn");
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const isCustomer = currentUserId === inquiry?.customerId;
  const isGuide = !isCustomer; // When accessed by partner guide

  const handleSendMessage = async () => {
    if (!replyMessage.trim()) return;
    try {
      setReplySending(true);
      const updated = await addInquiryMessage(inquiryId, replyMessage.trim());
      setInquiry(updated);
      setReplyMessage("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi gửi phản hồi");
    } finally {
      setReplySending(false);
    }
  };

  const handleSendProposal = async () => {
    if (!program.trim() || !inquiry) return;
    try {
      setProposalSubmitting(true);
      const req: GuideProposalInput = {
        expectedVersion: inquiry.version,
        requirementsRevision: inquiry.currentRequirementsRevision,
        offeredAreaId: inquiry.requirements.areaId,
        offeredTopicIds: inquiry.requirements.topicIds,
        offeredSkillIds: inquiry.requirements.requiredSkillIds || ["storytelling"],
        languageCode: inquiry.requirements.languageCode,
        explanation: proposalExplanation.trim() || undefined,
        proposedStartAt: new Date(inquiry.requirements.dateFrom).toISOString(),
        timeZone: inquiry.requirements.timeZone || "Asia/Ho_Chi_Minh",
        durationMinutes: inquiry.requirements.durationMinutes || 180,
        program: program.trim(),
        inclusions: ["Lộ trình thiết kế riêng", "Thuyết minh & hỗ trợ suốt tuyến"],
        exclusions: ["Phương tiện di chuyển cá nhân", "Ăn uống ngoài chương trình"],
        estimatedTotalVnd: estimatedPrice,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        contactConsent: {
          shareEmail: true,
          sharePhone: true,
        },
      };

      const updated = await sendInquiryProposal(inquiryId, req);
      setInquiry(updated);
      setProposalModalOpen(false);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi gửi đề xuất");
    } finally {
      setProposalSubmitting(false);
    }
  };

  const handleProposalDecision = async (action: "AGREE_TO_CONTACT" | "REQUEST_REVISION") => {
    if (!inquiry || !inquiry.currentProposalId) return;
    try {
      const req: ProposalDecisionRequest = {
        expectedVersion: inquiry.version,
        proposalId: inquiry.currentProposalId,
        action,
        note: action === "AGREE_TO_CONTACT" ? "Đồng ý phương án tư vấn" : "Cần điều chỉnh thêm",
        contactConsent: {
          shareEmail: true,
          sharePhone: true,
        },
      };

      const updated = await decideInquiryProposal(inquiryId, req);
      setInquiry(updated);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi phản hồi đề xuất");
    }
  };

  const handleRevokeConsent = async (channel: "EMAIL" | "PHONE") => {
    if (!confirm(`Bạn có chắc chắn muốn thu hồi quyền xem ${channel === "EMAIL" ? "Email" : "Số điện thoại"} không?`)) {
      return;
    }
    try {
      setRevoking(true);
      await revokeContactConsent(inquiryId, {
        channel,
        reason: "Người dùng chủ động thu hồi quyền liên hệ",
      });
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi khi thu hồi liên hệ");
    } finally {
      setRevoking(false);
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case "SUBMITTED":
        return <Badge variant="secondary">Mới gửi</Badge>;
      case "IN_DISCUSSION":
        return <Badge variant="outline" className="border-blue-500/30 text-blue-600">Đang trao đổi</Badge>;
      case "PROPOSAL_SENT":
        return <Badge variant="outline" className="border-amber-500/30 text-amber-600">Đã gửi phương án</Badge>;
      case "CONTACT_AGREED":
        return <Badge className="bg-emerald-600 text-white">Đã đồng ý kết nối</Badge>;
      case "CLOSED":
        return <Badge variant="outline" className="text-muted-foreground">Đã đóng</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error || "Không tìm thấy yêu cầu tư vấn"}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Top Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
          <Link href={isCustomer ? "/guide-inquiries" : `/partner/businesses/${inquiry.guideBusinessId}/guide-inquiries`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Quay lại danh sách
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Yêu cầu tư vấn du lịch #{inquiry.id.slice(0, 8)}
              </h1>
              {getStateBadge(inquiry.state)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isCustomer ? (
                <span>Tư vấn với: <strong>Hướng dẫn viên địa phương</strong></span>
              ) : (
                <span>Khách hàng yêu cầu tư vấn: <strong>Du khách</strong></span>
              )}
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            Hết hạn: {new Date(inquiry.expiresAt).toLocaleDateString("vi-VN")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (Requirements & Discussion) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Requirements Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold">Nội dung nhu cầu du khách</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                &ldquo;{inquiry.requirements.goals}&rdquo;
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>
                    {inquiry.requirements.dateFrom} → {inquiry.requirements.dateTo}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <span>
                    {inquiry.requirements.adults} người lớn
                    {inquiry.requirements.children > 0 ? `, ${inquiry.requirements.children} trẻ em` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{inquiry.requirements.durationMinutes} phút</span>
                </div>
              </div>

              {inquiry.requirements.supportNotes && (
                <div className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                  <span className="font-semibold text-foreground">Ghi chú thêm: </span>
                  {inquiry.requirements.supportNotes}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Proposal Card (if sent) */}
          {inquiry.currentProposal && (
            <Card className="border-primary/30 bg-primary/5 shadow-xs">
              <CardHeader className="p-5 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-primary" /> Phương án đề xuất từ HDV
                  </CardTitle>
                  <Badge variant="outline" className="text-primary border-primary/30 bg-background text-xs">
                    Phiên bản {inquiry.currentProposal.revision}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-3">
                <div className="text-xs text-muted-foreground whitespace-pre-line bg-background/80 p-3 rounded-md border border-border/60">
                  {inquiry.currentProposal.program}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Mức chi phí ước tính:</span>
                  <span className="text-base font-bold text-primary">
                    {inquiry.currentProposal.estimatedTotalVnd.toLocaleString("vi-VN")} VND
                  </span>
                </div>

                {/* Customer Decision Actions */}
                {isCustomer && inquiry.state === "PROPOSAL_SENT" && (
                  <div className="pt-3 border-t border-primary/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        onClick={() => handleProposalDecision("AGREE_TO_CONTACT")}
                      >
                        <UserCheck className="mr-1.5 h-4 w-4" /> Đồng ý trao đổi tiếp
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProposalDecision("REQUEST_REVISION")}
                      >
                        <RotateCcw className="mr-1.5 h-4 w-4" /> Yêu cầu sửa
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center">
                      * Nhấn &quot;Đồng ý trao đổi tiếp&quot; sẽ mở thông tin liên lạc trực tiếp giữa hai bên (chưa phát sinh thanh toán).
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Guide Send Proposal CTA */}
          {isGuide && inquiry.state !== "CONTACT_AGREED" && inquiry.state !== "CLOSED" && (
            <div className="flex justify-end">
              <Button onClick={() => setProposalModalOpen(true)}>
                <FileCheck className="mr-1.5 h-4 w-4" /> Gửi phương án tư vấn & báo giá
              </Button>
            </div>
          )}

          {/* Simple Timeline / Message Input */}
          <Card className="border-border/80">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Trao đổi & Thảo luận
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập tin nhắn trao đổi thêm về lịch trình..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={replySending || inquiry.state === "CLOSED"}
                />
                <Button size="sm" onClick={handleSendMessage} disabled={replySending || !replyMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Dynamic Contact Consent & Revocation (§7) */}
        <div className="space-y-4">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Thông tin kết nối trực tiếp
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3 text-xs">
              {contacts ? (
                <>
                  {/* Email Section */}
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </span>
                      {contacts.emailConsented ? (
                        <Badge variant="outline" className="text-micro text-emerald-600 border-emerald-500/30">
                          Đã chia sẻ
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-micro">
                          Chưa mở / Đã thu hồi
                        </Badge>
                      )}
                    </div>
                    <p className="font-semibold text-foreground text-xs">
                      {contacts.email || "Đã thu hồi hoặc chưa cấp phép"}
                    </p>

                    {contacts.emailConsented && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-micro text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRevokeConsent("EMAIL")}
                        disabled={revoking}
                      >
                        <Ban className="mr-1 h-3 w-3" /> Thu hồi chia sẻ Email
                      </Button>
                    )}
                  </div>

                  {/* Phone Section */}
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Số điện thoại
                      </span>
                      {contacts.phoneConsented ? (
                        <Badge variant="outline" className="text-micro text-emerald-600 border-emerald-500/30">
                          Đã chia sẻ
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-micro">
                          Chưa mở / Đã thu hồi
                        </Badge>
                      )}
                    </div>
                    <p className="font-semibold text-foreground text-xs">
                      {contacts.phone || "Đã thu hồi hoặc chưa cấp phép"}
                    </p>

                    {contacts.phoneConsented && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-micro text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRevokeConsent("PHONE")}
                        disabled={revoking}
                      >
                        <Ban className="mr-1 h-3 w-3" /> Thu hồi chia sẻ SĐT
                      </Button>
                    )}
                  </div>

                  {contacts.notice && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                      {contacts.notice}
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-lg bg-muted/40 p-3 text-center text-muted-foreground text-xs">
                  Thông tin liên hệ sẽ mở sau khi hai bên thống nhất phương án tư vấn.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Guide Send Proposal Modal */}
      {proposalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Soạn phương án tư vấn & báo giá</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Lịch trình & Kế hoạch đề xuất</label>
                <Textarea
                  rows={4}
                  placeholder="Chi tiết chương trình tham quan, lộ trình và trải nghiệm..."
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Tổng chi phí ước tính (VND)</label>
                <Input
                  type="number"
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Giải thích / Ghi chú thêm</label>
                <Input
                  placeholder="Ghi chú về thời tiết hoặc lưu ý trang phục..."
                  value={proposalExplanation}
                  onChange={(e) => setProposalExplanation(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setProposalModalOpen(false)}>
                Hủy
              </Button>
              <Button size="sm" onClick={handleSendProposal} disabled={proposalSubmitting}>
                {proposalSubmitting ? "Đang gửi..." : "Gửi phương án cho khách"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
