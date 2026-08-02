#!/usr/bin/env python3
"""Low-level Dota 2 replay download and Fantasy-field parsing tools.

The three counters are read from the final replay state rather than inferred
from item/ability use events:

* ``m_iNeutralTokensFound`` -> scored ``madstones_collected``
* ``m_nAcquiredMadstone`` -> retained alternate Madstone counter
* ``m_iWatchersTaken``    -> ``watchers_captured``
* ``m_iLotusesTaken``     -> ``lotuses_collected``

The script is intentionally self-contained and has no Python package
dependencies.  It downloads Clarity 4.0.1 and its small Java dependency set
from Maven Central, compiles an embedded Java helper, and then calls that
helper for each replay.  Java/Javac 17 or newer must be installed.

The maintained league workflow is ``python scripts/build_league.py``.  The
low-level command below remains useful for debugging one local replay::

    python scripts/replay_tools.py \
        --replay ../8885275216_882748103/8885275216_882748103.dem

``build_league.py`` imports the functions in this module, keeps downloads in a
temporary directory, and deletes both compressed and decompressed files after
each successful parse.
"""

from __future__ import annotations

import argparse
import bz2
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


LEAGUE_ID = 19785
LEAGUE_NAME = "Esports World Cup 2026"
EXPECTED_MATCHES = 157
APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPLAY_ROOT = APP_ROOT / "replays" / "ewc_2026"
DEFAULT_OUTPUT = APP_ROOT / "data" / "ewc_2026_replay_stats.json"
OPEN_DOTA_EXPLORER = "https://api.opendota.com/api/explorer"
OPEN_DOTA_API = "https://api.opendota.com/api"
USER_AGENT = "DotaFantasyReplayBuilder/2.0"
STEAM_ID64_BASE = 76561197960265728
CHUNK_SIZE = 1024 * 1024


def utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def default_tool_cache() -> Path:
    if sys.platform == "win32" and os.environ.get("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "DotaFantasyReplayParser"
    if os.environ.get("XDG_CACHE_HOME"):
        return Path(os.environ["XDG_CACHE_HOME"]) / "dota-fantasy-replay-parser"
    return Path.home() / ".cache" / "dota-fantasy-replay-parser"


@dataclass(frozen=True)
class JavaDependency:
    filename: str
    maven_path: str
    sha256: str


JAVA_DEPENDENCIES = (
    JavaDependency(
        "clarity-4.0.1.jar",
        "com/skadistats/clarity/4.0.1/clarity-4.0.1.jar",
        "445c129ddadf2906972108d82aa73b6e152b21ed3bfe1ed62612ec6f39ea9de8",
    ),
    JavaDependency(
        "clarity-protobuf-6.1.jar",
        "com/skadistats/clarity-protobuf/6.1/clarity-protobuf-6.1.jar",
        "021c45dbad3fe46dc99b3753db2f68df96fdc6cafbc7386e46684df5aca149ce",
    ),
    JavaDependency(
        "snappy-java-1.1.10.4.jar",
        "org/xerial/snappy/snappy-java/1.1.10.4/snappy-java-1.1.10.4.jar",
        "55b30c94e5c4cc2d4b6976916098d0678a8a6cc7427fa8c875621bd94e731ac8",
    ),
    JavaDependency(
        "slf4j-api-2.0.7.jar",
        "org/slf4j/slf4j-api/2.0.7/slf4j-api-2.0.7.jar",
        "5d6298b93a1905c32cda6478808ac14c2d4a47e91535e53c41f7feeb85d946f4",
    ),
    JavaDependency(
        "fastutil-core-8.5.12.jar",
        "it/unimi/dsi/fastutil-core/8.5.12/fastutil-core-8.5.12.jar",
        "f31c20f5b06312f3d5e06e6160a32e274d819aa6cebf27528b26b6b5c0c1df19",
    ),
)

MAVEN_BASE_URLS = (
    "https://repo.maven.apache.org/maven2",
    "https://maven.aliyun.com/repository/central",
)


JAVA_SOURCE = r'''import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

import skadistats.clarity.io.Util;
import skadistats.clarity.model.CombatLogEntry;
import skadistats.clarity.model.Entity;
import skadistats.clarity.model.FieldPath;
import skadistats.clarity.processor.entities.Entities;
import skadistats.clarity.processor.entities.UsesEntities;
import skadistats.clarity.processor.gameevents.OnCombatLogEntry;
import skadistats.clarity.processor.runner.Context;
import skadistats.clarity.processor.runner.SimpleRunner;
import skadistats.clarity.source.MappedFileSource;

@UsesEntities
public final class ReplayFantasyStats {
    // Calibrated with replay 8917451314: all six stated Dire-fountain deaths
    // are within 5.45 grid units, while the nearest preceding outside death is
    // 11.41 units away. Eight cells equal 1024 Source 2 world units.
    private static final double FOUNTAIN_RADIUS = 8.0;
    private final List<DeathRecord> tormentorDeaths = new ArrayList<>();
    private final List<DeathRecord> fountainDeaths = new ArrayList<>();
    private Float firstBloodTimestamp;
    private Float firstHeroDeathTimestamp;

    private record PlayerIdentity(
        int teamNumber,
        int teamPosition,
        int playerSlot,
        long steamId,
        int heroId,
        String heroName,
        Entity hero
    ) {}

    private record DeathRecord(
        float timestamp,
        PlayerIdentity player,
        String attacker,
        Integer fountainTeamNumber,
        Boolean ownFountain,
        Double fountainDistance
    ) {}

    @SuppressWarnings("unchecked")
    private static <T> T property(Entity entity, String name) {
        if (entity == null) return null;
        FieldPath path = entity.getDtClass().getFieldPathForName(name);
        if (path == null) return null;
        return (T) entity.getPropertyForFieldPath(path);
    }

    private static String jsonNumber(Object value) {
        return value == null ? "null" : String.valueOf(value);
    }

    private static String jsonString(String value) {
        if (value == null) return "null";
        StringBuilder output = new StringBuilder("\"");
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '\\' -> output.append("\\\\");
                case '\"' -> output.append("\\\"");
                case '\n' -> output.append("\\n");
                case '\r' -> output.append("\\r");
                case '\t' -> output.append("\\t");
                default -> {
                    if (character < 0x20) {
                        output.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    } else {
                        output.append(character);
                    }
                }
            }
        }
        return output.append('\"').toString();
    }

    private static String fixed(Double value) {
        return value == null ? "null" : String.format(Locale.ROOT, "%.4f", value);
    }

    private static Double coordinate(Entity entity, String axis) {
        Number cell = property(entity, "CBodyComponent.m_cell" + axis);
        Number vector = property(entity, "CBodyComponent.m_vec" + axis);
        if (cell == null || vector == null) return null;
        return cell.doubleValue() + vector.doubleValue() / 128.0;
    }

    private static String combatLogName(Entity hero) {
        if (hero == null) return null;
        String className = hero.getDtClass().getDtName();
        String prefix = "CDOTA_Unit_Hero_";
        if (!className.startsWith(prefix)) return null;
        String ending = className.substring(prefix.length());
        return "npc_dota_hero"
            + ending.replaceAll("([A-Z])", "_$1").replaceAll("_+", "_")
                .toLowerCase(Locale.ROOT);
    }

    private static Entity fountain(Entities entities, int teamNumber) {
        Entity rules = entities.getByDtName("CDOTAGamerulesProxy");
        Number handle = property(
            rules,
            "m_pGameRules.m_hTeamFountains." + Util.arrayIdxToString(teamNumber)
        );
        Entity result = handle == null ? null : entities.getByHandle(handle.intValue());
        if (result != null) return result;

        Iterator<Entity> candidates = entities.getAllByDtName("CDOTA_Unit_Fountain");
        while (candidates.hasNext()) {
            Entity candidate = candidates.next();
            Number team = property(candidate, "m_iTeamNum");
            if (team != null && team.intValue() == teamNumber) return candidate;
        }
        return null;
    }

    private static Double distance(Entity hero, Entity fountain) {
        Double heroX = coordinate(hero, "X");
        Double heroY = coordinate(hero, "Y");
        Double fountainX = coordinate(fountain, "X");
        Double fountainY = coordinate(fountain, "Y");
        if (heroX == null || heroY == null || fountainX == null || fountainY == null) {
            return null;
        }
        return Math.hypot(heroX - fountainX, heroY - fountainY);
    }

    private static PlayerIdentity playerForHero(
        Entities entities,
        int targetTeam,
        String targetName
    ) {
        Entity resource = entities.getByDtName("CDOTA_PlayerResource");
        if (resource == null) return null;
        for (int index = 0; index < 64; index++) {
            String arrayIndex = Util.arrayIdxToString(index);
            Number team = property(resource, "m_vecPlayerData." + arrayIndex + ".m_iPlayerTeam");
            Number handle = property(resource, "m_vecPlayerTeamData." + arrayIndex + ".m_hSelectedHero");
            if (team == null || handle == null || team.intValue() != targetTeam) continue;
            Entity hero = entities.getByHandle(handle.intValue());
            String heroName = combatLogName(hero);
            if (hero == null || heroName == null || !heroName.equals(targetName)) continue;

            Number position = property(
                resource,
                "m_vecPlayerTeamData." + arrayIndex + ".m_iTeamSlot"
            );
            Number heroId = property(
                resource,
                "m_vecPlayerTeamData." + arrayIndex + ".m_nSelectedHeroID"
            );
            Number steamId = property(
                resource,
                "m_vecPlayerData." + arrayIndex + ".m_iPlayerSteamID"
            );
            int teamPosition = position == null ? -1 : position.intValue();
            int playerSlot = targetTeam == 2 ? teamPosition : 128 + teamPosition;
            return new PlayerIdentity(
                targetTeam,
                teamPosition,
                playerSlot,
                steamId == null ? 0L : steamId.longValue(),
                heroId == null ? 0 : heroId.intValue(),
                heroName,
                hero
            );
        }
        return null;
    }

    @OnCombatLogEntry
    public void onCombatLogEntry(Context context, CombatLogEntry entry) {
        if (entry == null || !entry.hasType()) return;
        String type = entry.getType().name();
        if (type.equals("DOTA_COMBATLOG_FIRST_BLOOD") && entry.hasTimestamp()) {
            if (firstBloodTimestamp == null) firstBloodTimestamp = entry.getTimestamp();
            return;
        }
        if (!type.equals("DOTA_COMBATLOG_DEATH")) return;
        if (!entry.hasTargetHero() || !entry.isTargetHero() || entry.isTargetIllusion()) return;
        if (!entry.hasTargetName() || !entry.hasTargetTeam() || !entry.hasTimestamp()) return;

        if (firstHeroDeathTimestamp == null) firstHeroDeathTimestamp = entry.getTimestamp();
        Entities entities = context.getProcessor(Entities.class);
        PlayerIdentity player = playerForHero(
            entities,
            entry.getTargetTeam(),
            entry.getTargetName()
        );
        if (player == null) return;

        String attacker = entry.hasAttackerName() ? entry.getAttackerName() : "";
        if (attacker.equals("npc_dota_miniboss")) {
            tormentorDeaths.add(
                new DeathRecord(entry.getTimestamp(), player, attacker, null, null, null)
            );
        }

        Double radiantDistance = distance(player.hero(), fountain(entities, 2));
        Double direDistance = distance(player.hero(), fountain(entities, 3));
        Integer fountainTeam = null;
        Double fountainDistance = null;
        if (radiantDistance != null && radiantDistance <= FOUNTAIN_RADIUS) {
            fountainTeam = 2;
            fountainDistance = radiantDistance;
        }
        if (
            direDistance != null
            && direDistance <= FOUNTAIN_RADIUS
            && (fountainDistance == null || direDistance < fountainDistance)
        ) {
            fountainTeam = 3;
            fountainDistance = direDistance;
        }
        if (fountainTeam != null) {
            fountainDeaths.add(
                new DeathRecord(
                    entry.getTimestamp(),
                    player,
                    attacker,
                    fountainTeam,
                    fountainTeam == player.teamNumber(),
                    fountainDistance
                )
            );
        }
    }

    private static PlayerIdentity playerAtPosition(
        Entities entities,
        int teamNumber,
        int position
    ) {
        Entity resource = entities.getByDtName("CDOTA_PlayerResource");
        if (resource == null) return null;
        for (int index = 0; index < 64; index++) {
            String arrayIndex = Util.arrayIdxToString(index);
            Number team = property(resource, "m_vecPlayerData." + arrayIndex + ".m_iPlayerTeam");
            Number slot = property(resource, "m_vecPlayerTeamData." + arrayIndex + ".m_iTeamSlot");
            if (
                team == null || slot == null
                || team.intValue() != teamNumber || slot.intValue() != position
            ) continue;
            Number handle = property(resource, "m_vecPlayerTeamData." + arrayIndex + ".m_hSelectedHero");
            Entity hero = handle == null ? null : entities.getByHandle(handle.intValue());
            Number heroId = property(resource, "m_vecPlayerTeamData." + arrayIndex + ".m_nSelectedHeroID");
            Number steamId = property(resource, "m_vecPlayerData." + arrayIndex + ".m_iPlayerSteamID");
            int playerSlot = teamNumber == 2 ? position : 128 + position;
            return new PlayerIdentity(
                teamNumber,
                position,
                playerSlot,
                steamId == null ? 0L : steamId.longValue(),
                heroId == null ? 0 : heroId.intValue(),
                combatLogName(hero),
                hero
            );
        }
        return null;
    }

    private int emitTeam(Entities entities, int teamNumber, String side) {
        Entity data = entities.getByDtName("CDOTA_Data" + side);
        if (data == null) {
            throw new IllegalStateException("Missing CDOTA_Data" + side);
        }

        int emitted = 0;
        for (int position = 0; position < 5; position++) {
            String index = Util.arrayIdxToString(position);
            String prefix = "m_vecDataTeam." + index + ".";
            Object steamId = property(data, prefix + "m_iPlayerSteamID");
            Object madstones = property(data, prefix + "m_nAcquiredMadstone");
            Object currentMadstones = property(data, prefix + "m_nCurrentMadstone");
            Object neutralTokens = property(data, prefix + "m_iNeutralTokensFound");
            Object watchers = property(data, prefix + "m_iWatchersTaken");
            Object lotuses = property(data, prefix + "m_iLotusesTaken");
            int playerSlot = teamNumber == 2 ? position : 128 + position;
            PlayerIdentity identity = playerAtPosition(entities, teamNumber, position);
            Object heroId = identity == null || identity.heroId() <= 0 ? null : identity.heroId();
            String heroName = identity == null ? null : identity.heroName();

            System.out.printf(
                "{\"recordType\":\"player\",\"teamNumber\":%d," +
                "\"position\":%d,\"playerSlot\":%d,\"steamId\":%s," +
                "\"heroId\":%s,\"heroName\":%s,\"madstonesCollected\":%s," +
                "\"currentMadstones\":%s,\"neutralTokensFound\":%s," +
                "\"watchersCaptured\":%s," +
                "\"lotusesCollected\":%s}%n",
                teamNumber,
                position,
                playerSlot,
                jsonNumber(steamId),
                jsonNumber(heroId),
                jsonString(heroName),
                jsonNumber(madstones),
                jsonNumber(currentMadstones),
                jsonNumber(neutralTokens),
                jsonNumber(watchers),
                jsonNumber(lotuses)
            );
            emitted++;
        }
        return emitted;
    }

    private static void emitDeathArray(
        List<DeathRecord> events,
        double gameStartTime
    ) {
        System.out.print("[");
        for (int index = 0; index < events.size(); index++) {
            if (index > 0) System.out.print(",");
            DeathRecord event = events.get(index);
            PlayerIdentity player = event.player();
            System.out.printf(
                Locale.ROOT,
                "{\"time\":%.4f,\"teamNumber\":%d,\"teamPosition\":%d," +
                "\"playerSlot\":%d,\"steamId\":%d,\"heroId\":%d," +
                "\"heroName\":%s,\"attacker\":%s," +
                "\"fountainTeamNumber\":%s,\"isOwnFountain\":%s," +
                "\"fountainDistance\":%s}",
                event.timestamp() - gameStartTime,
                player.teamNumber(),
                player.teamPosition(),
                player.playerSlot(),
                player.steamId(),
                player.heroId(),
                jsonString(player.heroName()),
                jsonString(event.attacker()),
                jsonNumber(event.fountainTeamNumber()),
                jsonNumber(event.ownFountain()),
                fixed(event.fountainDistance())
            );
        }
        System.out.print("]");
    }

    private void emitMatch(Entities entities) {
        Entity rules = entities.getByDtName("CDOTAGamerulesProxy");
        Number gameStart = property(rules, "m_pGameRules.m_flGameStartTime");
        Number seriesType = property(rules, "m_pGameRules.m_nSeriesType");
        Number radiantSeriesWins = property(rules, "m_pGameRules.m_nRadiantSeriesWins");
        Number direSeriesWins = property(rules, "m_pGameRules.m_nDireSeriesWins");
        double gameStartTime = gameStart == null ? 0.0 : gameStart.doubleValue();
        Float firstBlood = firstBloodTimestamp != null
            ? firstBloodTimestamp
            : firstHeroDeathTimestamp;

        System.out.print("{\"recordType\":\"match\",");
        System.out.print("\"gameStartTime\":" + fixed(gameStartTime) + ",");
        System.out.print(
            "\"firstBloodTime\":"
            + (firstBlood == null ? "null" : fixed(firstBlood.doubleValue() - gameStartTime))
            + ","
        );
        System.out.print("\"seriesType\":" + jsonNumber(seriesType) + ",");
        System.out.print("\"radiantSeriesWins\":" + jsonNumber(radiantSeriesWins) + ",");
        System.out.print("\"direSeriesWins\":" + jsonNumber(direSeriesWins) + ",");
        System.out.print("\"fountainRadius\":" + fixed(FOUNTAIN_RADIUS) + ",");
        System.out.print("\"tormentorDeaths\":");
        emitDeathArray(tormentorDeaths, gameStartTime);
        System.out.print(",\"fountainDeaths\":");
        emitDeathArray(fountainDeaths, gameStartTime);
        System.out.println("}");
    }

    private void emit(Context context) {
        Entities entities = context.getProcessor(Entities.class);
        int count = emitTeam(entities, 2, "Radiant");
        count += emitTeam(entities, 3, "Dire");
        if (count != 10) {
            throw new IllegalStateException("Expected 10 players, emitted " + count);
        }
        emitMatch(entities);
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            System.err.println("Usage: ReplayFantasyStats <replay.dem>");
            System.exit(2);
        }
        ReplayFantasyStats parser = new ReplayFantasyStats();
        try (MappedFileSource source = new MappedFileSource(args[0])) {
            SimpleRunner runner = new SimpleRunner(source);
            runner.runWith(parser);
            parser.emit(runner.getContext());
        }
    }
}
'''


MANIFEST_SQL_TEMPLATE = """
SELECT match_id, start_time, duration, cluster, replay_salt
FROM matches
WHERE leagueid = {league_id}
ORDER BY start_time, match_id
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--replay-root",
        type=Path,
        default=DEFAULT_REPLAY_ROOT,
        help=f"Replay cache directory (default: {DEFAULT_REPLAY_ROOT})",
    )
    parser.add_argument(
        "--tool-cache",
        type=Path,
        default=default_tool_cache(),
        help="Cache directory for Clarity jars and the compiled helper",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Checkpoint/result JSON (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--replay",
        type=Path,
        help="Parse one local .dem or .dem.bz2 instead of the EWC manifest",
    )
    parser.add_argument(
        "--match-id",
        type=int,
        action="append",
        help="Only process this match ID; may be supplied multiple times",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Only process the first N selected matches (for smoke testing)",
    )
    parser.add_argument(
        "--download-only",
        action="store_true",
        help="Download compressed replays without compiling/parsing them",
    )
    parser.add_argument(
        "--parse-only",
        action="store_true",
        help="Do not download; require every compressed replay in the cache",
    )
    parser.add_argument(
        "--keep-dem",
        action="store_true",
        help="Retain decompressed .dem files after successful parsing",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reparse matches already present in the checkpoint JSON",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop at the first failed download or parse",
    )
    parser.add_argument(
        "--allow-missing-fields",
        action="store_true",
        help="Write null if a replay lacks one of the three Fantasy fields",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Network socket timeout in seconds (default: 120)",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=4,
        help="Download attempts per URL (default: 4)",
    )
    parser.add_argument(
        "--merge-dataset",
        type=Path,
        help="Existing full dataset JSON to merge after parsing",
    )
    parser.add_argument(
        "--merge-output",
        type=Path,
        help="Merged full-dataset output; required with --merge-dataset",
    )
    parser.add_argument(
        "--summary-output",
        type=Path,
        help="Optional compact summary generated from the merged dataset",
    )
    parser.add_argument(
        "--browser-data-output",
        type=Path,
        help="Optional classic JS wrapper generated from the merged dataset",
    )
    parser.add_argument(
        "--allow-partial-merge",
        action="store_true",
        help="Allow merging fewer replay results than the dataset contains",
    )
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    if args.download_only and args.parse_only:
        parser.error("--download-only and --parse-only cannot be combined")
    if args.replay and (args.download_only or args.parse_only):
        parser.error("--replay cannot be combined with download/parse-only modes")
    if args.merge_dataset and not args.merge_output:
        parser.error("--merge-output is required with --merge-dataset")
    if args.merge_output and not args.merge_dataset:
        parser.error("--merge-output requires --merge-dataset")
    if (args.summary_output or args.browser_data_output) and not args.merge_dataset:
        parser.error("summary/browser outputs require --merge-dataset")
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    if args.retries < 1:
        parser.error("--retries must be positive")
    return args


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def atomic_write_json(path: Path, value: Any, compact: bool = False) -> None:
    if compact:
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    else:
        payload = json.dumps(value, ensure_ascii=False, indent=2)
    atomic_write_text(path, payload + "\n")


def request_json(url: str, timeout: int) -> dict[str, Any]:
    request = Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.load(response)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {body[:400]}") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not reach {url}: {exc}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Expected a JSON object from {url}")
    return payload


def fetch_manifest(
    timeout: int,
    league_id: int = LEAGUE_ID,
    expected_matches: int | None = None,
) -> list[dict[str, Any]]:
    sql = " ".join(
        MANIFEST_SQL_TEMPLATE.format(league_id=int(league_id)).split()
    )
    url = f"{OPEN_DOTA_EXPLORER}?{urlencode({'sql': sql})}"
    payload = request_json(url, timeout)
    if payload.get("err"):
        raise RuntimeError(f"OpenDota Explorer error: {payload['err']}")
    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise RuntimeError("OpenDota Explorer response has no rows array")

    manifest: list[dict[str, Any]] = []
    for row in rows:
        match_id = int(row["match_id"])
        cluster = int(row["cluster"])
        replay_url: str | None = None
        replay_salt_value = row.get("replay_salt")

        # Three EWC rows currently have a null replay_salt in OpenDota's SQL
        # table, although the parsed match endpoint still exposes a valid
        # replay_url.  Resolve those three URLs individually instead of losing
        # otherwise downloadable matches from the manifest.
        if replay_salt_value is None:
            match_payload = request_json(
                f"{OPEN_DOTA_API}/matches/{match_id}", timeout
            )
            candidate = match_payload.get("replay_url")
            if not isinstance(candidate, str):
                raise RuntimeError(
                    f"OpenDota has no replay URL for match {match_id}"
                )
            url_match = re.search(r"/(\d+)_(\d+)\.dem\.bz2(?:\?|$)", candidate)
            if not url_match or int(url_match.group(1)) != match_id:
                raise RuntimeError(
                    f"Unexpected replay URL for match {match_id}: {candidate}"
                )
            replay_salt = int(url_match.group(2))
            replay_url = candidate
        else:
            replay_salt = int(replay_salt_value)

        filename = f"{match_id}_{replay_salt}.dem.bz2"
        if replay_url is None:
            replay_url = f"http://replay{cluster}.valve.net/570/{filename}"
        manifest.append(
            {
                "matchId": match_id,
                "startTime": int(row["start_time"]),
                "duration": int(row["duration"]),
                "cluster": cluster,
                "replaySalt": replay_salt,
                "filename": filename,
                "replayUrl": replay_url,
            }
        )

    if expected_matches is not None and len(manifest) != expected_matches:
        raise RuntimeError(
            f"Expected {expected_matches} league matches, got {len(manifest)}"
        )
    if len({item["matchId"] for item in manifest}) != len(manifest):
        raise RuntimeError("OpenDota manifest contains duplicate match IDs")
    return manifest


def copy_stream(source: BinaryIO, target: BinaryIO) -> int:
    copied = 0
    while True:
        chunk = source.read(CHUNK_SIZE)
        if not chunk:
            break
        target.write(chunk)
        copied += len(chunk)
    return copied


def download_file(
    urls: list[str],
    target: Path,
    timeout: int,
    retries: int,
    expected_sha256: str | None = None,
    resume: bool = False,
    quiet: bool = False,
) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if expected_sha256 is None or sha256_file(target) == expected_sha256:
            return
        target.rename(target.with_name(target.name + ".bad-checksum"))

    partial = target.with_name(target.name + ".part")
    last_error: Exception | None = None
    for url in urls:
        for attempt in range(1, retries + 1):
            try:
                existing = partial.stat().st_size if resume and partial.exists() else 0
                headers = {"User-Agent": USER_AGENT}
                if existing:
                    headers["Range"] = f"bytes={existing}-"
                request = Request(url, headers=headers)
                with urlopen(request, timeout=timeout) as response:
                    status = getattr(response, "status", 200)
                    append = bool(existing and status == 206)
                    if not append:
                        existing = 0
                    mode = "ab" if append else "wb"
                    total_header = response.headers.get("Content-Range")
                    total: int | None = None
                    if total_header and "/" in total_header:
                        tail = total_header.rsplit("/", 1)[1]
                        if tail.isdigit():
                            total = int(tail)
                    if total is None and response.headers.get("Content-Length"):
                        total = existing + int(response.headers["Content-Length"])

                    with partial.open(mode) as handle:
                        copy_stream(response, handle)
                        handle.flush()
                        os.fsync(handle.fileno())

                if total is not None and partial.stat().st_size != total:
                    raise RuntimeError(
                        f"Incomplete download: {partial.stat().st_size}/{total} bytes"
                    )
                if expected_sha256 and sha256_file(partial) != expected_sha256:
                    raise RuntimeError(f"SHA-256 mismatch for {url}")
                os.replace(partial, target)
                if not quiet:
                    size_mib = target.stat().st_size / (1024 * 1024)
                    print(f"Downloaded {target.name} ({size_mib:.1f} MiB)")
                return
            except (HTTPError, URLError, TimeoutError, OSError, RuntimeError) as exc:
                last_error = exc
                if not quiet:
                    print(
                        f"Download attempt {attempt}/{retries} failed for {url}: {exc}",
                        file=sys.stderr,
                    )
                if attempt < retries:
                    time.sleep(min(2 ** (attempt - 1), 10))
        if partial.exists() and not resume:
            partial.unlink()
    raise RuntimeError(f"Could not download {target.name}: {last_error}")


def require_java() -> tuple[str, str]:
    java = shutil.which("java")
    javac = shutil.which("javac")
    if not java or not javac:
        raise RuntimeError("Java/Javac 17 or newer is required and was not found")
    probe = subprocess.run(
        [javac, "-version"], capture_output=True, text=True, check=False
    )
    version_text = (probe.stdout + " " + probe.stderr).strip()
    match = re.search(r"(?:javac\s+)?(\d+)", version_text)
    if probe.returncode != 0 or not match or int(match.group(1)) < 17:
        raise RuntimeError(f"Java/Javac 17+ is required; found {version_text!r}")
    return java, javac


def ensure_java_helper(
    tool_cache: Path, timeout: int, retries: int, quiet: bool
) -> tuple[str, str]:
    java, javac = require_java()
    jar_dir = tool_cache / "jars"
    class_dir = tool_cache / "classes"
    source_path = tool_cache / "src" / "ReplayFantasyStats.java"
    jar_paths: list[Path] = []

    for dependency in JAVA_DEPENDENCIES:
        target = jar_dir / dependency.filename
        urls = [
            f"{base}/{dependency.maven_path}" for base in MAVEN_BASE_URLS
        ]
        download_file(
            urls,
            target,
            timeout,
            retries,
            expected_sha256=dependency.sha256,
            quiet=quiet,
        )
        jar_paths.append(target)

    helper_hash = hashlib.sha256(JAVA_SOURCE.encode("utf-8")).hexdigest()
    marker = tool_cache / "helper.sha256"
    class_file = class_dir / "ReplayFantasyStats.class"
    current_marker = marker.read_text(encoding="ascii").strip() if marker.exists() else ""
    if not class_file.exists() or current_marker != helper_hash:
        atomic_write_text(source_path, JAVA_SOURCE)
        class_dir.mkdir(parents=True, exist_ok=True)
        classpath = os.pathsep.join(str(path) for path in jar_paths)
        command = [
            javac,
            "-encoding",
            "UTF-8",
            "-source",
            "17",
            "-target",
            "17",
            "-cp",
            classpath,
            "-d",
            str(class_dir),
            str(source_path),
        ]
        environment = os.environ.copy()
        environment.pop("JDK_JAVA_OPTIONS", None)
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=environment,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(
                "Could not compile the Clarity helper:\n"
                + completed.stdout
                + completed.stderr
            )
        atomic_write_text(marker, helper_hash + "\n")
        if not quiet:
            print(f"Compiled replay helper in {tool_cache}")

    runtime_classpath = os.pathsep.join(
        [str(class_dir), *(str(path) for path in jar_paths)]
    )
    return java, runtime_classpath


def verify_bz2_header(path: Path) -> None:
    with path.open("rb") as handle:
        if handle.read(3) != b"BZh":
            raise RuntimeError(f"Not a bzip2 replay: {path}")


def verify_dem_header(path: Path) -> None:
    with path.open("rb") as handle:
        if handle.read(7) != b"PBDEMS2":
            raise RuntimeError(f"Not a Source 2 Dota replay: {path}")


def replay_paths(replay_root: Path, item: dict[str, Any]) -> tuple[Path, Path]:
    compressed = replay_root / "compressed" / item["filename"]
    dem = replay_root / "dem" / item["filename"].removesuffix(".bz2")
    return compressed, dem


def download_replay(
    item: dict[str, Any], args: argparse.Namespace
) -> Path:
    compressed, _ = replay_paths(args.replay_root, item)
    if args.parse_only:
        if not compressed.exists():
            raise RuntimeError(f"Missing cached replay: {compressed}")
    else:
        download_file(
            [item["replayUrl"]],
            compressed,
            args.timeout,
            args.retries,
            resume=True,
            quiet=args.quiet,
        )
    verify_bz2_header(compressed)
    return compressed


def decompress_replay(compressed: Path, dem: Path, quiet: bool) -> Path:
    if dem.exists():
        verify_dem_header(dem)
        return dem
    dem.parent.mkdir(parents=True, exist_ok=True)
    partial = dem.with_name(dem.name + ".part")
    if partial.exists():
        partial.unlink()
    try:
        with bz2.open(compressed, "rb") as source, partial.open("wb") as target:
            copy_stream(source, target)
            target.flush()
            os.fsync(target.fileno())
        verify_dem_header(partial)
        os.replace(partial, dem)
    except (OSError, EOFError) as exc:
        if partial.exists():
            partial.unlink()
        raise RuntimeError(f"Could not decompress {compressed}: {exc}") from exc
    if not quiet:
        size_mib = dem.stat().st_size / (1024 * 1024)
        print(f"Decompressed {dem.name} ({size_mib:.1f} MiB)")
    return dem


def normalize_player(raw: dict[str, Any], allow_missing: bool) -> dict[str, Any]:
    required = (
        "steamId",
        "heroId",
        "heroName",
        "madstonesCollected",
        "neutralTokensFound",
        "watchersCaptured",
        "lotusesCollected",
    )
    missing = [key for key in required if raw.get(key) is None]
    if missing and not allow_missing:
        raise RuntimeError(f"Replay player is missing fields: {', '.join(missing)}")

    steam_id = int(raw["steamId"]) if raw.get("steamId") is not None else None
    account_id: int | None = None
    if steam_id is not None:
        account_id = steam_id - STEAM_ID64_BASE
        if account_id < 0 or account_id > 0xFFFFFFFF:
            raise RuntimeError(f"Invalid Steam ID 64: {steam_id}")

    def optional_nonnegative_int(name: str) -> int | None:
        value = raw.get(name)
        if value is None:
            return None
        number = int(value)
        if number < 0:
            raise RuntimeError(f"Negative {name}: {number}")
        return number

    team_number = int(raw["teamNumber"])
    if team_number not in (2, 3):
        raise RuntimeError(f"Unexpected team number: {team_number}")
    return {
        "accountId": account_id,
        "steamId": str(steam_id) if steam_id is not None else None,
        "team": "radiant" if team_number == 2 else "dire",
        "teamNumber": team_number,
        "teamPosition": int(raw["position"]),
        "playerSlot": int(raw["playerSlot"]),
        "heroId": optional_nonnegative_int("heroId"),
        "heroName": (
            str(raw["heroName"]) if raw.get("heroName") is not None else None
        ),
        "madstonesCollected": optional_nonnegative_int("madstonesCollected"),
        "currentMadstones": optional_nonnegative_int("currentMadstones"),
        "neutralTokensFound": optional_nonnegative_int("neutralTokensFound"),
        "watchersCaptured": optional_nonnegative_int("watchersCaptured"),
        "lotusesCollected": optional_nonnegative_int("lotusesCollected"),
    }


def normalize_death_event(raw: dict[str, Any]) -> dict[str, Any]:
    steam_id = int(raw["steamId"]) if raw.get("steamId") is not None else None
    account_id: int | None = None
    if steam_id:
        account_id = steam_id - STEAM_ID64_BASE
        if account_id < 0 or account_id > 0xFFFFFFFF:
            raise RuntimeError(f"Invalid death-event Steam ID 64: {steam_id}")
    return {
        "time": normalized_number(float(raw["time"]), 4),
        "accountId": account_id,
        "steamId": str(steam_id) if steam_id else None,
        "teamNumber": int(raw["teamNumber"]),
        "teamPosition": int(raw["teamPosition"]),
        "playerSlot": int(raw["playerSlot"]),
        "heroId": int(raw["heroId"]),
        "heroName": str(raw["heroName"]),
        "attacker": str(raw.get("attacker") or ""),
        "fountainTeamNumber": (
            int(raw["fountainTeamNumber"])
            if raw.get("fountainTeamNumber") is not None
            else None
        ),
        "isOwnFountain": (
            bool(raw["isOwnFountain"])
            if raw.get("isOwnFountain") is not None
            else None
        ),
        "fountainDistance": (
            normalized_number(float(raw["fountainDistance"]), 4)
            if raw.get("fountainDistance") is not None
            else None
        ),
    }


def normalize_match_record(raw: dict[str, Any]) -> dict[str, Any]:
    fountain_deaths = [
        normalize_death_event(event) for event in raw.get("fountainDeaths", [])
    ]
    return {
        "gameStartTime": normalized_number(float(raw["gameStartTime"]), 4),
        "firstBloodTime": (
            normalized_number(float(raw["firstBloodTime"]), 4)
            if raw.get("firstBloodTime") is not None
            else None
        ),
        "seriesType": (
            int(raw["seriesType"]) if raw.get("seriesType") is not None else None
        ),
        "radiantSeriesWins": (
            int(raw["radiantSeriesWins"])
            if raw.get("radiantSeriesWins") is not None
            else None
        ),
        "direSeriesWins": (
            int(raw["direSeriesWins"])
            if raw.get("direSeriesWins") is not None
            else None
        ),
        "fountainRadius": normalized_number(float(raw["fountainRadius"]), 4),
        "tormentorDeaths": [
            normalize_death_event(event) for event in raw.get("tormentorDeaths", [])
        ],
        "fountainDeaths": fountain_deaths,
        "ownFountainDeaths": [
            event for event in fountain_deaths if event["isOwnFountain"] is True
        ],
    }


def parse_replay(
    dem: Path,
    java: str,
    classpath: str,
    allow_missing: bool,
    timeout: int = 600,
) -> dict[str, Any]:
    verify_dem_header(dem)
    environment = os.environ.copy()
    environment.pop("JDK_JAVA_OPTIONS", None)
    completed = subprocess.run(
        [java, "-Xmx2g", "-cp", classpath, "ReplayFantasyStats", str(dem)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        env=environment,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"Clarity failed for {dem.name} (exit {completed.returncode}):\n"
            + completed.stderr[-4000:]
        )

    players: list[dict[str, Any]] = []
    match_record: dict[str, Any] | None = None
    for line in completed.stdout.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid helper JSON: {line}") from exc
        record_type = raw.get("recordType")
        if record_type == "match":
            if match_record is not None:
                raise RuntimeError("Replay helper emitted more than one match record")
            match_record = normalize_match_record(raw)
        elif record_type in (None, "player"):
            players.append(normalize_player(raw, allow_missing))
        else:
            raise RuntimeError(f"Unknown replay record type: {record_type!r}")

    if len(players) != 10:
        raise RuntimeError(f"Expected 10 replay players, found {len(players)}")
    account_ids = [player["accountId"] for player in players]
    if None not in account_ids and len(set(account_ids)) != 10:
        raise RuntimeError("Replay contains duplicate player account IDs")
    if match_record is None:
        raise RuntimeError("Replay helper did not emit match title data")
    players.sort(key=lambda player: player["playerSlot"])
    return {"players": players, "titleData": match_record}


def new_state() -> dict[str, Any]:
    return {
        "meta": {
            "schemaVersion": 4,
            "leagueId": LEAGUE_ID,
            "leagueName": LEAGUE_NAME,
            "artifact": "replayFantasyStats",
            "generatedAt": utc_now(),
            "parser": "Clarity 4.0.1",
            "fieldProvenance": {
                "madstonesCollected": (
                    "final replay state m_vecDataTeam[*].m_nAcquiredMadstone; "
                    "retained for comparison"
                ),
                "neutralTokensFound": (
                    "final replay state m_vecDataTeam[*].m_iNeutralTokensFound; "
                    "scored Madstone source"
                ),
                "watchersCaptured": (
                    "final replay state m_vecDataTeam[*].m_iWatchersTaken"
                ),
                "lotusesCollected": (
                    "final replay state m_vecDataTeam[*].m_iLotusesTaken"
                ),
                "heroId/heroName": (
                    "CDOTA_PlayerResource selected hero"
                ),
                "titleData": (
                    "combat-log first blood/Tormentor deaths and replay-position "
                    "fountain deaths"
                ),
            },
        },
        "coverage": {
            "manifestMatches": EXPECTED_MATCHES,
            "completedMatches": 0,
            "failedMatches": 0,
            "playerGameRows": 0,
        },
        "matches": [],
        "errors": [],
    }


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return new_state()
    state = json.loads(path.read_text(encoding="utf-8"))
    if state.get("meta", {}).get("leagueId") != LEAGUE_ID:
        raise RuntimeError(f"Checkpoint {path} is for a different league")
    if not isinstance(state.get("matches"), list):
        raise RuntimeError(f"Checkpoint {path} has no matches array")
    state.setdefault("errors", [])
    return state


def save_state(
    path: Path,
    match_map: dict[int, dict[str, Any]],
    error_map: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    state = new_state()
    state["matches"] = sorted(
        match_map.values(), key=lambda match: (match.get("startTime", 0), match["matchId"])
    )
    state["errors"] = sorted(error_map.values(), key=lambda error: error["matchId"])
    state["coverage"] = {
        "manifestMatches": EXPECTED_MATCHES,
        "completedMatches": len(match_map),
        "failedMatches": len(error_map),
        "playerGameRows": sum(len(match["players"]) for match in match_map.values()),
    }
    atomic_write_json(path, state)
    return state


def local_replay_match_id(path: Path) -> int | None:
    match = re.match(r"(\d{8,})", path.name)
    return int(match.group(1)) if match else None


def parse_one_local(args: argparse.Namespace) -> int:
    assert args.replay is not None
    source = args.replay.resolve()
    if not source.exists():
        raise RuntimeError(f"Replay does not exist: {source}")
    java, classpath = ensure_java_helper(
        args.tool_cache, args.timeout, args.retries, args.quiet
    )

    created_dem = False
    if source.name.endswith(".dem.bz2"):
        verify_bz2_header(source)
        dem = args.replay_root / "dem" / source.name.removesuffix(".bz2")
        existed = dem.exists()
        dem = decompress_replay(source, dem, args.quiet)
        created_dem = not existed
    elif source.suffix == ".dem":
        dem = source
    else:
        raise RuntimeError("--replay must point to a .dem or .dem.bz2 file")

    try:
        parsed = parse_replay(
            dem, java, classpath, args.allow_missing_fields
        )
    finally:
        if created_dem and not args.keep_dem and dem.exists():
            dem.unlink()

    value = {
        "matchId": local_replay_match_id(source),
        "sourceFile": source.name,
        **parsed,
    }
    print(json.dumps(value, ensure_ascii=False, indent=2))
    return 0


def select_manifest(
    manifest: list[dict[str, Any]], args: argparse.Namespace
) -> list[dict[str, Any]]:
    selected = manifest
    if args.match_id:
        requested = set(args.match_id)
        selected = [item for item in selected if item["matchId"] in requested]
        missing = requested - {item["matchId"] for item in selected}
        if missing:
            raise RuntimeError(f"Match IDs are not in EWC 2026: {sorted(missing)}")
    if args.limit is not None:
        selected = selected[: args.limit]
    return selected


def process_manifest(args: argparse.Namespace) -> dict[str, Any]:
    manifest = fetch_manifest(args.timeout)
    selected = select_manifest(manifest, args)
    if not args.quiet:
        print(f"OpenDota manifest: {len(manifest)} matches; selected {len(selected)}")

    if args.download_only:
        for index, item in enumerate(selected, start=1):
            if not args.quiet:
                print(f"[{index}/{len(selected)}] match {item['matchId']}")
            download_replay(item, args)
        return new_state()

    java, classpath = ensure_java_helper(
        args.tool_cache, args.timeout, args.retries, args.quiet
    )
    old_state = load_state(args.output)
    match_map = {
        int(match["matchId"]): match
        for match in old_state.get("matches", [])
        if isinstance(match.get("titleData"), dict)
        and all(player.get("heroId") for player in match.get("players", []))
        and all(
            player.get("neutralTokensFound") is not None
            for player in match.get("players", [])
        )
    }
    error_map = {
        int(error["matchId"]): error for error in old_state.get("errors", [])
    }

    for index, item in enumerate(selected, start=1):
        match_id = item["matchId"]
        if match_id in match_map and not args.force:
            if not args.quiet:
                print(f"[{index}/{len(selected)}] match {match_id}: already parsed")
            continue
        if not args.quiet:
            print(f"[{index}/{len(selected)}] match {match_id}")

        dem: Path | None = None
        created_dem = False
        try:
            compressed = download_replay(item, args)
            _, expected_dem = replay_paths(args.replay_root, item)
            existed = expected_dem.exists()
            dem = decompress_replay(compressed, expected_dem, args.quiet)
            created_dem = not existed
            parsed = parse_replay(
                dem, java, classpath, args.allow_missing_fields
            )
            match_map[match_id] = {
                "matchId": match_id,
                "startTime": item["startTime"],
                "duration": item["duration"],
                "cluster": item["cluster"],
                "replaySalt": item["replaySalt"],
                "replayUrl": item["replayUrl"],
                "replayFile": item["filename"],
                **parsed,
            }
            error_map.pop(match_id, None)
            if not args.quiet:
                print(f"Parsed match {match_id}: 10 players")
        except Exception as exc:  # checkpoint and continue across 157 downloads
            error_map[match_id] = {
                "matchId": match_id,
                "error": str(exc),
                "recordedAt": utc_now(),
            }
            print(f"Match {match_id} failed: {exc}", file=sys.stderr)
            if args.fail_fast:
                save_state(args.output, match_map, error_map)
                raise
        finally:
            if (
                created_dem
                and not args.keep_dem
                and dem is not None
                and dem.exists()
            ):
                dem.unlink()
        save_state(args.output, match_map, error_map)

    return save_state(args.output, match_map, error_map)


def normalized_number(value: float, digits: int = 6) -> int | float:
    rounded = round(value, digits)
    return int(rounded) if math.isclose(rounded, int(rounded)) else rounded


def merge_replay_stats(
    dataset_path: Path,
    output_path: Path,
    state: dict[str, Any],
    allow_partial: bool,
) -> dict[str, Any]:
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    replay_matches = {
        int(match["matchId"]): match for match in state.get("matches", [])
    }
    dataset_match_ids = {int(match["matchId"]) for match in dataset["matches"]}
    missing_matches = dataset_match_ids - set(replay_matches)
    if missing_matches and not allow_partial:
        raise RuntimeError(
            f"Cannot merge: {len(missing_matches)} dataset matches lack replay stats"
        )

    rows_by_player: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    merged_matches = 0
    for match in dataset["matches"]:
        match_id = int(match["matchId"])
        replay_match = replay_matches.get(match_id)
        if replay_match is None:
            for player in match["players"]:
                rows_by_player[(int(player["teamId"]), int(player["accountId"]))].append(
                    player["stats"]
                )
            continue

        by_account = {
            int(player["accountId"]): player
            for player in replay_match["players"]
            if player.get("accountId") is not None
        }
        for player in match["players"]:
            account_id = int(player["accountId"])
            exact = by_account.get(account_id)
            if exact is None:
                raise RuntimeError(
                    f"Match {match_id}: account {account_id} absent from replay"
                )
            stats = player["stats"]
            proxies = player.setdefault("proxies", {})
            proxies.setdefault("madstone_bundle_uses", stats.get("madstones_collected"))
            proxies.setdefault("watcher_ability_uses", stats.get("watchers_captured"))
            stats["madstones_collected"] = exact["neutralTokensFound"]
            stats["watchers_captured"] = exact["watchersCaptured"]
            stats["lotuses_collected"] = exact["lotusesCollected"]
            player["replayCounters"] = {
                "acquiredMadstones": exact.get("madstonesCollected"),
                "currentMadstones": exact.get("currentMadstones"),
                "neutralTokensFound": exact.get("neutralTokensFound"),
            }
            player["heroId"] = exact.get("heroId")
            player["heroName"] = exact.get("heroName")
            is_radiant = int(player["playerSlot"]) < 128
            player["won"] = bool(match["radiantWin"]) == is_radiant
            player["lost"] = not player["won"]
            rows_by_player[(int(player["teamId"]), account_id)].append(stats)
        match["titleData"] = replay_match.get("titleData")
        merged_matches += 1

    stat_keys = (
        "madstones_collected",
        "watchers_captured",
        "lotuses_collected",
    )
    for team in dataset["teams"]:
        team_id = int(team["teamId"])
        for player in team["players"]:
            key = (team_id, int(player["accountId"]))
            rows = rows_by_player.get(key, [])
            if not rows:
                raise RuntimeError(f"No match rows for team/player {key}")
            for stat_key in stat_keys:
                values = [row.get(stat_key) for row in rows]
                if any(value is None for value in values):
                    total: int | None = None
                    average: int | float | None = None
                else:
                    total = sum(int(value) for value in values)
                    average = normalized_number(total / len(values))
                player["totals"][stat_key] = total
                player["averages"][stat_key] = average

    meta = dataset["meta"]
    meta.setdefault("sources", {})["valveReplays"] = (
        "http://replay{cluster}.valve.net/570/{match_id}_{replay_salt}.dem.bz2"
    )
    provenance = meta.setdefault("fieldProvenance", {})
    provenance["madstones_collected"] = (
        "Valve replay m_vecDataTeam[*].m_iNeutralTokensFound"
    )
    provenance["watchers_captured"] = (
        "Valve replay m_vecDataTeam[*].m_iWatchersTaken"
    )
    provenance["lotuses_collected"] = (
        "Valve replay m_vecDataTeam[*].m_iLotusesTaken"
    )
    caveats = meta.get("caveats", [])
    meta["caveats"] = [
        caveat
        for caveat in caveats
        if not (
            "lotuses_collected is null" in caveat
            or "madstones_collected uses OpenDota" in caveat
        )
    ]
    meta["replayFantasyStats"] = {
        "generatedAt": utc_now(),
        "parser": "Clarity 4.0.1",
        "matchesMerged": merged_matches,
        "exactFields": list(stat_keys),
        "includesHeroAndTitleData": True,
        "sourceArtifact": state.get("meta", {}).get(
            "artifact", "replayFantasyStats"
        ),
    }
    atomic_write_json(output_path, dataset)
    return dataset


def build_summary(
    dataset: dict[str, Any], source_data_file: str
) -> dict[str, Any]:
    player_maps: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for match in dataset["matches"]:
        for player in match["players"]:
            player_maps[int(player["accountId"])].append(
                {
                    "matchId": match["matchId"],
                    "heroId": player.get("heroId"),
                    "heroName": player.get("heroName"),
                    "won": player.get("won"),
                    "lost": player.get("lost"),
                    "titleData": match.get("titleData"),
                    "replayCounters": player.get("replayCounters"),
                    "stats": player["stats"],
                }
            )
    return {
        "meta": {
            **dataset["meta"],
            "artifact": "summary",
            "sourceDataFile": source_data_file,
        },
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
                        "maps": player_maps[int(player["accountId"])],
                        "roleConfidence": player["roleConfidence"],
                    }
                    for player in team["players"]
                ],
            }
            for team in dataset["teams"]
        ],
    }


def write_merged_outputs(
    args: argparse.Namespace, state: dict[str, Any]
) -> None:
    if not args.merge_dataset:
        return
    merged = merge_replay_stats(
        args.merge_dataset,
        args.merge_output,
        state,
        args.allow_partial_merge,
    )
    print(f"Wrote merged dataset: {args.merge_output}")
    if args.summary_output or args.browser_data_output:
        summary = build_summary(merged, args.merge_output.name)
        if args.summary_output:
            atomic_write_json(args.summary_output, summary, compact=True)
            print(f"Wrote replay summary: {args.summary_output}")
        if args.browser_data_output:
            payload = json.dumps(summary, ensure_ascii=False, separators=(",", ":"))
            atomic_write_text(
                args.browser_data_output,
                "window.FANTASY_DATA=" + payload + ";\n",
            )
            print(f"Wrote browser data: {args.browser_data_output}")


def main() -> int:
    args = parse_args()
    try:
        if args.replay:
            return parse_one_local(args)
        state = process_manifest(args)
        if not args.download_only:
            coverage = state["coverage"]
            print(
                f"Replay result: {coverage['completedMatches']}/{EXPECTED_MATCHES} "
                f"matches, {coverage['failedMatches']} failures -> {args.output}"
            )
            write_merged_outputs(args, state)
        return 0 if not state.get("errors") else 1
    except (
        RuntimeError,
        OSError,
        TypeError,
        ValueError,
        KeyError,
        subprocess.TimeoutExpired,
    ) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
