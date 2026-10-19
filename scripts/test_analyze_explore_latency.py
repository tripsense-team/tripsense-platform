import subprocess
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("analyze-explore-latency.py")


class AnalyzerTest(unittest.TestCase):
    def test_observed_accounting_and_preprofile_checkpoints_are_preserved(self):
        result = self.run_analyzer("\n".join([
            "explore_state service=recommendation-service requestId=req1 name=request_to_profile_ms value=2100",
            "explore_state service=recommendation-service requestId=req1 name=observed_timing_summary value=wallNs:5000000,diagnosticLogNs:4000000,residualNs:0",
            "explore_phase service=recommendation-service requestId=req1 phase=observed_summary_emit durationMs=2 outcome=success",
            "explore_state service=recommendation-service requestId=req2 name=observed_timing_summary value=not-this-request",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        self.assertIn("request_to_profile_ms", result.stdout)
        self.assertIn("wallNs:5000000,diagnosticLogNs:4000000,residualNs:0", result.stdout)
        self.assertIn("observed_summary_emit", result.stdout)
        self.assertNotIn("not-this-request", result.stdout)

    def test_grouped_feed_work_counts_and_seed_reuse_are_visible(self):
        result = self.run_analyzer("\n".join([
            "explore_state service=recommendation-service requestId=req1 name=feed_view value=category",
            "explore_state service=recommendation-service requestId=req1 name=semantic_call_count value=0",
            "explore_state service=recommendation-service requestId=req1 name=place_batch_call_count value=1",
            "explore_state service=recommendation-service requestId=req1 name=seed_reused value=true",
            "explore_state service=recommendation-service requestId=req1 name=eligible_cafe value=20",
        ]))
        self.assertIn("DIAGNOSTIC STATE VALUES", result.stdout)
        for name in ("feed_view", "semantic_call_count", "place_batch_call_count", "seed_reused", "eligible_cafe"):
            self.assertIn(name, result.stdout)

    def test_context_correlation_outcomes_and_nested_phases(self):
        result = self.run_analyzer("\n".join([
            "explore_phase service=context-service requestId=req1 phase=context_metadata durationMs=200 outcome=success",
            "explore_phase service=context-service requestId=req1 phase=context_cache_get durationMs=55 outcome=success",
            "explore_state service=context-service requestId=req1 name=context_preferences_outcome value=hit",
            "explore_state service=context-service requestId=req1 name=context_signal_count value=10",
            "explore_state service=context-service requestId=req2 name=context_preferences_outcome value=private-other",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        self.assertIn("context_metadata", result.stdout)
        self.assertIn("context_cache_get", result.stdout)
        self.assertIn("context_preferences_outcome", result.stdout)
        self.assertIn("DIAGNOSTIC STATE VALUES", result.stdout)
        self.assertIn("parent/child phases overlap", result.stdout)
        self.assertNotIn("private-other", result.stdout)

    def test_observed_timings_and_counts_are_visible_and_filtered(self):
        result = self.run_analyzer("\n".join([
            "explore_phase service=recommendation-service requestId=req1 phase=observed_seen_query durationMs=140 outcome=success",
            "explore_state service=recommendation-service requestId=req1 name=observed_seen_query_rows_processed value=123",
            "explore_state service=recommendation-service requestId=req1 name=observed_snapshot_decode_ms value=4",
            "explore_state service=recommendation-service requestId=req1 name=observed_connection_timing value=included_in_query",
            "explore_state service=recommendation-service requestId=req2 name=observed_seen_query_rows_processed value=9999",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        self.assertIn("observed_seen_query", result.stdout)
        self.assertIn("DIAGNOSTIC STATE VALUES", result.stdout)
        self.assertIn("recommendation-service / observed_seen_query_rows_processed", result.stdout)
        self.assertIn("observed_snapshot_decode_ms", result.stdout)
        self.assertIn("included_in_query", result.stdout)
        self.assertNotIn("9999", result.stdout)

    def run_analyzer(self, text, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            input=text, text=True, capture_output=True, check=False,
        )

    def test_summary_counts_errors_and_ignores_unrelated_logs(self):
        result = self.run_analyzer("\n".join([
            "container | explore_request_started service=recommendation-service requestId=req1",
            "container | explore_phase service=recommendation-service requestId=req1 phase=exact durationMs=300 outcome=success",
            "container | explore_phase service=recommendation-service requestId=req1 phase=user_consent durationMs=100 outcome=error",
            "container | explore_request_completed service=recommendation-service requestId=req1 status=200 durationMs=450",
            "unrelated SECRET=do-not-include",
        ]))
        self.assertEqual(result.returncode, 0)
        self.assertIn("recommendation-service / user_consent", result.stdout)
        self.assertIn("450", result.stdout)
        self.assertNotIn("SECRET", result.stdout)
        self.assertNotIn("without completion", result.stdout)

    def test_request_filter_excludes_other_requests(self):
        result = self.run_analyzer("\n".join([
            "explore_phase service=place-service requestId=req1 phase=mongo_search durationMs=81 outcome=success",
            "explore_phase service=place-service requestId=req2 phase=provider_http durationMs=9999 outcome=error",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        self.assertIn("mongo_search", result.stdout)
        self.assertNotIn("provider_http", result.stdout)
        self.assertNotIn("9999", result.stdout)

    def test_repeated_fallback_invocation_can_be_in_flight(self):
        result = self.run_analyzer("\n".join([
            "explore_request_started service=place-service requestId=req1",
            "explore_request_completed service=place-service requestId=req1 status=200 durationMs=100",
            "explore_request_started service=place-service requestId=req1",
        ]))
        self.assertIn("1 service invocation(s) started without completion", result.stdout)

    def test_empty_or_missing_request_returns_nonzero(self):
        result = self.run_analyzer("unrelated log")
        self.assertEqual(result.returncode, 1)
        self.assertIn("No Explore diagnostic events", result.stderr)

    def test_semantic_counts_are_observations_and_are_request_filtered(self):
        result = self.run_analyzer("\n".join([
            "explore_state service=recommendation-service requestId=req1 name=snapshot_batch_requested value=34",
            "explore_state service=recommendation-service requestId=req1 name=snapshot_batch_resolved value=34",
            "explore_state service=recommendation-service requestId=req2 name=snapshot_batch_resolved value=9999",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        self.assertIn("DIAGNOSTIC STATE VALUES", result.stdout)
        self.assertIn("snapshot_batch_resolved", result.stdout)
        self.assertIn("34", result.stdout)
        self.assertNotIn("9999", result.stdout)

    def test_place_evidence_is_visible_in_summary(self):
        result = self.run_analyzer("\n".join([
            "explore_state service=place-service requestId=req1 name=place_local_eligible_count value=49",
            "explore_state service=place-service requestId=req1 name=place_local_reason_codes value=TOO_FEW_CANDIDATES,STALE_REQUIRED_EVIDENCE",
            "explore_phase service=place-service requestId=req1 phase=mongo_text_query durationMs=120 outcome=success",
            "explore_phase service=place-service requestId=req1 phase=mongo_dto_mapping durationMs=15 outcome=success",
        ]))
        self.assertEqual(result.returncode, 0)
        for value in ("place_local_eligible_count", "49", "TOO_FEW_CANDIDATES,STALE_REQUIRED_EVIDENCE", "mongo_text_query", "mongo_dto_mapping"):
            self.assertIn(value, result.stdout)

    def test_impression_counts_and_repeated_inserts_are_reported(self):
        result = self.run_analyzer("\n".join([
            "explore_state service=recommendation-service requestId=req1 name=impression_items_expected value=48",
            "explore_state service=recommendation-service requestId=req1 name=impression_item_inserts_completed value=48",
            "explore_phase service=recommendation-service requestId=req1 phase=impression_item_insert durationMs=40 outcome=success",
            "explore_phase service=recommendation-service requestId=req1 phase=impression_item_insert durationMs=60 outcome=success",
        ]))
        self.assertEqual(result.returncode, 0)
        self.assertIn("impression_items_expected", result.stdout)
        self.assertIn("impression_item_inserts_completed", result.stdout)
        insert_row = next(line for line in result.stdout.splitlines() if " / impression_item_insert " in line)
        self.assertRegex(insert_row, r"\s2\s+100\s+50\.0\s+60\s+0$")

    def test_batch_impression_summary_and_filter_remain_compatible(self):
        result = self.run_analyzer("\n".join([
            "explore_state service=recommendation-service requestId=req1 name=impression_write_mode value=JDBC_BATCH",
            "explore_state service=recommendation-service requestId=req1 name=impression_batch_calls value=1",
            "explore_state service=recommendation-service requestId=req1 name=impression_item_inserts_completed value=48",
            "explore_phase service=recommendation-service requestId=req1 phase=impression_items_batch_insert durationMs=90 outcome=success",
            "explore_phase service=recommendation-service requestId=req2 phase=impression_items_batch_insert durationMs=9999 outcome=error",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        for field in ("JDBC_BATCH", "impression_batch_calls", "impression_item_inserts_completed", "impression_items_batch_insert"):
            self.assertIn(field, result.stdout)
        self.assertNotIn("9999", result.stdout)

    def test_cache_write_phases_are_separate_and_request_filtered(self):
        result = self.run_analyzer("\n".join([
            "explore_phase service=recommendation-service requestId=req1 phase=cache_fresh_serialize durationMs=3 outcome=success",
            "explore_phase service=recommendation-service requestId=req1 phase=cache_fresh_redis_set durationMs=210 outcome=success",
            "explore_phase service=recommendation-service requestId=req1 phase=cache_lkg_serialize durationMs=2 outcome=success",
            "explore_phase service=recommendation-service requestId=req1 phase=cache_lkg_redis_set durationMs=230 outcome=error",
            "explore_phase service=recommendation-service requestId=req2 phase=cache_lkg_redis_set durationMs=9999 outcome=success",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        for phase in ("cache_fresh_serialize", "cache_fresh_redis_set", "cache_lkg_serialize", "cache_lkg_redis_set"):
            self.assertIn(phase, result.stdout)
        self.assertNotIn("9999", result.stdout)
        self.assertIn("error", result.stdout)

    def test_pipelined_cache_phases_are_reported_without_old_requests(self):
        result = self.run_analyzer("\n".join([
            "explore_phase service=recommendation-service requestId=req1 phase=cache_serialize durationMs=14 outcome=success",
            "explore_phase service=recommendation-service requestId=req1 phase=cache_payload_encode durationMs=1 outcome=success",
            "explore_phase service=recommendation-service requestId=req1 phase=cache_pipeline_execute durationMs=160 outcome=success",
            "explore_phase service=recommendation-service requestId=req2 phase=cache_fresh_redis_set durationMs=9999 outcome=success",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        for phase in ("cache_serialize", "cache_payload_encode", "cache_pipeline_execute"):
            self.assertIn(phase, result.stdout)
        self.assertNotIn("9999", result.stdout)
        self.assertNotIn("cache_fresh_redis_set", result.stdout)


    def test_provider_persistence_children_and_outcomes_are_counted(self):
        result = self.run_analyzer("\n".join([
            "explore_phase service=place-service requestId=req1 phase=place_upsert_provider_lookup durationMs=40 outcome=success",
            "explore_phase service=place-service requestId=req1 phase=place_upsert_provider_lookup durationMs=60 outcome=error",
            "explore_state service=place-service requestId=req1 name=place_upsert_result value=NEW_SAVED",
            "explore_state service=place-service requestId=req1 name=place_upsert_result value=NEW_SAVED",
            "explore_state service=place-service requestId=req1 name=place_upsert_result value=FAILED_FALLBACK",
            "explore_phase service=place-service requestId=req2 phase=place_upsert_save_new durationMs=9999 outcome=success",
        ]), "--request-id", "req1")
        self.assertEqual(result.returncode, 0)
        row = next(line for line in result.stdout.splitlines() if " / place_upsert_provider_lookup " in line)
        self.assertRegex(row, r"\s2\s+100\s+50\.0\s+60\s+1$")
        saved = next(line for line in result.stdout.splitlines() if " / place_upsert_result " in line and "NEW_SAVED" in line)
        self.assertRegex(saved, r"NEW_SAVED\s+2$")
        self.assertIn("FAILED_FALLBACK", result.stdout)
        self.assertNotIn("9999", result.stdout)


if __name__ == "__main__":
    unittest.main()
