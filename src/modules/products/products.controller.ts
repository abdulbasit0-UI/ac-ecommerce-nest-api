import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { QueryProductsDto } from './dto/query-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddProductImageDto } from './dto/add-product-image.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionSlug } from '../../common/constants/permissions.constant';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  list(@Query() query: QueryProductsDto) {
    return this.products.findPublic(query);
  }

  @ApiBearerAuth('access-token')
  @Get('admin')
  @RequirePermissions(PermissionSlug.PRODUCTS_READ)
  adminList(@Query() query: QueryProductsDto) {
    return this.products.findAdmin(query);
  }

  @Public()
  @Get('slug/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findById(id);
  }

  @ApiBearerAuth('access-token')
  @Post()
  @RequirePermissions(PermissionSlug.PRODUCTS_WRITE)
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @ApiBearerAuth('access-token')
  @Patch(':id')
  @RequirePermissions(PermissionSlug.PRODUCTS_WRITE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @Post(':id/images')
  @RequirePermissions(PermissionSlug.PRODUCTS_WRITE)
  addImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddProductImageDto) {
    return this.products.addImage(id, dto);
  }

  @ApiBearerAuth('access-token')
  @Delete(':id')
  @RequirePermissions(PermissionSlug.PRODUCTS_WRITE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }
}
