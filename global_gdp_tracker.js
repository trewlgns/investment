import { useState, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine
} from "recharts";

// ── Anchor points (명목 GDP, 현재 USD 10억) ─────────────────────────────────
// Source: World Bank WDI · IMF WEO (2024–2025 est.)
const ANCHORS = {
  USA:     [[1950,300],[1955,415],[1960,543],[1965,744],[1970,1076],[1975,1688],[1980,2858],[1985,4339],[1990,5963],[1995,7640],[2000,10285],[2005,13094],[2010,15049],[2015,18225],[2019,21433],[2020,21060],[2021,23315],[2022,25440],[2023,27360],[2024,28780],[2025,29500]],
  China:   [[1950,28],[1955,35],[1960,60],[1965,70],[1970,92],[1975,164],[1980,191],[1985,309],[1990,361],[1995,731],[2000,1211],[2005,2286],[2010,6088],[2015,11062],[2019,14343],[2020,14688],[2021,17734],[2022,17960],[2023,17700],[2024,18530],[2025,19300]],
  Japan:   [[1950,11],[1955,24],[1960,44],[1965,91],[1970,213],[1975,521],[1980,1105],[1985,1399],[1990,3133],[1995,5449],[2000,4888],[2005,4755],[2010,5700],[2015,4395],[2019,5082],[2020,5040],[2021,4944],[2022,4230],[2023,4213],[2024,4100],[2025,4200]],
  Germany: [[1950,26],[1955,50],[1960,73],[1965,115],[1970,217],[1975,487],[1980,854],[1985,663],[1990,1764],[1995,2592],[2000,1950],[2005,2861],[2010,3418],[2015,3376],[2019,3888],[2020,3890],[2021,4260],[2022,4082],[2023,4456],[2024,4530],[2025,4600]],
  UK:      [[1950,50],[1955,63],[1960,73],[1965,101],[1970,132],[1975,244],[1980,562],[1985,479],[1990,1092],[1995,1339],[2000,1659],[2005,2545],[2010,2485],[2015,2895],[2019,2854],[2020,2707],[2021,3131],[2022,3089],[2023,3079],[2024,3300],[2025,3400]],
  France:  [[1950,30],[1955,40],[1960,62],[1965,100],[1970,148],[1975,357],[1980,701],[1985,548],[1990,1269],[1995,1604],[2000,1362],[2005,2196],[2010,2650],[2015,2439],[2019,2716],[2020,2722],[2021,2957],[2022,2784],[2023,2923],[2024,3000],[2025,3100]],
  Italy:   [[1950,20],[1955,27],[1960,40],[1965,60],[1970,113],[1975,225],[1980,480],[1985,437],[1990,1170],[1995,1172],[2000,1143],[2005,1856],[2010,2127],[2015,1837],[2019,2011],[2020,1905],[2021,2107],[2022,2068],[2023,2255],[2024,2300],[2025,2350]],
  Canada:  [[1950,28],[1955,36],[1960,41],[1965,57],[1970,87],[1975,178],[1980,274],[1985,357],[1990,594],[1995,601],[2000,742],[2005,1170],[2010,1614],[2015,1556],[2019,1741],[2020,1644],[2021,1988],[2022,2140],[2023,2140],[2024,2200],[2025,2230]],
  India:   [[1950,30],[1955,32],[1960,37],[1965,48],[1970,63],[1975,100],[1980,183],[1985,237],[1990,321],[1995,367],[2000,476],[2005,834],[2010,1729],[2015,2104],[2019,2870],[2020,2671],[2021,3150],[2022,3389],[2023,3737],[2024,4112],[2025,4500]],
  Korea:   [[1950,3],[1955,3],[1960,4],[1965,3],[1970,9],[1975,21],[1980,64],[1985,101],[1990,283],[1995,559],[2000,561],[2005,898],[2010,1094],[2015,1383],[2019,1647],[2020,1647],[2021,1811],[2022,1673],[2023,1712],[2024,1750],[2025,1800]],
  World:   [[1950,700],[1955,1000],[1960,1400],[1965,2000],[1970,3300],[1975,6400],[1980,11000],[1985,12000],[1990,22000],[1995,31000],[2000,33500],[2005,47000],[2010,65000],[2015,75000],[2019,87750],[2020,85000],[2021,97000],[2022,100000],[2023,105000],[2024,109000],[2025,114000]],
};

const COUNTRIES = [
  { key:"USA",     label:"미국",     color:"#3b82f6" },
  { key:"China",   label:"중국",     color:"#ef4444" },
  { key:"Japan",   label:"일본",     color:"#eab308" },
  { key:"Germany", label:"독일",     color:"#22c55e" },
  { key:"UK",      label:"영국",     color:"#a855f7" },
  { key:"France",  label:"프랑스",   color:"#06b6d4" },
  { key:"Italy",   label:"이탈리아", color:"#f472b6" },
  { key:"Canada",  label:"캐나다",   color:"#f97316" },
  { key:"India",   label:"인도",     color:"#fb923c" },
  { key:"Korea",   label:"한국",     color:"#94a3b8" },
];

const EVENTS = {
  1973:"오일쇼크",1979:"2차오일쇼크",1990:"냉전종식",
  1997:"아시아금융위기",2000:"닷컴버블",2008:"금융위기",2020:"COVID-19"
};

// linear interpolation between anchor points
function buildAnnual(anchors, y0, y1) {
  const rows = {};
  for (const [key, pts] of Object.entries(anchors)) {
    rows[key] = {};
    for (let i = 0; i < pts.length - 1; i++) {
      const [ya, va] = pts[i], [yb, vb] = pts[i+1];
      for (let y = ya; y < yb; y++) {
        rows[key][y] = +(va + (vb - va) * (y - ya) / (yb - ya)).toFixed(1);
      }
    }
    const last = pts[pts.length-1];
    rows[key][last[0]] = last[1];
  }
  const out = [];
  for (let y = y0; y <= y1; y++) {
    const d = { year: y, est: y >= 2024 };
    for (const key of Object.keys(anchors)) d[key] = rows[key][y] ?? null;
    out.push(d);
  }
  return out;
}

const BASE_DATA = buildAnnual(ANCHORS, 1950, 2025);

const fmt = v => {
  if (v == null) return "N/A";
  return v >= 1000 ? `$${(v/1000).toFixed(2)}T` : `$${Math.round(v)}B`;
};
const yFmt = v => v >= 1000 ? `$${(v/1000).toFixed(0)}T` : `$${v}B`;

export default function App() {
  const [log,    setLog]    = useState(false);
  const [sel,    setSel]    = useState(COUNTRIES.map(c => c.key));
  const [yr0,    setYr0]    = useState(1950);
  const [yr1,    setYr1]    = useState(2025);
  const [custom, setCustom] = useState(null);
  const fileRef = useRef();

  const allData = custom ?? BASE_DATA;

  const filtered = useMemo(() =>
    allData.filter(d => d.year >= yr0 && d.year <= yr1),
    [allData, yr0, yr1]
  );

  const shareData = useMemo(() =>
    filtered.map(d => ({
      year: d.year,
      est:  d.est,
      share: d.World ? +(d.USA / d.World * 100).toFixed(2) : null,
    })),
    [filtered]
  );

  const peak   = useMemo(() => shareData.reduce((a,b) => b.share > (a?.share||0) ? b : a, null), [shareData]);
  const latest = shareData[shareData.length - 1];

  const toggle = k => setSel(p => p.includes(k) ? p.filter(x=>x!==k) : [...p, k]);

  const handleCSV = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const lines = ev.target.result.split("\n").filter(l=>l.trim());
      const hdrs  = lines[0].split(",").map(h=>h.trim());
      const parsed = lines.slice(1).map(line => {
        const v = line.split(",");
        const obj = { est: false };
        hdrs.forEach((h,i) => { obj[h] = h==="year" ? +v[i] : (parseFloat(v[i])||null); });
        return obj;
      });
      setCustom(parsed);
    };
    r.readAsText(f);
    e.target.value = "";
  };

  const eventsInRange = Object.entries(EVENTS).filter(([y]) => +y>=yr0 && +y<=yr1);
  const ctrs = COUNTRIES.filter(c => sel.includes(c.key));
  const hasCustom = !!custom;

  const s = {
    wrap: { background:"#0f172a", color:"#e2e8f0", minHeight:"100vh", padding:"20px 14px", fontFamily:"system-ui,sans-serif" },
    card: { background:"#1e293b", borderRadius:12, padding:"16px 4px 10px", marginBottom:18, border:"1px solid #334155" },
    btn:  (a,col="#2563eb") => ({
      padding:"5px 14px", borderRadius:8, border:"1px solid #334155",
      background: a ? col : "#1e293b",
      color: a ? "#fff" : "#64748b",
      cursor:"pointer", fontSize:12, fontWeight: a ? 700 : 400,
    }),
  };

  const CustomDot = ({ cx, cy, payload }) =>
    payload?.est ? <circle cx={cx} cy={cy} r={3} fill="#fbbf24" stroke="none"/> : null;

  return (
    <div style={s.wrap}>
      {/* Title */}
      <div style={{ textAlign:"center", marginBottom:16 }}>
        <h1 style={{ fontSize:20, fontWeight:800, color:"#f8fafc", margin:"0 0 4px" }}>세계 명목 GDP 추이</h1>
        <p style={{ fontSize:11, color:"#475569", margin:0 }}>
          현재 미국달러(Nominal USD) · World Bank WDI · IMF WEO · 앵커 구간 선형보간 포함
          &nbsp;·&nbsp;<span style={{color:"#fbbf24"}}>●</span> = IMF 추정치 (2024–2025)
        </p>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginBottom:12 }}>
        <button onClick={()=>setLog(!log)} style={s.btn(log,"#475569")}>
          {log?"✓ ":""}로그 스케일
        </button>
        <button onClick={()=>fileRef.current.click()} style={s.btn(hasCustom,"#166534")}>
          {hasCustom?"✓ CSV 로드됨":"📁 CSV 업로드"}
        </button>
        {hasCustom && <button onClick={()=>setCustom(null)} style={s.btn(false)}>초기화</button>}
        <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleCSV}/>
      </div>

      {/* Year Range */}
      <div style={{ background:"#1e293b", borderRadius:8, padding:"10px 16px", marginBottom:12,
        display:"flex", flexWrap:"wrap", alignItems:"center", gap:10, justifyContent:"center", border:"1px solid #334155" }}>
        <span style={{fontSize:12,color:"#94a3b8"}}>시작: <strong style={{color:"#e2e8f0"}}>{yr0}년</strong></span>
        <input type="range" min={1950} max={Math.min(2025,yr1-3)} value={yr0}
          onChange={e=>setYr0(+e.target.value)} style={{width:130,accentColor:"#2563eb"}}/>
        <input type="range" min={Math.max(1950,yr0+3)} max={2025} value={yr1}
          onChange={e=>setYr1(+e.target.value)} style={{width:130,accentColor:"#2563eb"}}/>
        <span style={{fontSize:12,color:"#94a3b8"}}>종료: <strong style={{color:"#e2e8f0"}}>{yr1}년</strong></span>
      </div>

      {/* Country Toggles */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", marginBottom:18 }}>
        <button onClick={()=>setSel(sel.length===COUNTRIES.length ? [] : COUNTRIES.map(c=>c.key))}
          style={{padding:"3px 10px",borderRadius:999,border:"1px solid #475569",
            background:"#1e293b",color:"#64748b",cursor:"pointer",fontSize:11}}>
          {sel.length===COUNTRIES.length?"전체 해제":"전체 선택"}
        </button>
        {COUNTRIES.map(c=>(
          <button key={c.key} onClick={()=>toggle(c.key)}
            style={{
              padding:"3px 10px", borderRadius:999,
              border:`2px solid ${c.color}`,
              background: sel.includes(c.key) ? c.color+"28" : "transparent",
              color: sel.includes(c.key) ? c.color : "#334155",
              cursor:"pointer", fontSize:11, fontWeight: sel.includes(c.key)?700:400,
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Chart 1 — GDP */}
      <div style={s.card}>
        <h2 style={{textAlign:"center",fontSize:13,fontWeight:600,color:"#94a3b8",margin:"0 0 10px"}}>
          국가별 명목 GDP (현재 USD)
        </h2>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={filtered} margin={{top:5,right:20,left:10,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
            <XAxis dataKey="year" stroke="#334155" tick={{fontSize:10,fill:"#64748b"}}
              tickCount={Math.min(filtered.length, 15)}/>
            <YAxis scale={log?"log":"linear"} domain={log?[3,"auto"]:[0,"auto"]}
              allowDataOverflow tickFormatter={yFmt}
              stroke="#334155" tick={{fontSize:10,fill:"#64748b"}} width={65}/>
            <Tooltip
              contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,fontSize:12}}
              labelStyle={{color:"#e2e8f0",fontWeight:700,marginBottom:4}}
              labelFormatter={y => {
                const d = filtered.find(r=>r.year===y);
                return `${y}년${d?.est?" (IMF 추정)":""}`;
              }}
              formatter={(v,k) => [fmt(v), COUNTRIES.find(c=>c.key===k)?.label ?? k]}
            />
            <Legend formatter={k=>COUNTRIES.find(c=>c.key===k)?.label??k}
              wrapperStyle={{fontSize:11,paddingTop:6}}/>
            {eventsInRange.map(([y,label])=>(
              <ReferenceLine key={y} x={+y} stroke="#475569" strokeDasharray="3 3"
                label={{value:label,position:"insideTopLeft",fill:"#94a3b8",fontSize:9,angle:-45,dx:2}}/>
            ))}
            <ReferenceLine x={2024} stroke="#fbbf2455" strokeDasharray="4 4"/>
            {ctrs.map(c=>(
              <Line key={c.key} type="monotone" dataKey={c.key}
                stroke={c.color} strokeWidth={2}
                dot={<CustomDot/>}
                activeDot={{r:5}}
                connectNulls/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — US Share */}
      <div style={s.card}>
        <h2 style={{textAlign:"center",fontSize:13,fontWeight:600,color:"#94a3b8",margin:"0 0 10px"}}>
          미국의 세계 GDP 비중 (%)
        </h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={shareData} margin={{top:5,right:20,left:0,bottom:5}}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
            <XAxis dataKey="year" stroke="#334155" tick={{fontSize:10,fill:"#64748b"}}
              tickCount={Math.min(shareData.length,15)}/>
            <YAxis domain={[0,55]} tickFormatter={v=>`${v}%`}
              stroke="#334155" tick={{fontSize:10,fill:"#64748b"}} width={38}/>
            <Tooltip
              contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,fontSize:12}}
              labelStyle={{color:"#e2e8f0",fontWeight:700}}
              labelFormatter={y=>{
                const d=shareData.find(r=>r.year===y);
                return `${y}년${d?.est?" (IMF 추정)":""}`;
              }}
              formatter={v=>[`${v}%`,"미국 비중"]}/>
            <ReferenceLine y={25} stroke="#475569" strokeDasharray="4 4"
              label={{value:"25%",position:"right",fill:"#64748b",fontSize:10}}/>
            <ReferenceLine x={2024} stroke="#fbbf2455" strokeDasharray="4 4"/>
            {eventsInRange.map(([y])=>(
              <ReferenceLine key={y} x={+y} stroke="#334155" strokeDasharray="3 3"/>
            ))}
            <Area type="monotone" dataKey="share" stroke="#3b82f6" strokeWidth={2.5}
              fill="url(#grad)" dot={<CustomDot/>} connectNulls/>
          </AreaChart>
        </ResponsiveContainer>
        {peak && latest && (
          <div style={{display:"flex",justifyContent:"center",gap:28,fontSize:12,color:"#64748b",marginTop:10,paddingRight:16}}>
            <span>📈 최고: <strong style={{color:"#93c5fd"}}>{peak.year}년 {peak.share}%</strong></span>
            <span>📍 최근: <strong style={{color:"#93c5fd"}}>{latest.year}년 {latest.share}%</strong></span>
            <span>📉 변화: <strong style={{color:"#f87171"}}>−{(peak.share-latest.share).toFixed(1)}%p</strong></span>
          </div>
        )}
      </div>

      {/* CSV Guide */}
      <div style={{background:"#0f172a",borderRadius:8,padding:"10px 14px",border:"1px solid #1e293b"}}>
        <p style={{margin:0,fontSize:11,color:"#475569",lineHeight:1.8}}>
          <strong style={{color:"#64748b"}}>CSV 업로드 형식</strong> (단위: 10억 USD · World 컬럼 필수)<br/>
          <code style={{background:"#1e293b",padding:"2px 6px",borderRadius:4,color:"#94a3b8",fontSize:10}}>
            year,USA,China,Japan,Germany,UK,France,Italy,Canada,India,Korea,World
          </code>
        </p>
      </div>
    </div>
  );
}
