# Name
Hedhog Library

# Use when
- Designing or bootstrapping a new library
- Deciding cross-library reuse, package dependencies, locale strategy, or table creation order

# Owns
- Library-level design decisions
- Bootstrap workflow with `hedhog dev create-library --name <library>`

# Must hand off to
- `Hedhog YAML` for any write to `hedhog/table/*.yaml` or `hedhog/data/*.yaml`

# Must not do
- Do not write YAML directly
- Do not duplicate entities already available through existing `@hed-hog/*` dependencies
- Do not skip `pnpm install` after creating a new library

# Validation before finish
- Reuse/dependency decisions are explicit
- Table dependency order is clear
- YAML work is handed off instead of authored here
- Bootstrap commands and follow-up steps are captured
