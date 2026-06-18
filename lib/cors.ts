import { NextResponse } from 'next/server';

/**
 * Build CORS headers for a given site. If the site restricts to a domain,
 * only that origin is allowed; otherwise any origin can embed it.
 */
export function corsHeaders(allowedDomain: string, requestOrigin: string | null): HeadersInit {
  let origin = '*';
  if (allowedDomain) {
    // Allow only the configured domain (match by hostname).
    if (requestOrigin && requestOrigin.includes(allowedDomain)) {
      origin = requestOrigin;
    } else {
      origin = `https://${allowedDomain}`;
    }
  } else if (requestOrigin) {
    origin = requestOrigin;
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function preflight(allowedDomain: string, requestOrigin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowedDomain, requestOrigin) });
}
