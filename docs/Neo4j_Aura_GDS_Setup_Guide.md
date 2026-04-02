# Neo4j Aura + Graph Data Science (GDS) setup guide

This guide is for operators who need **Graph Analytics / GDS** on **Neo4j Aura** so Dorkinians features that depend on graph algorithms (e.g. **Squad Backbone**, PageRank / Louvain–backed fields on `Player`) can populate after seeding.

**Scope:** AuraDB instance used by `database-dorkinians` and `V3-Dorkinians-Website`.  
**Out of scope:** Editing `.env` or committing secrets-use your secret manager / Netlify env UI locally.

---

## 1. Prerequisites

- **Aura Professional** (or tier that supports **Graph Analytics**). Free / entry tiers often **do not** include GDS.
- Aura console access to create instances, download connection URIs, and reset credentials.
- Completed understanding of **graph label** / database name used by the app (`neo4jService.getGraphLabel()` in the website matches the seeded `graphLabel` in Neo4j).

---

## 2. Create or upgrade the Aura instance

1. In [Neo4j Aura](https://neo4j.com/cloud/aura/), create an **AuraDB** instance (or open an existing one).
2. Confirm **Graph Analytics** (GDS) is **enabled** for that instance (Aura UI typically shows this under instance capabilities / add-ons). If the toggle is missing, the tier may not support GDS-upgrade or create a Professional instance.
3. Note the **Neo4j URI** (`neo4j+s://....databases.neo4j.io`), **username** (often `neo4j`), and **password** (generate and store securely).

---

## 3. Wire credentials for the website and seeding scripts

1. **Website (`V3-Dorkinians-Website`):** Set the same variables your project already uses for Neo4j (URI, user, password, and any graph-label / database name variable). Do **not** commit `.env`.
2. **`database-dorkinians`:** Point its Neo4j config at the same Aura instance so seeds and `relationshipManager` graph insight passes run against the DB that the site queries.

After any credential change, restart local dev servers and re-run connectivity checks.

---

## 4. Verify GDS from Neo4j Browser or cypher-shell

1. Open **Neo4j Browser** (linked from Aura) or connect with `cypher-shell` using the Aura URI.
2. Run a minimal GDS presence check (exact procedure names can vary by GDS version; if these fail, use Aura docs for your version):

```cypher
RETURN gds.version() AS version;
```

If this errors with “procedure not found” or similar, GDS is not installed/enabled on that instance.

3. Optional: list graph projections (after seeding has created them, if your pipeline uses named graphs):

```cypher
CALL gds.graph.list() YIELD graphName RETURN graphName;
```

---

## 5. Full reseed sequence (after GDS is available)

Graph insight features (`graphInsightsComputation.js`, GDS-backed ranks) expect **data + relationships** to exist before algorithms run.

1. Pull latest `database-dorkinians` and `V3-Dorkinians-Website`.
2. Run your normal **full seed** / foundation pipeline (orchestrator that ends with `applyFoundationDerivedAggregates` and graph insight steps). Typical order is documented in `FEATURES-MASTER-STATUS.md` under **Feature 7** and foundation sections.
3. Confirm `Player` nodes have expected graph fields (e.g. `squadInfluence`, `squadInfluenceRank`, `communityId` when Louvain is used)-either in Browser or via a small `MATCH (p:Player) RETURN p LIMIT 1` inspection.

---

## 6. Website-side verification

1. With env vars set, start the site (`npm run dev`).
2. Open **Club Stats → Squad Backbone** (or equivalent). If GDS data exists, the list should populate; if empty, the UI should explain missing GDS / empty graph.
3. Optional: hit internal APIs that read graph-backed fields and confirm non-null payloads on a known player.

---

## 7. Troubleshooting

| Symptom | Likely cause | Action |
| ------- | ------------ | ------ |
| `gds.*` procedures missing | Tier without GDS / Graph Analytics off | Enable on Aura or upgrade tier |
| Empty Squad Backbone after seed | GDS step skipped or failed in logs | Re-run seed; check `database-dorkinians` logs for graph insight errors |
| Auth / TLS errors from app | Wrong URI, password, or IP allowlist | Re-copy Aura URI; reset password; check Aura network access |
| Stale ranks after new season | Old projection or cached aggregates | Full reseed; confirm orchestrator runs graph recompute |

---

## 8. Related code touchpoints (for developers)

- **DB:** `database-dorkinians/services/graphInsightsComputation.js` (and callers from `relationshipManager` / orchestrator).
- **Site:** `app/api/club-squad-backbone/route.ts`, Club Stats UI consuming backbone data.
- **Status / spec:** `FEATURES-MASTER-STATUS.md` (Feature 7, graph insights, Squad Backbone).

---

*Last updated: 2026-03-31 - align with your Aura console if Neo4j renames “Graph Analytics” or GDS entry points.*
