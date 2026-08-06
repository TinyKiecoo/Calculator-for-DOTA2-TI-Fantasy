from __future__ import annotations

import bz2
import io
import json
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
    def test_replay_decompression_accepts_bzip2_and_zstandard_headers(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            replay_bytes = b"PBDEMS2" + b"test replay payload"

            bzip2_path = root / "old.dem.bz2"
            bzip2_dem = root / "old.dem"
            bzip2_path.write_bytes(bz2.compress(replay_bytes))
            self.assertEqual(
                replay_tools.replay_compression_format(bzip2_path), "bzip2"
            )
            replay_tools.decompress_replay(bzip2_path, bzip2_dem, quiet=True)
            self.assertEqual(bzip2_dem.read_bytes(), replay_bytes)

            zstd_path = root / "new.dem.bz2"
            zstd_dem = root / "new.dem"
            zstd_path.write_bytes(replay_tools.ZSTD_MAGIC + b"placeholder")

            def fake_zstd(_compressed, target):
                target.write(replay_bytes)

            with patch.object(
                replay_tools, "decompress_zstd", side_effect=fake_zstd
            ) as decompress:
                self.assertEqual(
                    replay_tools.replay_compression_format(zstd_path), "zstd"
                )
                replay_tools.decompress_replay(zstd_path, zstd_dem, quiet=True)
            decompress.assert_called_once()
            self.assertEqual(zstd_dem.read_bytes(), replay_bytes)

            unsupported = root / "unsupported.dem.bz2"
            unsupported.write_bytes(b"not compressed")
            with self.assertRaisesRegex(RuntimeError, "Unsupported replay compression"):
                replay_tools.verify_compressed_replay_header(unsupported)

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

    def test_build_records_a_replay_failure_and_continues(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = SimpleNamespace(
                data_root=root / "data",
                league_id=19785,
                match_id=None,
                expected_matches=None,
                timeout=1,
                replay_cache=root / "replays",
                force=False,
                tool_cache=root / "tools",
                retries=1,
                allow_missing_replay_fields=False,
                parse_timeout=1,
            )
            manifest = [
                {
                    "matchId": match_id,
                    "filename": f"{match_id}_salt.dem.bz2",
                    "replayUrl": f"https://example.invalid/{match_id}",
                }
                for match_id in (1, 2, 3)
            ]

            def parse(item, _args, _java_runtime):
                if item["matchId"] == 2:
                    raise RuntimeError("Replay lacks exact GPM inputs")
                return {"parsedMatchId": item["matchId"]}

            def checkpoint(item, _replay, _league_id):
                return {
                    "matchId": item["matchId"],
                    "match": {"matchId": item["matchId"], "players": []},
                }

            with (
                patch.object(
                    build_league,
                    "fetch_league_name",
                    return_value="Test 2026",
                ) as fetch_league_name,
                patch.object(replay_tools, "fetch_manifest", return_value=manifest),
                patch.object(
                    replay_tools,
                    "ensure_java_helper",
                    return_value=("java", "classpath"),
                ),
                patch.object(
                    build_league,
                    "parse_downloaded_match",
                    side_effect=parse,
                ) as parse_match,
                patch.object(
                    build_league,
                    "checkpoint_from_replay",
                    side_effect=checkpoint,
                ),
                patch.object(
                    build_league,
                    "validate_checkpoint",
                    side_effect=lambda value, _league_id, _match_id: value["match"],
                ),
                patch.object(build_league, "assign_series_ids"),
                patch.object(build_league, "echo_match"),
                patch.object(
                    league_data,
                    "build_dataset",
                    return_value={"meta": {"coverage": {"parsedMatches": 2}}},
                ) as build_dataset,
                patch.object(
                    league_data,
                    "build_summary",
                    return_value={"ok": True},
                ) as build_summary,
                patch.object(build_league.sys, "stdout", io.StringIO()),
                patch.object(build_league.sys, "stderr", io.StringIO()),
            ):
                build_league.build(args)

            fetch_league_name.assert_called_once_with(19785, 1)
            self.assertEqual(parse_match.call_count, 3)
            self.assertEqual(
                [len(call.args[0]) for call in build_dataset.call_args_list],
                [1, 2],
                "the first data.js refresh must work with partial match data",
            )
            self.assertEqual(
                build_summary.call_count,
                2,
                "data.js must be summarized after each successful replay",
            )
            league_dir = args.data_root / str(args.league_id)
            errors = json.loads(
                (league_dir / "errors.json").read_text(encoding="utf-8")
            )
            self.assertEqual(len(errors), 1)
            self.assertEqual(errors[0]["matchId"], 2)
            self.assertIn("exact GPM inputs", errors[0]["error"])
            self.assertTrue((league_dir / "matches" / "1.json").exists())
            self.assertFalse((league_dir / "matches" / "2.json").exists())
            self.assertTrue((league_dir / "matches" / "3.json").exists())
            self.assertTrue((league_dir / "full.json").exists())
            self.assertEqual(
                (league_dir / "data.js").read_text(encoding="utf-8"),
                'window.FANTASY_DATA={"ok":true};\n',
            )

    def test_league_name_is_loaded_from_the_exact_opendota_id(self) -> None:
        with patch.object(
            build_league,
            "request_json",
            return_value={"leagueid": 20009, "name": "1win Essence II"},
        ) as request:
            name = build_league.fetch_league_name(20009, 17)

        self.assertEqual(name, "1win Essence II")
        request.assert_called_once_with(
            f"{replay_tools.OPEN_DOTA_API}/leagues/20009", 17
        )

    def test_single_match_selection_rejects_matches_outside_the_league(self) -> None:
        manifest = [{"matchId": 10}, {"matchId": 20}]
        self.assertEqual(
            build_league.select_manifest_matches(manifest, [20, 20], 99),
            {20},
        )
        self.assertIsNone(
            build_league.select_manifest_matches(manifest, None, 99)
        )
        with self.assertRaisesRegex(RuntimeError, "not in league 99: \\[30\\]"):
            build_league.select_manifest_matches(manifest, [30], 99)

    def test_global_roles_and_team_exclusions_keep_the_opponent(self) -> None:
        roles = ["core", "core", "mid", "support", "support"]
        role_overrides = {
            100 + index: role for index, role in enumerate(roles)
        }
        role_overrides.update(
            {200 + index: role for index, role in enumerate(roles)}
        )
        stats = {key: 1 for key in league_data.STAT_KEYS}
        match = {
            "matchId": 1,
            "seriesId": 1,
            "seriesType": 3,
            "startTime": 100,
            "endTime": 200,
            "duration": 100,
            "radiantTeamId": 10,
            "direTeamId": 20,
            "radiantTeamName": "Included Team",
            "direTeamName": "Excluded Team",
            "radiantTeamTag": "IN",
            "direTeamTag": "OUT",
            "players": [
                {
                    "accountId": 100 + index,
                    "name": f"Included {index}",
                    "teamId": 10,
                    "playerSlot": index,
                    "stats": dict(stats),
                }
                for index in range(5)
            ]
            + [
                {
                    "accountId": 200 + index,
                    "name": f"Excluded {index}",
                    "teamId": 20,
                    "playerSlot": 128 + index,
                    "stats": dict(stats),
                }
                for index in range(5)
            ],
        }

        dataset = league_data.build_dataset(
            [match],
            999,
            "Test Event",
            role_overrides=role_overrides,
            excluded_team_names={"  excluded TEAM  "},
        )
        summary = league_data.build_summary(dataset)

        self.assertEqual([team["name"] for team in summary["teams"]], ["Included Team"])
        self.assertEqual(len(summary["teams"][0]["players"]), 5)
        self.assertEqual(dataset["meta"]["coverage"]["playerGameRows"], 5)
        self.assertEqual(dataset["meta"]["excludedTeamNames"], ["  excluded TEAM  "])
        self.assertTrue(all(player["role"] for player in match["players"][:5]))
        self.assertTrue(all(player["role"] is None for player in match["players"][5:]))
        self.assertEqual(build_league.PLAYER_ROLE_OVERRIDES[93618577], "mid")
        self.assertNotIn("LEAGUE_ROLE_OVERRIDES", vars(build_league))

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
                    "rawStats": {"totalEarnedGold": 18_000 + index},
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
        self.assertEqual(match["players"][0]["stats"]["gpm"], 600)
        self.assertEqual(match["players"][0]["stats"]["tormentors_killed"], 1)
        self.assertNotIn("gpm", checkpoint["replay"]["exactFields"])
        self.assertEqual(checkpoint["replay"]["calculatedFields"], ["gpm"])
        self.assertTrue(checkpoint["replay"]["allFantasyStatsFromReplay"])

    def test_gpm_uses_total_gold_and_exact_replay_duration(self) -> None:
        self.assertAlmostEqual(
            replay_tools.calculate_gpm(22_964, 925.4, 2965.7334),
            675.3013992713152,
        )
        with self.assertRaisesRegex(RuntimeError, "totalEarnedGold"):
            replay_tools.calculate_gpm(None, 925.4, 2965.7334)

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
                        0.8518518805503845
                        if key == "teamfight_participation"
                        else 1.9023056030273438
                        if key == "stun_seconds"
                        else 30 if key == "madstones_collected"
                        else 2 if key == "tormentors_killed"
                        else 0
                    )
                    for key in league_data.STAT_KEYS
                    if key != "gpm"
                },
            },
            allow_missing=False,
        )
        self.assertEqual(player["madstonesCollected"], 26)
        self.assertEqual(player["neutralTokensFound"], 30)
        self.assertEqual(player["stats"]["madstones_collected"], 30)
        self.assertEqual(player["stats"]["tormentors_killed"], 2)
        self.assertIsNone(player["stats"]["gpm"])
        self.assertEqual(
            player["stats"]["teamfight_participation"],
            0.8518518805503845,
        )
        self.assertEqual(player["stats"]["stun_seconds"], 1.9023056030273438)
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
                "gameEndTime": 1000.75,
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
        self.assertEqual(record["duration"], 900.75)
        self.assertEqual(record["startTime"], 1_700_000_099.25)


if __name__ == "__main__":
    unittest.main()
