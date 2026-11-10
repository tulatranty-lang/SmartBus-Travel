# SmartBus traffic pilot

This pipeline prepares a small Da Nang corridor and exports deterministic IDM
replays for the integrated React page at `/#/simulation`. It is not a surveyed
route or live vehicle telemetry. Original source GPS is not modified.

See [the integrated release](../../docs/current/SIMULATION_RELEASE.md) for the
current 8 m family-reference vehicle, passenger/weather scenarios and validation
limits. The earlier research remains a historical 12 m prototype baseline.

See [research and limitations](../../docs/current/TRAFFIC_DETAIL_RESEARCH.md) and
[third party notices](THIRD_PARTY_NOTICES.md).

With the source cache at `.artifacts/traffic-detail/danang-detail.osm.xml`:

```powershell
python simulation/preview/prepare-network.py
node simulation/preview/build-replay.cjs
python simulation/preview/check-clearance.py
```

If inspecting a local lateral correction, keep each generated version and review
the report. The correction uses inferred width envelopes and does not approve a
legal lane or a real curb:

```powershell
python simulation/preview/refine-clearance.py
node simulation/preview/build-replay.cjs
python simulation/preview/check-clearance.py
node --test simulation/preview/traffic-model.test.cjs
python simulation/preview/pack-preview.py
```

For the integrated release, generate all scenarios and clearance reports before
exporting the public bundle:

```powershell
node simulation/preview/build-replay.cjs --scenario=normal
node simulation/preview/build-replay.cjs --scenario=busy
node simulation/preview/build-replay.cjs --scenario=rain
python simulation/preview/check-clearance.py --scenario=normal
python simulation/preview/check-clearance.py --scenario=busy
python simulation/preview/check-clearance.py --scenario=rain
python simulation/preview/pack-preview.py
node simulation/preview/export-site.cjs
npm run test:simulation
npm run build
```

Stop-line and following guards are reported separately. The current swept-body
check still identifies a corner requiring review. A passing model test does not
approve that geometry. Signal programs, lane width defaults and the boarding
stop are scenario assumptions. Native SUMO has not run successfully on this host.
