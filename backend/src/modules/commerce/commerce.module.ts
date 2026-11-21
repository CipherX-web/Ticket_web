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
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { PrintOrderStatus } from "@prisma/client";
import { IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { AuthenticatedRequest, Roles, RolesGuard, StaffAuthGuard } from "@/common/auth.guard";
import { generateReference } from "@/common/crypto.util";
import { PrismaService } from "@/common/prisma.service";
import { AuditService } from "@/modules/audit/audit.module";
import { NotificationsService } from "@/modules/notifications/notifications.module";

interface ProductOption {
  id: string;
  label: string;
  factor?: number;
  addPerUnitMinor?: number;
}

const ALLOWED_TRANSITIONS: Record<PrintOrderStatus, PrintOrderStatus[]> = {
  NEW: ["ARTWORK_REVIEW", "CANCELLED"],
  ARTWORK_REVIEW: ["AWAITING_PROOF_APPROVAL", "READY_TO_PRINT", "CANCELLED"],
  AWAITING_PROOF_APPROVAL: ["READY_TO_PRINT", "ARTWORK_REVIEW", "CANCELLED"],
  READY_TO_PRINT: ["PRINTING", "CANCELLED"],
  PRINTING: ["READY"],
  READY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

class CreatePrintOrderDto {
  @IsString() @MaxLength(80) productSlug!: string;
  @IsString() @MaxLength(40) sizeId!: string;
  @IsString() @MaxLength(40) materialId!: string;
  @IsString() @MaxLength(40) finishId!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsString() @MinLength(2) @MaxLength(100) customerName!: string;
  @IsEmail() @MaxLength(254) customerEmail!: string;
  @IsString() @Matches(/^\+?\d[\d\s-]{8,14}$/) customerPhone!: string;
  @IsOptional() @IsString() @MaxLength(200) artworkName?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class TrackOrderDto {
  @IsString() @Matches(/^PX-[A-Z0-9]{6,10}$/i) reference!: string;
  @IsEmail() @MaxLength(254) email!: string;
}

class ContactDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(10) @MaxLength(2000) message!: string;
}

class UpdateOrderStatusDto {
  @IsString() status!: PrintOrderStatus;
}

export function discountPctForQuantity(quantity: number): number {
  if (quantity >= 5000) return 25;
  if (quantity >= 1000) return 15;
  if (quantity >= 500) return 10;
  if (quantity >= 250) return 5;
  return 0;
}

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  listProducts() {
    return this.prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product || !product.isActive) throw new NotFoundException("Product not found.");
    return product;
  }

  async createOrder(dto: CreatePrintOrderDto) {
    const product = await this.getProductBySlug(dto.productSlug);
    const sizes = product.sizes as unknown as ProductOption[];
    const materials = product.materials as unknown as ProductOption[];
    const finishes = product.finishes as unknown as ProductOption[];

    const size = sizes.find((o) => o.id === dto.sizeId);
    const material = materials.find((o) => o.id === dto.materialId);
    const finish = finishes.find((o) => o.id === dto.finishId);

    if (!size || !material || !finish) {
      throw new BadRequestException("Invalid product configuration.");
    }
    if (dto.quantity < product.minQty) {
      throw new BadRequestException(`Minimum quantity for ${product.name} is ${product.minQty}.`);
    }

    const unitMinor = Math.round(
      product.baseUnitMinor * (size.factor ?? 1) * (material.factor ?? 1) + (finish.addPerUnitMinor ?? 0),
    );
    const subtotalMinor = unitMinor * dto.quantity;
    const discountPct = discountPctForQuantity(dto.quantity);
    const totalMinor = Math.round((subtotalMinor * (100 - discountPct)) / 100);
    const reference = generateReference("PX");

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.printOrder.create({
        data: {
          reference,
          productId: product.id,
          customerName: dto.customerName.trim(),
          customerEmail: dto.customerEmail.toLowerCase().trim(),
          customerPhone: dto.customerPhone.trim(),
          sizeId: dto.sizeId,
          materialId: dto.materialId,
          finishId: dto.finishId,
          quantity: dto.quantity,
          unitMinor,
          discountPct,
          totalMinor,
          artworkName: dto.artworkName,
          notes: dto.notes,
          status: "NEW",
          proofVersion: product.proofRequired ? 1 : 0,
        },
      });

      await this.notifications.enqueue(
        {
          channel: "EMAIL",
          recipient: order.customerEmail,
          template: "PRINT_ORDER_CREATED",
          payload: { reference: order.reference, totalMinor: order.totalMinor },
        },
        tx,
      );

      await this.audit.record(
        {
          action: "PRINT_ORDER_CREATED",
          resourceType: "PrintOrder",
          resourceId: order.id,
          metadata: { reference: order.reference, totalMinor: order.totalMinor },
        },
        tx,
      );

      return order;
    });
  }

  async approveProof(reference: string, email: string) {
    const order = await this.prisma.printOrder.findFirst({
      where: { reference: reference.toUpperCase().trim(), customerEmail: email.toLowerCase().trim() },
    });
    if (!order) throw new NotFoundException("Order not found.");

    const updated = await this.prisma.printOrder.update({
      where: { id: order.id },
      data: {
        approvedVersion: order.proofVersion || 1,
        approvedAt: new Date(),
        status: order.status === "AWAITING_PROOF_APPROVAL" ? "READY_TO_PRINT" : order.status,
      },
    });
    await this.audit.record({
      action: "PRINT_PROOF_APPROVED",
      resourceType: "PrintOrder",
      resourceId: order.id,
      metadata: { approvedVersion: updated.approvedVersion },
    });
    return { reference: updated.reference, status: updated.status, approvedAt: updated.approvedAt };
  }

  async trackOrder(reference: string, email: string) {
    const order = await this.prisma.printOrder.findFirst({
      where: { reference: reference.toUpperCase().trim(), customerEmail: email.toLowerCase().trim() },
      include: { product: { select: { name: true, proofRequired: true } } },
    });
    if (!order) {
      return { found: false, message: "If an order matches those details, its status is shown below." };
    }
    return {
      found: true,
      reference: order.reference,
      productName: order.product.name,
      quantity: order.quantity,
      totalMinor: order.totalMinor,
      status: order.status,
      proofRequired: order.product.proofRequired,
      approvedAt: order.approvedAt,
      updatedAt: order.updatedAt,
    };
  }

  async updateStatus(orderId: string, nextStatus: PrintOrderStatus, staffId: string, staffRole: string) {
    const order = await this.prisma.printOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException("Order not found.");

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${nextStatus}.`);
    }
    if (nextStatus === "READY_TO_PRINT" && order.product.proofRequired && !order.approvedAt) {
      throw new BadRequestException("Customer proof approval is required before printing.");
    }

    const updated = await this.prisma.printOrder.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });
    await this.audit.record({
      actorId: staffId,
      actorRole: staffRole,
      action: "PRINT_ORDER_STATUS_CHANGED",
      resourceType: "PrintOrder",
      resourceId: order.id,
      metadata: { from: order.status, to: nextStatus },
    });
    return updated;
  }

  async submitContact(dto: ContactDto) {
    const inquiry = await this.prisma.contactInquiry.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        message: dto.message.trim(),
      },
    });
    return { id: inquiry.id, received: true };
  }
}

@Controller("v1/commerce")
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get("products")
  listProducts() {
    return this.commerce.listProducts();
  }

  @Get("products/:slug")
  getProduct(@Param("slug") slug: string) {
    return this.commerce.getProductBySlug(slug);
  }

  @Post("orders")
  createOrder(@Body() dto: CreatePrintOrderDto) {
    return this.commerce.createOrder(dto);
  }

  @Post("track")
  @HttpCode(200)
  trackOrder(@Body() dto: TrackOrderDto) {
    return this.commerce.trackOrder(dto.reference, dto.email);
  }

  @Post("orders/approve-proof")
  @HttpCode(200)
  approveProof(@Body() dto: TrackOrderDto) {
    return this.commerce.approveProof(dto.reference, dto.email);
  }

  @Post("contact")
  submitContact(@Body() dto: ContactDto) {
    return this.commerce.submitContact(dto);
  }

  @Patch("orders/:id/status")
  @UseGuards(StaffAuthGuard, RolesGuard)
  @Roles("SHOP_MANAGER", "PRINT_STAFF")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateOrderStatusDto, @Req() req: AuthenticatedRequest) {
    return this.commerce.updateStatus(id, dto.status, req.staff!.userId, req.staff!.role);
  }
}

@Module({
  controllers: [CommerceController],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
