import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const LOCAL_BACKEND_API_URL = "http://localhost:8080/api/v1";
const PRODUCTION_BACKEND_API_URL = "https://macproc-backend-final.fly.dev/api/v1";

const BACKEND_API_URL =
  process.env.INTERNAL_BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.VERCEL ? PRODUCTION_BACKEND_API_URL : LOCAL_BACKEND_API_URL);

function backendUrl(path: string[]) {
  const base = BACKEND_API_URL.replace(/\/$/, "");
  const suffix = path.map(encodeURIComponent).join("/");
  return `${base}/${suffix}`;
}

function proxyHeaders(request: NextRequest) {
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  const appContext = request.headers.get("x-app-context");
  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);
  if (appContext) headers.set("x-app-context", appContext);
  return headers;
}

function backendUnavailableResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "fetch failed";
  return Response.json(
    {
      detail: `Backend API unavailable at ${BACKEND_API_URL}. Start the MacProc backend or update INTERNAL_BACKEND_API_URL in .env.local.`,
      error: message
    },
    { status: 502 }
  );
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const search = request.nextUrl.search || "";
  const url = `${backendUrl(path)}${search}`;
  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: proxyHeaders(request),
      body,
      cache: "no-store"
    });
  } catch (error) {
    return backendUnavailableResponse(error);
  }

  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
