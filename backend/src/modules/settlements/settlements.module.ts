import { Controller, Get, Injectable, Module, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { PrismaService } from "@/common/prisma.service";
import { AuditService } from "@/modules/audit/audit.module";

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listAll() {
    return this.prisma.settlement.findMany({
      include: { organizer: { select: { name: true } }, event: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async approve(id: string, staffId: string, staffRole: string) {
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: "APPROVED", approvedBy: staffId, approvedAt: new Date() },
    });
    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "SETTLEMENT_APPROVED",
      resourceType: "Settlement",
      resourceId: id,
    });
    return updated;
  }
}

@Controller("v1/settlements")
@UseGuards(StaffAuthGuard, RolesGuard)
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  @Get()
  @Roles("FINANCE_STAFF")
  list() {
    return this.settlements.listAll();
  }

  @Post(":id/approve")
  @Roles("FINANCE_STAFF")
  approve(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.settlements.approve(id, req.staff!.userId, req.staff!.role);
  }
}

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
