#!/usr/bin/env python3
"""Summarize bounded Explore diagnostic events from docker compose logs on stdin."""

import argparse
import math
import re
import statistics
import sys
from collections import Counter, defaultdict


def percentile(values, quantile):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * quantile) - 1)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request-id", help="Show ordered events for a single X-Request-ID")
    args = parser.parse_args()
    phases = defaultdict(list)
    requests = defaultdict(list)
    outcomes = defaultdict(int)
    diagnostic_states = Counter()
    events = 0
    started = Counter()
    completed = Counter()
    for line in sys.stdin:
        match = re.search(r"\b(explore_request_started|explore_request_completed|explore_phase|explore_state)\b(.*)", line)
        if not match:
            continue
        event, body = match.groups()
        fields = dict(re.findall(r"([A-Za-z_]+)=([^\s]+)", body))
        service, request_id = fields.get("service"), fields.get("requestId")
        if not service or not request_id:
            continue
        if args.request_id and request_id != args.request_id:
            continue
        events += 1
        if event == "explore_state":
            name = fields.get("name", "")
            if name.startswith(("embedding_", "snapshot_", "semantic_", "place_", "impression_", "observed_", "context_", "feed_", "profile_load_", "request_to_", "seed_", "category_", "eligible_", "returned_", "retrieval_deadline_")):
                diagnostic_states[(service, name, fields.get("value", "?"))] += 1
        if args.request_id:
            # Only print allowlisted diagnostic metadata, never surrounding application logs.
            if event == "explore_phase":
                print(f"{service:24} {fields.get('phase', '?'):28} {fields.get('durationMs', '?'):>8} ms  {fields.get('outcome', '?')}")
            elif event == "explore_state":
                print(f"{service:24} {fields.get('name', '?')}={fields.get('value', '?')}")
            else:
                print(f"{service:24} {event} status={fields.get('status', '-')} durationMs={fields.get('durationMs', '-')}")
        if event == "explore_request_started":
            started[(service, request_id)] += 1
        if event == "explore_request_completed":
            completed[(service, request_id)] += 1
        duration = fields.get("durationMs", "")
        if not duration.isdigit():
            continue
        if event == "explore_phase":
            key = (service, fields.get("phase", "unknown"))
            phases[key].append(int(duration))
            outcomes[(key, fields.get("outcome", "unknown"))] += 1
        elif event == "explore_request_completed":
            requests[service].append(int(duration))
    if not events:
        print("No Explore diagnostic events found. Deploy the instrumented images, open For You, and collect logs from all three services.", file=sys.stderr)
        return 1
    print("\nREQUEST TOTALS (milliseconds; nearest-rank percentiles)")
    print(f"{'Service':24} {'Count':>6} {'p50':>8} {'p95':>8} {'Max':>8}")
    for service, values in sorted(requests.items()):
        print(f"{service:24} {len(values):6} {percentile(values, .5):8} {percentile(values, .95):8} {max(values):8}")
    print("\nPHASES (inclusive timings; parent/child phases overlap, do not sum them)")
    print(f"{'Service / phase':55} {'Count':>6} {'Total':>9} {'Avg':>8} {'p95':>8} {'Errors':>7}")
    for key, values in sorted(phases.items(), key=lambda item: statistics.mean(item[1]), reverse=True):
        print(f"{key[0] + ' / ' + key[1]:55} {len(values):6} {sum(values):9} {statistics.mean(values):8.1f} {percentile(values, .95):8} {outcomes[(key, 'error')]:7}")
    if diagnostic_states:
        print("\nDIAGNOSTIC STATE VALUES (value observed per invocation; Occurrences is not a sum of candidates)")
        print(f"{'Service / field':65} {'Value':>10} {'Occurrences':>12}")
        for (service, name, value), count in sorted(diagnostic_states.items()):
            print(f"{service + ' / ' + name:65} {value:>10} {count:12}")
    pending = sum((started - completed).values())
    if pending:
        print(f"\n{pending} service invocation(s) started without completion in the collected window (in flight, aborted/crashed, or logs truncated).")
    print("\nTotals include error/cancelled requests. Compare matching request IDs and statuses; small-sample p95 is descriptive only.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
