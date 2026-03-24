import type { IncomingMessage, ServerResponse } from "node:http";

type WebHandler = (req: Request) => Response | Promise<Response>;

/**
 * Wraps a Web Standard handler (Request → Response) into
 * Vercel's Node.js serverless format (IncomingMessage, ServerResponse).
 *
 * Vercel's Node.js runtime always passes Node.js objects even when
 * the handler signature accepts Web Standard Request.
 */
export function withWebStandard(handler: WebHandler) {
  return async (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
    const request = await toWebRequest(nodeReq);
    const response = await handler(request);
    await sendWebResponse(nodeRes, response);
  };
}

async function toWebRequest(nodeReq: IncomingMessage): Promise<Request> {
  const protocol = (nodeReq.headers["x-forwarded-proto"] as string) || "https";
  const host =
    (nodeReq.headers["x-forwarded-host"] as string) ||
    nodeReq.headers.host ||
    "localhost";
  const url = new URL(nodeReq.url || "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeReq.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const method = nodeReq.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  let body: ArrayBuffer | null = null;
  if (hasBody) {
    body = await new Promise<ArrayBuffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      nodeReq.on("data", (chunk: Buffer) => chunks.push(chunk));
      nodeReq.on("end", () =>
        resolve(Buffer.concat(chunks).buffer as ArrayBuffer),
      );
      nodeReq.on("error", reject);
    });
  }

  return new Request(url.toString(), {
    method,
    headers,
    body,
  });
}

async function sendWebResponse(
  nodeRes: ServerResponse,
  response: Response,
): Promise<void> {
  nodeRes.statusCode = response.status;

  response.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value);
  });

  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeRes.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  nodeRes.end();
}
