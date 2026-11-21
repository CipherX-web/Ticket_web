import { Controller, Get, Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaService } from "./common/prisma.service";
import { AuditModule } from "./modules/audit/audit.module";
import { CommerceModule } from "./modules/commerce/commerce.module";
import { EventsModule } from "./modules/events/events.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { InvitationsModule } from "./modules/invitations/invitations.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrganizersModule } from "./modules/organizers/organizers.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { SettlementsModule } from "./modules/settlements/settlements.module";
import { TicketingModule } from "./modules/ticketing/ticketing.module";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
class PrismaModule {}

@Controller("v1/health")
class HealthController {
  @Get()
  check() {
    return { ok: true, service: "printx-api", timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    LedgerModule,
    IdentityModule,
    CommerceModule,
    OrganizersModule,
    EventsModule,
    TicketingModule,
    PaymentsModule,
    SettlementsModule,
    InvitationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
