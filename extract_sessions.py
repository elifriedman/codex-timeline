#!/usr/bin/env python3
"""Create the JSON data consumed by the Codex session timeline."""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path


def timestamp(value: str | None) -> str | None:
    if not value:
        return None
    # Validate while preserving the original UTC precision.
    datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


def extract(index_path: Path, sessions_dir: Path) -> list[dict[str, str]]:
    names = {}
    for line in index_path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            item = json.loads(line)
            names[item["id"]] = item.get("thread_name") or "Untitled session"

    sessions = []
    for path in sorted(sessions_dir.rglob("*.jsonl")):
        events = []
        with path.open(encoding="utf-8") as stream:
            for line in stream:
                try:
                    event = json.loads(line)
                    if event.get("timestamp"):
                        events.append(event["timestamp"])
                except json.JSONDecodeError:
                    continue
        if not events:
            continue
        events.sort(key=lambda value: datetime.fromisoformat(value.replace("Z", "+00:00")))
        session_id = path.stem.rsplit("-", 5)[-1]
        # The filename contains the UUID, but splitting is brittle for UUIDs;
        # session_meta is the authoritative ID when available.
        with path.open(encoding="utf-8") as stream:
            first = json.loads(next(stream))
        payload = first.get("payload", {})
        session_id = payload.get("id", session_id)
        segments = [[events[0]]]
        for value in events[1:]:
            previous = datetime.fromisoformat(segments[-1][-1].replace("Z", "+00:00"))
            current = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if (current - previous).total_seconds() > 3600:
                segments.append([])
            segments[-1].append(value)
        if segments:
            title = names.get(session_id)
            if title is None:
                parent_id = payload.get("parent_thread_id")
                title = names.get(parent_id, "Unindexed session")
                source = payload.get("source") or {}
                subagent = source.get("subagent") if isinstance(source, dict) else None
                qualifier = None
                if isinstance(subagent, dict):
                    if isinstance(subagent.get("thread_spawn"), dict):
                        spawn = subagent["thread_spawn"]
                        purpose = spawn.get("agent_path") or spawn.get("agent_role")
                        if purpose:
                            qualifier = str(purpose).rstrip("/").rsplit("/", 1)[-1].replace("_", " ")
                    elif subagent.get("other"):
                        qualifier = str(subagent["other"])
                if qualifier:
                    title += f" - subagent {qualifier}"
            for segment_number, segment in enumerate(segments, 1):
                sessions.append({
                    "id": session_id if len(segments) == 1 else f"{session_id}#segment-{segment_number}",
                    "title": title,
                    "start": timestamp(segment[0]),
                    "end": timestamp(segment[-1]),
                })
    return sorted(sessions, key=lambda item: item["start"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, default=Path("~/.codex/session_index.jsonl").expanduser())
    parser.add_argument("--sessions", type=Path, default=Path("~/.codex/sessions").expanduser())
    parser.add_argument("--output", type=Path, default=Path("sessions.json"))
    args = parser.parse_args()
    data = extract(args.index, args.sessions)
    args.output.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(data)} sessions to {args.output}")


if __name__ == "__main__":
    main()
