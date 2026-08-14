(function (root, factory) {
  "use strict";

  const engine = factory();
  root.FantasyEngine = engine;

  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const bannerRoles = ["core", "mid", "support"];
  const stageKeys = ["groupStage", "international"];
  const scoreModes = ["highest", "average"];
  const enableTiBestOfFiveScoring = false;
  const countedGamesBySeriesType = { 1: 2, 2: 3, 3: 2 };
  const emblemColors = ["red", "blue", "green"];
  const qualities = [1, 2, 3, 4, 5];
  const traits = [
    "fractal",
    "benevolent",
    "vampire",
    "unique",
    "friendly",
  ];

  const prefixTitles = {
    none: { bonus: 0, heroIds: [] },
    crimson: {
      bonus: 0.06,
      heroIds: [2, 4, 11, 14, 18, 25, 35, 37, 38, 49, 51, 61, 64, 65, 69, 77, 78, 79, 81, 87, 88, 95, 104, 106, 110, 120, 129, 128, 137, 131],
    },
    azure: {
      bonus: 0.11,
      heroIds: [5, 9, 10, 12, 13, 15, 17, 18, 20, 22, 31, 39, 48, 52, 59, 60, 63, 64, 68, 71, 84, 91, 92, 102, 111, 112, 113, 138, 145],
    },
    emerald: {
      bonus: 0.06,
      heroIds: [21, 29, 36, 40, 42, 44, 45, 47, 53, 58, 76, 83, 85, 86, 89, 94, 107, 108, 114, 119, 123, 138, 155],
    },
    purple: {
      bonus: 0.1,
      heroIds: [1, 3, 6, 26, 28, 30, 32, 33, 41, 46, 50, 55, 67, 70, 75, 98, 102, 109, 119, 126],
    },
    golden: {
      bonus: 0.08,
      heroIds: [27, 34, 56, 62, 65, 66, 72, 73, 86, 90, 99, 103, 110, 105, 135, 131, 7, 16, 19, 80, 83, 96, 97, 137, 155],
    },
    elemental: {
      bonus: 0.08,
      heroIds: [10, 23, 28, 29, 89, 93, 25, 49, 56, 59, 64, 65, 69, 74, 78, 84, 106, 110, 105, 135, 5, 6, 31, 68, 100, 112],
    },
    otherworldly: {
      bonus: 0.07,
      heroIds: [14, 20, 23, 31, 36, 42, 43, 45, 54, 56, 59, 67, 85, 121, 138, 11, 26, 39, 69, 79, 109, 108, 17, 106, 107, 126],
    },
    heroic: {
      bonus: 0.09,
      heroIds: [4, 5, 6, 21, 26, 35, 37, 44, 45, 53, 57, 65, 74, 79, 86, 102, 111, 113, 114, 136, 138, 8, 18, 27, 34, 51, 62, 72, 81, 121],
    },
  };

  const suffixTitles = {
    none: { bonus: 0 },
    sufferer: { bonus: 0.23, condition: "anyPlayerDiedToTormentor" },
    flayedTwinsAcolyte: { bonus: 0.09, condition: "firstBloodBeforeHorn" },
    patient: { bonus: 0.23, condition: "firstBloodAfterTenMinutes" },
    loser: { bonus: 0.06, condition: "lost" },
    bold: { bonus: 0.24, condition: "durationUnder25Minutes" },
    pivotal: { bonus: 0.16, condition: "possibleFinalSeriesGame" },
    lucky: { bonus: 0.21, condition: "durationEndsInEight" },
    cruel: { bonus: 0.13, condition: "anyPlayerDiedInOwnFountain" },
  };

  const prefixTitleKeys = Object.keys(prefixTitles);
  const suffixTitleKeys = Object.keys(suffixTitles);

  const statKeys = [
    "kills",
    "deaths",
    "creep_score",
    "gpm",
    "madstone_collected",
    "tower_kills",
    "observer_wards_placed",
    "camps_stacked",
    "runes_grabbed",
    "watchers_taken",
    "smokes_used",
    "lotuses_collected",
    "roshan_kills",
    "teamfight_participation",
    "stun_seconds",
    "tormentor_kills",
    "first_blood",
    "courier_kills",
  ];

  const statDefinitions = {
    kills: {
      color: "red",
      label: "击杀",
    },
    deaths: {
      color: "red",
      label: "死亡",
    },
    creep_score: {
      color: "red",
      label: "正反补",
    },
    gpm: {
      color: "red",
      label: "GPM",
    },
    madstone_collected: {
      color: "red",
      label: "狂石收集数量",
    },
    tower_kills: {
      color: "red",
      label: "摧毁防御塔",
    },
    observer_wards_placed: {
      color: "blue",
      label: "放置侦察守卫",
    },
    camps_stacked: {
      color: "blue",
      label: "堆叠野怪",
    },
    runes_grabbed: {
      color: "blue",
      label: "拾取神符",
    },
    watchers_taken: {
      color: "blue",
      label: "占领观察者",
    },
    smokes_used: {
      color: "blue",
      label: "使用诡计之雾",
    },
    lotuses_collected: {
      color: "blue",
      label: "采集莲花",
    },
    roshan_kills: {
      color: "green",
      label: "击杀肉山",
    },
    teamfight_participation: {
      color: "green",
      label: "参与团战",
    },
    stun_seconds: {
      color: "green",
      label: "眩晕时间",
    },
    tormentor_kills: {
      color: "green",
      label: "消灭痛苦魔方",
    },
    first_blood: {
      color: "green",
      label: "第一滴血",
    },
    courier_kills: {
      color: "green",
      label: "杀害信使",
    },
  };

  const roleColors = {
    core: ["red", "green", "red"],
    mid: ["red", "blue", "green"],
    support: ["blue", "green", "blue"],
  };

  const internationalRoleColors = {
    core: ["red", "green", "red", "green", "red"],
    mid: ["red", "blue", "green", "red", "green"],
    support: ["blue", "green", "blue", "green", "blue"],
  };

  const stageRoleColors = {
    groupStage: roleColors,
    international: internationalRoleColors,
  };

  const qualityBonus = {
    1: 0.1,
    2: 0.3,
    3: 0.6,
    4: 1,
    5: 1.5,
  };

  function calculateEmblemModifiers(emblems) {
    if (![3, 5].includes(emblems.length)) {
      throw new Error("每面战旗必须有三枚或五枚徽标。");
    }

    const allQualitiesDifferent =
      new Set(emblems.map((item) => item.quality)).size === emblems.length;
    const uniqueCount = emblems.filter(
      (item) => item.trait === "unique",
    ).length;
    const friendlyCount = emblems.filter(
      (item) => item.trait === "friendly",
    ).length;

    return emblems.map((emblem, index) => {
      const triggered = [];
      let selfTrait = 0;
      let neighbor = 0;

      if (emblem.trait === "fractal" && allQualitiesDifferent) {
        selfTrait += 0.6;
        triggered.push("分形 +60%");
      }
      if (emblem.trait === "vampire") {
        selfTrait += 0.5;
        triggered.push("吸血鬼 +50%");
      }
      if (emblem.trait === "unique" && uniqueCount === 1) {
        selfTrait += 0.3;
        triggered.push("唯一 +30%");
      }
      if (emblem.trait === "friendly" && friendlyCount >= 3) {
        selfTrait += 0.5;
        triggered.push("友好 +50%");
      }

      for (const neighborIndex of [index - 1, index + 1]) {
        const adjacent = emblems[neighborIndex];
        if (!adjacent) continue;

        if (adjacent.trait === "benevolent") {
          neighbor += 0.2;
          triggered.push("相邻仁爱 +20%");
        }
        if (adjacent.trait === "vampire") {
          neighbor -= 0.1;
          triggered.push("相邻吸血鬼 −10%");
        }
      }

      const quality = qualityBonus[emblem.quality];
      return {
        base: 1,
        quality,
        selfTrait,
        neighbor,
        total: 1 + quality + selfTrait + neighbor,
        triggered,
      };
    });
  }

  function scoreRawStat(stat, rawValue) {
    if (!Number.isFinite(rawValue)) {
      throw new Error(`${stat} 必须是有限数值。`);
    }

    switch (stat) {
      case "kills":
        return rawValue * 107;
      case "deaths":
        return 1950 - rawValue * 195;
      case "creep_score":
        return rawValue * 3;
      case "gpm":
        return rawValue * 2;
      case "madstone_collected":
        return rawValue * 13;
      case "tower_kills":
        return rawValue * 352;
      case "observer_wards_placed":
        return rawValue * 117;
      case "camps_stacked":
        return rawValue * 234;
      case "runes_grabbed":
        return rawValue * 141;
      case "watchers_taken":
        return rawValue * 147;
      case "smokes_used":
        return rawValue * 293;
      case "lotuses_collected":
        return rawValue * 176;
      case "roshan_kills":
        return rawValue * 1172;
      case "teamfight_participation":
        if (rawValue < 0 || rawValue > 1) {
          throw new Error("参团率必须是 0 到 1 之间的小数。");
        }
        return rawValue * 2124;
      case "stun_seconds":
        return rawValue * 10;
      case "tormentor_kills":
        return rawValue * 879;
      case "first_blood":
        if (rawValue < 0 || rawValue > 1) {
          throw new Error("第一滴血数值必须在 0 到 1 之间。");
        }
        return rawValue * 1934;
      case "courier_kills":
        return rawValue * 703;
    }
  }

  function rankAverageContributions(contributions) {
    if (!Array.isArray(contributions)) {
      throw new Error("徽标平均贡献必须是数组。");
    }

    const entries = contributions.map((entry, index) => ({
      stat: entry?.stat,
      average: Number.isFinite(entry?.average) ? entry.average : null,
      sourceIndex: index,
    }));
    const available = entries.filter((entry) => entry.average !== null);

    if (!available.length) {
      return entries.map((entry) => ({
        stat: entry.stat,
        average: entry.average,
        rankingScore: null,
      }));
    }

    const averages = available.map((entry) => entry.average);
    const maximum = Math.max(...averages);

    return entries
      .map(({ sourceIndex, ...entry }) => ({
        ...entry,
        sourceIndex,
        rankingScore:
          entry.average === null
            ? null
            : maximum === 0
              ? 100
              : Math.round((entry.average / maximum) * 100),
      }))
      .sort((left, right) => {
        if (left.average === null) return right.average === null
          ? left.sourceIndex - right.sourceIndex
          : 1;
        if (right.average === null) return -1;
        return right.average - left.average || left.sourceIndex - right.sourceIndex;
      })
      .map((entry) => ({
        stat: entry.stat,
        average: entry.average,
        rankingScore: entry.rankingScore,
      }));
  }

  function resolveModifiers(emblems, customMultipliers) {
    if (!Array.isArray(customMultipliers)) {
      return calculateEmblemModifiers(emblems);
    }
    if (customMultipliers.length !== emblems.length) {
      throw new Error("手动徽标倍率数量必须与徽标数量一致。");
    }
    return customMultipliers.map((value) => {
      const total = Number(value);
      if (!Number.isFinite(total) || total < 0) {
        throw new Error("手动徽标倍率必须是非负有限数值。");
      }
      return {
        base: 1,
        quality: 0,
        selfTrait: 0,
        neighbor: 0,
        total,
        triggered: ["手动倍率"],
      };
    });
  }

  function scoreStatistics(
    statistics,
    emblems,
    coverage = 1,
    customMultipliers = null,
  ) {
    const modifiers = resolveModifiers(emblems, customMultipliers);
    const missing = [];
    let score = 0;

    const components = emblems.map((emblem, index) => {
      const raw = statistics?.[emblem.stat];

      if (raw === null || raw === undefined || !Number.isFinite(raw)) {
        missing.push(emblem.stat);
        return {
          stat: emblem.stat,
          raw: null,
          basePoints: null,
          multiplier: modifiers[index].total,
          points: null,
        };
      }

      const basePoints = scoreRawStat(emblem.stat, raw);
      const points = basePoints * modifiers[index].total;
      score += points;
      return {
        stat: emblem.stat,
        raw,
        basePoints,
        multiplier: modifiers[index].total,
        points,
      };
    });

    return {
      score: missing.length ? null : score,
      coverage,
      missing,
      components,
      emblemScores: missing.length
        ? components.map(() => null)
        : components.map((component) => component.points),
    };
  }

  function combineEmblemScores(results, scale = 1) {
    const count = results[0]?.emblemScores?.length ?? 0;
    const scores = [];
    for (let index = 0; index < count; index += 1) {
      const values = results.map((result) => result.emblemScores?.[index]);
      scores.push(
        values.every(Number.isFinite)
          ? values.reduce((sum, value) => sum + value, 0) * scale
          : null,
      );
    }
    return scores;
  }

  function normalizeTitleSelection(titles = {}) {
    return {
      prefix: prefixTitles[titles.prefix] ? titles.prefix : "none",
      suffix: suffixTitles[titles.suffix] ? titles.suffix : "none",
    };
  }

  function calculateTitleBonus(map, titles = {}) {
    const selection = normalizeTitleSelection(titles);
    const prefix = prefixTitles[selection.prefix];
    const suffix = suffixTitles[selection.suffix];
    const heroId = Number(map?.heroId);
    const prefixActive =
      selection.prefix !== "none" &&
      Number.isInteger(heroId) &&
      prefix.heroIds.includes(heroId);
    const suffixActive =
      selection.suffix !== "none" &&
      (suffix.condition === "lost"
        ? map?.lost === true
        : map?.titleConditions?.[suffix.condition] === true);

    return {
      prefix: prefixActive ? prefix.bonus : 0,
      suffix: suffixActive ? suffix.bonus : 0,
      total:
        (prefixActive ? prefix.bonus : 0) +
        (suffixActive ? suffix.bonus : 0),
      prefixActive,
      suffixActive,
    };
  }

  function scoreMap(map, emblems, titles = {}, customMultipliers = null) {
    const result = scoreStatistics(map?.stats, emblems, 1, customMultipliers);
    const titleBonus = calculateTitleBonus(map, titles);
    return {
      ...result,
      baseScore: result.score,
      score:
        result.score === null
          ? null
          : result.score * (1 + titleBonus.total),
      emblemScores:
        result.score === null
          ? result.emblemScores
          : result.emblemScores.map(
              (value) => value * (1 + titleBonus.total),
            ),
      matchId: map?.matchId ?? null,
      seriesId: map?.seriesId ?? null,
      seriesType: map?.seriesType ?? null,
      opponent: map?.opponent ?? null,
      titleBonus,
    };
  }

  function seriesKey(result) {
    if (result.seriesId !== null && result.seriesId !== undefined) {
      return `series:${result.seriesId}`;
    }
    return `match:${result.matchId}`;
  }

  function countedGamesForSeries(
    seriesType,
    enableBestOfFiveScoring = enableTiBestOfFiveScoring,
  ) {
    if (!enableBestOfFiveScoring) return 2;
    return countedGamesBySeriesType[Number(seriesType)] ?? 2;
  }

  function aggregateMapResults(mapResults, mode) {
    if (!scoreModes.includes(mode)) {
      throw new Error(`未知的积分方式：${mode}`);
    }

    const complete = mapResults.filter((result) => result.score !== null);
    if (!complete.length) {
      return {
        score: null,
        coverage: 0,
        missing: Array.from(
          new Set(mapResults.flatMap((result) => result.missing || [])),
        ),
        components: mapResults[0]?.components ?? [],
        emblemScores: Array.from(
          { length: mapResults[0]?.emblemScores?.length ?? 0 },
          () => null,
        ),
        matchId: null,
        matchIds: [],
        seriesId: null,
        opponent: null,
      };
    }

    if (mode === "average") {
      return {
        score:
          (complete.reduce((sum, result) => sum + result.score, 0) /
            complete.length) * 2,
        coverage: complete.length,
        missing: [],
        components: [],
        emblemScores: combineEmblemScores(
          complete,
          2 / complete.length,
        ),
        matchId: null,
        matchIds: complete.map((result) => result.matchId),
        seriesId: null,
        opponent: null,
      };
    }

    const bySeries = new Map();
    for (const result of complete) {
      const key = seriesKey(result);
      const series = bySeries.get(key) ?? [];
      series.push(result);
      bySeries.set(key, series);
    }

    const seriesResults = Array.from(bySeries.values()).map((series) => {
      const ranked = [...series].sort((left, right) => right.score - left.score);
      const counted = ranked.slice(
        0,
        countedGamesForSeries(series[0].seriesType),
      );
      const score = counted.reduce((sum, result) => sum + result.score, 0);
      return {
        score,
        counted,
        seriesId: series[0].seriesId,
      };
    });
    const bestSeries = seriesResults.reduce((best, result) =>
      result.score > best.score ? result : best,
    );

    return {
      score: bestSeries.score,
      coverage: complete.length,
      missing: [],
      components: [],
      emblemScores: combineEmblemScores(bestSeries.counted),
      matchId:
        bestSeries.counted.length === 1
          ? bestSeries.counted[0].matchId
          : null,
      matchIds: bestSeries.counted.map((result) => result.matchId),
      seriesId: bestSeries.seriesId,
      opponent: bestSeries.counted.find((result) => result.opponent)?.opponent ?? null,
    };
  }

  function scorePlayer(
    player,
    emblems,
    mode = "average",
    titles = {},
    customMultipliers = null,
  ) {
    const maps = Array.isArray(player.maps) ? player.maps : [];
    if (!maps.length) {
      return scoreStatistics(
        player.averages,
        emblems,
        player.games ?? 0,
        customMultipliers,
      );
    }

    return aggregateMapResults(
      maps.map((map) =>
        scoreMap(map, emblems, titles, customMultipliers),
      ),
      mode,
    );
  }

  function scorePair(
    first,
    second,
    emblems,
    mode = "average",
    titles = {},
    customMultipliers = null,
  ) {
    const firstMaps = Array.isArray(first.maps) ? first.maps : [];
    const secondMaps = Array.isArray(second.maps) ? second.maps : [];
    if (!firstMaps.length || !secondMaps.length) {
      const firstScore = scorePlayer(
        first,
        emblems,
        mode,
        titles,
        customMultipliers,
      );
      const secondScore = scorePlayer(
        second,
        emblems,
        mode,
        titles,
        customMultipliers,
      );
      const complete =
        firstScore.score !== null && secondScore.score !== null;
      return {
        score: complete
          ? (firstScore.score + secondScore.score) / 2
          : null,
        coverage: Math.min(firstScore.coverage, secondScore.coverage),
        missing: Array.from(
          new Set([...firstScore.missing, ...secondScore.missing]),
        ),
        emblemScores: complete
          ? combineEmblemScores([firstScore, secondScore], 0.5)
          : Array.from({ length: emblems.length }, () => null),
        matchId: null,
        matchIds: [],
        seriesId: null,
        opponent: null,
      };
    }

    const firstByMatch = new Map(
      firstMaps.map((map) => [String(map.matchId), map]),
    );
    const sharedResults = [];
    const missing = [];

    for (const secondMap of secondMaps) {
      const firstMap = firstByMatch.get(String(secondMap.matchId));
      if (!firstMap) continue;
      const firstResult = scoreMap(
        firstMap,
        emblems,
        titles,
        customMultipliers,
      );
      const secondResult = scoreMap(
        secondMap,
        emblems,
        titles,
        customMultipliers,
      );

      if (firstResult.score === null || secondResult.score === null) {
        missing.push(...firstResult.missing, ...secondResult.missing);
        continue;
      }

      sharedResults.push({
        matchId: secondMap.matchId,
        seriesId: secondMap.seriesId ?? firstMap.seriesId ?? null,
        seriesType: secondMap.seriesType ?? firstMap.seriesType ?? null,
        score: (firstResult.score + secondResult.score) / 2,
        emblemScores: combineEmblemScores(
          [firstResult, secondResult],
          0.5,
        ),
        missing: [],
        opponent: secondMap.opponent ?? firstMap.opponent ?? null,
      });
    }

    if (!sharedResults.length) {
      return {
        score: null,
        coverage: 0,
        missing: Array.from(new Set(missing)),
        emblemScores: Array.from({ length: emblems.length }, () => null),
        matchId: null,
        matchIds: [],
        seriesId: null,
        opponent: null,
      };
    }

    return aggregateMapResults(sharedResults, mode);
  }

  function sortRankings(a, b) {
    if (a.score === null && b.score !== null) return 1;
    if (a.score !== null && b.score === null) return -1;
    if (a.score !== null && b.score !== null && b.score !== a.score) {
      return b.score - a.score;
    }
    return a.key.localeCompare(b.key, "zh-CN");
  }

  function buildRankings(
    role,
    players,
    emblems,
    mode = "average",
    titles = {},
    customMultipliers = null,
  ) {
    const eligible = players.filter((player) => player.role === role);

    if (role === "mid") {
      return eligible
        .map((player) => {
          const result = scorePlayer(
            player,
            emblems,
            mode,
            titles,
            customMultipliers,
          );
          return {
            key: `mid:${player.id}`,
            teamId: player.teamId,
            label: player.name,
            subtitle: player.teamName,
            score: result.score,
            emblemScores: result.emblemScores,
            coverage: result.coverage,
            players: [player],
            missing: result.missing,
            matchId: result.matchId,
            matchIds: result.matchIds,
            seriesId: result.seriesId,
            opponent: result.opponent,
          };
        })
        .sort(sortRankings);
    }

    const byTeam = new Map();
    for (const player of eligible) {
      const roster = byTeam.get(player.teamId) ?? [];
      roster.push(player);
      byTeam.set(player.teamId, roster);
    }

    const pairs = [];
    for (const [teamId, roster] of byTeam.entries()) {
      for (let left = 0; left < roster.length; left += 1) {
        for (let right = left + 1; right < roster.length; right += 1) {
          const first = roster[left];
          const second = roster[right];
          const pairScore = scorePair(
            first,
            second,
            emblems,
            mode,
            titles,
            customMultipliers,
          );
          const orderedIds = [first.id, second.id].sort();

          pairs.push({
            key: `${role}:${teamId}:${orderedIds.join("+")}`,
            teamId,
            label: `${first.name} & ${second.name}`,
            subtitle: first.teamName,
            score: pairScore.score,
            emblemScores: pairScore.emblemScores,
            coverage: pairScore.coverage,
            players: [first, second],
            missing: pairScore.missing,
            matchId: pairScore.matchId,
            matchIds: pairScore.matchIds,
            seriesId: pairScore.seriesId,
            opponent: pairScore.opponent,
          });
        }
      }
    }

    return pairs.sort(sortRankings);
  }

  const defaultBannerConfig = {
    core: [
      { color: "red", stat: "gpm", quality: 3, trait: "fractal" },
      {
        color: "green",
        stat: "teamfight_participation",
        quality: 4,
        trait: "benevolent",
      },
      {
        color: "red",
        stat: "tower_kills",
        quality: 5,
        trait: "vampire",
      },
    ],
    mid: [
      { color: "red", stat: "deaths", quality: 4, trait: "fractal" },
      {
        color: "blue",
        stat: "runes_grabbed",
        quality: 1,
        trait: "benevolent",
      },
      {
        color: "green",
        stat: "teamfight_participation",
        quality: 3,
        trait: "vampire",
      },
    ],
    support: [
      {
        color: "blue",
        stat: "observer_wards_placed",
        quality: 3,
        trait: "friendly",
      },
      {
        color: "green",
        stat: "teamfight_participation",
        quality: 4,
        trait: "friendly",
      },
      {
        color: "blue",
        stat: "smokes_used",
        quality: 2,
        trait: "friendly",
      },
    ],
  };

  const internationalBannerConfig = {
    core: [
      ...defaultBannerConfig.core.map((emblem) => ({ ...emblem })),
      { color: "green", stat: "stun_seconds", quality: 2, trait: "unique" },
      { color: "red", stat: "kills", quality: 1, trait: "friendly" },
    ],
    mid: [
      ...defaultBannerConfig.mid.map((emblem) => ({ ...emblem })),
      { color: "red", stat: "gpm", quality: 5, trait: "unique" },
      {
        color: "green",
        stat: "stun_seconds",
        quality: 2,
        trait: "friendly",
      },
    ],
    support: [
      ...defaultBannerConfig.support.map((emblem) => ({ ...emblem })),
      { color: "green", stat: "stun_seconds", quality: 5, trait: "unique" },
      {
        color: "blue",
        stat: "lotuses_collected",
        quality: 1,
        trait: "fractal",
      },
    ],
  };

  const defaultBannerConfigs = {
    groupStage: defaultBannerConfig,
    international: internationalBannerConfig,
  };

  function validateBannerConfig(config, stage) {
    const inferredStage = stage || (config?.core?.length === 5
      ? "international"
      : "groupStage");
    if (!stageKeys.includes(inferredStage)) {
      throw new Error("未知的赛事阶段。");
    }
    const expectedRoleColors = stageRoleColors[inferredStage];

    for (const role of bannerRoles) {
      const emblems = config[role];
      if (!Array.isArray(emblems) || emblems.length !== expectedRoleColors[role].length) {
        throw new Error(
          `${role} 战旗必须恰好有 ${expectedRoleColors[role].length} 枚徽标。`,
        );
      }

      emblems.forEach((emblem, index) => {
        const expectedColor = expectedRoleColors[role][index];
        if (emblem.color !== expectedColor) {
          throw new Error(`${role} 第 ${index + 1} 枚徽标颜色不正确。`);
        }
        if (!statDefinitions[emblem.stat] || statDefinitions[emblem.stat].color !== emblem.color) {
          throw new Error(`${emblem.stat} 不属于 ${emblem.color} 徽标。`);
        }
        if (!qualities.includes(emblem.quality)) {
          throw new Error("徽标品质必须为 1 至 5 阶。");
        }
        if (!traits.includes(emblem.trait)) {
          throw new Error("未知的徽标特性。");
        }
      });
    }
  }

  function formatScore(value) {
    if (value === null || !Number.isFinite(value)) return "数据不足";
    return new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function cloneDefaultConfig(stage = "groupStage") {
    const source = defaultBannerConfigs[stage];
    if (!source) throw new Error("未知的赛事阶段。");
    return {
      core: source.core.map((emblem) => ({ ...emblem })),
      mid: source.mid.map((emblem) => ({ ...emblem })),
      support: source.support.map((emblem) => ({ ...emblem })),
    };
  }

  return {
    bannerRoles,
    stageKeys,
    scoreModes,
    emblemColors,
    qualities,
    traits,
    statKeys,
    statDefinitions,
    internationalRoleColors,
    qualityBonus,
    prefixTitles,
    suffixTitles,
    prefixTitleKeys,
    suffixTitleKeys,
    calculateEmblemModifiers,
    scoreRawStat,
    rankAverageContributions,
    scoreStatistics,
    calculateTitleBonus,
    countedGamesForSeries,
    scorePlayer,
    scorePair,
    buildRankings,
    validateBannerConfig,
    formatScore,
    cloneDefaultConfig,
  };
});
