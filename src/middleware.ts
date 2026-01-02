import type { APIContext, MiddlewareNext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { WorkOS, type SessionCookieData } from '@workos-inc/node';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = new URL(context.request.url);

  // Protected routes - require authentication
  if (pathname.startsWith('/chat') || pathname.startsWith('/api')) {
    return withAuth(context, next);
  }

  return next();
});

async function withAuth(context: APIContext, next: MiddlewareNext) {
  const cookie = context.cookies.get('wos-session');

  if (!cookie?.value) {
    console.log('Middleware: No session cookie found');
    return context.redirect('/sign-in');
  }

  try {
    const workos = new WorkOS(import.meta.env.WORKOS_API_KEY, {
      clientId: import.meta.env.WORKOS_CLIENT_ID,
    });

    // Verify session
    const authResponse = await workos.userManagement.authenticateWithSessionCookie({
      sessionData: cookie.value,
      cookiePassword: import.meta.env.WORKOS_COOKIE_PASSWORD,
    });

    if (!authResponse.authenticated && authResponse.reason !== 'invalid_jwt') {
      console.log('Middleware: Auth failed', authResponse.reason);
      return context.redirect('/sign-in');
    }

    // Refresh session if needed
    const refreshResponse = await workos.userManagement.refreshAndSealSessionData({
      sessionData: cookie.value,
      cookiePassword: import.meta.env.WORKOS_COOKIE_PASSWORD,
    });

    if (!refreshResponse.authenticated) {
      console.log('Middleware: Refresh failed');
      context.cookies.delete('wos-session', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: import.meta.env.PROD,
      });
      return context.redirect('/sign-in');
    }

    // Update session cookie
    context.cookies.set('wos-session', String(refreshResponse.sealedSession), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
    });

    // Get user from session
    const sessionData = await workos.userManagement.getSessionFromCookie({
      sessionData: cookie.value,
      cookiePassword: import.meta.env.WORKOS_COOKIE_PASSWORD,
    }) as SessionCookieData;

    context.locals.user = sessionData.user;

    return next();
  } catch (error) {
    console.error('Middleware error:', error);
    return context.redirect('/sign-in');
  }
}
