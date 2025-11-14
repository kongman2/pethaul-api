-- pets 테이블에 ageInMonths 컬럼 추가
-- MySQL/MariaDB에서 직접 실행

ALTER TABLE pets 
ADD COLUMN ageInMonths INT UNSIGNED NULL 
COMMENT '1살 미만인 경우 개월 수 (1-11)'
AFTER age;

