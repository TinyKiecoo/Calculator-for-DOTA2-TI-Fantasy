(function () {
  "use strict";

  const dataset = window.FANTASY_EWC_2026;
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

  const languageToggle = document.getElementById("language-toggle");
  const LANGUAGE_STORAGE_KEY = "ti-fantasy-language";

  const translations = {
    zh: {
      locale: "zh-CN",
      documentTitle: "DOTA 2 TI 梦幻挑战计算器",
      description: "开源的 DOTA 2 TI 梦幻挑战预测计算器。",
      backToTop: "返回梦幻挑战顶部",
      brandName: "梦幻挑战",
      pageHeading: "开源的 Dota 2 梦幻挑战计算器",
      accuracyNote: "计算结果可能不准确，数据仅供参考。",
      pageActions: "页面操作",
      githubRepository: "GitHub",
      githubAria: "在新标签页打开 GitHub 仓库",
      switchLanguage: "切换为英文",
      dataNotes: "数据说明",
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
      highestScore: "最高得分",
      averageScore: "平均得分",
      emblemPennant: "{role}徽标挂幅",
      bannerScore: "{role}战旗积分",
      dataKicker: "DATA NOTES",
      dataLead: "本页面使用 Esports World Cup 2026 的数据来计算梦幻挑战的积分。",
      tournamentSnapshot: "赛事快照",
      leagueId: "联赛 ID",
      parsedMatches: "已解析比赛",
      players: "选手",
      generatedDate: "生成日期",
      scoringMethodTitle: "计算口径",
      scoringMethodBody: "最高得分逐张地图应用当前徽标倍率并取最高的一张；平均得分对全部有效地图的最终分数取算术平均。双人战旗始终要求两人来自同队，并在同一张地图上先取二人平均。",
      knownLimitations: "已知限制",
      limitationLotus: "莲花采集没有可靠公开字段，因此保存为 null，而不是 0。",
      lotusDataMissingAlert: "“采集莲花”数据缺失，当前无法计算该项得分。",
      madstoneDataCaveatAlert: "已有中立物品时收集的狂石可能未被统计，计算数据低于真实数据",
      limitationProxy: "狂石与观察者为 OpenDota 回放事件代理值。",
      limitationRoles: "选手角色按赛事内路线与补刀数据推断。",
      dataSources: "数据来源",
      dataSourcesBody: "OpenDota Explorer 与联赛比赛接口用于回放解析数据；Liquipedia 用于核对 EWC 2026 赛事范围。",
      roles: { core: "核心", mid: "中单", support: "辅助" },
      colors: { red: "红色", blue: "蓝色", green: "绿色" },
      qualityLabels: {
        1: "第 1 阶", 2: "第 2 阶", 3: "第 3 阶", 4: "第 4 阶", 5: "第 5 阶",
      },
      traitLabels: {
        fractal: "分形", benevolent: "仁爱", vampire: "吸血鬼", unique: "唯一", friendly: "友好",
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
      documentTitle: "Calculator for DOTA 2 TI Fantasy",
      description: "An open-source calculator for DOTA 2 TI Fantasy predictions.",
      backToTop: "Back to the Fantasy Challenge top",
      brandName: "FANTASY",
      pageHeading: "Open-source Dota 2 Fantasy Challenge Calculator",
      accuracyNote: "Results may be inaccurate and are for reference only.",
      pageActions: "Page actions",
      githubRepository: "GitHub",
      githubAria: "Open the GitHub repository in a new tab",
      switchLanguage: "Switch to Chinese",
      dataNotes: "Data Notes",
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
      highestScore: "Highest Score",
      averageScore: "Average Score",
      emblemPennant: "{role} emblem pennant",
      bannerScore: "{role} banner score",
      dataKicker: "DATA NOTES",
      dataLead: "This page uses data from Esport World Cup 2026 to calculate Fantasy Score.",
      tournamentSnapshot: "Tournament Snapshot",
      leagueId: "League ID",
      parsedMatches: "Parsed matches",
      players: "Players",
      generatedDate: "Generated",
      scoringMethodTitle: "Scoring Method",
      scoringMethodBody: "Highest Score applies the current emblem multipliers to every map and selects the best map. Average Score takes the arithmetic mean of all valid map scores. Two-player banners always require both players to be on the same team and average their scores within the same map first.",
      knownLimitations: "Known Limitations",
      limitationLotus: "Lotus collection has no reliable public field, so it is stored as null rather than 0.",
      lotusDataMissingAlert: "Data for “Lotuses Grabbed” is unavailable, so this score cannot currently be calculated.",
      madstoneDataCaveatAlert: "Madstones collected when owning neutral items may not have been counted, so the calculated value is significantly lower than the actual value.",
      limitationProxy: "Madstone and Watcher values are proxies derived from OpenDota replay events.",
      limitationRoles: "Player roles are inferred from lane and last-hit data within the tournament.",
      dataSources: "Data Sources",
      dataSourcesBody: "OpenDota Explorer and league match endpoints provide replay-parsed data; Liquipedia is used to verify the EWC 2026 tournament scope.",
      roles: { core: "Core", mid: "Mid", support: "Support" },
      colors: { red: "Red", blue: "Blue", green: "Green" },
      qualityLabels: {
        1: "Tier 1", 2: "Tier 2", 3: "Tier 3", 4: "Tier 4", 5: "Tier 5",
      },
      traitLabels: {
        fractal: "FRACTAL", benevolent: "BENEVOLENT", vampire: "VAMPIRIC", unique: "UNIQUE", friendly: "FRIENDLY",
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
      players = normalizePlayers(dataset);
      render();
      if (!modalBackdrop.hidden) {
        modalKicker.textContent = text("dataKicker");
        modalTitle.textContent = text("dataNotes");
        modalBody.innerHTML = dataMarkup();
        applyEnglishTitleFonts(modal);
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

  const state = {
    config: engine.cloneDefaultConfig(),
    selectedKeys: {},
    scoreMode: Object.fromEntries(
      engine.bannerRoles.map((role) => [role, "highest"]),
    ),
  };

  let modalTrigger = null;
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  }

  function statIconMarkup(stat) {
    return `
      <svg viewBox="0 0 32 32" focusable="false" aria-hidden="true">
        ${statIconPaths[stat] || statIconPaths.runes_grabbed}
      </svg>`;
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

    return { rankings, selected };
  }

  function optionMarkup(value, label, selectedValue) {
    return `<option value="${escapeHtml(value)}"${
      value === selectedValue ? " selected" : ""
    }>${escapeHtml(label)}</option>`;
  }

  function emblemMarkup(role, emblem, index, modifier) {
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

    return `
      <article
        class="emblem-card emblem-card--${emblem.color}"
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
          <strong class="emblem-multiplier">${Math.round(modifier.total * 100)}%</strong>
        </div>
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
        </div>
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
    const modifiers = engine.calculateEmblemModifiers(state.config[role]);
    const emblems = state.config[role]
      .map((emblem, index) =>
        emblemMarkup(role, emblem, index, modifiers[index]),
      )
      .join("");
    const selectedLabel = selected ? selected.label : text("waitingForData");
    const selectedSubtitle = selected ? selected.subtitle : "—";

    return `
      <section class="banner-column" data-banner-column-role="${role}">
        <article class="war-banner war-banner--${role}" data-banner-role="${role}">
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
          </header>

          <section class="emblem-pennant" aria-label="${escapeHtml(text("emblemPennant", { role: roleName(role) }))}">
            <div class="emblem-stack">${emblems}</div>
          </section>

          ${rankingMarkup(role, rankings, selected)}

          <div class="banner-rope is-bottom" aria-hidden="true"></div>
        </article>
        <output
          class="banner-score-outside"
          aria-label="${escapeHtml(text("bannerScore", { role: roleName(role) }))}"
        >${escapeHtml(formatScore(selected ? selected.score : null))}</output>
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
        ${escapeHtml(text("dataLead"))}
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
            <li>${escapeHtml(text("limitationLotus"))}</li>
            <li>${escapeHtml(text("limitationProxy"))}</li>
            <li>${escapeHtml(text("limitationRoles"))}</li>
          </ul>
        </section>
        <section class="data-card">
          <h3>${escapeHtml(text("dataSources"))}</h3>
          <p>${escapeHtml(text("dataSourcesBody"))}</p>
        </section>
      </div>`;
  }

  function openModal(trigger) {
    modalTrigger = trigger || document.activeElement;
    modalKicker.textContent = text("dataKicker");
    modalTitle.textContent = text("dataNotes");
    modalBody.innerHTML = dataMarkup();
    applyEnglishTitleFonts(modal);
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
  }

  bannerGrid.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const role = select.dataset.role;
    const index = Number(select.dataset.index);
    const field = select.dataset.field;
    if (
      !engine.bannerRoles.includes(role) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 2 ||
      !["stat", "quality", "trait"].includes(field)
    ) {
      return;
    }

    state.config[role][index][field] =
      field === "quality" ? Number(select.value) : select.value;

    if (field === "stat" && select.value === "lotuses_collected") {
      window.alert(text("lotusDataMissingAlert"));
    } else if (field === "stat" && select.value === "madstone_collected") {
      window.alert(text("madstoneDataCaveatAlert"));
    }

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
      renderScoreMode(role, { type: "scoreMode", role, mode });
      return;
    }

    const button = event.target.closest("button[data-ranking-role]");
    if (!button) return;
    const role = button.dataset.rankingRole;
    const key = button.dataset.rankingKey;
    if (!engine.bannerRoles.includes(role) || !key) return;
    state.selectedKeys[role] = key;
    render({ type: "ranking", role, key });
  });


  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      openModal(button);
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
    render();
  } catch (error) {
    console.error(error);
    bannerGrid.hidden = true;
    loadError.hidden = false;
  }
})();
