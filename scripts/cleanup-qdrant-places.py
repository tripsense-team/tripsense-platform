#!/usr/bin/env python3
"""Back up and optionally remove only the explicitly reviewed orphan point list."""

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote
import uuid

SPEC = importlib.util.spec_from_file_location("qdrant_audit", Path(__file__).with_name("audit-qdrant-places.py"))
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class CleanupError(Exception):
    pass


class CleanupClient(AUDIT.JsonClient):
    def post(self, path, body):
        try:
            return super().post(path, body)
        except AUDIT.AuditError:
            # A later read may fail after an earlier delete succeeded. Never claim no mutation.
            raise CleanupError("Network/API operation failed. Check the backup and collection before retrying; earlier batches may have completed.") from None


def result(response):
    if not isinstance(response, dict) or response.get("status") != "ok" or "result" not in response:
        raise CleanupError("Qdrant returned an unsuccessful or malformed response")
    return response["result"]


def validate_report(report, collection, qdrant_url, place_url, expected_count):
    if report.get("schemaVersion") != 1 or report.get("readOnly") is not True:
        raise CleanupError("Expected an original read-only audit report")
    if report.get("collection") != collection or not re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", collection):
        raise CleanupError("Collection does not match the reviewed report")
    if report.get("sources") != {"qdrant": qdrant_url, "place": place_url}:
        raise CleanupError("Live source URLs do not match the reviewed audit")
    candidates = report.get("orphanedPoints")
    if (not isinstance(candidates, list) or expected_count <= 0
            or len(candidates) != expected_count
            or report.get("summary", {}).get("orphanedPoints") != expected_count):
        raise CleanupError("Expected count does not match the reviewed orphan list")
    seen = set()
    for point in candidates:
        if not isinstance(point, dict):
            raise CleanupError("Invalid reviewed point")
        point_id, place_id = point.get("pointId"), point.get("placeId")
        valid_id = isinstance(point_id, int) and not isinstance(point_id, bool) and 0 <= point_id < 2**64
        if isinstance(point_id, str):
            try:
                uuid.UUID(point_id)
                valid_id = True
            except ValueError:
                pass
        if not valid_id or str(point_id) in seen or not isinstance(place_id, str) or not re.fullmatch(r"[A-Za-z0-9._:-]{1,200}", place_id):
            raise CleanupError("Invalid or duplicate point/place ID in reviewed list")
        seen.add(str(point_id))
    return candidates


def retrieve(client, collection, ids):
    points = {}
    for start in range(0, len(ids), 100):
        batch = ids[start:start + 100]
        returned = result(client.post(f"/collections/{quote(collection, safe='')}/points",
            {"ids": batch, "with_payload": True, "with_vector": True}))
        if not isinstance(returned, list):
            raise CleanupError("Invalid point retrieval response")
        expected = {str(point_id) for point_id in batch}
        for point in returned:
            if not isinstance(point, dict) or str(point.get("id")) not in expected or str(point["id"]) in points:
                raise CleanupError("Unexpected or duplicate retrieved point")
            if not isinstance(point.get("payload"), dict) or not point.get("vector"):
                raise CleanupError("Cannot back up a point without its full payload/vector")
            points[str(point["id"])] = point
    return points


def write_new_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(encoded)
        stream.flush()
        os.fsync(stream.fileno())
    if path.read_bytes() != encoded:
        raise CleanupError("Backup verification failed")
    return hashlib.sha256(encoded).hexdigest()


def exact_filter(points):
    # Pair each approved Qdrant point ID with its expected payload binding.
    # If a concurrent upsert rebinds a point to a different place, it will not match.
    return {"should": [{"must": [{"has_id": [p["id"]]},
        {"key": "placeId", "match": {"value": p["payload"]["placeId"]}}]} for p in points]}


def comparable(point):
    return {key: point.get(key) for key in ("id", "payload", "vector")}


def clean(qdrant, place, collection, candidates, backup_path, receipt_path, execute=False, progress=print):
    ids = [p["pointId"] for p in candidates]
    current = retrieve(qdrant, collection, ids)
    bound = [p for p in candidates if str(p["pointId"]) in current
        and current[str(p["pointId"])].get("payload", {}).get("placeId") == p["placeId"]]
    existing = AUDIT.existing_place_ids(place, sorted({p["placeId"] for p in bound}), progress)
    eligible = [current[str(p["pointId"])] for p in bound if p["placeId"] not in existing]
    backup = {"schemaVersion": 1, "createdAt": datetime.now(timezone.utc).isoformat(),
        "collection": collection, "sources": {"qdrant": qdrant.base_url, "place": place.base_url},
        "reviewedCandidates": candidates, "points": eligible,
        "restoreNote": "Upsert only the id, payload and vector fields of these points into this collection after verifying no conflicting point exists."}
    checksum = write_new_json(backup_path, backup)
    # Ensure the durable backup contains exactly the intended point data before any mutation.
    if json.loads(backup_path.read_text(encoding="utf-8"))["points"] != eligible:
        raise CleanupError("Backup content mismatch")
    progress(f"Full vector/payload backup verified: {backup_path}")
    progress(f"Backup SHA256: {checksum}")
    progress(f"Reviewed={len(candidates)}; still absent in Place={len(eligible)}; skipped={len(candidates) - len(eligible)}")
    receipt = {"collection": collection, "backup": str(backup_path), "backupSha256": checksum,
        "execute": execute, "reviewedCount": len(candidates), "eligibleCount": len(eligible),
        "deletedPointIds": [], "skippedChangedOrReappeared": [], "operations": []}
    if execute:
        for start in range(0, len(eligible), 100):
            batch = eligible[start:start + 100]
            # Verify again immediately before the destructive operation.
            found = AUDIT.existing_place_ids(place, sorted({p["payload"]["placeId"] for p in batch}), progress)
            latest = retrieve(qdrant, collection, [p["id"] for p in batch])
            safe = []
            for point in batch:
                now = latest.get(str(point["id"]))
                if (point["payload"]["placeId"] in found or now is None
                        or comparable(point) != comparable(now)):
                    receipt["skippedChangedOrReappeared"].append(point["id"])
                else:
                    safe.append(point)
            if not safe:
                continue
            selector = exact_filter(safe)
            count = result(qdrant.post(f"/collections/{quote(collection, safe='')}/points/count",
                {"filter": selector, "exact": True}))
            if not isinstance(count, dict) or count.get("count") != len(safe):
                raise CleanupError("Conditional selector count changed; stopped before deleting this batch")
            operation = result(qdrant.post(f"/collections/{quote(collection, safe='')}/points/delete?wait=true", {"filter": selector}))
            if not isinstance(operation, dict) or operation.get("status") != "completed":
                raise CleanupError("Delete operation did not confirm completion; verify collection before retrying")
            receipt["operations"].append(operation)
            remaining = retrieve(qdrant, collection, [p["id"] for p in safe])
            if remaining:
                raise CleanupError("Some selected points remain after deletion; verify collection before retrying")
            receipt["deletedPointIds"].extend(p["id"] for p in safe)
            # Durable per-batch receipts survive a later batch failure.
            write_new_json(receipt_path.with_name(receipt_path.stem + f"-batch-{start // 100 + 1}.json"), receipt)
            progress(f"Confirmed deleted: {len(receipt['deletedPointIds'])}")
    receipt["completedAt"] = datetime.now(timezone.utc).isoformat()
    write_new_json(receipt_path, receipt)
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--env-file", type=Path, default=AUDIT.ROOT / "env/.env")
    parser.add_argument("--expected-count", type=int, required=True)
    parser.add_argument("--confirm-collection", required=True)
    parser.add_argument("--place-url", default="http://localhost:8083")
    parser.add_argument("--execute", action="store_true", help="Delete the reviewed, revalidated points after durable backup")
    args = parser.parse_args()
    try:
        report = json.loads(args.report.read_text(encoding="utf-8"))
        config = AUDIT.load_config(args.env_file)
        collection = config.get("QDRANT_PLACE_COLLECTION") or "tripsense_places"
        if collection != args.confirm_collection:
            raise CleanupError("Confirmed collection differs from active configuration")
        qdrant = CleanupClient(config.get("QDRANT_URL", ""), config.get("QDRANT_API_KEY", ""))
        place = CleanupClient(args.place_url)
        candidates = validate_report(report, collection, qdrant.base_url, place.base_url, args.expected_count)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        backup = AUDIT.ROOT / "logs" / f"qdrant-orphan-backup-{stamp}.json"
        receipt_path = AUDIT.ROOT / "logs" / f"qdrant-cleanup-receipt-{stamp}.json"
        receipt = clean(qdrant, place, collection, candidates, backup, receipt_path, args.execute)
        print(f"Deleted and verified: {len(receipt['deletedPointIds'])}")
        print(f"Receipt: {receipt_path}")
        return 0
    except (CleanupError, AUDIT.AuditError, OSError, ValueError):
        print("Cleanup stopped. Review existing backup/receipts and current collection before retrying; no raw credentials or response bodies are printed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
