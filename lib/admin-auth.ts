import { NextRequest } from 'next/server';

/** POC-level admin auth: a shared bearer token (see CLAUDE.md). */
export function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  return !!token && token === process.env.ADMIN_API_TOKEN;
}
