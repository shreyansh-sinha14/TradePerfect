import {api,useMocks} from './client';import {sleep} from './mockData';
export const healthApi={async get(){if(useMocks()){await sleep();return {status:'ok',db:'up',riskService:'up'};}return (await api.get('/health')).data;}};
