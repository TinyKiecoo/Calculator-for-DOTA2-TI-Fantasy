"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildRankings,
  calculateEmblemModifiers,
  cloneDefaultConfig,
  internationalRoleColors,
  scorePair,
  scorePlayer,
  scoreRawStat,
  validateBannerConfig,
} = require("../fantasy.js");

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

test("switches between one-map highest score and all-map average score", () => {
  const emblems = [
    { color: "red", stat: "kills", quality: 1, trait: "unique" },
    { color: "green", stat: "stun_seconds", quality: 1, trait: "fractal" },
    { color: "red", stat: "gpm", quality: 1, trait: "benevolent" },
  ];
  const player = {
    id: "p1",
    role: "mid",
    games: 2,
    averages: {
      kills: 3,
      stun_seconds: 6,
      gpm: 300,
    },
    maps: [
      {
        matchId: 1,
        stats: { kills: 2, stun_seconds: 4, gpm: 200 },
      },
      {
        matchId: 2,
        stats: { kills: 4, stun_seconds: 8, gpm: 400 },
      },
    ],
  };
  const firstMap = scorePlayer(
    { ...player, maps: [player.maps[0]] },
    emblems,
    "average",
  ).score;
  const secondMap = scorePlayer(
    { ...player, maps: [player.maps[1]] },
    emblems,
    "average",
  ).score;

  assert.equal(
    scorePlayer(player, emblems, "highest").score,
    Math.max(firstMap, secondMap),
  );
  assert.equal(
    scorePlayer(player, emblems, "average").score,
    (firstMap + secondMap) / 2,
  );
  assert.equal(scorePlayer(player, emblems, "highest").matchId, 2);
});

test("takes a pair's highest score from the same map", () => {
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
      { matchId: 101, stats: firstStats },
      { matchId: 102, stats: secondStats },
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
        "average",
      ).score +
      scorePlayer(
        { ...second, maps: [second.maps[0]] },
        emblems,
        "average",
      ).score
    ) / 2;
  const secondMapPair =
    (
      scorePlayer(
        { ...first, maps: [first.maps[1]] },
        emblems,
        "average",
      ).score +
      scorePlayer(
        { ...second, maps: [second.maps[1]] },
        emblems,
        "average",
      ).score
    ) / 2;

  assert.equal(pair.score, Math.max(firstMapPair, secondMapPair));
  assert.equal(pair.matchId, firstMapPair > secondMapPair ? 101 : 102);
  assert.notEqual(
    pair.score,
    (
      scorePlayer(first, emblems, "highest").score +
      scorePlayer(second, emblems, "highest").score
    ) / 2,
  );
});
