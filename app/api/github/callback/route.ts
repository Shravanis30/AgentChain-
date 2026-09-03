import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get('installation_id');
  const state = searchParams.get('state');

  if (!installationId || !state) {
    return NextResponse.redirect(new URL('/dashboard/settings/connected-accounts?error=missing_params', request.url));
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const targetUrl = `${backendUrl}/api/v1/github/callback?installation_id=${encodeURIComponent(installationId)}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(targetUrl);
}
