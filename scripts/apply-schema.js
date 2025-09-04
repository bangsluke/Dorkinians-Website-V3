const neo4j = require("neo4j-driver");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function applySchema() {
	console.log("🏗️ Applying Neo4j Database Schema...");

	// Get environment variables
	// All environments now use Neo4j Aura
	const uri = process.env.PROD_NEO4J_URI;
	const username = process.env.PROD_NEO4J_USER;
	const password = process.env.PROD_NEO4J_PASSWORD;

	if (!uri || !username || !password) {
		console.error("❌ Missing Neo4j environment variables");
		return;
	}

	const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
	const session = driver.session();

	try {
		console.log("🔗 Connected to Neo4j database");

		// Apply constraints
		console.log("📋 Applying constraints...");

		const constraints = [
			"CREATE CONSTRAINT player_id_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE",
			"CREATE CONSTRAINT player_name_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.name IS UNIQUE",
			"CREATE CONSTRAINT team_id_unique IF NOT EXISTS FOR (t:Team) REQUIRE t.id IS UNIQUE",
			"CREATE CONSTRAINT team_season_name_unique IF NOT EXISTS FOR (t:Team) REQUIRE (t.season, t.name) IS UNIQUE",
			"CREATE CONSTRAINT season_id_unique IF NOT EXISTS FOR (s:Season) REQUIRE s.id IS UNIQUE",
			// Removed: 'CREATE CONSTRAINT season_years_unique IF NOT EXISTS FOR (s:Season) REQUIRE (s.startYear, s.endYear) IS UNIQUE',
			"CREATE CONSTRAINT fixture_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE f.id IS UNIQUE",
			"CREATE CONSTRAINT fixture_season_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE (f.season, f.seasonFixId) IS UNIQUE",
			"CREATE CONSTRAINT matchdetail_id_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE md.id IS UNIQUE",
			"CREATE CONSTRAINT matchdetail_fixture_player_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE (md.fixtureId, md.playerName) IS UNIQUE",
			"CREATE CONSTRAINT totw_id_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE t.id IS UNIQUE",
			"CREATE CONSTRAINT totw_season_week_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE (t.season, t.week) IS UNIQUE",
			"CREATE CONSTRAINT season_totw_id_unique IF NOT EXISTS FOR (st:SeasonTOTW) REQUIRE st.id IS UNIQUE",
			"CREATE CONSTRAINT season_totw_season_unique IF NOT EXISTS FOR (st:SeasonTOTW) REQUIRE st.season IS UNIQUE",
			"CREATE CONSTRAINT playerofmonth_id_unique IF NOT EXISTS FOR (pom:PlayerOfTheMonth) REQUIRE pom.id IS UNIQUE",
			"CREATE CONSTRAINT opposition_id_unique IF NOT EXISTS FOR (o:OppositionDetail) REQUIRE o.id IS UNIQUE",
			// Removed: 'CREATE CONSTRAINT opposition_name_unique IF NOT EXISTS FOR (o:OppositionDetail) REQUIRE o.oppositionName IS UNIQUE'
		];

		for (const constraint of constraints) {
			try {
				await session.run(constraint);
				console.log(`✅ Applied: ${constraint.split(" ")[2]}`);
			} catch (error) {
				if (error.message.includes("already exists")) {
					console.log(`ℹ️  Already exists: ${constraint.split(" ")[2]}`);
				} else {
					console.log(`⚠️  Constraint issue: ${constraint.split(" ")[2]} - ${error.message}`);
				}
			}
		}

		// Apply indexes
		console.log("📊 Applying indexes...");

		const indexes = [
			"CREATE INDEX player_name_index IF NOT EXISTS FOR (p:Player) ON (p.name)",
			"CREATE INDEX player_allowonsite_index IF NOT EXISTS FOR (p:Player) ON (p.allowOnSite)",
			"CREATE INDEX player_most_played_team_index IF NOT EXISTS FOR (p:Player) ON (p.mostPlayedForTeam)",
			"CREATE INDEX player_most_common_position_index IF NOT EXISTS FOR (p:Player) ON (p.mostCommonPosition)",
			"CREATE INDEX team_name_index IF NOT EXISTS FOR (t:Team) ON (t.name)",
			"CREATE INDEX team_season_index IF NOT EXISTS FOR (t:Team) ON (t.season)",
			"CREATE INDEX team_league_index IF NOT EXISTS FOR (t:Team) ON (t.league)",
			"CREATE INDEX season_startyear_index IF NOT EXISTS FOR (s:Season) ON (s.startYear)",
			"CREATE INDEX season_endyear_index IF NOT EXISTS FOR (s:Season) ON (s.endYear)",
			"CREATE INDEX season_active_index IF NOT EXISTS FOR (s:Season) ON (s.isActive)",
			"CREATE INDEX fixture_date_index IF NOT EXISTS FOR (f:Fixture) ON (f.date)",
			"CREATE INDEX fixture_season_index IF NOT EXISTS FOR (f:Fixture) ON (f.season)",
			"CREATE INDEX fixture_hometeam_index IF NOT EXISTS FOR (f:Fixture) ON (f.homeTeam)",
			"CREATE INDEX fixture_awayteam_index IF NOT EXISTS FOR (f:Fixture) ON (f.awayTeam)",
			"CREATE INDEX fixture_result_index IF NOT EXISTS FOR (f:Fixture) ON (f.result)",
			"CREATE INDEX fixture_competition_index IF NOT EXISTS FOR (f:Fixture) ON (f.competition)",
			"CREATE INDEX matchdetail_player_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.playerName)",
			"CREATE INDEX matchdetail_team_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.team)",
			"CREATE INDEX matchdetail_date_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.date)",
			"CREATE INDEX matchdetail_fixtureid_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.fixtureId)",
			"CREATE INDEX matchdetail_class_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.class)",
			"CREATE INDEX totw_season_index IF NOT EXISTS FOR (t:TOTW) ON (t.season)",
			"CREATE INDEX totw_week_index IF NOT EXISTS FOR (t:TOTW) ON (t.week)",
			"CREATE INDEX totw_starman_index IF NOT EXISTS FOR (t:TOTW) ON (t.starMan)",
			"CREATE INDEX totw_seasonweek_index IF NOT EXISTS FOR (t:TOTW) ON (t.seasonWeekNumRef)",
			"CREATE INDEX season_totw_season_index IF NOT EXISTS FOR (st:SeasonTOTW) ON (st.season)",
			"CREATE INDEX season_totw_starman_index IF NOT EXISTS FOR (st:SeasonTOTW) ON (st.starMan)",
			"CREATE INDEX playerofmonth_season_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.season)",
			"CREATE INDEX playerofmonth_month_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.month)",
			"CREATE INDEX playerofmonth_seasonmonth_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.seasonMonthRef)",
			"CREATE INDEX opposition_league_index IF NOT EXISTS FOR (o:OppositionDetail) ON (o.league)",
			"CREATE INDEX opposition_division_index IF NOT EXISTS FOR (o:OppositionDetail) ON (o.division)",
		];

		for (const index of indexes) {
			try {
				await session.run(index);
				console.log(`✅ Applied: ${index.split(" ")[2]}`);
			} catch (error) {
				if (error.message.includes("already exists")) {
					console.log(`ℹ️  Already exists: ${index.split(" ")[2]}`);
				} else {
					console.log(`⚠️  Index issue: ${index.split(" ")[2]} - ${error.message}`);
				}
			}
		}

		// Verify schema
		console.log("🔍 Verifying schema...");
		const constraintsResult = await session.run("SHOW CONSTRAINTS");
		const indexesResult = await session.run("SHOW INDEXES");

		console.log(`📋 Constraints: ${constraintsResult.records.length}`);
		console.log(`📊 Indexes: ${indexesResult.records.length}`);

		console.log("🎉 Schema application completed successfully!");
	} catch (error) {
		console.error("❌ Schema application failed:", error.message);
	} finally {
		await session.close();
		await driver.close();
	}
}

// Run the schema application
applySchema()
	.then(() => {
		console.log("✅ Schema application completed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Schema application failed:", error);
		process.exit(1);
	});
