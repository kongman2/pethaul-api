-- pets 테이블에 surveyResult 컬럼 추가
-- MySQL/MariaDB에서 직접 실행

-- 1. 컬럼이 없으면 추가 (MySQL 8.0+)
ALTER TABLE pets 
ADD COLUMN IF NOT EXISTS surveyResult JSON NULL 
COMMENT '반려동물 설문조사 결과 데이터';

-- 2. MySQL 5.7 이하인 경우 아래 쿼리 사용
-- ALTER TABLE pets 
-- ADD COLUMN surveyResult JSON NULL 
-- COMMENT '반려동물 설문조사 결과 데이터';

