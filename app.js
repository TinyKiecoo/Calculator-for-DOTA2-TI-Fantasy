(function () {
  "use strict";

  const dataset = window.FANTASY_DATA;
  const engine = window.FantasyEngine;
  const bannerGrid = document.getElementById("banner-grid");
  const totalScore = document.getElementById("total-score");
  const loadError = document.getElementById("load-error");
  const pageShell = document.getElementById("page-shell");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modal = document.getElementById("info-modal");
  const modalKicker = document.getElementById("modal-kicker");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");
  const stageSwitcher = document.getElementById("stage-switcher");
  const multiplierSwitcher = document.getElementById("multiplier-switcher");
  const detailedScoreToggle = document.getElementById("detailed-score-toggle");
  const prefixTitleSelect = document.getElementById("prefix-title-select");
  const suffixTitleSelect = document.getElementById("suffix-title-select");
  const correctionBanner = document.getElementById("correction-banner");
  const correctionBannerClose = document.getElementById("correction-banner-close");
  const scoringChangeNoticeOpen = document.getElementById("scoring-change-notice-open");

  const languageToggle = document.getElementById("language-toggle");
  const LANGUAGE_STORAGE_KEY = "ti-fantasy-language";
  const PAGE_STATE_STORAGE_KEY = "ti-fantasy-page-state-v1";
  const SCORING_CHANGE_NOTICE_STORAGE_KEY = "ti-fantasy-scoring-change-notice-v1";
  const VISITED_STORAGE_KEY = "ti-fantasy-visited-v1";
  const TORMENTOR_CORRECTION_NOTICE_STORAGE_KEY =
    "ti-fantasy-tormentor-correction-notice-v1";
  const MULTIPLIER_MODES = ["calculated", "manual"];
  const SCORING_CHANGES = [
    { key: "kills", previous: 121, current: 107 },
    { key: "deaths", previous: 1800, current: 1950 },
    { key: "creep_score", previous: 3, current: 3 },
    { key: "gpm", previous: 2, current: 2 },
    { key: "madstone_collected", previous: 19, current: 13 },
    { key: "tower_kills", previous: 340, current: 352 },
    { key: "observer_wards_placed", previous: 113, current: 117 },
    { key: "camps_stacked", previous: 170, current: 234 },
    { key: "runes_grabbed", previous: 121, current: 141 },
    { key: "watchers_taken", previous: 121, current: 147 },
    { key: "lotuses_collected", previous: 213, current: 176 },
    { key: "roshan_kills", previous: 850, current: 1172 },
    { key: "teamfight_participation", previous: 1895, current: 2124 },
    { key: "stun_seconds", previous: 15, current: 10 },
    { key: "tormentor_kills", previous: 850, current: 879 },
    { key: "courier_kills", previous: 850, current: 703 },
    { key: "first_blood", previous: 1700, current: 1934 },
    { key: "smokes_used", previous: 283, current: 293 },
  ];

  const translations = {
    zh: {
      locale: "zh-CN",
      documentTitle: "Dota 2 TI 2026 梦幻挑战计算器",
      description: "免费的开源 Dota 2 TI 2026 梦幻挑战计算器，基于 2026 电竞世界杯比赛录像数据比较选手表现并估算梦幻积分。",
      backToTop: "返回梦幻挑战顶部",
      brandName: "梦幻挑战",
      pageHeading: "开源的 Dota 2 梦幻挑战计算器",
      accuracyNote: "计算结果可能不准确，数据仅供参考。",
      pageActions: "页面操作",
      githubRepository: "GitHub",
      githubAria: "在新标签页打开 GitHub 仓库",
      candyworksCalculator: "糖果车计算器",
      candyworksAria: "在新标签页打开糖果车计算器",
      switchLanguage: "切换为英文",
      dataNotes: "数据说明",
      stageSwitcher: "赛事阶段",
      multiplierSwitcher: "徽标倍率方式",
      showDetailedScores: "显示详细得分",
      detailedEmblemScore: "{stat}得分",
      calculatedMultiplier: "品质与特性",
      manualMultiplier: "手动倍率",
      manualMultiplierInput: "{role}第 {index} 枚徽标的手动倍率",
      advisorTitles: "指导员称号",
      prefixTitle: "前缀",
      suffixTitle: "后缀",
      scoringChangeNotice: "温馨提示：请注意今年积分规则的改变。",
      openScoringChangeNotice: "查看 2025 与 2026 积分规则变化",
      closeScoringChangeNotice: "关闭积分规则变化提示",
      scoringChangesKicker: "SCORING CHANGES",
      scoringChangesTitle: "2025 与 2026 积分规则对比",
      scoringChangesLead: "以下项目按基础积分系数的相对涨跌幅从高到低排列。",
      tormentorCorrectionBody: '原有的"消灭痛苦魔方"数值整体偏低，目前已修正。请您知悉。',
      scoringCategory: "项目",
      scoringPreviousYear: "2025",
      scoringCurrentYear: "2026",
      scoringRelativeChange: "相对变化",
      scoringChanges: {
        kills: { label: "击杀", previous: "每个击杀 +121", current: "每个击杀 +107" },
        deaths: { label: "死亡", previous: "初始积分为 1800，每次阵亡 -180", current: "初始积分为 1950，每次阵亡 -195" },
        creep_score: { label: "正反补", previous: "每个正补/反补 +3", current: "每个正补/反补 +3" },
        gpm: { label: "GPM", previous: "得分为选手 GPM 乘以 2", current: "得分为选手 GPM 乘以 2" },
        madstone_collected: { label: "狂石收集数量", previous: "每收集一块狂石 +19", current: "每收集一块狂石 +13" },
        tower_kills: { label: "摧毁防御塔", previous: "摧毁一座防御塔 +340", current: "摧毁一座防御塔 +352" },
        observer_wards_placed: { label: "放置守卫", previous: "放置一个侦察守卫 +113", current: "放置一个侦察守卫 +117" },
        camps_stacked: { label: "堆叠野怪", previous: "堆叠一次野怪 +170", current: "堆叠一次野怪 +234" },
        runes_grabbed: { label: "拾取神符", previous: "装入/激活一个神符 +121", current: "装入/激活一个神符 +141" },
        watchers_taken: { label: "占领观察者", previous: "占领一个观察者 +121", current: "占领一个观察者 +147" },
        lotuses_collected: { label: "采集莲花", previous: "采集一朵莲花 +213", current: "采集一朵莲花 +176" },
        roshan_kills: { label: "击杀肉山", previous: "击杀肉山 +850", current: "击杀肉山 +1172" },
        teamfight_participation: { label: "参与团战", previous: "参与团战最多可得 1895", current: "参与团战最多可得 2124" },
        stun_seconds: { label: "眩晕时间", previous: "造成一秒眩晕 +15", current: "造成一秒眩晕 +10" },
        tormentor_kills: { label: "消灭痛苦魔方", previous: "消灭痛苦魔方 +850", current: "消灭痛苦魔方 +879" },
        courier_kills: { label: "杀害信使", previous: "杀害一次信使 +850", current: "杀害一次信使 +703" },
        first_blood: { label: "第一滴血", previous: "选手获得第一滴血时获得 1700 分", current: "选手获得第一滴血时获得 1934 分" },
        smokes_used: { label: "开雾次数", previous: "每次使用诡计之雾 +283", current: "每次使用诡计之雾 +293" },
      },
      bannerGrid: "三面梦幻战旗",
      loading: "正在载入本地赛事数据…",
      loadErrorTitle: "本地数据未能载入",
      loadErrorBody: "请确认 index.html、app.js、fantasy.js 与 data 文件夹保持原有相对位置。",
      closeModal: "关闭弹窗",
      close: "关闭 ×",
      localSnapshot: "本地快照",
      teamFallback: "队伍 {id}",
      playerFallback: "选手 {id}",
      unknown: "未知",
      insufficientData: "数据不足",
      waitingForData: "等待有效数据",
      statistic: "统计数据",
      quality: "品质",
      trait: "特性",
      totalTraitEffect: "自身与相邻特性的合计影响",
      emblemAria: "{role}第 {index} 枚{color}徽标",
      liveRanking: "{role}实时排名",
      scoreMethod: "积分方式",
      highestScore: "最高两场",
      averageScore: "全部地图平均 ×2",
      emblemPennant: "{role}徽标挂幅",
      bannerScore: "{role}战旗积分",
      dataKicker: "DATA NOTES",
      dataLead: "本页面使用 {name} 的数据来计算梦幻挑战积分。",
      tournamentSnapshot: "赛事快照",
      leagueId: "联赛 ID",
      parsedMatches: "已解析比赛",
      players: "选手",
      generatedDate: "生成日期",
      scoringMethodTitle: "计算口径",
      scoringMethodBody: "每位选手逐场应用徽标与指导员称号加成；双人战旗在同一场比赛中先取二人平均。“最高两场”目前在所有赛制中统一取系列赛内最高两场之和，再选择全结算期得分最高的系列赛；“全部地图平均 ×2”对全结算期所有有效地图取平均并乘二，不再逐系列赛择优。手动倍率模式会完全替代徽标品质与特性的倍率。",
      knownLimitations: "数据说明",
      limitationRoles: "选手角色按赛事内路线与补刀数据推断。",
      dataSources: "数据来源",
      dataSourcesBody: "全部比赛信息与梦幻统计均直接读取 Valve 比赛录像；OpenDota 仅用于查找联赛录像下载链接。",
      disclaimerTitle: "免责声明",
      disclaimerProject: "这是一个免费、开源、非商业的玩家项目，与 Valve、Steam 或 Dota 2 官方无关联。计算结果可能不准确，数据仅供参考。",
      disclaimerAssets: "本项目使用了 Dota 2 / Valve 相关图片、字体、名称和界面素材。这些素材仍归 Valve 及相应权利方所有；本项目的开源许可证不授予这些素材的使用权。",
      disclaimerCounterBefore: "本站使用第三方访问计数服务。公开的计数值可在",
      disclaimerCounterLink: "这里",
      disclaimerCounterAfter: " 查看。",
      roles: { core: "核心", mid: "中单", support: "辅助" },
      colors: { red: "红色", blue: "蓝色", green: "绿色" },
      qualityLabels: {
        1: "第 1 阶", 2: "第 2 阶", 3: "第 3 阶", 4: "第 4 阶", 5: "第 5 阶",
      },
      traitLabels: {
        fractal: "分形", benevolent: "仁爱", vampire: "吸血鬼", unique: "唯一", friendly: "友好",
      },
      prefixTitles: {
        none: "不选择前缀",
        crimson: "猩红的：使用红色英雄时 +6%。",
        azure: "蔚蓝的：使用蓝色英雄时 +11%。",
        emerald: "碧绿的：使用绿色英雄时 +6%。",
        purple: "紫气的：使用紫色英雄时 +10%。",
        golden: "金光的：使用黄色或棕色英雄 +8%。",
        elemental: "精通元素的：使用水系、火系或冰系英雄时 +8%。",
        otherworldly: "异界的：使用亡灵、恶魔或圣灵英雄时 +7%。",
        heroic: "盖世英雄：使用穿披风或戴面具的英雄时 +9%。",
      },
      suffixTitles: {
        none: "不选择后缀",
        sufferer: "受难之人：有任意选手死于痛苦魔方时 +23%。",
        flayedTwinsAcolyte: "剥皮双子侍祭：任意选手在号角吹响前拿到第一滴血则 +9%。",
        patient: "隐忍之人：第一滴血在 10 分钟后发生则 +23%。",
        loser: "败者：选手失利的比赛中 +6%。",
        bold: "果敢之人：短于 25 分钟的比赛中 +24%。",
        pivotal: "关键之人：系列赛有可能打到的最后一场比赛中 +16%。",
        lucky: "幸运之人：若比赛时间以 8 结尾则 +21%。",
        cruel: "残酷之人：若有选手在己方泉水阵亡则 +13%。",
      },
      stats: {
        kills: { label: "击杀", formula: "每次 × 107" },
        deaths: { label: "死亡", formula: "1950 − 每次 × 195" },
        creep_score: { label: "正反补", formula: "每次 × 3" },
        gpm: { label: "GPM", formula: "数值 × 2" },
        madstone_collected: { label: "狂石收集数量", formula: "每块 × 13" },
        tower_kills: { label: "摧毁防御塔", formula: "每座 × 352" },
        observer_wards_placed: { label: "放置侦察守卫", formula: "每个 × 117" },
        camps_stacked: { label: "堆叠野怪", formula: "每次 × 234" },
        runes_grabbed: { label: "拾取神符", formula: "每个 × 141" },
        watchers_taken: { label: "占领观察者", formula: "每个 × 147" },
        smokes_used: { label: "使用诡计之雾", formula: "每次 × 293" },
        lotuses_collected: { label: "采集莲花", formula: "每朵 × 176" },
        roshan_kills: { label: "击杀肉山", formula: "每次 × 1172" },
        teamfight_participation: { label: "参与团战", formula: "参团率 × 2124" },
        stun_seconds: { label: "眩晕时间", formula: "每秒 × 10" },
        tormentor_kills: { label: "消灭痛苦魔方", formula: "每次 × 879" },
        first_blood: { label: "第一滴血", formula: "获得时 +1934" },
        courier_kills: { label: "杀害信使", formula: "每次 × 703" },
      },
    },
    en: {
      locale: "en-US",
      documentTitle: "Dota 2 TI 2026 Fantasy Calculator",
      description: "Free, open-source Dota 2 TI 2026 Fantasy Challenge calculator using Esports World Cup 2026 replay data to compare players and estimate fantasy scores.",
      backToTop: "Back to the Fantasy Challenge top",
      brandName: "FANTASY",
      pageHeading: "An open-source calculator for DOTA 2 TI Fantasy predictions.",
      accuracyNote: "Results may be inaccurate and are for reference only.",
      pageActions: "Page actions",
      githubRepository: "GitHub",
      githubAria: "Open the GitHub repository in a new tab",
      candyworksCalculator: "Candyworks Calculator",
      candyworksAria: "Open the Candyworks Calculator in a new tab",
      switchLanguage: "Switch to Chinese",
      dataNotes: "Data Notes",
      stageSwitcher: "Tournament stage",
      multiplierSwitcher: "Emblem multiplier mode",
      showDetailedScores: "Show detailed scores",
      detailedEmblemScore: "{stat} score",
      calculatedMultiplier: "Quality & Trait",
      manualMultiplier: "Manual Multiplier",
      manualMultiplierInput: "Manual multiplier for {role} emblem {index}",
      advisorTitles: "Advisor titles",
      prefixTitle: "Prefix",
      suffixTitle: "Suffix",
      scoringChangeNotice: "Kind reminder: Please note this year's changes to the scoring rules.",
      openScoringChangeNotice: "View the 2025 and 2026 scoring-rule changes",
      closeScoringChangeNotice: "Dismiss scoring-rule change notice",
      scoringChangesKicker: "SCORING CHANGES",
      scoringChangesTitle: "2025 vs. 2026 Scoring Rules",
      scoringChangesLead: "Categories are sorted from the largest relative increase in their base scoring coefficient to the largest decrease.",
      tormentorCorrectionBody: "The previous “Tormentor Kills” values were generally too low and have now been corrected. Please take note.",
      scoringCategory: "Category",
      scoringPreviousYear: "2025",
      scoringCurrentYear: "2026",
      scoringRelativeChange: "Relative change",
      scoringChanges: {
        kills: { label: "KILLS", previous: "+121 per kill", current: "+107 per kill" },
        deaths: { label: "DEATHS", previous: "1800 starting points, -180 per death", current: "1950 starting points, -195 per death" },
        creep_score: { label: "CREEP SCORE", previous: "+3 per last hit or deny", current: "+3 per last hit or deny" },
        gpm: { label: "GPM", previous: "Scores player's GPM Multiplied by 2", current: "Scores player's GPM Multiplied by 2" },
        madstone_collected: { label: "MADSTONE COLLECTED", previous: "+19 per Madstone collected", current: "+13 per Madstone collected" },
        tower_kills: { label: "TOWER KILLS", previous: "+340 per Tower last hit", current: "+352 per Tower last hit" },
        observer_wards_placed: { label: "WARDS PLACED", previous: "+113 per observer ward placed", current: "+117 per observer ward placed" },
        camps_stacked: { label: "CAMPS STACKED", previous: "+170 per camp stacked", current: "+234 per camp stacked" },
        runes_grabbed: { label: "RUNES GRABBED", previous: "+121 per rune bottled or taken", current: "+141 per rune bottled or taken" },
        watchers_taken: { label: "WATCHERS TAKEN", previous: "+121 per captured Watcher", current: "+147 per captured Watcher" },
        lotuses_collected: { label: "LOTUSES GRABBED", previous: "+213 per Lotus taken", current: "+176 per Lotus taken" },
        roshan_kills: { label: "ROSHAN KILLS", previous: "+850 per Roshan kill", current: "+1172 per Roshan kill" },
        teamfight_participation: { label: "TEAMFIGHT PARTICIPATION", previous: "Up to 1895 points based on participation", current: "Up to 2124 points based on participation" },
        stun_seconds: { label: "STUNS", previous: "+15 per second of stun", current: "+10 per second of stun" },
        tormentor_kills: { label: "TORMENTOR KILLS", previous: "+850 per Tormentor kill", current: "+879 per Tormentor kill" },
        courier_kills: { label: "COURIER KILLS", previous: "+850 per Courier kill", current: "+703 per Courier kill" },
        first_blood: { label: "FIRST BLOOD", previous: "+1700 if the player gets First Blood", current: "+1934 if the player gets First Blood" },
        smokes_used: { label: "SMOKES USED", previous: "+283 per Smoke of Deceit used", current: "+293 per Smoke of Deceit used" },
      },
      bannerGrid: "Three fantasy banners",
      loading: "Loading local tournament data…",
      loadErrorTitle: "Local data could not be loaded",
      loadErrorBody: "Keep index.html, app.js, fantasy.js, and the data folder in their original relative locations.",
      closeModal: "Close dialog",
      close: "Close ×",
      localSnapshot: "Local snapshot",
      teamFallback: "Team {id}",
      playerFallback: "Player {id}",
      unknown: "Unknown",
      insufficientData: "Insufficient data",
      waitingForData: "Waiting for valid data",
      statistic: "Statistic",
      quality: "Quality",
      trait: "Trait",
      totalTraitEffect: "Combined effect of this trait and adjacent traits",
      emblemAria: "{role}, emblem {index}, {color}",
      liveRanking: "Live {role} ranking",
      scoreMethod: "Scoring method",
      highestScore: "Best Two Maps",
      averageScore: "All-Map Average ×2",
      emblemPennant: "{role} emblem pennant",
      bannerScore: "{role} banner score",
      dataKicker: "DATA NOTES",
      dataLead: "This page uses {name} data to calculate Fantasy scores.",
      tournamentSnapshot: "Tournament Snapshot",
      leagueId: "League ID",
      parsedMatches: "Parsed matches",
      players: "Players",
      generatedDate: "Generated",
      scoringMethodTitle: "Scoring Method",
      scoringMethodBody: "Each player is scored map by map with emblem and advisor-title bonuses. Two-player banners first average both players within the same map. Best Two Maps currently sums the top two maps in every series format, then keeps the highest-scoring series in the period; All-Map Average ×2 averages every valid map in the full scoring period and doubles it without selecting a best series. Manual multiplier mode completely replaces quality and trait multipliers.",
      knownLimitations: "Data Notes",
      limitationRoles: "Player roles are inferred from lane and last-hit data within the tournament.",
      dataSources: "Data Sources",
      dataSourcesBody: "All match information and Fantasy statistics are read directly from Valve replays. OpenDota is used only to discover league replay download URLs.",
      disclaimerTitle: "Disclaimer",
      disclaimerProject: "This is a free, open-source, non-commercial fan project and is not affiliated with Valve, Steam, or Dota 2. Results may be inaccurate and are for reference only.",
      disclaimerAssets: "It uses Dota 2 / Valve-derived images, fonts, names, and UI materials. Those materials remain the property of Valve and their respective rights holders; this project's open-source license does not grant rights to them.",
      disclaimerCounterBefore: "This website uses third-party visit counters. The public counter value can be viewed",
      disclaimerCounterLink: "here",
      disclaimerCounterAfter: ".",
      roles: { core: "Core", mid: "Mid", support: "Support" },
      colors: { red: "Red", blue: "Blue", green: "Green" },
      qualityLabels: {
        1: "TIER I", 2: "TIER II", 3: "TIER III", 4: "TIER IV", 5: "TIER V",
      },
      traitLabels: {
        fractal: "FRACTAL", benevolent: "BENEVOLENT", vampire: "VAMPIRIC", unique: "UNIQUE", friendly: "FRIENDLY",
      },
      prefixTitles: {
        none: "No prefix",
        crimson: "Crimson: +6% when playing a red hero.",
        azure: "Cerulean: +11% when playing a blue hero.",
        emerald: "Emerald: +6% when playing a green hero.",
        purple: "Royal: +10% when playing a purple hero.",
        golden: "Golden: +8% when playing a yellow or brown hero.",
        elemental: "Elemental: +8% when playing an Aquatic, Fiery, or Icy Hero.",
        otherworldly: "Otherworldly: +7% when playing an Undead, Demon, or Spirit Hero.",
        heroic: "Heroic: +9% when playing a Caped or Masked Hero.",
      },
      suffixTitles: {
        none: "No suffix",
        sufferer: "the Tormented: +23% if any player dies to a Tormentor.",
        flayedTwinsAcolyte: "the Flayed Twins Acolyte: +9% if any player gets first blood before the starting horn.",
        patient: "the Patient: +23% if first blood does not happen until after 10 minutes.",
        loser: "the Underdog: +6% in games where the player losses.",
        bold: "the Decisive: +24% in games that last less than 25 minutes.",
        pivotal: "the Clutch: +16% when playing the last possible match of a series.",
        lucky: "the Lucky: +21% if the match time ends with an 8.",
        cruel: "the Cruel: +13% if a player is killed while in their own fountain.",
      },
      stats: {
        kills: { label: "KILLS", formula: "Each × 107" },
        deaths: { label: "DEATHS", formula: "1950 − each × 195" },
        creep_score: { label: "CREEP SCORE", formula: "Each × 3" },
        gpm: { label: "GPM", formula: "Value × 2" },
        madstone_collected: { label: "MADSTONES COLLECTED", formula: "Each × 13" },
        tower_kills: { label: "TOWER KILLS", formula: "Each × 352" },
        observer_wards_placed: { label: "WARDS PLACED", formula: "Each × 117" },
        camps_stacked: { label: "CAMPS STACKED", formula: "Each × 234" },
        runes_grabbed: { label: "RUNES GRABBED", formula: "Each × 141" },
        watchers_taken: { label: "WATCHERS TAKEN", formula: "Each × 147" },
        smokes_used: { label: "SMOKES USED", formula: "Each × 293" },
        lotuses_collected: { label: "LOTUSES GRABBED", formula: "Each × 176" },
        roshan_kills: { label: "ROSHAN KILLS", formula: "Each × 1172" },
        teamfight_participation: { label: "TEAMFIGHT PARTICIPATION", formula: "Rate × 2124" },
        stun_seconds: { label: "STUNS", formula: "Each second × 10" },
        tormentor_kills: { label: "TORMENTOR KILLS", formula: "Each × 879" },
        first_blood: { label: "FIRST BLOOD", formula: "+1934 when earned" },
        courier_kills: { label: "COURIER KILLS", formula: "Each × 703" },
      },
    },
  };

  let currentLanguage = window.__TI_FANTASY_LANGUAGE__ === "zh" ? "zh" : "en";

  function copy() {
    return translations[currentLanguage];
  }

  function text(key, variables = {}) {
    const template = copy()[key] ?? key;
    if (typeof template !== "string") return template;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(variables, name)
        ? String(variables[name])
        : `{${name}}`,
    );
  }

  function roleName(role) {
    return copy().roles[role] || role;
  }

  function colorName(color) {
    return copy().colors[color] || color;
  }

  function qualityLabel(quality) {
    return copy().qualityLabels[quality] || String(quality);
  }

  function traitLabel(trait) {
    return copy().traitLabels[trait] || trait;
  }

  function statDefinition(stat) {
    return copy().stats[stat] || engine.statDefinitions[stat];
  }

  function detectLanguage() {
    const preferred =
      (navigator.languages && navigator.languages[0]) ||
      navigator.language ||
      "en";
    return String(preferred).toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function saveLanguage(language) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      // The page still works when storage is blocked.
    }
  }

  function initializeScoringChangeNotice() {
    let dismissed = false;
    try {
      dismissed =
        localStorage.getItem(SCORING_CHANGE_NOTICE_STORAGE_KEY) === "dismissed";
    } catch (error) {
      // Keep the notice visible when storage is unavailable.
    }
    correctionBanner.hidden = dismissed;
  }

  function wasReturningVisitorBeforeThisLoad() {
    if (typeof window.__TI_FANTASY_RETURNING_VISITOR__ === "boolean") {
      return window.__TI_FANTASY_RETURNING_VISITOR__;
    }
    try {
      return localStorage.getItem(PAGE_STATE_STORAGE_KEY) !== null;
    } catch (error) {
      return false;
    }
  }

  function shouldShowTormentorCorrectionNotice() {
    try {
      if (!wasReturningVisitorBeforeThisLoad()) {
        localStorage.setItem(TORMENTOR_CORRECTION_NOTICE_STORAGE_KEY, "shown");
        return false;
      }
      return (
        localStorage.getItem(TORMENTOR_CORRECTION_NOTICE_STORAGE_KEY) !== "shown"
      );
    } catch (error) {
      return false;
    }
  }

  function rememberCurrentVisit() {
    try {
      localStorage.setItem(VISITED_STORAGE_KEY, "visited");
    } catch (error) {
      // Future returning-visitor notices remain disabled when storage is blocked.
    }
  }

  function applyEnglishTitleFonts(root = document) {
    const titleElements = root.querySelectorAll(
      ".brand strong, h1, h2, h3, .score-method legend, #modal-kicker",
    );

    titleElements.forEach((element) => {
      const value = element.textContent.trim();
      const isUppercaseEnglishTitle =
        currentLanguage === "en" && /[A-Z]/.test(value) && !/[a-z]/.test(value);
      element.classList.toggle("is-uppercase-title", isUppercaseEnglishTitle);
    });
  }

  function applyStaticTranslations() {
    document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
    document.title = text("documentTitle");

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = text(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      element.setAttribute("aria-label", text(element.dataset.i18nAriaLabel));
    });

    document.querySelector('meta[name="description"]')?.setAttribute("content", text("description"));
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", text("documentTitle"));
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", text("description"));
    document.querySelector('meta[property="og:locale"]')?.setAttribute(
      "content",
      currentLanguage === "zh" ? "zh_CN" : "en_US",
    );
    document.querySelector('meta[property="og:locale:alternate"]')?.setAttribute(
      "content",
      currentLanguage === "zh" ? "en_US" : "zh_CN",
    );
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", text("documentTitle"));
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", text("description"));

    languageToggle.textContent = currentLanguage === "zh" ? "English" : "中文";
    languageToggle.setAttribute("aria-label", text("switchLanguage"));
    languageToggle.setAttribute("title", text("switchLanguage"));
    applyEnglishTitleFonts();
  }

  function setLanguage(language) {
    if (language !== "zh" && language !== "en") return;
    currentLanguage = language;
    window.__TI_FANTASY_LANGUAGE__ = language;
    saveLanguage(language);
    applyStaticTranslations();

    if (dataset && engine) {
      updateAdvisorTitleSelectors();
      players = normalizePlayers(dataset);
      render();
      if (!modalBackdrop.hidden) {
        updateModalContent(activeModalType || "data");
      }
    }
  }

  applyStaticTranslations();
  initializeScoringChangeNotice();
  const shouldShowTormentorCorrection = shouldShowTormentorCorrectionNotice();
  rememberCurrentVisit();

  correctionBannerClose.addEventListener("click", () => {
    try {
      localStorage.setItem(SCORING_CHANGE_NOTICE_STORAGE_KEY, "dismissed");
    } catch (error) {
      // The current page can still hide the notice when storage is blocked.
    }
    correctionBanner.hidden = true;
  });

  languageToggle.addEventListener("click", () => {
    setLanguage(currentLanguage === "zh" ? "en" : "zh");
  });

  if (!window.__TI_FANTASY_LANGUAGE__) {
    currentLanguage = detectLanguage();
    saveLanguage(currentLanguage);
    applyStaticTranslations();
  }

  if (!dataset || !engine) {
    bannerGrid.hidden = true;
    loadError.hidden = false;
    return;
  }

  const statFieldAliases = {
    kills: "kills",
    deaths: "deaths",
    creep_score: "creep_score",
    gpm: "gpm",
    madstone_collected: "madstones_collected",
    tower_kills: "towers_destroyed",
    observer_wards_placed: "observer_wards_placed",
    camps_stacked: "camps_stacked",
    runes_grabbed: "runes_picked_up",
    watchers_taken: "watchers_captured",
    smokes_used: "smokes_used",
    lotuses_collected: "lotuses_collected",
    roshan_kills: "roshans_killed",
    teamfight_participation: "teamfight_participation",
    stun_seconds: "stun_seconds",
    tormentor_kills: "tormentors_killed",
    first_blood: "first_blood",
    courier_kills: "couriers_killed",
  };

  const statIconPaths = {
    kills:
      '<path d="M6 3h4l7 8-4 4-8-7V4h1zm20 0h-4l-7 8 4 4 8-7V4h-1zM12 17l4 4-7 8H3v-6l9-6zm8 0-4 4 7 8h6v-6l-9-6z"/>',
    deaths:
      '<path d="M16 3C9 3 5 8 5 15c0 5 3 8 6 9v5h3v-4h4v4h3v-5c3-1 6-4 6-9 0-7-4-12-11-12zm-5 14a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm-7 4 2-3 2 3h-4z"/>',
    creep_score:
      '<path d="M16 3 9 10l3 3-8 8 7 7 8-8 3 3 7-7-6-6-4 4-3-3 4-4-4-4zm-5 15 3 3-3 3-3-3 3-3z"/>',
    gpm:
      '<path d="M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26zm2 20v3h-4v-3c-3-.4-5-2-5-5h4c0 1 1 2 3 2s3-.7 3-1.7c0-1.1-1-1.6-3.7-2.3-3.4-.9-5.5-2.1-5.5-5 0-2.5 1.8-4.3 4.2-4.8V3h4v3.1c2.8.4 4.7 2.2 4.8 4.9h-4c-.1-1.1-1.1-1.8-2.7-1.8-1.5 0-2.5.6-2.5 1.5 0 1 1 1.4 3.8 2.2 3.2.9 5.3 2.2 5.3 5.2 0 2.6-2 4.4-5.7 4.9z"/>',
    madstone_collected:
      '<path d="m16 2 8 5 5 9-5 9-8 5-8-5-5-9 5-9 8-5zm0 6-5 3-2 5 3 5 4 3 4-3 3-5-2-5-5-3z"/>',
    tower_kills:
      '<path d="M7 3h5v4h8V3h5v8l-3 3v11h4v4H6v-4h4V14l-3-3V3zm8 13v9h4v-9h-4z"/>',
    observer_wards_placed:
      '<path d="M2 16S7 7 16 7s14 9 14 9-5 9-14 9S2 16 2 16zm14-5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>',
    camps_stacked:
      '<path d="m16 3 13 7-13 7L3 10l13-7zM5 15l11 6 11-6 2 3-13 7L3 18l2-3zm0 7 11 6 11-6 2 3-13 7L3 25l2-3z"/>',
    runes_grabbed:
      '<path d="M16 2 28 14 16 30 4 14 16 2zm0 6-6 6 6 9 6-9-6-6z"/>',
    watchers_taken:
      '<path d="M4 4h24v5H4V4zm3 8h18l-3 5v11H10V17l-3-5zm7 5v7h4v-7h-4z"/>',
    smokes_used:
      '<path d="M10 25H7a5 5 0 0 1-1-10 8 8 0 0 1 15-3 6 6 0 1 1 3 13H10zm1-6c3-1 4-3 4-6-4 1-6 3-6 6h2zm5 6c4-1 6-4 6-8-4 1-7 4-7 8h1z"/>',
    lotuses_collected:
      '<path d="M16 14C11 9 11 5 16 2c5 3 5 7 0 12zm-2 2C8 15 5 12 6 7c6 0 9 3 8 9zm4 0c6-1 9-4 8-9-6 0-9 3-8 9zm-3 2c-6-1-10 1-11 6 5 3 9 1 11-6zm2 0c6-1 10 1 11 6-5 3-9 1-11-6zm-1 1c-3 4-3 8 0 11 3-3 3-7 0-11z"/>',
    roshan_kills:
      '<path d="M4 6 11 3l5 6 5-6 7 3-3 9 3 5-6 9H10l-6-9 3-5-3-9zm7 9 5 8 5-8-5-4-5 4z"/>',
    teamfight_participation:
      '<path d="M7 3h4l6 9-4 4-8-8 2-5zm18 0h-4l-6 9 4 4 8-8-2-5zM4 22l9-5 3 3-6 9H4v-7zm24 0-9-5-3 3 6 9h6v-7z"/>',
    stun_seconds:
      '<path d="M18 1 6 18h8l-2 13 14-19h-8V1z"/>',
    tormentor_kills:
      '<path d="m16 2 13 8v13l-13 7-13-7V10l13-8zm0 6-7 4v8l7 4 7-4v-8l-7-4zm0 3 4 3-2 6h-4l-2-6 4-3z"/>',
    first_blood:
      '<path d="M16 2C13 8 7 14 7 21a9 9 0 0 0 18 0c0-7-6-13-9-19zm-4 20c1 2 3 3 6 3-1 2-3 3-5 2-3-1-4-4-3-7 .5 1 1 2 2 2z"/>',
    courier_kills:
      '<path d="M3 17 13 7l3 5 3-5 10 10-9-3 5 9-7-4-2 11-2-11-7 4 5-9-9 3z"/>',
  };

  function defaultScoreModes() {
    return Object.fromEntries(
      engine.bannerRoles.map((role) => [role, "highest"]),
    );
  }

  function defaultManualMultipliers(config) {
    return Object.fromEntries(
      engine.bannerRoles.map((role) => [
        role,
        engine.calculateEmblemModifiers(config[role]).map(
          (modifier) => Math.round(modifier.total * 100),
        ),
      ]),
    );
  }

  function createStagePage(stage) {
    const config = engine.cloneDefaultConfig(stage);
    return {
      config,
      manualMultipliers: defaultManualMultipliers(config),
      selectedKeys: {},
      scoreMode: defaultScoreModes(),
    };
  }

  function normalizeStoredStagePage(rawPage, stage) {
    const page = createStagePage(stage);
    if (!rawPage || typeof rawPage !== "object") return page;

    try {
      const candidate = Object.fromEntries(
        engine.bannerRoles.map((role) => [
          role,
          rawPage.config[role].map((emblem) => ({
            color: emblem.color,
            stat: emblem.stat,
            quality: Number(emblem.quality),
            trait: emblem.trait,
          })),
        ]),
      );
      engine.validateBannerConfig(candidate, stage);
      page.config = candidate;
    } catch (error) {
      // Ignore malformed or obsolete saved emblem data.
    }

    page.manualMultipliers = defaultManualMultipliers(page.config);
    for (const role of engine.bannerRoles) {
      const savedMultipliers = rawPage.manualMultipliers?.[role];
      if (
        Array.isArray(savedMultipliers) &&
        savedMultipliers.length === page.config[role].length &&
        savedMultipliers.every(
          (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
        )
      ) {
        page.manualMultipliers[role] = savedMultipliers.map(Number);
      }
    }

    for (const role of engine.bannerRoles) {
      const savedMode = rawPage.scoreMode?.[role];
      if (engine.scoreModes.includes(savedMode)) {
        page.scoreMode[role] = savedMode;
      }
      const savedKey = rawPage.selectedKeys?.[role];
      if (typeof savedKey === "string") {
        page.selectedKeys[role] = savedKey;
      }
    }
    return page;
  }

  function loadPageState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(PAGE_STATE_STORAGE_KEY) || "null");
    } catch (error) {
      // Use a clean state when localStorage is unavailable or invalid.
    }

    const stage = engine.stageKeys.includes(saved?.stage)
      ? saved.stage
      : "groupStage";
    const pages = Object.fromEntries(
      engine.stageKeys.map((stageKey) => [
        stageKey,
        normalizeStoredStagePage(saved?.pages?.[stageKey], stageKey),
      ]),
    );
    return {
      stage,
      pages,
      config: pages[stage].config,
      manualMultipliers: pages[stage].manualMultipliers,
      selectedKeys: pages[stage].selectedKeys,
      scoreMode: pages[stage].scoreMode,
      multiplierMode: MULTIPLIER_MODES.includes(saved?.multiplierMode)
        ? saved.multiplierMode
        : "calculated",
      showDetailedScores: saved?.showDetailedScores === true,
      titles: {
        prefix: engine.prefixTitles[saved?.titles?.prefix]
          ? saved.titles.prefix
          : "none",
        suffix: engine.suffixTitles[saved?.titles?.suffix]
          ? saved.titles.suffix
          : "none",
      },
    };
  }

  const state = loadPageState();
  detailedScoreToggle.checked = state.showDetailedScores;

  function activateStage(stage) {
    if (!engine.stageKeys.includes(stage)) return false;
    const page = state.pages[stage];
    state.stage = stage;
    state.config = page.config;
    state.manualMultipliers = page.manualMultipliers;
    state.selectedKeys = page.selectedKeys;
    state.scoreMode = page.scoreMode;
    return true;
  }

  function persistPageState() {
    try {
      localStorage.setItem(
        PAGE_STATE_STORAGE_KEY,
        JSON.stringify({
          version: 3,
          stage: state.stage,
          pages: state.pages,
          titles: state.titles,
          multiplierMode: state.multiplierMode,
          showDetailedScores: state.showDetailedScores,
        }),
      );
    } catch (error) {
      // The calculator still works when storage is blocked or full.
    }
  }

  function updateStageSwitcher() {
    stageSwitcher.querySelectorAll("button[data-stage]").forEach((button) => {
      const active = button.dataset.stage === state.stage;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateMultiplierSwitcher() {
    multiplierSwitcher
      .querySelectorAll("button[data-multiplier-mode]")
      .forEach((button) => {
        const active = button.dataset.multiplierMode === state.multiplierMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
  }

  function updateAdvisorTitleSelectors() {
    prefixTitleSelect.innerHTML = engine.prefixTitleKeys
      .map((key) => optionMarkup(key, copy().prefixTitles[key], state.titles.prefix))
      .join("");
    suffixTitleSelect.innerHTML = engine.suffixTitleKeys
      .map((key) => optionMarkup(key, copy().suffixTitles[key], state.titles.suffix))
      .join("");
    prefixTitleSelect.value = state.titles.prefix;
    suffixTitleSelect.value = state.titles.suffix;
  }

  let modalTrigger = null;
  let activeModalType = null;
  let players = normalizePlayers(dataset);
  const meta = dataset.meta || {};

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeAverages(raw) {
    const result = {};
    for (const stat of engine.statKeys) {
      const field = statFieldAliases[stat];
      result[stat] = raw && Object.prototype.hasOwnProperty.call(raw, field)
        ? raw[field]
        : null;
    }
    return result;
  }

  function normalizePlayers(rawDataset) {
    const result = [];
    for (const team of rawDataset.teams || []) {
      const teamId = String(
        team.teamId ?? team.id ?? team.name ?? "unknown-team",
      );
      const teamName = team.name || team.tag || text("teamFallback", { id: teamId });

      for (const player of team.players || []) {
        if (!engine.bannerRoles.includes(player.role)) continue;
        result.push({
          id: String(
            player.accountId ?? player.id ?? player.name ?? "unknown-player",
          ),
          name:
            player.name ||
            text("playerFallback", { id: player.accountId ?? player.id ?? text("unknown") }),
          teamId,
          teamName,
          teamTag: team.tag,
          role: player.role,
          games: player.games || 0,
          averages: normalizeAverages(player.averages),
          maps: Array.isArray(player.maps)
            ? player.maps.map((map) => ({
                matchId: map.matchId,
                seriesId: map.seriesId ?? null,
                seriesType: map.seriesType ?? null,
                seriesGameNumber: map.seriesGameNumber ?? null,
                heroId: map.heroId ?? null,
                heroName: map.heroName ?? null,
                won: map.won === true,
                lost: map.lost === true,
                titleConditions: map.titleConditions || {},
                stats: normalizeAverages(map.stats),
              }))
            : [],
          coverage: player.coverage,
        });
      }
    }
    return result;
  }

  function formatDate(value) {
    if (!value) return text("localSnapshot");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(copy().locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function signedPercent(value) {
    const rounded = Math.round(value * 100);
    if (rounded > 0) return `+${rounded}%`;
    return `${rounded}%`;
  }

  function formatScore(value) {
    if (value === null || !Number.isFinite(value)) return text("insufficientData");
    return new Intl.NumberFormat(copy().locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function statIconMarkup(stat) {
    return `
      <svg viewBox="0 0 32 32" focusable="false" aria-hidden="true">
        ${statIconPaths[stat] || statIconPaths.runes_grabbed}
      </svg>`;
  }

  function activeMultipliers(role) {
    if (state.multiplierMode !== "manual") return null;
    return state.manualMultipliers[role].map((value) => Number(value) / 100);
  }

  function getView() {
    const rankings = {};
    const selected = {};

    for (const role of engine.bannerRoles) {
      rankings[role] = engine.buildRankings(
        role,
        players,
        state.config[role],
        state.scoreMode[role],
        state.titles,
        activeMultipliers(role),
      );
      selected[role] =
        rankings[role].find(
          (entry) => entry.key === state.selectedKeys[role],
        ) ||
        rankings[role].find((entry) => entry.score !== null) ||
        rankings[role][0] ||
        null;

      if (selected[role]) {
        state.selectedKeys[role] = selected[role].key;
      }
    }

    persistPageState();
    return { rankings, selected };
  }

  function optionMarkup(value, label, selectedValue) {
    return `<option value="${escapeHtml(value)}"${
      value === selectedValue ? " selected" : ""
    }>${escapeHtml(label)}</option>`;
  }

  function emblemMarkup(role, emblem, index, modifier, manualValue, selected) {
    const availableStats = engine.statKeys.filter(
      (stat) => engine.statDefinitions[stat].color === emblem.color,
    );
    const qualityOptions = engine.qualities
      .map((quality) =>
        optionMarkup(
          String(quality),
          qualityLabel(quality),
          String(emblem.quality),
        ),
      )
      .join("");
    const traitOptions = engine.traits
      .map((trait) =>
        optionMarkup(
          trait,
          traitLabel(trait),
          emblem.trait,
        ),
      )
      .join("");
    const statOptions = availableStats
      .map((stat) =>
        optionMarkup(
          stat,
          statDefinition(stat).label,
          emblem.stat,
        ),
      )
      .join("");
    const traitEffect = modifier.selfTrait + modifier.neighbor;
    const manualMode = state.multiplierMode === "manual";
    const multiplierMarkup = manualMode
      ? `
        <label class="manual-multiplier-control">
          <span class="sr-only">${escapeHtml(text("manualMultiplierInput", {
            role: roleName(role),
            index: index + 1,
          }))}</span>
          <input
            class="emblem-multiplier"
            type="number"
            min="0"
            step="0.1"
            inputmode="decimal"
            value="${escapeHtml(manualValue)}"
            data-role="${role}"
            data-index="${index}"
            data-field="multiplier"
          >
          <span aria-hidden="true">%</span>
        </label>`
      : `<strong class="emblem-multiplier">${Math.round(modifier.total * 100)}%</strong>`;
    const detailMarkup = manualMode
      ? ""
      : `
        <div class="emblem-detail">
          <label>
            <span class="sr-only">${escapeHtml(text("quality"))}</span>
            <select
              data-role="${role}"
              data-index="${index}"
              data-field="quality"
            >${qualityOptions}</select>
          </label>
          <output>${signedPercent(engine.qualityBonus[emblem.quality])}</output>
        </div>
        <div class="emblem-detail">
          <label>
            <span class="sr-only">${escapeHtml(text("trait"))}</span>
            <select
              data-role="${role}"
              data-index="${index}"
              data-field="trait"
            >${traitOptions}</select>
          </label>
          <output title="${escapeHtml(text("totalTraitEffect"))}">${signedPercent(traitEffect)}</output>
        </div>`;
    const selectedEmblemScore = selected?.emblemScores?.[index];
    const scoreDetailMarkup = state.showDetailedScores
      ? `
        <div
          class="emblem-score-detail"
          aria-label="${escapeHtml(text("detailedEmblemScore", {
            stat: statDefinition(emblem.stat).label,
          }))}"
        >
          <output>${escapeHtml(Number.isFinite(selectedEmblemScore) ? formatScore(selectedEmblemScore) : "—")}</output>
        </div>`
      : "";

    return `
      <article
        class="emblem-card emblem-card--${emblem.color}${manualMode ? " emblem-card--manual" : ""}${state.showDetailedScores ? " has-score-detail" : ""}"
        aria-label="${escapeHtml(text("emblemAria", {
          role: roleName(role),
          index: index + 1,
          color: colorName(emblem.color),
        }))}"
      >
        <div class="emblem-head">
          <span class="emblem-icon" aria-hidden="true">${statIconMarkup(emblem.stat)}</span>
          <label>
            <span class="sr-only">${escapeHtml(text("statistic"))}</span>
            <select
              class="stat-select"
              data-role="${role}"
              data-index="${index}"
              data-field="stat"
            >${statOptions}</select>
          </label>
          ${multiplierMarkup}
        </div>
        ${detailMarkup}
        ${scoreDetailMarkup}
      </article>`;
  }

  function rankingMarkup(role, rankings, selected) {
    const rows = rankings
      .map((entry) => {
        const active = selected && selected.key === entry.key;
        const scoreClass =
          entry.score === null
            ? "ranking-value is-missing"
            : "ranking-value";
        return `
          <li>
            <button
              type="button"
              class="ranking-row${active ? " is-selected" : ""}"
              data-ranking-role="${role}"
              data-ranking-key="${escapeHtml(entry.key)}"
              aria-pressed="${active ? "true" : "false"}"
            >
              <span class="ranking-identity">
                <strong>${escapeHtml(entry.label)}</strong>
                <small>${escapeHtml(entry.subtitle)}</small>
              </span>
              <span class="${scoreClass}">${escapeHtml(formatScore(entry.score))}</span>
            </button>
          </li>`;
      })
      .join("");

    return `
      <section class="leaderboard" aria-label="${escapeHtml(text("liveRanking", { role: roleName(role) }))}">
        <ol class="ranking-list">${rows}</ol>
      </section>`;
  }

  function bannerMarkup(role, rankings, selected) {
    const manualValues = state.manualMultipliers[role];
    const multipliers = activeMultipliers(role);
    const modifiers = multipliers
      ? multipliers.map((total) => ({
          base: 1,
          quality: 0,
          selfTrait: 0,
          neighbor: 0,
          total,
          triggered: [],
        }))
      : engine.calculateEmblemModifiers(state.config[role]);
    const emblems = state.config[role]
      .map((emblem, index) =>
        emblemMarkup(
          role,
          emblem,
          index,
          modifiers[index],
          manualValues[index],
          selected,
        ),
      )
      .join("");
    const selectedLabel = selected ? selected.label : text("waitingForData");
    const selectedSubtitle = selected ? selected.subtitle : "—";
    const selectedScore =
      selected && selected.score !== null ? formatScore(selected.score) : "—";

    return `
      <section class="banner-column" data-banner-column-role="${role}">
        <article class="war-banner war-banner--${role}${state.config[role].length === 5 ? " war-banner--five" : ""}" data-banner-role="${role}">
          <div class="banner-rope is-top" aria-hidden="true"></div>
          <header class="banner-heading">
            <h2>${escapeHtml(currentLanguage === "en" ? roleName(role).toUpperCase() : roleName(role))}</h2>
            <span class="selected-roster" title="${escapeHtml(selectedLabel)}">
              ${escapeHtml(selectedLabel)}
              <small>${escapeHtml(selectedSubtitle)}</small>
            </span>
            <fieldset class="score-method">
              <legend>${escapeHtml(text("scoreMethod"))}</legend>
              <div>
                <button
                  type="button"
                  data-score-role="${role}"
                  data-score-mode="highest"
                  aria-pressed="${state.scoreMode[role] === "highest"}"
                  class="${state.scoreMode[role] === "highest" ? "is-active" : ""}"
                >${escapeHtml(text("highestScore"))}</button>
                <button
                  type="button"
                  data-score-role="${role}"
                  data-score-mode="average"
                  aria-pressed="${state.scoreMode[role] === "average"}"
                  class="${state.scoreMode[role] === "average" ? "is-active" : ""}"
                >${escapeHtml(text("averageScore"))}</button>
              </div>
            </fieldset>
            <div
              class="banner-score"
              aria-label="${escapeHtml(text("bannerScore", { role: roleName(role) }))}"
            >${escapeHtml(selectedScore)}</div>
          </header>

          <section class="emblem-pennant" aria-label="${escapeHtml(text("emblemPennant", { role: roleName(role) }))}">
            <div class="emblem-stack">${emblems}</div>
          </section>

          ${rankingMarkup(role, rankings, selected)}

          <div class="banner-rope is-bottom" aria-hidden="true"></div>
        </article>
      </section>`;
  }

  function restoreFocus(request) {
    if (!request) return;
    const candidates =
      request.type === "select"
        ? bannerGrid.querySelectorAll("select[data-role]")
        : request.type === "ranking"
          ? bannerGrid.querySelectorAll("button[data-ranking-role]")
          : bannerGrid.querySelectorAll("button[data-score-mode]");

    for (const element of candidates) {
      if (
        request.type === "select" &&
        element.dataset.role === request.role &&
        element.dataset.index === String(request.index) &&
        element.dataset.field === request.field
      ) {
        element.focus();
        return;
      }
      if (
        request.type === "ranking" &&
        element.dataset.rankingRole === request.role &&
        element.dataset.rankingKey === request.key
      ) {
        element.focus();
        return;
      }
      if (
        request.type === "scoreMode" &&
        element.dataset.scoreRole === request.role &&
        element.dataset.scoreMode === request.mode
      ) {
        element.focus();
        return;
      }
    }
  }

  function updateTotalScore(view) {
    const allComplete = engine.bannerRoles.every(
      (role) => view.selected[role] && view.selected[role].score !== null,
    );
    const combined = allComplete
      ? engine.bannerRoles.reduce(
          (sum, role) => sum + view.selected[role].score,
          0,
        )
      : null;

    totalScore.textContent = formatScore(combined);
  }

  function render(focusRequest) {
    const view = getView();
    bannerGrid.innerHTML = engine.bannerRoles
      .map((role) =>
        bannerMarkup(role, view.rankings[role], view.selected[role]),
      )
      .join("");

    updateTotalScore(view);
    applyEnglishTitleFonts(bannerGrid);
    restoreFocus(focusRequest);
  }

  function renderScoreMode(role, focusRequest) {
    const view = getView();
    const currentColumn = bannerGrid.querySelector(
      `[data-banner-column-role="${role}"]`,
    );
    if (!currentColumn) {
      render(focusRequest);
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = bannerMarkup(
      role,
      view.rankings[role],
      view.selected[role],
    ).trim();
    const nextColumn = template.content.firstElementChild;
    if (!nextColumn) {
      render(focusRequest);
      return;
    }

    currentColumn.replaceWith(nextColumn);
    updateTotalScore(view);
    applyEnglishTitleFonts(nextColumn);
    restoreFocus(focusRequest);
  }

  function dataMarkup() {
    const coverage = meta.coverage || {};
    return `
      <p class="modal-lead">
        ${escapeHtml(text("dataLead", { name: meta.leagueName || "Dota 2" }))}
      </p>
      <div class="data-grid">
        <section class="data-card">
          <h3>${escapeHtml(text("tournamentSnapshot"))}</h3>
          <p>${escapeHtml(text("leagueId"))}: ${escapeHtml(meta.leagueId || "19785")}</p>
          <p>${escapeHtml(text("parsedMatches"))}: ${escapeHtml(coverage.parsedMatches || "—")}</p>
          <p>${escapeHtml(text("players"))}: ${escapeHtml(coverage.players || players.length)}</p>
          <p>${escapeHtml(text("generatedDate"))}: ${escapeHtml(formatDate(meta.generatedAt))}</p>
        </section>
        <section class="data-card">
          <h3>${escapeHtml(text("scoringMethodTitle"))}</h3>
          <p>${escapeHtml(text("scoringMethodBody"))}</p>
        </section>
        <section class="data-card">
          <h3>${escapeHtml(text("knownLimitations"))}</h3>
          <ul>
            <li>${escapeHtml(text("limitationRoles"))}</li>
          </ul>
        </section>
        <section class="data-card">
          <h3>${escapeHtml(text("dataSources"))}</h3>
          <p>${escapeHtml(text("dataSourcesBody"))}</p>
        </section>
        <section class="data-card data-card-disclaimer">
          <h3>${escapeHtml(text("disclaimerTitle"))}</h3>
          <p>${escapeHtml(text("disclaimerProject"))}</p>
          <p>${escapeHtml(text("disclaimerAssets"))}</p>
          <p>
            ${escapeHtml(text("disclaimerCounterBefore"))}
            <a href="https://www.busuanzi.cc/count.php?search=www.ti-fantasy.site" target="_blank" rel="noopener noreferrer">${escapeHtml(text("disclaimerCounterLink"))}</a>${escapeHtml(text("disclaimerCounterAfter"))}
          </p>
        </section>
      </div>`;
  }

  function scoringChangesMarkup() {
    const percentFormatter = new Intl.NumberFormat(copy().locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const rows = SCORING_CHANGES
      .map((item) => ({
        ...item,
        change: ((item.current - item.previous) / item.previous) * 100,
      }))
      .sort((left, right) => right.change - left.change)
      .map((item) => {
        const details = copy().scoringChanges[item.key];
        const direction =
          item.change > 0
            ? "is-increase"
            : item.change < 0
              ? "is-decrease"
              : "is-neutral";
        const sign = item.change > 0 ? "+" : "";
        return `
          <tr class="score-change-row ${direction}" data-score-change="${item.change}">
            <th scope="row">${escapeHtml(details.label)}</th>
            <td>${escapeHtml(details.previous)}</td>
            <td>${escapeHtml(details.current)}</td>
            <td class="score-change-percent">${sign}${escapeHtml(percentFormatter.format(item.change))}%</td>
          </tr>`;
      })
      .join("");

    return `
      <p class="modal-lead">${escapeHtml(text("scoringChangesLead"))}</p>
      <div class="score-change-table-wrap">
        <table class="stat-table score-change-table">
          <thead>
            <tr>
              <th scope="col">${escapeHtml(text("scoringCategory"))}</th>
              <th scope="col">${escapeHtml(text("scoringPreviousYear"))}</th>
              <th scope="col">${escapeHtml(text("scoringCurrentYear"))}</th>
              <th scope="col">${escapeHtml(text("scoringRelativeChange"))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function updateModalContent(type) {
    activeModalType = type === "scoringChanges" ? "scoringChanges" : "data";
    if (activeModalType === "scoringChanges") {
      modalKicker.textContent = text("scoringChangesKicker");
      modalTitle.textContent = text("scoringChangesTitle");
      modalBody.innerHTML = scoringChangesMarkup();
    } else {
      modalKicker.textContent = text("dataKicker");
      modalTitle.textContent = text("dataNotes");
      modalBody.innerHTML = dataMarkup();
    }
    applyEnglishTitleFonts(modal);
  }

  function openModal(trigger, type = "data") {
    modalTrigger = trigger || document.activeElement;
    updateModalContent(type);
    modalBackdrop.hidden = false;
    pageShell.setAttribute("aria-hidden", "true");
    pageShell.inert = true;
    modalClose.focus();
  }

  function closeModal() {
    if (modalBackdrop.hidden) return;
    modalBackdrop.hidden = true;
    pageShell.removeAttribute("aria-hidden");
    pageShell.inert = false;
    if (modalTrigger && typeof modalTrigger.focus === "function") {
      modalTrigger.focus();
    }
    modalTrigger = null;
    activeModalType = null;
  }

  function showTormentorCorrectionNotice() {
    if (!shouldShowTormentorCorrection) return;
    try {
      localStorage.setItem(TORMENTOR_CORRECTION_NOTICE_STORAGE_KEY, "shown");
    } catch (error) {
      // The current visit can still display the correction notice.
    }
    window.alert(text("tormentorCorrectionBody"));
  }

  function scheduleTormentorCorrectionNotice() {
    if (!shouldShowTormentorCorrection) return;
    const showAfterPaint = () => {
      window.setTimeout(showTormentorCorrectionNotice, 0);
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(showAfterPaint);
    } else {
      showAfterPaint();
    }
  }

  function manualMultiplierTarget(control) {
    if (
      !(control instanceof HTMLInputElement) ||
      control.dataset.field !== "multiplier"
    ) {
      return null;
    }
    const role = control.dataset.role;
    const index = Number(control.dataset.index);
    if (
      !engine.bannerRoles.includes(role) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= state.manualMultipliers[role].length
    ) {
      return null;
    }
    return { control, role, index };
  }

  bannerGrid.addEventListener("focusin", (event) => {
    const target = manualMultiplierTarget(event.target);
    if (!target) return;
    target.control.dataset.previousValue = String(
      state.manualMultipliers[target.role][target.index],
    );
    target.control.value = "";
  });

  bannerGrid.addEventListener("focusout", (event) => {
    const target = manualMultiplierTarget(event.target);
    if (!target) return;
    const fallback =
      target.control.dataset.previousValue ??
      String(state.manualMultipliers[target.role][target.index]);
    delete target.control.dataset.previousValue;
    const rawValue = target.control.value.trim();
    const value = Number(rawValue);
    if (rawValue === "" || !Number.isFinite(value) || value < 0) {
      target.control.value = fallback;
      return;
    }
    state.manualMultipliers[target.role][target.index] = value;
    persistPageState();
    render();
  });

  bannerGrid.addEventListener("change", (event) => {
    const control = event.target;
    if (
      !(control instanceof HTMLSelectElement) &&
      !(control instanceof HTMLInputElement)
    ) return;
    const role = control.dataset.role;
    const index = Number(control.dataset.index);
    const field = control.dataset.field;
    if (
      !engine.bannerRoles.includes(role) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= state.config[role].length ||
      !["stat", "quality", "trait", "multiplier"].includes(field)
    ) {
      return;
    }

    if (field === "multiplier") {
      return;
    }

    state.config[role][index][field] =
      field === "quality" ? Number(control.value) : control.value;

    persistPageState();
    render({ type: "select", role, index, field });
  });

  bannerGrid.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const modeButton = event.target.closest("button[data-score-mode]");
    if (modeButton) {
      const role = modeButton.dataset.scoreRole;
      const mode = modeButton.dataset.scoreMode;
      if (
        !engine.bannerRoles.includes(role) ||
        !engine.scoreModes.includes(mode)
      ) {
        return;
      }
      state.scoreMode[role] = mode;
      persistPageState();
      renderScoreMode(role, { type: "scoreMode", role, mode });
      return;
    }

    const button = event.target.closest("button[data-ranking-role]");
    if (!button) return;
    const role = button.dataset.rankingRole;
    const key = button.dataset.rankingKey;
    if (!engine.bannerRoles.includes(role) || !key) return;
    state.selectedKeys[role] = key;
    persistPageState();
    render({ type: "ranking", role, key });
  });

  prefixTitleSelect.addEventListener("change", () => {
    if (!engine.prefixTitles[prefixTitleSelect.value]) return;
    state.titles.prefix = prefixTitleSelect.value;
    persistPageState();
    render();
  });

  suffixTitleSelect.addEventListener("change", () => {
    if (!engine.suffixTitles[suffixTitleSelect.value]) return;
    state.titles.suffix = suffixTitleSelect.value;
    persistPageState();
    render();
  });

  multiplierSwitcher.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-multiplier-mode]");
    const mode = button?.dataset.multiplierMode;
    if (!button || !MULTIPLIER_MODES.includes(mode)) return;
    state.multiplierMode = mode;
    updateMultiplierSwitcher();
    persistPageState();
    render();
  });

  detailedScoreToggle.addEventListener("change", () => {
    state.showDetailedScores = detailedScoreToggle.checked;
    persistPageState();
    render();
  });

  stageSwitcher.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-stage]");
    if (!button || !activateStage(button.dataset.stage)) return;
    updateStageSwitcher();
    persistPageState();
    render();
  });


  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      openModal(button, button.dataset.openModal);
    });
  });

  scoringChangeNoticeOpen.addEventListener("click", () => {
    openModal(scoringChangeNoticeOpen, "scoringChanges");
  });

  modalClose.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("mousedown", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });

  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      modal.querySelectorAll(
        'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  try {
    updateStageSwitcher();
    updateMultiplierSwitcher();
    updateAdvisorTitleSelectors();
    render();
    scheduleTormentorCorrectionNotice();
  } catch (error) {
    console.error(error);
    bannerGrid.hidden = true;
    loadError.hidden = false;
  }
})();
