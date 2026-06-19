// 진행 중 업로드 XHR 취소 레지스트리(클라 세션, frontend.md §11, plan D14).
// 문서 삭제/취소 시 진행 중 PUT을 중단해 "늦은 PUT이 행 없는 오브젝트를 재생성"하는 고아를 막는다.
const controllers = new Map<string, AbortController>();

export const registerUpload = (id: string, controller: AbortController): void => {
  controllers.set(id, controller);
};

export const unregisterUpload = (id: string): void => {
  controllers.delete(id);
};

// 해당 문서의 진행 중 업로드가 있으면 중단(없으면 no-op).
export const abortUpload = (id: string): void => {
  controllers.get(id)?.abort();
  controllers.delete(id);
};
