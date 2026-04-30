/** RFC 6749 §5.2 error response helper */
export function oauthError(
  error: string,
  description: string,
  status: number = 400,
): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
