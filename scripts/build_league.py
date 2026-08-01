#!/usr/bin/env python3
"""Build all static Fantasy data for one Dota 2 league.

Edit ``LEAGUE_ID``, ``LEAGUE_NAME`` and ``LIQUIPEDIA_URL`` below, or override
them with command-line options.  A successful build produces::

    data/<LEAGUE_ID>/league.json
    data/<LEAGUE_ID>/manifest.json
    data/<LEAGUE_ID>/matches/<MATCH_ID>.json
    data/<LEAGUE_ID>/full.json
    data/<LEAGUE_ID>/summary.json
    data/<LEAGUE_ID>/data.js

Each match file is an atomic checkpoint.  On later runs it is validated and
printed, but its replay is neither downloaded nor parsed again.  New replay
downloads live in a temporary directory and are deleted immediately after the
match checkpoint has been written.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import league_data
import replay_tools


# The normal maintenance workflow only requires changing these three values.
# OpenDota's LEAGUE_ID is not the number embedded in a Liquipedia URL; use
# ``python scripts/build_league.py --find-league "event name"`` to look it up.
LEAGUE_ID = 19785
LEAGUE_NAME = "Esports World Cup 2026"
LIQUIPEDIA_URL = "https://liquipedia.net/dota2/Esports_World_Cup/2026"

APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_ROOT = APP_ROOT / "data"

# Optional corrections for stale/reused names in OpenDota's team registry.
LEAGUE_TEAM_OVERRIDES: dict[int, dict[str, dict[int, str]]] = {
    19785: {
        "names": {
            55: "Poor Rangers",
            8255888: "BB Team",
            9256405: "Level UP",
            10019843: "IC x Insanity",
            10136357: "Nigma Galaxy",
        },
        "tags": {
            55: "PR",
            8255888: "BB",
            9256405: "LevelUP",
            10019843: "ICxI",
            10136357: "NGX",
        },
    }
}

EXACT_REPLAY_FIELDS = {
    "madstones_collected": "madstonesCollected",
    "watchers_captured": "watchersCaptured",
    "lotuses_collected": "lotusesCollected",
}


def utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league-id", type=int, default=LEAGUE_ID)
    parser.add_argument("--league-name", default=LEAGUE_NAME)
    parser.add_argument("--liquipedia-url", default=LIQUIPEDIA_URL)
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--expected-matches", type=int)
    parser.add_argument(
        "--find-league",
        metavar="NAME",
        help="Search OpenDota league names, print likely IDs, then exit",
    )
    parser.add_argument(
        "--base-dataset",
        type=Path,
        help="Reuse an existing full JSON instead of querying OpenDota",
    )
    parser.add_argument(
        "--import-replay-stats",
        type=Path,
        help="Import output from the former replay script into match checkpoints",
    )
    parser.add_argument(
        "--tool-cache", type=Path, default=replay_tools.default_tool_cache()
    )
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--parse-timeout", type=int, default=900)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--allow-missing-replay-fields", action="store_true")
    return parser.parse_args()


def request_json(url: str, timeout: int) -> Any:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": replay_tools.USER_AGENT,
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenDota HTTP {exc.code}: {body[:400]}") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not reach OpenDota: {exc}") from exc


def find_leagues(query: str, timeout: int) -> None:
    payload = request_json(f"{replay_tools.OPEN_DOTA_API}/leagues", timeout)
    if not isinstance(payload, list):
        raise RuntimeError("OpenDota /leagues did not return a list")
    needle = query.casefold().strip()
    ranked: list[tuple[float, dict[str, Any]]] = []
    for league in payload:
        name = str(league.get("name") or "")
        folded = name.casefold()
        score = SequenceMatcher(None, needle, folded).ratio()
        if needle in folded:
            score += 1
        ranked.append((score, league))
    print("OpenDota 中最接近的赛事（把 leagueid 填入 LEAGUE_ID）：")
    for _, league in sorted(ranked, key=lambda item: item[0], reverse=True)[:10]:
        print(f"  {league.get('leagueid')}: {league.get('name')}")


def load_base_dataset(args: argparse.Namespace) -> dict[str, Any]:
    if args.base_dataset:
        dataset = json.loads(args.base_dataset.read_text(encoding="utf-8"))
        actual = int(dataset.get("meta", {}).get("leagueId", -1))
        if actual != args.league_id:
            raise RuntimeError(
                f"Base dataset leagueId is {actual}, expected {args.league_id}"
            )
        return dataset

    print(f"正在从 OpenDota 读取联赛 {args.league_id} 的基础比赛数据……")
    rows = league_data.fetch_rows(args.league_id)
    overrides = LEAGUE_TEAM_OVERRIDES.get(args.league_id, {})
    return league_data.build_dataset(
        rows,
        args.league_id,
        args.league_name,
        args.liquipedia_url or None,
        overrides.get("names"),
        overrides.get("tags"),
    )


def enrich_match_players(dataset: dict[str, Any]) -> None:
    """Backfill names in datasets made by the earlier one-off EWC script."""
    names = {
        (int(team["teamId"]), int(player["accountId"])): player["name"]
        for team in dataset["teams"]
        for player in team["players"]
    }
    for match in dataset["matches"]:
        for player in match["players"]:
            player.setdefault(
                "name",
                names.get((int(player["teamId"]), int(player["accountId"]))),
            )


def replay_manifest_from_import(path: Path) -> tuple[list[dict[str, Any]], dict[int, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    matches = payload.get("matches")
    if not isinstance(matches, list):
        raise RuntimeError(f"{path} has no matches array")
    replay_map = {int(match["matchId"]): match for match in matches}
    manifest = [
        {
            "matchId": int(match["matchId"]),
            "startTime": int(match.get("startTime", 0)),
            "duration": int(match.get("duration", 0)),
            "cluster": int(match.get("cluster", 0)),
            "replaySalt": int(match.get("replaySalt", 0)),
            "filename": match.get("replayFile")
            or f"{match['matchId']}_{match.get('replaySalt', 0)}.dem.bz2",
            "replayUrl": match.get("replayUrl"),
        }
        for match in matches
    ]
    manifest.sort(key=lambda item: (item["startTime"], item["matchId"]))
    return manifest, replay_map


def merge_exact_replay(
    base_match: dict[str, Any],
    replay_match: dict[str, Any],
    league_id: int,
) -> dict[str, Any]:
    match = copy.deepcopy(base_match)
    by_account = {
        int(player["accountId"]): player
        for player in replay_match["players"]
        if player.get("accountId") is not None
    }
    by_slot = {
        int(player["playerSlot"]): player for player in replay_match["players"]
    }
    for player in match["players"]:
        exact = by_account.get(int(player["accountId"])) or by_slot.get(
            int(player["playerSlot"])
        )
        if exact is None:
            raise RuntimeError(
                f"Match {match['matchId']}: replay lacks account "
                f"{player['accountId']} / slot {player['playerSlot']}"
            )
        proxies = player.setdefault("proxies", {})
        proxies.setdefault(
            "madstone_bundle_uses", player["stats"].get("madstones_collected")
        )
        proxies.setdefault(
            "watcher_ability_uses", player["stats"].get("watchers_captured")
        )
        for stat_key, replay_key in EXACT_REPLAY_FIELDS.items():
            value = exact.get(replay_key)
            if value is None:
                raise RuntimeError(
                    f"Match {match['matchId']}: {replay_key} is missing for "
                    f"account {player['accountId']}"
                )
            player["stats"][stat_key] = int(value)

    return {
        "schemaVersion": 2,
        "leagueId": league_id,
        "matchId": int(match["matchId"]),
        "parsedAt": utc_now(),
        "replay": {
            "cluster": replay_match.get("cluster"),
            "replaySalt": replay_match.get("replaySalt"),
            "replayUrl": replay_match.get("replayUrl"),
            "parser": "Clarity 4.0.1",
            "exactFields": list(EXACT_REPLAY_FIELDS),
        },
        "match": match,
    }


def validate_checkpoint(
    checkpoint: dict[str, Any], league_id: int, match_id: int
) -> dict[str, Any]:
    if int(checkpoint.get("leagueId", -1)) != league_id:
        raise RuntimeError(f"Checkpoint {match_id} belongs to another league")
    if int(checkpoint.get("matchId", -1)) != match_id:
        raise RuntimeError(f"Checkpoint filename/content mismatch for {match_id}")
    match = checkpoint.get("match")
    if not isinstance(match, dict) or len(match.get("players", [])) != 10:
        raise RuntimeError(f"Checkpoint {match_id} does not contain ten players")
    for player in match["players"]:
        stats = player.get("stats", {})
        missing = [key for key in league_data.STAT_KEYS if key not in stats]
        if missing:
            raise RuntimeError(f"Checkpoint {match_id} lacks stats: {missing}")
        exact_missing = [key for key in EXACT_REPLAY_FIELDS if stats.get(key) is None]
        if exact_missing:
            raise RuntimeError(
                f"Checkpoint {match_id} has empty replay stats: {exact_missing}"
            )
    return match


def echo_match(match: dict[str, Any], status: str) -> None:
    print(f"\n比赛 {match['matchId']} [{status}]")
    for player in match["players"]:
        name = player.get("name") or f"account {player['accountId']}"
        team = (
            match.get("radiantTeamName")
            if int(player["playerSlot"]) < 128
            else match.get("direTeamName")
        )
        stats = "  ".join(
            f"{key}={player['stats'].get(key)}" for key in league_data.STAT_KEYS
        )
        print(
            f"  {name} | {team} | {player.get('role', '?')} | "
            f"accountId={player['accountId']}\n    {stats}"
        )


def parse_downloaded_match(
    item: dict[str, Any], args: argparse.Namespace, java_runtime: tuple[str, str]
) -> dict[str, Any]:
    if not item.get("replayUrl"):
        raise RuntimeError(f"Match {item['matchId']} has no replay URL")
    with tempfile.TemporaryDirectory(prefix=f"dota2-{item['matchId']}-") as work:
        work_dir = Path(work)
        compressed = work_dir / item["filename"]
        dem = work_dir / item["filename"].removesuffix(".bz2")
        replay_tools.download_file(
            [item["replayUrl"]],
            compressed,
            args.timeout,
            args.retries,
            resume=False,
        )
        replay_tools.verify_bz2_header(compressed)
        replay_tools.decompress_replay(compressed, dem, quiet=False)
        players = replay_tools.parse_replay(
            dem,
            java_runtime[0],
            java_runtime[1],
            args.allow_missing_replay_fields,
            timeout=args.parse_timeout,
        )
        return {**item, "players": players}


def recompute_player_totals(dataset: dict[str, Any]) -> None:
    rows: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for match in dataset["matches"]:
        for player in match["players"]:
            rows[(int(player["teamId"]), int(player["accountId"]))].append(
                player["stats"]
            )
    for team in dataset["teams"]:
        for player in team["players"]:
            values = rows[(int(team["teamId"]), int(player["accountId"]))]
            if not values:
                raise RuntimeError(
                    f"No map rows for {team['name']} / {player['name']}"
                )
            player["games"] = len(values)
            for stat_key in league_data.STAT_KEYS:
                stat_values = [row.get(stat_key) for row in values]
                if any(value is None for value in stat_values):
                    total = average = None
                else:
                    total = league_data.normalize_number(
                        sum(float(value) for value in stat_values)
                    )
                    average = league_data.normalize_number(float(total) / len(values))
                player["totals"][stat_key] = total
                player["averages"][stat_key] = average


def finalize_dataset(
    base_dataset: dict[str, Any], checkpoints: list[dict[str, Any]]
) -> dict[str, Any]:
    dataset = copy.deepcopy(base_dataset)
    by_match = {int(item["matchId"]): item["match"] for item in checkpoints}
    missing = {
        int(match["matchId"]) for match in dataset["matches"]
    } - set(by_match)
    if missing:
        raise RuntimeError(f"Missing {len(missing)} match checkpoints")
    dataset["matches"] = [
        by_match[int(match["matchId"])] for match in dataset["matches"]
    ]
    recompute_player_totals(dataset)
    meta = dataset["meta"]
    meta["schemaVersion"] = 2
    meta["generatedAt"] = utc_now()
    meta.setdefault("sources", {})["valveReplays"] = (
        "http://replay{cluster}.valve.net/570/{match_id}_{replay_salt}.dem.bz2"
    )
    provenance = meta.setdefault("fieldProvenance", {})
    provenance.update(
        {
            "madstones_collected": (
                "Valve replay m_vecDataTeam[*].m_nAcquiredMadstone"
            ),
            "watchers_captured": (
                "Valve replay m_vecDataTeam[*].m_iWatchersTaken"
            ),
            "lotuses_collected": (
                "Valve replay m_vecDataTeam[*].m_iLotusesTaken"
            ),
        }
    )
    meta["caveats"] = [
        caveat
        for caveat in meta.get("caveats", [])
        if "lotuses_collected is null" not in caveat
        and "madstones_collected uses OpenDota" not in caveat
        and "healing_lotus" not in caveat
        and "Two stale OpenDota team registry names" not in caveat
        and "No STRATZ data was used" not in caveat
    ]
    meta["replayFantasyStats"] = {
        "parser": "Clarity 4.0.1",
        "matchesMerged": len(checkpoints),
        "exactFields": list(EXACT_REPLAY_FIELDS),
    }
    return dataset


def build(args: argparse.Namespace) -> None:
    league_dir = args.data_root.resolve() / str(args.league_id)
    matches_dir = league_dir / "matches"
    matches_dir.mkdir(parents=True, exist_ok=True)

    base_dataset = load_base_dataset(args)
    enrich_match_players(base_dataset)
    base_matches = {
        int(match["matchId"]): match for match in base_dataset["matches"]
    }
    if args.import_replay_stats:
        manifest, imported = replay_manifest_from_import(args.import_replay_stats)
    else:
        manifest = replay_tools.fetch_manifest(
            args.timeout, args.league_id, args.expected_matches
        )
        imported = {}

    manifest_ids = {int(item["matchId"]) for item in manifest}
    missing_base = manifest_ids - set(base_matches)
    if missing_base:
        raise RuntimeError(
            f"OpenDota base data lacks {len(missing_base)} replay matches: "
            f"{sorted(missing_base)[:5]}"
        )
    replay_tools.atomic_write_json(league_dir / "manifest.json", manifest)

    checkpoints: list[dict[str, Any]] = []
    java_runtime: tuple[str, str] | None = None
    for index, item in enumerate(manifest, start=1):
        match_id = int(item["matchId"])
        checkpoint_path = matches_dir / f"{match_id}.json"
        if checkpoint_path.exists():
            checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
            match = validate_checkpoint(checkpoint, args.league_id, match_id)
            echo_match(match, f"已记录，跳过下载 {index}/{len(manifest)}")
            checkpoints.append(checkpoint)
            continue

        replay_match = imported.get(match_id)
        if replay_match is None:
            if java_runtime is None:
                java_runtime = replay_tools.ensure_java_helper(
                    args.tool_cache, args.timeout, args.retries, quiet=False
                )
            replay_match = parse_downloaded_match(item, args, java_runtime)
        checkpoint = merge_exact_replay(
            base_matches[match_id], replay_match, args.league_id
        )
        replay_tools.atomic_write_json(checkpoint_path, checkpoint, compact=True)
        match = validate_checkpoint(checkpoint, args.league_id, match_id)
        echo_match(match, f"解析完成 {index}/{len(manifest)}")
        checkpoints.append(checkpoint)

    dataset = finalize_dataset(base_dataset, checkpoints)
    summary = league_data.build_summary(dataset, "full.json")
    full_path = league_dir / "full.json"
    summary_path = league_dir / "summary.json"
    browser_path = league_dir / "data.js"
    replay_tools.atomic_write_json(full_path, dataset)
    replay_tools.atomic_write_json(summary_path, summary, compact=True)
    browser_payload = json.dumps(summary, ensure_ascii=False, separators=(",", ":"))
    replay_tools.atomic_write_text(
        browser_path, "window.FANTASY_DATA=" + browser_payload + ";\n"
    )
    league_info = {
        "schemaVersion": 1,
        "leagueId": args.league_id,
        "leagueName": args.league_name,
        "liquipediaUrl": args.liquipedia_url or None,
        "generatedAt": utc_now(),
        "coverage": dataset["meta"]["coverage"],
        "files": {
            "manifest": "manifest.json",
            "matches": "matches/<MATCH_ID>.json",
            "full": "full.json",
            "summary": "summary.json",
            "browser": "data.js",
        },
    }
    replay_tools.atomic_write_json(league_dir / "league.json", league_info)
    print(
        f"\n完成：{args.league_name}（LEAGUE_ID={args.league_id}），"
        f"{len(checkpoints)} 场 -> {league_dir}"
    )


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    try:
        if args.find_league:
            find_leagues(args.find_league, args.timeout)
            return 0
        build(args)
        return 0
    except (
        RuntimeError,
        OSError,
        ValueError,
        TypeError,
        KeyError,
        json.JSONDecodeError,
    ) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
