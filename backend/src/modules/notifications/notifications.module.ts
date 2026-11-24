import { Controller, Get, Global, HttpCode, Injectable, Logger, Module, Post, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { PrismaService } from "@/common/prisma.service";

// ─── Enqueue service (unchanged contract) ─────────────────────────────────────

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes a notification to the transactional outbox inside the caller's DB transaction. */
  async enqueue(
    input: {
      channel: "EMAIL" | "WHATSAPP";
      recipient: string;
      template: string;
      payload: Prisma.InputJsonValue;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.outboxMessage.create({
      data: {
        channel: input.channel,
        recipient: input.recipient,
        template: input.template,
        payload: input.payload,
      },
    });
  }
}

// ─── Outbox processor ─────────────────────────────────────────────────────────
/**
 * Polls OutboxMessage and attempts delivery.
 *
 * HOW TO WIRE REAL PROVIDERS:
 *   1. Set environment variables: EMAIL_PROVIDER_API_KEY, WHATSAPP_API_KEY
 *   2. Replace the TODO blocks in `sendEmail` / `sendWhatsApp` with SDK calls
 *      (e.g. SendGrid, AWS SES, Twilio, Dialog Axiata).
 *   3. Call `runOnce()` from a scheduler (cron job, BullMQ worker, or setInterval).
 *
 * Currently: messages are logged and marked SENT so the system functions
 * end-to-end without crashing, and you can see what would be sent.
 */
@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private readonly BATCH_SIZE = 20;
  private readonly MAX_ATTEMPTS = 5;

  constructor(private readonly prisma: PrismaService) {}

  async runOnce(): Promise<{ processed: number; failed: number }> {
    const now = new Date();
    const messages = await this.prisma.outboxMessage.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        nextRetryAt: { lte: now },
        attempts: { lt: this.MAX_ATTEMPTS },
      },
      take: this.BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    let processed = 0;
    let failed = 0;

    for (const msg of messages) {
      try {
        if (msg.channel === "EMAIL") {
          await this.sendEmail(msg.recipient, msg.template, msg.payload as Record<string, unknown>);
        } else {
          await this.sendWhatsApp(msg.recipient, msg.template, msg.payload as Record<string, unknown>);
        }

        await this.prisma.outboxMessage.update({
          where: { id: msg.id },
          data: { status: "SENT", attempts: { increment: 1 } },
        });
        processed++;
      } catch (err) {
        failed++;
        const nextAttempt = msg.attempts + 1;
        const backoffMs = Math.min(60_000 * Math.pow(2, nextAttempt), 3_600_000); // cap at 1 h
        const isDead = nextAttempt >= this.MAX_ATTEMPTS;
        await this.prisma.outboxMessage.update({
          where: { id: msg.id },
          data: {
            status: isDead ? "DEAD_LETTER" : "FAILED",
            attempts: { increment: 1 },
            nextRetryAt: new Date(Date.now() + backoffMs),
          },
        });
        this.logger.warn(`Outbox ${msg.id} failed (attempt ${nextAttempt}): ${String(err)}`);
      }
    }

    if (processed + failed > 0) {
      this.logger.log(`Outbox run: ${processed} sent, ${failed} failed`);
    }
    return { processed, failed };
  }

  /**
   * Dead-letter queue listing — messages that have exhausted all retry attempts.
   * Returns the 50 most recent dead-letter messages for staff review.
   */
  listDeadLetters() {
    return this.prisma.outboxMessage.findMany({
      where: { status: "DEAD_LETTER" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  // ── Provider stubs (replace with real SDK calls) ───────────────────────────

  private async sendEmail(to: string, template: string, payload: Record<string, unknown>) {
    // TODO: wire to your email provider (SendGrid / AWS SES / Resend etc.)
    // Example payload structures:
    //   TICKETS_ISSUED  → { reference, ticketCount }
    //   TICKET_RECOVERY_OTP → { expiresInMinutes }
    this.logger.log(`[EMAIL STUB] to=${to} template=${template} payload=${JSON.stringify(payload)}`);
    if (!process.env.EMAIL_PROVIDER_API_KEY) {
      // No provider configured — log and treat as sent in dev
      return;
    }
    // Replace with real SDK call, e.g.:
    // await sendgrid.send({ to, templateId: templateIdMap[template], dynamicTemplateData: payload });
    throw new Error("EMAIL_PROVIDER_API_KEY set but no real email provider is wired yet.");
  }

  private async sendWhatsApp(to: string, template: string, payload: Record<string, unknown>) {
    // TODO: wire to your WhatsApp provider (Twilio / Dialog Axiata)
    this.logger.log(`[WHATSAPP STUB] to=${to} template=${template} payload=${JSON.stringify(payload)}`);
    if (!process.env.WHATSAPP_API_KEY) {
      return;
    }
    throw new Error("WHATSAPP_API_KEY set but no real WhatsApp provider is wired yet.");
  }
}

// ─── Staff controller: trigger and inspect outbox ─────────────────────────────

@Controller("v1/admin/notifications")
@UseGuards(StaffAuthGuard, RolesGuard)
export class NotificationsAdminController {
  constructor(private readonly processor: OutboxProcessorService) {}

  /** Manually trigger an outbox flush — useful before a scheduler is set up */
  @Post("flush")
  @Roles("EVENT_MANAGER")
  @HttpCode(200)
  flush(@Req() _req: AuthenticatedRequest) {
    return this.processor.runOnce();
  }

  /** List messages stuck in dead-letter queue */
  @Get("dead-letters")
  @Roles("EVENT_MANAGER")
  deadLetters() {
    return this.processor.listDeadLetters();
  }
}

// ─── Module ───────────────────────────────────────────────────────────────────

@Global()
@Module({
  controllers: [NotificationsAdminController],
  providers: [NotificationsService, OutboxProcessorService],
  exports: [NotificationsService, OutboxProcessorService],
})
export class NotificationsModule {}
