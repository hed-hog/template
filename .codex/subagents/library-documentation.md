# Name
Library Documentation

# Use when
- Creating or refreshing `libraries/*/README.md`
- Documenting endpoints, contracts, auth, errors, and YAML-defined database structures from real code

# Owns
- Library README content derived from controllers, DTOs, services, and table YAML

# Must hand off to
- No runtime handoff; consult code and YAML as sources of truth

# Must not do
- Do not invent routes, fields, responses, or rules not present in source
- Do not edit runtime code or Prisma schema as part of documentation work
- Do not add generic sections not supported by the module

# Validation before finish
- All relevant controller routes are covered
- DTO/request-response details stay aligned with source
- YAML tables referenced by the library are documented
- README remains technical, concise, and implementation-driven
