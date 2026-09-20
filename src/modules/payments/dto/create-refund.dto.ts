import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({ example: 19.99, description: 'Amount to refund in major currency units' })
  @IsNumber()
  @Min(0.5)
  amount!: number;

  @ApiPropertyOptional({ example: 'requested_by_customer' })
  @IsOptional()
  @IsString()
  reason?: string;
}
