import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { generateToken, hashToken } from "@/common/crypto.util";
import { PrismaService } from "@/common/prisma.service";
import { AuditService } from "@/modules/audit/audit.module";

class RsvpDto {
  @IsEnum(["ACCEPTED", "DECLINED"]) status!: "ACCEPTED" | "DECLINED";
  @IsInt() @Min(0) @Max(20) count!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class GuestImportItemDto {
  @IsString() @MinLength(2) @MaxLength(120) guestName!: string;
  @IsInt() @Min(1) @Max(20) maxPartySize!: number;
}

class ImportGuestsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => GuestImportItemDto)
  guests!: GuestImportItemDto[];
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPublicByToken(rawToken: string) {
    const guest = await this.prisma.invitationGuest.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { campaign: true },
    });
    if (!guest || guest.revokedAt || !guest.campaign.isPublished) {
      throw new NotFoundException("Invitation not found or expired.");
    }

    if (!guest.openedAt) {
      await this.prisma.invitationGuest.update({
        where: { id: guest.id },
        data: { openedAt: new Date() },
      });
    }

    return {
      guestName: guest.guestName,
      maxPartySize: guest.maxPartySize,
      rsvpStatus: guest.rsvpStatus,
      rsvpCount: guest.rsvpCount,
      rsvpNote: guest.rsvpNote,
      campaign: {
        coupleTitle: guest.campaign.coupleTitle,
        eventDate: guest.campaign.eventDate,
        venueName: guest.campaign.venueName,
        venueAddress: guest.campaign.venueAddress,
        storyText: guest.campaign.storyText,
        templateConfig: guest.campaign.templateConfig,
      },
    };
  }

  async submitRsvp(rawToken: string, dto: RsvpDto) {
    const guest = await this.prisma.invitationGuest.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { campaign: true },
    });
    if (!guest || guest.revokedAt || !guest.campaign.isPublished) {
      throw new NotFoundException("Invitation not found or expired.");
    }

    const finalCount = dto.status === "DECLINED" ? 0 : dto.count;
    if (finalCount > guest.maxPartySize) {
      throw new BadRequestException(`RSVP count cannot exceed your party allocation (${guest.maxPartySize}).`);
    }
    if (dto.status === "ACCEPTED" && finalCount < 1) {
      throw new BadRequestException("Select at least 1 attending guest.");
    }

    const updated = await this.prisma.invitationGuest.update({
      where: { id: guest.id },
      data: {
        rsvpStatus: dto.status,
        rsvpCount: finalCount,
        rsvpNote: dto.note?.trim(),
      },
    });
    return {
      rsvpStatus: updated.rsvpStatus,
      rsvpCount: updated.rsvpCount,
    };
  }

  async importGuests(campaignId: string, guests: GuestImportItemDto[], staffId: string, staffRole: string) {
    const campaign = await this.prisma.invitationCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException("Campaign not found.");

    const created = await this.prisma.$transaction(async (tx) => {
      const results: Array<{ guestName: string; rawToken: string; maxPartySize: number }> = [];
      for (const g of guests) {
        const rawToken = generateToken(24);
        await tx.invitationGuest.create({
          data: {
            campaignId: campaign.id,
            guestName: g.guestName.trim(),
            tokenHash: hashToken(rawToken),
            maxPartySize: g.maxPartySize,
          },
        });
        results.push({ guestName: g.guestName.trim(), rawToken, maxPartySize: g.maxPartySize });
      }
      await this.audit.record(
        {
          actorId: staffId,
          actorRole: staffRole,
          action: "INVITATION_GUESTS_IMPORTED",
          resourceType: "InvitationCampaign",
          resourceId: campaign.id,
          metadata: { count: results.length },
        },
        tx,
      );
      return results;
    });
    return { imported: created.length, links: created };
  }
}

@Controller("v1/invitations")
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get("public/:token")
  getPublic(@Param("token") token: string) {
    return this.invitations.getPublicByToken(token);
  }

  @Post("public/:token/rsvp")
  @HttpCode(200)
  submitRsvp(@Param("token") token: string, @Body() dto: RsvpDto) {
    return this.invitations.submitRsvp(token, dto);
  }

  @Post("campaigns/:id/guests")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("INVITATION_OPERATOR")
  importGuests(@Param("id") id: string, @Body() dto: ImportGuestsDto, @Req() req: AuthenticatedRequest) {
    return this.invitations.importGuests(id, dto.guests, req.staff!.userId, req.staff!.role);
  }
}

@Module({
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
