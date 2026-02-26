<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🧠 Dr. Alma — CBT AI Therapist

**AI 기반 인지행동치료(CBT) 에이전트**

인지 왜곡을 탐지하고, 소크라테스식 질문법으로 사용자를 안내하는 AI 심리상담 챗봇

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Gemini](https://img.shields.io/badge/Gemini_API-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)

</div>

---

## 📋 목차

- [소개](#-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [아키텍처](#-아키텍처)
- [시작하기](#-시작하기)
- [프로젝트 구조](#-프로젝트-구조)
- [환경 변수](#-환경-변수)
- [안전 프로토콜](#-안전-프로토콜)
- [라이선스](#-라이선스)

---

## 🌟 소개

**Dr. Alma**는 세계적인 임상 심리학자 페르소나를 가진 AI 기반 인지행동치료(CBT) 에이전트입니다.

Google Gemini API를 활용하여 사용자의 대화에서 **인지 왜곡(Cognitive Distortions)**을 감지하고, **ABCD 모델** 및 **소크라테스식 질문법(Socratic Questioning)**을 통해 건강한 사고 패턴으로의 전환을 돕습니다.

> 🔗 **AI Studio에서 보기**: [https://ai.studio/apps/72c3a4c3-541d-4243-a195-0179b24e5c42](https://ai.studio/apps/72c3a4c3-541d-4243-a195-0179b24e5c42)

---

## ✨ 주요 기능

### 🗣️ 실시간 스트리밍 채팅
- Gemini API의 스트리밍 응답을 활용한 자연스러운 대화 경험
- **Thinking Summary UI** — AI의 사고 과정을 실시간으로 시각화

### 🧩 CBT 전문 지식 기반
- **10가지 인지 왜곡 유형** 자동 감지 (흑백논리, 과잉일반화, 정신적 필터링 등)
- **5가지 소크라테스식 질문 패턴** 적용 (증거 검증, 대안 탐색, 파국화 해소 등)
- **ABCD 모델** 기반 구조화된 세션 진행

### 📚 지식 관리 시스템 (File Search)
- Gemini **File Search Store**를 활용한 CBT 기본 지식 자동 초기화
- 사용자 정의 파일 업로드 (`.txt`, `.md`, `.pdf`) 지원
- 체크박스 기반 지식 저장소 활성화/비활성화

### 🌍 실시간 Google 웹 검색
- Google Search 도구 통합으로 최신 정보 기반 응답 가능
- 지식 저장소와 함께 선택적 활성화

### 🧠 장기 기억 시스템 (Vector RAG)
- **Gemini Embedding API** + **IndexedDB** 기반 클라이언트 사이드 벡터 스토어
- 사용자-AI 대화 임베딩을 로컬에 저장하여 개인화된 장기 기억 구현
- 코사인 유사도 검색으로 관련 과거 대화를 자동으로 컨텍스트에 주입

### 💾 세션 캐시
- IndexedDB 기반 대화 이력 자동 저장
- 24시간 TTL(Time-To-Live) 정책으로 만료된 캐시 자동 정리
- 브라우저 새로고침 후에도 대화 연속성 유지

### 🛡️ 안전 프로토콜
- 자살·자해·타해 의도 감지 시 즉각적인 치료 중단 및 긴급 연락처 안내
- 한국 긴급 상담 전화번호 자동 제공 (109, 1577-0199, 112, 119)

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| **프론트엔드** | React 19, TypeScript, TailwindCSS 4 |
| **빌드 도구** | Vite 6 |
| **AI / LLM** | Google Gemini API (`@google/genai`) |
| **임베딩** | Gemini Embedding API (`gemini-embedding-001`) |
| **지식 관리** | Gemini File Search Store |
| **벡터 DB** | IndexedDB (클라이언트 사이드) |
| **세션 관리** | IndexedDB (24시간 TTL 캐시) |
| **UI 애니메이션** | Motion (Framer Motion), CSS Animations |
| **아이콘** | Lucide React |
| **마크다운 렌더링** | react-markdown |

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자 (브라우저)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│   │   Chat UI    │───▶│  gemini.ts   │───▶│  Gemini API  │   │
│   │  (React)     │◀───│  (Stream)    │◀───│  (2.5 Flash) │   │
│   └──────┬───────┘    └──────┬───────┘    └──────────────┘   │
│          │                   │                               │
│          │            ┌──────┴───────┐                       │
│          │            │  System      │                       │
│          │            │  Instruction │                       │
│          │            │  + CBT KB    │                       │
│          │            └──────────────┘                       │
│          │                                                   │
│   ┌──────┴───────────────────────────────────────────┐      │
│   │               서비스 레이어                         │      │
│   │                                                   │      │
│   │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │      │
│   │  │  Knowledge   │  │   Memory     │  │ Session  │ │      │
│   │  │  Manager     │  │   Manager    │  │ Cache    │ │      │
│   │  │ (File Search)│  │ (Vector RAG) │  │(IndexDB) │ │      │
│   │  └──────┬───────┘  └──────┬───────┘  └──────────┘ │      │
│   │         │                 │                        │      │
│   │  ┌──────┴───────┐  ┌─────┴────────┐               │      │
│   │  │ Gemini File   │  │  Vector Store │              │      │
│   │  │ Search Store  │  │  (IndexedDB)  │              │      │
│   │  │ (Cloud)       │  │  (Local)      │              │      │
│   │  └───────────────┘  └──────────────┘               │      │
│   └───────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 시작하기

### 사전 요구사항

- **Node.js** (v18 이상 권장)
- **Gemini API Key** ([Google AI Studio](https://aistudio.google.com/)에서 발급)

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/Gotti0/Dr.-Alma---CBT-AI-Therapist.git
cd Dr.-Alma---CBT-AI-Therapist

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일에서 GEMINI_API_KEY 값을 본인의 API 키로 변경

# 4. 개발 서버 실행
npm run dev
```

개발 서버가 `http://localhost:3000`에서 시작됩니다.

### 빌드

```bash
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

---

## 📁 프로젝트 구조

```
Dr.-Alma---CBT-AI-Therapist/
├── index.html                  # 진입점 HTML
├── package.json                # 프로젝트 의존성 및 스크립트
├── vite.config.ts              # Vite 빌드 설정
├── tsconfig.json               # TypeScript 설정
├── metadata.json               # AI Studio 앱 메타데이터
├── .env.example                # 환경 변수 템플릿
│
├── src/
│   ├── main.tsx                # React 앱 진입점
│   ├── App.tsx                 # 루트 컴포넌트
│   ├── index.css               # 글로벌 스타일 (TailwindCSS + 커스텀 애니메이션)
│   │
│   ├── assets/
│   │   └── cbtKnowledge.ts     # CBT 전문 지식 문서 (File Search용)
│   │
│   ├── components/
│   │   └── ChatInterface.tsx   # 메인 채팅 UI 컴포넌트
│   │
│   └── services/
│       ├── gemini.ts           # Gemini API 통신 (스트리밍 + 임베딩)
│       ├── knowledgeBase.ts    # 인지 왜곡 & 소크라테스 패턴 정의
│       ├── knowledgeManager.ts # File Search Store CRUD 관리
│       ├── memoryManager.ts    # 장기 기억 추출 & 검색 (Vector RAG)
│       ├── sessionCache.ts     # 대화 이력 캐시 (IndexedDB)
│       └── vectorStore.ts      # 벡터 스토어 (IndexedDB + 코사인 유사도)
│
└── docs/                       # 설계 자료 및 API 레퍼런스 문서
```

---

## 🔑 환경 변수

`.env.example`을 `.env.local`로 복사한 후, 아래 값을 설정하세요:

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `GEMINI_API_KEY` | Google Gemini API 키 | ✅ |
| `APP_URL` | 앱 호스팅 URL (AI Studio 배포 시 자동 주입) | ❌ |

---

## 🛡️ 안전 프로토콜

Dr. Alma는 사용자 안전을 최우선으로 합니다:

> ⚠️ 사용자가 자살, 자해 또는 타해 의도를 표현할 경우:
> 1. 모든 심리치료적 개입을 **즉시 중단**
> 2. 사전 정의된 안전 스크립트 출력
> 3. 아래 긴급 연락처 자동 안내

| 서비스 | 번호 |
|--------|------|
| 자살예방상담전화 | **109** |
| 정신건강위기상담전화 | **1577-0199** |
| 긴급범죄신고 | **112** |
| 구급신고 | **119** |

---

## 📄 라이선스

이 프로젝트는 [Apache License 2.0](LICENSE) 하에 배포됩니다.

---

<div align="center">

**Dr. Alma**와 함께 건강한 사고 패턴을 만들어 보세요 🌱

</div>
