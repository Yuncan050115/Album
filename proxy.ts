import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { AUTH_SECRET } from '~/server/auth-secret'

/**
 * Lightweight route guard for Next 16 Proxy.
 *
 * Do not import ~/server/auth here. The full NextAuth config pulls Prisma into
 * the Edge runtime and makes every request print node:path / node:url warnings.
 * JWT checks are enough for route gating; real API handlers still validate auth.
 */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const publicApi = req.method === 'GET' && (
    pathname === '/api/v1/images/client-list' ||
    pathname === '/api/v1/albums/get'
  )
  const needsAuth = pathname.startsWith('/admin') || (pathname.startsWith('/api/v1') && !publicApi)

  if (!needsAuth) return NextResponse.next()

  const token = await getToken({ req, secret: AUTH_SECRET })

  if (!token) {
    if (pathname.startsWith('/api/v1')) {
      return NextResponse.json({ success: false, message: 'authentication failed' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/v1/:path*',
  ],
}
