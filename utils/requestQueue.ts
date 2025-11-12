// 🔹 CREATE NEW FILE: utils/requestQueue.ts

class RequestQueue {
  private queue: Array<{
    request: () => Promise<any>;
    priority: 'high' | 'low';
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private processing = false;
  private lastRequest = 0;
  private readonly MIN_INTERVAL = 500; // 500ms between requests

  async enqueue<T>(
    request: () => Promise<T>,
    priority: 'high' | 'low' = 'low'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const item = { request, priority, resolve, reject };

      if (priority === 'high') {
        // Find first low-priority item and insert before it
        const lowIndex = this.queue.findIndex(q => q.priority === 'low');
        if (lowIndex === -1) {
          this.queue.push(item);
        } else {
          this.queue.splice(lowIndex, 0, item);
        }
      } else {
        this.queue.push(item);
      }

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequest;

      if (timeSinceLastRequest < this.MIN_INTERVAL) {
        await new Promise(resolve =>
          setTimeout(resolve, this.MIN_INTERVAL - timeSinceLastRequest)
        );
      }

      const item = this.queue.shift();
      if (item) {
        try {
          const result = await item.request();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
        this.lastRequest = Date.now();
      }
    }

    this.processing = false;
  }
}

export const requestQueue = new RequestQueue();