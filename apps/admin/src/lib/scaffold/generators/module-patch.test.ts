import { describe, expect, it } from 'vitest';
import { patchLibraryModule } from './module-patch';

const SIMPLE_MODULE = `import { Module } from '@nestjs/common';
import { TagController } from './tag.controller';

@Module({
  imports: [],
  controllers: [TagController],
})
export class TagModule {}
`;

describe('patchLibraryModule', () => {
  it('adiciona import e entrada em imports', () => {
    const result = patchLibraryModule(
      SIMPLE_MODULE,
      'ServiceOrderModule',
      './service-order/service-order.module'
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.contents).toContain(
      "import { ServiceOrderModule } from './service-order/service-order.module';"
    );
    expect(result.contents).toContain('forwardRef(() => ServiceOrderModule),');
  });

  it('acrescenta forwardRef ao import do @nestjs/common quando faltar', () => {
    const result = patchLibraryModule(SIMPLE_MODULE, 'XModule', './x/x.module');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.contents).toContain(
      "import { forwardRef, Module } from '@nestjs/common';"
    );
  });

  it('não duplica forwardRef quando já importado', () => {
    const source = SIMPLE_MODULE.replace(
      "import { Module } from '@nestjs/common';",
      "import { forwardRef, Module } from '@nestjs/common';"
    );

    const result = patchLibraryModule(source, 'XModule', './x/x.module');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.contents.match(/forwardRef, Module/g)).toHaveLength(1);
  });

  it('recusa quando o módulo já referencia a classe', () => {
    const result = patchLibraryModule(SIMPLE_MODULE, 'TagController', './x');

    expect(result).toEqual({
      ok: false,
      reason: 'TagController já está referenciado no módulo.',
    });
  });

  it('recusa quando não encontra o decorator', () => {
    const result = patchLibraryModule('export const x = 1;', 'XModule', './x');

    expect(result.ok).toBe(false);
  });

  it('recusa quando não encontra o array imports', () => {
    const source = `import { Module } from '@nestjs/common';

@Module({
  controllers: [],
})
export class TagModule {}
`;

    const result = patchLibraryModule(source, 'XModule', './x');

    expect(result.ok).toBe(false);
  });
});
