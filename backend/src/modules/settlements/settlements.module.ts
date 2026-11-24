import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsString } from "class-validator";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { PrismaService } from "@/common/prisma.service";
import { AuditService } from "@/modules/audit/audit.module";

class CreateSettlementDto {
  @IsString() eventId!: string;
  @IsString() organizerId!: string;
}

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

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

  /**
   * Computes a settlement for a given event from immutable ledger entries.
   * Only confirmed bookings are included. Creates a DRAFT settlement.
   */
  async createForEvent(dto: CreateSettlementDto, staffId: string, staffRole: string) {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException("Event not found.");
    if (event.organizerId !== dto.organizerId) throw new BadRequestException("Organizer does not match event.");

    // Check for an existing non-draft settlement for this event
    const existing = await this.prisma.settlement.findFirst({
      where: { eventId: dto.eventId, status: { not: "DRAFT" } },
    });
    if (existing) throw new BadRequestException("A non-draft settlement already exists for this event.");

    const bookingIds = await this.getEventBookingIds(dto.eventId);
    if (bookingIds.length === 0) {
      throw new BadRequestException("No confirmed bookings found for this event.");
    }

    const [grossAgg, commAgg, orgAgg] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        _sum: { amountMinor: true },
        where: { referenceType: "BOOKING", accountCode: "CASH_CLEARING", direction: "DEBIT",
          referenceId: { in: bookingIds } },
      }),
      this.prisma.ledgerEntry.aggregate({
        _sum: { amountMinor: true },
        where: { referenceType: "BOOKING", accountCode: "PLATFORM_COMMISSION", direction: "CREDIT",
          referenceId: { in: bookingIds } },
      }),
      this.prisma.ledgerEntry.aggregate({
        _sum: { amountMinor: true },
        where: { referenceType: "BOOKING", accountCode: "ORGANIZER_PAYABLE", direction: "CREDIT",
          referenceId: { in: bookingIds } },
      }),
    ]);

    const grossMinor = grossAgg._sum.amountMinor ?? 0;
    const commissionMinor = commAgg._sum.amountMinor ?? 0;
    const netPayableMinor = orgAgg._sum.amountMinor ?? 0;

    if (grossMinor === 0) throw new BadRequestException("No confirmed revenue found for this event.");

    // Remove any stale DRAFT settlement before creating a fresh one
    await this.prisma.settlement.deleteMany({ where: { eventId: dto.eventId, status: "DRAFT" } });

    const settlement = await this.prisma.settlement.create({
      data: {
        organizerId: dto.organizerId,
        eventId: dto.eventId,
        grossMinor,
        refundsMinor: 0,
        commissionMinor,
        feesMinor: 0,
        netPayableMinor,
        status: "DRAFT",
      },
    });

    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "SETTLEMENT_CREATED",
      resourceType: "Settlement",
      resourceId: settlement.id,
      metadata: { eventId: dto.eventId, grossMinor, commissionMinor, netPayableMinor },
    });

    this.logger.log(`Settlement ${settlement.id} created for event ${dto.eventId}`);
    return settlement;
  }

  async approve(id: string, staffId: string, staffRole: string) {
    const settlement = await this.prisma.settlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundException("Settlement not found.");
    if (settlement.status !== "DRAFT") throw new BadRequestException("Only DRAFT settlements can be approved.");

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

  /** Mark as PAID after the actual bank transfer is completed */
  async markPaid(id: string, staffId: string, staffRole: string) {
    const settlement = await this.prisma.settlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundException("Settlement not found.");
    if (settlement.status !== "APPROVED") throw new BadRequestException("Only APPROVED settlements can be marked as paid.");

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });
    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "SETTLEMENT_PAID",
      resourceType: "Settlement",
      resourceId: id,
    });
    return updated;
  }

  private async getEventBookingIds(eventId: string): Promise<string[]> {
    const bookings = await this.prisma.ticketBooking.findMany({
      where: { eventId, status: "CONFIRMED" },
      select: { id: true },
    });
    return bookings.map((b) => b.id);
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

  /** Create a DRAFT settlement derived from ledger entries for an event */
  @Post()
  @Roles("FINANCE_STAFF")
  create(@Body() dto: CreateSettlementDto, @Req() req: AuthenticatedRequest) {
    return this.settlements.createForEvent(dto, req.staff!.userId, req.staff!.role);
  }

  /** Finance approve the DRAFT */
  @Post(":id/approve")
  @Roles("FINANCE_STAFF")
  approve(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.settlements.approve(id, req.staff!.userId, req.staff!.role);
  }

  /** Mark APPROVED settlement as PAID after wire transfer */
  @Post(":id/mark-paid")
  @Roles("FINANCE_STAFF")
  markPaid(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.settlements.markPaid(id, req.staff!.userId, req.staff!.role);
  }
}

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
