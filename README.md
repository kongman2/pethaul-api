# Pethaul-API

반려동물 용품 이커머스 플랫폼의 Express 기반 백엔드 API 서버입니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [주요 기능](#3-주요-기능)
4. [프로젝트 구조](#4-프로젝트-구조)
5. [환경 변수 설정](#5-환경-변수-설정)
6. [배포 가이드](#6-배포-가이드)

---

## 1) 프로젝트 개요

**Pethaul-API**는 반려동물 용품 이커머스 플랫폼의 백엔드 서버로, RESTful API를 제공합니다.

### 핵심 특징
- Express.js 기반 RESTful API
- Sequelize ORM을 통한 MySQL 데이터베이스 관리
- Passport.js를 활용한 인증 시스템 (로컬/구글 OAuth)
- JWT 토큰 기반 인증 및 세션 기반 인증 하이브리드
- Swagger API 문서화

---

## 2) 기술 스택

### Core
- Node.js
- Express 5.1.0
- Sequelize 6.37.7
- MySQL2 3.14.3

### 인증
- Passport.js 0.7.0
- Passport Local Strategy
- Passport Google OAuth 2.0
- JWT (jsonwebtoken 9.0.2)
- bcrypt 6.0.0

### 기타
- Multer (파일 업로드)
- Socket.io (실시간 통신)
- Swagger (API 문서화)
- CORS, Cookie Parser, Express Session

---

## 3) 주요 기능

### 인증 및 사용자 관리
- 로컬 회원가입/로그인
- 구글 OAuth 소셜 로그인
- JWT 토큰 발급 및 검증
- 세션 기반 인증 (하이브리드)

### API 엔드포인트
- **인증**: `/auth/*` - 회원가입, 로그인, 로그아웃
- **상품**: `/item/*` - 상품 CRUD, 검색, 필터링
- **주문**: `/order/*` - 주문 생성, 조회, 상태 변경
- **장바구니**: `/cart/*` - 장바구니 관리
- **리뷰**: `/review/*` - 리뷰 작성, 조회, 수정, 삭제
- **반려동물**: `/pet/*` - 반려동물 프로필 관리
- **좋아요**: `/like/*` - 상품 좋아요 기능
- **컨텐츠**: `/content/*` - 컨텐츠 관리
- **문의**: `/qna/*` - 상품 문의 관리
- **교환/반품**: `/exchangeReturn/*` - 교환/반품 신청 및 관리
- **토큰**: `/token/*` - JWT 토큰 발급

---

## 4) 프로젝트 구조

```
pethaul-api/
├── config/              # 데이터베이스 설정
│   └── config.js
├── models/              # Sequelize 모델
│   ├── user.js
│   ├── item.js
│   ├── order.js
│   └── ...
├── routes/              # API 라우터
│   ├── index.js
│   ├── auth.js
│   ├── item.js
│   ├── order.js
│   └── ...
├── routes-swagger/      # Swagger 문서
├── passport/            # Passport 인증 전략
│   ├── index.js
│   ├── localStrategy.js
│   └── googleStrategy.js
├── middlewares/         # 미들웨어
│   └── middlewares.js
├── scripts/             # 유틸리티 스크립트
│   ├── create-db.js
│   └── create-admin.js
├── uploads/             # 업로드된 파일
├── app.js               # Express 앱 진입점
├── swagger.js           # Swagger 설정
└── render.yaml          # Render 배포 설정
```

---

## 5) 환경 변수 설정

### 로컬 개발 시

프로젝트 루트에 `.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# 데이터베이스
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pethaul
DB_DIALECT=mysql

# 서버
PORT=8002
NODE_ENV=development

# 세션
COOKIE_SECRET=your_cookie_secret

# JWT
JWT_SECRET=your_jwt_secret

# Google OAuth (선택)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# 프론트엔드 URL
FRONTEND_APP_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173

# AUTH_KEY (선택)
AUTH_KEY=your_auth_key
```

> ⚠️ **주의**: `.env` 파일은 Git에 커밋하지 마세요. (`.gitignore`에 포함되어 있습니다)

## 6) 배포 가이드

### Render 배포

백엔드 API는 Render를 통해 배포됩니다.

#### 배포 설정

1. **Render 프로젝트 생성**
   - Render 대시보드에서 "New Web Service" 선택
   - GitHub 저장소 연결
   - `render.yaml` 파일이 자동으로 설정을 읽어옵니다

2. **환경 변수 설정**
   Render 대시보드의 Environment Variables에서 필수 변수 설정:
   - `NODE_ENV=production`
   - `DB_DIALECT=mysql`
   - `COOKIE_SECRET`
   - `JWT_SECRET`
   - `FRONTEND_APP_URL` (또는 `CLIENT_URL`) - **Vercel 프론트엔드 URL로 설정** (예: `https://your-app.vercel.app`)
   - 데이터베이스 연결 정보
   
   > ⚠️ **중요**: `FRONTEND_APP_URL` 또는 `CLIENT_URL`을 Vercel에 배포된 프론트엔드 URL로 설정해야 Google OAuth 리다이렉트가 정상 작동합니다.

3. **배포 확인**
   - 배포 완료 후 제공되는 URL로 접속
   - Swagger 문서: `https://your-api-url.onrender.com/api-docs`

#### 주의사항
- 데이터베이스는 별도로 생성해야 합니다 (Render MySQL 또는 외부 MySQL)
- CORS 설정이 프론트엔드 도메인을 허용하도록 설정되어 있어야 합니다
- 파일 업로드 경로(`/uploads`)는 영구 스토리지가 필요합니다

---

**Made by MODU Team**

