(function () {
  "use strict";

  const dataset = window.FANTASY_EWC_2026;
  const engine = window.FantasyEngine;
  const bannerGrid = document.getElementById("banner-grid");
  const totalScore = document.getElementById("total-score");
  const totalBreakdown = document.getElementById("total-breakdown");
  const loadError = document.getElementById("load-error");
  const pageShell = document.getElementById("page-shell");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modal = document.getElementById("info-modal");
  const modalKicker = document.getElementById("modal-kicker");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");

  if (!dataset || !engine) {
    bannerGrid.hidden = true;
    loadError.hidden = false;
    return;
  }

  const roleNames = {
    core: "核心",
    mid: "中单",
    support: "辅助",
  };

  const colorNames = {
    red: "红色",
    blue: "蓝色",
    green: "绿色",
  };

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
    scoreMode: "highest",
  };

  let modalTrigger = null;
  const players = normalizePlayers(dataset);
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
      const teamName = team.name || team.tag || `队伍 ${teamId}`;

      for (const player of team.players || []) {
        if (!engine.bannerRoles.includes(player.role)) continue;
        result.push({
          id: String(
            player.accountId ?? player.id ?? player.name ?? "unknown-player",
          ),
          name:
            player.name ||
            `选手 ${player.accountId ?? player.id ?? "未知"}`,
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
    if (!value) return "本地快照";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
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
        state.scoreMode,
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
          engine.qualityLabels[quality],
          String(emblem.quality),
        ),
      )
      .join("");
    const traitOptions = engine.traits
      .map((trait) =>
        optionMarkup(
          trait,
          engine.traitLabels[trait],
          emblem.trait,
        ),
      )
      .join("");
    const statOptions = availableStats
      .map((stat) =>
        optionMarkup(
          stat,
          engine.statDefinitions[stat].label,
          emblem.stat,
        ),
      )
      .join("");
    const traitEffect = modifier.selfTrait + modifier.neighbor;

    return `
      <article
        class="emblem-card emblem-card--${emblem.color}"
        aria-label="${roleNames[role]}第 ${index + 1} 枚${colorNames[emblem.color]}徽标"
      >
        <div class="emblem-head">
          <span class="emblem-icon" aria-hidden="true">${statIconMarkup(emblem.stat)}</span>
          <label>
            <span class="sr-only">统计数据</span>
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
            <span class="sr-only">品质</span>
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
            <span class="sr-only">特性</span>
            <select
              data-role="${role}"
              data-index="${index}"
              data-field="trait"
            >${traitOptions}</select>
          </label>
          <output title="自身与相邻特性的合计影响">${signedPercent(traitEffect)}</output>
        </div>
      </article>`;
  }

  function rankingMarkup(role, rankings, selected) {
    const rows = rankings
      .map((entry, index) => {
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
              <span class="ranking-number">${String(index + 1).padStart(2, "0")}</span>
              <span class="ranking-identity">
                <strong>${escapeHtml(entry.label)}</strong>
                <small>${escapeHtml(entry.subtitle)}</small>
              </span>
              <span class="${scoreClass}">${escapeHtml(engine.formatScore(entry.score))}</span>
            </button>
          </li>`;
      })
      .join("");

    return `
      <section class="leaderboard" aria-label="${roleNames[role]}实时排名">
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

    return `
      <section class="banner-column">
        <article class="war-banner war-banner--${role}" data-banner-role="${role}">
          <div class="banner-rope is-top" aria-hidden="true"></div>
          <header class="banner-heading">
            <h2>${roleNames[role]}</h2>
            <span class="selected-roster" title="${escapeHtml(selected ? selected.label : "等待有效数据")}">
              ${escapeHtml(selected ? selected.label : "等待有效数据")}
              <small>${escapeHtml(selected ? selected.subtitle : "—")}</small>
            </span>
            <fieldset class="score-method">
              <legend>积分方式</legend>
              <div>
                <button
                  type="button"
                  data-score-mode="highest"
                  aria-pressed="${state.scoreMode === "highest"}"
                  class="${state.scoreMode === "highest" ? "is-active" : ""}"
                >最高得分</button>
                <button
                  type="button"
                  data-score-mode="average"
                  aria-pressed="${state.scoreMode === "average"}"
                  class="${state.scoreMode === "average" ? "is-active" : ""}"
                >平均得分</button>
              </div>
            </fieldset>
          </header>

          <section class="emblem-pennant" aria-label="${roleNames[role]}徽标挂幅">
            <div class="emblem-stack">${emblems}</div>
          </section>

          ${rankingMarkup(role, rankings, selected)}

          <div class="banner-rope is-bottom" aria-hidden="true"></div>
        </article>
        <output
          class="banner-score-outside"
          aria-label="${roleNames[role]}战旗积分"
        >${escapeHtml(engine.formatScore(selected ? selected.score : null))}</output>
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
        element.dataset.scoreMode === request.mode
      ) {
        element.focus();
        return;
      }
    }
  }

  function render(focusRequest) {
    const view = getView();
    bannerGrid.innerHTML = engine.bannerRoles
      .map((role) =>
        bannerMarkup(role, view.rankings[role], view.selected[role]),
      )
      .join("");

    const allComplete = engine.bannerRoles.every(
      (role) =>
        view.selected[role] && view.selected[role].score !== null,
    );
    const combined = allComplete
      ? engine.bannerRoles.reduce(
          (sum, role) => sum + view.selected[role].score,
          0,
        )
      : null;

    totalScore.textContent = engine.formatScore(combined);
    totalBreakdown.textContent = engine.bannerRoles
      .map(
        (role) =>
          `${roleNames[role]} ${engine.formatScore(
            view.selected[role] ? view.selected[role].score : null,
          )}`,
      )
      .join(" · ");

    restoreFocus(focusRequest);
  }

  function rulesMarkup() {
    const qualityRows = engine.qualities
      .map(
        (quality) =>
          `<li>${engine.qualityLabels[quality]}：+${Math.round(
            engine.qualityBonus[quality] * 100,
          )}%</li>`,
      )
      .join("");
    const traitRows = engine.traits
      .map(
        (trait) =>
          `<li><strong>${engine.traitLabels[trait]}</strong>：${engine.traitDescriptions[trait]}</li>`,
      )
      .join("");
    const statRows = engine.statKeys
      .map(
        (stat) => `
          <tr>
            <th>${engine.statDefinitions[stat].label}</th>
            <td>${colorNames[engine.statDefinitions[stat].color]}</td>
            <td>${engine.statDefinitions[stat].formula}</td>
          </tr>`,
      )
      .join("");

    return `
      <p class="modal-lead">
        核心与辅助各选择同队两人并取平均，中单选择一人。最终积分为三面战旗之和。
        每枚徽标只计算其当前选中的统计数据。最高得分取单张地图，平均得分取全部有效地图的场均。
      </p>
      <div class="rule-grid">
        <section class="rule-card">
          <h3>三面战旗</h3>
          <p>核心：红、绿、红；中单：红、蓝、绿；辅助：蓝、绿、蓝。徽标颜色固定，数据、品质和特性可自由选择。</p>
        </section>
        <section class="rule-card">
          <h3>品质加成</h3>
          <ul>${qualityRows}</ul>
        </section>
        <section class="rule-card">
          <h3>徽标特性</h3>
          <ul>${traitRows}</ul>
        </section>
        <section class="rule-card">
          <h3>倍率算法</h3>
          <p>每枚徽标从 100% 开始，品质、自身特性和相邻特性按百分点相加。中间徽标可以同时受到两侧相邻徽标影响。</p>
        </section>
      </div>
      <section class="rule-card" style="margin-top:12px">
        <h3>统计数据与基础积分</h3>
        <table class="stat-table">
          <thead><tr><th>统计数据</th><th>徽标</th><th>基础积分</th></tr></thead>
          <tbody>${statRows}</tbody>
        </table>
      </section>`;
  }

  function dataMarkup() {
    const coverage = meta.coverage || {};
    return `
      <p class="modal-lead">
        页面直接读取随仓库保存的经典 JavaScript 数据文件，不使用网络请求、API 密钥或服务器。
      </p>
      <div class="data-grid">
        <section class="data-card">
          <h3>赛事快照</h3>
          <p>联赛 ID：${escapeHtml(meta.leagueId || "19785")}</p>
          <p>已解析比赛：${escapeHtml(coverage.parsedMatches || "—")}</p>
          <p>选手：${escapeHtml(coverage.players || players.length)}</p>
          <p>生成日期：${escapeHtml(formatDate(meta.generatedAt))}</p>
        </section>
        <section class="data-card">
          <h3>计算口径</h3>
          <p>最高得分逐张地图应用当前徽标倍率并取最高的一张；平均得分对全部有效地图的最终分数取算术平均。双人战旗始终要求两人来自同队，并在同一张地图上先取二人平均。</p>
        </section>
        <section class="data-card">
          <h3>已知限制</h3>
          <ul>
            <li>莲花采集没有可靠公开字段，因此保存为 null，而不是 0。</li>
            <li>狂石与观察者为 OpenDota 回放事件代理值。</li>
            <li>选手角色按赛事内路线与补刀数据推断。</li>
          </ul>
        </section>
        <section class="data-card">
          <h3>数据来源</h3>
          <p>OpenDota Explorer 与联赛比赛接口用于回放解析数据；Liquipedia 用于核对 EWC 2026 赛事范围。</p>
        </section>
      </div>`;
  }

  function openModal(name, trigger) {
    modalTrigger = trigger || document.activeElement;
    const isRules = name === "rules";
    modalKicker.textContent = isRules ? "HOW TO PLAY" : "DATA NOTES";
    modalTitle.textContent = isRules ? "玩法介绍" : "数据说明";
    modalBody.innerHTML = isRules ? rulesMarkup() : dataMarkup();
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
    render({ type: "select", role, index, field });
  });

  bannerGrid.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const modeButton = event.target.closest("button[data-score-mode]");
    if (modeButton) {
      const mode = modeButton.dataset.scoreMode;
      if (!engine.scoreModes.includes(mode)) return;
      state.scoreMode = mode;
      render({ type: "scoreMode", mode });
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

  document.getElementById("reset-button").addEventListener("click", () => {
    state.config = engine.cloneDefaultConfig();
    state.selectedKeys = {};
    state.scoreMode = "highest";
    render();
  });

  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      openModal(button.dataset.openModal, button);
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
