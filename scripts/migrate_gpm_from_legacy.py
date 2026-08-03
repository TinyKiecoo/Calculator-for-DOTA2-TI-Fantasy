#!/usr/bin/env python3
"""One-time GPM backfill from the legacy EWC checkpoint dataset.

The schema-5 dataset used OpenDota's post-match GPM values. Those values have
been verified against the authoritative ``CMsgDOTAMatch.Player.gold_per_min``
records embedded in sample Valve replays. This migration copies only GPM,
matching every row by match ID and account ID, then rebuilds the static browser
artifacts without downloading or parsing any replay.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import build_league
import league_data
import replay_tools


APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LEAGUE_ID = build_league.LEAGUE_ID
DEFAULT_LEGACY_ROOT = (
    APP_ROOT.parent / "Calculator-for-DOTA2-TI-Fantasy" / "data"
)
DEFAULT_CURRENT_ROOT = APP_ROOT / "data"
GPM_SOURCE = (
    "Legacy schema-5 post-match GPM, verified against Valve replay "
    "CMsgDOTAMatch.Player.gold_per_min"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league-id", type=int, default=DEFAULT_LEAGUE_ID)
    parser.add_argument("--legacy-data-root", type=Path, default=DEFAULT_LEGACY_ROOT)
    parser.add_argument("--current-data-root", type=Path, default=DEFAULT_CURRENT_ROOT)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and report the migration without writing files",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"Expected a JSON object: {path}")
    return value


def match_files(directory: Path) -> dict[int, Path]:
    if not directory.is_dir():
        raise RuntimeError(f"Match directory does not exist: {directory}")
    result: dict[int, Path] = {}
    for path in directory.glob("*.json"):
        if path.stem.isdigit():
            result[int(path.stem)] = path
    return result


def players_by_account(match: dict[str, Any], source: Path) -> dict[int, dict[str, Any]]:
    players = match.get("players")
    if not isinstance(players, list) or len(players) != 10:
        raise RuntimeError(f"Expected ten players in {source}")
    result: dict[int, dict[str, Any]] = {}
    for player in players:
        account_id = int(player["accountId"])
        if account_id in result:
            raise RuntimeError(f"Duplicate account {account_id} in {source}")
        result[account_id] = player
    return result


def migrate_checkpoint(
    current: dict[str, Any],
    legacy: dict[str, Any],
    current_path: Path,
    legacy_path: Path,
) -> tuple[int, int]:
    current_match = current.get("match") or {}
    legacy_match = legacy.get("match") or {}
    current_id = int(current_match.get("matchId", -1))
    legacy_id = int(legacy_match.get("matchId", -1))
    if current_id != legacy_id or current_id != int(current_path.stem):
        raise RuntimeError(
            f"Match ID mismatch: {current_path} ({current_id}) / "
            f"{legacy_path} ({legacy_id})"
        )

    current_players = players_by_account(current_match, current_path)
    legacy_players = players_by_account(legacy_match, legacy_path)
    if current_players.keys() != legacy_players.keys():
        missing = sorted(current_players.keys() - legacy_players.keys())
        extra = sorted(legacy_players.keys() - current_players.keys())
        raise RuntimeError(
            f"Player mismatch in match {current_id}: "
            f"missing in legacy={missing}, extra in legacy={extra}"
        )

    changed = 0
    unchanged = 0
    for account_id, player in current_players.items():
        legacy_gpm = (legacy_players[account_id].get("stats") or {}).get("gpm")
        if legacy_gpm is None:
            raise RuntimeError(
                f"Legacy match {current_id}, account {account_id} lacks GPM"
            )
        gpm = int(legacy_gpm)
        if gpm < 0:
            raise RuntimeError(
                f"Legacy match {current_id}, account {account_id} has negative GPM"
            )
        stats = player.setdefault("stats", {})
        if stats.get("gpm") == gpm:
            unchanged += 1
        else:
            changed += 1
        stats["gpm"] = gpm
        player.setdefault("rawReplayStats", {})["postMatchGpm"] = gpm

    current["schemaVersion"] = build_league.CHECKPOINT_SCHEMA_VERSION
    replay = current.setdefault("replay", {})
    replay["gpmSource"] = GPM_SOURCE
    replay["allFantasyStatsFromReplay"] = True
    return changed, unchanged


def rebuild_browser_artifacts(
    league_dir: Path,
    checkpoints: list[dict[str, Any]],
    league_id: int,
) -> None:
    info_path = league_dir / "league.json"
    info = load_json(info_path) if info_path.exists() else {}
    league_name = str(info.get("leagueName") or build_league.LEAGUE_NAME)
    liquipedia_url = info.get("liquipediaUrl") or build_league.LIQUIPEDIA_URL

    overrides = build_league.LEAGUE_TEAM_OVERRIDES.get(league_id, {})
    dataset = league_data.build_dataset(
        [checkpoint["match"] for checkpoint in checkpoints],
        league_id,
        league_name,
        liquipedia_url,
        overrides.get("names"),
        overrides.get("tags"),
        build_league.LEAGUE_ROLE_OVERRIDES.get(league_id),
    )
    dataset["meta"]["fieldProvenance"]["gpm"] = GPM_SOURCE
    dataset["meta"]["gpmBackfill"] = {
        "method": "matchId + accountId",
        "matches": len(checkpoints),
        "sourceSchemaVersion": 5,
    }
    summary = league_data.build_summary(dataset, "full.json")

    replay_tools.atomic_write_json(league_dir / "full.json", dataset)
    replay_tools.atomic_write_json(
        league_dir / "summary.json", summary, compact=True
    )
    payload = json.dumps(summary, ensure_ascii=False, separators=(",", ":"))
    replay_tools.atomic_write_text(
        league_dir / "data.js", "window.FANTASY_DATA=" + payload + ";\n"
    )

    info.update(
        {
            "schemaVersion": build_league.CHECKPOINT_SCHEMA_VERSION,
            "leagueId": league_id,
            "leagueName": league_name,
            "liquipediaUrl": liquipedia_url,
            "generatedAt": build_league.utc_now(),
            "coverage": dataset["meta"]["coverage"],
            "gpmBackfill": dataset["meta"]["gpmBackfill"],
        }
    )
    info.setdefault(
        "files",
        {
            "manifest": "manifest.json",
            "matches": "matches/<MATCH_ID>.json",
            "full": "full.json",
            "summary": "summary.json",
            "browser": "data.js",
        },
    )
    replay_tools.atomic_write_json(info_path, info)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    legacy_dir = args.legacy_data_root.resolve() / str(args.league_id)
    current_dir = args.current_data_root.resolve() / str(args.league_id)
    legacy_files = match_files(legacy_dir / "matches")
    current_files = match_files(current_dir / "matches")
    if not current_files:
        raise RuntimeError(f"No current checkpoints found in {current_dir}")
    if current_files.keys() != legacy_files.keys():
        missing = sorted(current_files.keys() - legacy_files.keys())
        extra = sorted(legacy_files.keys() - current_files.keys())
        raise RuntimeError(
            "Legacy/current match sets differ: "
            f"missing in legacy={missing}, extra in legacy={extra}"
        )

    checkpoints: list[dict[str, Any]] = []
    changed = 0
    unchanged = 0
    for index, match_id in enumerate(sorted(current_files), start=1):
        current = load_json(current_files[match_id])
        legacy = load_json(legacy_files[match_id])
        match_changed, match_unchanged = migrate_checkpoint(
            current,
            legacy,
            current_files[match_id],
            legacy_files[match_id],
        )
        changed += match_changed
        unchanged += match_unchanged
        checkpoints.append(current)
        print(
            f"[{index:03d}/{len(current_files):03d}] match {match_id}: "
            f"changed={match_changed}, unchanged={match_unchanged}"
        )

    build_league.assign_series_ids(checkpoints)
    if args.dry_run:
        print(
            f"Dry run passed: {len(checkpoints)} matches, "
            f"{changed} GPM changed, {unchanged} already correct."
        )
        return 0

    for checkpoint in checkpoints:
        match_id = int(checkpoint["matchId"])
        replay_tools.atomic_write_json(
            current_files[match_id], checkpoint, compact=True
        )
    rebuild_browser_artifacts(current_dir, checkpoints, args.league_id)
    print(
        f"Migration complete: {len(checkpoints)} matches, "
        f"{changed} GPM changed, {unchanged} already correct."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, KeyError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
