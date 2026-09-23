import { UnauthorizedException } from '@nestjs/common';
import { readToken } from './token';

const PUBLIC = new Set([
  'GET /',
  'POST /auth/signup',
  'POST /auth/login',
  'POST /auth/google',
  'GET /auth/verify',
  'POST /auth/verify',
  'POST /auth/resend-verify',
  'POST /auth/forgot-password',
  'GET /auth/reset',
  'POST /auth/reset',
  'GET /admin',
  'POST /admin/login',
]);

export function routeKey(method: string, path: string) {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  return `${method.toUpperCase()} ${clean}`;
}

export function isPublic(method: string, path: string) {
  const key = routeKey(method, path);
  if (PUBLIC.has(key)) return true;
  if (path.startsWith('/admin') && method.toUpperCase() === 'GET' && path === '/admin') return true;
  return false;
}

export function userIdFromRequest(req: any): number {
  const header = String(req.headers?.authorization || '');
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (bearer) {
    try {
      const id = readToken(bearer).sub;
      if (id > 0) return id;
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
  }
  if (isPublic(req.method || 'GET', req.path || req.url || '/')) return 0;
  throw new UnauthorizedException('Please log in.');
}
