/**
 * 카테고리 이름 정규화 (영어/한글 구분 없이 매칭)
 * 프론트엔드와 동일한 로직을 사용하여 일관성 유지
 */

// 카테고리 매핑 (한글/영어 통일)
const CATEGORY_MAPPING = {
  // 반려동물
  '강아지': '강아지', 'DOG': '강아지', 'DOGS': '강아지', 'PUPPY': '강아지', 'PUPPIES': '강아지',
  '고양이': '고양이', 'CAT': '고양이', 'CATS': '고양이', 'KITTY': '고양이', 'KITTEN': '고양이',
  '햄스터/고슴도치': '햄스터/고슴도치', '햄스터': '햄스터/고슴도치', '고슴도치': '햄스터/고슴도치',
  'HAMSTER': '햄스터/고슴도치', 'HEDGEHOG': '햄스터/고슴도치',
  '토끼': '토끼', 'RABBIT': '토끼', 'BUNNY': '토끼',
  '새(앵무새)': '새(앵무새)', '새': '새(앵무새)', '앵무새': '새(앵무새)',
  'BIRD': '새(앵무새)', 'BIRDS': '새(앵무새)', 'PARROT': '새(앵무새)',
  '물고기/기타동물': '물고기/기타동물', '물고기': '물고기/기타동물', '기타동물': '물고기/기타동물',
  'FISH': '물고기/기타동물', 'OTHER': '물고기/기타동물', 'OTHERS': '물고기/기타동물',
  
  // 상품 카테고리
  '사료': '사료', 'FEED': '사료', 'FOOD': '사료', 'PETFOOD': '사료', 'PET FOOD': '사료',
  '간식': '간식', 'SNACK': '간식', 'TREAT': '간식', 'TREATS': '간식',
  '의류': '의류', 'CLOTHING': '의류', 'APPAREL': '의류', 'CLOTHES': '의류',
  '산책용품': '산책용품', '산책': '산책용품', 'WALKING': '산책용품', 'WALK': '산책용품',
  '장난감': '장난감', 'TOY': '장난감', 'TOYS': '장난감', 'PLAY': '장난감',
  '배변용품': '배변용품', '배변': '배변용품', 'LITTER': '배변용품', 'TOILET': '배변용품',
  '기타용품': '기타용품', '기타': '기타용품', 'ETC': '기타용품',
  
  // 특별 카테고리
  '무료배송': '무료배송', '무료': '무료배송', 'FREESHIPPING': '무료배송', 'FREE SHIPPING': '무료배송', 'FREE': '무료배송',
  '빠른배송': '빠른배송', '빠른': '빠른배송', 'FASTSHIPPING': '빠른배송', 'FAST SHIPPING': '빠른배송', 'FAST': '빠른배송',
  '시즌': 'SEASON', 'SEASON': 'SEASON', 'SEASONS': 'SEASON',
  '신상품': '신상품', '신상': '신상품', 'NEW': '신상품', 'NEWITEM': '신상품', 'NEW ITEM': '신상품',
  '이월상품': '이월상품', '이월': '이월상품', 'CLEARANCE': '이월상품', 'SALE': '이월상품',
  '이벤트': '이벤트', 'EVENT': '이벤트', 'EVENTS': '이벤트',
  '세일': '세일', 'SALES': '세일', 'DISCOUNT': '세일',
  '키링': '키링', 'KEYRING': '키링', 'KEY RING': '키링', 'KEYCHAIN': '키링',
}

/**
 * 카테고리 이름 정규화
 * @param {string} name - 카테고리 이름
 * @returns {string} 정규화된 카테고리 이름
 */
function normalizeCategoryName(name) {
  if (!name) return ''
  const str = String(name).trim()
  const upper = str.toUpperCase()
  
  // 매핑 테이블에서 찾기
  if (CATEGORY_MAPPING[str]) {
    return CATEGORY_MAPPING[str]
  }
  if (CATEGORY_MAPPING[upper]) {
    return CATEGORY_MAPPING[upper]
  }
  
  // 공백 제거 버전도 확인
  const noSpace = str.replace(/\s+/g, '')
  if (noSpace !== str && CATEGORY_MAPPING[noSpace]) {
    return CATEGORY_MAPPING[noSpace]
  }
  if (noSpace !== str && CATEGORY_MAPPING[noSpace.toUpperCase()]) {
    return CATEGORY_MAPPING[noSpace.toUpperCase()]
  }
  
  // 매핑에 없으면 원본 반환 (대문자로)
  return upper
}

/**
 * 카테고리 배열 정규화
 * @param {string[]} categories - 카테고리 배열
 * @returns {string[]} 정규화된 카테고리 배열
 */
function normalizeCategories(categories) {
  if (!Array.isArray(categories)) {
    return categories ? [normalizeCategoryName(categories)] : []
  }
  return categories.map(normalizeCategoryName).filter(Boolean)
}

/**
 * 정규화된 카테고리로 검색 가능한 모든 변형 반환
 * @param {string} normalizedCategory - 정규화된 카테고리 이름
 * @returns {string[]} 검색 가능한 모든 변형 배열
 */
function getCategoryVariants(normalizedCategory) {
  if (!normalizedCategory || typeof normalizedCategory !== 'string') {
    return []
  }
  
  const variants = [normalizedCategory]
  
  // 매핑에서 해당 카테고리로 매핑되는 모든 키 찾기
  for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
    if (value === normalizedCategory && key !== normalizedCategory) {
      variants.push(key)
    }
  }
  
  return [...new Set(variants)] // 중복 제거
}

module.exports = {
  normalizeCategoryName,
  normalizeCategories,
  getCategoryVariants,
}

