export class SchoolTaskCache {
  private static store: Map<string, { value: any; expiresAt: number }> = new Map();
  private static isRedisConnected: boolean = false;
  private static redisClient: any = null;

  /**
   * Set a custom Redis client (e.g. from ioredis or redis package) to enable Redis mode
   */
  static setRedisClient(client: any): void {
    this.redisClient = client;
    this.isRedisConnected = !!client;
    console.log(`[Cache] Redis integration status: ${this.isRedisConnected ? 'CONNECTED' : 'DISCONNECTED (In-memory fallback active)'}`);
  }

  /**
   * Retrieve cached value by tenantId and local key
   */
  static async get(tenantId: string, key: string): Promise<any | null> {
    const fullKey = `tenant:${tenantId}:${key}`;
    
    if (this.isRedisConnected && this.redisClient) {
      try {
        const val = await this.redisClient.get(fullKey);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        console.warn('[Cache] Redis get error, falling back to memory:', err);
      }
    }

    const item = this.store.get(fullKey);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(fullKey);
      return null;
    }

    return item.value;
  }

  /**
   * Set cache entry with tenant-aware prefix and custom TTL (seconds)
   */
  static async set(tenantId: string, key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const fullKey = `tenant:${tenantId}:${key}`;

    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.set(fullKey, JSON.stringify(value), { EX: ttlSeconds });
        return;
      } catch (err) {
        console.warn('[Cache] Redis set error, falling back to memory:', err);
      }
    }

    this.store.set(fullKey, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Evict all cache keys belonging to a specific tenant
   */
  static async invalidate(tenantId: string): Promise<void> {
    const prefix = `tenant:${tenantId}:`;

    if (this.isRedisConnected && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (err) {
        console.warn('[Cache] Redis keys invalidation error:', err);
      }
    }

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
    
    console.log(`[Cache] Invalidated all cache entries for tenant ${tenantId}`);
  }

  /**
   * Flush the entire cache
   */
  static async invalidateAll(): Promise<void> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.flushAll();
      } catch (err) {
        console.warn('[Cache] Redis flushall error:', err);
      }
    }
    this.store.clear();
    console.log('[Cache] Entire cache flushed');
  }
}
