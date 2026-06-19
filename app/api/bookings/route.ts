import { NextRequest, NextResponse } from 'next/server';
import { listBookings } from '@/lib/supabase';
import { isAuthorized } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const site = req.nextUrl.searchParams.get('site') || undefined;
  const bookings = await listBookings(site);
  return NextResponse.json({ bookings });
}
