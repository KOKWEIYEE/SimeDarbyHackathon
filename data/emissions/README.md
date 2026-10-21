# Transport emissions reference scenario

Source: UK Department for Energy Security and Net Zero, 2026 full-set greenhouse gas conversion factors, downloaded 2026-10-21.

- Publication: https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026
- Workbook: https://assets.publishing.service.gov.uk/media/6a29392bade52dc0882218a8/ghg-conversion-factors-2026-full-set.xlsx
- Local original: `uk-2026-full.xlsx`
- License: Open Government Licence v3.0; UK Crown copyright.
- Runtime extract: `src/features/sustainability/factors.json`, including workbook SHA-256 and exact source cells.

| Factor | Sheet / cell | Value | Unit |
| --- | --- | --- | --- |
| 100% mineral petrol | Fuels / D100 | 2.35372 | kgCO2e/litre |
| Average local bus | Business travel- land / D81 | 0.10151 | kgCO2e/passenger-km |
| National rail | Business travel- land / D87 | 0.03092 | kgCO2e/passenger-km |
| Light rail and tram | Business travel- land / D89 | 0.02121 | kgCO2e/passenger-km |
| London Underground | Business travel- land / D90 | 0.01549 | kgCO2e/passenger-km |

These are UK reference factors, NOT measured Malaysian operator factors. The user must opt into the reference scenario. UK electricity, occupancy and fleet assumptions can produce significantly different rankings from Malaysian data. This is not suitable as a local certified carbon inventory.

The comparison includes operational combustion and traction electricity generation, not full lifecycle impacts; upstream fuel supply, electricity transmission/distribution losses, vehicles, infrastructure and food are excluded. Human-powered walking/cycling have zero vehicle operational emissions within this limited boundary.

Transit factors map Google vehicle enums to reference categories: BUS/INTERCITY_BUS -> average local bus (an approximation, not a coach-specific factor); SUBWAY/METRO_RAIL -> London Underground; LIGHT_RAIL/TRAM/MONORAIL -> light rail and tram; HEAVY_RAIL/COMMUTER_TRAIN -> national rail. The UI shows the actual returned line and mapped reference. Google may classify an LRT line as SUBWAY; the mapping is by provider category, not independently verified Malaysian technology. Unknown vehicle types and missing motorised segment distances block the entire transit total. Walking segments are not charged the transit factor. Passenger-km factors already incorporate average occupancy; do not divide by the user's car occupancy.

For a Malaysian estimate, replace these with compatible sourced local operator passenger-km factors and the relevant fuel blend, preserving the same reporting boundary and year. No rainfall, ICE materials or construction rates are needed for this travel module.

## Malaysian data integration (21 October 2026)

Downloaded official sources:

- `malaysia-grid-2024-provisional.pdf`: Energy Commission Malaysia, Grid Emission Factor 2022-2024 (Provisional), published 23 February 2026. Page 1 gives 2024 Peninsular 0.740, Sabah 0.539, Sarawak 0.199 GgCO2e/GWh. The numerical values are identical in kgCO2e/kWh. Runtime metadata: `src/features/sustainability/malaysia-grid.json`.
- `prasarana-2024-2025.pdf`: https://www.prasarana.com.my/wp-content/uploads/2026/07/PMB-Sustainability-Report-2024-2025.pdf. PDF spread 24 (printed pages 44-45) discloses group energy/emissions and explains that Scope 1/selected Scope 3 factors use UK conversion factors while Scope 2 uses Malaysian Energy Commission factors. It does not provide sufficient matched route-level energy and passenger-km data here to replace transit factors. Group totals are NOT divided by ridership or assigned to individual lines.

The electric-car scenario uses official Malaysian grid factors and user-entered charging electricity per 100 km (including charging losses). It reuses the actual driving route; it is not an EV charging-stop route. Calculation: km * kWh/100 km / 100 * regional kgCO2e/kWh / occupants. Default charging region is Peninsular for the KL pilot, explicitly selectable. No default vehicle efficiency is invented. Generation factor excludes grid losses and upstream/lifecycle impacts. This is a grid-based scenario, not a full footprint or local EV measurement.

Petrol and transit still use opt-in UK reference factors. Comparisons with EV are labelled mixed-source, not wholly Malaysian. The existing raw EPA helper is unrelated to this integration.
