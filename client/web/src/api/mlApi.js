import {api,useMocks} from './client';import {sleep} from './mockData';
const metricsMock={version:'rf-v1',threshold:0.42,metrics:{auc:0.93,precision:0.91,recall:0.87,f1:0.82,accuracy:0.94,fpr:0.03},runs:[]};
export const mlApi={
 async metrics(params={}){if(useMocks()){await sleep();return metricsMock;}return (await api.get('/ml/metrics',{params})).data;},
 async drift(){if(useMocks()){await sleep();return {lastRunAt:'2026-10-10T09:00:00Z',threshold:0.2,sampleSize:5000,features:[{name:'SSI_Matched',psi:0.05,severity:'GREEN'},{name:'Price_ZScore',psi:0.27,severity:'RED'}]};}return (await api.get('/ml/drift')).data;},
 async runDrift(){if(useMocks()){await sleep();return {runId:`D${Date.now()}`,status:'COMPLETED'};}return (await api.post('/ml/drift/run')).data;},
 async shapGlobal(){if(useMocks()){await sleep();return {modelVersion:'rf-v1',features:[{name:'Rule_Engine_Output',meanAbsShap:0.21},{name:'SSI_Matched',meanAbsShap:0.18},{name:'Price_ZScore',meanAbsShap:0.12}]};}return (await api.get('/ml/shap/global')).data;},
 async models(){if(useMocks()){await sleep();return {items:[{version:'rf-v1',trainedAt:'2026-10-01T00:00:00Z',status:'ACTIVE',passedGate:true,metrics:metricsMock.metrics},{version:'rf-v2',trainedAt:'2026-10-09T00:00:00Z',status:'CANDIDATE',passedGate:false,metrics:{...metricsMock.metrics,recall:0.81}}]};}return (await api.get('/ml/models')).data;},
 async promote(version){if(useMocks()){await sleep();return {version,status:'ACTIVE'};}return (await api.post(`/ml/models/${version}/promote`)).data;},
 async rollback(version){if(useMocks()){await sleep();return {version,status:'ACTIVE'};}return (await api.post(`/ml/models/${version}/rollback`)).data;},
 async retrain(){if(useMocks()){await sleep();return {runId:`R${Date.now()}`,status:'PENDING'};}return (await api.post('/ml/retrain')).data;}
};
