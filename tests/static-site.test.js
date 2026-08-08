"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const engine = require("../fantasy.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");

test("publishes crawl and discovery metadata for the canonical site", () => {
  assert.match(robots, /^User-agent: \*\r?\nAllow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/www\.ti-fantasy\.site\/sitemap\.xml$/m);
  assert.match(sitemap, /<loc>https:\/\/www\.ti-fantasy\.site\/<\/loc>/);
  assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.ti-fantasy\.site\/">/);
  assert.match(html, /<meta name="robots" content="index, follow,/);
  assert.match(html, /selectable replay datasets from parsed 2026 tournaments/);
  assert.doesNotMatch(html, /calculator using Esports World Cup 2026 replay data/);
  assert.match(app, /Each tournament is scored independently; their data is never combined/);

  const structuredDataSource = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(structuredDataSource, "WebApplication structured data must exist");
  const structuredData = JSON.parse(structuredDataSource[1]);
  assert.equal(structuredData["@type"], "WebApplication");
  assert.equal(structuredData.url, "https://www.ti-fantasy.site/");
  assert.equal(structuredData.offers.price, 0);
});

test("uses classic scripts and file-safe relative paths", () => {
  assert.doesNotMatch(html, /type=["']module["']/i);
  assert.doesNotMatch(html, /%BASE_URL%|\/src\/|src=["']\//i);
  assert.doesNotMatch(app, /\b(?:import|export)\b|fetch\s*\(/);
  assert.match(html, /window\.__TI_FANTASY_RETURNING_VISITOR__/);
  assert.ok(
    html.indexOf("returningVisitor = previousVisitKeys.some") <
      html.indexOf("localStorage.setItem(storageKey, language)"),
    "returning-visitor state must be captured before a first visit writes storage",
  );

  const htmlPaths = Array.from(
    html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi),
    (match) => match[1],
  );
  const cssPaths = Array.from(
    css.matchAll(/url\(["']?([^"')]+)["']?\)/gi),
    (match) => match[1],
  );

  for (const relativePath of [...htmlPaths, ...cssPaths]) {
    if (relativePath.includes("://")) continue;
    const localPath = relativePath.split(/[?#]/, 1)[0];
    assert.ok(
      !path.isAbsolute(localPath) &&
        !localPath.startsWith("/") &&
        !localPath.includes("://"),
      `path must stay local and relative: ${relativePath}`,
    );
    assert.ok(
      fs.existsSync(path.join(root, localPath)),
      `referenced local file is missing: ${relativePath}`,
    );
  }
});

test("orders the topbar actions and links to the Candyworks Calculator", () => {
  const navSource = html.match(/<nav aria-label="页面操作"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(navSource, "the page-actions navigation must exist");
  assert.ok(navSource.indexOf('data-open-modal="emblemRankings"') < navSource.indexOf('data-open-modal="data"'));
  assert.ok(navSource.indexOf('data-open-modal="data"') < navSource.indexOf('github.com'));
  assert.ok(navSource.indexOf('github.com') < navSource.indexOf('id="language-toggle"'));
  assert.ok(navSource.indexOf('id="language-toggle"') < navSource.indexOf('www.candyworks.site'));
  assert.match(
    navSource,
    /href="https:\/\/www\.candyworks\.site\/"[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/,
  );
  assert.match(navSource, /data-i18n="candyworksCalculator"/);
  assert.match(app, /candyworksCalculator:\s*"Candyworks Calculator"/);
  assert.match(app, /emblemRankings:\s*"Emblem Rankings"/);
  assert.match(css, /\.emblem-ranking-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
  assert.match(app, /role === "core" && color === "blue"/);
  assert.match(app, /role === "support" && color === "red"/);
  assert.match(css, /\.emblem-ranking-card--unavailable\s*\{/);
  assert.match(app, /data-emblem-ranking-mode="average"/);
  assert.match(app, /data-emblem-ranking-mode="highestSeries"/);
  assert.ok(
    app.indexOf('data-emblem-ranking-mode="highestSeries"') <
      app.indexOf('data-emblem-ranking-mode="average"'),
  );
  assert.match(app, /let emblemRankingMode = "highestSeries"/);
  assert.match(app, /highestSeriesStatContributions[\s\S]*?engine\.buildRankings\(/);
  assert.match(css, /\.emblem-ranking-switcher\s*\{/);
  assert.match(app, /fantasy-assets\/icon_info\.png/);
  assert.match(app, /teamfightContributionHint/);
  assert.match(app, /deaths:\s*"deathsContributionHint"/);
  assert.match(app, /stun_seconds:\s*"stunContributionHint"/);
  assert.match(css, /\.emblem-ranking-info:hover \.emblem-ranking-tooltip/);
  assert.match(css, /\.emblem-ranking-info--deaths \.emblem-ranking-tooltip\s*\{/);
  assert.ok(fs.existsSync(path.join(root, "fantasy-assets", "icon_info.png")));
});

test("loads the browser data snapshot without fetch or modules", () => {
  const source = fs.readFileSync(
    path.join(root, "data", "19785", "data.js"),
    "utf8",
  );
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);

  const dataset = sandbox.window.FANTASY_DATA;
  const jsonDataset = JSON.parse(
    fs.readFileSync(
      path.join(root, "data", "19785", "summary.json"),
      "utf8",
    ),
  );
  assert.equal(dataset.meta.coverage.matches, 157);
  assert.equal(dataset.meta.coverage.teams, 14);
  assert.equal(dataset.meta.coverage.players, 70);
  assert.equal(dataset.teams.length, 14);
  assert.equal(
    dataset.teams.flatMap((team) => team.players)
      .reduce((sum, player) => sum + player.maps.length, 0),
    1010,
  );
  assert.deepEqual(
    Array.from(dataset.meta.excludedTeamNames),
    [
      "IC x Insanity", "L1 TEAM", "Level UP", "MOUZ", "Poor Rangers",
      "PTime", "REKONIX", "Rune Eaters", "Team Nemesis", "Virtus.pro",
    ],
  );
  assert.equal(
    dataset.teams.some((team) => dataset.meta.excludedTeamNames.includes(team.name)),
    false,
  );
  const requiredStats = [
    "kills", "deaths", "creep_score", "gpm", "madstones_collected",
    "towers_destroyed", "observer_wards_placed", "camps_stacked",
    "runes_picked_up", "watchers_captured", "smokes_used",
    "lotuses_collected", "roshans_killed", "teamfight_participation",
    "stun_seconds", "tormentors_killed", "first_blood", "couriers_killed",
  ];
  for (const map of dataset.teams.flatMap((team) =>
    team.players.flatMap((player) => player.maps))) {
    assert.notEqual(map.seriesId, undefined, "seriesId must be present");
    assert.notEqual(map.seriesType, undefined, "seriesType must be present");
    assert.notEqual(map.heroId, undefined, "heroId must be present");
    assert.notEqual(map.titleConditions, undefined, "title conditions must be present");
    for (const stat of requiredStats) {
      assert.notEqual(map.stats[stat], null, `${stat} must be available`);
      assert.notEqual(map.stats[stat], undefined, `${stat} must be present`);
    }
  }
  assert.match(
    dataset.meta.fieldProvenance.madstones_collected,
    /m_(?:nAcquiredMadstone|iNeutralTokensFound)/,
  );
  assert.match(dataset.meta.fieldProvenance.watchers_captured, /m_iWatchersTaken/);
  assert.match(dataset.meta.fieldProvenance.lotuses_collected, /m_iLotusesTaken/);
  assert.equal(JSON.stringify(dataset), JSON.stringify(jsonDataset));
});

test("selects from every generated league snapshot", () => {
  assert.match(html, /id="league-select"/);
  assert.match(html, /src="data\/leagues\.js"/);
  assert.match(html, /option\.textContent = league\.leagueName/);
  assert.match(html, /history\.pushState\(\{ leagueId \}, "", target\)/);
  assert.match(html, /CustomEvent\("fantasy:leaguechange"/);
  assert.doesNotMatch(html, /window\.location\.assign/);
  assert.match(app, /leagueSelector:\s*"Tournament data"/);

  const catalogSource = fs.readFileSync(
    path.join(root, "data", "leagues.js"),
    "utf8",
  );
  const catalogSandbox = { window: {} };
  vm.runInNewContext(catalogSource, catalogSandbox);
  const catalog = JSON.parse(JSON.stringify(catalogSandbox.window.FANTASY_LEAGUES));
  assert.deepEqual(catalog, [
    { leagueId: 19785, leagueName: "Esports World Cup 2026" },
    { leagueId: 20009, leagueName: "1win Essence II" },
  ]);

  for (const { leagueId, leagueName } of catalog) {
    const source = fs.readFileSync(
      path.join(root, "data", String(leagueId), "data.js"),
      "utf8",
    );
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox);
    assert.equal(sandbox.window.FANTASY_DATA.meta.leagueId, leagueId);
    assert.equal(sandbox.window.FANTASY_DATA.meta.leagueName, leagueName);
  }
});

test("renders all three banners with a minimal classic-script DOM", () => {
  const dataSource = fs.readFileSync(
    path.join(root, "data", "19785", "data.js"),
    "utf8",
  );
  const elements = new Map();
  const listeners = new Map();
  const alerts = [];
  const timers = [];
  const returningVisitorPageState = JSON.stringify({
      version: 3,
      stage: "groupStage",
      pages: {},
      titles: { prefix: "none", suffix: "none" },
      multiplierMode: "manual",
    });
  const storage = new Map();

  class FakeElement {}
  class FakeInput extends FakeElement {
    constructor(dataset, value) {
      super();
      this.dataset = { ...dataset };
      this.value = value;
      this.focusCount = 0;
    }

    focus() {
      this.focusCount += 1;
    }
  }
  class FakeSelect extends FakeElement {}
  class FakeModeButton extends FakeElement {
    constructor(mode) {
      super();
      this.dataset = { multiplierMode: mode };
    }

    closest() {
      return this;
    }
  }

  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        hidden: id === "modal-backdrop" || id === "load-error",
        inert: false,
        innerHTML: "",
        textContent: "",
        addEventListener(type, handler) {
          listeners.set(`${id}:${type}`, handler);
        },
        setAttribute() {},
        removeAttribute() {},
        focus() {},
        querySelectorAll() {
          return [];
        },
      });
    }
    return elements.get(id);
  }

  const sandbox = {
    console,
    Date,
    Element: FakeElement,
    HTMLInputElement: FakeInput,
    HTMLSelectElement: FakeSelect,
    Intl,
    window: {
      FantasyEngine: engine,
      __TI_FANTASY_LANGUAGE__: "zh",
      addEventListener(type, handler) {
        listeners.set(`window:${type}`, handler);
      },
      alert(message) {
        alerts.push(String(message));
      },
      setTimeout(callback) {
        timers.push(callback);
      },
    },
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
    document: {
      documentElement: { lang: "zh-CN" },
      title: "",
      activeElement: null,
      getElementById: element,
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
  };

  vm.runInNewContext(dataSource, sandbox);

  vm.runInNewContext(app, sandbox);
  assert.deepEqual(alerts, [], "a first-time visitor must not see the notice");
  assert.equal(timers.length, 0);
  assert.equal(
    storage.get("ti-fantasy-tormentor-correction-notice-v1"),
    "shown",
    "a first-time visitor must remain excluded on later visits",
  );

  // Simulate an existing visitor at deployment time: an old page-state key
  // exists, while this newly introduced notice key does not exist yet.
  storage.set("ti-fantasy-page-state-v1", returningVisitorPageState);
  storage.delete("ti-fantasy-tormentor-correction-notice-v1");
  vm.runInNewContext(app, sandbox);

  const rendered = element("banner-grid").innerHTML;
  assert.equal((rendered.match(/class="war-banner /g) || []).length, 3);
  assert.equal((rendered.match(/class="banner-main"/g) || []).length, 3);
  assert.equal((rendered.match(/class="emblem-card /g) || []).length, 9);
  assert.equal((rendered.match(/class="banner-score"/g) || []).length, 3);
  assert.match(
    css,
    /\.emblem-pennant\s*\{[\s\S]*?height:\s*auto;/,
    "the pennant height must follow its content stack",
  );
  assert.match(
    css,
    /\.war-banner\s*\{[\s\S]*?height:\s*auto;[\s\S]*?display:\s*grid;/,
    "the war banner must be sized by its two content columns",
  );
  assert.match(
    css,
    /\.banner-main,\s*\n\.emblem-pennant\s*\{\s*grid-area:\s*1\s*\/\s*1;/,
    "the leaderboard column and variable-height pennant must share the sizing row",
  );
  assert.match(
    css,
    /\.banner-main\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/,
    "the leaderboard column must stretch to the pennant-driven banner height",
  );
  assert.match(
    css,
    /\.leaderboard\s*\{[\s\S]*?height:\s*274px;[\s\S]*?min-height:\s*274px;[\s\S]*?flex:\s*1\s+1\s+274px;[\s\S]*?overflow:\s*hidden;/,
    "the leaderboard must start at 5.5 rows and only grow to fill the banner",
  );
  assert.match(
    rendered,
    /class="banner-main"[\s\S]*?class="banner-heading"[\s\S]*?class="leaderboard"[\s\S]*?class="emblem-pennant"/,
    "the leaderboard must follow the banner heading",
  );
  assert.match(
    css,
    /@media \(max-width:\s*900px\)[\s\S]*?\.banner-main\s*\{\s*display:\s*contents;[\s\S]*?\.banner-heading\s*\{[\s\S]*?order:\s*1;[\s\S]*?\.emblem-pennant\s*\{[\s\S]*?order:\s*2;[\s\S]*?\.leaderboard\s*\{[\s\S]*?order:\s*3;/,
    "mobile banners must show the pennant before the leaderboard",
  );
  assert.match(
    css,
    /--emblem-pennant-tip-depth:\s*28px;[\s\S]*?50%\s+calc\(100%\s+-\s+var\(--emblem-pennant-tip-depth\)\)/,
    "the pennant tip must keep a fixed depth instead of growing with the stack",
  );
  assert.equal((rendered.match(/class="leaderboard"/g) || []).length, 3);
  assert.equal((rendered.match(/data-score-mode="highest"/g) || []).length, 3);
  assert.equal((rendered.match(/data-field="multiplier"/g) || []).length, 9);
  assert.doesNotMatch(rendered, /class="emblem-detail"/);
  assert.match(html, /id="multiplier-switcher"/);
  assert.doesNotMatch(html, /detailed-score-toggle|显示详细得分/);
  assert.equal(
    (rendered.match(/class="emblem-score-detail"/g) || []).length,
    9,
  );
  assert.equal(
    (rendered.match(/class="emblem-score-detail"[^>]*>\s*<output>/g) || []).length,
    9,
  );
  assert.doesNotMatch(rendered, /has-score-detail/);
  const multiplierClick = listeners.get("multiplier-switcher:click");
  multiplierClick({ target: new FakeModeButton("calculated") });
  assert.equal(
    (element("banner-grid").innerHTML.match(/class="emblem-score-detail"/g) || []).length,
    9,
  );
  assert.match(element("banner-grid").innerHTML, /class="emblem-detail"/);
  multiplierClick({ target: new FakeModeButton("manual") });
  assert.equal(
    (element("banner-grid").innerHTML.match(/class="emblem-score-detail"/g) || []).length,
    9,
  );
  assert.match(html, /data-multiplier-mode="manual"/);
  assert.match(element("prefix-title-select").innerHTML, /value="crimson"/);
  assert.match(element("suffix-title-select").innerHTML, /value="loser"/);
  assert.doesNotMatch(rendered, /leaderboard-header|有效地图/);
  assert.notEqual(element("total-score").textContent, "—");
  assert.equal(element("load-error").hidden, true);
  const leagueChange = listeners.get("window:fantasy:leaguechange");
  assert.equal(typeof leagueChange, "function");
  const nextDataset = JSON.parse(
    fs.readFileSync(path.join(root, "data", "20009", "summary.json"), "utf8"),
  );
  leagueChange({
    detail: { dataset: nextDataset, leagueId: 20009 },
  });
  assert.match(element("banner-grid").innerHTML, /BoomBoys/);
  assert.equal(element("load-error").hidden, true);
  assert.deepEqual(alerts, [], "the alert must wait until initial rendering finishes");
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.deepEqual(alerts, [], "the disabled correction alert must stay hidden");
  assert.equal(element("modal-backdrop").hidden, true);
  assert.equal(
    storage.get("ti-fantasy-tormentor-correction-notice-v1"),
    "shown",
  );
  const saved = JSON.parse(storage.get("ti-fantasy-page-state-v1"));
  assert.equal(saved.version, 3);
  assert.equal(saved.multiplierMode, "manual");
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(saved.pages.groupStage.manualMultipliers).map(
        ([role, values]) => [role, values.length],
      ),
    ),
    { core: 3, mid: 3, support: 3 },
  );

  const focusIn = listeners.get("banner-grid:focusin");
  const focusOut = listeners.get("banner-grid:focusout");
  const original = saved.pages.groupStage.manualMultipliers.core[0];
  const multiplier = new FakeInput(
    { role: "core", index: "0", field: "multiplier" },
    String(original),
  );

  focusIn({ target: multiplier });
  assert.equal(multiplier.value, "", "focusing must clear the current value");
  focusOut({ target: multiplier });
  assert.equal(
    multiplier.value,
    String(original),
    "an empty edit must restore the previous value",
  );

  focusIn({ target: multiplier });
  multiplier.value = "123.45";
  focusOut({ target: multiplier });
  const updated = JSON.parse(storage.get("ti-fantasy-page-state-v1"));
  assert.equal(updated.pages.groupStage.manualMultipliers.core[0], 123.45);
  assert.equal(multiplier.focusCount, 0, "committing must not restore input focus");

  assert.equal(
    storage.has("ti-fantasy-scoring-change-notice-v1"),
    false,
    "merely showing the notice must not dismiss it",
  );
  listeners.get("scoring-change-notice-open:click")();
  assert.equal(element("modal-backdrop").hidden, false);
  assert.equal(element("modal-title").textContent, "2025 与 2026 积分规则对比");
  const comparison = element("modal-body").innerHTML;
  const comparisonRows = Array.from(
    comparison.matchAll(/<tr class="score-change-row [^"]+"[\s\S]*?<\/tr>/g),
    (match) => match[0],
  );
  assert.equal(comparisonRows.length, 18);
  assert.match(comparisonRows[0], /is-increase[\s\S]*击杀肉山/);
  assert.match(comparisonRows.at(-1), /is-decrease[\s\S]*眩晕时间/);
  assert.match(comparison, /\+37\.88%/);
  assert.match(comparison, /−33\.33%|-33\.33%/);

  listeners.get("correction-banner-close:click")();
  assert.equal(element("correction-banner").hidden, true);
  assert.equal(
    storage.get("ti-fantasy-scoring-change-notice-v1"),
    "dismissed",
  );
});
