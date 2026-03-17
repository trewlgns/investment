import { useState, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine
} from "recharts";

// ── IMF COFER — 외환보유액 통화구성 (%, 배분된 보유액 기준) ─────────────────
// Source: IMF COFER database · pre-1995 추정치 포함
const COFER_ANCHORS = {
  USD: [[1950,50],[1955,55],[1960,59],[1965,56],[1970,77],[1973,76],[1977,80],[1980,68],[1985,65],[1990,50],[1995,59],[1999,71],[2001,71],[2002,67],[2005,66],[2008,64],[2009,62],[2010,61],[2013,61],[2015,65],[2016,65],[2017,63],[2018,62],[2019,61],[2020,59],[2021,59],[2022,58],[2023,58],[2024,57],[2025,57]],
  EUR: [[1999,18],[2001,19],[2003,25],[2007,26],[2009,28],[2010,26],[2013,24],[2015,20],[2018,20],[2020,21],[2022,20],[2023,20],[2024,20],[2025,20]],
  GBP: [[1950,55],[1960,30],[1970,10],[1980,3],[1990,3],[2000,3],[2005,4],[2010,4],[2015,5],[2020,5],[2022,5],[2025,5]],
  JPY: [[1975,0],[1980,4],[1985,8],[1990,9],[1995,7],[2000,6],[2005,4],[2010,4],[2015,4],[2020,6],[2022,5],[2025,5]],
  CNY: [[2015,1],[2016,1],[2017,1],[2018,2],[2019,2],[2020,2],[2021,3],[2022,3],[2023,3],[2024,3],[2025,3]],
  Other:[[1950,0],[1955,2],[1960,5],[1970,5],[1980,11],[1990,22],[1995,18],[1999,7],[2005,8],[2010,9],[2015,5],[2020,7],[2022,8],[2025,8]],
};

// ── SWIFT — 국제결제 메시지 통화 비중 (%, value-based) ──────────────────────
// Source: SWIFT RMB Tracker · SWIFT data releases
const SWIFT_ANCHORS = {
  USD:  [[2012,33],[2013,38],[2014,43],[2015,45],[2016,40],[2017,39],[2018,40],[2019,42],[2020,38],[2021,38],[2022,42],[2023,47],[2024,48],[2025,47]],
  EUR:  [[2012,40],[2013,34],[2014,28],[2015,28],[2016,31],[2017,33],[2018,33],[2019,32],[2020,37],[2021,37],[2022,37],[2023,23],[2024,22],[2025,23]],
  GBP:  [[2012,9],[2013,8],[2014,8],[2015,9],[2016,7],[2017,7],[2018,7],[2019,7],[2020,6],[2021,6],[2022,6],[2023,7],[2024,7],[2025,7]],
  JPY:  [[2012,4],[2013,3],[2014,3],[2015,3],[2016,3],[2017,3],[2018,3],[2019,3],[2020,3],[2021,3],[2022,3],[2023,4],[2024,4],[2025,4]],
  CNY:  [[2012,0.2],[2013,0.8],[2014,2],[2015,2.5],[2016,1.7],[2017,2],[2018,2],[2019,2],[2020,2],[2021,3],[2022,3],[2023,4],[2024,5],[2025,5]],
  Other:[[2012,14],[2013,16],[2014,16],[2015,13],[2016,18],[2017,16],[2018,15],[2019,14],[2020,14],[2021,13],[2022,9],[2023,15],[2024,14],[2025,14]],
};

function buildAnnual(anchors, y0, y1) {
  const rows = {};
  for (const [key, pts] of Object.entries(anchors)) {
    rows[key] = {};
    for (let i = 0; i < pts.length - 1; i++) {
      const [ya,va] = pts[i], [yb,vb] = pts[i+1];
      for (let y = ya; y < yb; y++)
        rows[key][y] = +(va + (vb-va)*(y-ya)/(yb-ya)).toFixed(2);
    }
    const last = pts[pts.length-1];
    rows[key][last[0]] = last[1];
  }
  const out = [];
  for (let y = y0; y <= y1; y++) {
    const d = { year:y };
    for (const key of Object.keys(anchors)) d[key] = rows[key][y] ?? null;
    out.push(d);
  }
  return out;
}

const COFER_DATA  = buildAnnual(COFER_ANCHORS, 1950, 2025);
const SWIFT_DATA  = buildAnnual(SWIFT_ANCHORS, 2012, 2025);

const CURRENCIES = [
  { key:"USD",   label:"USD",   color:"#3b82f6", desc:"미국 달러" },
  { key:"EUR",   label:"EUR",   color:"#f59e0b", desc:"유로 (COFER 1999~)" },
  { key:"GBP",   label:"GBP",   color:"#a855f7", desc:"영국 파운드" },
  { key:"JPY",   label:"JPY",   color:"#22c55e", desc:"일본 엔" },
  { key:"CNY",   label:"CNY",   color:"#ef4444", desc:"중국 위안" },
  { key:"Other", label:"기타",  color:"#64748b", desc:"기타 통화" },
];

const COFER_EVENTS = {
  1971:"닉슨쇼크\n(금본위 종료)",
  1985:"플라자합의",
  1999:"유로 출범",
  2008:"금융위기",
  2015:"CNY SDR 편입",
  2022:"러시아 제재",
};
const SWIFT_EVENTS = {
  2015:"CNY SDR 편입",
  2020:"COVID-19",
  2022:"러시아 제재",
};

export default function App() {
  const [tab,  setTab]  = useState("cofer");
  const [sel,  setSel]  = useState(["USD"]);
  const [yr0,  setYr0]  = useState(1950);
  const [yr1,  setYr1]  = useState(2025);
  const [log,  setLog]  = useState(false);
  const [custom, setCustom] = useState(null);
  const fileRef = useRef();

  const isCofer = tab === "cofer";
  const baseData = isCofer ? COFER_DATA : SWIFT_DATA;
  const allData  = custom ?? baseData;
  const minY = isCofer ? 1950 : 2012;

  const safeYr0 = Math.max(yr0, minY);

  const filtered = useMemo(() =>
    allData.filter(d => d.year >= safeYr0 && d.year <= yr1),
    [allData, safeYr0, yr1]
  );

  const events = isCofer ? COFER_EVENTS : SWIFT_EVENTS;
  const eventsInRange = Object.entries(events).filter(([y])=> +y>=safeYr0 && +y<=yr1);

  const toggle = k => setSel(p => p.includes(k) ? p.filter(x=>x!==k) : [...p,k]);

  const handleCSV = e => {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const lines = ev.target.result.split("\n").filter(l=>l.trim());
      const hdrs  = lines[0].split(",").map(h=>h.trim());
      const parsed = lines.slice(1).map(line => {
        const v = line.split(",");
        const obj = {};
        hdrs.forEach((h,i) => { obj[h] = h==="year" ? +v[i] : (parseFloat(v[i])||null); });
        return obj;
      });
      setCustom(parsed);
    };
    r.readAsText(f); e.target.value="";
  };

  const ctrs = CURRENCIES.filter(c => sel.includes(c.key));

  // USD 최고/최저 포인트
  const usdData = filtered.filter(d => d.USD != null);
  const usdPeak = usdData.reduce((a,b)=> b.USD>(a?.USD||0)?b:a, null);
  const usdLow  = usdData.reduce((a,b)=> b.USD<(a?.USD||999)?b:a, null);
  const usdLatest = usdData[usdData.length-1];

  const s = {
    wrap: { background:"#0f172a", color:"#e2e8f0", minHeight:"100vh", padding:"20px 14px", fontFamily:"system-ui,sans-serif" },
    card: { background:"#1e293b", borderRadius:12, padding:"16px 4px 10px", marginBottom:18, border:"1px solid #334155" },
    tabBtn: (a) => ({
      padding:"7px 18px", border:"none", cursor:"pointer", fontSize:12, fontWeight: a?700:400,
      background: a?"#2563eb":"transparent", color: a?"#fff":"#64748b",
    }),
    btn: (a,col="#475569") => ({
      padding:"5px 14px", borderRadius:8, border:"1px solid #334155",
      background: a?col:"#1e293b", color: a?"#fff":"#64748b",
      cursor:"pointer", fontSize:12, fontWeight: a?700:400,
    }),
  };

  return (
    <div style={s.wrap}>
      {/* Title */}
      <div style={{textAlign:"center",marginBottom:16}}>
        <h1 style={{fontSize:20,fontWeight:800,color:"#f8fafc",margin:"0 0 4px"}}>
          국제통화 비중 추이
        </h1>
        <p style={{fontSize:11,color:"#475569",margin:0}}>
          COFER: IMF 외환보유액 통화구성 · SWIFT: 국제결제 메시지 통화 비중 (value-based)
        </p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
        <div style={{background:"#1e293b",borderRadius:8,overflow:"hidden",border:"1px solid #334155"}}>
          <button onClick={()=>{setTab("cofer");setCustom(null);setYr0(1950);}}
            style={s.tabBtn(isCofer)}>
            IMF COFER&nbsp;
            <span style={{fontSize:10,opacity:0.7}}>외환보유액 (1950–2025)</span>
          </button>
          <button onClick={()=>{setTab("swift");setCustom(null);setYr0(2012);}}
            style={s.tabBtn(!isCofer)}>
            SWIFT&nbsp;
            <span style={{fontSize:10,opacity:0.7}}>국제결제 (2012–2025)</span>
          </button>
        </div>
      </div>

      {/* Source note */}
      <div style={{textAlign:"center",marginBottom:12}}>
        {isCofer
          ? <p style={{fontSize:10,color:"#475569",margin:0}}>앵커 구간 선형보간 · 1995년 이전은 추정치 · 2024–2025년은 IMF 전망</p>
          : <p style={{fontSize:10,color:"#475569",margin:0}}>SWIFT RMB Tracker 월간 데이터 연평균 · 2025년은 추정치</p>
        }
      </div>

      {/* Controls */}
      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:12}}>
        <button onClick={()=>setLog(!log)} style={s.btn(log)}>
          {log?"✓ ":""}로그 스케일
        </button>
        <button onClick={()=>fileRef.current.click()} style={s.btn(!!custom,"#166534")}>
          {custom?"✓ CSV 로드됨":"📁 CSV 업로드"}
        </button>
        {custom && <button onClick={()=>setCustom(null)} style={s.btn(false)}>초기화</button>}
        <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleCSV}/>
      </div>

      {/* Year Range — COFER only */}
      {isCofer && (
        <div style={{background:"#1e293b",borderRadius:8,padding:"10px 16px",marginBottom:12,
          display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,justifyContent:"center",border:"1px solid #334155"}}>
          <span style={{fontSize:12,color:"#94a3b8"}}>시작: <strong style={{color:"#e2e8f0"}}>{safeYr0}년</strong></span>
          <input type="range" min={1950} max={Math.min(2025,yr1-3)} value={yr0}
            onChange={e=>setYr0(+e.target.value)} style={{width:130,accentColor:"#2563eb"}}/>
          <input type="range" min={Math.max(1950,yr0+3)} max={2025} value={yr1}
            onChange={e=>setYr1(+e.target.value)} style={{width:130,accentColor:"#2563eb"}}/>
          <span style={{fontSize:12,color:"#94a3b8"}}>종료: <strong style={{color:"#e2e8f0"}}>{yr1}년</strong></span>
        </div>
      )}

      {/* Currency Toggles */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:18}}>
        <button onClick={()=>setSel(sel.length===CURRENCIES.length ? ["USD"] : CURRENCIES.map(c=>c.key))}
          style={{padding:"3px 10px",borderRadius:999,border:"1px solid #475569",
            background:"#1e293b",color:"#64748b",cursor:"pointer",fontSize:11}}>
          {sel.length===CURRENCIES.length?"USD만":"전체 선택"}
        </button>
        {CURRENCIES.map(c=>(
          <button key={c.key} onClick={()=>toggle(c.key)}
            title={c.desc}
            style={{
              padding:"3px 12px", borderRadius:999,
              border:`2px solid ${c.color}`,
              background: sel.includes(c.key) ? c.color+"30" : "transparent",
              color: sel.includes(c.key) ? c.color : "#334155",
              cursor:"pointer", fontSize:11, fontWeight: sel.includes(c.key)?700:400,
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Main Chart */}
      <div style={s.card}>
        <h2 style={{textAlign:"center",fontSize:13,fontWeight:600,color:"#94a3b8",margin:"0 0 10px"}}>
          {isCofer
            ? "IMF COFER — 글로벌 외환보유액 통화구성 비중 (%)"
            : "SWIFT — 국제결제 메시지 통화 비중 (%, value-based)"}
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={filtered} margin={{top:5,right:20,left:5,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f"/>
            <XAxis dataKey="year" stroke="#334155" tick={{fontSize:10,fill:"#64748b"}}
              tickCount={isCofer ? 16 : 14}/>
            <YAxis scale={log?"log":"linear"} domain={log?[0.1,"auto"]:[0,isCofer?90:60]}
              allowDataOverflow
              tickFormatter={v=>`${v}%`}
              stroke="#334155" tick={{fontSize:10,fill:"#64748b"}} width={42}/>
            <Tooltip
              contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,fontSize:12}}
              labelStyle={{color:"#e2e8f0",fontWeight:700,marginBottom:4}}
              formatter={(v,k)=>[`${v?.toFixed?.(1)}%`, CURRENCIES.find(c=>c.key===k)?.label ?? k]}
            />
            <Legend formatter={k=>CURRENCIES.find(c=>c.key===k)?.label??k}
              wrapperStyle={{fontSize:11,paddingTop:6}}/>
            {eventsInRange.map(([y,label])=>(
              <ReferenceLine key={y} x={+y} stroke="#475569" strokeDasharray="3 3"
                label={{value:label.replace("\\n"," "),position:"insideTopLeft",fill:"#94a3b8",fontSize:8,angle:-45,dx:2}}/>
            ))}
            {isCofer && <ReferenceLine x={2024} stroke="#fbbf2455" strokeDasharray="4 4"/>}
            {ctrs.map(c=>(
              <Line key={c.key} type="monotone" dataKey={c.key}
                stroke={c.color} strokeWidth={c.key==="USD"?3:1.5}
                dot={false} activeDot={{r:4}} connectNulls/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* USD Stats */}
      {sel.includes("USD") && usdLatest && (
        <div style={{...s.card,padding:"14px 18px"}}>
          <h2 style={{fontSize:12,fontWeight:600,color:"#94a3b8",margin:"0 0 10px"}}>
            USD 비중 요약 ({isCofer?"COFER":"SWIFT"})
          </h2>
          <div style={{display:"flex",flexWrap:"wrap",gap:20,fontSize:12}}>
            {usdPeak && (
              <div style={{background:"#0f172a",borderRadius:8,padding:"10px 16px",flex:1,minWidth:100}}>
                <div style={{color:"#64748b",marginBottom:4,fontSize:10}}>📈 최고점</div>
                <div style={{color:"#93c5fd",fontWeight:700,fontSize:18}}>{usdPeak.USD}%</div>
                <div style={{color:"#475569",fontSize:10}}>{usdPeak.year}년</div>
              </div>
            )}
            {usdLow && (
              <div style={{background:"#0f172a",borderRadius:8,padding:"10px 16px",flex:1,minWidth:100}}>
                <div style={{color:"#64748b",marginBottom:4,fontSize:10}}>📉 최저점</div>
                <div style={{color:"#f87171",fontWeight:700,fontSize:18}}>{usdLow.USD}%</div>
                <div style={{color:"#475569",fontSize:10}}>{usdLow.year}년</div>
              </div>
            )}
            <div style={{background:"#0f172a",borderRadius:8,padding:"10px 16px",flex:1,minWidth:100}}>
              <div style={{color:"#64748b",marginBottom:4,fontSize:10}}>📍 최근 ({usdLatest.year})</div>
              <div style={{color:"#e2e8f0",fontWeight:700,fontSize:18}}>{usdLatest.USD}%</div>
              <div style={{color:"#475569",fontSize:10}}>
                {usdPeak && usdLatest.year!==usdPeak.year
                  ? `고점 대비 −${(usdPeak.USD - usdLatest.USD).toFixed(1)}%p`
                  : "현재"}
              </div>
            </div>
            {usdPeak && usdLow && (
              <div style={{background:"#0f172a",borderRadius:8,padding:"10px 16px",flex:2,minWidth:180,display:"flex",alignItems:"center"}}>
                <div style={{fontSize:11,color:"#64748b",lineHeight:1.7}}>
                  {isCofer
                    ? `USD는 ${usdPeak.year}년 ${usdPeak.USD}%를 정점으로 지속 하락. ${usdLatest.year}년 기준 ${usdLatest.USD}%로 브레턴우즈 체제 붕괴(1971) 이후 최저 수준에 근접.`
                    : `SWIFT 결제 기준 USD는 실물 무역·금융 거래에서도 여전히 압도적 1위. EUR이 2위이나 격차 확대 중.`
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context: COFER vs SWIFT 비교 */}
      {!isCofer && (
        <div style={{background:"#1e293b",borderRadius:8,padding:"12px 16px",marginBottom:18,border:"1px solid #334155"}}>
          <p style={{fontSize:11,color:"#475569",margin:0,lineHeight:1.8}}>
            <strong style={{color:"#64748b"}}>COFER vs SWIFT 차이</strong><br/>
            COFER는 각국 중앙은행이 <em>보유</em>하는 외환의 통화구성. SWIFT는 실제 <em>결제·송금</em> 메시지 기준. 두 지표 모두 USD 우위이나 SWIFT에서 USD 비중이 더 높게 나타나는 경향이 있음.
          </p>
        </div>
      )}

      {/* CSV Guide */}
      <div style={{background:"#0f172a",borderRadius:8,padding:"10px 14px",border:"1px solid #1e293b"}}>
        <p style={{margin:0,fontSize:11,color:"#475569",lineHeight:1.8}}>
          <strong style={{color:"#64748b"}}>CSV 형식</strong> (단위: %)<br/>
          <code style={{background:"#1e293b",padding:"2px 6px",borderRadius:4,color:"#94a3b8",fontSize:10}}>
            year,USD,EUR,GBP,JPY,CNY,Other
          </code>
        </p>
      </div>
    </div>
  );
}
