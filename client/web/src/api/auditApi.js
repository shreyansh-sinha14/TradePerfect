import {api,useMocks} from './client';import {mock,sleep,clone} from './mockData';
export const auditApi={
 async search(params={}){if(useMocks()){await sleep();return {items:[],page:params.page||1,limit:params.limit||50,total:0};}return (await api.get('/audit',{params})).data;},
 async exportCsv(params={}){if(useMocks())return new Blob(['timestamp,eventType,actor,tradeId,queueId,summary\n'],{type:'text/csv'});return (await api.get('/audit/export.csv',{params,responseType:'blob'})).data;},
 async verify(tradeId){if(useMocks()){await sleep();return {tradeId,valid:true,checked:7,brokenAt:null};}return (await api.get('/audit/verify',{params:{tradeId}})).data;},
 async timeline(tradeId){if(useMocks()){await sleep();return clone(mock.auditTimeline);}return (await api.get(`/audit/trades/${tradeId}/timeline`)).data;},
 async latest(tradeId){if(useMocks()){await sleep();return {...clone(mock.auditLatest),tradeId};}return (await api.get(`/audit/trades/${tradeId}/latest`)).data;},
 async report(tradeId,sendTo){if(useMocks()){await sleep();return {sentTo:sendTo||null,downloaded:true};}return (await api.post(`/audit/trades/${tradeId}/report`,{sendTo},{responseType:'blob'})).data;}
};
