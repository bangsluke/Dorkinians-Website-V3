const assert = require("assert");
const { EmailService } = require("../../netlify/functions/lib/services/emailService");

function run() {
	const emailService = new EmailService();

	const relationshipQuery = emailService.getFailureCypherFromSummary({
		errors: ["relationshipCreation failed while creating PLAYED_IN links"],
	});
	assert(
		relationshipQuery && relationshipQuery.includes("MATCH (md:MatchDetail)"),
		"Expected relationship error context to map to a PLAYED_IN diagnostic query"
	);

	const missingFieldQuery = emailService.getFailureCypherFromSummary({
		errors: ["Missing required node identifier during nodeCreation"],
	});
	assert(
		missingFieldQuery && missingFieldQuery.includes("n.id IS NULL"),
		"Expected missing/required node context to map to missing-id query"
	);

	const lowConfidence = emailService.getFailureCypherFromSummary({
		errors: ["Temporary remote timeout while sending webhook callback"],
	});
	assert.strictEqual(
		lowConfidence,
		null,
		"Expected low-confidence context to avoid emitting an unrelated Cypher query"
	);

	console.log("✅ Seeding email Cypher mapping tests passed");
}

try {
	run();
} catch (error) {
	console.error("❌ Seeding email Cypher mapping tests failed:", error);
	process.exitCode = 1;
}

