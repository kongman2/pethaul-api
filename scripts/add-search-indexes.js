// scripts/add-search-indexes.js
// 검색 성능 최적화를 위한 인덱스 추가
const { sequelize } = require('../models')

async function addSearchIndexes() {
   try {
      console.log('검색 성능 최적화를 위한 인덱스 추가 중...')
      
      // 1. items 테이블 인덱스
      console.log('items 테이블 인덱스 추가 중...')
      
      // itemNm 인덱스 (검색어 필터링)
      try {
         await sequelize.query(`
            CREATE INDEX idx_items_itemNm ON items(itemNm)
         `)
         console.log('idx_items_itemNm 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_items_itemNm 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      // price 인덱스 (가격 범위 필터링)
      try {
         await sequelize.query(`
            CREATE INDEX idx_items_price ON items(price)
         `)
         console.log('idx_items_price 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_items_price 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      // itemSellStatus 인덱스 (판매 상태 필터링)
      try {
         await sequelize.query(`
            CREATE INDEX idx_items_sellStatus ON items(itemSellStatus)
         `)
         console.log('idx_items_sellStatus 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_items_sellStatus 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      // createdAt 인덱스 (최신순 정렬)
      try {
         await sequelize.query(`
            CREATE INDEX idx_items_createdAt ON items(createdAt)
         `)
         console.log('idx_items_createdAt 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_items_createdAt 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      // 복합 인덱스 (판매 상태 + 가격)
      try {
         await sequelize.query(`
            CREATE INDEX idx_items_status_price ON items(itemSellStatus, price)
         `)
         console.log('idx_items_status_price 복합 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_items_status_price 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      // 2. category 테이블 인덱스
      console.log('category 테이블 인덱스 추가 중...')
      
      // categoryName 인덱스 (카테고리 검색)
      try {
         await sequelize.query(`
            CREATE INDEX idx_category_name ON category(categoryName)
         `)
         console.log('idx_category_name 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_category_name 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      // 3. itemCategory 테이블 인덱스 (조인 성능 향상)
      console.log('itemCategory 테이블 인덱스 추가 중...')
      
      // itemId 인덱스
      try {
         await sequelize.query(`
            CREATE INDEX idx_itemCategory_itemId ON itemCategory(itemId)
         `)
         console.log('idx_itemCategory_itemId 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_itemCategory_itemId 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      // categoryId 인덱스
      try {
         await sequelize.query(`
            CREATE INDEX idx_itemCategory_categoryId ON itemCategory(categoryId)
         `)
         console.log('idx_itemCategory_categoryId 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_itemCategory_categoryId 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      // 복합 인덱스 (itemId + categoryId)
      try {
         await sequelize.query(`
            CREATE INDEX idx_itemCategory_composite ON itemCategory(itemId, categoryId)
         `)
         console.log('idx_itemCategory_composite 복합 인덱스 추가 완료')
      } catch (e) {
         if (e.message.includes('Duplicate key name')) {
            console.log('idx_itemCategory_composite 인덱스가 이미 존재합니다.')
         } else {
            throw e
         }
      }
      
      console.log('모든 인덱스 추가가 완료되었습니다.')
      process.exit(0)
   } catch (error) {
      console.error('인덱스 추가 실패:', error)
      process.exit(1)
   }
}

// 실행
addSearchIndexes()

