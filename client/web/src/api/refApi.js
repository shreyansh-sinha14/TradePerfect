import { api,useMocks } from './client';
import { sleep } from './mockData';
const data={symbols:[{symbol:'INFY',name:'Infosys Ltd'},{symbol:'TCS',name:'Tata Consultancy Services'},{symbol:'RELIANCE',name:'Reliance Industries'}],counterparties:[{counterparty:'ABC_BANK',name:'ABC Bank'},{counterparty:'XYZ_BANK',name:'XYZ Bank'}],accounts:[{accountId:'ACC7788',name:'Prop Desk 1',status:'ACTIVE'},{accountId:'ACC8899',name:'Prop Desk 2',status:'ACTIVE'}]};
export const refApi={
 async symbols(){if(useMocks()){await sleep();return {items:data.symbols};}return (await api.get('/ref/symbols')).data;},
 async counterparties(){if(useMocks()){await sleep();return {items:data.counterparties};}return (await api.get('/ref/counterparties')).data;},
 async accounts(active=true){if(useMocks()){await sleep();return {items:data.accounts.filter(x=>!active||x.status==='ACTIVE')};}return (await api.get(`/ref/accounts${active?'?active=true':''}`)).data;}
};
