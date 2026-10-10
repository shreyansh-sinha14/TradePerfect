import {api,useMocks} from './client'; import {mock,sleep,clone} from './mockData';
export const bulkApi={
 async upload(file,asOfMode='TODAY'){if(useMocks()){await sleep(500);return {...clone(mock.uploadJob),jobId:`J${String(Date.now()).slice(-6)}`,fileName:file.name,status:'COMPLETED',asOfMode,total:0,processed:0,accepted:0,rejected:0};}const fd=new FormData();fd.append('file',file);fd.append('asOfMode',asOfMode);return (await api.post('/trades/bulk',fd,{headers:{'Content-Type':'multipart/form-data'}})).data;},
 async job(jobId){if(useMocks()){await sleep();return {...clone(mock.uploadJob),jobId};}return (await api.get(`/trades/bulk/${jobId}`)).data;},
 async rejectionsCsv(jobId){if(useMocks()){return new Blob(['tradeId,ruleIds,messages\n'],{type:'text/csv'});}return (await api.get(`/trades/bulk/${jobId}/rejections.csv`,{responseType:'blob'})).data;}
};
