const NodeCache = require('node-cache');

// 创建不同过期时间的缓存实例
const cache = new NodeCache({ 
  stdTTL: 60,            // 默认过期时间60秒
  checkperiod: 120,      // 检查过期的周期
  useClones: false       // 对于大对象，避免克隆开销
});

// 缓存键前缀常量
const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard_stats',
  STUDENT_LIST: 'student_list',
  STUDENT_DETAIL: 'student_detail_',
  LEADERBOARD: 'leaderboard',
  TEST_RESULTS: 'test_results_'
};

// 带监控的缓存统计
const stats = {
  hits: 0,
  misses: 0,
  keys() { return cache.keys(); },
  size() { return cache.keys().length; },
  hitRate() { 
    const total = this.hits + this.misses;
    return total ? (this.hits / total * 100).toFixed(2) + '%' : '0%';
  },
  reset() {
    this.hits = 0;
    this.misses = 0;
  }
};

// 缓存工具函数
module.exports = {
  // 获取缓存项
  get(key) {
    const value = cache.get(key);
    if (value === undefined) {
      stats.misses++;
      return null;
    }
    stats.hits++;
    return value;
  },
  
  // 设置缓存项
  set(key, value, ttl = 60) {
    return cache.set(key, value, ttl);
  },
  
  // 删除缓存项
  del(key) {
    return cache.del(key);
  },
  
  // 清空所有缓存
  flush() {
    return cache.flushAll();
  },
  
  // 清除学生相关的所有缓存
  invalidateStudentCache(studentId) {
    cache.del(CACHE_KEYS.DASHBOARD_STATS);
    cache.del(CACHE_KEYS.STUDENT_LIST);
    cache.del(CACHE_KEYS.LEADERBOARD);
    cache.del(CACHE_KEYS.STUDENT_DETAIL + studentId);
    cache.del(CACHE_KEYS.TEST_RESULTS + studentId);
    console.log(`已清除学生 ${studentId} 相关的缓存`);
  },
  
  // 自动缓存数据获取助手
  async getOrSet(key, fetchFunction, ttl = 60) {
    const cachedData = this.get(key);
    if (cachedData !== null) {
      return cachedData;
    }
    
    // 缓存未命中，从数据源获取
    const freshData = await fetchFunction();
    this.set(key, freshData, ttl);
    return freshData;
  },
  
  // 导出缓存键常量
  CACHE_KEYS,
  
  // 导出缓存统计
  stats
};