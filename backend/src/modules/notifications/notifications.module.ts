import { Controller, forwardRef, Get, Global, HttpCode, Injectable, Logger, Module, Post, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { PrismaService } from "@/common/prisma.service";
import { ScheduledTasksService } from "./tasks.service";
import { TicketingModule } from "@/modules/ticketing/ticketing.module";

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

  // ── Provider implementations (Resend / SendGrid / Twilio / Notify.lk) ────

  private async sendEmail(to: string, template: string, payload: Record<string, unknown>) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.EMAIL_FROM_ADDRESS ?? "tickets@printxads.lk";
    const appUrl = process.env.FRONTEND_APP_URL ?? "http://localhost:3000";

    const { subject, html } = this.renderEmailTemplate(template, to, payload, appUrl);

    // 1. Try Resend if configured
    if (resendApiKey) {
      await this.sendViaResend(resendApiKey, fromEmail, to, subject, html);
      return;
    }

    // 2. Try SendGrid if configured
    if (sendgridApiKey) {
      await this.sendViaSendgrid(sendgridApiKey, fromEmail, to, subject, html);
      return;
    }

    // 3. Fallback dev logger when no API keys are set in environment
    this.logger.log(`[EMAIL DEV STUB] to=${to} subject="${subject}" payload=${JSON.stringify(payload)}`);
  }

  private async sendWhatsApp(to: string, template: string, payload: Record<string, unknown>) {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER; // e.g. "whatsapp:+14155238886" or "+14155238886"

    const notifylkUserId = process.env.NOTIFYLK_USER_ID;
    const notifylkApiKey = process.env.NOTIFYLK_API_KEY;
    const notifylkSenderId = process.env.NOTIFYLK_SENDER_ID ?? "NotifyDEMO";

    const appUrl = process.env.FRONTEND_APP_URL ?? "http://localhost:3000";
    const message = this.renderSmsTemplate(template, to, payload, appUrl);

    // 1. Try Twilio if configured
    if (twilioAccountSid && twilioAuthToken && twilioFrom) {
      await this.sendViaTwilio(twilioAccountSid, twilioAuthToken, twilioFrom, to, message);
      return;
    }

    // 2. Try Notify.lk (Sri Lanka SMS) if configured
    if (notifylkUserId && notifylkApiKey) {
      await this.sendViaNotifyLk(notifylkUserId, notifylkApiKey, notifylkSenderId, to, message);
      return;
    }

    // 3. Fallback dev logger when no SMS/WhatsApp provider is configured
    this.logger.log(`[WHATSAPP/SMS DEV STUB] to=${to} message="${message}"`);
  }

  // ── Template Renderers ───────────────────────────────────────────────────

  private renderEmailTemplate(template: string, to: string, payload: Record<string, unknown>, appUrl: string) {
    if (template === "TICKETS_ISSUED") {
      const reference = String(payload.reference ?? "");
      const count = Number(payload.ticketCount ?? 1);
      const viewUrl = `${appUrl}/tickets/${encodeURIComponent(reference)}?email=${encodeURIComponent(to)}`;

      return {
        subject: `Your Print X Tickets [${reference}]`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background-color: #F7F5EF; color: #334B45;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="font-size: 26px; font-weight: 700; color: #334B45; margin: 0; letter-spacing: -0.5px;">PRINT X</h1>
              <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #8FAF9E; margin-top: 4px;">Digital Event Pass</p>
            </div>
            <div style="background-color: #FFFFFF; border: 1px solid #E6E4DD; padding: 28px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <h2 style="font-size: 20px; font-weight: 600; color: #334B45; margin-top: 0;">Your tickets are ready!</h2>
              <p style="font-size: 15px; line-height: 1.5; color: #555;">
                Thank you for your order. We have issued <strong>${count} ticket${count > 1 ? "s" : ""}</strong> under booking reference <strong style="font-family: monospace; color: #334B45;">${reference}</strong>.
              </p>
              <div style="margin: 28px 0; text-align: center;">
                <a href="${viewUrl}" style="background-color: #334B45; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 2px; font-size: 15px; font-weight: 600; display: inline-block;">
                  View & Download QR Tickets →
                </a>
              </div>
              <p style="font-size: 13px; line-height: 1.5; color: #777;">
                Present the digital QR code on your phone at the entrance gate for entry scanning.
              </p>
            </div>
            <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #888;">
              <p>Print X · printxads.lk · Sri Lanka</p>
            </div>
          </div>
        `,
      };
    }

    if (template === "TICKET_RECOVERY_OTP") {
      const otp = String(payload.otp ?? "");
      const expiry = Number(payload.expiresInMinutes ?? 10);

      return {
        subject: `Your Print X Verification Code: ${otp}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background-color: #F7F5EF; color: #334B45;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="font-size: 26px; font-weight: 700; color: #334B45; margin: 0; letter-spacing: -0.5px;">PRINT X</h1>
            </div>
            <div style="background-color: #FFFFFF; border: 1px solid #E6E4DD; padding: 28px; border-radius: 4px; text-align: center;">
              <h2 style="font-size: 18px; font-weight: 600; color: #334B45; margin-top: 0;">Ticket Recovery Code</h2>
              <p style="font-size: 14px; color: #555;">Use the one-time verification code below to access your bookings:</p>
              <div style="display: inline-block; padding: 14px 28px; background: #F7F5EF; border: 1px dashed #334B45; font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #334B45; margin: 16px 0;">
                ${otp}
              </div>
              <p style="font-size: 12px; color: #777;">This code is valid for ${expiry} minutes. If you did not request this, please disregard this email.</p>
            </div>
          </div>
        `,
      };
    }

    return {
      subject: `Print X Notification: ${template}`,
      html: `<div style="font-family: sans-serif; padding: 16px;"><p>${JSON.stringify(payload)}</p></div>`,
    };
  }

  private renderSmsTemplate(template: string, to: string, payload: Record<string, unknown>, appUrl: string): string {
    if (template === "TICKETS_ISSUED") {
      const reference = String(payload.reference ?? "");
      const count = Number(payload.ticketCount ?? 1);
      const viewUrl = `${appUrl}/tickets/${encodeURIComponent(reference)}?email=${encodeURIComponent(to)}`;
      return `Print X: Your ${count} ticket(s) [Ref: ${reference}] are confirmed! View your scannable QR pass: ${viewUrl}`;
    }

    if (template === "TICKET_RECOVERY_OTP") {
      const otp = String(payload.otp ?? "");
      const expiry = Number(payload.expiresInMinutes ?? 10);
      return `Print X: Your verification code is ${otp}. Valid for ${expiry} minutes. Do not share this code.`;
    }

    return `Print X: ${template} - ${JSON.stringify(payload)}`;
  }

  // ── HTTP API Dispatchers ─────────────────────────────────────────────────

  private async sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Print X <${from}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend API error (${res.status}): ${text}`);
    }
  }

  private async sendViaSendgrid(apiKey: string, from: string, to: string, subject: string, html: string): Promise<void> {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: "Print X" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SendGrid API error (${res.status}): ${text}`);
    }
  }

  private async sendViaTwilio(accountSid: string, authToken: string, from: string, to: string, body: string): Promise<void> {
    const cleanTo = to.trim();
    const isWhatsApp = from.startsWith("whatsapp:");
    const recipient = isWhatsApp && !cleanTo.startsWith("whatsapp:") ? `whatsapp:${cleanTo.replace(/\s+/g, "")}` : cleanTo;

    const params = new URLSearchParams();
    params.append("From", from);
    params.append("To", recipient);
    params.append("Body", body);

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio API error (${res.status}): ${text}`);
    }
  }

  private async sendViaNotifyLk(userId: string, apiKey: string, senderId: string, to: string, message: string): Promise<void> {
    const cleanNumber = to.replace(/[^0-9]/g, "");
    const res = await fetch("https://app.notify.lk/api/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        api_key: apiKey,
        sender_id: senderId,
        to: cleanNumber,
        message,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notify.lk API error (${res.status}): ${text}`);
    }
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
  imports: [forwardRef(() => TicketingModule)],
  controllers: [NotificationsAdminController],
  providers: [NotificationsService, OutboxProcessorService, ScheduledTasksService],
  exports: [NotificationsService, OutboxProcessorService],
})
export class NotificationsModule {}
