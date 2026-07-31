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
    assert.ok(
      !path.isAbsolute(relativePath) &&
        !relativePath.startsWith("/") &&
        !relativePath.includes("://"),
      `path must stay local and relative: ${relativePath}`,
    );
    assert.ok(
      fs.existsSync(path.join(root, relativePath)),
      `referenced local file is missing: ${relativePath}`,
    );
  }
});

test("loads the browser data snapshot without fetch or modules", () => {
  const source = fs.readFileSync(
    path.join(root, "data", "ewc_2026_data.js"),
    "utf8",
  );
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);

  const dataset = sandbox.window.FANTASY_EWC_2026;
  const jsonDataset = JSON.parse(
    fs.readFileSync(
      path.join(root, "data", "ewc_2026_summary.json"),
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
  assert.equal(JSON.stringify(dataset), JSON.stringify(jsonDataset));
});

test("renders all three banners with a minimal classic-script DOM", () => {
  const dataSource = fs.readFileSync(
    path.join(root, "data", "ewc_2026_data.js"),
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
    window: { FantasyEngine: engine },
    document: {
      activeElement: null,
      getElementById: element,
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
