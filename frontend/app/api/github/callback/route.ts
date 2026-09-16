import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get('installation_id');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // If no identifiable GitHub parameters were returned, redirect with explicit error
  if (!installationId && !code && !state) {
    return NextResponse.redirect(
      new URL('/dashboard/settings/connected-accounts?error=missing_params', request.url)
    );
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const queryString = searchParams.toString();
  const targetUrl = `${backendUrl}/api/v1/github/callback?${queryString}`;

  return NextResponse.redirect(targetUrl);
}
