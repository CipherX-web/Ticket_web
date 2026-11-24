import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OutboxProcessorService } from "./notifications.module";
import { HoldReleaseService } from "@/modules/ticketing/ticketing.module";

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly holdRelease: HoldReleaseService,
  ) {}

  /**
   * Processes pending and retryable outbox notification messages.
   * Runs every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleOutbox() {
    try {
      const res = await this.outboxProcessor.runOnce();
      if (res.processed > 0 || res.failed > 0) {
        this.logger.log(`Outbox cron: ${res.processed} sent, ${res.failed} failed`);
      }
    } catch (err) {
      this.logger.error("Outbox cron execution failed", err);
    }
  }

  /**
   * Releases expired inventory holds and returns tickets to available pool.
   * Runs every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredHolds() {
    try {
      const res = await this.holdRelease.releaseExpired();
      if (res.released > 0) {
        this.logger.log(`Hold release cron: restored ${res.released} expired ticket holds`);
      }
    } catch (err) {
      this.logger.error("Hold release cron execution failed", err);
    }
  }
}
