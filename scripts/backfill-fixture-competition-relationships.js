const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function backfillFixtureCompetitionRels() {
	console.log('🔧 Backfilling Fixture→IN_COMPETITION→Competition relationships...')

	const uri = process.env.DEV_NEO4J_URI
	const username = process.env.DEV_NEO4J_USER
	const password = process.env.DEV_NEO4J_PASSWORD

	if (!uri || !username || !password) {
		console.error('❌ Missing Neo4j environment variables')
		process.exit(1)
	}

	const driver = neo4j.driver(uri, neo4j.auth.basic(username, password))
	const session = driver.session()

	try {
		console.log('🔗 Connected to Neo4j')

		// Count fixtures eligible for relationships
		const countResult = await session.run(`
			MATCH (f:Fixture {graphLabel: 'dorkiniansWebsite'})
			WHERE f.competition IS NOT NULL AND f.competition <> '-'
			RETURN count(f) AS fixtures
		`)
		const fixtures = countResult.records[0].get('fixtures').toNumber ? countResult.records[0].get('fixtures').toNumber() : countResult.records[0].get('fixtures')
		console.log(`📋 Fixtures with competition: ${fixtures}`)

		// Backfill relationships in bulk
		const relResult = await session.run(`
			MATCH (f:Fixture {graphLabel: 'dorkiniansWebsite'})
			WHERE f.competition IS NOT NULL AND f.competition <> '-'
			WITH f, toLower(replace(f.competition, ' ', '-')) AS slug
			MERGE (c:Competition {id: 'competition-' + slug, graphLabel: 'dorkiniansWebsite'})
			ON CREATE SET c.name = f.competition, c.createdAt = datetime()
			MERGE (f)-[r:IN_COMPETITION {graphLabel: 'dorkiniansWebsite'}]->(c)
			ON CREATE SET r.createdAt = datetime()
			RETURN count(r) AS rels
		`)
		const rels = relResult.records[0]?.get('rels')
		const relCount = rels?.toNumber ? rels.toNumber() : rels
		console.log(`✅ Relationships ensured: ${relCount}`)

		// Sample check
		const sample = await session.run(`
			MATCH (f:Fixture {graphLabel: 'dorkiniansWebsite'})-[r:IN_COMPETITION]->(c:Competition {graphLabel: 'dorkiniansWebsite'})
			RETURN f.id AS fixtureId, type(r) AS relType, c.name AS competition
			LIMIT 5
		`)
		if (sample.records.length > 0) {
			console.log('🔎 Sample relationships:')
			sample.records.forEach((rec, i) => {
				console.log(`  ${i + 1}. ${rec.get('fixtureId')} -[${rec.get('relType')}]-> ${rec.get('competition')}`)
			})
		} else {
			console.log('⚠️ No sample relationships found (unexpected)')
		}
	} catch (err) {
		console.error('💥 Backfill failed:', err.message)
		process.exit(1)
	} finally {
		await session.close()
		await driver.close()
	}
}

backfillFixtureCompetitionRels()
