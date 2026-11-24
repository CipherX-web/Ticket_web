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
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { AuditService } from "@/modules/audit/audit.module";
import { PrismaService } from "@/common/prisma.service";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class CreateOrganizerDto {
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsString() @MinLength(3) @MaxLength(254) contactEmail!: string;
  @IsString() @MinLength(5) @MaxLength(30) contactPhone!: string;
  @IsOptional() @IsInt() @Min(0) @Max(5000) commissionBps?: number; // default 10%
  @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @IsOptional() @IsString() @MaxLength(100) bankAccount?: string;
}

class PatchOrganizerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(254) contactEmail?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(30) contactPhone?: string;
  @IsOptional() @IsInt() @Min(0) @Max(5000) commissionBps?: number;
  @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @IsOptional() @IsString() @MaxLength(100) bankAccount?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OrganizersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listAll() {
    return this.prisma.organizer.findMany({ orderBy: { name: "asc" } });
  }

  async getOne(id: string) {
    const org = await this.prisma.organizer.findUnique({ where: { id }, include: { events: { select: { id: true, title: true, startsAt: true, isPublished: true } } } });
    if (!org) throw new NotFoundException("Organizer not found.");
    return org;
  }

  async create(dto: CreateOrganizerDto, staffId: string, staffRole: string) {
    const contactEmail = dto.contactEmail.toLowerCase().trim();
    const existing = await this.prisma.organizer.findFirst({ where: { contactEmail } });
    if (existing) throw new ConflictException("An organizer with this email already exists.");

    const organizer = await this.prisma.organizer.create({
      data: {
        name: dto.name.trim(),
        contactEmail,
        contactPhone: dto.contactPhone.trim(),
        commissionBps: dto.commissionBps ?? 1000,
        bankName: dto.bankName?.trim(),
        bankAccount: dto.bankAccount?.trim(),
      },
    });

    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "ORGANIZER_CREATED",
      resourceType: "Organizer",
      resourceId: organizer.id,
      metadata: { name: organizer.name },
    });

    return organizer;
  }

  async update(id: string, dto: PatchOrganizerDto, staffId: string, staffRole: string) {
    const existing = await this.prisma.organizer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Organizer not found.");

    if (dto.contactEmail) {
      const normalizedEmail = dto.contactEmail.toLowerCase().trim();
      const duplicate = await this.prisma.organizer.findFirst({
        where: { contactEmail: normalizedEmail, id: { not: id } },
      });
      if (duplicate) throw new ConflictException("Another organizer with this email already exists.");
    }

    const updated = await this.prisma.organizer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail.toLowerCase().trim() }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone.trim() }),
        ...(dto.commissionBps !== undefined && { commissionBps: dto.commissionBps }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName.trim() }),
        ...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "ORGANIZER_UPDATED",
      resourceType: "Organizer",
      resourceId: id,
      metadata: JSON.parse(JSON.stringify(dto)),
    });

    return updated;
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

@Controller("v1/organizers")
@UseGuards(StaffAuthGuard, RolesGuard)
export class OrganizersController {
  constructor(private readonly organizers: OrganizersService) {}

  @Get()
  @Roles("EVENT_MANAGER", "FINANCE_STAFF")
  list() {
    return this.organizers.listAll();
  }

  @Get(":id")
  @Roles("EVENT_MANAGER", "FINANCE_STAFF")
  getOne(@Param("id") id: string) {
    return this.organizers.getOne(id);
  }

  @Post()
  @Roles("EVENT_MANAGER")
  create(@Body() dto: CreateOrganizerDto, @Req() req: AuthenticatedRequest) {
    return this.organizers.create(dto, req.staff!.userId, req.staff!.role);
  }

  @Patch(":id")
  @Roles("EVENT_MANAGER")
  update(@Param("id") id: string, @Body() dto: PatchOrganizerDto, @Req() req: AuthenticatedRequest) {
    return this.organizers.update(id, dto, req.staff!.userId, req.staff!.role);
  }
}

@Module({
  controllers: [OrganizersController],
  providers: [OrganizersService],
  exports: [OrganizersService],
})
export class OrganizersModule {}
