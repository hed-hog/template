import { describe, expect, it } from 'vitest';
import { createTestPlan } from '../scaffold-fixtures';
import { generateMigrationSql, migrationFolderName } from './migration-sql';

describe('migrationFolderName', () => {
  it('usa timestamp + biblioteca + entidade', () => {
    expect(migrationFolderName(createTestPlan(), '20260722173000')).toBe(
      '20260722173000_crm_service_order_page'
    );
  });
});

describe('generateMigrationSql', () => {
  const sql = generateMigrationSql(createTestPlan());

  it('cria o enum de forma idempotente', () => {
    expect(sql).toContain('CREATE TYPE "service_order_status_enum" AS ENUM');
    expect(sql).toContain('EXCEPTION WHEN duplicate_object THEN NULL;');
  });

  it('cria a tabela com IF NOT EXISTS e chave primária', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "service_order" (');
    expect(sql).toContain('CONSTRAINT "service_order_pkey" PRIMARY KEY ("id")');
  });

  it('mapeia os tipos das colunas', () => {
    expect(sql).toContain('"title" VARCHAR(180) NOT NULL');
    expect(sql).toContain('"status" "service_order_status_enum" NOT NULL DEFAULT \'open\'');
    expect(sql).toContain('"person_id" INTEGER NULL');
  });

  it('cria FK com SET NULL para coluna anulável', () => {
    expect(sql).toContain('FOREIGN KEY ("person_id") REFERENCES "person"("id")');
    expect(sql).toContain('ON DELETE SET NULL ON UPDATE CASCADE');
  });

  it('registra o trigger de updated_at', () => {
    expect(sql).toContain('DROP TRIGGER IF EXISTS trg_touch_updated_at ON "service_order";');
    expect(sql).toContain('EXECUTE FUNCTION touch_updated_at();');
  });

  it('semeia menu, menu_locale e role_menu', () => {
    expect(sql).toContain('INSERT INTO "menu"');
    expect(sql).toContain('INSERT INTO "menu_locale"');
    expect(sql).toContain('INSERT INTO "role_menu"');
    expect(sql).toContain("ARRAY['admin', 'admin-crm']");
  });

  it('semeia as rotas da API com os cargos', () => {
    expect(sql).toContain('{"url":"/service-order","method":"GET","roles":["admin","admin-crm"]}');
    expect(sql).toContain('INSERT INTO "role_route"');
  });

  it('cria a tabela _locale quando há coluna traduzível', () => {
    const localeSql = generateMigrationSql(
      createTestPlan({
        columns: [
          {
            name: 'name',
            type: 'locale_varchar',
            nullable: false,
            length: 255,
            labelEn: 'Name',
            labelPt: 'Nome',
            inList: true,
            inFilters: false,
          },
        ],
      })
    );

    expect(localeSql).toContain('CREATE TABLE IF NOT EXISTS "service_order_locale" (');
    expect(localeSql).toContain('"service_order_id" INTEGER NOT NULL');

    // A coluna traduzível fica só na tabela _locale, nunca na principal.
    const mainTable = localeSql.slice(
      localeSql.indexOf('CREATE TABLE IF NOT EXISTS "service_order" ('),
      localeSql.indexOf('CREATE TABLE IF NOT EXISTS "service_order_locale" (')
    );

    expect(mainTable).not.toContain('"name"');
  });

  it('sem backend, gera apenas o seed de menu', () => {
    const menuOnly = generateMigrationSql(
      createTestPlan({ generateBackend: false })
    );

    expect(menuOnly).not.toContain('CREATE TABLE');
    expect(menuOnly).not.toContain('INSERT INTO "role_route"');
    expect(menuOnly).toContain('INSERT INTO "menu"');
  });

  it('escapa aspas simples nos rótulos', () => {
    const escaped = generateMigrationSql(
      createTestPlan({ labelPt: "Ordens d'água" })
    );

    expect(escaped).toContain("'Ordens d''água'");
  });
});
