import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Post,
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

      const isCardAuto = dto.paymentMethod === "CARD_GATEWAY" && event.approvalMode === "AUTOMATIC";
      const reference = generateReference("TKT");
      const booking = await tx.ticketBooking.create({
        data: {
          reference,
          eventId: event.id,
          buyerName: dto.buyerName.trim(),
          buyerEmail: dto.buyerEmail.toLowerCase().trim(),
          buyerWhatsapp: dto.buyerWhatsapp.trim(),
          totalMinor,
          status: isCardAuto ? "CONFIRMED" : "PENDING_MANUAL_REVIEW",
          idempotencyKey,
        },
      });

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          method: dto.paymentMethod,
          status: isCardAuto ? "CAPTURED" : "MANUAL_REVIEW",
          amountMinor: totalMinor,
          verifiedAt: isCardAuto ? new Date() : null,
        },
      });

      const issuedTickets: Array<{ code: string; qrToken: string; tierName: string }> = [];
      if (isCardAuto) {
        const secret = process.env.QR_HMAC_SECRET ?? "dev-secret";
        for (const item of dto.items) {
          const tier = tierMap.get(item.tierId)!;
          for (let i = 0; i < item.quantity; i++) {
            const rawToken = generateToken(24);
            const sig = signHmac(rawToken, secret).slice(0, 16);
            const qrToken = `${rawToken}.${sig}`;
            const code = generateReference("QR");
            await tx.ticket.create({
              data: {
                bookingId: booking.id,
                tierId: tier.id,
                code,
                qrTokenHash: hashToken(qrToken),
              },
            });
            issuedTickets.push({ code, qrToken, tierName: tier.name });
          }
        }

        await this.ledger.postBookingCapture(
          {
            bookingId: booking.id,
            grossMinor: totalMinor,
            commissionBps: event.organizer.commissionBps,
            idempotencyBase: `booking:${booking.id}`,
          },
          tx,
        );

        await this.notifications.enqueue(
          {
            channel: "EMAIL",
            recipient: booking.buyerEmail,
            template: "TICKETS_ISSUED",
            payload: { reference: booking.reference, ticketCount: issuedTickets.length },
          },
          tx,
        );
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
    const tokenHash = hashToken(qrToken.trim());
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { qrTokenHash: tokenHash },
        include: { tier: { select: { name: true } }, booking: { select: { reference: true, buyerName: true } } },
      });
      if (!ticket) throw new NotFoundException("Invalid ticket QR code.");

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
      payload: { expiresInMinutes: 10 },
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
}

@Controller("v1/ticketing")
export class TicketingController {
  constructor(private readonly ticketing: TicketingService) {}

  @Post("holds")
  createHolds(@Body() dto: CreateHoldsDto) {
    return this.ticketing.createHolds(dto.items);
  }

  @Post("checkout")
  checkout(@Body() dto: CheckoutDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.ticketing.checkout(dto, idempotencyKey);
  }

  @Post("recovery/request")
  @HttpCode(200)
  requestOtp(@Body() dto: RecoveryRequestDto) {
    return this.ticketing.requestRecoveryOtp(dto.email);
  }

  @Post("recovery/verify")
  @HttpCode(200)
  verifyOtp(@Body() dto: RecoveryVerifyDto) {
    return this.ticketing.verifyRecoveryOtp(dto.email, dto.otp);
  }

  @Post("checkin")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("CHECKIN_OPERATOR", "EVENT_MANAGER")
  @HttpCode(200)
  checkIn(@Body() dto: CheckinDto, @Req() req: AuthenticatedRequest) {
    return this.ticketing.checkIn(dto.qrToken, req.staff!.userId, req.staff!.role);
  }
}

@Module({
  imports: [LedgerModule],
  controllers: [TicketingController],
  providers: [TicketingService],
  exports: [TicketingService],
})
export class TicketingModule {}
