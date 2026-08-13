<p align="center">
  <img src="fantasy-assets/ti26_logo_png.png" width="96">
</p>

<h1 align="center">Calculator for DOTA 2 TI Fantasy</h1>

<p align="center">
  An open-source calculator for Dota 2 TI Fantasy predictions.
  <br>
  Using selectable 2026 tournament replay datasets to predict the Fantasy Score of <strong>TI 2026</strong>.
</p>

<p align="center">
  Open the calculator: <a href="https://www.ti-fantasy.site"><strong>www.ti-fantasy.site</strong></a>.
</p>

---

## Official Deployments

| Site | Address |
| --- | --- |
| Primary | **[www.ti-fantasy.site](https://www.ti-fantasy.site)** |
| Alternative | [tinykiecoo.github.io/Calculator-for-DOTA2-TI-Fantasy](https://tinykiecoo.github.io/Calculator-for-DOTA2-TI-Fantasy/) |

> [!NOTE]
> These are the only deployments maintained by the author. Similar-looking tools hosted elsewhere may be third-party redeployments.

## Run Locally

Clone or download the repository, then open `index.html` in a modern browser.
The bundled catalog currently includes **Esports World Cup 2026** and
**1win Essence II**. Each tournament is selected and scored independently;
their match data is never combined.

## Repository Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Application and GitHub Pages entry point |
| `fantasy-assets/` | Local images, fonts, and other interface assets |
| `scripts/build_league.py` | Configurable league data pipeline |
| `scripts/league_data.py` | Replay-checkpoint dataset and roster-role assembler |
| `scripts/replay_tools.py` | Valve replay downloader and complete Clarity field parser |
| `data/leagues.js` | Generated browser catalog of every available league ID and name |
| `data/<LEAGUE_ID>/` | Generated league metadata, match checkpoints, and browser snapshot |
| `tests/` | Verification and calculation tests |
| [`LICENSE`](LICENSE) | License for the original source code and documentation |

## Build Data for a League

Java/Javac 17 or newer and Python 3.10 or newer are required. First find the
OpenDota league ID if it is not known:

```powershell
python scripts/build_league.py --find-league "1win Essence II"
```

There are two equivalent ways to select the league. Either edit the default
`LEAGUE_ID` near the top of `scripts/build_league.py` and run:

```powershell
python scripts/build_league.py
```

Or leave the source unchanged and pass the ID on the command line (the command
line value takes precedence):

```powershell
python scripts/build_league.py --league-id 20009
```

The league name is fetched automatically from OpenDota's exact
`/leagues/<LEAGUE_ID>` endpoint and is not configured manually. Liquipedia was
previously stored only as optional source metadata; it did not affect replay
discovery, parsing, or scoring, so that configuration has been removed.
OpenDota is otherwise used only to discover the league's Valve replay links.
Player statistics, identities, teams, internal match ID, timestamps, match
result and duration all come from the downloaded replay.
If a newly listed match does not have a replay URL yet, that match is skipped
for the current run and retried by the next incremental update.
The output is stored under `data/<LEAGUE_ID>/`.
After every successful browser-data refresh, `data/leagues.js` is regenerated
from all published league directories. The page uses that catalog to populate
its tournament dropdown, so adding a league does not require editing
`index.html`. Changing the dropdown loads only the selected league's `data.js`
and recalculates the page in place without a full-page reload. The tournament
selection is session-only: it is not stored in `localStorage` or the URL, and a
new page load always defaults to `The International 2026` when that dataset is
available.
Every completed match has its own `matches/<MATCH_ID>.json` checkpoint. A
rerun validates and prints those saved player stats without downloading or
parsing the replay again. Compressed and decompressed replay files are kept in
`replays/<LEAGUE_ID>/`. An existing `.dem` is parsed directly; otherwise an
existing `.dem.bz2` is decompressed, and only a missing replay is downloaded.
Replay clusters 413, 415, and 417 use Valve's China-domain host
`replay<CLUSTER>.dota2.com.cn`; other clusters normally use
`replay<CLUSTER>.valve.net`. The builder follows this OpenDota mapping and keeps
the other domain as a download fallback.
Valve replay URLs may retain the `.bz2` suffix while serving either legacy
bzip2 or newer Zstandard data; the builder detects the actual format from its
file header. Zstandard replays use the Python `zstandard` package when present,
with `zstd` or 7-Zip as command-line fallbacks. Neither replay file is deleted
automatically. A replay that cannot be parsed is
recorded in `errors.json`; the builder continues with all later matches. After
each newly parsed replay, `data.js` is atomically rebuilt from every successful
checkpoint available so far, allowing the site to publish partial live-event
results while later replays are still processing. For leagues whose OpenDota
name contains `The International 20xx`, every successfully parsed map is
published immediately. An unfinished BO2/BO3/BO5 is kept under the same series
ID, so the page calculates its current score from the maps available so far and
automatically incorporates later maps as their replays are parsed. TI output is
separated into `stages/group-stage/{full,summary}.json` and
`stages/playoffs/{full,summary}.json`; the root `data.js` exposes both stages to
the page. Before playoff data exists, both page-stage buttons use the group-stage
data available so far. Once playoff data is available, each button uses its
matching stage snapshot. A cached-only run refreshes the files once after all
checkpoints are loaded.

### Parse and preview one match locally

To download and parse only one match from a league, pass both IDs. `--match-id`
may be repeated when several specific matches are needed:

```powershell
python scripts/build_league.py --league-id 20009 --match-id 8920584549
```

The requested match must belong to that league's OpenDota manifest. The
builder downloads/parses only the requested match, but also includes any valid
checkpoints already present under `data/<LEAGUE_ID>/matches/` when rebuilding
the browser data. Add `--force` to reparse an existing selected checkpoint.

For unattended incremental updates, add `--update-only`. The builder first
compares the current OpenDota manifest with the saved, validated checkpoints.
If nothing is pending, it exits without rewriting `manifest.json`, timestamps,
summaries, or browser data. Otherwise it downloads/parses only missing or
invalid checkpoints and rebuilds the published dataset from those plus all
existing valid checkpoints:

```powershell
python scripts/build_league.py --league-id 19719 --update-only
```

Serve the repository directory locally:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/` and select the generated league from the
tournament dropdown. A specific league can also be opened directly with
`?league=<LEAGUE_ID>`, for example
`http://localhost:8000/?league=20009`. For a replay file that has already been
downloaded and only needs low-level parser inspection, use either its `.dem`
or `.dem.bz2` path directly; the parsed JSON is printed to the terminal:

```powershell
python scripts/replay_tools.py --replay "replays\20009\8920584549_1216060693.dem.bz2"
```

Most Fantasy counters are stored together in each replay under
`CDOTA_DataRadiant/Dire.m_vecDataTeam[*]`. Kills, deaths, teamfight
participation and first blood are in the corresponding
`CDOTA_PlayerResource.m_vecPlayerTeamData[*]` rows. GPM is calculated from
`m_iTotalEarnedGold` and the precise difference between the replay's game end
and start times; rounded post-match GPM and remote stat fallbacks are not used.
In particular, Tormentor kills use the official per-player `m_iTormentorKills`
participation counter, not OpenDota's last-hit-only
`killed.npc_dota_miniboss` value.

The browser supports advisor prefix and suffix titles. Prefix hero categories
are maintained in `fantasy.js` from `heroids.txt`; suffix conditions are read
from each replay checkpoint. The default highest-map method scores every map,
averages the two players on a two-player banner within each map, sums the best
two maps in every series format, then keeps the best series. This temporary
forecast setting avoids inflating finalists from any selected pre-TI
prediction event; the Bo5 three-map rule remains behind
`enableTiBestOfFiveScoring` in `fantasy.js`.
**All-Map Average ×2**
is an optional comparison method that averages every valid map in the full
scoring period and doubles the result without selecting a best series.

The multiplier switch below the stage selector can replace quality and trait
effects with a manually entered percentage for every emblem. Manual mode hides
the quality/trait rows and uses only those percentages. The selected mode and
each stage's manual multiplier values are stored in `localStorage` together
with the rest of the page configuration.

Each match checkpoint also records every player's selected `heroId` and
`heroName`, win/loss result, first-blood time, Tormentor-death evidence, and
fountain-region death evidence. `isOwnFountain` distinguishes a death in the
player's own fountain from a death in the enemy fountain. Derived suffix/title
conditions are stored in `match.titleConditions`; the original event rows stay
in `match.titleData` for later verification. Per-map `replayCounters` preserves
both `m_nAcquiredMadstone` and `m_iNeutralTokensFound`. Fantasy scoring uses
`m_iNeutralTokensFound`; `m_nAcquiredMadstone` remains available for
comparison. Roles are inferred from event-wide creep-score ordering: the two
lowest farmers are supports and the middle of the remaining three is mid.
The current roster and all manual corrections are stored globally by account
ID in `PLAYER_ROLE_OVERRIDES` near the top of `scripts/build_league.py`; unknown
players still use replay-only inference. `EXCLUDED_TEAM_NAMES` globally removes
teams from selection and rankings without removing their opponents' scores.
Checkpoints made with schema 7 or older are
automatically treated as stale and reparsed on the next build.

## Automated TI 2026 Live Updates

`.github/workflows/update-ti-data.yml` runs from **August 13 through August 16,
2026**, every 15 minutes from **10:30 through 22:00 (UTC+8)**. GitHub cron is
defined in UTC and cannot express a year, so the workflow also checks the local
Shanghai date before doing any work. It can be run at any time from the
repository's **Actions** tab with **Run workflow**.

The job uses `--update-only`, caches the Clarity parser dependencies, and
serializes runs so two replay parsers cannot overlap. It creates a commit only
after at least one match checkpoint was added or repaired; replay-download
failures and checks with no new match do not create timestamp-only commits.
After a real update, the same workflow deploys the resulting revision to
GitHub Pages. A manual run also deploys the current revision, which is useful
for the first setup.

Before the first run, open the repository's **Settings → Pages** and set
**Source** to **GitHub Actions**. The workflow grants its temporary
`GITHUB_TOKEN` only the repository and Pages permissions needed by each job.
No personal access token or stored OpenDota secret is required. If `main` has a
branch rule that forbids Actions from pushing, that rule must separately allow
the workflow's live-data commits.

Every generated league appears automatically in the tournament dropdown. Its
name is resolved from OpenDota and stored both in the league dataset and the
generated `data/leagues.js` catalog.

## Disclaimer

This is a free, open-source, non-commercial fan project and is not affiliated with Valve, Steam, or Dota 2.

It uses Dota 2 / Valve-derived images, fonts, names, and UI materials. Those materials remain the property of Valve and their respective rights holders; this project's open-source license does not grant rights to them.

Official deployment website uses third-party visit counters. The public counter value can be viewed [here](https://www.busuanzi.cc/count.php?search=www.ti-fantasy.site).

## License

Original source code and documentation in this repository are released under the [MIT License](LICENSE). Third-party trademarks, game files, images, fonts, and other assets are excluded.
