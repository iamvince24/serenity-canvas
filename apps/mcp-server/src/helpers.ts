/**
 * Shared MCP response helpers.
 */

export function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: true, data }),
      },
    ],
  };
}

export function fail(error: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: false, error }),
      },
    ],
    isError: true as const,
  };
}
