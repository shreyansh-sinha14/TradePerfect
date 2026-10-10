import dayjs from 'dayjs';
export const todayStr=()=>dayjs().format('YYYY-MM-DD');
export const nextBusinessDay=date=>{let d=dayjs(date);do{d=d.add(1,'day')}while(d.day()===0||d.day()===6);return d.format('YYYY-MM-DD');};
export const fmtDate=v=>v?dayjs(v).format('DD MMM YYYY'):'—';
