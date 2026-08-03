from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import build_league  # noqa: E402
import league_data  # noqa: E402
import replay_tools  # noqa: E402


class TitleDataTests(unittest.TestCase):
    def test_cached_dem_is_reused_without_downloading(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            cached = root / "19785" / "42_123.dem"
            cached.parent.mkdir(parents=True)
            cached.write_bytes(b"cached replay placeholder")
            args = SimpleNamespace(
                replay_cache=root,
                league_id=19785,
                timeout=1,
                retries=1,
                allow_missing_replay_fields=False,
                parse_timeout=1,
            )
            item = {
                "matchId": 42,
                "filename": "42_123.dem.bz2",
                "replayUrl": "http://example.invalid/42_123.dem.bz2",
            }
            with (
                patch.object(replay_tools, "verify_dem_header") as verify,
                patch.object(replay_tools, "download_file") as download,
                patch.object(
                    replay_tools, "parse_replay", return_value={"ok": True}
                ) as parse,
            ):
                result = build_league.parse_downloaded_match(
                    item, args, ("java", "classpath")
                )
            self.assertEqual(result, {"ok": True})
            verify.assert_called_once_with(cached)
            download.assert_not_called()
            self.assertEqual(parse.call_args.args[0], cached)

    def test_legacy_question_marks_are_repaired_by_account_id(self) -> None:
        checkpoint = {
            "replay": {"parser": "Clarity 4.0.1"},
            "match": {
                "players": [
                    {"accountId": 171262902, "name": "??watson`"},
                    {"accountId": 2, "name": "Saksa"},
                ]
            },
        }
        repaired = build_league.repair_legacy_player_names(
            checkpoint, {171262902: "医者watson`"}
        )
        self.assertTrue(repaired)
        self.assertEqual(
            checkpoint["match"]["players"][0]["name"], "医者watson`"
        )
        self.assertEqual(checkpoint["replay"]["outputEncoding"], "UTF-8")

    def test_role_inference_uses_creep_order_for_the_mid_farmer(self) -> None:
        # Copy's event-average GPM is slightly below Malik's, but his creep
        # score sits between the offlaner and carry—the stable positional
        # ordering for this roster.
        farm = {
            1: (73, 363),
            2: (161, 425),
            3: (390, 646),  # Malik / offlane
            4: (465, 643),  # Copy / mid
            5: (519, 676),  # carry
        }
        players = {
            (99, account_id): {
                "games": 1,
                "totals": {"creep_score": creep, "gpm": gpm},
            }
            for account_id, (creep, gpm) in farm.items()
        }
        roles = league_data.infer_roles(players)
        self.assertEqual(roles[(99, 4)]["role"], "mid")
        self.assertEqual(roles[(99, 3)]["role"], "core")

    def test_checkpoint_uses_only_replay_match_data_and_player_stats(self) -> None:
        stats = {key: 0 for key in replay_tools.FANTASY_STAT_KEYS}
        stats["gpm"] = 555
        stats["tormentors_killed"] = 1
        players = []
        for index in range(10):
            team_number = 2 if index < 5 else 3
            position = index if index < 5 else index - 5
            players.append(
                {
                    "accountId": 1000 + index,
                    "name": f"Player {index}",
                    "teamNumber": team_number,
                    "playerSlot": position if team_number == 2 else 128 + position,
                    "heroId": index + 1,
                    "heroName": f"npc_dota_hero_{index + 1}",
                    "stats": dict(stats),
                    "rawStats": {},
                    "madstonesCollected": 9,
                    "currentMadstones": 3,
                    "neutralTokensFound": 7,
                }
            )
        replay = {
            "teams": [
                {"teamNumber": 2, "teamId": 20, "name": "Radiant", "tag": "R"},
                {"teamNumber": 3, "teamId": 30, "name": "Dire", "tag": "D"},
            ],
            "players": players,
            "matchData": {
                "matchId": 42,
                "startTime": 10_000,
                "endTime": 11_800,
                "duration": 1_800,
                "leagueId": 99,
                "radiantWin": True,
                "lobbyGameName": "Replay-owned metadata",
                "gameStartTime": 100.0,
                "gameEndTime": 1_900.0,
                "firstBloodTime": 60.0,
                "seriesType": 1,
                "radiantSeriesWins": 0,
                "direSeriesWins": 0,
                "fountainRadius": 8,
                "tormentorDeaths": [],
                "fountainDeaths": [],
                "ownFountainDeaths": [],
            },
        }
        checkpoint = build_league.checkpoint_from_replay(
            {
                "matchId": 42,
                "cluster": 272,
                "replaySalt": 123,
                "replayUrl": "http://replay272.valve.net/570/42_123.dem.bz2",
            },
            replay,
            99,
        )
        match = checkpoint["match"]
        self.assertEqual(match["startTime"], 10_000)
        self.assertEqual(match["endTime"], 11_800)
        self.assertEqual(match["players"][0]["stats"]["gpm"], 555)
        self.assertEqual(match["players"][0]["stats"]["tormentors_killed"], 1)
        self.assertTrue(checkpoint["replay"]["allFantasyStatsFromReplay"])

    def test_both_madstone_counters_are_kept_separate(self) -> None:
        player = replay_tools.normalize_player(
            {
                "teamNumber": 2,
                "position": 0,
                "playerSlot": 0,
                "steamId": 76561198000000001,
                "playerName": "Player",
                "heroId": 1,
                "heroName": "npc_dota_hero_antimage",
                "madstonesCollected": 26,
                "currentMadstones": 0,
                "neutralTokensFound": 30,
                "watchersCaptured": 1,
                "lotusesCollected": 2,
                "stats": {
                    key: (
                        0.5 if key == "teamfight_participation"
                        else 1.25 if key == "stun_seconds"
                        else 30 if key == "madstones_collected"
                        else 2 if key == "tormentors_killed"
                        else 0
                    )
                    for key in league_data.STAT_KEYS
                },
            },
            allow_missing=False,
        )
        self.assertEqual(player["madstonesCollected"], 26)
        self.assertEqual(player["neutralTokensFound"], 30)
        self.assertEqual(player["stats"]["madstones_collected"], 30)
        self.assertEqual(player["stats"]["tormentors_killed"], 2)
        self.assertIn(
            "m_iTormentorKills",
            league_data.FIELD_PROVENANCE["tormentors_killed"],
        )

    def test_replay_series_context_uses_wins_before_current_map(self) -> None:
        context = build_league.replay_series_context(
            {
                "seriesType": 3,
                "radiantSeriesWins": 0,
                "direSeriesWins": 1,
            }
        )
        self.assertEqual(context, {"gameNumber": 2, "maxGames": 2})

    def test_series_context_marks_only_maximum_possible_game(self) -> None:
        matches = [
            {
                "matchId": 11,
                "seriesId": 7,
                "seriesType": 3,
                "startTime": 100,
            },
            {
                "matchId": 12,
                "seriesId": 7,
                "seriesType": 3,
                "startTime": 200,
            },
        ]
        contexts = build_league.build_series_contexts(matches)
        self.assertEqual(contexts[11], {"gameNumber": 1, "maxGames": 2})
        self.assertEqual(contexts[12], {"gameNumber": 2, "maxGames": 2})

    def test_title_conditions_keep_match_and_player_rules_separate(self) -> None:
        match = {"duration": 1498}
        title_data = {
            "firstBloodTime": -3.5,
            "tormentorDeaths": [{"heroId": 1}],
            "ownFountainDeaths": [{"heroId": 2}],
        }
        conditions = build_league.build_title_conditions(
            match,
            title_data,
            {"gameNumber": 2, "maxGames": 2},
        )
        self.assertTrue(conditions["anyPlayerDiedToTormentor"])
        self.assertTrue(conditions["firstBloodBeforeHorn"])
        self.assertFalse(conditions["firstBloodAfterTenMinutes"])
        self.assertTrue(conditions["durationUnder25Minutes"])
        self.assertTrue(conditions["possibleFinalSeriesGame"])
        self.assertTrue(conditions["durationEndsInEight"])
        self.assertTrue(conditions["anyPlayerDiedInOwnFountain"])
        self.assertNotIn("lost", conditions)

    def test_enemy_fountain_death_does_not_count_as_own(self) -> None:
        common = {
            "time": 1.0,
            "teamPosition": 0,
            "steamId": 76561198000000001,
            "heroId": 1,
            "heroName": "npc_dota_hero_antimage",
            "attacker": "dota_fountain",
            "fountainDistance": 4.0,
        }
        record = replay_tools.normalize_match_record(
            {
                "matchId": 1234567890,
                "endTime": 1_700_001_000,
                "duration": 900.75,
                "gameStartTime": 100.0,
                "firstBloodTime": 5.0,
                "seriesType": 0,
                "radiantSeriesWins": 0,
                "direSeriesWins": 0,
                "fountainRadius": 8.0,
                "tormentorDeaths": [],
                "fountainDeaths": [
                    {
                        **common,
                        "teamNumber": 2,
                        "playerSlot": 0,
                        "fountainTeamNumber": 3,
                        "isOwnFountain": False,
                    },
                    {
                        **common,
                        "teamNumber": 3,
                        "playerSlot": 128,
                        "fountainTeamNumber": 3,
                        "isOwnFountain": True,
                    },
                ],
            }
        )
        self.assertEqual(len(record["fountainDeaths"]), 2)
        self.assertEqual(len(record["ownFountainDeaths"]), 1)
        self.assertEqual(record["ownFountainDeaths"][0]["teamNumber"], 3)
        self.assertEqual(record["matchId"], 1234567890)
        self.assertEqual(record["endTime"], 1_700_001_000)
        self.assertEqual(record["startTime"], 1_700_000_100)


if __name__ == "__main__":
    unittest.main()
