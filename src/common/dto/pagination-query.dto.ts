import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginatedMeta;
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return {
    items,
    meta: {
      total,
      page,
      limit,
      pageCount: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
