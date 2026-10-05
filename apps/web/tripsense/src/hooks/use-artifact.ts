"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { UIArtifact, TripProposal } from "@/lib/types";

export const initialArtifactData: UIArtifact = {
  documentId: "init",
  title: "",
  kind: "itinerary",
  isVisible: false,
  status: "idle",
  proposal: {
    proposalId: "",
    title: "",
    destination: "",
    durationDays: 0,
    summary: "",
    days: [],
  },
};

export function useArtifact() {
  const { data: localArtifact, mutate: setLocalArtifact } = useSWR<UIArtifact>(
    "tripsense-artifact",
    null,
    {
      fallbackData: initialArtifactData,
    }
  );

  const artifact = useMemo(() => {
    return localArtifact || initialArtifactData;
  }, [localArtifact]);

  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((current: UIArtifact) => UIArtifact)) => {
      setLocalArtifact((current) => {
        const toUpdate = current || initialArtifactData;
        if (typeof updaterFn === "function") {
          return updaterFn(toUpdate);
        }
        return updaterFn;
      });
    },
    [setLocalArtifact]
  );

  const showProposal = useCallback(
    (proposal: TripProposal) => {
      setArtifact({
        documentId: proposal.proposalId,
        title: proposal.title,
        kind: "itinerary",
        isVisible: true,
        status: "idle",
        proposal,
      });
    },
    [setArtifact]
  );

  const closeArtifact = useCallback(() => {
    setArtifact((prev) => ({
      ...prev,
      isVisible: false,
    }));
  }, [setArtifact]);

  return {
    artifact,
    setArtifact,
    showProposal,
    closeArtifact,
    isVisible: artifact.isVisible,
  };
}
