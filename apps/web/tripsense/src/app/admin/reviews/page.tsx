"use client";

import * as React from "react";
import {
  MessageSquare,
  Star,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  MapPin,
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

interface ReviewItem {
  id: string;
  author: string;
  placeName: string;
  placeCategory: string;
  rating: number;
  content: string;
  createdAt: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
}

const initialReviews: ReviewItem[] = [
  {
    id: "rev-1",
    author: "Elena Rostova",
    placeName: "Dragon Bridge (Cầu Rồng)",
    placeCategory: "Attraction",
    rating: 5,
    content: "The weekend fire-breathing show at 9 PM was spectacular! Definitely recommend arriving 30 minutes early to get a spot on the pedestrian walkway.",
    createdAt: "2 hours ago",
    status: "APPROVED",
  },
  {
    id: "rev-2",
    author: "Kenji Sato",
    placeName: "Senso-ji Ancient Temple",
    placeCategory: "Culture",
    rating: 5,
    content: "Historic and deeply peaceful early in the morning before crowds arrive. The Nakamise shopping street leading to the temple has great local snacks.",
    createdAt: "5 hours ago",
    status: "APPROVED",
  },
  {
    id: "rev-3",
    author: "Anonymous Traveler",
    placeName: "Hanoi Luxury Suites",
    placeCategory: "Hotel",
    rating: 2,
    content: "Late check-in took over 40 minutes due to system outage. Room was clean but noisy facing the street.",
    createdAt: "Yesterday",
    status: "PENDING",
  },
  {
    id: "rev-4",
    author: "Spam Account",
    placeName: "Bà Nà Hills SunWorld",
    placeCategory: "Attraction",
    rating: 1,
    content: "Visit our website for 90% discount flight vouchers at scam-flights-xyz.click!",
    createdAt: "2 days ago",
    status: "REJECTED",
  },
];

export default function AdminReviewsPage() {
  const [reviews, setReviews] = React.useState<ReviewItem[]>(initialReviews);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

  const filteredReviews = reviews.filter((r) => {
    const matchSearch =
      r.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.placeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const updateStatus = (id: string, newStatus: "APPROVED" | "PENDING" | "REJECTED") => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Content Moderation
            </Badge>
            <span className="text-xs text-muted-foreground">Community Quality Assurance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reviews & Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Review user ratings, comments, and prevent spam or inappropriate reviews.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs">
            {reviews.filter((r) => r.status === "PENDING").length} Pending Verification
          </Badge>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card border border-border p-4 rounded-xl shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by reviewer, place, or comment keywords..."
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs">
          <span className="text-muted-foreground px-2 font-medium">Status:</span>
          {["ALL", "APPROVED", "PENDING", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                statusFilter === st
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {filteredReviews.length === 0 ? (
          <Card className="bg-card border-border p-8 text-center text-muted-foreground text-xs">
            No reviews match your filter.
          </Card>
        ) : (
          filteredReviews.map((rev) => (
            <Card key={rev.id} className="bg-card border-border shadow-2xs p-5 hover:shadow-xs transition-all">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {rev.author}
                    </span>
                    <span className="text-muted-foreground text-xs">•</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary" />
                      {rev.placeName} ({rev.placeCategory})
                    </span>
                    <span className="text-muted-foreground text-xs">•</span>
                    <span className="text-micro font-mono text-muted-foreground">{rev.createdAt}</span>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < rev.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-muted text-muted"
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-foreground ml-1">{rev.rating}/5</span>
                  </div>

                  {/* Review Text */}
                  <p className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/50">
                    "{rev.content}"
                  </p>
                </div>

                {/* Status & Actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-micro font-medium ${
                      rev.status === "APPROVED"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : rev.status === "PENDING"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}
                  >
                    {rev.status}
                  </Badge>

                  <div className="flex items-center gap-1">
                    {rev.status !== "APPROVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(rev.id, "APPROVED")}
                        className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                    )}
                    {rev.status !== "REJECTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(rev.id, "REJECTED")}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
