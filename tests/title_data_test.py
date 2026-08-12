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

    def test_league_catalog_contains_every_published_league(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            data_root = Path(temporary)
            old_league = data_root / "19785"
            old_league.mkdir()
            (old_league / "data.js").write_text("published", encoding="utf-8")
            (old_league / "league.json").write_text(
                json.dumps(
                    {
                        "leagueId": 19785,
                        "leagueName": "Esports World Cup 2026",
                    }
                ),
                encoding="utf-8",
            )

            new_league = data_root / "20009"
            new_league.mkdir()
            (new_league / "data.js").write_text("published", encoding="utf-8")

            unpublished = data_root / "30000"
            unpublished.mkdir()
            (unpublished / "league.json").write_text(
                '{"leagueId":30000,"leagueName":"Unpublished"}',
                encoding="utf-8",
            )

            catalog = build_league.refresh_league_catalog(
                data_root, 20009, "1win Essence II"
            )

            self.assertEqual(
                catalog,
                [
                    {
                        "leagueId": 19785,
                        "leagueName": "Esports World Cup 2026",
                    },
                    {"leagueId": 20009, "leagueName": "1win Essence II"},
                ],
            )
            self.assertEqual(
                (data_root / "leagues.js").read_text(encoding="utf-8"),
                "window.FANTASY_LEAGUES="
                '[{"leagueId":19785,"leagueName":"Esports World Cup 2026"},'
                '{"leagueId":20009,"leagueName":"1win Essence II"}];\n',
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
                    "opponent": {
                        "teamId": 20,
                        "name": "Excluded Team",
                        "tag": "OUT",
                    },
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
                    "opponent": {
                        "teamId": 10,
                        "name": "Included Team",
                        "tag": "IN",
                    },
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
        self.assertEqual(
            summary["teams"][0]["players"][0]["maps"][0]["opponent"],
            {"teamId": 20, "name": "Excluded Team", "tag": "OUT"},
        )
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
        self.assertEqual(
            match["players"][0]["opponent"],
            {"teamId": 30, "name": "Dire", "tag": "D"},
        )
        self.assertEqual(
            match["players"][5]["opponent"],
            {"teamId": 20, "name": "Radiant", "tag": "R"},
        )
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

    def test_ti_series_must_be_complete_before_publication(self) -> None:
        def match(
            match_id: int,
            game_number: int,
            radiant_win: bool,
            series_type: int = 1,
        ) -> dict[str, object]:
            return {
                "matchId": match_id,
                "seriesId": 1,
                "seriesType": series_type,
                "startTime": match_id * 100,
                "endTime": match_id * 100 + 50,
                "duration": 50,
                "radiantTeamId": 10,
                "direTeamId": 20,
                "radiantWin": radiant_win,
                "titleData": {"seriesGameNumber": game_number},
            }

        first = match(1, 1, True)
        second_win = match(2, 2, True)
        second_loss = match(2, 2, False)
        deciding_map = match(3, 3, True)
        self.assertFalse(build_league.is_complete_series([first]))
        self.assertTrue(
            build_league.is_complete_series([first, second_win])
        )
        self.assertFalse(
            build_league.is_complete_series([first, second_loss])
        )
        self.assertTrue(
            build_league.is_complete_series(
                [first, second_loss, deciding_map]
            )
        )
        self.assertFalse(
            build_league.is_complete_series([first, deciding_map]),
            "a missing middle map must invalidate the series",
        )

        best_of_five = [
            match(10, 1, True, 2),
            match(11, 2, False, 2),
            match(12, 3, True, 2),
            match(13, 4, False, 2),
            match(14, 5, True, 2),
        ]
        self.assertFalse(
            build_league.is_complete_series(best_of_five[:4])
        )
        self.assertTrue(build_league.is_complete_series(best_of_five))

    def test_ti_stage_split_uses_the_long_inter_stage_break(self) -> None:
        def series(match_id: int, start_time: int) -> list[dict[str, object]]:
            return [
                {
                    "matchId": match_id,
                    "startTime": start_time,
                    "endTime": start_time + 60,
                    "duration": 60,
                }
            ]

        group_one = series(1, 1_000)
        group_two = series(2, 20_000)
        playoffs = series(
            3,
            20_060 + build_league.TI_STAGE_BREAK_MIN_SECONDS,
        )
        stages = build_league.split_ti_stages(
            [group_one, group_two, playoffs]
        )
        self.assertEqual(stages["groupStage"], [group_one, group_two])
        self.assertEqual(stages["international"], [playoffs])
        self.assertTrue(
            build_league.is_the_international("The International 2026")
        )
        self.assertFalse(
            build_league.is_the_international("Esports World Cup 2026")
        )

    def test_ti_browser_data_keeps_stage_summaries_separate(self) -> None:
        def series(
            first_match_id: int,
            start_time: int,
        ) -> list[dict[str, object]]:
            return [
                {
                    "matchId": first_match_id,
                    "seriesId": None,
                    "seriesType": 1,
                    "startTime": start_time,
                    "endTime": start_time + 50,
                    "duration": 50,
                    "radiantTeamId": 10,
                    "direTeamId": 20,
                    "radiantWin": True,
                    "titleData": {
                        "seriesGameNumber": 1,
                        "maxSeriesGames": 3,
                    },
                },
                {
                    "matchId": first_match_id + 1,
                    "seriesId": None,
                    "seriesType": 1,
                    "startTime": start_time + 100,
                    "endTime": start_time + 150,
                    "duration": 50,
                    "radiantTeamId": 10,
                    "direTeamId": 20,
                    "radiantWin": True,
                    "titleData": {
                        "seriesGameNumber": 2,
                        "maxSeriesGames": 3,
                    },
                },
            ]

        group_matches = series(100, 1_000)
        playoff_matches = series(
            200,
            group_matches[-1]["endTime"]
            + build_league.TI_STAGE_BREAK_MIN_SECONDS,
        )
        args = SimpleNamespace(league_id=30000)

        def build_dataset(matches, league_id, league_name, *_args):
            return {
                "meta": {
                    "leagueId": league_id,
                    "leagueName": league_name,
                    "coverage": {"matches": len(matches)},
                },
                "matches": matches,
                "teams": [],
            }

        def build_summary(dataset, _source):
            return {"meta": dict(dataset["meta"]), "teams": []}

        with tempfile.TemporaryDirectory() as temporary:
            league_dir = Path(temporary) / "data" / "30000"
            checkpoints = [
                {"matchId": match["matchId"], "match": match}
                for match in group_matches
            ]
            with (
                patch.object(
                    league_data, "build_dataset", side_effect=build_dataset
                ),
                patch.object(
                    league_data, "build_summary", side_effect=build_summary
                ),
            ):
                build_league.refresh_browser_data(
                    checkpoints,
                    args,
                    league_dir,
                    "The International 2026",
                )
                first_source = (league_dir / "data.js").read_text(
                    encoding="utf-8"
                )
                first_bundle = json.loads(
                    first_source.split(
                        "window.FANTASY_STAGE_DATA=", 1
                    )[1].split(";window.FANTASY_DATA=", 1)[0]
                )
                self.assertEqual(
                    list(first_bundle["stages"]), ["groupStage"]
                )

                checkpoints.extend(
                    {"matchId": match["matchId"], "match": match}
                    for match in playoff_matches
                )
                build_league.refresh_browser_data(
                    checkpoints,
                    args,
                    league_dir,
                    "The International 2026",
                )

            source = (league_dir / "data.js").read_text(encoding="utf-8")
            bundle = json.loads(
                source.split("window.FANTASY_STAGE_DATA=", 1)[1].split(
                    ";window.FANTASY_DATA=", 1
                )[0]
            )
            self.assertEqual(
                list(bundle["stages"]), ["groupStage", "international"]
            )
            self.assertEqual(
                bundle["stages"]["groupStage"]["meta"]["coverage"]["matches"],
                2,
            )
            self.assertEqual(
                bundle["stages"]["international"]["meta"]["coverage"]["matches"],
                2,
            )
            self.assertTrue(
                (league_dir / "stages" / "group-stage" / "summary.json").is_file()
            )
            self.assertTrue(
                (league_dir / "stages" / "playoffs" / "summary.json").is_file()
            )

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
