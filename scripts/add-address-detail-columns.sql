ALTER TABLE users
ADD COLUMN addressDetail VARCHAR(255) NULL COMMENT '회원 상세 주소' AFTER address,
ADD COLUMN defaultDeliveryAddressDetail VARCHAR(255) NULL COMMENT '기본 배송지 상세 주소' AFTER defaultDeliveryAddress;

