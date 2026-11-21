import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { PrismaService } from "@/common/prisma.service";

@Injectable()
export class OrganizersService {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.organizer.findMany({ orderBy: { name: "asc" } });
  }
}

@Controller("v1/organizers")
@UseGuards(StaffAuthGuard, RolesGuard)
export class OrganizersController {
  constructor(private readonly organizers: OrganizersService) {}

  @Get()
  @Roles("EVENT_MANAGER", "FINANCE_STAFF")
  list() {
    return this.organizers.listAll();
  }
}

@Module({
  controllers: [OrganizersController],
  providers: [OrganizersService],
  exports: [OrganizersService],
})
export class OrganizersModule {}
