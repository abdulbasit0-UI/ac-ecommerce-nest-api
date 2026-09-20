import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AddressType } from '../entities/address.entity';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ enum: AddressType })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiProperty({ example: '12 Market Street' })
  @IsString()
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: 'Austin' })
  @IsString()
  city!: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '78701' })
  @IsString()
  postalCode!: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  country!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
