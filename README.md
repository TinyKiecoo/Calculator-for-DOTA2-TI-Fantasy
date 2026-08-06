<p align="center">
  <img src="fantasy-assets/ti26_logo_png.png" width="96">
</p>

<h1 align="center">Calculator for DOTA 2 TI Fantasy</h1>

<p align="center">
  An open-source calculator for Dota 2 TI Fantasy predictions.
  <br>
  Using data from <strong>Esports World Cup 2026</strong> to predict the Fantasy Score of <strong>TI 2026</strong>.
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

## Repository Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Application and GitHub Pages entry point |
| `fantasy-assets/` | Local images, fonts, and other interface assets |
| `scripts/build_league.py` | Configurable league data pipeline |
| `scripts/league_data.py` | Replay-checkpoint dataset and roster-role assembler |
| `scripts/replay_tools.py` | Valve replay downloader and complete Clarity field parser |
| `data/<LEAGUE_ID>/` | Generated league metadata, match checkpoints, and browser snapshot |
| `tests/` | Verification and calculation tests |
| [`LICENSE`](LICENSE) | License for the original source code and documentation |

## Build Data for a League

Java/Javac 17 or newer and Python 3.10 or newer are required. First find the
OpenDota league ID if it is not known:

```powershell
python scripts/build_league.py --find-league "Esports World Cup 2026"
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
The output is stored under `data/<LEAGUE_ID>/`.
Every completed match has its own `matches/<MATCH_ID>.json` checkpoint. A
rerun validates and prints those saved player stats without downloading or
parsing the replay again. Compressed and decompressed replay files are kept in
`replays/<LEAGUE_ID>/`. An existing `.dem` is parsed directly; otherwise an
existing `.dem.bz2` is decompressed, and only a missing replay is downloaded.
Valve replay URLs may retain the `.bz2` suffix while serving either legacy
bzip2 or newer Zstandard data; the builder detects the actual format from its
file header. Zstandard replays use the Python `zstandard` package when present,
with `zstd` or 7-Zip as command-line fallbacks. Neither replay file is deleted
automatically. A replay that cannot be parsed is
recorded in `errors.json`; the builder continues with all later matches. After
each newly parsed replay, `data.js` is atomically rebuilt from every successful
checkpoint available so far, allowing the site to publish partial live-event
results while later replays are still processing. A cached-only run refreshes
the file once after all checkpoints are loaded.

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

Set the same `LEAGUE_ID` in the data-loader block near the bottom of
`index.html`, then serve the repository directory locally:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/` to preview the generated data. For a replay file
that has already been downloaded and only needs low-level parser inspection,
use either its `.dem` or `.dem.bz2` path directly; the parsed JSON is printed to
the terminal:

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
forecast setting avoids inflating EWC 2026 finalists before TI begins; the Bo5
three-map rule remains behind `enableTiBestOfFiveScoring` in `fantasy.js`.
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

To display another generated league, set the same `LEAGUE_ID` in the
data-loader block near the bottom of `index.html`. The league name is stored in
the generated dataset after being resolved from OpenDota.

## Disclaimer

This is a free, open-source, non-commercial fan project and is not affiliated with Valve, Steam, or Dota 2.

It uses Dota 2 / Valve-derived images, fonts, names, and UI materials. Those materials remain the property of Valve and their respective rights holders; this project's open-source license does not grant rights to them.

Official deployment website uses third-party visit counters. The public counter value can be viewed [here](https://www.busuanzi.cc/count.php?search=www.ti-fantasy.site).

## License

Original source code and documentation in this repository are released under the [MIT License](LICENSE). Third-party trademarks, game files, images, fonts, and other assets are excluded.
