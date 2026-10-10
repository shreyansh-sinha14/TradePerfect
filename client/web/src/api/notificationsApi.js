import {api,useMocks} from './client';import {sleep} from './mockData';
let items=[{id:'N000001',type:'DRIFT_ALERT',message:'Price_ZScore drift is above threshold.',createdAt:'2026-10-10T09:00:00Z',read:false}];
export const notificationsApi={async list(){if(useMocks()){await sleep();return {items,unread:items.filter(x=>!x.read).length};}return (await api.get('/notifications')).data;},async markRead(id){if(useMocks()){await sleep();items=items.map(x=>x.id===id?{...x,read:true}:x);return {id,read:true};}return (await api.post(`/notifications/${id}/read`)).data;}};
