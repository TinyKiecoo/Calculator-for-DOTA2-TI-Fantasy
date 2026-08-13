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

## Disclaimer

This is a free, open-source, non-commercial fan project and is not affiliated with Valve, Steam, or Dota 2.

It uses Dota 2 / Valve-derived images, fonts, names, and UI materials. Those materials remain the property of Valve and their respective rights holders; this project's open-source license does not grant rights to them.

Official deployment website uses third-party visit counters. The public counter value can be viewed [here](https://www.busuanzi.cc/count.php?search=www.ti-fantasy.site).

## License

Original source code and documentation in this repository are released under the [MIT License](LICENSE). Third-party trademarks, game files, images, fonts, and other assets are excluded.
