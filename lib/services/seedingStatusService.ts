/**
 * Seeding Status Service
 * Handles storage and retrieval of database seeding status information
 */

export interface SeedingStatus {
	lastSeedingTimestamp: string | null;
	lastSeedingJobId: string | null;
	lastSeedingStatus: "success" | "failed" | "running" | null;
	lastSeedingDuration: number | null;
	lastSeedingNodesCreated: number | null;
	lastSeedingRelationshipsCreated: number | null;
}

class SeedingStatusService {
	private readonly STORAGE_KEY = "dorkinians_seeding_status";

	/**
	 * Get the current seeding status from localStorage
	 */
	getSeedingStatus(): SeedingStatus {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY);
			if (stored) {
				return JSON.parse(stored);
			}
		} catch (error) {
			console.warn("Failed to parse seeding status from localStorage:", error);
		}

		return {
			lastSeedingTimestamp: null,
			lastSeedingJobId: null,
			lastSeedingStatus: null,
			lastSeedingDuration: null,
			lastSeedingNodesCreated: null,
			lastSeedingRelationshipsCreated: null,
		};
	}

	/**
	 * Update the seeding status with new information
	 */
	updateSeedingStatus(updates: Partial<SeedingStatus>): void {
		try {
			const currentStatus = this.getSeedingStatus();
			const updatedStatus = { ...currentStatus, ...updates };
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedStatus));
		} catch (error) {
			console.error("Failed to update seeding status:", error);
		}
	}

	/**
	 * Update seeding status when seeding completes successfully
	 */
	updateSeedingSuccess(data: {
		jobId: string;
		timestamp: string;
		duration: number;
		nodesCreated: number;
		relationshipsCreated: number;
	}): void {
		this.updateSeedingStatus({
			lastSeedingTimestamp: data.timestamp,
			lastSeedingJobId: data.jobId,
			lastSeedingStatus: "success",
			lastSeedingDuration: data.duration,
			lastSeedingNodesCreated: data.nodesCreated,
			lastSeedingRelationshipsCreated: data.relationshipsCreated,
		});
	}

	/**
	 * Update seeding status when seeding fails
	 */
	updateSeedingFailure(data: { jobId: string; timestamp: string; duration: number }): void {
		this.updateSeedingStatus({
			lastSeedingTimestamp: data.timestamp,
			lastSeedingJobId: data.jobId,
			lastSeedingStatus: "failed",
			lastSeedingDuration: data.duration,
		});
	}

	/**
	 * Update seeding status when seeding starts
	 */
	updateSeedingStart(data: { jobId: string; timestamp: string }): void {
		this.updateSeedingStatus({
			lastSeedingJobId: data.jobId,
			lastSeedingStatus: "running",
		});
	}

	/**
	 * Format timestamp for display
	 */
	formatTimestamp(timestamp: string | null): string {
		if (!timestamp) return "Never";

		try {
			const date = new Date(timestamp);
			return date.toLocaleString("en-GB", {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				timeZoneName: "short",
			});
		} catch (error) {
			console.warn("Failed to format timestamp:", error);
			return "Invalid date";
		}
	}

	/**
	 * Format duration for display
	 */
	formatDuration(duration: number | null): string {
		if (!duration) return "Unknown";

		const hours = Math.floor(duration / 3600);
		const minutes = Math.floor((duration % 3600) / 60);
		const seconds = Math.floor(duration % 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m ${seconds}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		} else {
			return `${seconds}s`;
		}
	}

	/**
	 * Get a human-readable status summary
	 */
	getStatusSummary(): string {
		const status = this.getSeedingStatus();

		if (!status.lastSeedingTimestamp) {
			return "Database has never been seeded";
		}

		const timestamp = this.formatTimestamp(status.lastSeedingTimestamp);
		const duration = this.formatDuration(status.lastSeedingDuration);

		switch (status.lastSeedingStatus) {
			case "success":
				return `Last seeded successfully on ${timestamp} (took ${duration})`;
			case "failed":
				return `Last seeding failed on ${timestamp} (took ${duration})`;
			case "running":
				return `Seeding in progress since ${timestamp}`;
			default:
				return `Last seeded on ${timestamp}`;
		}
	}
}

// Export singleton instance
export const seedingStatusService = new SeedingStatusService();
export default seedingStatusService;
