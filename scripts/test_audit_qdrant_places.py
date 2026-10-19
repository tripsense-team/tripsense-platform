import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
from urllib.error import HTTPError


SPEC = importlib.util.spec_from_file_location("audit_qdrant_places", Path(__file__).with_name("audit-qdrant-places.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def page(points, offset=None):
    return {"status": "ok", "result": {"points": points, "next_page_offset": offset}}


def point(point_id, place_id):
    return {"id": point_id, "payload": {"placeId": place_id}}


class AuditTest(unittest.TestCase):
    def test_aliases_remain_valid_and_absent_ids_are_checked_twice(self):
        qdrant = Mock()
        qdrant.post.return_value = page([point("q1", "canonical"), point("q2", "provider-alias"), point(123, "missing")])
        place = Mock()
        place.post.side_effect = [
            {"success": True, "data": [{"id": "canonical", "providerPlaceId": "provider-alias"}]},
            {"success": True, "data": []},
        ]
        report = MODULE.audit(qdrant, place, "test", lambda _: None)
        self.assertEqual(report["summary"]["validPoints"], 2)
        self.assertEqual(report["orphanedPoints"], [{"pointId": 123, "placeId": "missing"}])
        self.assertEqual(place.post.call_args_list[1].args[1], ["missing"])
        self.assertTrue(report["readOnly"])
        self.assertTrue(all(call.args[0].endswith("/points/scroll") for call in qdrant.post.call_args_list))

    def test_point_added_during_audit_is_not_classified_as_orphan(self):
        qdrant = Mock()
        qdrant.post.return_value = page([point("q1", "new-place")])
        place = Mock()
        place.post.side_effect = [{"success": True, "data": []}, {"success": True, "data": [{"id": "new-place"}]}]
        self.assertEqual(MODULE.audit(qdrant, place, "test", lambda _: None)["orphanedPoints"], [])

    def test_invalid_payloads_are_manual_review_not_orphans(self):
        qdrant = Mock()
        qdrant.post.return_value = page([{"id": "q1", "payload": {}}, point("q2", {"invalid": True})])
        place = Mock()
        report = MODULE.audit(qdrant, place, "test", lambda _: None)
        self.assertEqual(report["summary"]["invalidPayloadPoints"], 2)
        self.assertEqual(report["orphanedPoints"], [])
        place.post.assert_not_called()

    def test_pagination_preserves_offset_and_never_fetches_vectors(self):
        qdrant = Mock()
        qdrant.post.side_effect = [page([point(1, "p1")], 1), page([point(2, "p2")])]
        self.assertEqual(len(MODULE.scroll_points(qdrant, "test", lambda _: None)), 2)
        self.assertEqual(qdrant.post.call_args_list[1].args[1]["offset"], 1)
        for call in qdrant.post.call_args_list:
            self.assertIs(call.args[1]["with_vector"], False)
            self.assertEqual(call.args[1]["with_payload"], ["placeId"])

    def test_malformed_place_response_aborts_instead_of_flagging_everything(self):
        qdrant = Mock()
        qdrant.post.return_value = page([point("q1", "p1")])
        place = Mock()
        place.post.return_value = {"success": False, "data": []}
        with self.assertRaises(MODULE.AuditError):
            MODULE.audit(qdrant, place, "test", lambda _: None)

    def test_duplicate_point_scroll_aborts(self):
        qdrant = Mock()
        qdrant.post.side_effect = [page([point(1, "p1")], 1), page([point(1, "p1")])]
        with self.assertRaises(MODULE.AuditError):
            MODULE.scroll_points(qdrant, "test", lambda _: None)

    def test_place_batch_never_exceeds_100(self):
        place = Mock()
        place.post.return_value = {"success": True, "data": []}
        MODULE.existing_place_ids(place, [str(i) for i in range(1400)], lambda _: None)
        self.assertEqual(place.post.call_count, 14)
        self.assertTrue(all(len(call.args[1]) <= 100 for call in place.post.call_args_list))

    def test_env_reader_does_not_execute_shell_and_ignores_other_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / ".env"
            env.write_text('QDRANT_PLACE_COLLECTION="test"\nexport QDRANT_URL=https://example.test\nUSER_DB_PASS=unrelated\n', encoding="utf-8")
            config = MODULE.load_config(env)
            self.assertNotIn("USER_DB_PASS", config)
        with self.assertRaises(MODULE.AuditError):
            MODULE.checked_url('https://${QDRANT_HOST}')

    def test_remote_api_key_requires_https_and_redirects_are_disabled(self):
        with self.assertRaises(MODULE.AuditError):
            MODULE.JsonClient("http://example.test", "secret")
        self.assertIsNone(MODULE.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.test"))

    def test_http_errors_do_not_expose_urls_keys_or_response_bodies(self):
        client = MODULE.JsonClient("https://example.test", "private-key")
        client.opener = Mock()
        client.opener.open.side_effect = HTTPError("https://example.test/private-key", 403, "private-body", {}, None)
        with self.assertRaises(MODULE.AuditError) as caught:
            client.post("/read", {})
        self.assertIn("403", str(caught.exception))
        self.assertNotIn("private", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
