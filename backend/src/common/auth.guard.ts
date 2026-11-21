import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { StaffRole } from "@prisma/client";
import type { Request } from "express";
import { hashToken } from "./crypto.util";
import { PrismaService } from "./prisma.service";

export const ROLES_KEY = "roles";
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

export interface StaffPrincipal {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
}

export type AuthenticatedRequest = Request & { staff?: StaffPrincipal };

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieToken = req.cookies?.["px_staff_session"] as string | undefined;
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    const rawToken = cookieToken ?? bearer;

    if (!rawToken) throw new UnauthorizedException("Authentication required.");

    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) {
      throw new UnauthorizedException("Session is invalid or expired.");
    }

    req.staff = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.staff) throw new UnauthorizedException("Authentication required.");
    if (req.staff.role === "SUPER_ADMIN") return true;
    if (!required.includes(req.staff.role)) {
      throw new ForbiddenException("Insufficient permissions.");
    }
    return true;
  }
}
