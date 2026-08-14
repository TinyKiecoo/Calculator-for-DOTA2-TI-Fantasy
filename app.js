(function () {
  "use strict";

  let leagueDataset = window.FANTASY_DATA;
  let leagueStageDatasets = null;
  let dataset = leagueDataset;

  function normalizeStageDatasets(bundle, fallbackDataset) {
    if (
      !bundle ||
      Number(bundle.meta?.leagueId) !== Number(fallbackDataset?.meta?.leagueId) ||
      !bundle.stages ||
      typeof bundle.stages !== "object"
    ) {
      return null;
    }
    return bundle.stages;
  }

  function datasetForStage(stage) {
    if (!leagueStageDatasets) return leagueDataset;
    return (
      leagueStageDatasets[stage] ||
      leagueStageDatasets.groupStage ||
      leagueDataset
    );
  }

  leagueStageDatasets = normalizeStageDatasets(
    window.FANTASY_STAGE_DATA,
    leagueDataset,
  );
  const engine = window.FantasyEngine;
  const bannerGrid = document.getElementById("banner-grid");
  const totalScore = document.getElementById("total-score");
  const loadError = document.getElementById("load-error");
  const pageShell = document.getElementById("page-shell");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modal = document.getElementById("info-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");
  const stageSwitcher = document.getElementById("stage-switcher");
  const multiplierSwitcher = document.getElementById("multiplier-switcher");
  const prefixTitleSelect = document.getElementById("prefix-title-select");
  const suffixTitleSelect = document.getElementById("suffix-title-select");

  const languageToggle = document.getElementById("language-toggle");
  const LANGUAGE_STORAGE_KEY = "ti-fantasy-language";
  const PAGE_STATE_STORAGE_KEY = "ti-fantasy-page-state-v1";
  const MULTIPLIER_MODES = ["calculated", "manual"];
  const EMBLEM_RANKING_MODES = ["average", "highestSeries"];

  const translations = {
    zh: {
      locale: "zh-CN",
      documentTitle: "Dota 2 TI 2026 梦幻挑战计算器",
      description: "开源的 Dota 2 TI 2026 梦幻挑战实时计算器。",
      brandName: "梦幻挑战",
      pageHeading: "开源的 Dota 2 梦幻挑战实时计算器",
      groupStageName: "小组赛",
      theInternationalName: "国际邀请赛",
      pageActions: "页面操作",
      githubRepository: "GitHub",
      githubAria: "在新标签页打开 GitHub 仓库",
      candyworksCalculator: "糖果车计算器",
      candyworksAria: "在新标签页打开糖果车计算器",
      switchLanguage: "切换为英文",
      emblemRankings: "徽标排行",
      emblemRankingSwitcher: "徽标贡献统计方式",
      averageContributionMode: "平均贡献",
      bestSeriesContributionMode: "最高系列赛贡献",
      emblemRankingsLead: "以下为各定位使用每项徽标时的平均基础积分贡献对比。",
      emblemRankingsBestSeriesLead: "以下为各定位使用每项徽标时的平均积分上限对比。",
      emblemRankingsMethod: "贡献最高的徽标设为 100 分，其余项目按其贡献相对于最高项的实际比例进行打分。品质、特性、指导员称号均不参与计算。",
      rankingScore: "评分",
      averageContribution: "场均贡献",
      bestSeriesContribution: "最高系列赛贡献",
      teamfightContributionHint: "参与团战的基础得分上限为 2124。如果想押注超长局带来的更高上限，建议考虑本组下方其他没有固定得分上限的统计数据。",
      deathsContributionHint: "死亡徽标得分通常与游戏时长呈负相关。如果同时选择正反补等与时长明显正相关的统计数据，各徽标偏好的系列赛可能不一致，进而影响整面战旗的综合表现。",
      stunContributionHint: "眩晕时间受英雄选择和阵容搭配影响极大，历史高分可能集中在特定控制英雄或阵容中，实际表现波动较大。",
      playerMapSamples: "{count} 条选手逐场记录",
      roleCandidateSamples: "{count} 个定位候选项",
      rankingUnavailable: "数据不足",
      dataNotes: "数据说明",
      leagueSelector: "赛事数据",
      stageSwitcher: "赛事阶段",
      multiplierSwitcher: "徽标倍率方式",
      detailedEmblemScore: "{stat}得分",
      calculatedMultiplier: "品质与特性",
      manualMultiplier: "手动倍率",
      manualMultiplierInput: "{role}第 {index} 枚徽标的手动倍率",
      prefixTitle: "前缀",
      suffixTitle: "后缀",
      bannerGrid: "三面梦幻战旗",
      loading: "正在载入赛事数据…",
      loadErrorTitle: "赛事数据未能载入",
      loadErrorBody: "请确认 index.html、app.js、fantasy.js 与 data 文件夹保持原有相对位置。",
      closeModal: "关闭弹窗",
      close: "关闭 ×",
      localSnapshot: "本地快照",
      teamFallback: "队伍 {id}",
      playerFallback: "选手 {id}",
      unknown: "未知",
      statistic: "统计数据",
      quality: "品质",
      trait: "特性",
      totalTraitEffect: "自身与相邻特性的合计影响",
      emblemAria: "{role}第 {index} 枚{color}徽标",
      liveRanking: "{role}实时排名",
      scoreMethod: "积分方式",
      highestScore: "最高系列赛",
      averageScore: "全部比赛平均 × 2",
      emblemPennant: "{role}徽标挂幅",
      bannerScore: "{role}战旗积分",
      dataLead: "本页面使用当前选择的 {name} 录像数据来计算梦幻挑战积分。",
      dataSelectionBody: "赛事下拉框可从所有已解析存储的赛事间切换；每项赛事单独计算，数据不会相互合并。",
      tournamentSnapshot: "赛事快照",
      leagueId: "联赛 ID",
      parsedMatches: "已解析比赛",
      players: "选手",
      generatedDate: "生成日期",
      scoringMethodTitle: "积分规则",
      scoringMethodBodyClientDescription: "对于每个定位，每位选手的梦幻积分是根据他们参与的每场比赛来单独结算。只有战旗上存在的统计数据才会提供积分，如果指导员称号满足特定条件还有加成效果。然后一个定位里两个选手的得分会计算出平均数，作为该场比赛相应的最终积分。",
      scoringMethodBodyBestSeries: "“最高系列赛”采用的规则与客户端完全一致。每个定位的最终积分来自一个系列赛中积分最高的两场比赛。如果一个定位在一个结算期内参与了多个系列赛，那么会采用得分最高的系列赛。",
      scoringMethodBodyAllMatchAverage: "“全部比赛平均 × 2”对全结算期所有有效比赛的得分取平均并翻倍。",
      dataSources: "数据来源",
      dataSourcesBody: "全部比赛信息与梦幻统计均直接读取 Valve 比赛录像。",
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
        golden: "金光的：使用黄色或棕色英雄时 +8%。",
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
        kills: { label: "击杀数" },
        deaths: { label: "死亡数" },
        creep_score: { label: "正反补得分" },
        gpm: { label: "GPM" },
        madstone_collected: { label: "狂石收集数量" },
        tower_kills: { label: "防御塔摧毁数" },
        observer_wards_placed: { label: "放置侦察守卫数" },
        camps_stacked: { label: "野怪堆叠次数" },
        runes_grabbed: { label: "激活神符数" },
        watchers_taken: { label: "占领观察者次数" },
        smokes_used: { label: "开雾次数" },
        lotuses_collected: { label: "莲花采集数量" },
        roshan_kills: { label: "肉山击杀数" },
        teamfight_participation: { label: "团战" },
        stun_seconds: { label: "眩晕时间" },
        tormentor_kills: { label: "痛苦魔方消灭次数" },
        first_blood: { label: "第一滴血" },
        courier_kills: { label: "击杀信使次数" },
      },
    },
    en: {
      locale: "en-US",
      documentTitle: "Dota 2 TI 2026 Fantasy Calculator",
      description: "A free real-time Dota 2 TI 2026 Fantasy calculator.",
      brandName: "FANTASY",
      pageHeading: "An open-source, real-time calculator for DOTA 2 TI Fantasy.",
      groupStageName: "Group Stage",
      theInternationalName: "The International",
      pageActions: "Page actions",
      githubRepository: "GitHub",
      githubAria: "Open the GitHub repository in a new tab",
      candyworksCalculator: "Candyworks Calculator",
      candyworksAria: "Open the Candyworks Calculator in a new tab",
      switchLanguage: "Switch to Chinese",
      emblemRankings: "Emblem Rankings",
      emblemRankingSwitcher: "Emblem contribution metric",
      averageContributionMode: "Average Contribution",
      bestSeriesContributionMode: "Best-Series Contribution",
      emblemRankingsLead: "These rankings are each emblem statistic's average base-score contribution for each role.",
      emblemRankingsBestSeriesLead: "These rankings are each emblem statistic's average best score contribution for each role.",
      emblemRankingsMethod: "The highest contribution scores 100. Every other value is rounded in direct proportion to that maximum. Quality, Traits, and Coaching Titles are excluded.",
      rankingScore: "Rating",
      averageContribution: "Avg. contribution",
      bestSeriesContribution: "Best-series contribution",
      teamfightContributionHint: "Teamfight Participation base points are capped at 2,124. If you want to bet on the higher ceiling of exceptionally long games, consider the uncapped statistics below it.",
      deathsContributionHint: "Deaths emblem points generally decrease as game length increases. Pairing it with strongly duration-positive statistics such as Creep Score may make the emblems favor different series and weaken the banner's combined performance.",
      stunContributionHint: "Stun Duration depends heavily on hero picks and team composition. Historical highs may be concentrated in specific control-heavy heroes or lineups, so actual results can vary considerably.",
      playerMapSamples: "{count} player-map records",
      roleCandidateSamples: "{count} role candidates",
      rankingUnavailable: "Insufficient data",
      dataNotes: "Data Notes",
      leagueSelector: "Tournament data",
      stageSwitcher: "Tournament stage",
      multiplierSwitcher: "Emblem multiplier mode",
      detailedEmblemScore: "{stat} score",
      calculatedMultiplier: "Quality & Trait",
      manualMultiplier: "Manual Multiplier",
      manualMultiplierInput: "Manual multiplier for {role} emblem {index}",
      prefixTitle: "Prefix",
      suffixTitle: "Suffix",
      bannerGrid: "Three fantasy banners",
      loading: "Loading tournament data…",
      loadErrorTitle: "Failed to load tournament data",
      loadErrorBody: "Keep index.html, app.js, fantasy.js, and the data folder in their original relative locations.",
      closeModal: "Close dialog",
      close: "Close ×",
      localSnapshot: "Local snapshot",
      teamFallback: "Team {id}",
      playerFallback: "Player {id}",
      unknown: "Unknown",
      statistic: "Statistic",
      quality: "Quality",
      trait: "Trait",
      totalTraitEffect: "Combined effect of this trait and adjacent traits",
      emblemAria: "{role}, emblem {index}, {color}",
      liveRanking: "Live {role} ranking",
      scoreMethod: "Scoring method",
      highestScore: "Best Series",
      averageScore: "All-Match Average × 2",
      emblemPennant: "{role} emblem pennant",
      bannerScore: "{role} banner score",
      dataLead: "This page uses replay data from the currently selected {name} tournament to calculate Fantasy scores.",
      dataSelectionBody: "The tournament dropdown can switch between every parsed event. Each tournament is scored independently; their data is never combined.",
      tournamentSnapshot: "Tournament Snapshot",
      leagueId: "League ID",
      parsedMatches: "Parsed matches",
      players: "Players",
      generatedDate: "Generated",
      scoringMethodTitle: "Scoring Rules",
      scoringMethodBodyClientDescription: "For each role, each player's score is calculated individually in every game they participate in. Players receive points only for the stats present on their War Banner, amplified if any of the conditions of your coach Titles are met. We then average the score of all players for a role and use that to decide the final score for the match.",
      scoringMethodBodyBestSeries: "Best Series use the same rule as the client. The top two scoring games within a series are used to get the role's final score for the match. If a role participates in more than one series in a period, the best scoring series will be used.",
      scoringMethodBodyAllMatchAverage: "All-Match Average × 2 averages every valid match in the full scoring period and doubles it.",
      dataSources: "Data Sources",
      dataSourcesBody: "All match information and Fantasy statistics are read directly from Valve replays.",
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
        kills: { label: "KILLS" },
        deaths: { label: "DEATHS" },
        creep_score: { label: "CREEP SCORE" },
        gpm: { label: "GPM" },
        madstone_collected: { label: "MADSTONES COLLECTED" },
        tower_kills: { label: "TOWER KILLS" },
        observer_wards_placed: { label: "WARDS PLACED" },
        camps_stacked: { label: "CAMPS STACKED" },
        runes_grabbed: { label: "RUNES GRABBED" },
        watchers_taken: { label: "WATCHERS TAKEN" },
        smokes_used: { label: "SMOKES USED" },
        lotuses_collected: { label: "LOTUSES GRABBED" },
        roshan_kills: { label: "ROSHAN KILLS" },
        teamfight_participation: { label: "TEAMFIGHT PARTICIPATION" },
        stun_seconds: { label: "STUNS" },
        tormentor_kills: { label: "TORMENTOR KILLS" },
        first_blood: { label: "FIRST BLOOD" },
        courier_kills: { label: "COURIER KILLS" },
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
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(variables, name)
        ? String(variables[name])
        : match,
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
    return copy().stats[stat];
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
    } catch {
      // The page still works when storage is blocked.
    }
  }

  function applyEnglishTitleFonts(root = document) {
    const titleElements = root.querySelectorAll(
      ".brand strong, h1, h2, h3, .score-method legend",
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

  const statContributionHintKeys = {
    deaths: "deathsContributionHint",
    teamfight_participation: "teamfightContributionHint",
    stun_seconds: "stunContributionHint",
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
    } catch {
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
    } catch {
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
        : "manual",
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
  dataset = datasetForStage(state.stage);

  function activateStage(stage) {
    if (!engine.stageKeys.includes(stage)) return false;
    const page = state.pages[stage];
    state.stage = stage;
    state.config = page.config;
    state.manualMultipliers = page.manualMultipliers;
    state.selectedKeys = page.selectedKeys;
    state.scoreMode = page.scoreMode;
    dataset = datasetForStage(stage);
    meta = dataset.meta || {};
    players = normalizePlayers(dataset);
    emblemContributionCache.clear();
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
        }),
      );
    } catch {
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
  let emblemRankingMode = "highestSeries";
  let players = normalizePlayers(dataset);
  let meta = dataset.meta || {};
  const emblemContributionCache = new Map();

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
                opponent:
                  map.opponent && map.opponent.name
                    ? {
                        teamId: map.opponent.teamId ?? null,
                        name: String(map.opponent.name),
                        tag: map.opponent.tag ? String(map.opponent.tag) : "",
                      }
                    : null,
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

  window.addEventListener("fantasy:leaguechange", (event) => {
    const nextDataset = event.detail?.dataset;
    if (
      !nextDataset ||
      Number(nextDataset.meta?.leagueId) !== Number(event.detail?.leagueId)
    ) {
      return;
    }

    leagueDataset = nextDataset;
    leagueStageDatasets = normalizeStageDatasets(
      event.detail?.stageDatasets,
      leagueDataset,
    );
    dataset = datasetForStage(state.stage);
    meta = dataset.meta || {};
    players = normalizePlayers(dataset);
    emblemContributionCache.clear();
    try {
      bannerGrid.hidden = false;
      loadError.hidden = true;
      render();
      if (!modalBackdrop.hidden) {
        updateModalContent(activeModalType || "data");
      }
    } catch (error) {
      console.error(error);
      bannerGrid.hidden = true;
      loadError.hidden = false;
    }
  });

  function formatDate(value) {
    if (!value) return text("localSnapshot");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const formatted = new Intl.DateTimeFormat(copy().locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Shanghai",
    }).format(date);
    return `${formatted} UTC+8`;
  }

  function signedPercent(value) {
    const rounded = Math.round(value * 100);
    if (rounded > 0) return `+${rounded}%`;
    return `${rounded}%`;
  }

  function formatScore(value) {
    return new Intl.NumberFormat(copy().locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function roleMapRecords(role) {
    return players
      .filter((player) => player.role === role)
      .flatMap((player) => player.maps || []);
  }

  function averageStatContributions(role, color) {
    const maps = roleMapRecords(role);
    const contributions = engine.statKeys
      .filter((stat) => engine.statDefinitions[stat].color === color)
      .map((stat) => {
        let total = 0;
        let count = 0;
        for (const map of maps) {
          const rawValue = map.stats?.[stat];
          if (!Number.isFinite(rawValue)) continue;
          const score = engine.scoreRawStat(stat, rawValue);
          if (!Number.isFinite(score)) continue;
          total += score;
          count += 1;
        }
        return {
          stat,
          average: count ? total / count : null,
        };
      });

    return {
      rankings: engine.rankAverageContributions(contributions),
      sampleCount: maps.length,
    };
  }

  function highestSeriesStatContributions(role, color) {
    let sampleCount = 0;
    const contributions = engine.statKeys
      .filter((stat) => engine.statDefinitions[stat].color === color)
      .map((stat) => {
        const candidates = engine.buildRankings(
          role,
          players,
          [{ color, stat, quality: 1, trait: "unique" }],
          "highest",
          { prefix: "none", suffix: "none" },
          [1],
        );
        const scores = candidates
          .map((candidate) => candidate.score)
          .filter(Number.isFinite);
        sampleCount = Math.max(sampleCount, scores.length);
        return {
          stat,
          average: scores.length
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null,
        };
      });

    return {
      rankings: engine.rankAverageContributions(contributions),
      sampleCount,
    };
  }

  function emblemContributionData(role, color) {
    const cacheKey = `${emblemRankingMode}:${role}:${color}`;
    if (!emblemContributionCache.has(cacheKey)) {
      emblemContributionCache.set(
        cacheKey,
        emblemRankingMode === "highestSeries"
          ? highestSeriesStatContributions(role, color)
          : averageStatContributions(role, color),
      );
    }
    return emblemContributionCache.get(cacheKey);
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
    const scoreDetailMarkup = `
        <div
          class="emblem-score-detail"
          aria-label="${escapeHtml(text("detailedEmblemScore", {
            stat: statDefinition(emblem.stat).label,
          }))}"
        >
          <output>${escapeHtml(Number.isFinite(selectedEmblemScore) ? formatScore(selectedEmblemScore) : "—")}</output>
        </div>`;

    return `
      <article
        class="emblem-card emblem-card--${emblem.color}${manualMode ? " emblem-card--manual" : ""}"
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
              <span class="${scoreClass}">${escapeHtml(entry.score === null ? "—" : formatScore(entry.score))}</span>
            </button>
          </li>`;
      })
      .join("");

    return `
      <section class="leaderboard" aria-label="${escapeHtml(text("liveRanking", { role: roleName(role) }))}">
        <ol class="ranking-list">${rows}</ol>
      </section>`;
  }

  function selectedRosterSubtitle(role, selected) {
    const teamName = selected?.subtitle || "—";
    if (state.scoreMode[role] !== "highest" || !selected) return teamName;

    return selected.opponent?.name
      ? `${teamName} vs ${selected.opponent.name}`
      : teamName;
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
    const selectedLabel = selected?.label || "—";
    const selectedSubtitle = selectedRosterSubtitle(role, selected);
    const selectedScore =
      selected && selected.score !== null ? formatScore(selected.score) : "—";

    return `
      <section class="banner-column" data-banner-column-role="${role}">
        <article class="war-banner war-banner--${role}${state.config[role].length === 5 ? " war-banner--five" : ""}" data-banner-role="${role}">
          <div class="banner-rope is-top" aria-hidden="true"></div>
          <div class="banner-main">
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

            ${rankingMarkup(role, rankings, selected)}
          </div>

          <section class="emblem-pennant" aria-label="${escapeHtml(text("emblemPennant", { role: roleName(role) }))}">
            <div class="emblem-stack">${emblems}</div>
          </section>

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

    totalScore.textContent = combined === null ? "—" : formatScore(combined);
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
      <p class="modal-lead">${escapeHtml(text("dataSelectionBody"))}</p>
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
          <p>${escapeHtml(text("scoringMethodBodyClientDescription"))}</p>
          <p>${escapeHtml(text("scoringMethodBodyBestSeries"))}</p>
          <p>${escapeHtml(text("scoringMethodBodyAllMatchAverage"))}</p>
        </section>
        <section class="data-card">
          <h3>${escapeHtml(text("dataSources"))}</h3>
          <p>${escapeHtml(text("dataSourcesBody"))}</p>
        </section>
        <section class="data-card">
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

  function emblemRankingColorMarkup(role, color) {
    const unavailableColor =
      (role === "core" && color === "blue") ||
      (role === "support" && color === "red");
    const contributionLabel = emblemRankingMode === "highestSeries"
      ? text("bestSeriesContribution")
      : text("averageContribution");
    const rows = emblemContributionData(role, color).rankings
      .map((entry, index) => {
        const contribution = entry.average === null
          ? text("rankingUnavailable")
          : formatScore(entry.average);
        const rankingScore = entry.rankingScore === null
          ? "—"
          : String(entry.rankingScore);
        const hintKey = statContributionHintKeys[entry.stat];
        const hint = hintKey ? text(hintKey) : "";
        const infoMarkup = hint
          ? `
                <span
                  class="emblem-ranking-info emblem-ranking-info--${entry.stat}"
                  tabindex="0"
                  aria-label="${escapeHtml(hint)}"
                >
                  <img src="fantasy-assets/icon_info.png" alt="" aria-hidden="true">
                  <span class="emblem-ranking-tooltip" aria-hidden="true">${escapeHtml(hint)}</span>
                </span>`
          : "";
        return `
          <li class="emblem-ranking-row">
            <span class="emblem-ranking-place" aria-hidden="true">${index + 1}</span>
            <span class="emblem-ranking-stat">
              <span class="emblem-ranking-stat-name">
                <span class="emblem-ranking-icon" aria-hidden="true">${statIconMarkup(entry.stat)}</span>
                ${escapeHtml(statDefinition(entry.stat).label)}
                ${infoMarkup}
              </span>
              <small>${escapeHtml(contributionLabel)}: ${escapeHtml(contribution)}</small>
            </span>
            <strong class="emblem-ranking-score">
              ${escapeHtml(rankingScore)}
              <small>${escapeHtml(text("rankingScore"))}</small>
            </strong>
          </li>`;
      })
      .join("");

    return `
      <section class="emblem-ranking-card emblem-ranking-card--${color}${unavailableColor ? " emblem-ranking-card--unavailable" : ""}">
        <h4><span aria-hidden="true"></span>${escapeHtml(colorName(color))}</h4>
        <ol>${rows}</ol>
      </section>`;
  }

  function emblemRankingsMarkup() {
    const roles = engine.bannerRoles
      .map((role) => {
        const sampleCount = emblemContributionData(
          role,
          engine.emblemColors[0],
        ).sampleCount;
        const sampleText = emblemRankingMode === "highestSeries"
          ? text("roleCandidateSamples", { count: sampleCount })
          : text("playerMapSamples", { count: sampleCount });
        const colors = engine.emblemColors
          .map((color) => emblemRankingColorMarkup(role, color))
          .join("");
        return `
          <section class="emblem-ranking-role">
            <header>
              <h3>${escapeHtml(roleName(role))}</h3>
              <p>${escapeHtml(sampleText)}</p>
            </header>
            <div class="emblem-ranking-grid">${colors}</div>
          </section>`;
      })
      .join("");

    const averageActive = emblemRankingMode === "average";
    const bestSeriesActive = emblemRankingMode === "highestSeries";
    const lead = bestSeriesActive
      ? text("emblemRankingsBestSeriesLead")
      : text("emblemRankingsLead");

    return `
      <div class="emblem-ranking-toolbar">
        <div class="emblem-ranking-switcher" role="group" aria-label="${escapeHtml(text("emblemRankingSwitcher"))}">
          <button
            type="button"
            data-emblem-ranking-mode="highestSeries"
            class="${bestSeriesActive ? "is-active" : ""}"
            aria-pressed="${bestSeriesActive}"
          >${escapeHtml(text("bestSeriesContributionMode"))}</button>
          <button
            type="button"
            data-emblem-ranking-mode="average"
            class="${averageActive ? "is-active" : ""}"
            aria-pressed="${averageActive}"
          >${escapeHtml(text("averageContributionMode"))}</button>
        </div>
      </div>
      <p class="modal-lead">${escapeHtml(lead)}</p>
      <p class="modal-lead emblem-ranking-method">${escapeHtml(text("emblemRankingsMethod"))}</p>
      <div class="emblem-rankings">${roles}</div>`;
  }

  function updateModalContent(type) {
    activeModalType = ["data", "emblemRankings"].includes(type)
      ? type
      : "data";
    if (activeModalType === "emblemRankings") {
      modalTitle.textContent = text("emblemRankings");
      modalBody.innerHTML = emblemRankingsMarkup();
    } else {
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

  stageSwitcher.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-stage]");
    if (!button || !activateStage(button.dataset.stage)) return;
    updateStageSwitcher();
    persistPageState();
    render();
  });

  modalBody.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-emblem-ranking-mode]");
    const mode = button?.dataset.emblemRankingMode;
    if (!button || !EMBLEM_RANKING_MODES.includes(mode)) return;
    emblemRankingMode = mode;
    updateModalContent("emblemRankings");
    modalBody
      .querySelector(`[data-emblem-ranking-mode="${mode}"]`)
      ?.focus();
  });


  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      openModal(button, button.dataset.openModal);
    });
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
  } catch (error) {
    console.error(error);
    bannerGrid.hidden = true;
    loadError.hidden = false;
  }
})();
