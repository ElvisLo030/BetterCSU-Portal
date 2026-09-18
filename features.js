(function(root){
'use strict';
// 只解析整段為固定字串 window.open 的格式，絕不 eval 或觸發 javascript:。
function pinTarget(href,handler,base){let raw=href?.trim()||'',blank=false;if(handler?.trim()){
 const match=handler.trim().match(/^(?:return\s+)?window\.open\(\s*(['"])([^'"\\\r\n]+)\1\s*(?:,\s*(['"])[^'"\\\r\n]*\3\s*(?:,\s*(['"])[^'"\\\r\n]*\4\s*)?)?\)\s*;?\s*(?:return\s+false\s*;?)?$/);
 if(!match)return null;raw=match[2];blank=true;
}if(!raw||raw==='#')return null;try{const url=new URL(raw,base);if(!['https:','http:'].includes(url.protocol))return null;return {url:url.href,blank};}catch{return null;}}
function creditRow(cells){const c=cells.map(s=>s.trim());if(c.length!==7||!/^\d{4}$/.test(c[0])||! /^[A-Za-z0-9]{7}\s*\//.test(c[1]))return null;return {semester:c[0],course:c[1],credits:/^\d+(?:\.\d+)?$/.test(c[2])?Number(c[2]):null,category:c[3],status:c[6]};}
function matchesCredit(r,f){return (!f.semester||r.semester===f.semester)&&(!f.category||r.category===f.category)&&(!f.status||r.status===f.status)&&(!f.query||r.course.toLocaleLowerCase().includes(f.query.trim().toLocaleLowerCase()));}
const api={pinTarget,creditRow,matchesCredit};if(typeof module!=='undefined')module.exports=api;else root.CSUFeatures=api;
})(globalThis);
