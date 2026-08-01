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

test("uses classic scripts and file-safe relative paths", () => {
  assert.doesNotMatch(html, /type=["']module["']/i);
  assert.doesNotMatch(html, /%BASE_URL%|\/src\/|src=["']\//i);
  assert.doesNotMatch(app, /\b(?:import|export)\b|fetch\s*\(/);

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
  assert.equal(dataset.meta.coverage.teams, 24);
  assert.equal(dataset.meta.coverage.players, 120);
  assert.equal(dataset.teams.length, 24);
  assert.equal(
    dataset.teams.flatMap((team) => team.players)
      .reduce((sum, player) => sum + player.maps.length, 0),
    1570,
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
    for (const stat of requiredStats) {
      assert.notEqual(map.stats[stat], null, `${stat} must be available`);
      assert.notEqual(map.stats[stat], undefined, `${stat} must be present`);
    }
  }
  assert.match(dataset.meta.fieldProvenance.madstones_collected, /m_nAcquiredMadstone/);
  assert.match(dataset.meta.fieldProvenance.watchers_captured, /m_iWatchersTaken/);
  assert.match(dataset.meta.fieldProvenance.lotuses_collected, /m_iLotusesTaken/);
  assert.equal(JSON.stringify(dataset), JSON.stringify(jsonDataset));
});

test("renders all three banners with a minimal classic-script DOM", () => {
  const dataSource = fs.readFileSync(
    path.join(root, "data", "19785", "data.js"),
    "utf8",
  );
  const elements = new Map();

  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        hidden: id === "modal-backdrop" || id === "load-error",
        inert: false,
        innerHTML: "",
        textContent: "",
        addEventListener() {},
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
    Intl,
    window: { FantasyEngine: engine, __TI_FANTASY_LANGUAGE__: "zh" },
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

  const rendered = element("banner-grid").innerHTML;
  assert.equal((rendered.match(/class="war-banner /g) || []).length, 3);
  assert.equal((rendered.match(/class="emblem-card /g) || []).length, 9);
  assert.equal((rendered.match(/class="leaderboard"/g) || []).length, 3);
  assert.equal((rendered.match(/class="banner-score-outside"/g) || []).length, 3);
  assert.equal((rendered.match(/data-score-mode="highest"/g) || []).length, 3);
  assert.doesNotMatch(rendered, /leaderboard-header|有效地图/);
  assert.notEqual(element("total-score").textContent, "—");
  assert.equal(element("load-error").hidden, true);
});
