import { Injectable, Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma.service";

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a balanced double-entry journal posting for a captured ticket booking.
   * Uses idempotency keys so replayed webhooks never double-post.
   */
  async postBookingCapture(
    input: {
      bookingId: string;
      grossMinor: number;
      commissionBps: number;
      idempotencyBase: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const commissionMinor = Math.round((input.grossMinor * input.commissionBps) / 10000);
    const organizerPayableMinor = input.grossMinor - commissionMinor;

    const entries: Prisma.LedgerEntryCreateManyInput[] = [
      {
        accountCode: "CASH_CLEARING",
        direction: "DEBIT",
        amountMinor: input.grossMinor,
        currency: "LKR",
        referenceType: "BOOKING",
        referenceId: input.bookingId,
        idempotencyKey: `${input.idempotencyBase}:cash`,
        description: `Gross ticket capture for booking ${input.bookingId}`,
      },
      {
        accountCode: "PLATFORM_COMMISSION",
        direction: "CREDIT",
        amountMinor: commissionMinor,
        currency: "LKR",
        referenceType: "BOOKING",
        referenceId: input.bookingId,
        idempotencyKey: `${input.idempotencyBase}:comm`,
        description: `Print X commission (${input.commissionBps} bps)`,
      },
      {
        accountCode: "ORGANIZER_PAYABLE",
        direction: "CREDIT",
        amountMinor: organizerPayableMinor,
        currency: "LKR",
        referenceType: "BOOKING",
        referenceId: input.bookingId,
        idempotencyKey: `${input.idempotencyBase}:org`,
        description: `Organizer payable for booking ${input.bookingId}`,
      },
    ];

    await tx.ledgerEntry.createMany({
      data: entries,
      skipDuplicates: true,
    });
  }
}

@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
