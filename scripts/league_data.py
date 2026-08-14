#!/usr/bin/env python3
"""Assemble browser data from Valve replay checkpoints.

All per-map Fantasy statistics, player identities, team identities, results,
timestamps, and durations are supplied by ``replay_tools.py``. OpenDota is
deliberately not used here; ``build_league.py`` only uses it to discover the
Valve replay links for a configured league.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
import zlib


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


FIELD_PROVENANCE = {
    "kills": "Valve replay CDOTA_PlayerResource m_iKills",
    "deaths": "Valve replay CDOTA_PlayerResource m_iDeaths",
    "creep_score": (
        "Valve replay CDOTA_Data* m_iLastHitCount + m_iDenyCount"
    ),
    "gpm": (
        "Calculated from Valve replay m_iTotalEarnedGold and exact game duration"
    ),
    "madstones_collected": (
        "Valve replay CDOTA_Data* m_iNeutralTokensFound"
    ),
    "towers_destroyed": "Valve replay CDOTA_Data* m_iTowerKills",
    "observer_wards_placed": (
        "Valve replay CDOTA_Data* m_iObserverWardsPlaced"
    ),
    "camps_stacked": "Valve replay CDOTA_Data* m_iCampsStacked",
    "runes_picked_up": "Valve replay CDOTA_Data* m_iRunePickups",
    "watchers_captured": "Valve replay CDOTA_Data* m_iWatchersTaken",
    "smokes_used": "Valve replay CDOTA_Data* m_iSmokesUsed",
    "lotuses_collected": "Valve replay CDOTA_Data* m_iLotusesTaken",
    "roshans_killed": "Valve replay CDOTA_Data* m_iRoshanKills",
    "teamfight_participation": (
        "Valve replay CDOTA_PlayerResource m_flTeamFightParticipation"
    ),
    "stun_seconds": "Valve replay CDOTA_Data* m_fStuns",
    "tormentors_killed": "Valve replay CDOTA_Data* m_iTormentorKills",
    "first_blood": "Valve replay CDOTA_PlayerResource m_iFirstBloodClaimed",
    "couriers_killed": "Valve replay CDOTA_Data* m_iCourierKills",
}


def normalize_number(value: float) -> int | float:
    """Preserve source precision while keeping exact integers compact."""

    number = float(value)
    if number.is_integer():
        return int(number)
    return number


def iso_utc(epoch_seconds: int) -> str:
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat().replace(
        "+00:00", "Z"
    )


def stable_team_id(team_number: int, team_name: str) -> int:
    """Return a deterministic negative ID when a replay team is unregistered."""

    key = f"{team_number}:{team_name.strip().casefold()}".encode("utf-8")
    return -(zlib.crc32(key) or team_number)


def _average(accumulator: dict[str, Any], key: str) -> float:
    return float(accumulator["totals"][key]) / int(accumulator["games"])


def infer_roles(
    players: dict[tuple[int, int], dict[str, Any]],
    role_overrides: dict[int, str] | None = None,
) -> dict[tuple[int, int], dict[str, Any]]:
    """Infer two cores, one mid and two supports from replay-only farm data.

    Five-player rosters are deterministic: the two lowest average creep-score
    players are supports; among the remaining three, the median average
    creep-score player is mid. Event-specific account-ID overrides can correct unusual
    farm distributions without introducing another remote data source.
    """

    role_overrides = role_overrides or {}
    invalid = set(role_overrides.values()) - {"core", "mid", "support"}
    if invalid:
        raise RuntimeError(f"Invalid role override values: {sorted(invalid)}")

    by_team: dict[int, list[tuple[tuple[int, int], dict[str, Any]]]] = defaultdict(
        list
    )
    for key, accumulator in players.items():
        by_team[key[0]].append((key, accumulator))

    result: dict[tuple[int, int], dict[str, Any]] = {}
    for roster in by_team.values():
        ordered = sorted(
            roster,
            key=lambda item: (
                _average(item[1], "creep_score"),
                _average(item[1], "gpm"),
                item[0][1],
            ),
        )
        roles: dict[tuple[int, int], str] = {}
        for key, _ in roster:
            override = role_overrides.get(key[1])
            if override:
                roles[key] = override

        if len(roster) == 5:
            target_counts = {"core": 2, "mid": 1, "support": 2}
            remaining = [item for item in ordered if item[0] not in roles]

            support_slots = target_counts["support"] - sum(
                role == "support" for role in roles.values()
            )
            for key, _ in remaining[: max(0, support_slots)]:
                roles[key] = "support"

            remaining = [item for item in ordered if item[0] not in roles]
            mid_slots = target_counts["mid"] - sum(
                role == "mid" for role in roles.values()
            )
            if mid_slots > 0 and remaining:
                farm_candidates = sorted(
                    remaining,
                    key=lambda item: (
                        _average(item[1], "creep_score"),
                        _average(item[1], "gpm"),
                        item[0][1],
                    ),
                )
                roles[farm_candidates[len(farm_candidates) // 2][0]] = "mid"

            for key, _ in roster:
                roles.setdefault(key, "core")
            confidence = "manual" if any(
                key[1] in role_overrides for key, _ in roster
            ) else "medium"
        else:
            # Substitute-heavy rosters cannot always be partitioned 2/1/2 from
            # aggregate farm alone. Keep deterministic evidence and expose the
            # lower confidence so maintainers can add account-ID overrides.
            cutoff = max(1, round(len(ordered) * 0.4))
            for key, _ in ordered[:cutoff]:
                roles.setdefault(key, "support")
            remaining = [item for item in ordered if item[0] not in roles]
            if not any(role == "mid" for role in roles.values()) and remaining:
                farm_candidates = sorted(
                    remaining,
                    key=lambda item: (
                        _average(item[1], "creep_score"),
                        _average(item[1], "gpm"),
                        item[0][1],
                    ),
                )
                roles[farm_candidates[len(farm_candidates) // 2][0]] = "mid"
            for key, _ in roster:
                roles.setdefault(key, "core")
            confidence = "low"

        farm_rank = {item[0]: rank for rank, item in enumerate(ordered, start=1)}
        for key, accumulator in roster:
            result[key] = {
                "role": roles[key],
                "confidence": confidence,
                "evidence": {
                    "averageCreepScore": normalize_number(
                        _average(accumulator, "creep_score")
                    ),
                    "averageGpm": normalize_number(
                        _average(accumulator, "gpm")
                    ),
                    "farmRankAscending": farm_rank[key],
                    "manualOverride": role_overrides.get(key[1]),
                },
            }
    return result


def build_dataset(
    matches: list[dict[str, Any]],
    league_id: int,
    league_name: str,
    team_name_overrides: dict[int, str] | None = None,
    team_tag_overrides: dict[int, str] | None = None,
    role_overrides: dict[int, str] | None = None,
    excluded_team_names: set[str] | None = None,
) -> dict[str, Any]:
    if not matches:
        raise RuntimeError(f"No replay matches were parsed for league {league_id}")

    team_name_overrides = team_name_overrides or {}
    team_tag_overrides = team_tag_overrides or {}
    excluded_team_names = excluded_team_names or set()
    excluded_name_keys = {
        name.strip().casefold() for name in excluded_team_names
    }
    excluded_team_ids: set[int] = set()
    teams: dict[int, dict[str, Any]] = {}
    players: dict[tuple[int, int], dict[str, Any]] = {}

    for match in matches:
        if len(match.get("players", [])) != 10:
            raise RuntimeError(f"Match {match.get('matchId')} does not have ten players")
        for side in ("radiant", "dire"):
            team_id = int(match[f"{side}TeamId"])
            team_name = team_name_overrides.get(
                team_id, match[f"{side}TeamName"]
            )
            if team_name.strip().casefold() in excluded_name_keys:
                excluded_team_ids.add(team_id)
                teams.pop(team_id, None)
                continue
            if team_id in excluded_team_ids:
                continue
            teams.setdefault(
                team_id,
                {
                    "teamId": team_id,
                    "name": team_name,
                    "tag": team_tag_overrides.get(
                        team_id, match.get(f"{side}TeamTag") or ""
                    ),
                    "logoUrl": None,
                    "players": [],
                },
            )

    for match in matches:
        for player in match["players"]:
            team_id = int(player["teamId"])
            if team_id in excluded_team_ids:
                continue
            account_id = int(player["accountId"])
            key = (team_id, account_id)
            accumulator = players.setdefault(
                key,
                {
                    "teamId": team_id,
                    "accountId": account_id,
                    "name": player["name"],
                    "games": 0,
                    "totals": {stat: 0.0 for stat in STAT_KEYS},
                },
            )
            accumulator["name"] = player["name"] or accumulator["name"]
            accumulator["games"] += 1
            for stat in STAT_KEYS:
                value = player["stats"].get(stat)
                if value is None:
                    raise RuntimeError(
                        f"Match {match['matchId']} player {account_id} lacks {stat}"
                    )
                accumulator["totals"][stat] += float(value)

    role_map = infer_roles(players, role_overrides)
    for key, accumulator in players.items():
        role_info = role_map[key]
        games = int(accumulator["games"])
        totals = {
            stat: normalize_number(value)
            for stat, value in accumulator["totals"].items()
        }
        averages = {
            stat: normalize_number(float(value) / games)
            for stat, value in totals.items()
        }
        teams[key[0]]["players"].append(
            {
                "accountId": key[1],
                "name": accumulator["name"],
                "role": role_info["role"],
                "roleConfidence": role_info["confidence"],
                "roleEvidence": role_info["evidence"],
                "games": games,
                "totals": totals,
                "averages": averages,
            }
        )

    for match in matches:
        for player in match["players"]:
            role_info = role_map.get(
                (int(player["teamId"]), int(player["accountId"]))
            )
            player["role"] = role_info["role"] if role_info else None
        match["players"].sort(key=lambda player: int(player["playerSlot"]))

    role_order = {"core": 0, "mid": 1, "support": 2}
    for team in teams.values():
        team["players"].sort(
            key=lambda player: (role_order[player["role"]], player["name"].casefold())
        )
        counts = defaultdict(int)
        for player in team["players"]:
            counts[player["role"]] += 1
        team["roleCounts"] = {
            "core": counts["core"],
            "mid": counts["mid"],
            "support": counts["support"],
        }
        team["rosterComplete"] = team["roleCounts"] == {
            "core": 2,
            "mid": 1,
            "support": 2,
        }

    sorted_matches = sorted(
        matches, key=lambda match: (int(match["startTime"]), int(match["matchId"]))
    )
    sorted_teams = sorted(teams.values(), key=lambda team: team["name"].casefold())
    start_times = [int(match["startTime"]) for match in sorted_matches]
    generated_at = datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")
    sources = {
        "openDotaReplayManifest": (
            "OpenDota resolves the league name and discovers its Valve replay links"
        ),
        "valveReplays": (
            "http://replay{cluster}.{regional_domain}/570/"
            "{match_id}_{replay_salt}.dem.bz2"
        ),
    }
    return {
        "meta": {
            "schemaVersion": 10,
            "leagueId": league_id,
            "leagueName": league_name,
            "generatedAt": generated_at,
            "eventStartUtc": iso_utc(min(start_times)),
            "eventEndUtc": iso_utc(
                max(
                    int(
                        match.get("endTime")
                        or int(match["startTime"]) + int(match["duration"])
                    )
                    for match in sorted_matches
                )
            ),
            "sources": sources,
            "coverage": {
                "matches": len(sorted_matches),
                "parsedMatches": len(sorted_matches),
                "playerGameRows": sum(
                    int(player["games"]) for player in players.values()
                ),
                "teams": len(sorted_teams),
                "players": len(players),
                "allMatchesHaveTenPlayers": all(
                    len(match["players"]) == 10 for match in sorted_matches
                ),
            },
            "roleMethod": {
                "description": (
                    "Global account-ID assignments in build_league.py, with "
                    "replay-only farm ranking for unknown players."
                ),
                "usesRemoteRoleData": False,
            },
            "excludedTeamNames": sorted(
                excluded_team_names, key=str.casefold
            ),
            "fieldProvenance": dict(FIELD_PROVENANCE),
            "caveats": [],
            "replayFantasyStats": {
                "parser": "Clarity 4.0.1",
                "matchesParsed": len(sorted_matches),
                "exactFields": [key for key in STAT_KEYS if key != "gpm"],
                "calculatedFields": ["gpm"],
                "allFantasyStatsFromValveReplay": True,
            },
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
        for player in match["players"]:
            if player.get("role") is None:
                continue
            player_maps[(player["teamId"], player["accountId"])].append(
                {
                    "matchId": match["matchId"],
                    "seriesId": match.get("seriesId"),
                    "seriesType": match.get("seriesType"),
                    "seriesGameNumber": (match.get("titleData") or {}).get(
                        "seriesGameNumber"
                    ),
                    "heroId": player.get("heroId"),
                    "heroName": player.get("heroName"),
                    "opponent": player.get("opponent"),
                    "won": player.get("won"),
                    "lost": player.get("lost"),
                    "titleConditions": title_conditions,
                    "replayCounters": player.get("replayCounters"),
                    "stats": player["stats"],
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
