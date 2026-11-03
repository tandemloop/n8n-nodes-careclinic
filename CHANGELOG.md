# Changelog

## 0.1.1

- Scope automatic idempotency keys to each workflow, node, execution, invocation and item with an execution salt. Preserve the key and automatic timestamp during retries.
- Use the incoming reminder's scheduled time as the medication entry default without changing field labels or descriptions.
- Upgrade saved 0.1.0 defaults while preserving custom keys and explicit times.

## 0.1.0

Initial release: Account, Catalog, Entry, Reminder and Wellness operations for the CareClinic API.
