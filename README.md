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
| `scripts/league_data.py` | OpenDota base-stat and roster-role builder |
| `scripts/replay_tools.py` | Valve replay downloader and Clarity field parser |
| `data/<LEAGUE_ID>/` | Generated league metadata, match checkpoints, and browser snapshot |
| `tests/` | Verification and calculation tests |
| [`LICENSE`](LICENSE) | License for the original source code and documentation |

## Build Data for a League

Java/Javac 17 or newer and Python 3.10 or newer are required. First find the
OpenDota league ID if it is not known:

```powershell
python scripts/build_league.py --find-league "Esports World Cup 2026"
```

Then edit `LEAGUE_ID`, `LEAGUE_NAME`, and `LIQUIPEDIA_URL` near the top of
`scripts/build_league.py` and run:

```powershell
python scripts/build_league.py
```

The Liquipedia URL does not contain OpenDota's league ID, so the ID search is
the reliable lookup method. The output is stored under `data/<LEAGUE_ID>/`.
Every completed match has its own `matches/<MATCH_ID>.json` checkpoint. A
rerun validates and prints those saved player stats without downloading or
parsing the replay again. New compressed and decompressed replay files are
created in a temporary directory and removed immediately after that match is
written.

To display another generated league, set the same `LEAGUE_ID` and
`LEAGUE_NAME` in the data-loader block near the bottom of `index.html`.

## Disclaimer

This is a free, open-source, non-commercial fan project and is not affiliated with Valve, Steam, or Dota 2.

It uses Dota 2 / Valve-derived images, fonts, names, and UI materials. Those materials remain the property of Valve and their respective rights holders; this project's open-source license does not grant rights to them.

Official deployment website uses third-party visit counters. The public counter value can be viewed [here](https://www.busuanzi.cc/count.php?search=www.ti-fantasy.site).

## License

Original source code and documentation in this repository are released under the [MIT License](LICENSE). Third-party trademarks, game files, images, fonts, and other assets are excluded.
