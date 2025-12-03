/**
 * @swagger
 * /order:
 *   post:
 *     summary: 주문 생성
 *     description: 로그인 세션(`isLoggedIn`) 필요. 재고 확인 후 주문 생성 및 재고 차감.
 *     tags: [Order]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 description: 주문할 상품 목록
 *                 items:
 *                   type: object
 *                   required: [itemId, price, quantity]
 *                   properties:
 *                     itemId:  { type: integer, example: 101 }
 *                     price:   { type: integer, example: 25900 }
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *     responses:
 *       201:
 *         description: 주문 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: "주문이 완료되었습니다." }
 *                 orderId: { type: integer, example: 5001 }
 *       400: { description: 잘못된 요청(주문 항목 없음/재고 부족 등) }
 *       403: { description: 로그인 필요 }
 *       404: { description: 상품을 찾을 수 없음 }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /order:
 *   get:
 *     summary: 주문 목록 조회 (내 주문)
 *     description: 로그인 세션(`isLoggedIn`) 필요. 본인 주문만 페이징 조회합니다.
 *     tags: [Order]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *         required: false
 *         description: 페이지(기본 1)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 5 }
 *         required: false
 *         description: 페이지 당 개수(기본 5)
 *     responses:
 *       200:
 *         description: 주문 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: "주문목록 조회 성공" }
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:         { type: integer, example: 5001 }
 *                       orderDate:  { type: string, format: date-time }
 *                       orderStatus:
 *                         type: string
 *                         example: "ORDER"
 *                       Items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:     { type: integer, example: 101 }
 *                             itemNm: { type: string,  example: "프리미엄 사료" }
 *                             price:  { type: integer, example: 25900 }
 *                             ItemImages:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:         { type: integer, example: 77 }
 *                                   oriImgName: { type: string,  example: "main.jpg" }
 *                                   imgUrl:     { type: string,  example: "/1693.jpg" }
 *                             OrderItem:
 *                               type: object
 *                               properties:
 *                                 orderPrice: { type: integer, example: 51800 }
 *                                 count:      { type: integer, example: 2 }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalOrders: { type: integer, example: 12 }
 *                     totalPages:  { type: integer, example: 3 }
 *                     currentPage: { type: integer, example: 1 }
 *                     limit:       { type: integer, example: 5 }
 *       403: { description: 로그인 필요 }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /order/all/admin:
 *   get:
 *     summary: 전체 주문 조회(관리자용)
 *     description: 정렬 조건에 따라 전체 주문/판매 현황을 조회합니다. (코드상 미들웨어는 없으나 관리자용으로 의도됨)
 *     tags: [Order]
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [orderDate, salesCount, yesterday]
 *           default: orderDate
 *         description: 정렬/조회 기준 (최근 주문 많은 순, 전체 판매량 순, 전일자)
 *     responses:
 *       200:
 *         description: 주문 집계 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:         { type: integer, example: 5001 }
 *                       orderDate:  { type: string, format: date-time }
 *                       orderStatus:
 *                         type: string
 *                         example: "ORDER"
 *                       orderPrice: { type: integer, example: 25900 }
 *                       count:      { type: integer, example: 1 }
 *                       itemNm:     { type: string,  example: "프리미엄 사료" }
 *                       price:      { type: integer, example: 25900 }
 *                       itemId:     { type: integer, example: 101 }
 *                       itemImgUrl: { type: string,  example: "/1693.jpg" }
 *                       orderCount: { type: integer, example: 23 }
 *       404: { description: 데이터 없음 }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /order/{id}:
 *   get:
 *     summary: 주문 상세 조회 (내 주문)
 *     description: 로그인 세션(`isLoggedIn`) 필요. 본인 주문만 조회합니다.
 *     tags: [Order]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 5001 }
 *         description: 조회할 주문 ID
 *     responses:
 *       200:
 *         description: 주문 상세
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 order:
 *                   type: object
 *                   properties:
 *                     id:         { type: integer, example: 5001 }
 *                     orderDate:  { type: string, format: date-time }
 *                     orderStatus:
 *                       type: string
 *                       example: "ORDER"
 *                     Items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:     { type: integer, example: 101 }
 *                           itemNm: { type: string,  example: "프리미엄 사료" }
 *                           price:  { type: integer, example: 25900 }
 *                           OrderItem:
 *                             type: object
 *                             properties:
 *                               orderPrice: { type: integer, example: 25900 }
 *                               count:      { type: integer, example: 1 }
 *       403: { description: 로그인 필요 }
 *       404: { description: 주문을 찾을 수 없습니다. }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /order/{id}/cancel:
 *   patch:
 *     summary: 주문 취소 (내 주문)
 *     description: 로그인 세션(`isLoggedIn`) 필요. 재고 복구 후 상태를 CANCEL로 변경합니다.
 *     tags: [Order]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 5001 }
 *         description: 취소할 주문 ID
 *     responses:
 *       200:
 *         description: 취소 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: "주문이 취소되었습니다." }
 *       403: { description: 로그인 필요 }
 *       404: { description: 주문을 찾을 수 없습니다. }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /order/{id}:
 *   patch:
 *     summary: 주문 상태 변경 (관리자/시스템)
 *     description: 쿼리로 전달된 `status` 값으로 주문 상태를 변경합니다. 예) `?status=SHIPPING`
 *     tags: [Order]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 5001 }
 *         description: 상태를 변경할 주문 ID
 *       - in: query
 *         name: status
 *         required: true
 *         schema: { type: string, example: "SHIPPING" }
 *         description: 변경할 주문 상태 값
 *     responses:
 *       200:
 *         description: 상태 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: "주문 상태가 SHIPPING로 변경되었습니다." }
 *       400: { description: status 쿼리 누락 }
 *       404: { description: 주문을 찾을 수 없습니다. }
 *       500: { description: 서버 오류 }
 */