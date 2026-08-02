from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import build_league  # noqa: E402
import replay_tools  # noqa: E402


class TitleDataTests(unittest.TestCase):
    def test_both_madstone_counters_are_kept_separate(self) -> None:
        player = replay_tools.normalize_player(
            {
                "teamNumber": 2,
                "position": 0,
                "playerSlot": 0,
                "steamId": 76561198000000001,
                "heroId": 1,
                "heroName": "npc_dota_hero_antimage",
                "madstonesCollected": 26,
                "currentMadstones": 0,
                "neutralTokensFound": 30,
                "watchersCaptured": 1,
                "lotusesCollected": 2,
            },
            allow_missing=False,
        )
        self.assertEqual(player["madstonesCollected"], 26)
        self.assertEqual(player["neutralTokensFound"], 30)
        self.assertEqual(
            build_league.EXACT_REPLAY_FIELDS["madstones_collected"],
            "neutralTokensFound",
        )

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


if __name__ == "__main__":
    unittest.main()
