"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildRankings,
  calculateTitleBonus,
  calculateEmblemModifiers,
  cloneDefaultConfig,
  countedGamesForSeries,
  formatScore,
  internationalRoleColors,
  rankAverageContributions,
  scorePair,
  scorePlayer,
  scoreRawStat,
  scoreStatistics,
  validateBannerConfig,
} = require("../fantasy.js");

function assertEmblemScoresSum(result) {
  assert.equal(result.emblemScores.length > 0, true);
  const total = result.emblemScores.reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - result.score) < 1e-8);
}

test("uses the current EWC 2026 base point rules", () => {
  assert.equal(scoreRawStat("kills", 2), 214);
  assert.equal(scoreRawStat("deaths", 0), 1950);
  assert.equal(scoreRawStat("deaths", 10), 0);
  assert.equal(scoreRawStat("deaths", 11), -195);
  assert.equal(scoreRawStat("creep_score", 110), 330);
  assert.equal(scoreRawStat("gpm", 500), 1000);
  assert.equal(scoreRawStat("teamfight_participation", 0.75), 1593);
  assert.equal(scoreRawStat("first_blood", 1), 1934);
  assert.equal(scoreRawStat("first_blood", 0.25), 483.5);
  assert.equal(scoreRawStat("first_blood", 0), 0);

  const linearCases = [
    ["madstone_collected", 2, 26],
    ["tower_kills", 2, 704],
    ["observer_wards_placed", 2, 234],
    ["camps_stacked", 2, 468],
    ["runes_grabbed", 2, 282],
    ["watchers_taken", 2, 294],
    ["smokes_used", 2, 586],
    ["lotuses_collected", 2, 352],
    ["roshan_kills", 2, 2344],
    ["stun_seconds", 2.5, 25],
    ["tormentor_kills", 2, 1758],
    ["courier_kills", 2, 1406],
  ];
  for (const [stat, raw, expected] of linearCases) {
    assert.equal(scoreRawStat(stat, raw), expected);
  }
});

test("normalizes average emblem contributions in direct proportion to the maximum", () => {
  assert.deepEqual(
    rankAverageContributions([
      { stat: "lowest", average: 10 },
      { stat: "highest", average: 30 },
      { stat: "middle", average: 20 },
      { stat: "missing", average: null },
    ]),
    [
      { stat: "highest", average: 30, rankingScore: 100 },
      { stat: "middle", average: 20, rankingScore: 67 },
      { stat: "lowest", average: 10, rankingScore: 33 },
      { stat: "missing", average: null, rankingScore: null },
    ],
  );

  assert.deepEqual(
    rankAverageContributions([
      { stat: "first", average: 12 },
      { stat: "second", average: 12 },
    ]),
    [
      { stat: "first", average: 12, rankingScore: 100 },
      { stat: "second", average: 12, rankingScore: 100 },
    ],
  );
});

test("formats every displayed score with exactly two decimals", () => {
  assert.equal(formatScore(1234.5), "1,234.50");
  assert.equal(formatScore(0), "0.00");
});

test("adds quality, self traits, and adjacent traits as percentage points", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "fractal" },
    {
      color: "green",
      stat: "teamfight_participation",
      quality: 2,
      trait: "benevolent",
    },
    { color: "red", stat: "deaths", quality: 3, trait: "vampire" },
  ];

  assert.deepEqual(
    calculateEmblemModifiers(emblems).map((item) =>
      Number(item.total.toFixed(8)),
    ),
    [1.9, 1.2, 2.3],
  );
});

test("manual emblem multipliers replace all quality and trait effects", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 5, trait: "vampire" },
    { color: "green", stat: "stun_seconds", quality: 5, trait: "friendly" },
    { color: "red", stat: "gpm", quality: 5, trait: "benevolent" },
  ];
  const result = scoreStatistics(
    { kills: 2, stun_seconds: 5, gpm: 500 },
    emblems,
    1,
    [1.25, 2, 0.5],
  );
  assertEmblemScoresSum(result);

  assert.equal(result.score, (214 * 1.25) + (50 * 2) + (1000 * 0.5));
  assert.deepEqual(
    result.components.map((component) => component.multiplier),
    [1.25, 2, 0.5],
  );
});

test("scores the worked three-emblem example without intermediate rounding", () => {
  const player = {
    id: "p1",
    name: "测试选手",
    teamId: "t1",
    teamName: "测试队",
    role: "core",
    games: 1,
    averages: {
      kills: 2,
      teamfight_participation: 0.5,
      deaths: 4,
    },
  };
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "fractal" },
    {
      color: "green",
      stat: "teamfight_participation",
      quality: 2,
      trait: "benevolent",
    },
    { color: "red", stat: "deaths", quality: 3, trait: "vampire" },
  ];

  assert.equal(scorePlayer(player, emblems).score, 4372);
});

test("only activates friendly when all three slots are friendly", () => {
  const allFriendly = [
    { color: "blue", stat: "runes_grabbed", quality: 1, trait: "friendly" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "friendly" },
    {
      color: "blue",
      stat: "observer_wards_placed",
      quality: 1,
      trait: "friendly",
    },
  ];

  assert.deepEqual(
    calculateEmblemModifiers(allFriendly).map((item) => item.total),
    [1.6, 1.6, 1.6],
  );
});

test("stacks two adjacent benevolent and vampire effects on the middle slot", () => {
  const benevolentEnds = [
    { color: "red", stat: "kills", quality: 1, trait: "benevolent" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "unique" },
    { color: "red", stat: "deaths", quality: 1, trait: "benevolent" },
  ];
  const vampireEnds = [
    { color: "red", stat: "kills", quality: 1, trait: "vampire" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "unique" },
    { color: "red", stat: "deaths", quality: 1, trait: "vampire" },
  ];

  assert.equal(
    Number(calculateEmblemModifiers(benevolentEnds)[1].total.toFixed(8)),
    1.8,
  );
  assert.equal(
    Number(calculateEmblemModifiers(vampireEnds)[1].total.toFixed(8)),
    1.2,
  );
});

test("supports five-emblem International banners and all-emblem fractal", () => {
  const config = cloneDefaultConfig("international");
  validateBannerConfig(config, "international");
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(config).map(([role, emblems]) => [
        role,
        emblems.map((emblem) => emblem.color),
      ]),
    ),
    internationalRoleColors,
  );

  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "fractal" },
    { color: "green", stat: "stun_seconds", quality: 2, trait: "unique" },
    { color: "red", stat: "gpm", quality: 3, trait: "unique" },
    { color: "green", stat: "courier_kills", quality: 4, trait: "unique" },
    { color: "red", stat: "deaths", quality: 5, trait: "unique" },
  ];
  assert.equal(
    Number(calculateEmblemModifiers(emblems)[0].total.toFixed(8)),
    1.7,
  );
  emblems[4].quality = 4;
  assert.equal(calculateEmblemModifiers(emblems)[0].total, 1.1);
});

test("pairs only same-team players and averages their two scores", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const makePlayer = (id, teamId, kills, stunSeconds, gpm) => ({
    id,
    name: id,
    teamId,
    teamName: teamId,
    role: "core",
    games: 4,
    averages: {
      kills,
      stun_seconds: stunSeconds,
      gpm,
    },
  });
  const first = makePlayer("a1", "team-a", 1, 2, 100);
  const second = makePlayer("a2", "team-a", 3, 4, 200);
  const otherTeam = makePlayer("b1", "team-b", 100, 100, 1000);

  const rankings = buildRankings(
    "core",
    [first, second, otherTeam],
    emblems,
  );
  const expectedAverage =
    (scorePlayer(first, emblems).score + scorePlayer(second, emblems).score) /
    2;

  assert.equal(rankings.length, 1);
  assert.equal(rankings[0].teamId, "team-a");
  assert.equal(
    rankings[0].players.map((player) => player.id).join(","),
    "a1,a2",
  );
  assert.equal(rankings[0].score, expectedAverage);
  assert.ok(!rankings[0].key.includes("b1"));
});

test("takes the best two maps from the highest-scoring series", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const player = {
    id: "p1",
    role: "mid",
    games: 5,
    averages: {
      kills: 3,
      stun_seconds: 6,
      gpm: 300,
    },
    maps: [
      {
        matchId: 1,
        seriesId: 10,
        seriesType: 1,
        opponent: { teamId: "opponent-10", name: "Opponent 10", tag: "O10" },
        stats: { kills: 2, stun_seconds: 4, gpm: 200 },
      },
      {
        matchId: 2,
        seriesId: 10,
        seriesType: 1,
        opponent: { teamId: "opponent-10", name: "Opponent 10", tag: "O10" },
        stats: { kills: 4, stun_seconds: 8, gpm: 400 },
      },
      {
        matchId: 3,
        seriesId: 10,
        seriesType: 1,
        opponent: { teamId: "opponent-10", name: "Opponent 10", tag: "O10" },
        stats: { kills: 3, stun_seconds: 6, gpm: 300 },
      },
      {
        matchId: 4,
        seriesId: 20,
        seriesType: 3,
        opponent: { teamId: "opponent-20", name: "Opponent 20", tag: "O20" },
        stats: { kills: 5, stun_seconds: 10, gpm: 500 },
      },
      {
        matchId: 5,
        seriesId: 20,
        seriesType: 3,
        opponent: { teamId: "opponent-20", name: "Opponent 20", tag: "O20" },
        stats: { kills: 1, stun_seconds: 2, gpm: 100 },
      },
    ],
  };
  const mapScores = player.maps.map((map) =>
    scorePlayer(
      { ...player, maps: [{ ...map, seriesId: map.matchId }] },
      emblems,
      "highest",
    ).score,
  );

  assert.equal(
    scorePlayer(player, emblems, "highest").score,
    Math.max(
      mapScores[1] + mapScores[2],
      mapScores[3] + mapScores[4],
    ),
  );
  assert.deepEqual(
    scorePlayer(player, emblems, "highest").matchIds,
    [2, 3],
  );
  assert.deepEqual(scorePlayer(player, emblems, "highest").opponent, {
    teamId: "opponent-10",
    name: "Opponent 10",
    tag: "O10",
  });
  assertEmblemScoresSum(scorePlayer(player, emblems, "highest"));
});

test("takes only the best two maps from a non-TI best-of-five series", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const player = {
    id: "p1",
    role: "mid",
    maps: [1, 2, 3, 4, 5].map((value) => ({
      matchId: value,
      seriesId: 10,
      seriesType: 2,
      stats: {
        kills: value,
        stun_seconds: value * 2,
        gpm: value * 100,
      },
    })),
  };
  const isolated = player.maps.map((map) =>
    scorePlayer(
      { ...player, maps: [{ ...map, seriesId: map.matchId }] },
      emblems,
      "highest",
    ).score,
  );
  const result = scorePlayer(player, emblems, "highest");

  assert.equal(result.score, isolated[4] + isolated[3]);
  assert.deepEqual(result.matchIds, [5, 4]);
  assertEmblemScoresSum(result);
});

test("takes the best three maps from a TI best-of-five series", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const player = {
    id: "p1",
    role: "mid",
    maps: [1, 2, 3, 4, 5].map((value) => ({
      matchId: value,
      seriesId: 10,
      seriesType: 2,
      stats: {
        kills: value,
        stun_seconds: value * 2,
        gpm: value * 100,
      },
    })),
  };
  const isolated = player.maps.map((map) =>
    scorePlayer(
      { ...player, maps: [{ ...map, seriesId: map.matchId }] },
      emblems,
      "highest",
    ).score,
  );
  const result = scorePlayer(
    player,
    emblems,
    "highest",
    {},
    null,
    { useTiBestOfFiveScoring: true },
  );

  assert.equal(result.score, isolated[4] + isolated[3] + isolated[2]);
  assert.deepEqual(result.matchIds, [5, 4, 3]);
  assertEmblemScoresSum(result);
});

test("applies the TI best-of-five rule after averaging a role's player pair", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const makePlayer = (id, offset) => ({
    id,
    teamId: "same-team",
    teamName: "Same Team",
    role: "core",
    maps: [1, 2, 3, 4, 5].map((value) => ({
      matchId: value,
      seriesId: 10,
      seriesType: 2,
      stats: {
        kills: value + offset,
        stun_seconds: value * 2 + offset,
        gpm: value * 100 + offset,
      },
    })),
  });
  const first = makePlayer("first", 0);
  const second = makePlayer("second", 1);
  const scoringOptions = { useTiBestOfFiveScoring: true };

  const pair = scorePair(
    first,
    second,
    emblems,
    "highest",
    {},
    null,
    scoringOptions,
  );
  const rankings = buildRankings(
    "core",
    [first, second],
    emblems,
    "highest",
    {},
    null,
    scoringOptions,
  );

  assert.deepEqual(pair.matchIds, [5, 4, 3]);
  assert.deepEqual(rankings[0].matchIds, [5, 4, 3]);
  assert.equal(rankings[0].score, pair.score);
  assertEmblemScoresSum(pair);
});

test("scores an unfinished series from every map currently available", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const player = {
    id: "p1",
    role: "mid",
    maps: [
      {
        matchId: 1,
        seriesId: 10,
        seriesType: 1,
        stats: { kills: 3, stun_seconds: 6, gpm: 300 },
      },
    ],
  };

  const result = scorePlayer(player, emblems, "highest");

  assert.ok(result.score > 0);
  assert.deepEqual(result.matchIds, [1]);
  assert.equal(result.seriesId, 10);
  assert.equal(result.coverage, 1);
  assertEmblemScoresSum(result);
});

test("selects map counts according to the active tournament rule", () => {
  assert.equal(countedGamesForSeries(1, true), 2);
  assert.equal(countedGamesForSeries(2, true), 3);
  assert.equal(countedGamesForSeries(3, true), 2);
  assert.equal(countedGamesForSeries(2), 2);
});

test("average mode doubles the average across every valid map", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const player = {
    id: "p1",
    role: "mid",
    maps: [
      { matchId: 1, seriesId: 10, stats: { kills: 2, stun_seconds: 4, gpm: 200 } },
      { matchId: 2, seriesId: 10, stats: { kills: 4, stun_seconds: 8, gpm: 400 } },
      { matchId: 3, seriesId: 20, stats: { kills: 5, stun_seconds: 10, gpm: 500 } },
    ],
  };
  const isolated = player.maps.map((map) =>
    scorePlayer(
      { ...player, maps: [{ ...map, seriesId: map.matchId }] },
      emblems,
      "highest",
    ).score,
  );

  assert.equal(
    scorePlayer(player, emblems, "average").score,
    ((isolated[0] + isolated[1] + isolated[2]) / 3) * 2,
  );
  assert.deepEqual(
    scorePlayer(player, emblems, "average").matchIds,
    [1, 2, 3],
  );
  assertEmblemScoresSum(scorePlayer(player, emblems, "average"));
});

test("treats a missing series ID as a standalone match", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const player = {
    id: "p1",
    role: "mid",
    maps: [
      { matchId: 1, stats: { kills: 1, stun_seconds: 1, gpm: 100 } },
      { matchId: 2, stats: { kills: 2, stun_seconds: 2, gpm: 200 } },
    ],
  };
  const expected = scorePlayer(
    { ...player, maps: [player.maps[1]] },
    emblems,
    "highest",
  ).score;
  assert.equal(scorePlayer(player, emblems, "highest").score, expected);
});

test("averages a pair within each map before summing the series' best two", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const makePlayer = (id, firstStats, secondStats) => ({
    id,
    teamId: "same-team",
    role: "core",
    games: 2,
    maps: [
      { matchId: 101, seriesId: 99, stats: firstStats },
      { matchId: 102, seriesId: 99, stats: secondStats },
    ],
    averages: {},
  });
  const first = makePlayer(
    "first",
    { kills: 12, stun_seconds: 30, gpm: 800 },
    { kills: 1, stun_seconds: 1, gpm: 100 },
  );
  const second = makePlayer(
    "second",
    { kills: 1, stun_seconds: 1, gpm: 100 },
    { kills: 10, stun_seconds: 25, gpm: 700 },
  );
  const pair = scorePair(first, second, emblems, "highest");
  const firstMapPair =
    (
      scorePlayer(
        { ...first, maps: [first.maps[0]] },
        emblems,
        "highest",
      ).score +
      scorePlayer(
        { ...second, maps: [second.maps[0]] },
        emblems,
        "highest",
      ).score
    ) / 2;
  const secondMapPair =
    (
      scorePlayer(
        { ...first, maps: [first.maps[1]] },
        emblems,
        "highest",
      ).score +
      scorePlayer(
        { ...second, maps: [second.maps[1]] },
        emblems,
        "highest",
      ).score
    ) / 2;

  assert.equal(pair.score, firstMapPair + secondMapPair);
  assert.deepEqual(pair.matchIds, [
    firstMapPair > secondMapPair ? 101 : 102,
    firstMapPair > secondMapPair ? 102 : 101,
  ]);
  assertEmblemScoresSum(pair);
});

test("applies matching prefix and suffix bonuses to each map additively", () => {
  const map = {
    heroId: 2,
    lost: true,
    titleConditions: {
      durationUnder25Minutes: true,
      anyPlayerDiedToTormentor: false,
    },
  };

  assert.deepEqual(calculateTitleBonus(map, {
    prefix: "crimson",
    suffix: "loser",
  }), {
    prefix: 0.06,
    suffix: 0.06,
    total: 0.12,
    prefixActive: true,
    suffixActive: true,
  });
  assert.equal(calculateTitleBonus(map, {
    prefix: "azure",
    suffix: "sufferer",
  }).total, 0);
});
