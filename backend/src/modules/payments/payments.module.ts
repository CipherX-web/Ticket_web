import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { IsString, MaxLength } from "class-validator";
import type { Request } from "express";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { verifyHmac } from "@/common/crypto.util";
import { PrismaService } from "@/common/prisma.service";
import { AuditService } from "@/modules/audit/audit.module";
import { LedgerModule, LedgerService } from "@/modules/ledger/ledger.module";
import { NotificationsService } from "@/modules/notifications/notifications.module";

class WebhookPayloadDto {
  @IsString() @MaxLength(120) providerEventId!: string;
  @IsString() @MaxLength(120) bookingId!: string;
  @IsString() status!: "CAPTURED" | "FAILED";
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async handleGatewayWebhook(rawBody: Buffer | undefined, signature: string | undefined, dto: WebhookPayloadDto) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? "dev_webhook_secret_change_in_prod";
    if (!rawBody || !signature || !verifyHmac(rawBody.toString("utf8"), signature, secret)) {
      throw new UnauthorizedException("Invalid webhook signature.");
    }

    const existing = await this.prisma.payment.findUnique({ where: { providerEventId: dto.providerEventId } });
    if (existing) {
      return { idempotent: true, paymentId: existing.id };
    }

    const booking = await this.prisma.ticketBooking.findUnique({
      where: { id: dto.bookingId },
      include: { event: { include: { organizer: true } }, tickets: true },
    });
    if (!booking) throw new NotFoundException("Booking not found.");

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { bookingId: booking.id } });
      if (!payment) throw new NotFoundException("Payment record not found.");

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: dto.status === "CAPTURED" ? "CAPTURED" : "FAILED",
          providerEventId: dto.providerEventId,
          verifiedAt: dto.status === "CAPTURED" ? new Date() : null,
        },
      });

      if (dto.status === "CAPTURED") {
        await tx.ticketBooking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
        await this.ledger.postBookingCapture(
          {
            bookingId: booking.id,
            grossMinor: booking.totalMinor,
            commissionBps: booking.event.organizer.commissionBps,
            idempotencyBase: `webhook:${dto.providerEventId}`,
          },
          tx,
        );

        await this.notifications.enqueue(
          {
            channel: "EMAIL",
            recipient: booking.buyerEmail,
            template: "TICKETS_ISSUED",
            payload: { reference: booking.reference, ticketCount: booking.tickets.length },
          },
          tx,
        );
      }

      await this.audit.record(
        {
          action: "PAYMENT_WEBHOOK_PROCESSED",
          resourceType: "Payment",
          resourceId: updated.id,
          metadata: { providerEventId: dto.providerEventId, status: dto.status },
        },
        tx,
      );
      return { idempotent: false, paymentId: updated.id, status: updated.status };
    });
  }

  async approveBankTransfer(paymentId: string, staffId: string, staffRole: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { event: { include: { organizer: true } }, tickets: true } } },
    });
    if (!payment) throw new NotFoundException("Payment not found.");
    if (payment.method !== "BANK_TRANSFER" || payment.status !== "MANUAL_REVIEW") {
      throw new BadRequestException("Payment is not awaiting bank reconciliation.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "CAPTURED", verifiedAt: new Date() },
      });
      await tx.ticketBooking.update({ where: { id: payment.bookingId }, data: { status: "CONFIRMED" } });
      await this.ledger.postBookingCapture(
        {
          bookingId: payment.bookingId,
          grossMinor: payment.amountMinor,
          commissionBps: payment.booking.event.organizer.commissionBps,
          idempotencyBase: `bank:${payment.id}`,
        },
        tx,
      );

      await this.notifications.enqueue(
        {
          channel: "EMAIL",
          recipient: payment.booking.buyerEmail,
          template: "TICKETS_ISSUED",
          payload: { reference: payment.booking.reference, ticketCount: payment.booking.tickets.length },
        },
        tx,
      );

      await this.audit.record(
        {
          actorId: staffId,
          actorRole: staffRole,
          action: "BANK_TRANSFER_RECONCILED",
          resourceType: "Payment",
          resourceId: payment.id,
        },
        tx,
      );
      return updated;
    });
  }
}

@Controller("v1/payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("webhook")
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-printx-signature") signature: string | undefined,
    @Body() dto: WebhookPayloadDto,
  ) {
    return this.payments.handleGatewayWebhook(req.rawBody, signature, dto);
  }

  @Post(":id/reconcile")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("FINANCE_STAFF")
  @HttpCode(200)
  reconcile(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.payments.approveBankTransfer(id, req.staff!.userId, req.staff!.role);
  }
}

@Module({
  imports: [LedgerModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
