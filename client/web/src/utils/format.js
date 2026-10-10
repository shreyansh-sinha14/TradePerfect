export const fmtScore=v=>v===null||v===undefined?'Pending':Number(v).toFixed(2);
export const fmtPct=v=>v===null||v===undefined?'—':`${(Number(v)*100).toFixed(1)}%`;
export const fmtTs=v=>v?new Date(v).toLocaleString():'—';
export const riskFactorsText=factors=>(factors||[]).map(f=>`${f.factor||f.name} ${fmtPct(f.pct??f.contribution)}`).join(', ');
