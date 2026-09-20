import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ type: [String], example: ['products:write', 'orders:read'] })
  @IsArray()
  @IsString({ each: true })
  permissionSlugs!: string[];
}
