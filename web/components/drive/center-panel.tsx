"use client";

import { DocumentList } from "./document-list";

// Center = 문서 목록 전용 (하단 상세 패널 제거; 상세는 우측 인스펙터로 통합 — arch 10 §4·§8)
export const CenterPanel = () => <DocumentList />;
