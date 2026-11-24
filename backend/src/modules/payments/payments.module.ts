import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { Throttle } from "@nestjs/throttler";
import { IsOptional, IsString, MaxLength } from "class-validator";
import type { Request } from "express";
import * as crypto from "crypto";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { verifyHmac } from "@/common/crypto.util";
import { PrismaService } from "@/common/prisma.service";
import { AuditService } from "@/modules/audit/audit.module";
import { LedgerModule, LedgerService } from "@/modules/ledger/ledger.module";
import { NotificationsService } from "@/modules/notifications/notifications.module";

export class WebhookPayloadDto {
  @IsString() @MaxLength(120) providerEventId!: string;
  @IsString() @MaxLength(120) bookingId!: string;
  @IsString() status!: "CAPTURED" | "FAILED";
}

export class CreatePaymentSessionDto {
  @IsString() bookingId!: string;
  @IsOptional() @IsString() returnUrl?: string;
  @IsOptional() @IsString() cancelUrl?: string;
}

export class PayHereNotifyDto {
  @IsString() merchant_id!: string;
  @IsString() order_id!: string;
  @IsString() payment_id!: string;
  @IsString() payhere_amount!: string;
  @IsString() payhere_currency!: string;
  @IsString() status_code!: string;
  @IsString() md5sig!: string;
  @IsOptional() @IsString() custom_1?: string;
  @IsOptional() @IsString() custom_2?: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() status_message?: string;
  @IsOptional() @IsString() card_holder_name?: string;
  @IsOptional() @IsString() card_no?: string;
  @IsOptional() @IsString() card_expiry?: string;
}

export interface PaymentGatewayParams {
  provider: "PAYHERE" | "WEBXPAY" | "GENERIC";
  actionUrl: string;
  method: "POST" | "GET";
  fields: Record<string, string>;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Initializes a payment session for an existing booking and prepares the client payload
   * for hosted gateways (PayHere, WebXPay, or generic provider).
   */
  async createPaymentSession(dto: CreatePaymentSessionDto): Promise<{
    bookingReference: string;
    amountFormatted: string;
    currency: string;
    gateway: PaymentGatewayParams;
  }> {
    const booking = await this.prisma.ticketBooking.findUnique({
      where: { id: dto.bookingId },
      include: { event: true },
    });
    if (!booking) throw new NotFoundException("Booking not found.");
    if (booking.status === "CONFIRMED") {
      throw new BadRequestException("Booking has already been paid and confirmed.");
    }

    const provider = (process.env.PAYMENT_GATEWAY_PROVIDER ?? "PAYHERE").toUpperCase();
    const isSandbox = process.env.NODE_ENV !== "production" || process.env.PAYMENT_SANDBOX === "true";
    const amountFormatted = (booking.totalMinor / 100).toFixed(2);
    const currency = booking.currency ?? "LKR";

    const baseUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
    // Sanitize redirect URLs: strictly allow only same-origin relative paths or verified app origin
    const sanitizeUrl = (url?: string, fallback = "") => {
      if (!url) return fallback;
      try {
        const parsed = new URL(url, baseUrl);
        const baseParsed = new URL(baseUrl);
        if (parsed.origin !== baseParsed.origin) return fallback;
        return parsed.toString();
      } catch {
        return fallback;
      }
    };

    const defaultReturn = `${baseUrl}/checkout/return?reference=${encodeURIComponent(booking.reference)}&email=${encodeURIComponent(booking.buyerEmail)}`;
    const defaultCancel = `${baseUrl}/checkout/return?reference=${encodeURIComponent(booking.reference)}&status=cancelled`;
    const returnUrl = sanitizeUrl(dto.returnUrl, defaultReturn);
    const cancelUrl = sanitizeUrl(dto.cancelUrl, defaultCancel);
    const notifyUrl = process.env.PAYMENT_NOTIFY_URL ?? `${process.env.PUBLIC_API_URL ?? "http://localhost:4000/v1"}/payments/payhere-notify`;

    if (provider === "PAYHERE") {
      const merchantId = process.env.PAYHERE_MERCHANT_ID ?? "1211149"; // Default sandbox merchant id
      const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET ?? "sandbox_secret";
      const hashedSecret = crypto.createHash("md5").update(merchantSecret).digest("hex").toUpperCase();
      const hashStr = `${merchantId}${booking.reference}${amountFormatted}${currency}${hashedSecret}`;
      const hash = crypto.createHash("md5").update(hashStr).digest("hex").toUpperCase();

      const actionUrl = isSandbox
        ? "https://sandbox.payhere.lk/pay/checkout"
        : "https://www.payhere.lk/pay/checkout";

      const [first, ...rest] = booking.buyerName.trim().split(" ");
      const firstName = first || "Valued";
      const lastName = rest.join(" ") || "Guest";

      return {
        bookingReference: booking.reference,
        amountFormatted,
        currency,
        gateway: {
          provider: "PAYHERE",
          actionUrl,
          method: "POST",
          fields: {
            merchant_id: merchantId,
            return_url: returnUrl,
            cancel_url: cancelUrl,
            notify_url: notifyUrl,
            order_id: booking.reference,
            items: `Tickets for ${booking.event.title}`,
            currency,
            amount: amountFormatted,
            first_name: firstName,
            last_name: lastName,
            email: booking.buyerEmail,
            phone: booking.buyerWhatsapp || "0770000000",
            address: booking.event.venue,
            city: booking.event.city,
            country: "Sri Lanka",
            hash,
          },
        },
      };
    }

    // Default generic / fallback payload
    return {
      bookingReference: booking.reference,
      amountFormatted,
      currency,
      gateway: {
        provider: "GENERIC",
        actionUrl: returnUrl,
        method: "GET",
        fields: {
          reference: booking.reference,
          status: "pending",
        },
      },
    };
  }

  /**
   * Handles server-to-server IPN / notification callback from PayHere
   */
  async handlePayHereNotify(body: PayHereNotifyDto) {
    const merchantId = body.merchant_id;
    const orderId = body.order_id;
    const payhereAmount = body.payhere_amount;
    const payhereCurrency = body.payhere_currency;
    const statusCode = body.status_code;
    const md5sig = body.md5sig;
    const paymentId = body.payment_id;

    if (!merchantId || !orderId || !payhereAmount || !payhereCurrency || !statusCode || !md5sig) {
      throw new BadRequestException("Missing required PayHere notification parameters.");
    }

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET ?? "sandbox_secret";
    const hashedSecret = crypto.createHash("md5").update(merchantSecret).digest("hex").toUpperCase();
    const expectedSig = crypto
      .createHash("md5")
      .update(`${merchantId}${orderId}${payhereAmount}${payhereCurrency}${statusCode}${hashedSecret}`)
      .digest("hex")
      .toUpperCase();

    if (md5sig.toUpperCase() !== expectedSig) {
      throw new UnauthorizedException("PayHere notification signature mismatch.");
    }

    const booking = await this.prisma.ticketBooking.findUnique({
      where: { reference: orderId },
      include: { event: { include: { organizer: true } }, tickets: true },
    });
    if (!booking) throw new NotFoundException(`Booking reference ${orderId} not found.`);

    // PayHere status 2 = Success / Captured
    const isSuccess = statusCode === "2";
    const status = isSuccess ? "CAPTURED" : "FAILED";

    return this.prisma.$transaction(async (tx) => {
      const existingPayment = await tx.payment.findFirst({ where: { bookingId: booking.id } });
      if (existingPayment?.status === "CAPTURED") {
        return { idempotent: true, paymentId: existingPayment.id };
      }

      const payment = existingPayment
        ? await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              status,
              providerRef: paymentId,
              providerEventId: `payhere:${paymentId}`,
              verifiedAt: isSuccess ? new Date() : null,
            },
          })
        : await tx.payment.create({
            data: {
              bookingId: booking.id,
              method: "CARD_GATEWAY",
              status,
              amountMinor: booking.totalMinor,
              providerRef: paymentId,
              providerEventId: `payhere:${paymentId}`,
              verifiedAt: isSuccess ? new Date() : null,
            },
          });

      if (isSuccess) {
        await tx.ticketBooking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED" },
        });

        await this.ledger.postBookingCapture(
          {
            bookingId: booking.id,
            grossMinor: booking.totalMinor,
            commissionBps: booking.event.organizer.commissionBps,
            idempotencyBase: `payhere:${paymentId}`,
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

        if (booking.buyerWhatsapp) {
          await this.notifications.enqueue(
            {
              channel: "WHATSAPP",
              recipient: booking.buyerWhatsapp,
              template: "TICKETS_ISSUED",
              payload: { reference: booking.reference, ticketCount: booking.tickets.length },
            },
            tx,
          );
        }
      }

      await this.audit.record(
        {
          action: "PAYHERE_WEBHOOK_PROCESSED",
          resourceType: "Payment",
          resourceId: payment.id,
          metadata: { paymentId, statusCode, orderId },
        },
        tx,
      );

      return { success: true, paymentId: payment.id, status: payment.status };
    });
  }

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

        if (booking.buyerWhatsapp) {
          await this.notifications.enqueue(
            {
              channel: "WHATSAPP",
              recipient: booking.buyerWhatsapp,
              template: "TICKETS_ISSUED",
              payload: { reference: booking.reference, ticketCount: booking.tickets.length },
            },
            tx,
          );
        }
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

      if (payment.booking.buyerWhatsapp) {
        await this.notifications.enqueue(
          {
            channel: "WHATSAPP",
            recipient: payment.booking.buyerWhatsapp,
            template: "TICKETS_ISSUED",
            payload: { reference: payment.booking.reference, ticketCount: payment.booking.tickets.length },
          },
          tx,
        );
      }

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

  async listPendingReconciliations() {
    return this.prisma.payment.findMany({
      where: { method: "BANK_TRANSFER", status: "MANUAL_REVIEW" },
      include: {
        booking: {
          include: {
            event: { select: { title: true, startsAt: true } },
            tickets: { select: { code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

@Controller("v1/payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("pending-reconciliations")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("FINANCE_STAFF", "EVENT_MANAGER")
  listPending() {
    return this.payments.listPendingReconciliations();
  }

  @Post("session")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  createSession(@Body() dto: CreatePaymentSessionDto) {
    return this.payments.createPaymentSession(dto);
  }

  @Post("payhere-notify")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  payHereNotify(@Body() body: PayHereNotifyDto) {
    return this.payments.handlePayHereNotify(body);
  }

  @Post("webhook")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 60 } })
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
