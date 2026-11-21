import { Body, Controller, Get, HttpCode, Injectable, Module, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import * as argon2 from "argon2";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import type { Response } from "express";
import { AuthenticatedRequest, StaffAuthGuard } from "@/common/auth.guard";
import { generateToken, hashToken } from "@/common/crypto.util";
import { PrismaService } from "@/common/prisma.service";
import { AuditService } from "@/modules/audit/audit.module";

class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const user = await this.prisma.staffUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials.");
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await this.audit.record({
        actorId: user.id,
        actorRole: user.role,
        action: "STAFF_LOGIN_FAILED",
        resourceType: "StaffUser",
        resourceId: user.id,
        ipAddress: ip,
      });
      throw new UnauthorizedException("Invalid credentials.");
    }

    const rawToken = generateToken(32);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.prisma.staffSession.create({
      data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt },
    });

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: "STAFF_LOGIN_SUCCESS",
      resourceType: "StaffUser",
      resourceId: user.id,
      ipAddress: ip,
    });

    return {
      rawToken,
      expiresAt,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async logout(rawToken: string | undefined, userId: string): Promise<void> {
    if (rawToken) {
      await this.prisma.staffSession.updateMany({
        where: { tokenHash: hashToken(rawToken), userId },
        data: { revokedAt: new Date() },
      });
    }
  }
}

@Controller("v1/auth")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.identity.login(dto.email, dto.password, req.ip);
    res.cookie("px_staff_session", result.rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: result.expiresAt,
      path: "/",
    });
    return { user: result.user };
  }

  @Post("logout")
  @UseGuards(StaffAuthGuard)
  @HttpCode(200)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.["px_staff_session"] as string | undefined;
    await this.identity.logout(raw, req.staff!.userId);
    res.clearCookie("px_staff_session", { path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(StaffAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return { user: req.staff };
  }
}

@Module({
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
