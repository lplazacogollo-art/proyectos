import crypto from 'crypto';
import type { Request, Response, NextFunction, CookieOptions } from 'express';

const SECRET = process.env.SESSION_SECRET || 'ventasmart-fallback-secret-key-colombia';
export const SESSION_COOKIE = 'vs_session';

export interface SessionPayload {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
  exp: number;
}

export function getSessionCookieOptions(req: Request): CookieOptions {
  const proto = String(req.headers['x-forwarded-proto'] || '');
  const isHttps = req.secure || proto.includes('https');
  return {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  user?: SessionPayload;
}

export function extractTokenFromRequest(req: Request): string | undefined {
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }
  return undefined;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: 'Sesión no válida o expirada. Inicia sesión nuevamente.' });
    return;
  }
  req.user = session;
  next();
}
