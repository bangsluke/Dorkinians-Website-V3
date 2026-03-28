describe("Unit - isDevelopBranchDeploy", () => {
	const originalBranch = process.env.BRANCH;
	const originalVariant = process.env.NEXT_PUBLIC_SITE_VARIANT;

	afterEach(() => {
		process.env.BRANCH = originalBranch;
		process.env.NEXT_PUBLIC_SITE_VARIANT = originalVariant;
	});

	test("false when no develop signals", async () => {
		delete process.env.BRANCH;
		delete process.env.NEXT_PUBLIC_SITE_VARIANT;
		const { isDevelopBranchDeploy } = await import("@/lib/utils/isDevelopBranchDeploy");
		expect(isDevelopBranchDeploy()).toBe(false);
	});

	test("true when BRANCH is develop", async () => {
		process.env.BRANCH = "develop";
		delete process.env.NEXT_PUBLIC_SITE_VARIANT;
		const { isDevelopBranchDeploy } = await import("@/lib/utils/isDevelopBranchDeploy");
		expect(isDevelopBranchDeploy()).toBe(true);
	});

	test("true when NEXT_PUBLIC_SITE_VARIANT is develop", async () => {
		delete process.env.BRANCH;
		process.env.NEXT_PUBLIC_SITE_VARIANT = "develop";
		const { isDevelopBranchDeploy } = await import("@/lib/utils/isDevelopBranchDeploy");
		expect(isDevelopBranchDeploy()).toBe(true);
	});
});
