import { Controller, Get, Injectable, Module, NotFoundException, Param } from "@nestjs/common";
import { PrismaService } from "@/common/prisma.service";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished() {
    return this.prisma.event.findMany({
      where: { isPublished: true },
      orderBy: { startsAt: "asc" },
      include: {
        organizer: { select: { name: true } },
        tiers: { orderBy: { priceMinor: "asc" } },
      },
    });
  }

  async getBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: { select: { name: true } },
        tiers: { orderBy: { priceMinor: "asc" } },
      },
    });
    if (!event || !event.isPublished) throw new NotFoundException("Event not found.");
    return event;
  }
}

@Controller("v1/events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.listPublished();
  }

  @Get(":slug")
  getOne(@Param("slug") slug: string) {
    return this.events.getBySlug(slug);
  }
}

@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
