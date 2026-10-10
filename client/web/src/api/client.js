import axios from 'axios';
import { tokenStore } from '../auth/tokenStore';
export const api = axios.create({ baseURL:`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1`, timeout:30000 });
api.interceptors.request.use(config=>{const token=tokenStore.getToken();if(token)config.headers.Authorization=`Bearer ${token}`;return config;});
export function toApiError(err){
  const data=err?.response?.data||{};
  return {status:err?.response?.status||0,code:data.error?.code||data.code||'INTERNAL',message:data.error?.message||data.message||(err?.code==='ECONNABORTED'?'Request timed out.':'Cannot reach the server.'),details:data.error?.details||data.details||[],requestId:data.requestId||err?.response?.headers?.['x-request-id']||null};
}
api.interceptors.response.use(r=>r,err=>{
  if(err?.response?.status===401 && !window.location.pathname.endsWith('/login')){tokenStore.clearToken();window.location.assign('/login');}
  return Promise.reject(toApiError(err));
});
export const useMocks = () => String(import.meta.env.VITE_USE_MOCKS ?? 'true').toLowerCase()==='true';
