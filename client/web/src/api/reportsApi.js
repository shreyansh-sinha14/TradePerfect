import {api,useMocks} from './client';import {sleep} from './mockData';
export const reportsApi={async sendRejected(jobId){if(useMocks()){await sleep();return {sentTo:'trader-group@bank.com',rows:0,emailed:false,savedAs:`rejected_${jobId}.csv`};}return (await api.post('/reports/rejected/send',{jobId})).data;}};
