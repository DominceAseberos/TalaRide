import { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';
import { supabaseAdmin } from './supabase-admin.js';
import { repository } from './repository.js';
import { AppRole, Profile, Driver } from '../types.js';

function canonicalRole(value: unknown): AppRole | null {
  return value === 'admin' || value === 'operator' || value === 'passenger' || value === 'driver'
    ? value
    : null;
}

export interface AuthenticatedUser {
  id: string;
  role: AppRole;
  full_name: string;
  mobile_number: string;
  driver_code?: string | null;
  toda_group?: { id: string; name: string } | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Extracts and verifies Bearer token from request.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  // Support query param token for EventSource / SSE
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  if (!token) {
    return null;
  }

  // 1. Support demo/test tokens only if DEMO_AUTH is enabled
  if (env.NODE_ENV === 'test' && env.DEMO_AUTH) {
    if (token === 'demo-admin-token' || token.startsWith('mock-admin')) {
      const p = await repository.getProfile('USR-ADM-001');
      return {
        id: p?.id || 'USR-ADM-001',
        role: 'admin',
        full_name: p?.full_name || 'Admin TalaRide',
        mobile_number: p?.mobile_number || '09990001122'
      };
    }
    if (token === 'demo-driver-token' || token.startsWith('mock-driver')) {
      const driver = await repository.getDriver('DR-000481');
      return {
        id: driver?.user_id || 'USR-DRV-001',
        role: 'driver',
        full_name: driver?.full_name || 'Juan Dela Cruz',
        mobile_number: driver?.mobile_number || '09171234567',
        driver_code: 'DR-000481'
      };
    }
    if (token === 'demo-passenger-token' || token.startsWith('mock-passenger')) {
      const p = await repository.getProfile('USR-COM-001');
      return {
        id: p?.id || 'USR-COM-001',
        role: 'passenger',
        full_name: p?.full_name || 'Maria Santos',
        mobile_number: p?.mobile_number || '09187654321'
      };
    }
  }

  // 2. Real Supabase JWT verification
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    const userId = data.user.id;
    let profile = await repository.getProfile(userId);
    let driver: Driver | null = await repository.getDriverByUserId(userId);
    const { data: storedProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
    const managedRole = canonicalRole(data.user.app_metadata?.role);
    const storedRole = canonicalRole(storedProfile?.role);
    const role: AppRole = managedRole === 'admin' || managedRole === 'operator'
      ? managedRole
      : storedRole === 'admin' || storedRole === 'operator'
        ? storedRole
        : driver ? 'driver' : storedRole === 'driver' || managedRole === 'driver'
          ? 'driver' : storedRole || managedRole || canonicalRole(profile?.role) || 'passenger';

    if (!profile) {
      // If user profile is not found, check driver table
      driver = await repository.getDriverByUserId(userId);
      profile = {
        id: userId,
        mobile_number: data.user.phone || data.user.email || '',
        full_name: data.user.user_metadata?.full_name || 'TalaRide User',
        role,
        status: 'active',
        created_at: data.user.created_at
      };
      await repository.createProfile(profile);
    } else if (role === 'driver') {
      driver = await repository.getDriverByUserId(userId);
    }

    if (profile.status !== 'active') return null;
    return {
      id: profile.id,
      role,
      full_name: profile.full_name,
      mobile_number: profile.mobile_number,
      driver_code: driver?.driver_code || null,
      toda_group: typeof data.user.app_metadata?.toda_group_id === 'string' && typeof data.user.app_metadata?.toda_group_name === 'string'
        && data.user.app_metadata.toda_group_id.trim() && data.user.app_metadata.toda_group_name.trim()
        ? { id: data.user.app_metadata.toda_group_id.trim(), name: data.user.app_metadata.toda_group_name.trim() } : null
    };
  } catch (err) {
    console.error('Supabase token verification error:', err);
    return null;
  }
}

/**
 * Optional authentication: populates req.user if token is valid.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateRequest(req);
    if (user) {
      req.user = user;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Enforces authenticated session. Returns 401 if unauthenticated.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token is required'
      });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token verification failed'
    });
  }
}

/**
 * Enforces role boundaries. Returns 401 if unauthenticated, 403 if unauthorized.
 */
export function requireRole(...allowedRoles: AppRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication is required to access this resource'
        });
      }

      req.user = user;

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed'
      });
    }
  };
}

export async function productionAuth(req: Request, res: Response, next: NextFunction) {
  if (env.NODE_ENV === 'test') return next();
  return requireAuth(req, res, next);
}
export function canManageDriver(req: Request, code: string) {
  return env.NODE_ENV === 'test' || req.user?.driver_code === code || req.user?.role === 'admin';
}
