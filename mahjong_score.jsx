import { useState, useEffect } from "react";

const uid = () => Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const todayStr = () => new Date().toISOString().slice(0,10);
const fmtDate = (d) => new Date(d+"T12:00:00").toLocaleDateString("ja-JP",{month:"numeric",day:"numeric",weekday:"short"});
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});
const fmtPt = (n) => `${n>=0?"+":""}${n.toFixed(1)}`;

const DEF = {
  uma4:[20,10,-10,-20], uma3:[20,0,-20],
  mochiten4:25000, kaeshiten4:30000,
  mochiten3:35000, kaeshiten3:40000,
  chipValue:3, venueFee:0, pointUnit:1,
};

function calcGame(inputs, s, seatPriority=null) {
  const n=inputs.length, is3=n===3;
  const mc=is3?s.mochiten3:s.mochiten4, kc=is3?s.kaeshiten3:s.kaeshiten4;
  const uma=(is3?s.uma3:s.uma4).map(v=>parseFloat(v)||0), oka=(kc-mc)/1000*n;
  const sorted=[...inputs].sort((a,b)=>{
    if(b.score!==a.score) return b.score-a.score;
    if(seatPriority) return (seatPriority[a.playerId]??99)-(seatPriority[b.playerId]??99);
    return 0;
  });
  if(seatPriority){
    return sorted.map(({playerId,score},idx)=>{
      const rank=idx+1, base=(score-kc)/1000, umaBonus=uma[rank-1]??0, okaBonus=rank===1?oka:0;
      return {playerId,score,rank,base,umaBonus,okaBonus,total:Math.round((base+umaBonus+okaBonus)*10)/10};
    });
  }
  const rm={};let i=0;
  while(i<sorted.length){
    let j=i;
    while(j<sorted.length&&sorted[j].score===sorted[i].score)j++;
    const avg=uma.slice(i,j).reduce((a,v)=>a+v,0)/(j-i);
    for(let k=i;k<j;k++) rm[sorted[k].playerId]={rank:i+1,u:avg};
    i=j;
  }
  return inputs.map(({playerId,score})=>{
    const {rank,u}=rm[playerId], base=(score-kc)/1000, ob=rank===1?oka:0;
    return {playerId,score,rank,base,umaBonus:u,okaBonus:ob,total:Math.round((base+u+ob)*10)/10};
  });
}

function calcSettle(pids,gameTotals,chips,s,inclVenue,prepayer){
  const {chipValue,venueFee,pointUnit}=s, n=pids.length, jan={};
  pids.forEach(id=>{
    const chipJ=(parseInt(chips[id])||0)*chipValue;
    let vAdj=0;
    if(inclVenue) vAdj=(!prepayer)?-venueFee:id===prepayer?(n-1)*venueFee:-venueFee;
    jan[id]=Math.round((gameTotals[id]*pointUnit+chipJ+vAdj)*10)/10;
  });
  return jan;
}

function calcPayments(pids,finalJan){
  const entries=pids.map(id=>({id,v:finalJan[id]})).sort((a,b)=>b.v-a.v);
  const cr=entries.filter(e=>e.v>0.01).map(e=>({...e}));
  const dt=entries.filter(e=>e.v<-0.01).map(e=>({...e,v:-e.v}));
  const pays=[];let ci=0,di=0;
  while(ci<cr.length&&di<dt.length){
    const amt=Math.min(cr[ci].v,dt[di].v);
    if(amt>0.01) pays.push({from:dt[di].id,to:cr[ci].id,amount:Math.round(amt*10)/10});
    cr[ci].v-=amt; dt[di].v-=amt;
    if(cr[ci].v<0.01)ci++; if(dt[di].v<0.01)di++;
  }
  return pays;
}

const C={
  bg:"#0c0c18",card:"#191928",card2:"#0c0c18",
  border:"rgba(255,255,255,0.07)",
  primary:"#22c55e",primaryBg:"rgba(34,197,94,0.1)",
  gold:"#f59e0b",goldBg:"rgba(245,158,11,0.1)",
  red:"#ef4444",redBg:"rgba(239,68,68,0.1)",
  blue:"#60a5fa",blueBg:"rgba(96,165,250,0.1)",
  text:"#f0f0f0",muted:"#5a6a7a",nav:"#0a0a14",
};

const Pts=({v,sz=15})=>(
  <span style={{color:v>0?C.primary:v<0?C.red:C.muted,fontWeight:700,fontSize:sz}}>{fmtPt(v)}pt</span>
);
const Jan=({v,sz=16})=>(
  <span style={{color:v>0?C.primary:v<0?C.red:C.muted,fontWeight:800,fontSize:sz}}>
    {v>=0?"+":""}{v.toFixed(1)}<span style={{fontSize:Math.round(sz*0.65),fontWeight:600,marginLeft:1}}>雀</span>
  </span>
);
const RankBadge=({rank})=>{
  const cfg=[
    {bg:C.goldBg,color:C.gold,label:"1位"},
    {bg:"rgba(148,163,184,0.1)",color:"#94a3b8",label:"2位"},
    {bg:"rgba(180,120,70,0.1)",color:"#b47846",label:"3位"},
    {bg:"rgba(100,116,139,0.1)",color:"#64748b",label:"4位"},
  ][rank-1]||{bg:"#111",color:C.muted,label:`${rank}位`};
  return <span style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}50`,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{cfg.label}</span>;
};
const Btn=({children,onClick,variant="primary",disabled,full=true,sx={}})=>{
  const v={
    primary:{background:C.primary,color:"#000",border:"none"},
    ghost:{background:"transparent",color:C.text,border:`1px solid ${C.border}`},
    danger:{background:C.redBg,color:C.red,border:`1px solid ${C.red}40`},
    gold:{background:C.goldBg,color:C.gold,border:`1px solid ${C.gold}50`},
    blue:{background:C.blueBg,color:C.blue,border:`1px solid ${C.blue}50`},
    surface:{background:C.card,color:C.text,border:`1px solid ${C.border}`},
  };
  return(
    <button onClick={disabled?undefined:onClick} style={{...v[variant],padding:"11px 16px",borderRadius:10,fontSize:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,width:full?"100%":"auto",fontFamily:"inherit",display:"block",textAlign:"center",...sx}}>
      {children}
    </button>
  );
};
const Field=({label,value,onChange,type="text",placeholder="",unit,note,allowNegative=false})=>(
  <div style={{marginBottom:10}}>
    {label&&<div style={{fontSize:11,color:C.muted,marginBottom:3,fontWeight:600,letterSpacing:"0.04em"}}>{label}</div>}
    <div style={{position:"relative"}}>
      <input
        type="text"
        inputMode={allowNegative?"text":"numeric"}
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={e=>{if(e.target.value==="0"||e.target.value==="1")onChange("");}}
        style={{width:"100%",boxSizing:"border-box",background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:unit?"9px 42px 9px 10px":"9px 10px",fontSize:15,color:C.text,fontFamily:"inherit",outline:"none"}}
      />
      {unit&&<span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:12}}>{unit}</span>}
    </div>
    {note&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>{note}</div>}
  </div>
);
const Toggle=({label,value,onChange})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0"}}>
    <span style={{fontSize:13,color:C.text}}>{label}</span>
    <div onClick={()=>onChange(!value)} style={{width:42,height:24,borderRadius:12,background:value?C.primary:"rgba(255,255,255,0.12)",position:"relative",cursor:"pointer",flexShrink:0}}>
      <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:value?21:3,transition:"left 0.15s"}}/>
    </div>
  </div>
);
const SL=({children,mt=4})=>(
  <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8,marginTop:mt}}>{children}</div>
);
const Hr=()=><div style={{height:1,background:C.border,margin:"12px 0"}}/>;
const Header=({title,back,right,sub})=>(
  <div style={{padding:"13px 15px 10px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:C.bg,flexShrink:0}}>
    <div style={{display:"flex",alignItems:"center",gap:5,minWidth:0,flex:1}}>
      {back&&<button onClick={back} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",padding:"0 4px 1px",lineHeight:1,fontFamily:"inherit",flexShrink:0}}>‹</button>}
      <div style={{minWidth:0}}>
        <div style={{margin:0,fontSize:15,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
        {sub&&<div style={{fontSize:10,color:C.muted,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div>}
      </div>
    </div>
    {right&&<div style={{marginLeft:8,flexShrink:0}}>{right}</div>}
  </div>
);
const Empty=({icon,text,action})=>(
  <div style={{textAlign:"center",padding:"36px 20px",color:C.muted}}>
    <div style={{fontSize:32,marginBottom:8}}>{icon}</div>
    <div style={{fontSize:13,marginBottom:action?14:0}}>{text}</div>
    {action}
  </div>
);

function SettingsPanel({s,setS,mode,setMode}){
  const upd=(k,v)=>setS(p=>({...p,[k]:v}));
  const parseUma=(v)=>{const n=parseFloat(v);return isNaN(n)?0:n;};
  const updU4=(i,rawVal)=>setS(p=>{
    const a=[...p.uma4];
    a[i]=rawVal;
    const nums=a.map(parseUma);
    if(i<=2){
      const sum=nums[0]+nums[1]+nums[2];
      a[3]=String(-sum);
    } else {
      const sum=nums[1]+nums[2]+nums[3];
      a[0]=String(-sum);
    }
    return{...p,uma4:a};
  });
  const updU3=(i,rawVal)=>setS(p=>{
    const a=[...p.uma3];
    a[i]=rawVal;
    const nums=a.map(parseUma);
    const sum=nums[0]+nums[1];
    a[2]=String(-sum);
    return{...p,uma3:a};
  });
  const p4=[{l:"10-5",v:[10,5,-5,-10]},{l:"20-10",v:[20,10,-10,-20]},{l:"30-10",v:[30,10,-10,-30]},{l:"30-20",v:[30,20,-20,-30]}];
  const p3=[{l:"10-0",v:[10,0,-10]},{l:"20-0",v:[20,0,-20]},{l:"30-0",v:[30,0,-30]}];
  const oka4=((s.kaeshiten4-s.mochiten4)/1000*4).toFixed(0);
  const oka3=((s.kaeshiten3-s.mochiten3)/1000*3).toFixed(0);
  const uma4Sum=s.uma4.map(parseUma).reduce((a,b)=>a+b,0);
  const uma3Sum=s.uma3.map(parseUma).reduce((a,b)=>a+b,0);
  const tabs=[{id:"yonma",label:"四麻"},{id:"sanma",label:"三麻"},{id:"other",label:"チップ・場代"}];
  return(<>
    <div style={{display:"flex",background:C.card2,borderRadius:9,padding:3,marginBottom:14,border:`1px solid ${C.border}`}}>
      {tabs.map(t=><button key={t.id} onClick={()=>setMode(t.id)} style={{flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:mode===t.id?C.card:"transparent",color:mode===t.id?C.text:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{t.label}</button>)}
    </div>
    {mode==="yonma"&&<>
      <SL mt={0}>点数ルール（四麻）</SL>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
        <Field label="持ち点" value={String(s.mochiten4)} onChange={v=>upd("mochiten4",parseInt(v)||25000)}/>
        <Field label="返し点" value={String(s.kaeshiten4)} onChange={v=>upd("kaeshiten4",parseInt(v)||30000)}/>
        <div style={{fontSize:11,color:C.primary}}>オカ: {oka4}pt → 1位加算</div>
      </div>
      <SL>ウマ（四麻）</SL>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",gap:6,marginBottom:11,flexWrap:"wrap"}}>
          {p4.map(p=>{const on=JSON.stringify(s.uma4.map(parseUma))===JSON.stringify(p.v);return <button key={p.l} onClick={()=>upd("uma4",p.v.map(String))} style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${on?C.primary:C.border}`,background:on?C.primaryBg:"transparent",color:on?C.primary:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{p.l}</button>;})}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {["1位","2位","3位","4位"].map((l,i)=><Field key={i} label={l} value={String(s.uma4[i])} allowNegative onChange={v=>updU4(i,v)}/>)}
        </div>
        <div style={{fontSize:10,marginTop:4,color:uma4Sum===0?C.primary:C.red,fontWeight:700}}>合計: {uma4Sum>0?"+":""}{uma4Sum} {uma4Sum===0?"✓ OK":"⚠ 0になるよう自動調整"}</div>
      </div>
    </>}
    {mode==="sanma"&&<>
      <SL mt={0}>点数ルール（三麻）</SL>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
        <Field label="持ち点" value={String(s.mochiten3)} onChange={v=>upd("mochiten3",parseInt(v)||35000)}/>
        <Field label="返し点" value={String(s.kaeshiten3)} onChange={v=>upd("kaeshiten3",parseInt(v)||40000)}/>
        <div style={{fontSize:11,color:C.blue}}>オカ: {oka3}pt → 1位加算</div>
      </div>
      <SL>ウマ（三麻）</SL>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",gap:6,marginBottom:11}}>
          {p3.map(p=>{const on=JSON.stringify(s.uma3.map(parseUma))===JSON.stringify(p.v);return <button key={p.l} onClick={()=>upd("uma3",p.v.map(String))} style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${on?C.blue:C.border}`,background:on?C.blueBg:"transparent",color:on?C.blue:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{p.l}</button>;})}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {["1位","2位","3位"].map((l,i)=><Field key={i} label={l} value={String(s.uma3[i])} allowNegative onChange={v=>updU3(i,v)}/>)}
        </div>
        <div style={{fontSize:10,marginTop:4,color:uma3Sum===0?C.primary:C.red,fontWeight:700}}>合計: {uma3Sum>0?"+":""}{uma3Sum} {uma3Sum===0?"✓ OK":"⚠ 0になるよう自動調整"}</div>
      </div>
    </>}
    {mode==="other"&&<>
      <SL mt={0}>チップ・場代・点単価</SL>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
        <Field label="チップ単価（1枚 = ? 雀）" value={String(s.chipValue)} onChange={v=>upd("chipValue",parseFloat(v)||0)} unit="雀"/>
        <Field label="場代（1人あたり）" value={String(s.venueFee)} onChange={v=>upd("venueFee",parseFloat(v)||0)} unit="雀"/>
        <Field label="点単価（1pt = ? 雀）" value={String(s.pointUnit)} onChange={v=>{const n=parseFloat(v);upd("pointUnit",isNaN(n)?v:n);}} unit="雀"/>
      </div>
    </>}
  </>);
}

function HomeScreen({rooms,players,setView,deleteRoom}){
  const sorted=[...rooms].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return(
    <div>
      <div style={{padding:"15px 15px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:18,fontWeight:800}}>🀄 麻雀スコア</div>
          <div style={{fontSize:10,color:C.muted}}>{new Date().toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</div>
        </div>
        <button onClick={()=>setView({type:"createRoom"})} style={{background:C.primary,border:"none",color:"#000",borderRadius:10,padding:"8px 13px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>＋ 新しい部屋</button>
      </div>
      <div style={{padding:"13px 15px"}}>
        {sorted.length===0?<Empty icon="🏠" text="対局部屋を作成して記録を始めましょう"/>
          :sorted.map(room=>{
            const is3=room.memberIds.length===3;
            const names=room.memberIds.map(id=>players.find(p=>p.id===id)?.name||"?");
            const totals={};
            room.memberIds.forEach(id=>{totals[id]=room.games.reduce((s,g)=>{const r=g.results.find(r=>r.playerId===id);return s+(r?r.total:0);},0);});
            const leader=room.memberIds.length?room.memberIds.reduce((a,b)=>totals[a]>totals[b]?a:b,room.memberIds[0]):null;
            return(
              <div key={room.id} onClick={()=>setView({type:"room",roomId:room.id})} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 14px",marginBottom:10,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{room.name}</div>
                    <div style={{fontSize:10,color:C.muted}}>{names.join(" · ")}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,marginLeft:10,flexShrink:0}}>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:is3?C.blueBg:C.primaryBg,color:is3?C.blue:C.primary,border:`1px solid ${is3?C.blue+"40":C.primary+"40"}`}}>{is3?"三麻":"四麻"}</span>
                    <span style={{fontSize:10,color:C.muted}}>{room.games.length}半荘</span>
                    <button onClick={e=>{e.stopPropagation();if(window.confirm(`「${room.name}」を削除しますか？`))deleteRoom(room.id);}} style={{background:C.redBg,border:`1px solid ${C.red}40`,color:C.red,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>削除</button>
                  </div>
                </div>
                {room.games.length>0&&leader&&(
                  <div style={{background:C.card2,borderRadius:8,padding:"6px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,color:C.muted}}>🏆 {players.find(p=>p.id===leader)?.name}</span>
                    <Pts v={totals[leader]} sz={12}/>
                  </div>
                )}
                <div style={{fontSize:10,color:C.muted,marginTop:7}}>{fmtDate(room.createdAt.slice(0,10))} 作成</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function CreateRoomScreen({players,defaults,onSave,onBack}){
  const [step,setStep]=useState(1);
  const [name,setName]=useState("");
  const [selected,setSelected]=useState([]);
  const [s,setS]=useState({...defaults});
  const [sMode,setSMode]=useState("yonma");
  const toggle=(pid)=>setSelected(ps=>ps.includes(pid)?ps.filter(x=>x!==pid):ps.length<4?[...ps,pid]:ps);
  if(step===1) return(
    <div>
      <Header title="新しい対局部屋" back={onBack}/>
      <div style={{padding:"14px 15px"}}>
        <Field label="部屋名" value={name} onChange={setName} placeholder="例: 木曜メンバー"/>
        <SL mt={10}>参加メンバー（2〜4人）</SL>
        {players.length===0&&<Empty icon="👥" text="先にプレイヤーを登録してください"/>}
        {players.map(p=>{
          const sel=selected.includes(p.id);
          return(<div key={p.id} onClick={()=>toggle(p.id)} style={{background:sel?C.primaryBg:C.card,border:`1px solid ${sel?C.primary+"60":C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
            <span style={{fontWeight:600,fontSize:14}}>{p.name}</span>
            <div style={{width:21,height:21,borderRadius:"50%",background:sel?C.primary:"transparent",border:`2px solid ${sel?C.primary:C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#000"}}>{sel?"✓":""}</div>
          </div>);
        })}
        <div style={{marginTop:12}}><Btn onClick={()=>setStep(2)} disabled={!name.trim()||selected.length<2}>ルール設定へ（{selected.length}人）</Btn></div>
      </div>
    </div>
  );
  return(
    <div>
      <Header title="ルール設定" back={()=>setStep(1)} sub={`${name} · ${selected.length}人`}/>
      <div style={{padding:"14px 15px"}}>
        <SettingsPanel s={s} setS={setS} mode={sMode} setMode={setSMode}/>
        <Btn onClick={()=>onSave({id:uid(),name:name.trim(),createdAt:new Date().toISOString(),memberIds:selected,settings:{...s},games:[],chipSessions:[]})} sx={{marginTop:6}}>部屋を作成する</Btn>
      </div>
    </div>
  );
}


function EditGameModal({game,room,players,onSave,onClose}){
  const [scores,setScores]=useState(()=>{
    const m={};
    game.results.forEach(r=>{m[r.playerId]=String(r.score/100);});
    return m;
  });
  const is3=room.memberIds.length===3;
  const mc=is3?room.settings.mochiten3:room.settings.mochiten4;
  const N=room.memberIds.length;
  const total=room.memberIds.reduce((s,id)=>s+(parseInt(scores[id])||0)*100,0);
  const totalOk=Math.abs(total-mc*N)<100;

  const handleSave=()=>{
    const inputs=room.memberIds.map(id=>({playerId:id,score:(parseInt(scores[id])||0)*100}));
    const newResults=calcGame(inputs,room.settings,null);
    onSave({...game,results:newResults});
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:C.card,borderRadius:"16px 16px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:430,boxSizing:"border-box"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:15}}>点数を修正</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        {room.memberIds.map(id=>{
          const p=players.find(pl=>pl.id===id);
          return(
            <div key={id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:C.muted,width:52,flexShrink:0}}>{p?.name}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                <input type="text" inputMode="numeric" value={scores[id]||""} onChange={e=>setScores(s=>({...s,[id]:e.target.value}))}
                  style={{width:90,background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",fontSize:18,color:C.text,fontFamily:"inherit",outline:"none",textAlign:"center",fontWeight:700}}/>
                <span style={{color:C.muted,fontSize:15,fontWeight:700}}>00 点</span>
              </div>
            </div>
          );
        })}
        <div style={{marginBottom:12,padding:"7px 10px",borderRadius:8,background:totalOk?C.primaryBg:C.redBg,border:`1px solid ${totalOk?C.primary+"40":C.red+"40"}`,fontSize:12,fontWeight:700,color:totalOk?C.primary:C.red,textAlign:"center"}}>
          合計 {total.toLocaleString()}点 {totalOk?"✓":`（差: ${(total-mc*N)>0?"+":""}${(total-mc*N).toLocaleString()}）`}
        </div>
        <Btn onClick={handleSave} disabled={!totalOk}>修正を確定する</Btn>
      </div>
    </div>
  );
}

function RoomScreen({room,players,updateRoom,setView,deleteRoom}){
  const [subTab,setSubTab]=useState("games");
  const [editingGame,setEditingGame]=useState(null);
  const is3=room.memberIds.length===3;
  const totals={};
  room.memberIds.forEach(id=>{totals[id]=room.games.reduce((s,g)=>{const r=g.results.find(r=>r.playerId===id);return s+(r?r.total:0);},0);});
  const sorted=[...room.memberIds].sort((a,b)=>totals[b]-totals[a]);
  const medals=["🥇","🥈","🥉","4️⃣"];
  const han=room.games.length;
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {editingGame&&<EditGameModal game={editingGame} room={room} players={players} onClose={()=>setEditingGame(null)} onSave={(updated)=>{updateRoom({...room,games:room.games.map(g=>g.id===updated.id?updated:g)});setEditingGame(null);}}/> }
      <Header title={room.name} back={()=>setView({type:"home"})}
        sub={`${is3?"三麻":"四麻"} · ${room.memberIds.map(id=>players.find(p=>p.id===id)?.name||"?").join(" · ")}`}
        right={<div style={{display:"flex",gap:6}}>
          <button onClick={()=>setView({type:"roomSettings",roomId:room.id})} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"5px 10px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>⚙</button>
          <button onClick={()=>{if(window.confirm(`「${room.name}」を削除しますか？`)){deleteRoom(room.id);setView({type:"home"});}}} style={{background:C.redBg,border:`1px solid ${C.red}40`,color:C.red,borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>削除</button>
          <button onClick={()=>setView({type:"settle",roomId:room.id})} style={{background:C.goldBg,border:`1px solid ${C.gold}50`,color:C.gold,borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>精算</button>
        </div>}
      />
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        {[{id:"games",label:"対局記録"},{id:"scores",label:"累計スコア"}].map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)} style={{flex:1,padding:"10px 0",border:"none",background:"transparent",color:subTab===t.id?C.primary:C.muted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",borderBottom:`2px solid ${subTab===t.id?C.primary:"transparent"}`}}>{t.label}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px 15px"}}>
        <div style={{marginBottom:13}}><Btn onClick={()=>setView({type:"recordGame",roomId:room.id})}>＋ 半荘を記録する</Btn></div>
        {subTab==="scores"&&<>
          <SL mt={0}>累計ポイント（{han}半荘）</SL>
          {sorted.map((id,i)=>{
            const p=players.find(pl=>pl.id===id);
            const wins=room.games.filter(g=>g.results.some(r=>r.playerId===id&&r.rank===1)).length;
            return(<div key={id} style={{background:i===0?C.goldBg:C.card,border:`1px solid ${i===0?C.gold+"40":C.border}`,borderRadius:11,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:17,width:22}}>{medals[i]||i+1}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{p?.name}</div>
                <div style={{fontSize:10,color:C.muted}}>1位{wins}回{han?` (${Math.round(wins/han*100)}%)`:""}　全{han}半荘</div>
              </div>
              <Pts v={totals[id]} sz={17}/>
            </div>);
          })}
        </>}
        {subTab==="games"&&<>
          <SL mt={0}>{han}半荘の記録</SL>
          {han===0&&<Empty icon="🀄" text="まだ記録がありません"/>}
          {[...room.games].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map((g,gi)=>{
            const gSorted=[...g.results].sort((a,b)=>a.rank-b.rank);
            const wName=players.find(p=>p.id===gSorted[0]?.playerId)?.name;
            return(<div key={g.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:8,overflow:"hidden"}}>
              <div style={{padding:"9px 13px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700}}>第{han-gi}半荘 · 🏆 {wName}</div>
                  <div style={{fontSize:10,color:C.muted}}>{fmtTime(g.createdAt)}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setEditingGame(g)} style={{background:C.blueBg,border:`1px solid ${C.blue}40`,color:C.blue,borderRadius:6,padding:"3px 9px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>修正</button>
                  <button onClick={()=>{if(window.confirm("この半荘を削除しますか？"))updateRoom({...room,games:room.games.filter(x=>x.id!==g.id)});}} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"3px 9px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>削除</button>
                </div>
              </div>
              <div style={{padding:"8px 13px"}}>
                {gSorted.map(r=>{
                  const p=players.find(pl=>pl.id===r.playerId);
                  return(<div key={r.playerId} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><RankBadge rank={r.rank}/><span style={{fontSize:13}}>{p?.name}</span></div>
                    <div style={{textAlign:"right"}}><Pts v={r.total} sz={13}/><div style={{fontSize:9,color:C.muted}}>{r.score.toLocaleString()}点</div></div>
                  </div>);
                })}
              </div>
            </div>);
          })}
        </>}
      </div>
    </div>
  );
}

function RecordGameScreen({room,players,onSave,onBack}){
  const [manualRaw,setManualRaw]=useState({});
  const [step,setStep]=useState("input");
  const [tieSelections,setTieSelections]=useState({});
  const [result,setResult]=useState(null);
  const [tieGroupsSnap,setTieGroupsSnap]=useState([]);
  const is3=room.memberIds.length===3;
  const mc=is3?room.settings.mochiten3:room.settings.mochiten4;
  const kc=is3?room.settings.kaeshiten3:room.settings.kaeshiten4;
  const uma=is3?room.settings.uma3:room.settings.uma4;
  const oka=((kc-mc)/1000*room.memberIds.length).toFixed(0);
  const N=room.memberIds.length;

  const getAutoFill=()=>{
    const filled=room.memberIds.filter(id=>{const v=parseInt(manualRaw[id]||"");return !isNaN(v)&&manualRaw[id]!=="";});
    if(filled.length!==N-1) return null;
    const rem=room.memberIds.find(id=>!filled.includes(id));
    if(!rem) return null;
    const sum=filled.reduce((s,id)=>s+parseInt(manualRaw[id])*100,0);
    return {pid:rem,hundreds:(mc*N-sum)/100};
  };
  const autoFill=getAutoFill();
  const getDisplayH=(id)=>autoFill?.pid===id?String(autoFill.hundreds):(manualRaw[id]||"");
  const getScore=(id)=>{const v=parseInt(getDisplayH(id));return isNaN(v)?null:v*100;};
  const allFilled=room.memberIds.every(id=>getScore(id)!==null);
  const totalScore=room.memberIds.reduce((s,id)=>s+(getScore(id)||0),0);
  const diff=totalScore-mc*N;
  const totalOk=Math.abs(diff)<100;

  const getTieGroups=()=>{
    if(!allFilled) return [];
    const sm={};
    room.memberIds.forEach(id=>{const sc=getScore(id);if(!sm[sc])sm[sc]=[];sm[sc].push(id);});
    return Object.values(sm).filter(g=>g.length>1);
  };

  const doCalc=(priority)=>{
    const inputs=room.memberIds.map(id=>({playerId:id,score:getScore(id)}));
    setResult(calcGame(inputs,room.settings,priority));
    setStep("confirm");
  };

  const handleNext=()=>{
    const tg=getTieGroups();
    if(tg.length>0){setTieGroupsSnap(tg);setTieSelections({});setStep("tiebreak");}
    else doCalc({});
  };

  const toggleTieSel=(gi,pid)=>{
    setTieSelections(prev=>{
      const cur=prev[gi]||[];
      if(cur.includes(pid)) return {...prev,[gi]:cur.slice(0,cur.indexOf(pid))};
      return {...prev,[gi]:[...cur,pid]};
    });
  };
  const allTiesResolved=tieGroupsSnap.every((g,gi)=>(tieSelections[gi]||[]).length===g.length);

  if(step==="input") return(
    <div>
      <Header title="半荘を記録" back={onBack} sub={`${is3?"三麻":"四麻"} · 持ち点${mc.toLocaleString()} · ウマ${uma.join("/")} · オカ${oka}pt`}/>
      <div style={{padding:"14px 15px"}}>
        {room.memberIds.map(id=>{
          const p=players.find(pl=>pl.id===id);
          const isAuto=autoFill?.pid===id;
          const displayH=getDisplayH(id);
          const full=getScore(id);
          return(<div key={id} style={{marginBottom:16}}>
            <div style={{fontSize:11,marginBottom:5,fontWeight:600,letterSpacing:"0.04em",display:"flex",alignItems:"center",gap:6,color:isAuto?C.gold:C.muted}}>
              {p?.name}
              {isAuto&&<span style={{fontSize:10,fontWeight:700,color:C.gold,background:C.goldBg,border:`1px solid ${C.gold}40`,borderRadius:4,padding:"1px 6px"}}>⚡ 自動</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" inputMode="numeric" value={displayH} readOnly={isAuto}
                onChange={e=>setManualRaw(r=>({...r,[id]:e.target.value}))}
                style={{
                  width:110, flexShrink:0,
                  background:isAuto?"rgba(245,158,11,0.07)":C.card2,
                  border:`1px solid ${isAuto?C.gold+"60":C.border}`,
                  borderRadius:9, padding:"10px 10px",
                  fontSize:22, color:isAuto?C.gold:C.text,
                  fontFamily:"inherit", outline:"none", fontWeight:700,
                  textAlign:"center",
                  WebkitAppearance:"none", appearance:"none",
                }}
              />
              <span style={{fontSize:17,color:C.muted,fontWeight:700,whiteSpace:"nowrap"}}>00 点</span>
              {full!==null&&<span style={{fontSize:12,color:isAuto?C.gold:C.muted,marginLeft:4}}>= <b style={{color:isAuto?C.gold:C.text}}>{full.toLocaleString()}</b></span>}
            </div>
          </div>);
        })}
        {allFilled&&<div style={{background:totalOk?C.primaryBg:C.redBg,border:`1px solid ${totalOk?C.primary+"40":C.red+"40"}`,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.muted}}>合計確認</span>
          <span style={{fontWeight:700,fontSize:13,color:totalOk?C.primary:C.red}}>
            {totalScore.toLocaleString()}点{totalOk?" ✓":`　差${diff>0?"+":""}${diff.toLocaleString()}`}
          </span>
        </div>}
        {allFilled&&getTieGroups().length>0&&<div style={{background:"rgba(245,158,11,0.07)",border:`1px solid ${C.gold}40`,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.gold}}>⚠ 同点があります。次のステップで上家を選択してください。</div>}
        <Btn onClick={handleNext} disabled={!allFilled||!totalOk}>{allFilled&&getTieGroups().length>0?"上家を選択する →":"ポイントを計算する"}</Btn>
      </div>
    </div>
  );

  if(step==="tiebreak") return(
    <div>
      <Header title="上家を選択" back={()=>setStep("input")} sub="同点プレイヤーを上家から順にタップ"/>
      <div style={{padding:"14px 15px"}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",marginBottom:16,fontSize:11,color:C.muted,lineHeight:1.6}}>
          同点の場合、上家（座席が上の人）の勝ちです。上座から順番に選択してください。
        </div>
        {tieGroupsSnap.map((group,gi)=>{
          const score=getScore(group[0]);
          const sel=tieSelections[gi]||[];
          const labels=["上家（1番上座）","2番目","3番目","4番目"];
          return(<div key={gi} style={{marginBottom:20}}>
            <SL mt={0}>{score?.toLocaleString()}点で同点</SL>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {group.map(pid=>{
                const p=players.find(pl=>pl.id===pid);
                const idx=sel.indexOf(pid); const isSel=idx!==-1;
                return(<button key={pid} onClick={()=>toggleTieSel(gi,pid)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${isSel?C.gold:C.border}`,background:isSel?C.goldBg:"transparent",textAlign:"left"}}>
                  <span style={{fontWeight:700,fontSize:14,color:isSel?C.gold:C.text}}>{p?.name}</span>
                  {isSel?<span style={{fontSize:12,color:C.gold,fontWeight:700}}>{labels[idx]}</span>:<span style={{fontSize:12,color:C.muted}}>タップして選択</span>}
                </button>);
              })}
            </div>
          </div>);
        })}
        <Btn onClick={()=>{
          const priority={};
          tieGroupsSnap.forEach((g,gi)=>{(tieSelections[gi]||[]).forEach((pid,i)=>{priority[pid]=i;});});
          doCalc(priority);
        }} disabled={!allTiesResolved}>確定してポイントを計算する</Btn>
      </div>
    </div>
  );

  if(step==="confirm"&&result){
    const gSorted=[...result].sort((a,b)=>a.rank-b.rank);
    const backStep=tieGroupsSnap.length>0?"tiebreak":"input";
    return(<div>
      <Header title="結果確認" back={()=>setStep(backStep)}/>
      <div style={{padding:"14px 15px"}}>
        {gSorted.map(r=>{
          const p=players.find(pl=>pl.id===r.playerId);
          return(<div key={r.playerId} style={{background:r.rank===1?C.goldBg:C.card,border:`1px solid ${r.rank===1?C.gold+"40":C.border}`,borderRadius:11,padding:"12px 14px",marginBottom:9}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}><RankBadge rank={r.rank}/><span style={{fontWeight:700,fontSize:14}}>{p?.name}</span></div>
              <Pts v={r.total} sz={21}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
              {[{label:"点数",val:`${r.score.toLocaleString()}点`,isNum:false},{label:"素点",val:r.base,isNum:true},{label:"ウマ",val:r.umaBonus,isNum:true},{label:"オカ",val:r.okaBonus,isNum:true}].map(({label,val,isNum})=>(
                <div key={label} style={{background:C.card2,borderRadius:6,padding:"6px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{label}</div>
                  <div style={{fontSize:11,fontWeight:700,color:isNum?(val>0?C.primary:val<0?C.red:C.muted):C.text}}>
                    {isNum?(val>0?"+":"")+val.toFixed(1)+"pt":val}
                  </div>
                </div>
              ))}
            </div>
          </div>);
        })}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn variant="ghost" onClick={()=>setStep(backStep)} full={false} sx={{padding:"11px 16px"}}>修正</Btn>
          <Btn onClick={()=>onSave({id:uid(),createdAt:new Date().toISOString(),results:result})} sx={{flex:1}}>保存する</Btn>
        </div>
      </div>
    </div>);
  }
  return null;
}

function SettleScreen({room,players,updateRoom,onBack}){
  const [chips,setChips]=useState(()=>{
    // load latest chip session if exists
    const last=(room.chipSessions||[]).slice(-1)[0];
    if(last){const m={};room.memberIds.forEach(id=>{m[id]=String(last.chips[id]||"");});return m;}
    return {};
  });
  const [inclVenue,setInclVenue]=useState(true);
  const [prepayer,setPrepayer]=useState("");
  const s=room.settings, n=room.memberIds.length;
  const gameTotals={};
  room.memberIds.forEach(id=>{gameTotals[id]=room.games.reduce((sum,g)=>{const r=g.results.find(r=>r.playerId===id);return sum+(r?r.total:0);},0);});

  // auto-balance: last chip auto-fills to make sum=0
  const chipNums=room.memberIds.map(id=>parseInt(chips[id])||0);
  const chipSum=chipNums.reduce((a,b)=>a+b,0);
  const handleChipChange=(changedId, val)=>{
    const newChips={...chips,[changedId]:val};
    // auto-balance last remaining
    const filled=room.memberIds.filter(id=>id!==changedId&&newChips[id]!==""&&newChips[id]!==undefined);
    if(filled.length===n-2){
      const rem=room.memberIds.find(id=>id!==changedId&&!filled.includes(id));
      if(rem){
        const sumExcRem=room.memberIds.filter(id=>id!==rem).reduce((s,id)=>s+(parseInt(newChips[id])||0),0);
        newChips[rem]=String(-sumExcRem);
      }
    }
    setChips(newChips);
    // auto-save to chipSessions
    const chipMap={};room.memberIds.forEach(id=>{chipMap[id]=parseInt(newChips[id])||0;});
    updateRoom({...room,chipSessions:[...(room.chipSessions||[]).filter(cs=>cs.date!==todayStr()),{id:uid(),date:todayStr(),chips:chipMap}]});
  };
  const finalJan=calcSettle(room.memberIds,gameTotals,chips,s,inclVenue,prepayer||null);
  const payments=calcPayments(room.memberIds,finalJan);
  const sorted=[...room.memberIds].sort((a,b)=>finalJan[b]-finalJan[a]);
  const chipBalanceOk=chipSum===0;
  return(
    <div>
      <Header title="精算" back={onBack} sub={room.name}/>
      <div style={{padding:"14px 15px"}}>
        <SL mt={0}>対局ポイント（{room.games.length}半荘）</SL>
        {room.memberIds.map(id=>{const p=players.find(pl=>pl.id===id);return(
          <div key={id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 12px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:600}}>{p?.name}</span><Pts v={gameTotals[id]} sz={13}/>
          </div>
        );})}
        <Hr/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <SL mt={0}>チップ（1枚 = {s.chipValue}雀）</SL>
          <span style={{fontSize:10,color:chipBalanceOk?C.primary:C.red,fontWeight:700}}>{chipBalanceOk?"✓ 合計0":"合計"+chipSum}</span>
        </div>
        {room.memberIds.map((id,idx)=>{const p=players.find(pl=>pl.id===id);const jan=(parseInt(chips[id])||0)*s.chipValue;return(
          <div key={id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{fontSize:12,color:C.muted,width:52,flexShrink:0,fontWeight:600}}>{p?.name}</div>
            <div style={{position:"relative",flex:1}}>
              <input type="text" inputMode="text" value={chips[id]||""} placeholder="0" onChange={e=>handleChipChange(id,e.target.value)}
                style={{width:"100%",boxSizing:"border-box",background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 34px 8px 10px",fontSize:14,color:C.text,fontFamily:"inherit",outline:"none"}}/>
              <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:12}}>枚</span>
            </div>
            {jan!==0&&<span style={{fontSize:12,fontWeight:700,color:C.gold,whiteSpace:"nowrap",minWidth:52}}>{jan>0?"+":""}{jan}雀</span>}
          </div>
        );})}
        <Hr/>
        <SL mt={0}>場代（{s.venueFee}雀/人）</SL>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"2px 13px 8px"}}>
          <Toggle label="精算に含める" value={inclVenue} onChange={v=>{setInclVenue(v);if(!v)setPrepayer("");}}/>
          {inclVenue&&<>
            <Hr/>
            <div style={{fontSize:11,color:C.muted,marginBottom:8}}>立替者</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6}}>
              <button onClick={()=>setPrepayer("")} style={{padding:"5px 11px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${!prepayer?C.primary:C.border}`,background:!prepayer?C.primaryBg:"transparent",color:!prepayer?C.primary:C.muted}}>なし（各自）</button>
              {room.memberIds.map(id=>{const p=players.find(pl=>pl.id===id);return(<button key={id} onClick={()=>setPrepayer(id)} style={{padding:"5px 11px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${prepayer===id?C.gold:C.border}`,background:prepayer===id?C.goldBg:"transparent",color:prepayer===id?C.gold:C.muted}}>{p?.name}</button>);})}
            </div>
            {prepayer&&<div style={{fontSize:11,color:C.gold,background:C.goldBg,border:`1px solid ${C.gold}30`,borderRadius:7,padding:"6px 10px",marginTop:4}}>{players.find(p=>p.id===prepayer)?.name}さんが合計{(s.venueFee*n).toFixed(1)}雀を立替 → 精算で回収</div>}
          </>}
        </div>
        <Hr/>
        <SL mt={0}>最終合計（雀）</SL>
        {sorted.map((id,i)=>{
          const p=players.find(pl=>pl.id===id);
          const ptJ=gameTotals[id]*s.pointUnit, chipJ=(parseInt(chips[id])||0)*s.chipValue;
          let vAdj=0;if(inclVenue)vAdj=(!prepayer)?-s.venueFee:id===prepayer?(n-1)*s.venueFee:-s.venueFee;
          return(<div key={id} style={{background:i===0?C.primaryBg:C.card,border:`1px solid ${i===0?C.primary+"40":C.border}`,borderRadius:11,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <span style={{fontWeight:700,fontSize:14}}>{p?.name}</span><Jan v={finalJan[id]} sz={21}/>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,fontSize:10,color:C.muted}}>
              <span>対局 {fmtPt(gameTotals[id])}pt → {ptJ>=0?"+":""}{ptJ.toFixed(1)}雀</span>
              {chipJ!==0&&<span>チップ {chipJ>=0?"+":""}{chipJ.toFixed(1)}雀</span>}
              {inclVenue&&<span>場代 {vAdj>=0?"+":""}{vAdj.toFixed(1)}雀</span>}
            </div>
          </div>);
        })}
        {payments.length>0?<>
          <SL mt={4}>支払い明細</SL>
          {payments.map((pay,i)=>{
            const from=players.find(p=>p.id===pay.from),to=players.find(p=>p.id===pay.to);
            return(<div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 13px",marginBottom:7,display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:C.red,fontWeight:700,fontSize:14}}>{from?.name}</span>
              <span style={{color:C.muted}}>→</span>
              <span style={{color:C.primary,fontWeight:700,fontSize:14}}>{to?.name}</span>
              <div style={{marginLeft:"auto"}}><span style={{fontWeight:800,fontSize:17,color:C.gold}}>{pay.amount.toFixed(1)}<span style={{fontSize:11,fontWeight:600,marginLeft:1}}>雀</span></span></div>
            </div>);
          })}
        </>:n>=2&&<div style={{textAlign:"center",color:C.primary,fontSize:13,padding:"10px 0",fontWeight:600}}>✓ 精算なし</div>}
      </div>
    </div>
  );
}

function RoomSettingsScreen({room,players,onSave,onBack}){
  const [s,setS]=useState({...room.settings});
  const [mode,setMode]=useState("yonma");
  const [saved,setSaved]=useState(false);
  return(<div>
    <Header title="部屋の設定" back={onBack} sub={room.name}/>
    <div style={{padding:"14px 15px"}}>
      <SettingsPanel s={s} setS={setS} mode={mode} setMode={setMode}/>
      <Btn onClick={()=>{onSave({...room,settings:{...s}});setSaved(true);setTimeout(()=>setSaved(false),2000);}} sx={{marginTop:6}}>
        {saved?"✓ 保存しました！":"設定を保存する"}
      </Btn>
    </div>
  </div>);
}

function PlayersScreen({players,addPlayer,deletePlayer,rooms}){
  const [name,setName]=useState("");
  const [adding,setAdding]=useState(false);
  const [detail,setDetail]=useState(null);
  const getStats=(pid)=>{
    let cumPt=0,cumChips=0,cumJan=0;
    rooms.forEach(rm=>{
      if(!rm.memberIds.includes(pid)) return;
      const gpt=rm.games.reduce((s,g)=>{const r=g.results.find(r=>r.playerId===pid);return s+(r?r.total:0);},0);
      cumPt+=gpt;
      const ch=(rm.chipSessions||[]).reduce((s,sess)=>s+(sess.chips[pid]||0),0);
      cumChips+=ch;
      cumJan+=gpt*(rm.settings.pointUnit||1)+ch*(rm.settings.chipValue||0);
    });
    const all=rooms.flatMap(rm=>rm.games.flatMap(g=>g.results.filter(r=>r.playerId===pid)));
    return{count:all.length,wins:all.filter(r=>r.rank===1).length,cumPt,cumChips,cumJan,avg:all.length?cumPt/all.length:0};
  };
  if(detail){
    const p=players.find(pl=>pl.id===detail),s=getStats(detail);
    const pRooms=rooms.filter(r=>r.memberIds.includes(detail));
    return(<div>
      <Header title={p?.name||""} back={()=>setDetail(null)}/>
      <div style={{padding:"14px 15px"}}>
        <SL mt={0}>対局成績</SL>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {[{label:"総対局数",val:`${s.count}半荘`,color:C.blue},{label:"1位回数",val:`${s.wins}回`,color:C.gold},{label:"累計pt",val:`${fmtPt(s.cumPt)}pt`,color:s.cumPt>=0?C.primary:C.red},{label:"平均pt",val:`${fmtPt(s.avg)}pt`,color:s.avg>=0?C.primary:C.red}].map(({label,val,color})=>(
            <div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 13px"}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:3}}>{label}</div>
              <div style={{fontSize:17,fontWeight:800,color}}>{val}</div>
            </div>
          ))}
        </div>
        <SL>累計精算実績</SL>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:11,overflow:"hidden",marginBottom:14}}>
          {[{label:"累計獲得チップ",val:`${s.cumChips>=0?"+":""}${s.cumChips}枚`,color:s.cumChips>0?C.gold:s.cumChips<0?C.red:C.muted,icon:"🎴"},{label:"累計獲得雀（場代除く）",val:`${s.cumJan>=0?"+":""}${s.cumJan.toFixed(1)}雀`,color:s.cumJan>0?C.primary:s.cumJan<0?C.red:C.muted,icon:"🀄"}].map(({label,val,color,icon},i)=>(
            <div key={label} style={{padding:"13px 15px",borderBottom:i===0?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>{icon}</span><span style={{fontSize:12,color:C.muted}}>{label}</span></div>
              <span style={{fontWeight:800,fontSize:17,color}}>{val}</span>
            </div>
          ))}
        </div>
        {pRooms.length>0&&<><SL>参加中の部屋</SL>{pRooms.map(r=><div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",marginBottom:7,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:600}}>{r.name}</span><span style={{fontSize:11,color:C.muted}}>{r.games.length}半荘</span></div>)}</>}
        <div style={{marginTop:14}}><Btn variant="danger" onClick={()=>{deletePlayer(detail);setDetail(null);}}>このプレイヤーを削除</Btn></div>
      </div>
    </div>);
  }
  const sorted=[...players].sort((a,b)=>getStats(b.id).cumPt-getStats(a.id).cumPt);
  return(<div>
    <Header title="プレイヤー" right={<button onClick={()=>setAdding(!adding)} style={{background:C.primaryBg,border:`1px solid ${C.primary}40`,color:C.primary,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>＋追加</button>}/>
    <div style={{padding:"13px 15px"}}>
      {adding&&<div style={{background:C.card,border:`1px solid ${C.primary}40`,borderRadius:10,padding:"12px 13px",marginBottom:12}}>
        <Field label="プレイヤー名" value={name} onChange={setName} placeholder="名前を入力"/>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={()=>{if(name.trim()){addPlayer(name.trim());setName("");setAdding(false);}}} disabled={!name.trim()}>追加する</Btn>
          <Btn variant="ghost" onClick={()=>{setAdding(false);setName("");}} full={false} sx={{padding:"11px 14px"}}>×</Btn>
        </div>
      </div>}
      {sorted.length===0&&!adding&&<Empty icon="👥" text="プレイヤーを追加して始めましょう"/>}
      {sorted.map((p,i)=>{
        const s=getStats(p.id);
        return(<div key={p.id} onClick={()=>setDetail(p.id)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 13px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:i===0?C.goldBg:C.card2,border:`1px solid ${i===0?C.gold+"50":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:i===0?C.gold:C.muted}}>{i===0?"👑":i+1}</div>
            <div>
              <div style={{fontWeight:600,fontSize:14}}>{p.name}</div>
              <div style={{fontSize:10,color:C.muted}}>{s.count}半荘 · 1位{s.wins}回 · {s.cumChips>=0?"+":""}{s.cumChips}枚</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <Pts v={s.cumPt} sz={13}/>
            <div style={{fontSize:10,color:s.cumJan>0?C.primary:s.cumJan<0?C.red:C.muted,fontWeight:700}}>{s.cumJan>=0?"+":""}{s.cumJan.toFixed(1)}雀</div>
          </div>
        </div>);
      })}
    </div>
  </div>);
}

function DefaultSettingsScreen({defaults,setDefaults}){
  const [s,setS]=useState({...defaults});
  const [mode,setMode]=useState("yonma");
  const [saved,setSaved]=useState(false);
  return(<div>
    <Header title="デフォルト設定"/>
    <div style={{padding:"13px 15px"}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 12px",marginBottom:14,fontSize:11,color:C.muted}}>新しい部屋を作るときの初期値です。</div>
      <SettingsPanel s={s} setS={setS} mode={mode} setMode={setMode}/>
      <Btn onClick={()=>{setDefaults({...s});setSaved(true);setTimeout(()=>setSaved(false),2000);}}>{saved?"✓ 保存しました！":"デフォルト値を保存する"}</Btn>
    </div>
  </div>);
}


function MahjongTableScreen(){
  const [activeTab,setActiveTab]=useState("fu");
  const [isOya,setIsOya]=useState(false);

  const fuList=[20,25,30,40,50,60,70,80,90,100,110];
  const hanList=[1,2,3,4];

  const ronKo={20:{2:2000,3:3900,4:7700},25:{1:0,2:2400,3:4800,4:9600},30:{1:1000,2:2000,3:3900,4:7700},40:{1:1300,2:2600,3:5200,4:10400},50:{1:1600,2:3200,3:6400,4:12800},60:{1:2000,2:3900,3:7700,4:15400},70:{1:2300,2:4500,3:8000,4:16000},80:{1:2600,2:5200,3:8000,4:16000},90:{1:2900,2:5800,3:8000,4:16000},100:{1:3200,2:6400,3:8000,4:16000},110:{1:3600,2:7100,3:8000,4:16000}};
  const oyaRon={20:{2:3900,3:7700,4:15400},25:{2:4800,3:9600,4:19200},30:{1:1500,2:2900,3:5800,4:11600},40:{1:2000,2:3900,3:7700,4:15400},50:{1:2400,2:4800,3:9600,4:19200},60:{1:2900,2:5800,3:11600,4:23100},70:{1:3400,2:6800,3:12000,4:24000},80:{1:3900,2:7700,3:12000,4:24000},90:{1:4400,2:8700,3:12000,4:24000},100:{1:4800,2:9600,3:12000,4:24000},110:{1:5300,2:10600,3:12000,4:24000}};
  const tsumoKo={20:{2:[300,500],3:[500,1000],4:[1000,2000]},25:{2:[400,700],3:[800,1600],4:[1600,3200]},30:{1:[300,500],2:[500,1000],3:[1000,2000],4:[2000,3900]},40:{1:[400,700],2:[700,1300],3:[1300,2600],4:[2600,5200]},50:{1:[400,800],2:[800,1600],3:[1600,3200],4:[3200,6400]},60:{1:[500,1000],2:[1000,2000],3:[2000,3900],4:[3900,7700]},70:{1:[600,1200],2:[1200,2300],3:[2300,4500],4:[4500,8000]},80:{1:[700,1300],2:[1300,2600],3:[2600,5200],4:[5200,8000]},90:{1:[800,1500],2:[1500,2900],3:[2900,5800],4:[5800,8000]},100:{1:[800,1600],2:[1600,3200],3:[3200,6400],4:[6400,8000]},110:{1:[900,1800],2:[1800,3600],3:[3600,7100],4:[7100,8000]}};
  const oyaTsumo={20:{2:[700,700],3:[1300,1300],4:[2600,2600]},25:{2:[800,800],3:[1600,1600],4:[3200,3200]},30:{1:[500,500],2:[1000,1000],3:[2000,2000],4:[3900,3900]},40:{1:[700,700],2:[1300,1300],3:[2600,2600],4:[5200,5200]},50:{1:[800,800],2:[1600,1600],3:[3200,3200],4:[6400,6400]},60:{1:[1000,1000],2:[2000,2000],3:[3900,3900],4:[7700,7700]},70:{1:[1200,1200],2:[2300,2300],3:[4500,4500],4:[8000,8000]},80:{1:[1300,1300],2:[2600,2600],3:[5200,5200],4:[8000,8000]},90:{1:[1500,1500],2:[2900,2900],3:[5800,5800],4:[8000,8000]},100:{1:[1600,1600],2:[3200,3200],3:[6400,6400],4:[8000,8000]},110:{1:[1800,1800],2:[3600,3600],3:[7100,7100],4:[8000,8000]}};

  const ronTable=isOya?oyaRon:ronKo;
  const tsumoTable=isOya?oyaTsumo:tsumoKo;

  const thStyle={padding:"7px 8px",fontSize:11,fontWeight:700,borderBottom:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,textAlign:"center",background:C.card2};
  const fuCellStyle={padding:"5px 8px",fontWeight:700,fontSize:12,color:C.gold,borderBottom:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,textAlign:"center",background:C.card2,whiteSpace:"nowrap"};
  const getCellStyle=(isMg)=>({padding:"5px 4px",textAlign:"center",fontSize:11,fontWeight:700,color:isMg?C.gold:C.text,background:isMg?"rgba(245,158,11,0.1)":"transparent",borderBottom:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`});

  const yakuman=[
    {name:"満貫",ron:isOya?12000:8000,ko:isOya?4000:2000,oya:isOya?4000:4000},
    {name:"跳満",ron:isOya?18000:12000,ko:isOya?6000:3000,oya:isOya?6000:6000},
    {name:"倍満",ron:isOya?24000:16000,ko:isOya?8000:4000,oya:isOya?8000:8000},
    {name:"三倍満",ron:isOya?36000:24000,ko:isOya?12000:6000,oya:isOya?12000:12000},
    {name:"役満",ron:isOya?48000:32000,ko:isOya?16000:8000,oya:isOya?16000:16000},
  ];

  const yakuData=[
    {cat:"1翻",items:[{n:"立直",d:"テンパイ宣言+1000点棒"},{n:"門前清自摸和",d:"門前でツモ和了"},{n:"断么九（タンヤオ）",d:"1・9・字牌なし"},{n:"平和（ピンフ）",d:"全順子＋両面待ち"},{n:"一盃口",d:"同じ順子2組（門前）"},{n:"混全带么九",d:"各面子に1/9/字牌"},{n:"一気通貫",d:"123 456 789 同色"},{n:"三色同順",d:"同じ数字の順子3色"},{n:"三色同刻",d:"同じ数字の刻子3色"},{n:"海底摸月",d:"最後のツモで和了"},{n:"河底撈魚",d:"最後の牌でロン"},{n:"嶺上開花",d:"嶺上牌で和了"},{n:"槍槓",d:"加槓牌でロン"},{n:"ダブル立直",d:"第一ツモ前にリーチ"}]},
    {cat:"2翻",items:[{n:"七対子",d:"7種の対子"},{n:"対々和（トイトイ）",d:"全部刻子"},{n:"三暗刻",d:"暗刻3組"},{n:"混老頭",d:"1・9・字牌のみ"},{n:"小三元",d:"三元牌2刻子+1対子"},{n:"一発",d:"リーチ後最初の和了"}]},
    {cat:"3翻",items:[{n:"二盃口",d:"一盃口2組（門前）"},{n:"清全帯么九",d:"各面子に1か9"},{n:"混一色（ホンイツ）",d:"1色+字牌のみ"}]},
    {cat:"6翻",items:[{n:"清一色（チンイツ）",d:"1色のみ（門前6翻）"}]},
    {cat:"役満",items:[{n:"国士無双",d:"1・9・字牌13種+1枚"},{n:"九蓮宝燈",d:"1色で1112345678999"},{n:"天和",d:"親の配牌で和了"},{n:"地和",d:"子の第一ツモで和了"},{n:"大三元",d:"三元牌3種刻子"},{n:"四暗刻",d:"暗刻4組"},{n:"字一色",d:"字牌のみ"},{n:"緑一色",d:"2・3・4・6・8・發のみ"},{n:"清老頭",d:"1・9牌のみ"},{n:"大四喜",d:"風牌4種刻子"},{n:"小四喜",d:"風牌3刻子+1対子"},{n:"四槓子",d:"槓4回"}]},
  ];

  return(
    <div>
      <Header title="点数表"/>
      <div style={{padding:"10px 15px"}}>
        <div style={{display:"flex",background:C.card2,borderRadius:9,padding:3,marginBottom:10,border:`1px solid ${C.border}`}}>
          {["子（コ）","親（オヤ）"].map((l,i)=>(
            <button key={l} onClick={()=>setIsOya(i===1)} style={{flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:(i===0&&!isOya)||(i===1&&isOya)?C.card:"transparent",color:(i===0&&!isOya)||(i===1&&isOya)?C.text:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",background:C.card2,borderRadius:9,padding:3,marginBottom:12,border:`1px solid ${C.border}`}}>
          {[{id:"fu",l:"符・翻表"},{id:"yaku",l:"役満等"},{id:"yakuref",l:"役一覧"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:activeTab===t.id?C.card:"transparent",color:activeTab===t.id?C.text:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>
          ))}
        </div>

        {activeTab==="fu"&&<>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>ロン（{isOya?"親":"子"}）　8000点↑は満貫</div>
          <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`,background:C.card,marginBottom:14}}>
            <table style={{borderCollapse:"collapse",width:"100%",minWidth:300}}>
              <thead><tr>
                <th style={{...thStyle,color:C.muted}}>符＼翻</th>
                {hanList.map(h=><th key={h} style={{...thStyle,color:C.primary}}>{h}翻</th>)}
              </tr></thead>
              <tbody>
                {fuList.map(fu=>{
                  const row=ronTable[fu];
                  if(!row)return null;
                  return(
                    <tr key={fu}>
                      <td style={fuCellStyle}>{fu}符</td>
                      {hanList.map(h=>{
                        const v=row[h];
                        const isMg=v&&v>=8000;
                        return<td key={h} style={getCellStyle(isMg)}>{v?isMg?"満貫":v.toLocaleString():"−"}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>ツモ（{isOya?"親":"子"}）　子/親払い表示</div>
          <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`,background:C.card,marginBottom:8}}>
            <table style={{borderCollapse:"collapse",width:"100%",minWidth:300}}>
              <thead><tr>
                <th style={{...thStyle,color:C.muted}}>符＼翻</th>
                {hanList.map(h=><th key={h} style={{...thStyle,color:C.primary}}>{h}翻</th>)}
              </tr></thead>
              <tbody>
                {fuList.map(fu=>{
                  const row=tsumoTable[fu];
                  if(!row)return null;
                  return(
                    <tr key={fu}>
                      <td style={fuCellStyle}>{fu}符</td>
                      {hanList.map(h=>{
                        const v=row[h];
                        const isMg=Array.isArray(v)&&v[0]>=2000;
                        return<td key={h} style={getCellStyle(isMg)}><span style={{fontSize:10}}>{Array.isArray(v)?`${v[0]}/${v[1]}`:"−"}</span></td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{fontSize:9,color:C.muted}}>※ ツモ: 子払い/親払い（親のときは全員同額）</div>
        </>}

        {activeTab==="yaku"&&<>
          <div style={{fontSize:10,color:C.muted,marginBottom:8}}>5翻以上・役満（{isOya?"親":"子"}）</div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            {yakuman.map((y,i)=>(
              <div key={y.name} style={{padding:"12px 14px",borderBottom:i<yakuman.length-1?`1px solid ${C.border}`:"none"}}>
                <div style={{fontWeight:800,fontSize:14,color:C.gold,marginBottom:8}}>{y.name}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  {[{l:"ロン",v:y.ron},{l:isOya?"ツモ（全員）":"ツモ（子払）",v:y.ko},{l:isOya?"":"ツモ（親払）",v:isOya?null:y.oya}].filter(x=>x.l).map(({l,v})=>(
                    v!==null&&<div key={l} style={{background:C.card2,borderRadius:6,padding:"6px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{l}</div>
                      <div style={{fontSize:12,fontWeight:800,color:C.primary}}>{v?.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>}

        {activeTab==="yakuref"&&<>
          <div style={{fontSize:10,color:C.muted,marginBottom:8}}>主な役の一覧</div>
          {yakuData.map(({cat,items})=>(
            <div key={cat} style={{marginBottom:12}}>
              <SL mt={0}>{cat}</SL>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
                {items.map((item,i)=>(
                  <div key={item.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",borderBottom:i<items.length-1?`1px solid ${C.border}`:"none"}}>
                    <span style={{fontWeight:700,fontSize:13}}>{item.n}</span>
                    <span style={{fontSize:10,color:C.muted,maxWidth:"55%",textAlign:"right"}}>{item.d}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}


const NAV=[{id:"home",icon:"⌂",label:"ホーム"},{id:"players",icon:"♟",label:"プレイヤー"},{id:"table",icon:"🀄",label:"点数表"},{id:"settings",icon:"✦",label:"設定"}];
function BottomNav({tab,setTab}){
  return(<div style={{display:"flex",background:C.nav,borderTop:`1px solid ${C.border}`,padding:"8px 0 12px",flexShrink:0}}>
    {NAV.map(item=><button key={item.id} onClick={()=>setTab(item.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 0",fontFamily:"inherit"}}>
      <span style={{fontSize:19,lineHeight:1,color:tab===item.id?C.primary:C.muted}}>{item.icon}</span>
      <span style={{fontSize:9,fontWeight:700,color:tab===item.id?C.primary:C.muted}}>{item.label}</span>
    </button>)}
  </div>);
}

export default function App(){
  const [loaded,setLoaded]=useState(false);
  const [tab,setTab]=useState("home");
  const [view,setViewRaw]=useState({type:"home"});
  const [players,setPlayers]=useState([]);
  const [rooms,setRooms]=useState([]);
  const [defaults,setDefaults]=useState({...DEF});

  const setView=(v)=>{setViewRaw(v);if(["home","players","settings","table"].includes(v.type))setTab(v.type);};
  const handleTab=(t)=>{setTab(t);setViewRaw({type:t});};

  useEffect(()=>{
    (async()=>{
      try{
        const rs=await Promise.allSettled([window.storage.get("mj_players"),window.storage.get("mj_rooms2"),window.storage.get("mj_defaults")]);
        if(rs[0].status==="fulfilled"&&rs[0].value) setPlayers(JSON.parse(rs[0].value.value));
        if(rs[1].status==="fulfilled"&&rs[1].value) setRooms(JSON.parse(rs[1].value.value));
        if(rs[2].status==="fulfilled"&&rs[2].value) setDefaults({...DEF,...JSON.parse(rs[2].value.value)});
      }catch(e){}
      setLoaded(true);
    })();
  },[]);

  useEffect(()=>{if(loaded)window.storage.set("mj_players",JSON.stringify(players)).catch(()=>{});},[players,loaded]);
  useEffect(()=>{if(loaded)window.storage.set("mj_rooms2",JSON.stringify(rooms)).catch(()=>{});},[rooms,loaded]);
  useEffect(()=>{if(loaded)window.storage.set("mj_defaults",JSON.stringify(defaults)).catch(()=>{});},[defaults,loaded]);

  const addPlayer=(name)=>setPlayers(ps=>[...ps,{id:uid(),name,createdAt:new Date().toISOString()}]);
  const deletePlayer=(id)=>setPlayers(ps=>ps.filter(p=>p.id!==id));
  const addRoom=(room)=>{setRooms(rs=>[room,...rs]);setView({type:"room",roomId:room.id});};
  const updateRoom=(room)=>setRooms(rs=>rs.map(r=>r.id===room.id?room:r));
  const deleteRoom=(id)=>setRooms(rs=>rs.filter(r=>r.id!==id));
  const getRoom=(id)=>rooms.find(r=>r.id===id);
  const showNav=["home","players","settings","table"].includes(view.type);

  if(!loaded) return(
    <div style={{background:C.bg,height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif"}}>
      <div style={{color:C.muted,fontSize:13}}>読み込み中…</div>
    </div>
  );

  const render=()=>{
    switch(view.type){
      case"home":return <HomeScreen rooms={rooms} players={players} setView={setView} deleteRoom={deleteRoom}/>;
      case"players":return <PlayersScreen players={players} addPlayer={addPlayer} deletePlayer={deletePlayer} rooms={rooms}/>;
      case"settings":return <DefaultSettingsScreen defaults={defaults} setDefaults={setDefaults}/>;
      case"table":return <MahjongTableScreen/>;
      case"createRoom":return <CreateRoomScreen players={players} defaults={defaults} onSave={addRoom} onBack={()=>setView({type:"home"})}/>;
      case"room":{const r=getRoom(view.roomId);return r?<RoomScreen room={r} players={players} updateRoom={updateRoom} setView={setView} deleteRoom={deleteRoom}/>:<HomeScreen rooms={rooms} players={players} setView={setView} deleteRoom={deleteRoom}/>;}
      case"recordGame":{const r=getRoom(view.roomId);return r?<RecordGameScreen room={r} players={players} onSave={(g)=>{updateRoom({...r,games:[g,...r.games]});setView({type:"room",roomId:r.id});}} onBack={()=>setView({type:"room",roomId:r.id})}/>:null;}
      case"settle":{const r=getRoom(view.roomId);return r?<SettleScreen room={r} players={players} updateRoom={updateRoom} onBack={()=>setView({type:"room",roomId:r.id})}/>:null;}
      case"roomSettings":{const r=getRoom(view.roomId);return r?<RoomSettingsScreen room={r} players={players} onSave={(nr)=>{updateRoom(nr);setView({type:"room",roomId:nr.id});}} onBack={()=>setView({type:"room",roomId:r.id})}/>:null;}
      default:return null;
    }
  };

  return(
    <div style={{background:C.bg,height:"100vh",display:"flex",flexDirection:"column",maxWidth:430,margin:"0 auto",fontFamily:"'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif",color:C.text,overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",display:"flex",flexDirection:"column"}}>{render()}</div>
      {showNav&&<BottomNav tab={tab} setTab={handleTab}/>}
    </div>
  );
}
