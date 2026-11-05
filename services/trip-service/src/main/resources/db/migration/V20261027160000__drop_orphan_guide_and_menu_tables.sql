-- ==============================================================================
-- V20261027160000__drop_orphan_guide_and_menu_tables.sql
-- Clean up dead/orphan tables from early prototype migrations (V20260928143500)
-- 
-- Verified zero JPA entity or repository mappings:
-- 1. guide_community_distribution (dead table, 0 usages)
-- 2. guide_promotion_revision (superseded by partner_guide_promotion_revision in V20260928183000)
-- 3. guide_promotion (superseded by partner_guide_promotion in V20260928183000)
-- 4. partner_restaurant_menu_item (superseded by restaurant_menu_item in V20260928173000)
-- ==============================================================================

DROP TABLE IF EXISTS guide_community_distribution CASCADE;
DROP TABLE IF EXISTS guide_promotion_revision CASCADE;
DROP TABLE IF EXISTS guide_promotion CASCADE;
DROP TABLE IF EXISTS partner_restaurant_menu_item CASCADE;
