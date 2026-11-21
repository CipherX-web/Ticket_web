import { Global, Injectable, Module } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma.service";

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

@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
