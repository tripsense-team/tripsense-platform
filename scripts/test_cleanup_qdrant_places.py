import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import uuid
from unittest.mock import Mock

SPEC = importlib.util.spec_from_file_location("qdrant_cleanup", Path(__file__).with_name("cleanup-qdrant-places.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def point(number):
    return {"id": str(uuid.UUID(int=number)), "payload": {"placeId": f"place-{number}", "contentHash": "h"}, "vector": [0.1, 0.2]}


class FakeQdrant:
    base_url = "https://qdrant.test"

    def __init__(self, points, backup):
        self.points = {p["id"]: copy.deepcopy(p) for p in points}
        self.backup = backup
        self.deletes = []
        self.reads = 0
        self.change_on_second_read = False

    def post(self, path, body):
        if path.endswith("/points"):
            self.reads += 1
            if self.change_on_second_read and self.reads == 2:
                next(iter(self.points.values()))["vector"] = [0.9]
            return {"status": "ok", "result": [copy.deepcopy(self.points[str(i)]) for i in body["ids"] if str(i) in self.points]}
        selected = []
        for pair in body["filter"]["should"]:
            conditions = pair["must"]
            point_id = str(conditions[0]["has_id"][0])
            place_id = conditions[1]["match"]["value"]
            if point_id in self.points and self.points[point_id]["payload"]["placeId"] == place_id:
                selected.append(point_id)
        if path.endswith("/count"):
            return {"status": "ok", "result": {"count": len(selected)}}
        if "/delete?wait=true" in path:
            assert self.backup.is_file(), "Deletion attempted before backup exists"
            saved = json.loads(self.backup.read_text())["points"]
            assert all(any(p["id"] == i and p["vector"] for p in saved) for i in selected)
            self.deletes.extend(selected)
            for i in selected:
                del self.points[i]
            return {"status": "ok", "result": {"status": "completed", "operation_id": len(self.deletes)}}
        raise AssertionError("Unexpected operation")


class CleanupTest(unittest.TestCase):
    def setup_clients(self, directory, points=None):
        backup = Path(directory) / "backup.json"
        receipt = Path(directory) / "receipt.json"
        qdrant = FakeQdrant(points or [point(1), point(2)], backup)
        place = Mock(base_url="http://localhost:8083")
        place.post.return_value = {"success": True, "data": []}
        return qdrant, place, backup, receipt

    def candidates(self, points):
        return [{"pointId": p["id"], "placeId": p["payload"]["placeId"]} for p in points]

    def test_only_explicit_points_deleted_after_verified_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            q, p, backup, receipt = self.setup_clients(directory)
            result = MODULE.clean(q, p, "test", self.candidates([point(1)]), backup, receipt, True, lambda _: None)
            self.assertEqual(result["deletedPointIds"], [point(1)["id"]])
            self.assertIn(point(2)["id"], q.points)
            self.assertEqual(json.loads(backup.read_text())["points"], [point(1)])
            self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
            self.assertTrue(receipt.with_name("receipt-batch-1.json").is_file())

    def test_dry_run_creates_backup_without_deleting(self):
        with tempfile.TemporaryDirectory() as directory:
            q, p, backup, receipt = self.setup_clients(directory)
            MODULE.clean(q, p, "test", self.candidates([point(1)]), backup, receipt, False, lambda _: None)
            self.assertTrue(backup.is_file())
            self.assertEqual(q.deletes, [])

    def test_place_reappearing_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            q, p, backup, receipt = self.setup_clients(directory)
            p.post.side_effect = [{"success": True, "data": []}, {"success": True, "data": [{"id": "place-1"}]}]
            result = MODULE.clean(q, p, "test", self.candidates([point(1)]), backup, receipt, True, lambda _: None)
            self.assertEqual(q.deletes, [])
            self.assertEqual(result["skippedChangedOrReappeared"], [point(1)["id"]])

    def test_changed_vector_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            q, p, backup, receipt = self.setup_clients(directory)
            q.change_on_second_read = True
            MODULE.clean(q, p, "test", self.candidates([point(1)]), backup, receipt, True, lambda _: None)
            self.assertEqual(q.deletes, [])

    def test_failed_backup_prevents_any_delete(self):
        with tempfile.TemporaryDirectory() as directory:
            q, p, backup, receipt = self.setup_clients(directory)
            backup.write_text("existing")
            with self.assertRaises(FileExistsError):
                MODULE.clean(q, p, "test", self.candidates([point(1)]), backup, receipt, True, lambda _: None)
            self.assertEqual(q.deletes, [])
            self.assertEqual(backup.read_text(), "existing")

    def test_report_cannot_switch_source_or_expand_count(self):
        report = {"schemaVersion": 1, "readOnly": True, "collection": "test",
            "sources": {"qdrant": "https://qdrant.test", "place": "http://localhost:8083"},
            "orphanedPoints": self.candidates([point(1)]), "summary": {"orphanedPoints": 1}}
        self.assertEqual(len(MODULE.validate_report(report, "test", "https://qdrant.test", "http://localhost:8083", 1)), 1)
        for count, url in [(2, "https://qdrant.test"), (1, "https://other.test")]:
            with self.assertRaises(MODULE.CleanupError):
                MODULE.validate_report(report, "test", url, "http://localhost:8083", count)

    def test_rebound_point_is_not_deleted(self):
        with tempfile.TemporaryDirectory() as directory:
            q, p, backup, receipt = self.setup_clients(directory)
            q.points[point(1)["id"]]["payload"]["placeId"] = "new-place"
            result = MODULE.clean(q, p, "test", self.candidates([point(1)]), backup, receipt, True, lambda _: None)
            self.assertEqual(result["eligibleCount"], 0)
            self.assertEqual(q.deletes, [])

    def test_all_batches_backed_up_before_any_deletion(self):
        with tempfile.TemporaryDirectory() as directory:
            points = [point(i) for i in range(1, 140)]
            q, p, backup, receipt = self.setup_clients(directory, points)
            result = MODULE.clean(q, p, "test", self.candidates(points), backup, receipt, True, lambda _: None)
            self.assertEqual(len(result["deletedPointIds"]), 139)
            self.assertEqual(len(json.loads(backup.read_text())["points"]), 139)
            self.assertTrue(receipt.with_name("receipt-batch-2.json").is_file())


if __name__ == "__main__":
    unittest.main()
