/**
 * 간단한 메모리 캐시 구현
 * 실무에서는 Redis를 사용하는 것이 권장되지만, 
 * 현재는 간단한 메모리 캐시로 구현
 */

class SimpleCache {
   constructor(options = {}) {
      this.cache = new Map()
      this.defaultTTL = options.defaultTTL || 5 * 60 * 1000 // 기본 5분
      this.maxSize = options.maxSize || 1000 // 최대 캐시 항목 수
   }

   /**
    * 캐시에 값 저장
    * @param {string} key - 캐시 키
    * @param {any} value - 저장할 값
    * @param {number} ttl - TTL (밀리초), 기본값 사용 시 생략
    */
   set(key, value, ttl = null) {
      // 최대 크기 초과 시 오래된 항목 제거 (LRU 방식)
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
         const firstKey = this.cache.keys().next().value
         this.cache.delete(firstKey)
      }

      const expiresAt = Date.now() + (ttl || this.defaultTTL)
      this.cache.set(key, {
         value,
         expiresAt,
      })
   }

   /**
    * 캐시에서 값 가져오기
    * @param {string} key - 캐시 키
    * @returns {any|null} 캐시된 값 또는 null
    */
   get(key) {
      const item = this.cache.get(key)
      
      if (!item) {
         return null
      }

      // 만료된 항목 제거
      if (Date.now() > item.expiresAt) {
         this.cache.delete(key)
         return null
      }

      return item.value
   }

   /**
    * 캐시에서 항목 제거
    * @param {string} key - 캐시 키
    */
   delete(key) {
      this.cache.delete(key)
   }

   /**
    * 캐시 비우기
    */
   clear() {
      this.cache.clear()
   }

   /**
    * 만료된 항목 정리
    */
   cleanup() {
      const now = Date.now()
      for (const [key, item] of this.cache.entries()) {
         if (now > item.expiresAt) {
            this.cache.delete(key)
         }
      }
   }

   /**
    * 캐시 크기 반환
    */
   size() {
      return this.cache.size
   }

   /**
    * 패턴으로 캐시 항목 삭제
    * @param {string} pattern - 삭제할 패턴 (예: 'items:list')
    */
   deleteByPattern(pattern) {
      let deletedCount = 0
      for (const key of this.cache.keys()) {
         if (key.startsWith(pattern)) {
            this.cache.delete(key)
            deletedCount++
         }
      }
      return deletedCount
   }
}

// 싱글톤 인스턴스
const cache = new SimpleCache({
   defaultTTL: 5 * 60 * 1000, // 5분
   maxSize: 1000,
})

// 주기적으로 만료된 항목 정리 (10분마다)
setInterval(() => {
   cache.cleanup()
}, 10 * 60 * 1000)

/**
 * 캐시 키 생성 헬퍼
 */
function generateCacheKey(prefix, params) {
   const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|')
   return `${prefix}:${sortedParams}`
}

module.exports = {
   cache,
   generateCacheKey,
}

