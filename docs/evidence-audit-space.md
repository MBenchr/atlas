# Evidence / Audit Space Contract (ATLAS-14)

Ticket:
- `MBE-1104`

Objective:
- isolate raw proof and audit artifacts from first-pass decision views
- keep evidence available through a dedicated P4 space with deep links from alerts/domains

Canonical reads:
- `data/atlas-data.json`
- `data/atlas-history.json`
- `data/history/atlas-audit-index.json`
- referenced proof files from alert/domain drill-down

Consumer:
- Atlas `evidence` view only

Required capabilities:
- detailed checks (freshness, alert completeness, snapshot coverage, projection coverage)
- exhaustive artifact inventory
- search/filter by `type/domain/source/search text`
- JSON export links per artifact
- raw snapshot listing (recent)
- contextual deep-link banner when opened from alert/domain

Rules:
- no business decision recomputation in the evidence view
- keep cockpit decision views concise; evidence belongs to P4
- maintain traceability (`proofLink`, `sourceFile`, `sourcePath`) for alert artifacts

Proof:
- `npm run generate:audit`
- `npm run check`
