import {api,useMocks} from './client';import {mock,sleep,clone} from './mockData';
export const dashboardApi={async summary(){if(useMocks()){await sleep();return clone(mock.dashboardSummary);}return (await api.get('/dashboard/summary')).data;},async patterns(){if(useMocks()){await sleep();return clone(mock.dashboardPatterns);}return (await api.get('/dashboard/patterns')).data;}};
