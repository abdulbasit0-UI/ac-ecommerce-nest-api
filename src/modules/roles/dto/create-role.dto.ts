import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { PermissionSlug } from '../../../common/constants/permissions.constant';

export class CreateRoleDto {
  @ApiProperty({ example: 'MANAGER' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ isArray: true, enum: PermissionSlug })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionSlugs?: string[];
}
