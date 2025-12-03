/**
 * @swagger
 * /review:
 *   post:
 *     summary: 리뷰 등록 (이미지 포함)
 *     description: 로그인 세션(`isLoggedIn`) 필요. form-data로 텍스트 필드와 이미지 배열을 함께 업로드합니다.
 *     tags: [Review]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [itemId, reviewContent, rating]
 *             properties:
 *               itemId:        { type: integer, example: 101, description: 리뷰 대상 상품 ID }
 *               reviewDate:    { type: string, format: date, example: "2025-09-01" }
 *               reviewContent: { type: string, example: "질도 좋고 배송 빨라요!" }
 *               rating:        { type: integer, example: 5, description: 1~5 }
 *               img:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: 리뷰 이미지(여러 장)
 *     responses:
 *       201:
 *         description: 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "후기가 성공적으로 등록되었습니다." }
 *                 review:
 *                   type: object
 *                   properties:
 *                     id:           { type: integer, example: 1 }
 *                     itemId:       { type: integer, example: 101 }
 *                     userId:       { type: integer, example: 7 }
 *                     reviewDate:   { type: string, format: date, example: "2025-09-01" }
 *                     reviewContent:
 *                       type: string
 *                       example: "질도 좋고 배송 빨라요!"
 *                     rating:       { type: integer, example: 5 }
 *                 reviewImages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:         { type: integer, example: 10 }
 *                       oriImgName: { type: string, example: "리뷰사진.jpg" }
 *                       imgUrl:     { type: string, example: "/1693909123456.jpg" }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /review/edit/{id}:
 *   put:
 *     summary: 리뷰 수정 (이미지 재업로드 시 전부 교체)
 *     description: 로그인 세션(`isLoggedIn`) 필요. 작성자 본인만 수정 가능.
 *     tags: [Review]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *         description: 수정할 리뷰 ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               itemId:        { type: integer, example: 101 }
 *               reviewDate:    { type: string, format: date, example: "2025-09-02" }
 *               reviewContent: { type: string, example: "사용 1주일 후기 업데이트!" }
 *               rating:        { type: integer, example: 4 }
 *               img:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: 새 이미지 업로드 시 기존 이미지 전체 교체
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "후기를 성공적으로 수정했습니다." }
 *       403: { description: 권한 없음(본인 아님) 또는 로그인 필요 }
 *       404: { description: 해당 후기를 찾을 수 없습니다. }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /review/{id}:
 *   delete:
 *     summary: 리뷰 삭제
 *     description: 로그인 세션(`isLoggedIn`) 필요. 작성자 본인만 삭제 가능.
 *     tags: [Review]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *         description: 삭제할 리뷰 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "후기가 삭제되었습니다." }
 *       403: { description: 권한 없음(본인 아님) 또는 로그인 필요 }
 *       404: { description: 해당 후기를 찾을 수 없습니다. }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /review:
 *   get:
 *     summary: 회원이 작성한 리뷰 목록 조회(페이징)
 *     description: 로그인 세션(`isLoggedIn`) 필요. 본인이 작성한 리뷰만 조회합니다.
 *     tags: [Review]
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema: { type: integer, example: 1 }
 *         description: 페이지 (기본 1)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, example: 5 }
 *         description: 페이지당 개수 (기본 5)
 *     responses:
 *       200:
 *         description: 리뷰 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:  { type: boolean, example: true }
 *                 message:  { type: string, example: "회원이 작성한 리뷰를 성공적으로 불러왔습니다." }
 *                 review:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:           { type: integer, example: 1 }
 *                       reviewDate:   { type: string, format: date, example: "2025-09-01" }
 *                       reviewContent:
 *                         type: string
 *                         example: "만족합니다."
 *                       rating:       { type: integer, example: 5 }
 *                       Item:
 *                         type: object
 *                         properties:
 *                           id:     { type: integer, example: 101 }
 *                           itemNm: { type: string, example: "프리미엄 사료" }
 *                           price:  { type: integer, example: 25900 }
 *                           ItemImages:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:         { type: integer, example: 77 }
 *                                 oriImgName: { type: string, example: "item.jpg" }
 *                                 imgUrl:     { type: string, example: "/1693909.jpg" }
 *                                 repImgYn:   { type: string, example: "Y" }
 *                       ReviewImages:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:         { type: integer, example: 11 }
 *                             oriImgName: { type: string, example: "review.jpg" }
 *                             imgUrl:     { type: string, example: "/1693909.jpg" }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalReview: { type: integer, example: 13 }
 *                     totalPages:  { type: integer, example: 3 }
 *                     currentPage: { type: integer, example: 1 }
 *                     limit:       { type: integer, example: 5 }
 *       403: { description: 로그인 필요 }
 *       500: { description: 서버 오류 }
 */
/**
 * @swagger
 * /review/latest:
 *   get:
 *     summary: 최신 리뷰 목록 (메인/위젯용)
 *     description: 최신순 페이징. 상품 대표이미지 1장만 포함.
 *     tags: [Review]
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: size
 *         required: false
 *         schema: { type: integer, example: 6 }
 *     responses:
 *       200:
 *         description: 최신 리뷰 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 list:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:           { type: integer, example: 1 }
 *                       reviewContent:
 *                         type: string
 *                         example: "가성비 좋아요!"
 *                       rating:       { type: integer, example: 5 }
 *                       ReviewImages:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:         { type: integer, example: 20 }
 *                             oriImgName: { type: string, example: "리뷰1.jpg" }
 *                             imgUrl:     { type: string, example: "/1693.jpg" }
 *                       User:
 *                         type: object
 *                         properties:
 *                           id:   { type: integer, example: 7 }
 *                           name: { type: string, example: "홍길동" }
 *                       Item:
 *                         type: object
 *                         properties:
 *                           id:     { type: integer, example: 101 }
 *                           itemNm: { type: string, example: "프리미엄 사료" }
 *                           price:  { type: integer, example: 25900 }
 *                           ItemImages:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:     { type: integer, example: 70 }
 *                                 imgUrl: { type: string, example: "/rep.jpg" }
 *                 page:    { type: integer, example: 1 }
 *                 size:    { type: integer, example: 6 }
 *                 total:   { type: integer, example: 42 }
 *                 hasMore: { type: boolean, example: true }
 *       500: { description: 서버 오류 }
 */
