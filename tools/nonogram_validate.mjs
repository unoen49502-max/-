// Nonogram uniqueness validator.
// Authoring format: each puzzle = { id, name, difficulty, art:[ "..#..", ... ] }
// '#' = filled(1), anything else = empty(0).
// Verifies the clues derived from the art yield EXACTLY ONE solution.

// ---- clue derivation ----
function lineClue(arr){ const c=[];let r=0;for(const v of arr){if(v){r++}else if(r){c.push(r);r=0}}if(r)c.push(r);return c.length?c:[0];}
function rowClues(g){return g.map(lineClue);}
function colClues(g){const w=g[0].length,o=[];for(let c=0;c<w;c++)o.push(lineClue(g.map(r=>r[c])));return o;}

// ---- placement enumeration for one line ----
// returns all binary arrays (length len) matching clue
function placements(clue, len){
  if(clue.length===1 && clue[0]===0){ return [new Array(len).fill(0)]; }
  const res=[];
  const k=clue.length, total=clue.reduce((a,b)=>a+b,0);
  const slack=len-total-(k-1);
  if(slack<0) return res;
  // distribute gaps g0..gk (before each block + after last), g_i>=0, and >=1 between blocks handled by baseline
  function rec(idx, pos, line){
    if(idx===k){ const l=line.slice(); for(let i=pos;i<len;i++)l[i]=0; res.push(l); return; }
    const maxStart = len - (clue.slice(idx).reduce((a,b)=>a+b,0) + (k-1-idx));
    for(let s=pos; s<=maxStart; s++){
      const l=line.slice();
      for(let i=pos;i<s;i++)l[i]=0;
      for(let i=s;i<s+clue[idx];i++)l[i]=1;
      let next=s+clue[idx];
      if(idx<k-1){ l[next]=0; next++; }
      rec(idx+1, next, l);
    }
  }
  rec(0,0,new Array(len).fill(0));
  return res;
}

// filter placements consistent with known cells (known: -1 unknown,0,1)
function consistent(p, known){
  for(let i=0;i<p.length;i++){ if(known[i]!==-1 && known[i]!==p[i]) return false; }
  return true;
}

// intersect placements -> forced values (-1 if ambiguous). null if no placement.
function forced(ps){
  if(ps.length===0) return null;
  const n=ps[0].length, out=new Array(n).fill(-2);
  for(const p of ps){ for(let i=0;i<n;i++){ if(out[i]===-2)out[i]=p[i]; else if(out[i]!==p[i])out[i]=-1; } }
  return out;
}

function solveCount(rClues, cClues, cap=2){
  const H=rClues.length, W=cClues.length;
  // precompute placements per row/col (unconstrained) - we filter each pass
  const rowP = rClues.map(c=>placements(c,W));
  const colP = cClues.map(c=>placements(c,H));
  const start = Array.from({length:H},()=>new Array(W).fill(-1));

  function propagate(gridIn){
    const g=gridIn.map(r=>r.slice());
    let changed=true;
    while(changed){
      changed=false;
      for(let r=0;r<H;r++){
        const ps=rowP[r].filter(p=>consistent(p,g[r]));
        const f=forced(ps); if(f===null) return null;
        for(let c=0;c<W;c++){ if(f[c]!==-1 && g[r][c]===-1){ g[r][c]=f[c]; changed=true; } }
      }
      for(let c=0;c<W;c++){
        const col=g.map(r=>r[c]);
        const ps=colP[c].filter(p=>consistent(p,col));
        const f=forced(ps); if(f===null) return null;
        for(let r=0;r<H;r++){ if(f[r]!==-1 && g[r][c]===-1){ g[r][c]=f[r]; changed=true; } }
      }
    }
    return g;
  }

  let count=0;
  function dfs(grid){
    if(count>=cap) return;
    const g=propagate(grid);
    if(g===null) return;
    let ur=-1,uc=-1;
    outer: for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(g[r][c]===-1){ur=r;uc=c;break outer;}
    if(ur===-1){ count++; return; }
    for(const v of [1,0]){ const g2=g.map(x=>x.slice()); g2[ur][uc]=v; dfs(g2); if(count>=cap)return; }
  }
  dfs(start);
  return count;
}

// ---- candidate puzzles ----
import { readFileSync } from 'fs';
const CAND = JSON.parse(readFileSync(process.argv[2],'utf8'));

const good=[], bad=[];
for(const p of CAND){
  const g = p.art.map(row=>[...row].map(ch=>ch==='#'?1:0));
  const H=g.length, W=g[0].length;
  if(!g.every(r=>r.length===W)){ bad.push([p.id,'RAGGED rows']); continue; }
  const rC=rowClues(g), cC=colClues(g);
  const n=solveCount(rC,cC,2);
  if(n===1) good.push(p);
  else bad.push([p.id, n===0?'NO solution(bug)':'AMBIGUOUS(>=2)', `${W}x${H}`]);
}
console.log('UNIQUE:', good.map(p=>p.id).join(', '));
console.log('REJECT:', bad.map(b=>b.join(' ')).join(' | ')||'(none)');
console.log('---JS---');
const out = good.map(p=>{
  const sol = p.art.map(row=>'['+[...row].map(ch=>ch==='#'?1:0).join(',')+']').join(',\n      ');
  return `  {\n    id: "${p.id}",\n    name: "${p.name}",\n    difficulty: ${p.difficulty},\n    solution: [\n      ${sol},\n    ],\n  },`;
}).join('\n');
console.log(out);
