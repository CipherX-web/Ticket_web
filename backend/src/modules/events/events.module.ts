import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { AuditService } from "@/modules/audit/audit.module";
import { PrismaService } from "@/common/prisma.service";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class CreateTierDto {
  @IsString() @MinLength(1) @MaxLength(60) code!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsInt() @Min(1) priceMinor!: number;
  @IsInt() @Min(1) capacity!: number;
  @IsInt() @Min(1) @Max(50) perOrderMax!: number;
}

class CreateEventDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(2) @MaxLength(120) slug!: string;
  @IsString() organizerId!: string;
  @IsISO8601() startsAt!: string;
  @IsString() @MinLength(2) @MaxLength(200) venue!: string;
  @IsString() @MinLength(2) @MaxLength(100) city!: string;
  @IsString() @MinLength(2) @MaxLength(1000) summary!: string;
  @IsOptional() @IsEnum(["AUTOMATIC", "MANUAL", "HYBRID"]) approvalMode?: "AUTOMATIC" | "MANUAL" | "HYBRID";
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateTierDto) tiers!: CreateTierDto[];
}

class PatchEventDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) venue?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(1000) summary?: string;
  @IsOptional() @IsEnum(["AUTOMATIC", "MANUAL", "HYBRID"]) approvalMode?: "AUTOMATIC" | "MANUAL" | "HYBRID";
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  // ── Staff-only ───────────────────────────────────────────────────────────────

  listAll() {
    return this.prisma.event.findMany({
      orderBy: { startsAt: "asc" },
      include: { organizer: { select: { name: true } }, tiers: true },
    });
  }

  async create(dto: CreateEventDto, staffId: string, staffRole: string) {
    // Validate unique tier codes within the event
    const codes = dto.tiers.map((t) => t.code);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException("Ticket tier codes must be unique within the event.");
    }

    const cleanSlug = dto.slug.toLowerCase().trim().replace(/\s+/g, "-");
    const existingSlug = await this.prisma.event.findUnique({ where: { slug: cleanSlug } });
    if (existingSlug) {
      throw new ConflictException(`An event with the slug "${cleanSlug}" already exists.`);
    }

    const organizer = await this.prisma.organizer.findUnique({ where: { id: dto.organizerId } });
    if (!organizer || !organizer.isActive) throw new BadRequestException("Organizer not found or inactive.");

    const event = await this.prisma.event.create({
      data: {
        slug: cleanSlug,
        title: dto.title,
        organizerId: dto.organizerId,
        startsAt: new Date(dto.startsAt),
        venue: dto.venue,
        city: dto.city,
        summary: dto.summary,
        approvalMode: dto.approvalMode ?? "AUTOMATIC",
        isPublished: dto.isPublished ?? false,
        tiers: {
          create: dto.tiers.map((t) => ({
            code: t.code.toUpperCase(),
            name: t.name,
            priceMinor: t.priceMinor,
            capacity: t.capacity,
            available: t.capacity, // available starts equal to capacity
            perOrderMax: t.perOrderMax,
          })),
        },
      },
      include: { tiers: true, organizer: { select: { name: true } } },
    });

    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "EVENT_CREATED",
      resourceType: "Event",
      resourceId: event.id,
      metadata: { slug: event.slug, title: event.title },
    });

    return event;
  }

  async update(id: string, dto: PatchEventDto, staffId: string, staffRole: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Event not found.");

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
        ...(dto.venue !== undefined && { venue: dto.venue }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.approvalMode !== undefined && { approvalMode: dto.approvalMode }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
      },
      include: { tiers: true, organizer: { select: { name: true } } },
    });

    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "EVENT_UPDATED",
      resourceType: "Event",
      resourceId: id,
      metadata: JSON.parse(JSON.stringify(dto)),
    });

    return updated;
  }

  /** Quick publish/unpublish toggle */
  async setPublished(id: string, published: boolean, staffId: string, staffRole: string) {
    return this.update(id, { isPublished: published }, staffId, staffRole);
  }

  async getStats(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: { tiers: true } });
    if (!event) throw new NotFoundException("Event not found.");

    const [bookingCount, confirmedCount, totalRevenue] = await Promise.all([
      this.prisma.ticketBooking.count({ where: { eventId: id } }),
      this.prisma.ticketBooking.count({ where: { eventId: id, status: "CONFIRMED" } }),
      this.prisma.ticketBooking.aggregate({
        _sum: { totalMinor: true },
        where: { eventId: id, status: "CONFIRMED" },
      }),
    ]);

    return {
      eventId: id,
      title: event.title,
      tiers: event.tiers.map((t) => ({
        name: t.name,
        capacity: t.capacity,
        available: t.available,
        sold: t.capacity - t.available,
      })),
      totalBookings: bookingCount,
      confirmedBookings: confirmedCount,
      confirmedRevenueMinor: totalRevenue._sum.totalMinor ?? 0,
    };
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller("v1/events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** Public: published events only */
  @Get()
  list() {
    return this.events.listPublished();
  }

  /** Public: single event by slug */
  @Get(":slug")
  getOne(@Param("slug") slug: string) {
    return this.events.getBySlug(slug);
  }
}

@Controller("v1/admin/events")
@UseGuards(StaffAuthGuard, RolesGuard)
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  /** Staff: all events (published + unpublished) */
  @Get()
  @Roles("EVENT_MANAGER", "FINANCE_STAFF")
  listAll() {
    return this.events.listAll();
  }

  /** Staff: create event with tiers */
  @Post()
  @Roles("EVENT_MANAGER")
  create(@Body() dto: CreateEventDto, @Req() req: AuthenticatedRequest) {
    return this.events.create(dto, req.staff!.userId, req.staff!.role);
  }

  /** Staff: update event metadata */
  @Patch(":id")
  @Roles("EVENT_MANAGER")
  update(@Param("id") id: string, @Body() dto: PatchEventDto, @Req() req: AuthenticatedRequest) {
    return this.events.update(id, dto, req.staff!.userId, req.staff!.role);
  }

  /** Staff: publish event */
  @Post(":id/publish")
  @Roles("EVENT_MANAGER")
  publish(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.events.setPublished(id, true, req.staff!.userId, req.staff!.role);
  }

  /** Staff: unpublish event */
  @Post(":id/unpublish")
  @Roles("EVENT_MANAGER")
  unpublish(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.events.setPublished(id, false, req.staff!.userId, req.staff!.role);
  }

  /** Staff: sales stats for a specific event */
  @Get(":id/stats")
  @Roles("EVENT_MANAGER", "FINANCE_STAFF")
  stats(@Param("id") id: string) {
    return this.events.getStats(id);
  }
}

@Module({
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
