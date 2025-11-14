-- scripts/add-delivery-columns.sql
-- 배송지 컬럼 추가 (컬럼이 이미 존재하는 경우 에러가 발생할 수 있으니 주의)
ALTER TABLE orders
ADD COLUMN deliveryName VARCHAR(255) NULL COMMENT '배송지 수령인 이름',
ADD COLUMN deliveryPhone VARCHAR(20) NULL COMMENT '배송지 연락처',
ADD COLUMN deliveryAddress VARCHAR(500) NULL COMMENT '배송지 주소',
ADD COLUMN deliveryAddressDetail VARCHAR(255) NULL COMMENT '배송지 상세 주소',
ADD COLUMN deliveryRequest VARCHAR(255) NULL COMMENT '배송 요청 사항';

