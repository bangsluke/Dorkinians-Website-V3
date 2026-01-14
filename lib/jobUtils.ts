/**
 * Shared utility functions for job management
 */

export interface KillJobOptions {
  onSuccess?: (jobId: string, result: any) => void;
  onError?: (jobId: string, error: string) => void;
  onFinally?: (jobId: string) => void;
}

/**
 * Kill a specific job by ID
 */
export const killJob = async (
  jobIdToKill: string,
  options: KillJobOptions = {}
): Promise<boolean> => {
  const { onSuccess, onError, onFinally } = options;
  
  let controller: AbortController | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || "https://dorkinians-database-v3-0e9a731483c7.herokuapp.com";
    const cleanBaseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    const apiUrl = `${cleanBaseUrl}/jobs/${jobIdToKill}/kill`;
    
    controller = new AbortController();
    timeoutId = setTimeout(() => {
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
    }, 10000); // 10 second timeout

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "cors",
      signal: controller.signal,
    });

    if (response.ok) {
      const killResult = await response.json();
      console.log("Job kill result:", killResult);
      
      onSuccess?.(jobIdToKill, killResult);
      return true;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    console.error("Failed to kill job:", err);
    let errorMessage = "Failed to kill job";
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        errorMessage = "Request timed out after 10 seconds";
      } else {
        errorMessage = err.message;
      }
    }
    onError?.(jobIdToKill, errorMessage);
    return false;
  } finally {
    // Ensure proper cleanup of timeout and controller
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    controller = null;
    onFinally?.(jobIdToKill);
  }
};
