import { randomUUID } from "crypto";

// Per-process changeset ID. Operations within the same AI conversation share this ID.
let currentChangesetId: string | null = null;

export function getChangesetId(): string {
  if (!currentChangesetId) {
    currentChangesetId = randomUUID();
  }
  return currentChangesetId;
}

export function newChangeset(): string {
  currentChangesetId = randomUUID();
  return currentChangesetId;
}
