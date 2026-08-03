#!/usr/bin/env python3
"""Build one league's static Fantasy dataset from Valve replay files.

OpenDota is used only to discover the league's Valve replay links.
Every player statistic, identity, team, result, duration, and title condition in
the generated dataset is read from the corresponding ``.dem`` replay.

Each successful replay becomes an atomic checkpoint in
``data/<LEAGUE_ID>/matches``.  A valid checkpoint is echoed and skipped on the
next run; downloaded ``.dem.bz2`` and decompressed ``.dem`` files live in a
persistent ``replays/<LEAGUE_ID>`` cache and are never deleted automatically.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import league_data
import replay_tools


# One-stop event configuration.
LEAGUE_ID = 19785
LEAGUE_NAME = "Esports World Cup 2026"
LIQUIPEDIA_URL = "https://liquipedia.net/dota2/Esports_World_Cup/2026"

APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_ROOT = APP_ROOT / "data"
DEFAULT_REPLAY_CACHE = APP_ROOT / "replays"

# Optional display corrections, keyed by the tournament team ID stored in the
# replay. They do not affect scores or match membership.
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

# Replay-only farm ranking correctly identifies almost every five-player EWC
# roster. These two mids are the unusual cases; future events can add account
# IDs here without adding a remote role-data dependency.
LEAGUE_ROLE_OVERRIDES: dict[int, dict[int, str]] = {
    19785: {
        898455820: "mid",   # Malr1ne
        312436974: "mid",   # CHIRA_JUNIOR
        106573901: "mid",   # No[o]ne-
    }
}

CHECKPOINT_SCHEMA_VERSION = 7
REPLAY_GPM_SOURCE = "Valve replay CMsgDOTAMatch.Player gold_per_min"
SERIES_MAX_GAMES = {0: 1, 1: 3, 2: 5, 3: 2}


def utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league-id", type=int, default=LEAGUE_ID)
    parser.add_argument("--league-name", default=LEAGUE_NAME)
    parser.add_argument("--liquipedia-url", default=LIQUIPEDIA_URL)
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument(
        "--replay-cache",
        type=Path,
        default=DEFAULT_REPLAY_CACHE,
        help=(
            "Persistent replay root; files are stored under <root>/<LEAGUE_ID> "
            "and are never deleted automatically"
        ),
    )
    parser.add_argument("--expected-matches", type=int)
    parser.add_argument(
        "--find-league",
        metavar="NAME",
        help="Search OpenDota league names, print likely IDs, then exit",
    )
    parser.add_argument(
        "--tool-cache", type=Path, default=replay_tools.default_tool_cache()
    )
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--parse-timeout", type=int, default=900)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--allow-missing-replay-fields", action="store_true")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reparse even valid current-schema match checkpoints",
    )
    return parser.parse_args()


def request_json(url: str, timeout: int) -> Any:
    request = Request(
        url,
        headers={"Accept": "application/json", "User-Agent": replay_tools.USER_AGENT},
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


def replay_series_context(match_data: dict[str, Any]) -> dict[str, int | None]:
    series_type = match_data.get("seriesType")
    radiant_wins = match_data.get("radiantSeriesWins")
    dire_wins = match_data.get("direSeriesWins")
    game_number = None
    if radiant_wins is not None and dire_wins is not None:
        # These replay counters contain wins before the current map.
        game_number = int(radiant_wins) + int(dire_wins) + 1
    return {
        "gameNumber": game_number,
        "maxGames": SERIES_MAX_GAMES.get(series_type),
    }


def build_series_contexts(matches: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    """Compatibility helper for already assembled matches and unit tests."""

    contexts: dict[int, dict[str, Any]] = {}
    grouped: dict[int, list[dict[str, Any]]] = {}
    for match in matches:
        series_id = match.get("seriesId")
        if series_id is not None:
            grouped.setdefault(int(series_id), []).append(match)
    for series_matches in grouped.values():
        series_matches.sort(key=lambda item: (item["startTime"], item["matchId"]))
        for number, match in enumerate(series_matches, start=1):
            contexts[int(match["matchId"])] = {
                "gameNumber": number,
                "maxGames": SERIES_MAX_GAMES.get(match.get("seriesType")),
            }
    for match in matches:
        contexts.setdefault(
            int(match["matchId"]),
            {
                "gameNumber": 1,
                "maxGames": SERIES_MAX_GAMES.get(match.get("seriesType")),
            },
        )
    return contexts


def build_title_conditions(
    match: dict[str, Any],
    title_data: dict[str, Any],
    series_context: dict[str, Any],
) -> dict[str, bool | None]:
    first_blood_time = title_data.get("firstBloodTime")
    max_games = series_context.get("maxGames")
    game_number = series_context.get("gameNumber")
    return {
        "anyPlayerDiedToTormentor": bool(title_data.get("tormentorDeaths")),
        "firstBloodBeforeHorn": (
            float(first_blood_time) < 0 if first_blood_time is not None else None
        ),
        "firstBloodAfterTenMinutes": (
            float(first_blood_time) > 600 if first_blood_time is not None else None
        ),
        "durationUnder25Minutes": int(match["duration"]) < 25 * 60,
        "possibleFinalSeriesGame": (
            int(game_number) == int(max_games)
            if game_number is not None and max_games is not None
            else None
        ),
        "durationEndsInEight": int(match["duration"]) % 10 == 8,
        "anyPlayerDiedInOwnFountain": bool(title_data.get("ownFountainDeaths")),
    }


def checkpoint_from_replay(
    manifest_item: dict[str, Any],
    replay: dict[str, Any],
    league_id: int,
) -> dict[str, Any]:
    match_data = replay.get("matchData")
    if not isinstance(match_data, dict):
        raise RuntimeError(f"Match {manifest_item['matchId']} lacks replay match data")
    replay_league_id = match_data.get("leagueId")
    if replay_league_id not in (None, 0, league_id):
        raise RuntimeError(
            f"Replay leagueId {replay_league_id} does not match {league_id}"
        )
    if match_data.get("duration") is None or match_data.get("radiantWin") is None:
        raise RuntimeError("Replay lacks duration or winner")
    replay_match_id = match_data.get("matchId")
    if replay_match_id is None:
        raise RuntimeError("Replay lacks its internal match ID")
    if int(replay_match_id) != int(manifest_item["matchId"]):
        raise RuntimeError(
            f"Downloaded match {manifest_item['matchId']}, but replay contains "
            f"match ID {replay_match_id}"
        )
    if match_data.get("startTime") is None or match_data.get("endTime") is None:
        raise RuntimeError("Replay lacks its Unix start or end time")

    teams_by_number: dict[int, dict[str, Any]] = {}
    for team in replay.get("teams", []):
        team = copy.deepcopy(team)
        if int(team.get("teamId") or 0) <= 0:
            team["teamId"] = league_data.stable_team_id(
                int(team["teamNumber"]), str(team.get("name") or "")
            )
        teams_by_number[int(team["teamNumber"])] = team
    if set(teams_by_number) != {2, 3}:
        raise RuntimeError("Replay lacks Radiant or Dire team metadata")

    radiant = teams_by_number[2]
    dire = teams_by_number[3]
    players: list[dict[str, Any]] = []
    for exact in replay.get("players", []):
        account_id = exact.get("accountId")
        if account_id is None or not exact.get("name"):
            raise RuntimeError("Replay player lacks account ID or name")
        team = teams_by_number[int(exact["teamNumber"])]
        stats = copy.deepcopy(exact.get("stats"))
        if not isinstance(stats, dict):
            raise RuntimeError(f"Replay player {account_id} lacks stats")
        is_radiant = int(exact["teamNumber"]) == 2
        won = bool(match_data["radiantWin"]) == is_radiant
        players.append(
            {
                "accountId": int(account_id),
                "name": str(exact["name"]),
                "teamId": int(team["teamId"]),
                "playerSlot": int(exact["playerSlot"]),
                "heroId": int(exact["heroId"]),
                "heroName": str(exact["heroName"]),
                "stats": stats,
                "rawReplayStats": copy.deepcopy(exact.get("rawStats") or {}),
                "replayCounters": {
                    "acquiredMadstones": exact.get("madstonesCollected"),
                    "currentMadstones": exact.get("currentMadstones"),
                    "neutralTokensFound": exact.get("neutralTokensFound"),
                },
                "won": won,
                "lost": not won,
            }
        )
    players.sort(key=lambda player: player["playerSlot"])

    series_context = replay_series_context(match_data)
    title_data = {
        key: copy.deepcopy(match_data.get(key))
        for key in (
            "gameStartTime",
            "gameEndTime",
            "firstBloodTime",
            "seriesType",
            "radiantSeriesWins",
            "direSeriesWins",
            "fountainRadius",
            "tormentorDeaths",
            "fountainDeaths",
            "ownFountainDeaths",
        )
    }
    title_data["seriesGameNumber"] = series_context["gameNumber"]
    title_data["maxSeriesGames"] = series_context["maxGames"]
    match = {
        "matchId": int(replay_match_id),
        "seriesId": None,
        "seriesType": match_data.get("seriesType"),
        "startTime": int(match_data["startTime"]),
        "endTime": int(match_data["endTime"]),
        "duration": int(match_data["duration"]),
        "radiantTeamId": int(radiant["teamId"]),
        "direTeamId": int(dire["teamId"]),
        "radiantTeamName": str(radiant["name"]),
        "direTeamName": str(dire["name"]),
        "radiantTeamTag": str(radiant.get("tag") or ""),
        "direTeamTag": str(dire.get("tag") or ""),
        "radiantWin": bool(match_data["radiantWin"]),
        "lobbyGameName": match_data.get("lobbyGameName"),
        "players": players,
        "titleData": title_data,
    }
    match["titleConditions"] = build_title_conditions(
        match, title_data, series_context
    )
    return {
        "schemaVersion": CHECKPOINT_SCHEMA_VERSION,
        "leagueId": league_id,
        "matchId": int(match["matchId"]),
        "parsedAt": utc_now(),
        "replay": {
            "cluster": manifest_item.get("cluster"),
            "replaySalt": manifest_item.get("replaySalt"),
            "replayUrl": manifest_item.get("replayUrl"),
            "parser": "Clarity 4.0.1",
            "outputEncoding": "UTF-8",
            "gpmSource": REPLAY_GPM_SOURCE,
            "exactFields": list(league_data.STAT_KEYS),
            "allFantasyStatsFromReplay": True,
        },
        "match": match,
    }


def validate_checkpoint(
    checkpoint: dict[str, Any], league_id: int, match_id: int
) -> dict[str, Any]:
    if int(checkpoint.get("schemaVersion", -1)) != CHECKPOINT_SCHEMA_VERSION:
        raise RuntimeError(
            f"Checkpoint {match_id} uses an older schema and must be reparsed"
        )
    if int(checkpoint.get("leagueId", -1)) != league_id:
        raise RuntimeError(f"Checkpoint {match_id} belongs to another league")
    if int(checkpoint.get("matchId", -1)) != match_id:
        raise RuntimeError(f"Checkpoint filename/content mismatch for {match_id}")
    match = checkpoint.get("match")
    if not isinstance(match, dict) or len(match.get("players", [])) != 10:
        raise RuntimeError(f"Checkpoint {match_id} does not contain ten players")
    replay_meta = checkpoint.get("replay") or {}
    if not replay_meta.get("gpmSource"):
        raise RuntimeError(f"Checkpoint {match_id} lacks authoritative GPM source")
    if replay_meta.get("outputEncoding") != "UTF-8" and any(
        "?" in str(player.get("name") or "") or "�" in str(player.get("name") or "")
        for player in match["players"]
    ):
        raise RuntimeError(
            f"Checkpoint {match_id} may contain a player name damaged by the "
            "old Java output encoding"
        )
    for field in (
        "startTime", "endTime", "duration", "radiantTeamId", "direTeamId", "radiantTeamName",
        "direTeamName", "radiantWin", "titleData", "titleConditions",
    ):
        if match.get(field) is None:
            raise RuntimeError(f"Checkpoint {match_id} lacks {field}")
    for player in match["players"]:
        if player.get("accountId") is None or not player.get("name"):
            raise RuntimeError(f"Checkpoint {match_id} lacks player identity")
        if player.get("heroId") is None or not player.get("heroName"):
            raise RuntimeError(f"Checkpoint {match_id} lacks player hero data")
        if "lost" not in player:
            raise RuntimeError(f"Checkpoint {match_id} lacks player result data")
        stats = player.get("stats", {})
        missing = [
            key for key in league_data.STAT_KEYS if stats.get(key) is None
        ]
        if missing:
            raise RuntimeError(
                f"Checkpoint {match_id} player {player.get('accountId')} "
                f"lacks replay stats: {missing}"
            )
    return match


def has_damaged_player_name(name: Any) -> bool:
    text = str(name or "")
    return "?" in text or "�" in text


def remember_player_names(
    match: dict[str, Any], known_names: dict[int, str]
) -> None:
    for player in match.get("players", []):
        name = str(player.get("name") or "")
        if name and not has_damaged_player_name(name):
            known_names[int(player["accountId"])] = name


def repair_legacy_player_names(
    checkpoint: dict[str, Any], known_names: dict[int, str]
) -> bool:
    """Repair old code-page damage once an account's UTF-8 name is known."""

    replay_meta = checkpoint.get("replay") or {}
    if replay_meta.get("outputEncoding") == "UTF-8":
        return False
    match = checkpoint.get("match") or {}
    damaged = [
        player
        for player in match.get("players", [])
        if has_damaged_player_name(player.get("name"))
    ]
    if not damaged:
        return False
    if any(int(player["accountId"]) not in known_names for player in damaged):
        return False
    for player in damaged:
        player["name"] = known_names[int(player["accountId"])]
    checkpoint.setdefault("replay", {})["outputEncoding"] = "UTF-8"
    return True


def assign_series_ids(checkpoints: list[dict[str, Any]]) -> None:
    """Assign a replay-derived stable series ID (the first map's match ID)."""

    active: dict[tuple[int, int], int] = {}
    ordered = sorted(
        checkpoints,
        key=lambda checkpoint: (
            checkpoint["match"]["startTime"], checkpoint["matchId"]
        ),
    )
    for checkpoint in ordered:
        match = checkpoint["match"]
        pair = tuple(sorted((int(match["radiantTeamId"]), int(match["direTeamId"]))))
        title = match.get("titleData") or {}
        game_number = title.get("seriesGameNumber")
        max_games = title.get("maxSeriesGames")
        if game_number in (None, 1) or pair not in active:
            active[pair] = int(match["matchId"])
        match["seriesId"] = active[pair]
        if max_games is not None and game_number == max_games:
            active.pop(pair, None)


def echo_match(match: dict[str, Any], status: str) -> None:
    print(f"\n比赛 {match['matchId']} [{status}]")
    for player in match["players"]:
        team = (
            match["radiantTeamName"]
            if int(player["playerSlot"]) < 128
            else match["direTeamName"]
        )
        stats = "  ".join(
            f"{key}={player['stats'].get(key)}" for key in league_data.STAT_KEYS
        )
        print(
            f"  {player['name']} | {team} | hero={player['heroName']} "
            f"({player['heroId']}) | accountId={player['accountId']}\n    {stats}"
        )
        counters = player.get("replayCounters", {})
        print(
            "    replayCounters: "
            f"acquiredMadstones={counters.get('acquiredMadstones')}  "
            f"currentMadstones={counters.get('currentMadstones')}  "
            f"neutralTokensFound={counters.get('neutralTokensFound')}"
        )
    print(
        "  称号条件: "
        + json.dumps(match.get("titleConditions"), ensure_ascii=False)
    )


def parse_downloaded_match(
    item: dict[str, Any], args: argparse.Namespace, java_runtime: tuple[str, str]
) -> dict[str, Any]:
    if not item.get("replayUrl"):
        raise RuntimeError(f"Match {item['matchId']} has no replay URL")

    cache_dir = args.replay_cache.resolve() / str(args.league_id)
    cache_dir.mkdir(parents=True, exist_ok=True)
    compressed = cache_dir / item["filename"]
    dem = cache_dir / item["filename"].removesuffix(".bz2")

    if dem.exists():
        replay_tools.verify_dem_header(dem)
        print(f"Using cached replay: {dem}")
    else:
        if compressed.exists():
            replay_tools.verify_bz2_header(compressed)
            print(f"Using cached download: {compressed}")
        else:
            replay_tools.download_file(
                [item["replayUrl"]],
                compressed,
                args.timeout,
                args.retries,
                resume=False,
            )
        replay_tools.verify_bz2_header(compressed)
        replay_tools.decompress_replay(compressed, dem, quiet=False)

    return replay_tools.parse_replay(
        dem,
        java_runtime[0],
        java_runtime[1],
        args.allow_missing_replay_fields,
        timeout=args.parse_timeout,
    )


def build(args: argparse.Namespace) -> None:
    league_dir = args.data_root.resolve() / str(args.league_id)
    matches_dir = league_dir / "matches"
    matches_dir.mkdir(parents=True, exist_ok=True)

    manifest = replay_tools.fetch_manifest(
        args.timeout, args.league_id, args.expected_matches
    )
    replay_tools.atomic_write_json(league_dir / "manifest.json", manifest)

    checkpoints: list[dict[str, Any]] = []
    known_player_names: dict[int, str] = {}
    java_runtime: tuple[str, str] | None = None
    for index, item in enumerate(manifest, start=1):
        match_id = int(item["matchId"])
        checkpoint_path = matches_dir / f"{match_id}.json"
        if checkpoint_path.exists() and not args.force:
            checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
            repaired_name = repair_legacy_player_names(
                checkpoint, known_player_names
            )
            try:
                match = validate_checkpoint(checkpoint, args.league_id, match_id)
            except RuntimeError as exc:
                print(f"比赛 {match_id} 的旧检查点将重新解析：{exc}")
            else:
                if repaired_name:
                    replay_tools.atomic_write_json(
                        checkpoint_path, checkpoint, compact=True
                    )
                remember_player_names(match, known_player_names)
                status = (
                    "已修复旧昵称，跳过下载"
                    if repaired_name
                    else "已记录，跳过下载"
                )
                echo_match(match, f"{status} {index}/{len(manifest)}")
                checkpoints.append(checkpoint)
                continue

        if java_runtime is None:
            java_runtime = replay_tools.ensure_java_helper(
                args.tool_cache, args.timeout, args.retries, quiet=False
            )
        replay = parse_downloaded_match(item, args, java_runtime)
        checkpoint = checkpoint_from_replay(item, replay, args.league_id)
        replay_tools.atomic_write_json(checkpoint_path, checkpoint, compact=True)
        match = validate_checkpoint(checkpoint, args.league_id, match_id)
        remember_player_names(match, known_player_names)
        echo_match(match, f"解析完成 {index}/{len(manifest)}")
        checkpoints.append(checkpoint)

    assign_series_ids(checkpoints)
    for checkpoint in checkpoints:
        checkpoint_path = matches_dir / f"{checkpoint['matchId']}.json"
        replay_tools.atomic_write_json(checkpoint_path, checkpoint, compact=True)

    overrides = LEAGUE_TEAM_OVERRIDES.get(args.league_id, {})
    dataset = league_data.build_dataset(
        [checkpoint["match"] for checkpoint in checkpoints],
        args.league_id,
        args.league_name,
        args.liquipedia_url or None,
        overrides.get("names"),
        overrides.get("tags"),
        LEAGUE_ROLE_OVERRIDES.get(args.league_id),
    )
    summary = league_data.build_summary(dataset, "full.json")
    full_path = league_dir / "full.json"
    summary_path = league_dir / "summary.json"
    browser_path = league_dir / "data.js"
    replay_tools.atomic_write_json(full_path, dataset)
    replay_tools.atomic_write_json(summary_path, summary, compact=True)
    payload = json.dumps(summary, ensure_ascii=False, separators=(",", ":"))
    replay_tools.atomic_write_text(
        browser_path, "window.FANTASY_DATA=" + payload + ";\n"
    )
    league_info = {
        "schemaVersion": CHECKPOINT_SCHEMA_VERSION,
        "leagueId": args.league_id,
        "leagueName": args.league_name,
        "liquipediaUrl": args.liquipedia_url or None,
        "generatedAt": utc_now(),
        "replayCache": str(
            args.replay_cache.resolve() / str(args.league_id)
        ),
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
    print(
        "录像缓存保留于："
        f"{args.replay_cache.resolve() / str(args.league_id)}"
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
