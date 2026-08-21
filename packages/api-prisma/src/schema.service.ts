import {
  formatAst,
  parsePrismaSchema,
  PrismaAstNode,
} from '@loancrate/prisma-schema-parser';
import { Injectable } from '@nestjs/common';
import { readFile, writeFile } from 'fs/promises';

@Injectable()
export class SchemaService {
  async parse(path: string): Promise<PrismaAstNode> {
    return parsePrismaSchema(await readFile(path, { encoding: 'utf8' }));
  }

  async stringify(path: string, data: PrismaAstNode) {
    const formatted = formatAst(data);

    return writeFile(path, formatted, {
      encoding: 'utf8',
    });
  }
}
