# Name
Hedhog YAML

# Use when
- Editing `libraries/*/hedhog/table/*.yaml`
- Editing `libraries/*/hedhog/data/*.yaml` other than `route.yaml` and `role.yaml`

# Owns
- Schema-correct table YAML
- Schema-correct data seed YAML, including FK lookups, locale content, and relations blocks

## Locale Modeling Standard

- When a table stores user-facing static text that must appear translated in the UI, model that text with `locale_varchar` or `locale_text` so the CLI generates the companion `<table>_locale` table automatically
- This applies especially to seeded lookup/catalog tables whose labels are shown in selects, tables, badges, or form options
- Prefer a machine-friendly identifier in the main table such as `code`, `slug`, or enum-like internal value, and keep the human-readable label/description in locale columns
- Do not model translatable labels as plain `varchar`/`text` in the main table when the content is expected to vary by locale
- Do not rely on `enum` alone for values that the end user should read in multiple languages; use enum for technical/internal state and locale columns for display text
- Before writing lookup-style tables, check existing localized patterns in libraries such as `faq`, `content`, and `contact`

## Key Syntax Rules for Relations

### Foreign Key Lookups with `where`
When referencing related entities via foreign key fields, use the `where` clause to specify the lookup condition:

```yaml
relations:
  entity_name:
    where:
      slug: lookup-value
```

**❌ WRONG:**
```yaml
relations:
  entity_name:
    slug: lookup-value
```

**✓ CORRECT:**
```yaml
relations:
  entity_name:
    where:
      slug: lookup-value
```

This applies to all relationship blocks (e.g., `setting_subgroup`, `setting_list`, etc.).

### Mandatory pattern for `setting_subgroup`
In `setting_group.yaml` and similar seed files, always use this exact structure:

```yaml
setting_subgroup:
  where:
    slug: database-cleanup
```

Never use `setting_subgroup.slug` directly.

# Must hand off to
- No automatic downstream handoff; coordinate with the caller when a matching SQL migration is needed

# Must not do
- Do not use `hedhog dev apply`
- Do not run commands that reset/recreate the project, database, schema, or existing migrations
- Do not delete, overwrite, or regenerate existing migrations
- Do not edit `route.yaml` or `role.yaml`
- Do not invent identifiers outside repository naming conventions
- Do not use Portuguese table or column identifiers

# Validation before finish
- YAML matches repository schema expectations
- FK, enum, length, locale, and root-array rules are respected
- Diff stays minimal and targeted
- Any YAML structure or seed-data change has a required new SQL migration under `apps/api/prisma/migrations` called out
- Any newly created migration file has been applied with `pnpm prisma:deploy` from `apps/api`
