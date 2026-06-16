// 앱 공통 UI 상수/헬퍼.

// 다이얼로그 풀스크린은 폰(`<sm`)에서만. 패드(`≥sm`)는 중앙 다이얼로그 유지.
// 각 <DialogContent> 에 cn(dialogMobileFullscreen, ...) 으로 적용한다.
// DialogContent 기본은 `grid ... -translate-y-1/2`(중앙 정렬)라 풀스크린 시 콘텐츠가
//   세로 중앙으로 "붕 뜬다". `<sm`에서 grid→flex-col + 상단 정렬(justify-start)로 덮어 상단부터 채운다.
// `max-sm:!max-w-none` 는 각 다이얼로그의 `sm:max-w-*`를 풀스크린 구간에서 강제로 덮어 폭을 보장한다.
export const dialogMobileFullscreen =
  "max-sm:inset-0 max-sm:h-dvh max-sm:w-screen max-sm:!max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:ring-0 max-sm:flex max-sm:flex-col max-sm:items-stretch max-sm:justify-start max-sm:overflow-y-auto";

// "원본 보기" 분기: 텍스트류는 마크다운 뷰어, 그 외는 다운로드 (arch 10 §10).
export const isTextLike = (mime: string): boolean =>
  mime.startsWith("text/") || mime === "application/json";
