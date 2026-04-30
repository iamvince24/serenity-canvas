import type { User } from "@supabase/supabase-js";

export function readUserMetadata(user: User, key: string): string | null {
  const value = user.user_metadata?.[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function getDisplayName(user: User): string {
  return (
    readUserMetadata(user, "full_name") ??
    readUserMetadata(user, "name") ??
    user.email ??
    "Serenity User"
  );
}

export function getAvatarUrl(user: User): string | null {
  return (
    readUserMetadata(user, "avatar_url") ?? readUserMetadata(user, "picture")
  );
}
