# Shared Malaysia service coverage

Canonical frontend dataset: `app/src/data/malaysia.json`. Version: `dosm-census-2020-v1`.

Source: Department of Statistics Malaysia, `dosm-malaysia/data-open`, `datasets/census/census_district.csv`, source blob SHA `616115279d0ce24f74bb35f7e1ac88d391199aca`, retrieved 25 October 2026. Extracted unique state/district names and numeric codes, without population or personal data. IDs are SL identifiers derived from DOSM codes: `my-07` for Pulau Pinang; `my-07-04` for Timur Laut. IDs are stable keys, not user-entered names.

16 states/territories and 160 district/territory entries are included. Perlis and the federal territories have one territory-wide entry rather than invented/overlapping neighborhoods. The public DOSM catalogue also describes 160 administrative district/territory entries. This is a frozen administrative taxonomy, not a claim that every current local service zone or administrative boundary change is represented. Add custom zones only with a reviewed, non-overlapping definition and versioned migration.

Provider coverage selection, search matching, public labels and comparison all import the same dataset through `lib/geography.ts`. A whole-state entry has an empty subdivision list; selected-area entries must contain valid subdivisions from that state. Multiple states are supported. A whole-state provider matches every subdivision query in that state. A whole-state customer search includes providers serving any of its subdivisions. Unknown or cross-state subdivision IDs do not match. Base/city text is display-only and does not drive discovery.

The SQL geography seed is generated from this JSON. The database test asserts exact parity. When updating the dataset, add a new migration, retain stable IDs or explicitly map retired IDs, regenerate the seed, and test provider selection/search/comparison. Do not maintain a second hand-edited list.

Source attribution: Department of Statistics Malaysia (DOSM), OpenDOSM/data.gov.my. The public data catalogue states CC BY 4.0: https://data.gov.my/data-catalogue/population_district . License: https://creativecommons.org/licenses/by/4.0/ . Changes made: deduplication, ID formatting, extraction into JSON and SQL seed. Source repository: https://github.com/dosm-malaysia/data-open .
