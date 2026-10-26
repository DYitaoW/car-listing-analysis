import { connection } from "next/server";

function apiOrigin(): string {
  const configured = process.env.API_PROXY_URL || process.env.NEXT_PUBLIC_API_URL || "";
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/$/, "");
  return "http://127.0.0.1:43124";
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  await connection();
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = `${apiOrigin()}/${path.map((segment) => encodeURIComponent(segment)).join("/")}${incoming.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    const responseType = upstream.headers.get("content-type");
    if (responseType) responseHeaders.set("content-type", responseType);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "connection failed";
    return Response.json(
      {
        detail: `Cannot reach the analysis API at ${apiOrigin()}. Start it with pnpm dev:api and try again. (${reason})`,
      },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
