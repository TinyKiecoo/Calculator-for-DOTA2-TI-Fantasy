#!/usr/bin/env python3
"""Build a Dota 2 league fantasy-stat dataset from OpenDota.

The OpenDota SQL Explorer lets us fetch every parsed player row for a league in
one request.  This avoids making one request per match and makes the
result reproducible without an API key.

This module contains the OpenDota-facing part of ``build_league.py``.  It can
also be run directly for a base (pre-replay) dataset.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_LEAGUE_ID = 19785
DEFAULT_LEAGUE_NAME = "Esports World Cup 2026"
EXPLORER_URL = "https://api.opendota.com/api/explorer"
USER_AGENT = "DotaFantasyLeagueBuilder/2.0 (local dataset builder)"

STAT_KEYS = (
    "kills",
    "deaths",
    "creep_score",
    "gpm",
    "madstones_collected",
    "towers_destroyed",
    "observer_wards_placed",
    "camps_stacked",
    "runes_picked_up",
    "watchers_captured",
    "smokes_used",
    "lotuses_collected",
    "roshans_killed",
    "teamfight_participation",
    "stun_seconds",
    "tormentors_killed",
    "first_blood",
    "couriers_killed",
)

SQL_TEMPLATE = """
SELECT
    m.match_id,
    m.start_time,
    m.duration,
    m.series_id,
    m.series_type,
    m.radiant_team_id,
    m.dire_team_id,
    m.radiant_win,
    m.version,
    CASE
        WHEN pm.player_slot < 128 THEN m.radiant_team_id
        ELSE m.dire_team_id
    END AS team_id,
    t.name AS team_name,
    t.tag AS team_tag,
    t.logo_url AS team_logo_url,
    np.name AS player_name,
    np.fantasy_role AS source_fantasy_role,
    pm.account_id,
    pm.player_slot,
    pm.hero_id,
    pm.lane_role,
    pm.is_roaming,
    COALESCE(pm.kills, 0) AS kills,
    COALESCE(pm.deaths, 0) AS deaths,
    COALESCE(pm.last_hits, 0) AS last_hits,
    COALESCE(pm.denies, 0) AS denies,
    COALESCE(pm.gold_per_min, 0) AS gold_per_min,
    COALESCE((pm.item_uses ->> 'madstone_bundle')::integer, 0)
        AS madstones_collected,
    COALESCE(pm.towers_killed, 0) AS towers_destroyed,
    COALESCE(pm.obs_placed, 0) AS observer_wards_placed,
    COALESCE(pm.camps_stacked, 0) AS camps_stacked,
    COALESCE(pm.rune_pickups, 0) AS runes_picked_up,
    COALESCE((pm.ability_uses ->> 'ability_lamp_use')::integer, 0)
        AS watchers_captured,
    COALESCE((pm.item_uses ->> 'smoke_of_deceit')::integer, 0)
        AS smokes_used,
    COALESCE((pm.item_uses ->> 'famango')::integer, 0)
        AS healing_lotus_used,
    COALESCE((pm.item_uses ->> 'great_famango')::integer, 0)
        AS great_healing_lotus_used,
    COALESCE((pm.item_uses ->> 'greater_famango')::integer, 0)
        AS greater_healing_lotus_used,
    COALESCE(pm.roshans_killed, 0) AS roshans_killed,
    COALESCE(pm.teamfight_participation, 0) AS teamfight_participation,
    COALESCE(pm.stuns, 0) AS stun_seconds,
    COALESCE((pm.killed ->> 'npc_dota_miniboss')::integer, 0)
        AS tormentors_killed,
    COALESCE(pm.firstblood_claimed, 0) AS first_blood,
    COALESCE((pm.killed ->> 'npc_dota_courier')::integer, 0)
        AS couriers_killed
FROM matches AS m
JOIN player_matches AS pm USING (match_id)
JOIN notable_players AS np USING (account_id)
LEFT JOIN teams AS t
    ON t.team_id = CASE
        WHEN pm.player_slot < 128 THEN m.radiant_team_id
        ELSE m.dire_team_id
    END
WHERE m.leagueid = {league_id}
ORDER BY m.start_time, m.match_id, pm.player_slot
"""


def build_sql(league_id: int) -> str:
    return SQL_TEMPLATE.format(league_id=int(league_id))


def parse_args() -> argparse.Namespace:
    data_directory = Path(__file__).resolve().parents[1] / "data"
    default_directory = data_directory / str(DEFAULT_LEAGUE_ID)
    default_output = default_directory / "full.json"
    default_summary_output = default_directory / "summary.json"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league-id", type=int, default=DEFAULT_LEAGUE_ID)
    parser.add_argument("--league-name", default=DEFAULT_LEAGUE_NAME)
    parser.add_argument("--liquipedia-url")
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output,
        help=f"Output JSON path (default: {default_output})",
    )
    parser.add_argument(
        "--summary-output",
        type=Path,
        default=default_summary_output,
        help=(
            "App-optimized summary JSON path "
            f"(default: {default_summary_output})"
        ),
    )
    return parser.parse_args()


def fetch_rows(league_id: int) -> list[dict[str, Any]]:
    compact_sql = " ".join(build_sql(league_id).split())
    url = f"{EXPLORER_URL}?{urlencode({'sql': compact_sql})}"
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urlopen(request, timeout=90) as response:
            payload = json.load(response)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenDota returned HTTP {exc.code}: {body[:500]}") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not reach OpenDota: {exc}") from exc

    if payload.get("err"):
        raise RuntimeError(f"OpenDota Explorer error: {payload['err']}")

    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise RuntimeError("OpenDota Explorer response did not contain a rows array")
    return rows


def as_int(value: Any) -> int:
    if value is None:
        return 0
    return int(value)


def as_float(value: Any) -> float:
    if value is None:
        return 0.0
    number = float(value)
    if not math.isfinite(number):
        return 0.0
    return number


def normalize_number(value: float, digits: int = 6) -> int | float:
    rounded = round(value, digits)
    if rounded == int(rounded):
        return int(rounded)
    return rounded


def iso_utc(epoch_seconds: int) -> str:
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat().replace(
        "+00:00", "Z"
    )


def stats_from_row(row: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    healing_lotus_used = as_int(row["healing_lotus_used"])
    great_healing_lotus_used = as_int(row["great_healing_lotus_used"])
    greater_healing_lotus_used = as_int(row["greater_healing_lotus_used"])

    stats = {
        "kills": as_int(row["kills"]),
        "deaths": as_int(row["deaths"]),
        "creep_score": as_int(row["last_hits"]) + as_int(row["denies"]),
        "gpm": as_int(row["gold_per_min"]),
        "madstones_collected": as_int(row["madstones_collected"]),
        "towers_destroyed": as_int(row["towers_destroyed"]),
        "observer_wards_placed": as_int(row["observer_wards_placed"]),
        "camps_stacked": as_int(row["camps_stacked"]),
        "runes_picked_up": as_int(row["runes_picked_up"]),
        "watchers_captured": as_int(row["watchers_captured"]),
        "smokes_used": as_int(row["smokes_used"]),
        # OpenDota does not expose the current client fantasy stat for lotus
        # collection. Keep the official field unknown rather than silently
        # turning missing data into a zero.
        "lotuses_collected": None,
        "roshans_killed": as_int(row["roshans_killed"]),
        "teamfight_participation": normalize_number(
            min(1.0, max(0.0, as_float(row["teamfight_participation"])))
        ),
        # One source row (match 8885614030, shiro) currently contains
        # -0.58352 stun seconds, which is physically impossible and would
        # subtract fantasy points. Clamp replay-parser noise to zero.
        "stun_seconds": normalize_number(
            max(0.0, as_float(row["stun_seconds"]))
        ),
        "tormentors_killed": as_int(row["tormentors_killed"]),
        "first_blood": as_int(row["first_blood"]),
        "couriers_killed": as_int(row["couriers_killed"]),
    }

    proxies = {
        "healing_lotus_items_used": (
            healing_lotus_used
            + great_healing_lotus_used
            + greater_healing_lotus_used
        ),
        # Great and Greater Healing Lotuses represent three and nine base
        # lotuses respectively. This measures consumption, not collection.
        "healing_lotus_base_equivalent_used": (
            healing_lotus_used
            + (3 * great_healing_lotus_used)
            + (9 * greater_healing_lotus_used)
        ),
    }
    return stats, proxies


def infer_roles(
    player_accumulators: dict[tuple[int, int], dict[str, Any]]
) -> dict[tuple[int, int], dict[str, Any]]:
    """Infer core/mid/support while allowing substitutes and roster changes.

    A five-player roster uses the strongest event-local evidence: the highest
    mid-lane rate is mid, then the two least-farmed players are supports.  For
    larger rosters, OpenDota's fantasy role is preferred and lane/farm evidence
    fills gaps.  Role evidence is kept in the output so unusual rosters can be
    reviewed without blocking the data build.
    """

    by_team: dict[int, list[tuple[tuple[int, int], dict[str, Any]]]] = defaultdict(
        list
    )
    for player_key, accumulator in player_accumulators.items():
        by_team[player_key[0]].append((player_key, accumulator))

    role_map: dict[tuple[int, int], dict[str, Any]] = {}
    for team_id, players in by_team.items():
        def mid_sort_key(item: tuple[tuple[int, int], dict[str, Any]]) -> tuple[float, float]:
            accumulator = item[1]
            games = accumulator["games"]
            return (
                accumulator["mid_lane_games"] / games,
                accumulator["totals"]["gpm"] / games,
            )

        explicit_roles: dict[tuple[int, int], str] = {}
        if len(players) == 5:
            mid_key, mid_accumulator = max(players, key=mid_sort_key)
            non_mid = [item for item in players if item[0] != mid_key]
            non_mid.sort(
                key=lambda item: (
                    item[1]["totals"]["creep_score"] / item[1]["games"],
                    item[1]["totals"]["gpm"] / item[1]["games"],
                )
            )
            support_keys = {item[0] for item in non_mid[:2]}
            core_keys = {item[0] for item in non_mid[2:]}
            highest_support_cs = max(
                player_accumulators[key]["totals"]["creep_score"]
                / player_accumulators[key]["games"]
                for key in support_keys
            )
            lowest_core_cs = min(
                player_accumulators[key]["totals"]["creep_score"]
                / player_accumulators[key]["games"]
                for key in core_keys
            )
            mid_lane_rate = mid_accumulator["mid_lane_games"] / mid_accumulator["games"]
            confidence = (
                "high"
                if mid_lane_rate >= 0.8 and lowest_core_cs - highest_support_cs >= 50
                else "medium"
            )
            explicit_roles[mid_key] = "mid"
            explicit_roles.update({key: "support" for key in support_keys})
            explicit_roles.update({key: "core" for key in core_keys})
        else:
            confidence = "medium"
            for player_key, accumulator in players:
                games = accumulator["games"]
                mid_rate = accumulator["mid_lane_games"] / games
                source_role = accumulator["source_fantasy_role"]
                average_cs = accumulator["totals"]["creep_score"] / games
                average_gpm = accumulator["totals"]["gpm"] / games
                if source_role == 4 or mid_rate >= 0.55:
                    role = "mid"
                elif source_role == 2:
                    role = "support"
                elif source_role == 1:
                    role = "core"
                elif average_cs < 120 or average_gpm < 350:
                    role = "support"
                else:
                    role = "core"
                explicit_roles[player_key] = role

            if "mid" not in explicit_roles.values():
                explicit_roles[max(players, key=mid_sort_key)[0]] = "mid"

        for player_key, accumulator in players:
            role = explicit_roles[player_key]

            games = accumulator["games"]
            role_map[player_key] = {
                "role": role,
                "confidence": confidence,
                "evidence": {
                    "midLaneRate": normalize_number(
                        accumulator["mid_lane_games"] / games, 4
                    ),
                    "averageCreepScore": normalize_number(
                        accumulator["totals"]["creep_score"] / games, 4
                    ),
                    "averageGpm": normalize_number(
                        accumulator["totals"]["gpm"] / games, 4
                    ),
                    "sourceFantasyRole": accumulator["source_fantasy_role"],
                },
            }
    return role_map


def build_dataset(
    rows: list[dict[str, Any]],
    league_id: int,
    league_name: str,
    liquipedia_url: str | None = None,
    team_name_overrides: dict[int, str] | None = None,
    team_tag_overrides: dict[int, str] | None = None,
) -> dict[str, Any]:
    if not rows:
        raise RuntimeError(f"OpenDota returned no rows for league {league_id}")

    team_name_overrides = team_name_overrides or {}
    team_tag_overrides = team_tag_overrides or {}

    matches: dict[int, dict[str, Any]] = {}
    teams: dict[int, dict[str, Any]] = {}
    players: dict[tuple[int, int], dict[str, Any]] = {}

    for row in rows:
        match_id = as_int(row["match_id"])
        team_id = as_int(row["team_id"])
        account_id = as_int(row["account_id"])
        player_key = (team_id, account_id)
        stats, proxies = stats_from_row(row)

        if match_id not in matches:
            matches[match_id] = {
                "matchId": match_id,
                "seriesId": (
                    as_int(row["series_id"]) if row["series_id"] is not None else None
                ),
                "seriesType": (
                    as_int(row["series_type"])
                    if row["series_type"] is not None
                    else None
                ),
                "startTime": as_int(row["start_time"]),
                "duration": as_int(row["duration"]),
                "radiantTeamId": as_int(row["radiant_team_id"]),
                "direTeamId": as_int(row["dire_team_id"]),
                "radiantWin": bool(row["radiant_win"]),
                "parseVersion": (
                    as_int(row["version"]) if row["version"] is not None else None
                ),
                "players": [],
            }

        raw_team_name = (row.get("team_name") or f"Team {team_id}").strip()
        display_team_name = team_name_overrides.get(team_id, raw_team_name)
        raw_team_tag = (row.get("team_tag") or "").strip()
        display_team_tag = team_tag_overrides.get(team_id, raw_team_tag)
        if team_id not in teams:
            teams[team_id] = {
                "teamId": team_id,
                "name": display_team_name,
                "tag": display_team_tag,
                "logoUrl": row.get("team_logo_url"),
                "openDotaRegistryName": raw_team_name,
                "players": [],
            }

        if player_key not in players:
            players[player_key] = {
                "teamId": team_id,
                "accountId": account_id,
                "name": row["player_name"],
                "source_fantasy_role": (
                    as_int(row["source_fantasy_role"])
                    if row["source_fantasy_role"] is not None
                    else None
                ),
                "games": 0,
                "mid_lane_games": 0,
                "totals": {
                    key: (None if key == "lotuses_collected" else 0)
                    for key in STAT_KEYS
                },
                "proxy_totals": {
                    "healing_lotus_items_used": 0,
                    "healing_lotus_base_equivalent_used": 0,
                },
            }

        accumulator = players[player_key]
        accumulator["games"] += 1
        if as_int(row["lane_role"]) == 2:
            accumulator["mid_lane_games"] += 1
        for key, value in stats.items():
            if value is not None:
                accumulator["totals"][key] += value
        for key, value in proxies.items():
            accumulator["proxy_totals"][key] += value

        matches[match_id]["players"].append(
            {
                "accountId": account_id,
                "name": row["player_name"],
                "teamId": team_id,
                "playerSlot": as_int(row["player_slot"]),
                "heroId": as_int(row.get("hero_id")),
                "laneRole": as_int(row["lane_role"]),
                "stats": stats,
                "proxies": proxies,
            }
        )

    role_map = infer_roles(players)

    for player_key, accumulator in players.items():
        team_id, account_id = player_key
        games = accumulator["games"]
        role_info = role_map[player_key]
        totals = {
            key: (
                None
                if value is None
                else normalize_number(float(value), 6)
            )
            for key, value in accumulator["totals"].items()
        }
        averages = {
            key: (
                None
                if value is None
                else normalize_number(float(value) / games, 6)
            )
            for key, value in accumulator["totals"].items()
        }
        proxy_totals = accumulator["proxy_totals"]
        proxy_averages = {
            key: normalize_number(float(value) / games, 6)
            for key, value in proxy_totals.items()
        }
        teams[team_id]["players"].append(
            {
                "accountId": account_id,
                "name": accumulator["name"],
                "role": role_info["role"],
                "roleConfidence": role_info["confidence"],
                "roleEvidence": role_info["evidence"],
                "games": games,
                "totals": totals,
                "averages": averages,
                "proxies": {
                    "totals": proxy_totals,
                    "averages": proxy_averages,
                },
            }
        )

    for match in matches.values():
        for player_row in match["players"]:
            player_key = (player_row["teamId"], player_row["accountId"])
            player_row["role"] = role_map[player_key]["role"]
        match["players"].sort(key=lambda item: item["playerSlot"])
        match["radiantTeamName"] = teams[match["radiantTeamId"]]["name"]
        match["direTeamName"] = teams[match["direTeamId"]]["name"]

    role_order = {"core": 0, "mid": 1, "support": 2}
    for team in teams.values():
        team["players"].sort(
            key=lambda player: (role_order[player["role"]], player["name"].casefold())
        )
        role_counts = defaultdict(int)
        for player in team["players"]:
            role_counts[player["role"]] += 1
        team["roleCounts"] = {
            "core": role_counts["core"],
            "mid": role_counts["mid"],
            "support": role_counts["support"],
        }
        team["rosterComplete"] = team["roleCounts"] == {
            "core": 2,
            "mid": 1,
            "support": 2,
        }

    sorted_matches = sorted(
        matches.values(), key=lambda match: (match["startTime"], match["matchId"])
    )
    sorted_teams = sorted(teams.values(), key=lambda team: team["name"].casefold())

    parsed_matches = sum(match["parseVersion"] is not None for match in sorted_matches)
    player_game_rows = sum(len(match["players"]) for match in sorted_matches)
    unique_players = len(players)
    match_sizes = [len(match["players"]) for match in sorted_matches]
    start_times = [match["startTime"] for match in sorted_matches]

    generated_at = datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")
    sources = {
        "openDotaExplorer": EXPLORER_URL,
        "openDotaLeagueMatches": (
            f"https://api.opendota.com/api/leagues/{league_id}/matches"
        ),
    }
    if liquipedia_url:
        sources["liquipediaEvent"] = liquipedia_url
    return {
        "meta": {
            "schemaVersion": 2,
            "leagueId": league_id,
            "leagueName": league_name,
            "generatedAt": generated_at,
            "eventStartUtc": iso_utc(min(start_times)),
            "eventEndUtc": iso_utc(
                max(match["startTime"] + match["duration"] for match in sorted_matches)
            ),
            "sources": sources,
            "coverage": {
                "matches": len(sorted_matches),
                "parsedMatches": parsed_matches,
                "playerGameRows": player_game_rows,
                "teams": len(sorted_teams),
                "players": unique_players,
                "allMatchesHaveTenPlayers": set(match_sizes) == {10},
            },
            "roleMethod": {
                "description": (
                    "Five-player rosters use event-local lane and farm rankings. "
                    "Rosters with substitutes prefer OpenDota fantasy_role and "
                    "fall back to lane and farm evidence."
                ),
                "sourceFantasyRoleRetainedAsEvidence": True,
            },
            "fieldProvenance": {
                "kills": "player_matches.kills",
                "deaths": "player_matches.deaths",
                "creep_score": "player_matches.last_hits + player_matches.denies",
                "gpm": "player_matches.gold_per_min",
                "madstones_collected": (
                    "player_matches.item_uses.madstone_bundle (replay-derived proxy)"
                ),
                "towers_destroyed": "player_matches.towers_killed",
                "observer_wards_placed": "player_matches.obs_placed",
                "camps_stacked": "player_matches.camps_stacked",
                "runes_picked_up": "player_matches.rune_pickups",
                "watchers_captured": (
                    "player_matches.ability_uses.ability_lamp_use "
                    "(replay-derived proxy)"
                ),
                "smokes_used": (
                    "player_matches.item_uses.smoke_of_deceit"
                ),
                "lotuses_collected": (
                    "unavailable from OpenDota; intentionally null"
                ),
                "roshans_killed": "player_matches.roshans_killed",
                "teamfight_participation": (
                    "player_matches.teamfight_participation (0..1 ratio)"
                ),
                "stun_seconds": "player_matches.stuns",
                "tormentors_killed": (
                    "player_matches.killed.npc_dota_miniboss"
                ),
                "first_blood": "player_matches.firstblood_claimed",
                "couriers_killed": "player_matches.killed.npc_dota_courier",
            },
            "caveats": [
                (
                    "lotuses_collected is null, not zero: OpenDota exposes Healing "
                    "Lotus item use but not the exact current fantasy collection stat."
                ),
                (
                    "proxies.healing_lotus_base_equivalent_used converts used "
                    "famango/great_famango/greater_famango items to 1/3/9 base "
                    "lotuses. It measures consumption and must not be presented as "
                    "exact collection."
                ),
                (
                    "madstones_collected uses OpenDota's replay item-use counter "
                    "item_uses.madstone_bundle; watchers_captured uses "
                    "ability_uses.ability_lamp_use. Both should remain visibly "
                    "marked as replay-derived proxies until checked against Valve's "
                    "official post-game fantasy values."
                ),
                (
                    "One OpenDota source row has a small negative stun duration "
                    "(match 8885614030, shiro, -0.58352 seconds); the generated "
                    "fantasy value is clamped to zero."
                ),
            ],
        },
        "teams": sorted_teams,
        "matches": sorted_matches,
    }


def build_summary(
    dataset: dict[str, Any], source_data_file: str = "full.json"
) -> dict[str, Any]:
    """Derive the small, stable app-facing projection from the full dataset."""

    summary_meta = {
        **dataset["meta"],
        "artifact": "summary",
        "sourceDataFile": source_data_file,
    }
    player_maps: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for match in dataset["matches"]:
        title_conditions = match.get("titleConditions")
        for player_row in match["players"]:
            player_maps[(player_row["teamId"], player_row["accountId"])].append(
                {
                    "matchId": match["matchId"],
                    "seriesId": match.get("seriesId"),
                    "seriesType": match.get("seriesType"),
                    "seriesGameNumber": (match.get("titleData") or {}).get(
                        "seriesGameNumber"
                    ),
                    "heroId": player_row.get("heroId"),
                    "heroName": player_row.get("heroName"),
                    "won": player_row.get("won"),
                    "lost": player_row.get("lost"),
                    "titleConditions": title_conditions,
                    "replayCounters": player_row.get("replayCounters"),
                    "stats": player_row["stats"],
                }
            )

    return {
        "meta": summary_meta,
        "teams": [
            {
                "teamId": team["teamId"],
                "name": team["name"],
                "tag": team["tag"],
                "players": [
                    {
                        "accountId": player["accountId"],
                        "name": player["name"],
                        "role": player["role"],
                        "games": player["games"],
                        "averages": player["averages"],
                        "maps": player_maps[(team["teamId"], player["accountId"])],
                        "roleConfidence": player["roleConfidence"],
                    }
                    for player in team["players"]
                ],
            }
            for team in dataset["teams"]
        ],
    }


def main() -> int:
    args = parse_args()
    try:
        rows = fetch_rows(args.league_id)
        dataset = build_dataset(
            rows,
            args.league_id,
            args.league_name,
            args.liquipedia_url,
        )
        summary = build_summary(dataset, args.output.name)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(dataset, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        args.summary_output.parent.mkdir(parents=True, exist_ok=True)
        args.summary_output.write_text(
            json.dumps(
                summary,
                ensure_ascii=False,
                separators=(",", ":"),
            )
            + "\n",
            encoding="utf-8",
        )
    except (RuntimeError, OSError, ValueError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    coverage = dataset["meta"]["coverage"]
    full_size = args.output.stat().st_size
    summary_size = args.summary_output.stat().st_size
    print(
        f"Wrote {args.output} "
        f"({coverage['matches']} matches, {coverage['teams']} teams, "
        f"{coverage['players']} players, "
        f"{coverage['playerGameRows']} player-game rows, {full_size} bytes)"
    )
    print(
        f"Wrote {args.summary_output} "
        f"({coverage['teams']} teams, {coverage['players']} players, "
        f"{summary_size} bytes)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
