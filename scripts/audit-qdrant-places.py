#!/usr/bin/env python3
"""Read-only audit of Qdrant payload.placeId against Place Service batch snapshots."""

import argparse
import json
import os
from pathlib import Path
import re
import shlex
import sys
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


ROOT = Path(__file__).resolve().parent.parent
ENV_KEYS = {"QDRANT_URL", "QDRANT_API_KEY", "QDRANT_PLACE_COLLECTION", "PLACE_SERVICE_URL"}


class AuditError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never send a configured API key to a redirected host.
        return None


def load_config(path):
    config = {}
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[7:].strip()
            name, separator, value = line.partition("=")
            name = name.strip()
            if not separator or name not in ENV_KEYS:
                continue
            try:
                parts = shlex.split(value.strip(), comments=True)
            except ValueError:
                raise AuditError(f"Invalid quoting for {name} in env file") from None
            if len(parts) > 1:
                raise AuditError(f"Quote the value for {name} in env file")
            config[name] = parts[0] if parts else ""
    # Read values only; do not source/execute env files or expand shell expressions.
    for name in ENV_KEYS:
        if name in os.environ:
            config[name] = os.environ[name]
    return config


def checked_url(value):
    try:
        parsed = urlsplit(value)
        _ = parsed.port
    except ValueError:
        raise AuditError("Invalid service URL") from None
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or "${" in value or "$(" in value):
        raise AuditError("Service URLs must be absolute HTTP(S) URLs without credentials/query/fragment")
    return value.rstrip("/")


class JsonClient:
    def __init__(self, base_url, api_key="", timeout=20):
        self.base_url = checked_url(base_url)
        self.api_key = api_key
        self.timeout = timeout
        if api_key and urlsplit(self.base_url).scheme != "https" and urlsplit(self.base_url).hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise AuditError("Use HTTPS for a remote Qdrant endpoint with an API key")
        self.opener = build_opener(NoRedirect())

    def post(self, path, body):
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["api-key"] = self.api_key
        request = Request(self.base_url + path, data=json.dumps(body).encode(), headers=headers, method="POST")
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                return json.load(response)
        except HTTPError as error:
            raise AuditError(f"Audit read failed with HTTP {error.code}; no data was deleted") from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise AuditError("Audit read failed (connection, timeout or invalid JSON); no data was deleted") from None


def scroll_points(qdrant, collection, progress):
    points = []
    seen_ids = set()
    seen_offsets = set()
    offset = None
    while True:
        body = {"limit": 100, "with_payload": ["placeId"], "with_vector": False}
        if offset is not None:
            body["offset"] = offset
        response = qdrant.post(f"/collections/{quote(collection, safe='')}/points/scroll", body)
        if not isinstance(response, dict) or response.get("status") != "ok":
            raise AuditError("Qdrant did not return a successful scroll response")
        result = response.get("result")
        if not isinstance(result, dict) or not isinstance(result.get("points"), list):
            raise AuditError("Invalid Qdrant scroll structure")
        for point in result["points"]:
            if not isinstance(point, dict) or not isinstance(point.get("id"), (str, int)) or isinstance(point.get("id"), bool):
                raise AuditError("Qdrant returned an invalid point identifier")
            point_id = point["id"]
            if str(point_id) in seen_ids:
                raise AuditError("Duplicate points while scrolling; retry audit after indexing settles")
            seen_ids.add(str(point_id))
            payload = point.get("payload")
            place_id = payload.get("placeId") if isinstance(payload, dict) else None
            points.append({"pointId": point_id, "placeId": place_id if isinstance(place_id, str) and place_id.strip() else None})
        progress(f"Qdrant: scanned {len(points)} points")
        offset = result.get("next_page_offset")
        if offset is None:
            break
        if not isinstance(offset, (str, int)) or isinstance(offset, bool) or str(offset) in seen_offsets:
            raise AuditError("Invalid/repeated Qdrant scroll offset")
        seen_offsets.add(str(offset))
    return points


def existing_place_ids(place, ids, progress):
    found = set()
    for start in range(0, len(ids), 100):
        batch = ids[start:start + 100]
        response = place.post("/api/places/batch-snapshots", batch)
        if not isinstance(response, dict) or response.get("success") is not True or not isinstance(response.get("data"), list):
            raise AuditError("Place lookup failed or returned an invalid envelope; audit stopped")
        for snapshot in response["data"]:
            if not isinstance(snapshot, dict) or not isinstance(snapshot.get("id"), str) or not snapshot["id"].strip():
                raise AuditError("Place returned an invalid snapshot; audit stopped")
            # Respect the existing canonical-ID/provider-ID alias contract.
            for key in ("id", "providerPlaceId"):
                value = snapshot.get(key)
                if isinstance(value, str) and value in batch:
                    found.add(value)
        progress(f"Place: checked {min(start + 100, len(ids))}/{len(ids)} unique IDs")
    return found


def audit(qdrant, place, collection, progress=print):
    points = scroll_points(qdrant, collection, progress)
    ids = sorted({point["placeId"] for point in points if point["placeId"] is not None})
    existing = existing_place_ids(place, ids, progress)
    missing = sorted(set(ids) - existing)
    # Recheck absence to reduce the chance of flagging a concurrently ingested place.
    if missing:
        progress(f"Rechecking {len(missing)} absent IDs")
        existing.update(existing_place_ids(place, missing, progress))
    orphaned = [p for p in points if p["placeId"] is not None and p["placeId"] not in existing]
    invalid = [p for p in points if p["placeId"] is None]
    return {
        "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "readOnly": True,
        "collection": collection,
        "summary": {
            "qdrantPoints": len(points),
            "uniqueReferencedPlaceIds": len(ids),
            "validPoints": len(points) - len(orphaned) - len(invalid),
            "orphanedPoints": len(orphaned),
            "invalidPayloadPoints": len(invalid),
        },
        "orphanedPoints": orphaned,
        "invalidPayloadPoints": invalid,
        "note": "Candidates for manual review only. No points deleted. Revalidate against the same live sources before any deletion.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / "env/.env")
    parser.add_argument("--qdrant-url", help="Overrides QDRANT_URL; never put API keys in this argument")
    parser.add_argument("--place-url", help="Overrides PLACE_SERVICE_URL; local default http://localhost:8083")
    parser.add_argument("--collection", help="Overrides QDRANT_PLACE_COLLECTION")
    parser.add_argument("--output", type=Path, help="New JSON report file; existing files are never overwritten")
    args = parser.parse_args()
    try:
        config = load_config(args.env_file)
        collection = args.collection or config.get("QDRANT_PLACE_COLLECTION") or "tripsense_places"
        if not re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", collection):
            raise AuditError("Invalid collection name")
        qdrant_url = args.qdrant_url or config.get("QDRANT_URL")
        if not qdrant_url:
            raise AuditError("QDRANT_URL is missing; use the same env file as recommendation-service")
        place_url = args.place_url or config.get("PLACE_SERVICE_URL") or "http://localhost:8083"
        qdrant = JsonClient(qdrant_url, config.get("QDRANT_API_KEY", ""))
        place = JsonClient(place_url)
        print(f"READ-ONLY audit of collection {collection}; vectors and payloads will not be modified")
        report = audit(qdrant, place, collection)
        report["sources"] = {"qdrant": qdrant.base_url, "place": place.base_url}
        output = args.output or ROOT / "logs" / ("qdrant-place-audit-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json")
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
        for name, count in report["summary"].items():
            print(f"{name}: {count}")
        print(f"Report: {output}")
        print("No points deleted. Review orphanedPoints before deciding on cleanup.")
        return 0
    except (AuditError, OSError) as error:
        # Do not print raw network response bodies, URLs, headers, env values or credentials.
        print(str(error) if isinstance(error, AuditError) else "Could not create the audit report (check path/permissions or existing file)", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
