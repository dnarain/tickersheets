# Credits and license

## CacheFinance

TickerSheets started with [CacheFinance](https://github.com/demmings/cachefinance), created and shared by its author and contributors.
We thank them for publishing code that we could learn from, run and extend.
Their work showed us what was possible in Google Sheets and gave this project its starting point.

For our research, we found the data available through `GOOGLEFINANCE` too limited. We developed additional provider requests, calculations and worksheet functions.

The current TickerSheets distribution contains its own function library and supported provider requests.
The original project remains available at [demmings/cachefinance](https://github.com/demmings/cachefinance) for people who want to use it separately.
We appreciate its contribution and retain attribution for the work from which TickerSheets developed.

## SMF

We also drew ideas from [SMF (Stock Market Functions)](https://github.com/ClimberMel/SMF_Add-in), its financial functions and its Excel example workbooks.
Its [documentation](https://climbermel.github.io/SMF_Add-in/) helped guide the provider fields, RSI targets and examples explored in this project.
We thank the original SMF authors, maintainers and contributors for sharing that work.

## License

TickerSheets retains the [GNU General Public License, version 3](LICENSE).
The license applies to the distributed code, including work derived from earlier contributions.
Renaming the project and its functions does not remove the original contributions or their license requirements.

## Data providers

Yahoo, Finviz, Zacks, GuruFocus and FRED supply the data requested by the supported functions.
These services do not maintain or endorse TickerSheets.
Their data definitions, access restrictions and availability can change.
See [PROVIDERS.md](PROVIDERS.md) for the sources this project uses.
