import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class References {
  @IsString()
  table: string;

  @IsString()
  column: string;

  @IsOptional()
  @IsEnum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'])
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

  @IsOptional()
  @IsEnum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'])
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

class TableColumn {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  type: string;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsOptional()
  @Validate(
    (value: Record<string, unknown>) =>
      typeof value === 'object' &&
      Object.entries(value).every(
        ([k, v]) => k.length === 2 && typeof v === 'string',
      ),
    {
      message:
        'locale must be an object with 2-character keys and string values',
    },
  )
  locale?: Record<string, string>;

  @IsOptional()
  @IsString()
  default?: string;

  @IsOptional()
  @IsBoolean()
  isNullable?: boolean;

  @IsOptional()
  @IsBoolean()
  isUnique?: boolean;

  @IsOptional()
  @IsBoolean()
  unsigned?: boolean;

  @IsOptional()
  @IsEnum(['increment', 'uuid'])
  generationStrategy?: 'increment' | 'uuid';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsNumber()
  precision?: number;

  @IsOptional()
  @IsNumber()
  scale?: number;

  @IsOptional()
  @IsString({
    each: true,
  })
  enum?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => References)
  references?: References;
}

export class SaveTableDTO {
  @IsString()
  library: string;

  @IsString()
  tableName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TableColumn)
  columns: TableColumn[];
}
