import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  forwardRef,
  Get,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { generateNumericOtp, generateReference, generateToken, hashToken, signHmac } from "@/common/crypto.util";
import { PrismaService } from "@/common/prisma.service";
import { AuditService } from "@/modules/audit/audit.module";
import { LedgerModule, LedgerService } from "@/modules/ledger/ledger.module";
import { NotificationsService } from "@/modules/notifications/notifications.module";

class HoldItemDto {
  @IsString() tierId!: string;
  @IsInt() @Min(1) @Max(20) quantity!: number;
}

class CreateHoldsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => HoldItemDto)
  items!: HoldItemDto[];
}

class CheckoutDto {
  @IsString() eventId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => HoldItemDto)
  items!: HoldItemDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) holdIds?: string[];
  @IsString() @MinLength(2) @MaxLength(100) buyerName!: string;
  @IsEmail() @MaxLength(254) buyerEmail!: string;
  @IsString() @Matches(/^\+?\d[\d\s-]{8,14}$/) buyerWhatsapp!: string;
  @IsEnum(["CARD_GATEWAY", "BANK_TRANSFER"]) paymentMethod!: "CARD_GATEWAY" | "BANK_TRANSFER";
}

class CheckinDto {
  @IsString() @MinLength(10) @MaxLength(256) qrToken!: string;
}

class RecoveryRequestDto {
  @IsEmail() @MaxLength(254) email!: string;
}

class RecoveryVerifyDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Matches(/^\d{6}$/) otp!: string;
}

@Injectable()
export class TicketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Atomically reserves inventory for 10 minutes.
   * Uses conditional UPDATE (`available >= qty`) inside a single DB transaction so concurrent requests cannot oversell.
   */
  async createHolds(items: HoldItemDto[]) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return this.prisma.$transaction(async (tx) => {
      const holds = [];
      for (const item of items) {
        const tier = await tx.ticketTier.findUnique({ where: { id: item.tierId } });
        if (!tier) throw new NotFoundException("Ticket tier not found.");
        if (item.quantity > tier.perOrderMax) {
          throw new BadRequestException(`Maximum ${tier.perOrderMax} per order for ${tier.name}.`);
        }

        const updated = await tx.$executeRaw`
          UPDATE "TicketTier"
          SET "available" = "available" - ${item.quantity}
          WHERE "id" = ${item.tierId} AND "available" >= ${item.quantity}
        `;
        if (updated === 0) {
          throw new ConflictException(`Not enough tickets remaining for ${tier.name}.`);
        }

        const hold = await tx.inventoryHold.create({
          data: { tierId: item.tierId, quantity: item.quantity, expiresAt },
        });
        holds.push(hold);
      }
      return { expiresAt, holds };
    });
  }

  /**
   * Guest checkout without account creation.
   * Recomputes prices server-side, creates booking + payment, and issues QR tickets atomically.
   */
  async checkout(dto: CheckoutDto, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await this.prisma.ticketBooking.findUnique({
        where: { idempotencyKey },
        include: { tickets: { select: { code: true, status: true, tierId: true } } },
      });
      if (existing) return existing;
    }

    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      include: { organizer: true, tiers: true },
    });
    if (!event || !event.isPublished) throw new NotFoundException("Event not found.");

    return this.prisma.$transaction(async (tx) => {
      let totalMinor = 0;
      const tierMap = new Map(event.tiers.map((t) => [t.id, t]));

      for (const item of dto.items) {
        const tier = tierMap.get(item.tierId);
        if (!tier) throw new BadRequestException("Ticket tier does not belong to this event.");
        if (item.quantity > tier.perOrderMax) {
          throw new BadRequestException(`Maximum ${tier.perOrderMax} per order for ${tier.name}.`);
        }
        totalMinor += tier.priceMinor * item.quantity;

        // If no prior hold was passed, atomically decrement available here
        if (!dto.holdIds || dto.holdIds.length === 0) {
          const updated = await tx.$executeRaw`
            UPDATE "TicketTier"
            SET "available" = "available" - ${item.quantity}
            WHERE "id" = ${item.tierId} AND "available" >= ${item.quantity}
          `;
          if (updated === 0) {
            throw new ConflictException(`Not enough tickets remaining for ${tier.name}.`);
          }
        }
      }

      if (dto.holdIds && dto.holdIds.length > 0) {
        await tx.inventoryHold.updateMany({
          where: { id: { in: dto.holdIds }, consumedAt: null, releasedAt: null },
          data: { consumedAt: new Date() },
        });
      }

      const isCard = dto.paymentMethod === "CARD_GATEWAY";
      const reference = generateReference("TKT");
      const booking = await tx.ticketBooking.create({
        data: {
          reference,
          eventId: event.id,
          buyerName: dto.buyerName.trim(),
          buyerEmail: dto.buyerEmail.toLowerCase().trim(),
          buyerWhatsapp: dto.buyerWhatsapp.trim(),
          totalMinor,
          status: isCard ? "PENDING_PAYMENT" : "PENDING_MANUAL_REVIEW",
          idempotencyKey,
        },
      });

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          method: dto.paymentMethod,
          status: isCard ? "PENDING" : "MANUAL_REVIEW",
          amountMinor: totalMinor,
          verifiedAt: null,
        },
      });

      // Always create tickets for the booking.
      // qrToken is deterministically HMAC-signed from code so it can be verified & re-served securely.
      const secret = process.env.QR_HMAC_SECRET ?? "dev-secret";
      const issuedTickets: Array<{ code: string; qrToken: string; tierName: string }> = [];

      for (const item of dto.items) {
        const tier = tierMap.get(item.tierId)!;
        for (let i = 0; i < item.quantity; i++) {
          const code = generateReference("QR");
          const sig = signHmac(code, secret);
          const qrToken = `${code}.${sig}`;
          await tx.ticket.create({
            data: {
              bookingId: booking.id,
              tierId: tier.id,
              code,
              qrTokenHash: hashToken(qrToken),
            },
          });
        }
      }

      await this.audit.record(
        {
          action: "TICKET_BOOKING_CREATED",
          resourceType: "TicketBooking",
          resourceId: booking.id,
          metadata: { reference: booking.reference, totalMinor, paymentId: payment.id, status: booking.status },
        },
        tx,
      );

      return {
        bookingId: booking.id,
        reference: booking.reference,
        status: booking.status,
        totalMinor: booking.totalMinor,
        tickets: issuedTickets,
      };
    });
  }

  /** Atomic duplicate-scan prevention for event-day check-in. */
  async checkIn(qrToken: string, staffId: string, staffRole: string) {
    const raw = qrToken.trim();
    const tokenHash = hashToken(raw);
    return this.prisma.$transaction(async (tx) => {
      // Find by hash of full qrToken, or by human-readable ticket code if gate operator enters it
      const ticket = await tx.ticket.findFirst({
        where: {
          OR: [{ qrTokenHash: tokenHash }, { code: raw.toUpperCase() }],
        },
        include: {
          tier: { select: { name: true } },
          booking: { select: { reference: true, buyerName: true, status: true } },
        },
      });
      if (!ticket) throw new NotFoundException("Invalid ticket QR code.");

      if (ticket.booking.status !== "CONFIRMED") {
        throw new ConflictException(
          `Cannot check in: booking is ${ticket.booking.status.replace(/_/g, " ").toLowerCase()}.`,
        );
      }

      const updated = await tx.$executeRaw`
        UPDATE "Ticket"
        SET "status" = 'CHECKED_IN', "checkedInAt" = NOW(), "checkedInBy" = ${staffId}
        WHERE "id" = ${ticket.id} AND "status" = 'VALID'
      `;
      if (updated === 0) {
        await this.audit.record(
          {
            actorId: staffId,
            actorRole: staffRole,
            action: "TICKET_CHECKIN_DUPLICATE",
            resourceType: "Ticket",
            resourceId: ticket.id,
          },
          tx,
        );
        throw new ConflictException("Ticket has already been checked in or cancelled.");
      }

      await this.audit.record(
        {
          actorId: staffId,
          actorRole: staffRole,
          action: "TICKET_CHECKIN_GRANTED",
          resourceType: "Ticket",
          resourceId: ticket.id,
        },
        tx,
      );

      return {
        admitted: true,
        code: ticket.code,
        tierName: ticket.tier.name,
        buyerName: ticket.booking.buyerName,
        bookingReference: ticket.booking.reference,
      };
    });
  }

  async requestRecoveryOtp(email: string) {
    const normalized = email.toLowerCase().trim();
    const otp = generateNumericOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.recoveryOtp.create({
      data: { email: normalized, otpHash: hashToken(otp), expiresAt },
    });
    await this.notifications.enqueue({
      channel: "EMAIL",
      recipient: normalized,
      template: "TICKET_RECOVERY_OTP",
      payload: { otp, expiresInMinutes: 10 },
    });
    return { sent: true, message: "If bookings exist for this email, a 6-digit code has been sent." };
  }

  async verifyRecoveryOtp(email: string, otp: string) {
    const normalized = email.toLowerCase().trim();
    const record = await this.prisma.recoveryOtp.findFirst({
      where: { email: normalized, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record || record.attempts >= 5 || record.otpHash !== hashToken(otp)) {
      if (record) {
        await this.prisma.recoveryOtp.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 } },
        });
      }
      throw new BadRequestException("Invalid or expired verification code.");
    }

    await this.prisma.recoveryOtp.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    const bookings = await this.prisma.ticketBooking.findMany({
      where: { buyerEmail: normalized },
      select: {
        reference: true,
        status: true,
        totalMinor: true,
        createdAt: true,
        event: { select: { title: true, startsAt: true, venue: true } },
        tickets: { select: { code: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { bookings };
  }

  // ── Staff Admin Endpoints ──────────────────────────────────────────────────

  listBookings(filters?: { eventId?: string; status?: string; q?: string }) {
    const q = filters?.q?.trim();
    return this.prisma.ticketBooking.findMany({
      where: {
        ...(filters?.eventId && { eventId: filters.eventId }),
        ...(filters?.status && { status: filters.status as any }),
        ...(q && {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { buyerName: { contains: q, mode: "insensitive" } },
            { buyerEmail: { contains: q, mode: "insensitive" } },
            { buyerWhatsapp: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        event: { select: { id: true, title: true, slug: true, startsAt: true, venue: true } },
        tickets: {
          select: {
            id: true,
            code: true,
            status: true,
            checkedInAt: true,
            tier: { select: { id: true, name: true, code: true, priceMinor: true } },
          },
        },
        payments: {
          select: { id: true, method: true, status: true, amountMinor: true, providerRef: true, verifiedAt: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async cancelBooking(bookingId: string, staffId: string, staffRole: string) {
    const booking = await this.prisma.ticketBooking.findUnique({
      where: { id: bookingId },
      include: { tickets: true },
    });
    if (!booking) throw new NotFoundException("Booking not found.");
    if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
      throw new BadRequestException(`Booking is already ${booking.status}.`);
    }
    if (booking.tickets.some((t) => t.status === "CHECKED_IN")) {
      throw new BadRequestException("Cannot cancel a booking that already has checked-in tickets.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.ticketBooking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" },
      });

      await tx.ticket.updateMany({
        where: { bookingId },
        data: { status: "CANCELLED" },
      });

      // Restore tier availability counts
      const tierCounts = new Map<string, number>();
      for (const tk of booking.tickets) {
        tierCounts.set(tk.tierId, (tierCounts.get(tk.tierId) ?? 0) + 1);
      }
      for (const [tierId, qty] of tierCounts.entries()) {
        await tx.ticketTier.update({
          where: { id: tierId },
          data: { available: { increment: qty } },
        });
      }

      await this.audit.record(
        {
          actorId: staffId,
          actorRole: staffRole,
          action: "BOOKING_CANCELLED",
          resourceType: "TicketBooking",
          resourceId: bookingId,
          metadata: { reference: booking.reference, ticketCount: booking.tickets.length },
        },
        tx,
      );

      return { cancelled: true, id: bookingId, reference: booking.reference };
    });
  }

  listAttendees(filters?: { eventId?: string; tierId?: string; status?: string; q?: string }) {
    const q = filters?.q?.trim();
    return this.prisma.ticket.findMany({
      where: {
        ...(filters?.tierId && { tierId: filters.tierId }),
        ...(filters?.status && { status: filters.status as any }),
        booking: {
          ...(filters?.eventId && { eventId: filters.eventId }),
          ...(q && {
            OR: [
              { reference: { contains: q, mode: "insensitive" } },
              { buyerName: { contains: q, mode: "insensitive" } },
              { buyerEmail: { contains: q, mode: "insensitive" } },
              { buyerWhatsapp: { contains: q, mode: "insensitive" } },
            ],
          }),
        },
      },
      include: {
        tier: { select: { id: true, name: true, code: true, priceMinor: true } },
        booking: {
          select: {
            id: true,
            reference: true,
            buyerName: true,
            buyerEmail: true,
            buyerWhatsapp: true,
            status: true,
            createdAt: true,
            event: { select: { id: true, title: true, startsAt: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  }

  async checkInById(ticketId: string, staffId: string, staffRole: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { booking: true, tier: true },
    });
    if (!ticket) throw new NotFoundException("Ticket not found.");
    if (ticket.booking.status !== "CONFIRMED") {
      throw new BadRequestException("Ticket booking is not confirmed for entry.");
    }

    const res = await this.prisma.ticket.updateMany({
      where: { id: ticketId, status: "VALID" },
      data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInBy: staffId },
    });
    if (res.count === 0) {
      throw new ConflictException(
        ticket.status === "CHECKED_IN"
          ? `Already checked in at ${ticket.checkedInAt?.toISOString()}.`
          : `Ticket status is ${ticket.status}.`,
      );
    }

    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "TICKET_CHECKIN_ADMIN",
      resourceType: "Ticket",
      resourceId: ticket.id,
      metadata: { code: ticket.code },
    });

    return { checkedIn: true, id: ticket.id, code: ticket.code, buyerName: ticket.booking.buyerName };
  }
}

// ─── Hold Release Service ────────────────────────────────────────────────────
/** Restores inventory for expired, unconsumed holds. Run as a periodic job. */
@Injectable()
export class HoldReleaseService {
  private readonly logger = new Logger(HoldReleaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async releaseExpired(): Promise<{ released: number }> {
    const now = new Date();
    // Find expired holds that were never consumed or manually released
    const expired = await this.prisma.inventoryHold.findMany({
      where: { expiresAt: { lt: now }, consumedAt: null, releasedAt: null },
      select: { id: true, tierId: true, quantity: true },
    });

    if (expired.length === 0) return { released: 0 };

    // Group by tierId and restore available counts in one transaction
    const grouped = new Map<string, { ids: string[]; quantity: number }>();
    for (const h of expired) {
      const entry = grouped.get(h.tierId) ?? { ids: [], quantity: 0 };
      entry.ids.push(h.id);
      entry.quantity += h.quantity;
      grouped.set(h.tierId, entry);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [tierId, { ids, quantity }] of grouped) {
        await tx.$executeRaw`
          UPDATE "TicketTier" SET "available" = "available" + ${quantity}
          WHERE "id" = ${tierId}
        `;
        await tx.inventoryHold.updateMany({
          where: { id: { in: ids } },
          data: { releasedAt: now },
        });
      }
    });

    this.logger.log(`Released ${expired.length} expired holds across ${grouped.size} tiers`);
    return { released: expired.length };
  }
}

// ─── Booking Lookup (buyer self-service) ─────────────────────────────────────
class BookingLookupDto {
  @IsString() @MinLength(3) @MaxLength(60) reference!: string;
  @IsEmail() @MaxLength(254) email!: string;
}

@Injectable()
export class BookingLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async lookup(reference: string, email: string) {
    const booking = await this.prisma.ticketBooking.findFirst({
      where: {
        reference: reference.toUpperCase().trim(),
        buyerEmail: email.toLowerCase().trim(),
      },
      include: {
        event: { select: { title: true, startsAt: true, venue: true, city: true } },
        tickets: {
          select: { code: true, status: true, tier: { select: { name: true } }, checkedInAt: true },
        },
      },
    });
    if (!booking) throw new NotFoundException("Booking not found or email does not match.");

    const secret = process.env.QR_HMAC_SECRET ?? "dev-secret";
    const isConfirmed = booking.status === "CONFIRMED";

    return {
      reference: booking.reference,
      status: booking.status,
      totalMinor: booking.totalMinor,
      currency: booking.currency,
      buyerName: booking.buyerName,
      event: booking.event,
      tickets: booking.tickets.map((t) => {
        // Construct authentic signed qrToken only for confirmed bookings
        const sig = signHmac(t.code, secret);
        const qrToken = isConfirmed ? `${t.code}.${sig}` : "";
        return {
          code: t.code,
          qrToken,
          tierName: t.tier.name,
          status: isConfirmed ? t.status : "PENDING_CONFIRMATION",
          checkedInAt: t.checkedInAt,
        };
      }),
    };
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────
@Controller("v1/ticketing")
export class TicketingController {
  constructor(
    private readonly ticketing: TicketingService,
    private readonly holdRelease: HoldReleaseService,
    private readonly bookingLookup: BookingLookupService,
  ) {}

  /** Tighter throttle: 10 holds per minute per IP to prevent inventory squatting */
  @Post("holds")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  createHolds(@Body() dto: CreateHoldsDto) {
    return this.ticketing.createHolds(dto.items);
  }

  /** Idempotent checkout — throttled to 10 per minute per IP */
  @Post("checkout")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  checkout(@Body() dto: CheckoutDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.ticketing.checkout(dto, idempotencyKey);
  }

  /** Buyer self-service: look up booking by reference + email */
  @Post("booking/lookup")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  lookupBooking(@Body() dto: BookingLookupDto) {
    return this.bookingLookup.lookup(dto.reference, dto.email);
  }

  /** OTP recovery — throttled hard: 5 per 10 minutes per IP */
  @Post("recovery/request")
  @HttpCode(200)
  @Throttle({ default: { ttl: 600000, limit: 5 } })
  requestOtp(@Body() dto: RecoveryRequestDto) {
    return this.ticketing.requestRecoveryOtp(dto.email);
  }

  @Post("recovery/verify")
  @HttpCode(200)
  @Throttle({ default: { ttl: 600000, limit: 10 } })
  verifyOtp(@Body() dto: RecoveryVerifyDto) {
    return this.ticketing.verifyRecoveryOtp(dto.email, dto.otp);
  }

  /** Staff: scan QR at event gate */
  @Post("checkin")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("CHECKIN_OPERATOR", "EVENT_MANAGER")
  @HttpCode(200)
  checkIn(@Body() dto: CheckinDto, @Req() req: AuthenticatedRequest) {
    return this.ticketing.checkIn(dto.qrToken, req.staff!.userId, req.staff!.role);
  }

  /** Staff: manually trigger hold release (also runs via cron-like scheduler) */
  @Post("admin/release-holds")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("EVENT_MANAGER")
  @HttpCode(200)
  releaseHolds() {
    return this.holdRelease.releaseExpired();
  }

  /** Staff: list all bookings with event, tickets, and payment info */
  @Get("admin/bookings")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("EVENT_MANAGER", "FINANCE_STAFF")
  listBookings(
    @Query("eventId") eventId?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
  ) {
    return this.ticketing.listBookings({ eventId, status, q });
  }

  /** Staff: cancel booking and restore inventory */
  @Post("admin/bookings/:id/cancel")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("EVENT_MANAGER", "FINANCE_STAFF")
  @HttpCode(200)
  cancelBooking(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketing.cancelBooking(id, req.staff!.userId, req.staff!.role);
  }

  /** Staff: list attendees derived from real tickets + bookings */
  @Get("admin/attendees")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("EVENT_MANAGER", "CHECKIN_OPERATOR", "FINANCE_STAFF")
  listAttendees(
    @Query("eventId") eventId?: string,
    @Query("tierId") tierId?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
  ) {
    return this.ticketing.listAttendees({ eventId, tierId, status, q });
  }

  /** Staff: check in an attendee by ticket id */
  @Post("admin/tickets/:id/checkin")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("CHECKIN_OPERATOR", "EVENT_MANAGER")
  @HttpCode(200)
  checkInById(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketing.checkInById(id, req.staff!.userId, req.staff!.role);
  }
}

@Module({
  imports: [LedgerModule],
  controllers: [TicketingController],
  providers: [TicketingService, HoldReleaseService, BookingLookupService],
  exports: [TicketingService, HoldReleaseService],
})
export class TicketingModule {}
