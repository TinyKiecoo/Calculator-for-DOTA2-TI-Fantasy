#!/usr/bin/env python3
"""Build one league's static Fantasy dataset from Valve replay files.

OpenDota is used to resolve the league name and discover its Valve replay links.
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
import re
import sys
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import league_data
import replay_tools


# Default event configuration. --league-id overrides this value without
# requiring a source edit. The league name is always fetched from OpenDota.
LEAGUE_ID = 20009

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

# Global account-ID role assignments. The current inferred EWC roster is
# written out in full so any incorrect role can be corrected here directly.
# Players absent from this table still use replay-only farm inference.
PLAYER_ROLE_OVERRIDES: dict[int, str] = {
    # 1w
    86698277: "core",  # 33
    331855530: "core",  # Pure
    93618577: "mid",  # bzm
    346412363: "support",  # Ari
    136829091: "support",  # Whitemon
    # Aurora Gaming
    124801257: "core",  # Nightfall
    126842529: "core",  # Ws`
    301750126: "mid",  # Mikoto
    320219866: "support",  # kaori
    256156323: "support",  # Mira
    # BB Team
    172099728: "core",  # Kiritych~
    165564598: "core",  # MieRo
    480412663: "mid",  # gpk~
    196878136: "support",  # Kataomi`
    317880638: "support",  # Save-
    # GamerLegion
    160119017: "core",  # Fayde
    206642367: "core",  # Ghost
    154974246: "mid",  # RCY
    90423751: "support",  # Bignum
    191362875: "support",  # Speeed
    # IC x Insanity
    458287006: "core",  # 423
    117514269: "core",  # laise
    262476000: "mid",  # Stojkov
    1172719712: "support",  # Fernans
    196400041: "support",  # Se
    # L1 TEAM
    92487440: "core",  # Corrupted
    320017600: "core",  # ssnovv1
    140251702: "mid",  # Mirage`雨
    123787715: "support",  # RESPECT
    111030315: "support",  # ww_zayac
    # Level UP
    93526520: "core",  # bb3px
    1092267175: "core",  # WoE
    196482746: "mid",  # darkniA
    340421206: "support",  # Htrd
    206097366: "support",  # queezy
    # LGD Gaming
    292921272: "core",  # Wisper
    177203952: "core",  # Yuma
    1026694469: "mid",  # TaiLung
    81306398: "support",  # KingJungles
    105045291: "support",  # Thiolicor
    # MOUZ
    190826739: "core",  # BOOM
    127617979: "core",  # Crystallis
    116585378: "mid",  # MidOne
    108958769: "support",  # panto
    9403474: "support",  # yamich
    # Nigma Galaxy
    138880576: "core",  # Davai
    111620041: "core",  # SumaiL-
    210053851: "mid",  # lorenof
    101356886: "support",  # GH
    152168157: "support",  # OmaR
    # OG
    355168766: "core",  # Natsumi
    132309493: "core",  # Raven
    324277900: "mid",  # Yopaj-
    100594231: "support",  # skem
    155494381: "support",  # TIMS
    # Poor Rangers
    363739653: "core",  # alberkaaa
    96183976: "core",  # naive-
    294135421: "mid",  # Nicky`Cool
    295697470: "support",  # Immersion
    185059559: "support",  # Till The End
    # PTime
    252737052: "core",  # Fr△nk
    363758022: "core",  # Wits
    352545711: "mid",  # DarkMago♥
    1031547092: "support",  # Elmisho
    157989498: "support",  # Scofield
    # PVISION
    195108598: "core",  # Noticed
    1044002267: "core",  # Satanic
    106573901: "mid",  # No[o]ne-
    164199202: "support",  # 9Class
    73401082: "support",  # Dukalis
    # REKONIX
    156328257: "core",  # Fbz
    140411011: "core",  # jikroy
    181716137: "mid",  # inYourdreaM
    155447692: "support",  # dalul
    118559150: "support",  # Varizh
    # Rune Eaters
    879017980: "core",  # Darklord,,`
    203351055: "core",  # Malik
    115651292: "mid",  # Copy
    1202267677: "support",  # aik
    230487729: "support",  # Ekki
    # Team Falcons
    183719386: "core",  # AMMAR_THE_F
    100058342: "core",  # skiter
    898455820: "mid",  # Malr1ne
    25907144: "support",  # Cr1t-
    10366616: "support",  # Sneyking
    # Team Liquid
    97590558: "core",  # Ace ♠
    152962063: "core",  # m1CKe
    201358612: "mid",  # Nisha
    77490514: "support",  # Boxi
    16497807: "support",  # tOfu
    # Team Nemesis
    100471531: "core",  # J
    968545762: "core",  # rubikon155
    131303632: "mid",  # 4nalog丶01
    87063175: "support",  # Lelis
    81475303: "support",  # Yamsun
    # Team Spirit
    302214028: "core",  # Collapse
    321580662: "core",  # Yatoro
    106305042: "mid",  # Larl
    218231587: "support",  # not_me
    847565596: "support",  # rue
    # Team Yandex
    56351509: "core",  # DM
    171262902: "core",  # 医者watson`
    312436974: "mid",  # CHIRA_JUNIOR
    93817671: "support",  # Maladych
    103735745: "support",  # Saksa
    # Vici Gaming
    118134220: "core",  # Bach
    320252024: "core",  # shiro
    137129583: "mid",  # Xm
    157475523: "support",  # XinQ
    111114687: "support",  # y`
    # Virtus.pro
    126212866: "core",  # Saberlight
    97658618: "core",  # Timado
    154715080: "mid",  # Abed
    94155156: "support",  # Fly
    241884166: "support",  # Hellscream
    # Xtreme Gaming
    898754153: "core",  # Ame
    129958758: "core",  # Xxs
    173978074: "mid",  # NothingToSay
    101695162: "support",  # fy
    94296097: "support",  # xNova
}

# Global display-name exclusions. Excluded teams are hidden from selection and
# rankings, while their opponents still receive points from shared matches.
EXCLUDED_TEAM_NAMES = {
    "Virtus.pro",
    "Rune Eaters",
    "REKONIX",
    "MOUZ",
    "PTime",
    "Level UP",
    "Team Nemesis",
    "Poor Rangers",
    "L1 TEAM",
    "IC x Insanity",
}

CHECKPOINT_SCHEMA_VERSION = 8
REPLAY_GPM_SOURCE = (
    "Calculated from Valve replay m_iTotalEarnedGold / exact game duration"
)
SERIES_MAX_GAMES = {0: 1, 1: 3, 2: 5, 3: 2}
SERIES_WINS_REQUIRED = {0: 1, 1: 2, 2: 3}
THE_INTERNATIONAL_NAME = re.compile(
    r"\bThe International 20\d{2}\b", re.IGNORECASE
)
# The group stage and arena playoffs are separated by several rest days. Daily
# overnight gaps stay well below this threshold, so the first qualifying gap
# can be inferred from replay timestamps without a manually maintained date.
TI_STAGE_BREAK_MIN_SECONDS = 60 * 60 * 60
TI_STAGE_DIRECTORIES = {
    "groupStage": "group-stage",
    "international": "playoffs",
}


def utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def is_the_international(league_name: str) -> bool:
    """Return whether an OpenDota league name is a yearly TI main event."""

    return bool(THE_INTERNATIONAL_NAME.search(str(league_name or "")))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--league-id",
        type=int,
        default=LEAGUE_ID,
        help=f"OpenDota league ID (default: LEAGUE_ID={LEAGUE_ID} in this file)",
    )
    parser.add_argument(
        "--match-id",
        type=int,
        action="append",
        help=(
            "Only download/parse this match from the league; may be supplied "
            "multiple times. Existing valid checkpoints are still included."
        ),
    )
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
    args = parser.parse_args()
    if args.league_id < 1:
        parser.error("--league-id must be positive")
    if args.match_id and any(match_id < 1 for match_id in args.match_id):
        parser.error("--match-id must be positive")
    return args


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
    print("OpenDota 中最接近的赛事（用于 LEAGUE_ID 或 --league-id）：")
    for _, league in sorted(ranked, key=lambda item: item[0], reverse=True)[:10]:
        print(f"  {league.get('leagueid')}: {league.get('name')}")


def fetch_league_name(league_id: int, timeout: int) -> str:
    payload = request_json(
        f"{replay_tools.OPEN_DOTA_API}/leagues/{league_id}", timeout
    )
    if not isinstance(payload, dict):
        raise RuntimeError(
            f"OpenDota league {league_id} did not return an object"
        )
    returned_id = payload.get("leagueid")
    if returned_id is not None and int(returned_id) != league_id:
        raise RuntimeError(
            f"OpenDota returned league {returned_id} for requested ID {league_id}"
        )
    league_name = str(payload.get("name") or "").strip()
    if not league_name:
        raise RuntimeError(f"OpenDota league {league_id} has no name")
    return league_name


def stored_league_catalog_entry(league_dir: Path) -> dict[str, Any] | None:
    """Read a completed/partially published league without parsing data.js."""

    if not league_dir.is_dir() or not league_dir.name.isdigit():
        return None
    if not (league_dir / "data.js").is_file():
        return None

    directory_league_id = int(league_dir.name)
    metadata_paths = (league_dir / "league.json", league_dir / "summary.json")
    for metadata_path in metadata_paths:
        if not metadata_path.is_file():
            continue
        try:
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
            metadata = payload.get("meta", payload)
            league_id = int(metadata.get("leagueId"))
            league_name = str(metadata.get("leagueName") or "").strip()
        except (
            AttributeError,
            json.JSONDecodeError,
            OSError,
            TypeError,
            ValueError,
        ):
            continue
        if league_id == directory_league_id and league_name:
            return {"leagueId": league_id, "leagueName": league_name}
    return None


def refresh_league_catalog(
    data_root: Path,
    current_league_id: int | None = None,
    current_league_name: str | None = None,
) -> list[dict[str, Any]]:
    """Regenerate data/leagues.js from every published league directory."""

    data_root.mkdir(parents=True, exist_ok=True)
    entries: dict[int, dict[str, Any]] = {}
    for league_dir in data_root.iterdir():
        entry = stored_league_catalog_entry(league_dir)
        if entry is not None:
            entries[int(entry["leagueId"])] = entry

    if current_league_id is not None and current_league_name:
        current_data = data_root / str(current_league_id) / "data.js"
        if current_data.is_file():
            entries[int(current_league_id)] = {
                "leagueId": int(current_league_id),
                "leagueName": str(current_league_name).strip(),
            }

    catalog = [entries[league_id] for league_id in sorted(entries)]
    payload = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
    replay_tools.atomic_write_text(
        data_root / "leagues.js",
        "window.FANTASY_LEAGUES=" + payload + ";\n",
    )
    return catalog


def select_manifest_matches(
    manifest: list[dict[str, Any]],
    match_ids: list[int] | None,
    league_id: int,
) -> set[int] | None:
    """Return explicitly selected IDs, or None when every match is selected."""

    if not match_ids:
        return None
    requested = {int(match_id) for match_id in match_ids}
    available = {int(item["matchId"]) for item in manifest}
    missing = requested - available
    if missing:
        raise RuntimeError(
            f"Match IDs are not in league {league_id}: {sorted(missing)}"
        )
    return requested


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
        raw_stats = copy.deepcopy(exact.get("rawStats") or {})
        stats["gpm"] = replay_tools.calculate_gpm(
            raw_stats.get("totalEarnedGold"),
            match_data.get("gameStartTime"),
            match_data.get("gameEndTime"),
        )
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
                "rawReplayStats": raw_stats,
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
        "startTime": match_data["startTime"],
        "endTime": match_data["endTime"],
        "duration": match_data["duration"],
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
            "exactFields": [
                key for key in league_data.STAT_KEYS if key != "gpm"
            ],
            "calculatedFields": ["gpm"],
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


def series_game_number(match: dict[str, Any]) -> int | None:
    value = (match.get("titleData") or {}).get("seriesGameNumber")
    return int(value) if value is not None else None


def is_complete_series(series_matches: list[dict[str, Any]]) -> bool:
    """Require every map through a replay-proven series conclusion."""

    if not series_matches:
        return False
    ordered = sorted(
        series_matches,
        key=lambda match: (int(match["startTime"]), int(match["matchId"])),
    )
    series_types = {match.get("seriesType") for match in ordered}
    if len(series_types) != 1:
        return False
    series_type = next(iter(series_types))
    if series_type not in SERIES_MAX_GAMES:
        return False

    game_numbers = [series_game_number(match) for match in ordered]
    if game_numbers != list(range(1, len(ordered) + 1)):
        return False

    max_games = SERIES_MAX_GAMES[series_type]
    if len(ordered) > max_games:
        return False
    if series_type == 3:
        # A BO2 always plays both maps, including a 1-1 draw.
        return len(ordered) == max_games

    wins_required = SERIES_WINS_REQUIRED.get(series_type)
    if wins_required is None:
        return False
    team_pairs = {
        tuple(
            sorted(
                (
                    int(match["radiantTeamId"]),
                    int(match["direTeamId"]),
                )
            )
        )
        for match in ordered
    }
    if len(team_pairs) != 1:
        return False

    wins: dict[int, int] = {}
    for index, match in enumerate(ordered):
        winner = int(
            match["radiantTeamId"]
            if match["radiantWin"]
            else match["direTeamId"]
        )
        wins[winner] = wins.get(winner, 0) + 1
        if wins[winner] >= wins_required:
            # Reaching the winning score before the final available checkpoint
            # means the grouping contains an impossible extra map.
            return index == len(ordered) - 1
    return False


def completed_series(
    checkpoints: list[dict[str, Any]],
) -> list[list[dict[str, Any]]]:
    """Return only fully present, concluded series in chronological order."""

    assign_series_ids(checkpoints)
    grouped: dict[int, list[dict[str, Any]]] = {}
    for checkpoint in checkpoints:
        match = checkpoint["match"]
        series_id = match.get("seriesId")
        if series_id is None:
            continue
        grouped.setdefault(int(series_id), []).append(match)
    result = [
        sorted(
            matches,
            key=lambda match: (int(match["startTime"]), int(match["matchId"])),
        )
        for matches in grouped.values()
        if is_complete_series(matches)
    ]
    result.sort(
        key=lambda matches: (
            int(matches[0]["startTime"]),
            int(matches[0]["matchId"]),
        )
    )
    return result


def series_end_time(series_matches: list[dict[str, Any]]) -> int:
    return max(
        int(
            match.get("endTime")
            or int(match["startTime"]) + int(match["duration"])
        )
        for match in series_matches
    )


def split_ti_stages(
    complete: list[list[dict[str, Any]]],
) -> dict[str, list[list[dict[str, Any]]]]:
    """Split completed TI series at the long break before the playoffs."""

    stages = {"groupStage": complete, "international": []}
    if len(complete) < 2:
        return stages
    qualifying_gaps: list[tuple[int, int]] = []
    for index in range(1, len(complete)):
        gap = int(complete[index][0]["startTime"]) - series_end_time(
            complete[index - 1]
        )
        if gap >= TI_STAGE_BREAK_MIN_SECONDS:
            qualifying_gaps.append((gap, index))
    if not qualifying_gaps:
        return stages
    _, split_index = max(qualifying_gaps)
    return {
        "groupStage": complete[:split_index],
        "international": complete[split_index:],
    }


def flatten_series(
    series_groups: list[list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    return [match for matches in series_groups for match in matches]


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
            replay_tools.verify_compressed_replay_header(compressed)
            print(f"Using cached download: {compressed}")
        else:
            replay_tools.download_file(
                [item["replayUrl"]],
                compressed,
                args.timeout,
                args.retries,
                resume=False,
            )
        replay_tools.verify_compressed_replay_header(compressed)
        replay_tools.decompress_replay(compressed, dem, quiet=False)

    return replay_tools.parse_replay(
        dem,
        java_runtime[0],
        java_runtime[1],
        args.allow_missing_replay_fields,
        timeout=args.parse_timeout,
    )


def refresh_browser_data(
    checkpoints: list[dict[str, Any]],
    args: argparse.Namespace,
    league_dir: Path,
    league_name: str,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Atomically refresh data.js from every successful checkpoint so far."""

    assign_series_ids(checkpoints)
    overrides = LEAGUE_TEAM_OVERRIDES.get(args.league_id, {})

    def assemble(matches: list[dict[str, Any]]) -> dict[str, Any]:
        return league_data.build_dataset(
            matches,
            args.league_id,
            league_name,
            overrides.get("names"),
            overrides.get("tags"),
            PLAYER_ROLE_OVERRIDES,
            EXCLUDED_TEAM_NAMES,
        )

    if not is_the_international(league_name):
        dataset = assemble(
            [checkpoint["match"] for checkpoint in checkpoints]
        )
        summary = league_data.build_summary(dataset, "full.json")
        payload = json.dumps(
            summary, ensure_ascii=False, separators=(",", ":")
        )
        replay_tools.atomic_write_text(
            league_dir / "data.js",
            "window.FANTASY_DATA=" + payload + ";\n",
        )
        refresh_league_catalog(league_dir.parent, args.league_id, league_name)
        return dataset, summary

    complete = completed_series(checkpoints)
    if not complete:
        print(
            "No completed TI series is available yet; browser data was not "
            "refreshed."
        )
        return None, None

    series_by_stage = split_ti_stages(complete)
    stage_outputs: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {}
    for stage, series_groups in series_by_stage.items():
        if not series_groups:
            continue
        dataset = assemble(flatten_series(series_groups))
        dataset["meta"]["eventStage"] = stage
        dataset["meta"]["coverage"]["completeSeries"] = len(series_groups)
        summary = league_data.build_summary(dataset, "full.json")
        stage_outputs[stage] = (dataset, summary)

    available_stages = [
        stage for stage in ("groupStage", "international")
        if stage in stage_outputs
    ]
    stage_coverage = {
        stage: output[0]["meta"]["coverage"]
        for stage, output in stage_outputs.items()
    }
    for dataset, summary in stage_outputs.values():
        dataset["meta"]["availableStages"] = available_stages
        dataset["meta"]["stageCoverage"] = stage_coverage
        summary["meta"]["availableStages"] = available_stages
        summary["meta"]["stageCoverage"] = stage_coverage

    for stage, (dataset, summary) in stage_outputs.items():
        stage_dir = league_dir / "stages" / TI_STAGE_DIRECTORIES[stage]
        replay_tools.atomic_write_json(stage_dir / "full.json", dataset)
        replay_tools.atomic_write_json(
            stage_dir / "summary.json", summary, compact=True
        )

    default_stage = (
        "groupStage" if "groupStage" in stage_outputs else "international"
    )
    default_dataset, default_summary = stage_outputs[default_stage]
    bundle = {
        "meta": {
            "schemaVersion": CHECKPOINT_SCHEMA_VERSION,
            "leagueId": args.league_id,
            "leagueName": league_name,
            "isTheInternational": True,
            "availableStages": available_stages,
        },
        "stages": {
            stage: output[1] for stage, output in stage_outputs.items()
        },
    }
    payload = json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    replay_tools.atomic_write_text(
        league_dir / "data.js",
        "window.FANTASY_STAGE_DATA="
        + payload
        + ";window.FANTASY_DATA="
        + "(window.FANTASY_STAGE_DATA.stages.groupStage||"
        + "window.FANTASY_STAGE_DATA.stages.international);\n",
    )
    # Keep the traditional root files as a compatibility view of the default
    # stage while the authoritative stage artifacts remain separate.
    replay_tools.atomic_write_json(league_dir / "full.json", default_dataset)
    replay_tools.atomic_write_json(
        league_dir / "summary.json", default_summary, compact=True
    )
    refresh_league_catalog(league_dir.parent, args.league_id, league_name)
    return default_dataset, default_summary


def build(args: argparse.Namespace) -> None:
    league_name = fetch_league_name(args.league_id, args.timeout)
    print(f"赛事：{league_name}（LEAGUE_ID={args.league_id}）")
    league_dir = args.data_root.resolve() / str(args.league_id)
    matches_dir = league_dir / "matches"
    errors_path = league_dir / "errors.json"
    matches_dir.mkdir(parents=True, exist_ok=True)

    manifest = replay_tools.fetch_manifest(
        args.timeout, args.league_id, args.expected_matches
    )
    replay_tools.atomic_write_json(league_dir / "manifest.json", manifest)
    selected_match_ids = select_manifest_matches(
        manifest, getattr(args, "match_id", None), args.league_id
    )
    if selected_match_ids is not None:
        print(
            f"单场模式：将下载/解析 {len(selected_match_ids)} 场指定比赛；"
            "已有的有效检查点仍会用于生成网页数据。"
        )

    checkpoints: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    if selected_match_ids is not None and errors_path.exists():
        previous_errors = json.loads(errors_path.read_text(encoding="utf-8"))
        if not isinstance(previous_errors, list):
            raise RuntimeError(f"Invalid replay error list: {errors_path}")
        errors = [
            error
            for error in previous_errors
            if int(error.get("matchId", 0)) not in selected_match_ids
        ]
    known_player_names: dict[int, str] = {}
    java_runtime: tuple[str, str] | None = None
    dataset: dict[str, Any] | None = None
    summary: dict[str, Any] | None = None
    published_checkpoint_count = 0
    for index, item in enumerate(manifest, start=1):
        match_id = int(item["matchId"])
        is_selected = (
            selected_match_ids is None or match_id in selected_match_ids
        )
        checkpoint_path = matches_dir / f"{match_id}.json"
        if checkpoint_path.exists() and (not args.force or not is_selected):
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

        if not is_selected:
            continue

        if java_runtime is None:
            java_runtime = replay_tools.ensure_java_helper(
                args.tool_cache, args.timeout, args.retries, quiet=False
            )
        try:
            replay = parse_downloaded_match(item, args, java_runtime)
            checkpoint = checkpoint_from_replay(item, replay, args.league_id)
            match = validate_checkpoint(checkpoint, args.league_id, match_id)
            replay_tools.atomic_write_json(
                checkpoint_path, checkpoint, compact=True
            )
            remember_player_names(match, known_player_names)
            echo_match(match, f"解析完成 {index}/{len(manifest)}")
            checkpoints.append(checkpoint)
        except Exception as exc:  # Keep one unusable replay from stopping the event.
            error = {
                "matchId": match_id,
                "replayFile": item.get("filename"),
                "error": str(exc),
                "recordedAt": utc_now(),
            }
            errors.append(error)
            replay_tools.atomic_write_json(errors_path, errors)
            print(
                f"比赛 {match_id} 处理失败 {index}/{len(manifest)}，"
                f"将继续处理后续录像：{exc}",
                file=sys.stderr,
            )
            continue
        dataset, summary = refresh_browser_data(
            checkpoints, args, league_dir, league_name
        )
        if dataset is not None and summary is not None:
            published_checkpoint_count = len(checkpoints)

    replay_tools.atomic_write_json(errors_path, errors)

    if not checkpoints:
        raise RuntimeError(
            f"No replay matches were parsed for league {args.league_id}"
        )
    if published_checkpoint_count != len(checkpoints):
        dataset, summary = refresh_browser_data(
            checkpoints, args, league_dir, league_name
        )
    if dataset is None or summary is None:
        if not is_the_international(league_name):
            raise RuntimeError("Could not assemble browser data")
        league_info = {
            "schemaVersion": CHECKPOINT_SCHEMA_VERSION,
            "leagueId": args.league_id,
            "leagueName": league_name,
            "isTheInternational": True,
            "generatedAt": utc_now(),
            "replayCache": str(
                args.replay_cache.resolve() / str(args.league_id)
            ),
            "coverage": {
                "parsedCheckpoints": len(checkpoints),
                "publishedMatches": 0,
                "completeSeries": 0,
            },
            "files": {
                "manifest": "manifest.json",
                "matches": "matches/<MATCH_ID>.json",
                "errors": "errors.json",
            },
        }
        replay_tools.atomic_write_json(league_dir / "league.json", league_info)
        print(
            f"\n{league_name}: {len(checkpoints)} replay checkpoint(s) are "
            "available, but no complete series can be published yet."
        )
        return

    assign_series_ids(checkpoints)
    for checkpoint in checkpoints:
        checkpoint_path = matches_dir / f"{checkpoint['matchId']}.json"
        replay_tools.atomic_write_json(checkpoint_path, checkpoint, compact=True)

    full_path = league_dir / "full.json"
    summary_path = league_dir / "summary.json"
    replay_tools.atomic_write_json(full_path, dataset)
    replay_tools.atomic_write_json(summary_path, summary, compact=True)
    is_ti = is_the_international(league_name)
    coverage: dict[str, Any] = dataset["meta"]["coverage"]
    if is_ti:
        stage_coverage = dataset["meta"].get("stageCoverage", {})
        coverage = {
            "parsedCheckpoints": len(checkpoints),
            "publishedMatches": sum(
                int(item.get("matches", 0))
                for item in stage_coverage.values()
            ),
            "stages": stage_coverage,
        }
    files: dict[str, Any] = {
        "manifest": "manifest.json",
        "matches": "matches/<MATCH_ID>.json",
        "errors": "errors.json",
        "full": "full.json",
        "summary": "summary.json",
        "browser": "data.js",
    }
    if is_ti:
        files["stages"] = {
            stage: {
                "full": f"stages/{TI_STAGE_DIRECTORIES[stage]}/full.json",
                "summary": (
                    f"stages/{TI_STAGE_DIRECTORIES[stage]}/summary.json"
                ),
            }
            for stage in dataset["meta"].get("availableStages", [])
        }
    league_info = {
        "schemaVersion": CHECKPOINT_SCHEMA_VERSION,
        "leagueId": args.league_id,
        "leagueName": league_name,
        "isTheInternational": is_ti,
        "generatedAt": utc_now(),
        "replayCache": str(
            args.replay_cache.resolve() / str(args.league_id)
        ),
        "coverage": coverage,
        "files": files,
    }
    replay_tools.atomic_write_json(league_dir / "league.json", league_info)
    print(
        f"\n完成：{league_name}（LEAGUE_ID={args.league_id}），"
        f"{len(checkpoints)} 场成功，{len(errors)} 场失败 -> {league_dir}"
    )
    if errors:
        print(f"失败详情：{errors_path}", file=sys.stderr)
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
