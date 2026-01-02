import type { APIRoute } from 'astro';
import { WorkOS } from '@workos-inc/node';

export const GET: APIRoute = async ({ redirect }) => {
  const workos = new WorkOS(import.meta.env.WORKOS_API_KEY);
  
  // Default to localhost if SITE is not configured (common in dev)
  const siteUrl = import.meta.env.SITE || 'http://localhost:4321';

  const authorizationURL = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    redirectUri: `${siteUrl}/auth/callback`,
    clientId: import.meta.env.WORKOS_CLIENT_ID,
  });

  return redirect(authorizationURL);
};

export const prerender = false;
