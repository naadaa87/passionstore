// 관리자 API 진입점. 실제 처리는 저장소 루트의 server/admin-api.js에 있습니다.
import { handle } from '../../../server/admin-api.js';

export const onRequest = (context) => handle(context);
