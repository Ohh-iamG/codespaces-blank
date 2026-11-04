import { auth } from './firebase';

/**
 * Base URL of the IZA server. Empty for the web build (same origin).
 * Native (iOS/Android) builds must set VITE_API_BASE_URL to the hosted server.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/** fetch() for IZA API routes: adds the signed-in user's Firebase ID token. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const user = auth.currentUser;
  if (user) {
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
