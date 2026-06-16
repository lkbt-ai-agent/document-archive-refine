// 앱 공통 UI 상수/헬퍼.

// 모든 다이얼로그를 모바일(`<md`)에서 전체 화면으로 (arch 10 §12).
// 각 <DialogContent> 에 cn(dialogMobileFullscreen, ...) 으로 적용한다.
// DialogContent 기본은 `grid ... -translate-y-1/2`(중앙 정렬)라 풀스크린 시 콘텐츠가
//   세로 중앙으로 "붕 뜬다". `<md`에서 grid→flex-col + 상단 정렬(justify-start)로 덮어 상단부터 채운다.
// `max-md:!max-w-none` 는 각 다이얼로그의 `sm:max-w-*`(640px↑ 적용)를 <md 구간에서 강제로 덮어
// 풀스크린 폭을 보장한다(없으면 640~768px에서 폭이 갇혀 좌측 사이드바처럼 보임).
export const dialogMobileFullscreen =
  "max-md:inset-0 max-md:h-dvh max-md:w-screen max-md:!max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 max-md:ring-0 max-md:flex max-md:flex-col max-md:items-stretch max-md:justify-start max-md:overflow-y-auto";

// "원본 보기" 분기: 텍스트류는 마크다운 뷰어, 그 외는 다운로드 (arch 10 §10).
export const isTextLike = (mime: string): boolean =>
  mime.startsWith("text/") || mime === "application/json";
