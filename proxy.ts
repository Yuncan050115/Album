import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { AUTH_SECRET } from '~/server/auth-secret'

const AUTH_COOKIE_NAMES = [
  '__Secure-authjs.session-token',
  'authjs.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
]

async function readJwtToken(req: NextRequest) {
  for (const cookieName of AUTH_COOKIE_NAMES) {
    try {
      const token = await getToken({
        req,
        secret: AUTH_SECRET,
        secureCookie: cookieName.startsWith('__Secure-'),
        cookieName,
        salt: cookieName,
      })

      if (token) return token
    } catch {
      // 某些 Auth.js / NextAuth 版本 cookieName/salt 不匹配会解密失败，继续尝试下一个
    }
  }

  return null
}

async function hasValidSession(req: NextRequest) {
  const token = await readJwtToken(req)
  if (token) return true

  const cookie = req.headers.get('cookie')
  if (!cookie) return false

  try {
    const sessionUrl = new URL('/api/auth/session', req.url)

    const res = await fetch(sessionUrl, {
      method: 'GET',
      headers: {
        cookie,
      },
      cache: 'no-store',
    })

    if (!res.ok) return false

    const session = await res.json()

    return Boolean(session?.user?.email || session?.user?.id)
  } catch {
    return false
  }
}

/**
 * Route guard for Next 16 Proxy.
 *
 * /admin 页面和受保护的 /api/v1 接口都需要登录。
 * 先用 JWT token 判断；如果 Auth.js v5 cookie 名称导致 getToken 读不到，
 * 再用 /api/auth/session 兜底校验真实 session。
 */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  const publicApi = req.method === 'GET' && (
    pathname === '/api/v1/images/client-list' ||
    pathname === '/api/v1/albums/get'
  )

  const needsAuth =
    pathname.startsWith('/admin') ||
    (pathname.startsWith('/api/v1') && !publicApi)

  if (!needsAuth) return NextResponse.next()

  const authed = await hasValidSession(req)

  if (!authed) {
    if (pathname.startsWith('/api/v1')) {
      return NextResponse.json(
        { success: false, message: 'authentication failed' },
        { status: 401 },
      )
    }

    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/v1/:path*',
  ],
}