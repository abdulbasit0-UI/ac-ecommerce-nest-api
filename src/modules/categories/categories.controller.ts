import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionSlug } from '../../common/constants/permissions.constant';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  findPublic() {
    return this.categories.findTree();
  }

  @ApiBearerAuth('access-token')
  @Get('admin')
  @RequirePermissions(PermissionSlug.CATEGORIES_READ)
  findAll() {
    return this.categories.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.findById(id);
  }

  @ApiBearerAuth('access-token')
  @Post()
  @RequirePermissions(PermissionSlug.CATEGORIES_WRITE)
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @ApiBearerAuth('access-token')
  @Patch(':id')
  @RequirePermissions(PermissionSlug.CATEGORIES_WRITE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @Delete(':id')
  @RequirePermissions(PermissionSlug.CATEGORIES_WRITE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
