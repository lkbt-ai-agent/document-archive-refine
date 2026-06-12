---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 사용자 테이블 스키마와 MVP 인증·소유권 설계를 정의한다.
refs: research/04 §1
---

# 사용자 스키마

## 1. 테이블 DDL (스키마=archive)
```sql
CREATE TABLE archive.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2. 설계 메모
- MVP는 인증 범위 밖 → 최소 `users(id, created_at)` + 시드 1명. 모든 도메인 테이블의 `owner_id`는 이 시드 사용자를 가리킨다.
- `owner_id`는 향후 멀티테넌트 대비로 지금부터 강제.
  - 멀티테넌트(multi-tenant): 한 시스템 인스턴스를 여러 사용자·조직(테넌트)이 공유하되 데이터는 `owner_id`로 상호 격리하는 구조.
