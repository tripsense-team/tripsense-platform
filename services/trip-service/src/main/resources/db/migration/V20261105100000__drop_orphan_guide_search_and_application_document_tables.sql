-- ==============================================================================
-- V20261105100000__drop_orphan_guide_search_and_application_document_tables.sql
-- Clean up dead/orphan tables from early partner onboarding migration (V20260928143500)
--
-- Verified zero JPA entity or repository mappings and zero Java queries:
-- 1. guide_public_search (dead projection table, 0 usages)
-- 2. partner_application_document (dead join table, documents are stored in profile_snapshot JSONB)
-- ==============================================================================

DROP TABLE IF EXISTS guide_public_search CASCADE;
DROP TABLE IF EXISTS partner_application_document CASCADE;
