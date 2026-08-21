# HedHog YAML Specification

A HedHog library package uses two key directories that drive the database migration pipeline: `hedhog/table/` and `hedhog/data/`. This document specifies the format, defaults, constraints, and full capabilities of the YAML files in each directory.

## Table of Contents

1. [Overview](#1-overview)
2. [Directory Layout](#2-directory-layout)
3. [Table YAML (`hedhog/table/`)](#3-table-yaml)
   - [File Naming](#31-file-naming)
   - [Top-Level Structure](#32-top-level-structure)
   - [Special Type Aliases](#33-special-type-aliases)
   - [Short SQL Aliases](#34-short-sql-aliases)
   - [Native PostgreSQL Types](#35-native-postgresql-types)
   - [Column Properties Reference](#36-column-properties-reference)
   - [Foreign Key References](#37-foreign-key-references)
   - [Auto-Generated Locale Table](#38-auto-generated-locale-table)
4. [Data YAML (`hedhog/data/`)](#4-data-yaml)
   - [File Naming](#41-file-naming)
   - [Root Structure](#42-root-structure)
   - [Scalar Values](#43-scalar-values)
   - [FK Lookup (`where:`)](#44-fk-lookup-where)
   - [Locale Values](#45-locale-values)
   - [Inline Relations (`relations:`)](#46-inline-relations-relations)
5. [Relationships](#5-relationships)
   - [Simple FK Columns](#51-simple-fk-columns)
   - [Junction (Intermediate) Tables](#52-junction-intermediate-tables)
   - [Nested Relations](#53-nested-relations)
6. [Execution Order](#6-execution-order)
7. [Post-Migration SQL Queries](#7-post-migration-sql-queries)
8. [Complete Examples](#8-complete-examples)

---

## 1. Overview

When you run `hedhog add <library-name>`, the CLI:

1. Downloads and extracts the library under `./libraries/<library-name>/`.
2. Scans `./libraries/<library-name>/hedhog/table/` for YAML schema definitions.
3. Pairs each table schema with its seed data from `./libraries/<library-name>/hedhog/data/`.
4. Generates a PostgreSQL migration SQL file in `./apps/api/prisma/migrations/`.
5. Applies the migration via Prisma.

The **table YAML** defines the DDL (`CREATE TABLE`, indexes, FK constraints, triggers). The **data YAML** defines the seed DML (`INSERT` statements). Both file types are matched to each other by their file name (without extension).

Repository policy for `hub`: do not run `hedhog dev apply` or commands that reset/recreate the project, database, schema, or existing migrations. When YAML structure or seed data changes in this repository, add a new SQL migration under `apps/api/prisma/migrations/` that mirrors the YAML change and preserves existing migration history for production updates.

---

## 2. Directory Layout

```
libraries/
└── <library-name>/
    └── hedhog/
        ├── table/          ← DDL definitions — one file per table (REQUIRED)
        │   ├── my_table.yaml
        │   └── my_other_table.yaml
        ├── data/           ← Seed data — one file per table (optional)
        │   ├── my_table.yaml
        │   └── my_other_table.yaml
        ├── query/          ← Raw .sql files appended after migrations (optional)
        │   └── post_migration.sql
        └── frontend/       ← Frontend page / message files (optional)
```

- `table/` is **required** for any library that creates database tables.
- `data/`, `query/`, and `frontend/` are optional.

---

## 3. Table YAML

### 3.1 File Naming

The file name **without extension becomes the PostgreSQL table name**. Both `.yaml` and `.yml` extensions are accepted.

> **Convention:** Use `snake_case`.  
> **Example:** `user_profile.yaml` → creates table `"user_profile"`.

### 3.2 Top-Level Structure

```yaml
columns:
  - type: pk
  - name: my_column
    type: VARCHAR
    isNullable: false
  # ... more columns
```

| Property  | Type    | Required | Description                          |
|-----------|---------|----------|--------------------------------------|
| `columns` | `array` | **yes**  | Ordered list of column definitions.  |

No other top-level keys are currently processed.

---

### 3.3 Special Type Aliases

These are HedHog-specific shorthands. Each alias expands to a standard SQL type with pre-configured constraints, defaults, and names. The `name` property is **ignored** for aliases that auto-set the column name.

| `type` value    | Auto column name | SQL type       | NOT NULL | Unique | Default  | Notes |
|-----------------|------------------|----------------|----------|--------|----------|-------|
| `pk`            | `id`             | `SERIAL`       | ✓        |        |          | `PRIMARY KEY` constraint added. |
| `fk`            | *(required)*     | `INTEGER`      | ✓        |        |          | Requires `references:` sub-object. |
| `slug`          | `slug`           | `VARCHAR(255)` | ✓        | ✓      |          | `UNIQUE INDEX` created automatically. |
| `order`         | `order`          | `INTEGER`      | ✓        |        | `0`      | |
| `created_at`    | `created_at`     | `TIMESTAMPTZ`  | ✓        |        | `now()`  | |
| `updated_at`    | `updated_at`     | `TIMESTAMPTZ`  | ✓        |        | `now()`  | Also creates a `trg_touch_updated_at` trigger to auto-update on every `UPDATE`. |
| `locale_varchar`| *(required)*     | `VARCHAR`      |          |        |          | Column is routed to the auto-generated `<tableName>_locale` table, not the main table. |
| `locale_text`   | *(required)*     | `TEXT`         |          |        |          | Same as above. |
| `enum`          | *(required)*     | PostgreSQL ENUM|          |        |          | Requires `enum:` or `values:` list. Issues `CREATE TYPE ... AS ENUM`. |

> **Slug default length:** 255. Override with `length: <n>`.

---

### 3.4 Short SQL Aliases

These type values are accepted and translated directly at CREATE TABLE time (they are NOT transformed by `processColumns` — no auto name or constraint). The `name` property is required.

| `type` value | SQL type generated      |
|--------------|-------------------------|
| `int`        | `INTEGER`               |
| `datetime`   | `TIMESTAMPTZ`           |
| `char`       | `CHAR(<length \|\| 1>)` |
| `bytes`      | `BYTEA`                 |

---

### 3.5 Native PostgreSQL Types

Any standard PostgreSQL type can be used verbatim (case-insensitive). Unrecognized types cause the migration to fail with an error.

| Category      | Accepted `type` values |
|---------------|------------------------|
| Integer       | `smallint`, `integer`, `bigint`, `serial`, `bigserial` |
| Decimal       | `decimal`, `numeric`, `real`, `double precision`, `money` |
| Character     | `varchar`, `char`, `text` |
| Binary        | `bytea` |
| Date / Time   | `timestamp`, `timestamp(6)`, `timestamptz`, `timestamptz(6)`, `date`, `time`, `interval` |
| Boolean       | `boolean` |
| JSON          | `json`, `jsonb` |
| UUID          | `uuid` |
| Network       | `inet`, `cidr`, `macaddr` |
| Geometric     | `point`, `line`, `lseg`, `box`, `path`, `polygon`, `circle` |
| Text Search   | `tsvector`, `tsquery` |
| XML           | `xml` |

> **Length / precision:** For native `varchar` and `char` types, specify `length` to set the character limit: `length: 100` → `VARCHAR(100)`.

---

### 3.6 Column Properties Reference

| Property      | Type       | Required                      | Default | Description |
|---------------|------------|-------------------------------|---------|-------------|
| `name`        | `string`   | Yes (unless alias auto-sets it) | —      | Column name in `snake_case`. |
| `type`        | `string`   | **Yes**                       | —       | Special alias or native PostgreSQL type. |
| `isNullable`  | `boolean`  | No                            | `false` | Allow `NULL`. When omitted all columns are `NOT NULL`. |
| `isUnique`    | `boolean`  | No                            | `false` | Create a `UNIQUE INDEX` on this column. |
| `isPrimaryKey`| `boolean`  | No                            | `false` | Mark column as `PRIMARY KEY`. Prefer `type: pk` for new definitions. |
| `default`     | any        | No                            | —       | `DEFAULT` value. For `TIMESTAMPTZ` columns, use the string `"now()"`. |
| `length`      | `integer`  | No                            | —       | Character length for `varchar`, `char`, `locale_varchar`. If omitted: `VARCHAR` defaults to 255 for `slug` and `locale_varchar`; `CHAR` defaults to 1. |
| `references`  | `object`   | **Yes** when `type: fk`       | —       | FK reference descriptor. See §3.7. |
| `enum`        | `string[]` | Yes when `type: enum` (unless `values` present) | — | List of allowed enum values. |
| `values`      | `string[]` | No                            | —       | Alias for `enum`. Use either `enum` or `values`, not both. |

---

### 3.7 Foreign Key References

When `type: fk`, include a `references` object:

```yaml
- name: parent_id
  type: fk
  references:
    table: parent_table   # required — referenced table name
    column: id            # required — referenced column name
    onDelete: CASCADE     # optional — default: NO ACTION
    onUpdate: CASCADE     # optional — default: NO ACTION
```

| Property   | Type     | Required | Default     | Description |
|------------|----------|----------|-------------|-------------|
| `table`    | `string` | **Yes**  | —           | Name of the referenced table. |
| `column`   | `string` | **Yes**  | —           | Name of the referenced column. |
| `onDelete` | `string` | No       | `NO ACTION` | Referential action on `DELETE`. |
| `onUpdate` | `string` | No       | `NO ACTION` | Referential action on `UPDATE`. |

Accepted referential action values: `CASCADE`, `SET NULL`, `SET DEFAULT`, `RESTRICT`, `NO ACTION`.

The generated SQL is:
```sql
ALTER TABLE "<tableName>"
  ADD CONSTRAINT "<fkTable>_<columnName>_fkey"
  FOREIGN KEY ("<columnName>")
  REFERENCES "<fkTable>" ("<fkColumn>")
  ON DELETE <onDelete> ON UPDATE <onUpdate>;
```

---

### 3.8 Auto-Generated Locale Table

Whenever a table defines one or more `locale_varchar` or `locale_text` columns, a companion `<tableName>_locale` table is **automatically synthesized** — no extra YAML file is needed.

The generated locale table always has this fixed structure:

| Column             | Type          | Constraints                        |
|--------------------|---------------|------------------------------------|
| `id`               | `SERIAL`      | `NOT NULL PRIMARY KEY`             |
| `locale_id`        | `INTEGER`     | `NOT NULL FK → locale.id CASCADE`  |
| `<tableName>_id`   | `INTEGER`     | `NOT NULL FK → <tableName>.id CASCADE` |
| *(locale columns)* | `VARCHAR` / `TEXT` | As defined in the parent table |
| `created_at`       | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()`           |
| `updated_at`       | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` + trigger |

The locale columns (`locale_varchar` / `locale_text`) are **removed** from the main table and placed only in the `_locale` table. The main table will never contain those columns.

---

## 4. Data YAML

### 4.1 File Naming

The file name **without extension must match the table name** from the corresponding table YAML.

> **Example:** Data for table `category` lives in `hedhog/data/category.yaml`.

Both `.yaml` and `.yml` are accepted. If no data file exists for a table, no rows are inserted (this is valid — tables without seed data are fine).

---

### 4.2 Root Structure

A data YAML file **must parse to a root-level array**. Each element represents one row to insert.

```yaml
- id: 1
  name: "First Row"
- id: 2
  name: "Second Row"
```

> **Warning:** If the root is not an array, the entire file is **skipped** with a warning and no data is inserted.

Row ordering within the file is respected. Rows that contain `where:` sub-selects (FK lookups) are automatically moved after rows without sub-selects to ensure referenced rows exist first.

---

### 4.3 Scalar Values

Plain scalar values (strings, numbers, booleans) are inserted directly.

```yaml
- id: 1
  slug: example-item
  order: 10
  is_active: true
  rating: 4.5
  description: "A description with 'single quotes' works fine"
```

Strings are escaped using PostgreSQL dollar-quoting (`$$...$$`), so single quotes in content are handled safely.

---

### 4.4 FK Lookup (`where:`)

Instead of hard-coding a foreign key integer, use a sub-select to look up the related row's primary key at migration time. The field value must be an object with a single `where` key:

```yaml
- id: 1
  name: "Child Row"
  parent_id:
    where:
      slug: some-slug
```

This generates the following inline sub-select:
```sql
(SELECT "id" FROM "parent_table" WHERE "slug" = 'some-slug')
```

Multiple conditions in the `where` block are joined with `AND`:

```yaml
parent_id:
  where:
    status: active
    type:
      not: archived
```

#### Supported `where` Operators

Each key in `where` maps to either a plain value (equality) or an operator object:

| Operator key  | Example value          | Generated SQL                          |
|---------------|------------------------|----------------------------------------|
| *(plain)*     | `code: abc`            | `"code" = 'abc'`                       |
| `equals`      | `equals: abc`          | `"col" = 'abc'`                        |
| `notEquals`   | `notEquals: abc`       | `"col" <> 'abc'`                       |
| `not`         | `not: abc`             | `"col" <> 'abc'`                       |
| `in`          | `in: [a, b, c]`        | `"col" IN ('a', 'b', 'c')`             |
| `notIn`       | `notIn: [a, b]`        | `"col" NOT IN ('a', 'b')`              |
| `like`        | `like: "foo%"`         | `"col" LIKE 'foo%'`                    |
| `notLike`     | `notLike: "foo%"`      | `"col" NOT LIKE 'foo%'`                |
| `contains`    | `contains: foo`        | `"col" LIKE '%foo%'`                   |
| `notContains` | `notContains: foo`     | `"col" NOT LIKE '%foo%'`               |
| `gt`          | `gt: 5`                | `"col" > '5'`                          |
| `gte`         | `gte: 5`               | `"col" >= '5'`                         |
| `lt`          | `lt: 10`               | `"col" < '10'`                         |
| `lte`         | `lte: 10`              | `"col" <= '10'`                        |
| `isNull`      | `isNull: true`         | `"col" IS NULL`                        |
| `isNotNull`   | `isNotNull: true`      | `"col" IS NOT NULL`                    |

---

### 4.5 Locale Values

For columns defined as `locale_varchar` or `locale_text`, provide an object keyed by ISO locale code instead of a plain string.

```yaml
- id: 1
  slug: dashboard
  title:
    en: "Dashboard"
    pt: "Painel"
    es: "Tablero"
  description:
    en: "Main control panel"
    pt: "Painel de controlo principal"
```

**Supported locale codes:** `en`, `pt`, `es`, `it`, `jp`

The CLI recognizes a locale object by checking that **all** keys are 2–3 lowercase letters matching one of the known locale codes. Each locale entry generates a separate `INSERT` into the auto-generated `<tableName>_locale` table.

You do not need to provide all locales for every row — omit the ones you do not need.

> **Caution:** If any key in the object is not a recognized locale code, the entire value will be treated as a raw JSONB-like object instead of locale translations.

---

### 4.6 Inline Relations (`relations:`)

The `relations:` key allows a single data row to trigger inserts into one or more related tables in the **same SQL transaction** (using PostgreSQL CTEs with `RETURNING`).

```yaml
- id: 1
  slug: admin
  relations:
    permission:
      - where:
          slug: view-dashboard
      - where:
          slug: edit-settings
```

**Structure:**

```yaml
relations:
  <target_table_name>:
    - <relation_row>
    - <relation_row>
  <another_table_name>:
    - <relation_row>
```

**How the CLI resolves each relation:**

1. It searches for a **junction (intermediate) table** — a table that has two FK columns pointing to the parent table and the target table respectively.
2. **If a junction table is found:** The junction table is used. The `where:` clause on the relation row is used to find the target row's PK, and the junction row is inserted automatically (no need to reference the junction table by name).
3. **If no junction table is found (direct child):** The FK column pointing back to the parent is injected automatically, and the row is inserted directly into the target table.

---

## 5. Relationships

### 5.1 Simple FK Columns

A direct parent–child relationship is expressed in the child's table YAML with a `fk` column, and in the data YAML with either a hard-coded integer or a `where:` lookup.

```yaml
# hedhog/table/comment.yaml
columns:
  - type: pk
  - name: post_id
    type: fk
    references:
      table: post
      column: id
      onDelete: CASCADE
  - name: content
    type: TEXT
```

```yaml
# hedhog/data/comment.yaml
- id: 1
  post_id:
    where:
      slug: my-first-post
  content: "Great article!"
```

---

### 5.2 Junction (Intermediate) Tables

A many-to-many relationship requires a dedicated junction table YAML with two `fk` columns, one for each side.

```yaml
# hedhog/table/role_permission.yaml
columns:
  - type: pk
  - name: role_id
    type: fk
    references:
      table: role
      column: id
      onDelete: CASCADE
  - name: permission_id
    type: fk
    references:
      table: permission
      column: id
      onDelete: CASCADE
```

The CLI auto-detects this pattern: when `relations:` is used in a data row and a table with two FK columns referencing both sides is found, it is used as the junction table automatically.

```yaml
# hedhog/data/role.yaml
- id: 1
  slug: admin
  relations:
    permission:          # ← the CLI finds role_permission as junction table
      - where:
          slug: view-dashboard
      - where:
          slug: manage-users
```

---

### 5.3 Nested Relations

`relations:` can be nested recursively to any depth. Each nested level is resolved the same way as the top level.

```yaml
- id: 1
  slug: admin
  relations:
    permission:
      - where:
          slug: manage-users
        relations:
          scope:
            - where:
                code: global
```

---

## 6. Execution Order

Tables are created in **topological dependency order** to satisfy FK constraints:

1. The `locale` table (if defined) is always created **first**.
2. Tables with no FK dependencies come next.
3. Tables are sorted so that every referenced (parent) table is created before any referencing (child) table — using a topological sort.
4. If circular dependencies are detected, the migration **fails immediately** with an error listing the involved tables and their unresolved dependencies.

**Cross-library dependencies:** Tables defined in `@hed-hog/*` dependency libraries (listed in the library's `package.json`) are included in the dependency graph so FK lookups across libraries work, but they are not re-created.

---

## 7. Post-Migration SQL Queries

Any `.sql` files placed in `hedhog/query/` are **appended verbatim** to the migration file, after all `CREATE TABLE` and `INSERT` statements. This is useful for views, complex data transformations, or anything easier to express in raw SQL.

```
hedhog/query/
├── 01_create_view.sql
└── 02_backfill_data.sql
```

Files are included in filesystem order. Non-`.sql` files in this directory are ignored with a warning.

---

## 8. Complete Examples

### 8.1 Simple Table with All Standard Aliases

```yaml
# hedhog/table/category.yaml
columns:
  - type: pk
  - name: slug
    type: slug
  - name: order
    type: order
  - type: created_at
  - type: updated_at
```

```yaml
# hedhog/data/category.yaml
- id: 1
  slug: electronics
  order: 1
- id: 2
  slug: clothing
  order: 2
```

---

### 8.2 Table with Localization

```yaml
# hedhog/table/category.yaml
columns:
  - type: pk
  - name: slug
    type: slug
  - name: order
    type: order
  - name: name
    type: locale_varchar   # → goes into category_locale, NOT category
    length: 100
  - name: description
    type: locale_text      # → goes into category_locale, NOT category
  - type: created_at
  - type: updated_at
```

This auto-synthesizes a `category_locale` table with `id`, `locale_id`, `category_id`, `name`, `description`, `created_at`, `updated_at`.

```yaml
# hedhog/data/category.yaml
- id: 1
  slug: electronics
  order: 1
  name:
    en: Electronics
    pt: Eletrônicos
    es: Electrónica
  description:
    en: Electronic products and gadgets
    pt: Produtos eletrônicos e gadgets
```

---

### 8.3 Table with FK and Many-to-Many Relations

```yaml
# hedhog/table/role.yaml
columns:
  - type: pk
  - name: slug
    type: slug
  - type: created_at
  - type: updated_at

# hedhog/table/permission.yaml
columns:
  - type: pk
  - name: slug
    type: slug
  - type: created_at
  - type: updated_at

# hedhog/table/role_permission.yaml (junction table)
columns:
  - type: pk
  - name: role_id
    type: fk
    references:
      table: role
      column: id
      onDelete: CASCADE
      onUpdate: CASCADE
  - name: permission_id
    type: fk
    references:
      table: permission
      column: id
      onDelete: CASCADE
      onUpdate: CASCADE
```

```yaml
# hedhog/data/permission.yaml
- id: 1
  slug: view-dashboard
- id: 2
  slug: manage-users

# hedhog/data/role.yaml
- id: 1
  slug: admin
  relations:
    permission:
      - where:
          slug: view-dashboard
      - where:
          slug: manage-users
- id: 2
  slug: viewer
  relations:
    permission:
      - where:
          slug: view-dashboard
```

---

### 8.4 Table with Enum Column

```yaml
# hedhog/table/article.yaml
columns:
  - type: pk
  - name: status
    type: enum
    enum:
      - draft
      - published
      - archived
  - name: title
    type: VARCHAR
    length: 255
    isNullable: false
  - type: created_at
  - type: updated_at
```

```yaml
# hedhog/data/article.yaml
- id: 1
  status: draft
  title: "My First Article"
- id: 2
  status: published
  title: "Hello World"
```

Generated SQL includes:
```sql
CREATE TYPE "article_status_enum" AS ENUM ('draft', 'published', 'archived');
CREATE TABLE "article" (
  "id" SERIAL NOT NULL,
  "status" "article_status_enum" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  ...
);
```

---

### 8.5 Full Data File Showcasing All Features

```yaml
# hedhog/data/user.yaml
- id: 1
  # --- Locale values → inserted into user_locale ---
  display_name:
    en: Administrator
    pt: Administrador

  # --- FK lookup: plain equality ---
  role_id:
    where:
      slug: admin

  # --- FK lookup: operator (in) ---
  country_id:
    where:
      code:
        in: [US, CA]

  # --- FK lookup: multiple conditions (AND) ---
  department_id:
    where:
      active: true
      type:
        not: external

  # --- Inline relations: many-to-many via junction table ---
  relations:
    tag:
      - where:
          slug: superuser
      - where:
          slug:
            like: "staff-%"
    # --- Direct child insert (no junction table) ---
    user_setting:
      - key: theme
        value: dark
      - key: language
        value: en
```

---

### 8.6 Table with All Column Features

```yaml
# hedhog/table/product.yaml
columns:
  - type: pk

  - name: category_id
    type: fk
    references:
      table: category
      column: id
      onDelete: SET NULL
      onUpdate: CASCADE
    isNullable: true     # FK can be nullable

  - name: slug
    type: slug           # name auto-set to 'slug', VARCHAR(255), UNIQUE, NOT NULL

  - name: order
    type: order          # name auto-set to 'order', INTEGER NOT NULL DEFAULT 0

  - name: status
    type: enum
    enum:
      - active
      - inactive
      - discontinued

  - name: name
    type: locale_varchar  # goes to product_locale, NOT product
    length: 200

  - name: description
    type: locale_text     # goes to product_locale, NOT product

  - name: sku
    type: VARCHAR
    length: 100
    isUnique: true
    isNullable: false

  - name: price
    type: numeric
    isNullable: false

  - name: metadata
    type: jsonb
    isNullable: true

  - name: rating
    type: real
    default: 0
    isNullable: false

  - type: created_at
  - type: updated_at
```
