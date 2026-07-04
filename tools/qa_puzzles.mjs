import { readFileSync } from 'fs';
// ---- solver (from nonogram_validate) ----
function lineClue(a){const c=[];let r=0;for(const v of a){if(v===1)r++;else if(r){c.push(r);r=0}}if(r)c.push(r);return c.length?c:[0];}
function placements(clue,len){if(clue.length===1&&clue[0]===0)return[new Array(len).fill(0)];const res=[],k=clue.length,tot=clue.reduce((a,b)=>a+b,0);if(len-tot-(k-1)<0)return res;function rec(idx,pos,line){if(idx===k){const l=line.slice();for(let i=pos;i<len;i++)l[i]=0;res.push(l);return;}const maxStart=len-(clue.slice(idx).reduce((a,b)=>a+b,0)+(k-1-idx));for(let s=pos;s<=maxStart;s++){const l=line.slice();for(let i=pos;i<s;i++)l[i]=0;for(let i=s;i<s+clue[idx];i++)l[i]=1;let n=s+clue[idx];if(idx<k-1){l[n]=0;n++;}rec(idx+1,n,l);}}rec(0,0,new Array(len).fill(0));return res;}
const consistent=(p,k)=>{for(let i=0;i<p.length;i++)if(k[i]!==-1&&k[i]!==p[i])return false;return true;};
function forced(ps){if(!ps.length)return null;const n=ps[0].length,o=new Array(n).fill(-2);for(const p of ps)for(let i=0;i<n;i++){if(o[i]===-2)o[i]=p[i];else if(o[i]!==p[i])o[i]=-1;}return o;}
function solveCount(rC,cC,cap=2){const H=rC.length,W=cC.length,rP=rC.map(c=>placements(c,W)),cP=cC.map(c=>placements(c,H));const start=Array.from({length:H},()=>new Array(W).fill(-1));
function prop(g0){const g=g0.map(r=>r.slice());let ch=true;while(ch){ch=false;for(let r=0;r<H;r++){const f=forced(rP[r].filter(p=>consistent(p,g[r])));if(f===null)return null;for(let c=0;c<W;c++)if(f[c]!==-1&&g[r][c]===-1){g[r][c]=f[c];ch=true;}}for(let c=0;c<W;c++){const col=g.map(r=>r[c]);const f=forced(cP[c].filter(p=>consistent(p,col)));if(f===null)return null;for(let r=0;r<H;r++)if(f[r]!==-1&&g[r][c]===-1){g[r][c]=f[r];ch=true;}}}return g;}
let cnt=0;function dfs(gr){if(cnt>=cap)return;const g=prop(gr);if(g===null)return;let ur=-1,uc=-1;outer:for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(g[r][c]===-1){ur=r;uc=c;break outer;}if(ur===-1){cnt++;return;}for(const v of[1,0]){const g2=g.map(x=>x.slice());g2[ur][uc]=v;dfs(g2);if(cnt>=cap)return;}}dfs(start);return cnt;}
// ---- load puzzles.js ----
const src=readFileSync('puzzles.js','utf8'); const win={}; new Function('window',src)(win);
const P=win.PUZZLES;
let ok=0,bad=[];
for(const p of P){
  const sol=p.solution, W=sol[0].length;
  if(!sol.every(r=>r.length===W)){bad.push(p.id+':RAGGED');continue;}
  const rC=sol.map(lineClue), cC=[];for(let c=0;c<W;c++)cC.push(lineClue(sol.map(r=>r[c])));
  const n=solveCount(rC,cC,2);
  if(n===1)ok++; else bad.push(`${p.id}:${n===0?'NO-SOL':'AMBIGUOUS'}`);
}
console.log(`total ${P.length} | unique-solvable ${ok} | problems: ${bad.length?bad.join(', '):'none'}`);
// duplicate id check
const ids=P.map(p=>p.id), dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
console.log('duplicate ids:', dup.length?[...new Set(dup)]:'none');
