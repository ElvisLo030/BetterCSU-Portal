/* 純資料轉換；不存取帳號、Cookie 或網路。 */
(function(root){
'use strict';
const DAY=86400000;
function date(s){const m=s.match(/^(\d{3})\.(\d{2})\.(\d{2})/);if(!m)return null;const y=+m[1]+1911,month=+m[2]-1,d=+m[3],t=Date.UTC(y,month,d),v=new Date(t);return v.getUTCFullYear()===y&&v.getUTCMonth()===month&&v.getUTCDate()===d?t:null;}
function monday(t){return t-((new Date(t).getUTCDay()+6)%7)*DAY;}
function cell(s){s=s.trim().replace(/[【［\[]/g,'〔').replace(/[】］\]]/g,'〕');if(!s)return null;if((s.match(/〔/g)||[]).length!==1)return {raw:s};const m=s.match(/^([A-Za-z0-9]{7})?([\s\S]+?)〔(\d{2}:\d{2})-(\d{2}:\d{2})〕@([^\s★]+)\s*([\s\S]*)$/);if(!m)return {raw:s};return {code:m[1]||'',name:m[2].trim(),start:m[3],end:m[4],room:m[5],note:m[6].trim()};}
const order=['1','2','3','4','5','6','7','8','9','10','N','A','B','C','D'];
function minutes(s){const [h,m]=s.split(':').map(Number);return h*60+m;}
function weekday(s){const zh=s.match(/(?:星期|週|[（(])\s*([一二三四五六日天])/);if(zh)return '一二三四五六日'.indexOf(zh[1].replace('天','日'));const en=s.match(/\b(mon|tue|wed|thu|fri|sat|sun)/i);return en?['mon','tue','wed','thu','fri','sat','sun'].indexOf(en[1].toLowerCase()):null;}
function period(s){return s.trim().match(/^(?:第\s*)?([0-9]+|[NABCD])(?:\s*節|$)/i)?.[1].toUpperCase();}
function merge(cells,periods){const blocks=[];cells.forEach((x,i)=>{if(!x)return;const p=blocks.at(-1);const a=order.indexOf(periods[i-1]),b=order.indexOf(periods[i]);if(p&&!p.raw&&!x.raw&&p.index+p.span===i&&a>=0&&b===a+1&&['code','name','room','note'].every(k=>p[k]===x[k])&&x.start>=p.end&&minutes(x.start)-minutes(p.end)<=30){p.span++;p.end=x.end;}else blocks.push({...x,index:i,span:1});});return blocks;}
function parse(headers,rows){
// 原站依帳號回傳兩種軸向；先辨識星期表頭，不以資料筆數推測。
const weekdays=headers.slice(1).map(weekday);
if(weekdays.length&&weekdays.every(d=>d!==null)){
 const valid=rows.filter(r=>period(r[0]||''));const periods=valid.map(r=>period(r[0]));
 const days=valid.length?weekdays.map((weekday,i)=>({weekday,blocks:merge(valid.map(r=>cell(r[i+1]||'')),periods)})):[];
 return {mode:'weekly',periods,days,invalidRows:rows.length-valid.length};
}
const periods=headers.slice(1).map(s=>s.match(/第\s*([0-9A-Za-z]+)\s*節/)?.[1]||s.trim());let invalidRows=0;const days=[];for(const row of rows){const t=date(row[0]||'');if(t===null){invalidRows++;continue;}days.push({date:t,blocks:merge(row.slice(1).map(cell),periods)});}days.sort((a,b)=>a.date-b.date);return {mode:'dated',periods,days,invalidRows};}
// 僅計算呈現用的軸，不修改原始課程；空白節次以仍顯示的星期為準。
function view(model,selected,options={}){
 const days=model.days.map(day=>({...day,weekday:model.mode==='weekly'?day.weekday:(day.date-selected)/DAY})).filter(d=>d.weekday>=0&&d.weekday<7);
 const weekdays=[0,1,2,3,4,5,6].filter(d=>!(options.hiddenDays||[]).includes(d)&&(!options.hideEmptyDays||days.some(x=>x.weekday===d&&x.blocks.length)));
 const visible=days.filter(d=>weekdays.includes(d.weekday));
 const indices=model.periods.map((_,i)=>i).filter(i=>!options.hideEmptyPeriods||visible.some(d=>d.blocks.some(b=>i>=b.index&&i<b.index+b.span)));
 return {weekdays,indices,days:visible};
}
function courseNames(rows,semester){const names=Object.create(null),conflicts=new Set();for(const row of rows){if(row[0]?.trim()!==semester)continue;const m=row[1]?.trim().match(/^([A-Za-z0-9]{7})\s+(.+)$/s);if(!m||/…|\.\.\./.test(m[2]))continue;const name=m[2].trim();if(names[m[1]]&&names[m[1]]!==name)conflicts.add(m[1]);names[m[1]]=name;}for(const code of conflicts)delete names[code];return names;}
const api={DAY,date,monday,cell,merge,parse,view,courseNames};if(typeof module!=='undefined')module.exports=api;else root.CSUWeeklyCore=api;
})(globalThis);
