import type { AiArtifact } from "./types";

export function upsertArtifact(artifacts: AiArtifact[] = [], incoming: AiArtifact): AiArtifact[] {
  const existing = artifacts.findIndex((item) => item.artifactId === incoming.artifactId);
  if (existing < 0) return [...artifacts, incoming];
  if ((artifacts[existing].version || 0) > (incoming.version || 0)) return artifacts;
  return artifacts.map((item, index) => index === existing ? incoming : item);
}
