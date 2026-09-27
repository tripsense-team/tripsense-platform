"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThumbsUp, Plus, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDestinationOptions, proposeDestination, voteForDestination, removeVote, type DestinationOptionResponse } from "../services/voting-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { tripCollaborationService } from "@/features/trip-management/services/collaboration-service";
import { profileService } from "@/features/profile/services/profile-service";
import type { TripMember } from "@/features/trip-management/types";
import type { UserProfile } from "@/features/profile/types";

export function GroupVotingPanel({ tripId }: { tripId: string }) {
  const [options, setOptions] = React.useState<DestinationOptionResponse[]>([]);
  const [members, setMembers] = React.useState<TripMember[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, UserProfile>>({});
  const [newOptionName, setNewOptionName] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  const fetchMembers = React.useCallback(async () => {
    try {
      const res = await tripCollaborationService.getTripMembers(tripId);
      setMembers(res);
    } catch (e) {
      console.error("Failed to load members", e);
    }
  }, [tripId]);

  const fetchOptions = React.useCallback(async () => {
    try {
      const res = await getDestinationOptions(tripId);
      setOptions(res.data);
    } catch (e) {
      console.error("Failed to load options", e);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  React.useEffect(() => {
    fetchOptions();
    fetchMembers();

    // SSE Real-time Setup
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_URL || ""}/api/trips/${tripId}/destinations/events?token=${token}`,
      { withCredentials: true }
    );

    eventSource.addEventListener("vote-update", (e) => {
      try {
        const updatedOption = JSON.parse(e.data) as DestinationOptionResponse;
        setOptions((prev) => {
          const exists = prev.find((o) => o.id === updatedOption.id);
          if (exists) {
            return prev.map((o) => (o.id === updatedOption.id ? updatedOption : o));
          } else {
            return [...prev, updatedOption];
          }
        });
      } catch (err) {
        console.error("Error parsing SSE data", err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [tripId, fetchOptions]);

  React.useEffect(() => {
    const fetchMissingProfiles = async () => {
      const allVoterIds = new Set<string>();
      options.forEach(opt => opt.voterUserIds.forEach(id => allVoterIds.add(id)));
      
      const missingIds = Array.from(allVoterIds).filter(id => !profiles[id]);
      if (missingIds.length === 0) return;

      const newProfiles = { ...profiles };
      await Promise.all(
        missingIds.map(async (id) => {
          try {
            const profile = await profileService.getUserProfile(id);
            newProfiles[id] = profile;
          } catch (e) {
            console.error("Failed to load profile", e);
          }
        })
      );
      setProfiles(newProfiles);
    };
    fetchMissingProfiles();
  }, [options, profiles]);

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!newOptionName.trim()) return;
    setError(null);
    try {
      const res = await proposeDestination(tripId, { placeId: null, name: newOptionName.trim() });
      setOptions((prev) => [...prev, res.data]);
      setNewOptionName("");
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to propose. Please try again.");
    }
  }

  async function handleToggleVote(option: DestinationOptionResponse) {
    setError(null);
    try {
      if (option.hasVoted) {
        await removeVote(tripId, option.id);
      } else {
        await voteForDestination(tripId, option.id);
      }
      // UI will be updated via SSE, but we can optimistically update
      fetchOptions();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to cast vote.");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm w-full mt-6">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" /> 
        Group Voting (Destinations)
      </h3>

      <div className="space-y-3 mb-6">
        {loading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Loading destinations...</div>
        ) : options.length === 0 ? (
          <div className="text-sm text-muted-foreground">No destinations proposed yet. Be the first!</div>
        ) : (
          options.map((opt) => (
            <div key={opt.id} className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/30">
              <div>
                <div className="font-semibold">{opt.name}</div>
                <div className="text-xs text-muted-foreground">Proposed by member</div>
              </div>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="text-sm font-medium cursor-pointer hover:underline underline-offset-2">
                      {opt.voteCount} votes
                    </div>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-64 p-3 max-h-60 overflow-y-auto">
                    <h4 className="font-semibold text-sm mb-2">Voted by</h4>
                    {opt.voterUserIds.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No one has voted yet.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {opt.voterUserIds.map((voterId) => {
                          const profile = profiles[voterId];
                          const name = profile?.displayName || "Unknown user";
                          const avatar = profile?.avatarUrl;
                          const fallback = name.charAt(0).toUpperCase();
                          return (
                            <div key={voterId} className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={avatar} alt={name} />
                                <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                <Button 
                  size="sm" 
                  variant={opt.hasVoted ? "default" : "outline"} 
                  className="rounded-full h-8 px-3"
                  onClick={() => handleToggleVote(opt)}
                >
                  <ThumbsUp className={`h-4 w-4 mr-1.5 ${opt.hasVoted ? "fill-current" : ""}`} />
                  {opt.hasVoted ? "Voted" : "Vote"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handlePropose} className="flex gap-2 mb-2">
        <Input 
          placeholder="Propose a new destination..." 
          value={newOptionName}
          onChange={(e) => setNewOptionName(e.target.value)}
          className="rounded-full flex-1"
        />
        <Button type="submit" size="sm" className="rounded-full px-5">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Option
        </Button>
      </form>
      {error && (
        <div className="text-sm text-red-500 px-2 mt-2">{error}</div>
      )}
    </div>
  );
}
