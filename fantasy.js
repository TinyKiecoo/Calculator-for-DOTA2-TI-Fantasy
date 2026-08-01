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
  const emblemColors = ["red", "blue", "green"];
  const qualities = [1, 2, 3, 4, 5];
  const traits = [
    "fractal",
    "benevolent",
    "vampire",
    "unique",
    "friendly",
  ];

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
      shortLabel: "击杀",
      formula: "每次 × 107",
    },
    deaths: {
      color: "red",
      label: "死亡",
      shortLabel: "死亡",
      formula: "1950 − 每次 × 195",
    },
    creep_score: {
      color: "red",
      label: "正反补",
      shortLabel: "正反补",
      formula: "每次 × 3",
    },
    gpm: {
      color: "red",
      label: "GPM",
      shortLabel: "GPM",
      formula: "数值 × 2",
    },
    madstone_collected: {
      color: "red",
      label: "狂石收集数量",
      shortLabel: "狂石",
      formula: "每块 × 13",
    },
    tower_kills: {
      color: "red",
      label: "摧毁防御塔",
      shortLabel: "防御塔",
      formula: "每座 × 352",
    },
    observer_wards_placed: {
      color: "blue",
      label: "放置侦察守卫",
      shortLabel: "侦察守卫",
      formula: "每个 × 117",
    },
    camps_stacked: {
      color: "blue",
      label: "堆叠野怪",
      shortLabel: "堆野",
      formula: "每次 × 234",
    },
    runes_grabbed: {
      color: "blue",
      label: "拾取神符",
      shortLabel: "神符",
      formula: "每个 × 141",
    },
    watchers_taken: {
      color: "blue",
      label: "占领观察者",
      shortLabel: "观察者",
      formula: "每个 × 147",
    },
    smokes_used: {
      color: "blue",
      label: "使用诡计之雾",
      shortLabel: "开雾",
      formula: "每次 × 293",
    },
    lotuses_collected: {
      color: "blue",
      label: "采集莲花",
      shortLabel: "莲花",
      formula: "每朵 × 176",
    },
    roshan_kills: {
      color: "green",
      label: "击杀肉山",
      shortLabel: "肉山",
      formula: "每次 × 1172",
    },
    teamfight_participation: {
      color: "green",
      label: "参与团战",
      shortLabel: "参团",
      formula: "参团率 × 2124",
    },
    stun_seconds: {
      color: "green",
      label: "眩晕时间",
      shortLabel: "眩晕",
      formula: "每秒 × 10",
    },
    tormentor_kills: {
      color: "green",
      label: "消灭痛苦魔方",
      shortLabel: "魔方",
      formula: "每次 × 879",
    },
    first_blood: {
      color: "green",
      label: "第一滴血",
      shortLabel: "一血",
      formula: "获得时 +1934",
    },
    courier_kills: {
      color: "green",
      label: "杀害信使",
      shortLabel: "信使",
      formula: "每次 × 703",
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

  const qualityLabels = {
    1: "第 1 阶",
    2: "第 2 阶",
    3: "第 3 阶",
    4: "第 4 阶",
    5: "第 5 阶",
  };

  const traitLabels = {
    fractal: "分形",
    benevolent: "仁爱",
    vampire: "吸血鬼",
    unique: "唯一",
    friendly: "友好",
  };

  const traitDescriptions = {
    fractal: "战旗上所有徽标品质各不相同时，自身 +60%",
    benevolent: "向相邻徽标提供 +20%",
    vampire: "自身 +50%，相邻徽标 −10%",
    unique: "全旗只有一枚“唯一”时，自身 +30%",
    friendly: "全旗至少三枚“友好”时，自身 +50%",
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

  function scoreStatistics(statistics, emblems, coverage = 1) {
    const modifiers = calculateEmblemModifiers(emblems);
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
    };
  }

  function scorePlayer(player, emblems, mode = "average") {
    if (!scoreModes.includes(mode)) {
      throw new Error(`未知的积分方式：${mode}`);
    }

    const maps = Array.isArray(player.maps) ? player.maps : [];
    if (!maps.length) {
      return scoreStatistics(
        player.averages,
        emblems,
        player.games ?? 0,
      );
    }

    const mapResults = maps.map((map) => ({
      ...scoreStatistics(map.stats, emblems, 1),
      matchId: map.matchId,
    }));
    const complete = mapResults.filter((result) => result.score !== null);

    if (!complete.length) {
      return {
        score: null,
        coverage: 0,
        missing: Array.from(
          new Set(mapResults.flatMap((result) => result.missing)),
        ),
        components: mapResults[0]?.components ?? [],
        matchId: null,
      };
    }

    if (mode === "highest") {
      const best = complete.reduce((current, result) =>
        result.score > current.score ? result : current,
      );
      return {
        ...best,
        coverage: complete.length,
      };
    }

    return {
      score:
        complete.reduce((sum, result) => sum + result.score, 0) /
        complete.length,
      coverage: complete.length,
      missing: [],
      components: [],
      matchId: null,
    };
  }

  function scorePair(first, second, emblems, mode = "average") {
    if (!scoreModes.includes(mode)) {
      throw new Error(`未知的积分方式：${mode}`);
    }

    const firstMaps = Array.isArray(first.maps) ? first.maps : [];
    const secondMaps = Array.isArray(second.maps) ? second.maps : [];
    if (!firstMaps.length || !secondMaps.length) {
      const firstScore = scorePlayer(first, emblems, mode);
      const secondScore = scorePlayer(second, emblems, mode);
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
        matchId: null,
      };
    }

    const firstByMatch = new Map(
      firstMaps.map((map) => [
        String(map.matchId),
        scoreStatistics(map.stats, emblems, 1),
      ]),
    );
    const sharedResults = [];
    const missing = [];

    for (const map of secondMaps) {
      const firstResult = firstByMatch.get(String(map.matchId));
      if (!firstResult) continue;
      const secondResult = scoreStatistics(map.stats, emblems, 1);

      if (
        firstResult.score === null ||
        secondResult.score === null
      ) {
        missing.push(...firstResult.missing, ...secondResult.missing);
        continue;
      }

      sharedResults.push({
        matchId: map.matchId,
        score: (firstResult.score + secondResult.score) / 2,
      });
    }

    if (!sharedResults.length) {
      return {
        score: null,
        coverage: 0,
        missing: Array.from(new Set(missing)),
        matchId: null,
      };
    }

    if (mode === "highest") {
      const best = sharedResults.reduce((current, result) =>
        result.score > current.score ? result : current,
      );
      return {
        score: best.score,
        coverage: sharedResults.length,
        missing: [],
        matchId: best.matchId,
      };
    }

    return {
      score:
        sharedResults.reduce((sum, result) => sum + result.score, 0) /
        sharedResults.length,
      coverage: sharedResults.length,
      missing: [],
      matchId: null,
    };
  }

  function sortRankings(a, b) {
    if (a.score === null && b.score !== null) return 1;
    if (a.score !== null && b.score === null) return -1;
    if (a.score !== null && b.score !== null && b.score !== a.score) {
      return b.score - a.score;
    }
    return a.key.localeCompare(b.key, "zh-CN");
  }

  function buildRankings(role, players, emblems, mode = "average") {
    const eligible = players.filter((player) => player.role === role);

    if (role === "mid") {
      return eligible
        .map((player) => {
          const result = scorePlayer(player, emblems, mode);
          return {
            key: `mid:${player.id}`,
            teamId: player.teamId,
            label: player.name,
            subtitle: player.teamName,
            score: result.score,
            coverage: result.coverage,
            players: [player],
            missing: result.missing,
            matchId: result.matchId,
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
          );
          const orderedIds = [first.id, second.id].sort();

          pairs.push({
            key: `${role}:${teamId}:${orderedIds.join("+")}`,
            teamId,
            label: `${first.name} · ${second.name}`,
            subtitle: first.teamName,
            score: pairScore.score,
            coverage: pairScore.coverage,
            players: [first, second],
            missing: pairScore.missing,
            matchId: pairScore.matchId,
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
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
    roleColors,
    internationalRoleColors,
    stageRoleColors,
    qualityBonus,
    qualityLabels,
    traitLabels,
    traitDescriptions,
    calculateEmblemModifiers,
    scoreRawStat,
    scoreStatistics,
    scorePlayer,
    scorePair,
    buildRankings,
    defaultBannerConfig,
    internationalBannerConfig,
    defaultBannerConfigs,
    validateBannerConfig,
    formatScore,
    cloneDefaultConfig,
  };
});
