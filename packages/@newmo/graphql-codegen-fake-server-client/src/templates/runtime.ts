/**
 * Returns the runtime code as a string template
 * This is used to embed the runtime code in the generated client
 */
export function getRuntimeCode(): string {
    return `// Runtime utilities for generated fake client
export type CreateFakeClientOptions = {
  /**
   * The URL of the fake server
   * @example 'http://localhost:4000/fake'
   */
  fakeServerEndpoint: string;
};

// Request queue implementation for rate limiting
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent: number = 10; // Reduced default for better stability
  private requestDelay: number = 10; // Small delay to prevent overwhelming the server
  private lastRequestTime = 0;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Apply request delay if configured
          if (this.requestDelay > 0) {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.requestDelay) {
              await new Promise(r => setTimeout(r, this.requestDelay - timeSinceLastRequest));
            }
            this.lastRequestTime = Date.now();
          }

          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const fn = this.queue.shift();
    if (fn) {
      await fn();
      this.running--;
      this.process();
    }
  }
}

// Retry helper function with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit
): Promise<Response> {
  const maxAttempts = 3;
  const initialDelay = 100;
  const maxDelay = 2000;
  const backoffFactor = 2;

  // Apply HTTP options with sensible defaults
  const fetchOptions: RequestInit = {
    ...options,
    // Enable keepalive for connection reuse
    keepalive: true,
    // Set a reasonable timeout (30 seconds)
    signal: AbortSignal.timeout(30000),
  };

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      lastResponse = response;
      
      // Success (2xx) or client error (4xx) - don't retry
      if (response.status < 500) {
        return response;
      }
      
      // Server error (5xx) - should retry
      if (attempt < maxAttempts - 1) {
        const requestInfo = {
          url,
          status: response.status,
          statusText: response.statusText,
          attempt: attempt + 1,
          maxAttempts,
          operationName: JSON.parse(options.body as string)?.operationName,
          sequenceId: (options.headers as any)?.['sequence-id'],
        };
        
        console.error(\`[FakeClient] Server error, will retry:\`, requestInfo);
        
        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
        const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
        const delay = baseDelay + jitter;
        
        console.log(\`[FakeClient] Retrying in \${Math.round(delay)}ms...\`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Last attempt and still server error
      return response;
      
    } catch (error) {
      lastError = error as Error;
      
      // Determine if error is retryable
      let shouldRetry = false;
      let errorType = 'unknown';
      
      if (error instanceof TypeError) {
        // Network errors from fetch (connection failures)
        shouldRetry = true;
        errorType = 'network';
      } else if (error instanceof Error && error.name === 'AbortError') {
        // Timeout errors
        shouldRetry = true;
        errorType = 'timeout';
      }
      
      const requestInfo = {
        url,
        errorType,
        error: error instanceof Error ? error.message : String(error),
        attempt: attempt + 1,
        maxAttempts,
        operationName: JSON.parse(options.body as string)?.operationName,
        sequenceId: (options.headers as any)?.['sequence-id'],
      };
      
      console.error(\`[FakeClient] Request failed:\`, requestInfo);
      
      if (shouldRetry && attempt < maxAttempts - 1) {
        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
        const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
        const delay = baseDelay + jitter;
        
        console.log(\`[FakeClient] Retrying in \${Math.round(delay)}ms...\`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Not retryable or max attempts reached
      throw error;
    }
  }
  
  // Should not reach here, but just in case
  if (lastResponse) {
    return lastResponse;
  }
  throw new Error('Max retry attempts reached', { cause: lastError });
}`;
}
