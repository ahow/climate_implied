# Regional native-gas coupling — 9 November 2026

**Latest execution:** [Minor-gas history sensitivities](Minor_Gas_History_Sensitivity.md)
now demonstrate end-to-end coupling with three explicit assumed-history controls,
841 members each. This is not a calibrated or accepted dashboard forecast.

**Update:** [Additional species implementation](Additional_FaIR_Species.md)
now supplies final-AR6 physical parameters and passes real FaIR pulse controls
for the three gases. Explicit historical emissions remain required. The
coverage failure described below is the original result, not a claim that
the species can never be modelled.

The regional member stream now has a strict converter into the existing FaIR
bridge. It verifies the archived stream hash and completed-run marker, rejects
duplicate/missing member identities, requires all 77 years and every inventory
gas, and reconciles fossil and land-use CO2 without replacing signed land sinks.
It never converts aggregate CO2e to CO2.

The actual retained member `m00000` from the regional constant-input accounting
control converted successfully: 27 native gas pathways for 2024–2100.
This member is a control, not a calibrated future scenario.

The ensuing real FaIR run failed its native-species coverage check:
**HFC-134, HFC-143 and HFC-41** are absent from both the pinned emissions template
and the package's default species list. HFC-134a and HFC-143a are different
chemicals and must not be substituted. No temperature was produced.

Candidate runs now require a new private output directory, preventing them
from overwriting the retained upstream reference. A failed coverage run records
all missing species, immutable upstream input hashes and the pathway hash.

```
uv run python script/regional_fair_pathway.py \
  generated-artifacts/regional-control-run/members.jsonl.gz m00000 \
  generated-artifacts/regional-fair-control-pathway.json
uv run python script/fair-reference.py \
  --pathway generated-artifacts/regional-fair-control-pathway.json \
  --output-directory generated-artifacts/regional-fair-coverage-check
```

Outputs refuse reuse of an existing path/directory. Supply a new path for a
new run; retained results are not overwritten.

Completion requires sourced species-specific radiative efficiencies, lifetimes
and other FaIR configuration parameters, or an explicitly justified and tested
forcing treatment. Inventing parameters, dropping gases, GWP conversion or
isomer substitution is not an accepted repair. Calibrated regional parameters,
the 10,000-member experiment, historical forcing reconciliation and independent
climate validation remain additional requirements.
