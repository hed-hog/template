import { Type } from 'class-transformer';
import { IsArray, IsObject, IsString, ValidateNested } from 'class-validator';

class Menu {
  @IsString()
  icon: string;

  @IsObject()
  name: Record<string, string>;
}

export class SaveScreenDTO {
  @IsString()
  library: string;

  @IsObject()
  name: Record<string, string>;

  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString()
  icon: string;

  @IsObject()
  description: Record<string, string>;

  @IsArray()
  roles: string[];

  @IsArray()
  routes: string[];

  @ValidateNested()
  @Type(() => Menu)
  menu: Menu;
}
