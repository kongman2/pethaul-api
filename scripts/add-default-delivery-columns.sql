ALTER TABLE users
ADD COLUMN defaultDeliveryName VARCHAR(255) NULL COMMENT '기본 배송지 수령인 이름' AFTER tempPasswordExpiresAt,
ADD COLUMN defaultDeliveryPhone VARCHAR(20) NULL COMMENT '기본 배송지 연락처' AFTER defaultDeliveryName,
ADD COLUMN defaultDeliveryAddress VARCHAR(255) NULL COMMENT '기본 배송지 주소' AFTER defaultDeliveryPhone,
ADD COLUMN defaultDeliveryRequest VARCHAR(255) NULL COMMENT '기본 배송 요청 사항' AFTER defaultDeliveryAddress;

