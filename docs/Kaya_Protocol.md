# Historical Kaya decomposition protocol

This is a fixed accounting protocol, not a preregistered causal study or a
forecast validation. Source metadata were inspected before writing it.

Use the frozen OWID CO2 repository revision
`382ee6c662b0ece26e111f263b44c029afad7787`, its CSV and codebook, with hashes
checked by the executable. Do not splice the replacement energy catalog.
Sources: Global Carbon Budget 2025; Maddison Project 2023; OWID population;
EI 2025 and EIA 2026. GDP is PPP, constant 2011 international dollars, not
nominal dollars. CO2 excludes land-use change; it is not all-GHG CO2e.
Energy is the primary-energy series in this release, not an interchangeable
total-energy-supply series. CO2 includes non-energy industrial emissions,
so CO2/energy is an accounting ratio, not a pure fuel emission factor.

Evaluate 2010–2018 and 2019–2024 separately for World, China, India, US, EU27,
Rest of World and International transport. Require every annual observation
of population, GDP, primary energy and CO2. Missing windows are unavailable:
no interpolation, zero filling, shortened windows or invented regional GDP.
International transport has no natural population/GDP account; unavailability
is preferable to attaching the world population arbitrarily.

Identity: C = P × (GDP/P) × (E/GDP) × (C/E).
Use additive logarithmic-mean Divisia decomposition (LMDI):
contribution i = L(C1,C0) × log(factor_i1/factor_i0).
For equal C, L=C. Check contributions reconcile at 1e-9 relative tolerance.
Report endpoint and chained annual decompositions separately; individual
factor allocations need not match between those two definitions.

No causal interpretation, policy-delivery coefficient, uncertainty estimate,
future growth rate, or central-model promotion follows from this identity.
The carbon-intensity term is constructed from emissions; using it to
“predict” the same observed emissions would be circular. Statistical fit and
short-horizon skill require separately estimated, out-of-sample factors.

Raw files remain private/ignored. OWID-produced data are CC BY; underlying
third-party terms remain applicable. Attribute all sources; this report does
not assert a blanket redistribution licence for the underlying data.
