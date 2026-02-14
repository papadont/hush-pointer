import React,{useEffect,useMemo,useRef,useState}from"react";
import { ensureAnonymousUser } from "./lib/firebaseConfig";
import { deleteScreenshotById, listScreenshotsByUid, saveScreenshot, type ScreenshotRecord } from "./lib/firestoreService";
import { elementToPngDataUrl } from "./lib/screenshot";
// HUSH·POINTER v1.5b : trackball-oriented reaction training (frozen, compact build)

type Color="blue"|"red";type ColorScheme="default"|"warm"|"moss"|"dusk"|"dark";type Mode="left"|"right"|"random";type BeepMode="all"|"miss"|"off";type ReactionSample={t:number;color:Color};

const nextBeep=(m:BeepMode):BeepMode=>m==="all"?"miss":m==="miss"?"off":"all";

const DURATION=60,BEEP={HIT:480,MISS:140,FINISH:700}; // game length (sec) & beep frequencies
const SCHEMES:Record<ColorScheme,{BLUE:string;RED:string;HIST_BLUE:string;HIST_RED:string}>={default:{BLUE:"#5878a6",RED:"#e48b9e",HIST_BLUE:"rgba(88,120,166,0.78)",HIST_RED:"rgba(224,123,147,0.78)"},warm:{BLUE:"#6f8f7a",RED:"#e07b6a",HIST_BLUE:"rgba(111,143,122,0.78)",HIST_RED:"rgba(224,123,106,0.78)"},moss:{BLUE:"#3f8f6f",RED:"#d07a8a",HIST_BLUE:"rgba(63,143,111,0.78)",HIST_RED:"rgba(208,122,138,0.78)"},dusk:{BLUE:"#5f6b7a",RED:"#c3a8ad",HIST_BLUE:"rgba(95,107,122,0.78)",HIST_RED:"rgba(195,168,173,0.78)"},dark:{BLUE:"#81a1c1",RED:"#bf616a",HIST_BLUE:"rgba(129,161,193,0.78)",HIST_RED:"rgba(191,97,106,0.78)"}};
const THEMES:any={default:{appTop:"#fbfaf8",appBottom:"#f6f2ec",area:"#fbfaf8",panel:"rgba(244,242,238,0.92)",msg:"rgba(244,242,238,0.92)",finish:"rgba(244,242,238,0.96)",card:"rgba(255,255,255,0.72)",ink:"#0f172a",inkSoft:"rgba(71,85,105,0.92)",border:"rgba(148,163,184,0.52)",shadow:"0 0.5px 1.5px rgba(90,80,60,0.06)"},warm:{appTop:"#fff8f1",appBottom:"#f5ece2",area:"#fffaf4",panel:"rgba(248,238,229,0.94)",msg:"rgba(248,238,229,0.94)",finish:"rgba(248,238,229,0.97)",card:"rgba(255,252,246,0.76)",ink:"#241a13",inkSoft:"rgba(98,72,56,0.92)",border:"rgba(177,148,120,0.50)",shadow:"0 0.75px 1.75px rgba(120,85,55,0.10)"},moss:{appTop:"#f6fbf7",appBottom:"#eef4f0",area:"#f9fdfb",panel:"rgba(236,244,239,0.94)",msg:"rgba(236,244,239,0.94)",finish:"rgba(236,244,239,0.97)",card:"rgba(255,255,255,0.74)",ink:"#0d1a14",inkSoft:"rgba(38,70,55,0.90)",border:"rgba(92,124,110,0.48)",shadow:"0 0.75px 1.75px rgba(40,70,55,0.10)"},dusk:{appTop:"#f2f3f5",appBottom:"#e6e8eb",area:"#f4f5f7",panel:"rgba(230,232,235,0.92)",msg:"rgba(230,232,235,0.92)",finish:"rgba(230,232,235,0.96)",card:"rgba(255,255,255,0.68)",ink:"#1f2933",inkSoft:"rgba(55,65,81,0.88)",border:"rgba(120,130,140,0.42)",shadow:"0 0.75px 1.75px rgba(60,65,70,0.10)"},dark:{appTop:"#313846",appBottom:"#2f3542",area:"#2e3440",panel:"rgba(46,52,64,0.94)",msg:"rgba(46,52,64,0.94)",finish:"rgba(46,52,64,0.97)",card:"rgba(59,66,82,0.84)",ink:"#eceff4",inkSoft:"rgba(216,222,233,0.85)",border:"rgba(76,86,106,0.58)",shadow:"0 1px 3px rgba(0,0,0,0.48)"}};

const median=(v:number[])=>{if(!v.length)return 0;const s=[...v].sort((a,b)=>a-b),m=(s.length/2)|0;return s.length%2?(s[m]??0):((s[m-1]??0)+(s[m]??0))/2};
const rgba=(hex:string,a:number)=>{const h=hex.replace("#","").trim();if(h.length!==6)return"rgba(0,0,0,"+a+")";const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return`rgba(${r},${g},${b},${a})`};
const formatDateTime=(d:Date|null)=>{
  if(!d)return"(time pending)";
  const yyyy=d.getFullYear().toString();
  const mm=(d.getMonth()+1).toString().padStart(2,"0");
  const dd=d.getDate().toString().padStart(2,"0");
  const hh=d.getHours().toString().padStart(2,"0");
  const mi=d.getMinutes().toString().padStart(2,"0");
  const ss=d.getSeconds().toString().padStart(2,"0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
};
const formatShotKind=(kind:"finish"|"painter")=>kind==="finish"?"Finish Card":"Paint";
function buildHistogramByColor(bt:number[],rt:number[],bins=18){const all=[...bt,...rt];if(!all.length)return{blue:[]as number[],red:[]as number[],min:0,max:0,bins};const tMin=Math.min(...all),tMax=Math.max(...all),pad=Math.max(.02,(tMax-tMin)*.08),min=Math.max(0,tMin-pad),max=Math.max(min+.001,tMax+pad),blue=new Array(bins).fill(0),red=new Array(bins).fill(0),add=(arr:number[],t:number)=>{const p=(t-min)/(max-min),idx=Math.min(bins-1,Math.max(0,Math.floor(p*bins)));arr[idx]+=1};for(const t of bt)add(blue,t);for(const t of rt)add(red,t);return{blue,red,min,max,bins}}
function calcHitScore(targetSizePx:number,reactionSec:number|null,areaWidthPx:number,areaHeightPx:number){
  const base=Math.max(1,Math.floor(1000/Math.max(1,targetSizePx)));
  const rf=reactionSec&&reactionSec>0?Math.min(1.5,Math.max(.7,.5/reactionSec)):1;
  const baselineArea=1000*700,area=Math.max(1,areaWidthPx)*Math.max(1,areaHeightPx);
  const af=Math.min(1.35,Math.max(.8,Math.sqrt(area/baselineArea)));
  return Math.max(1,Math.floor(base*rf*af));
}

export default function App(){
  const[scheme,setScheme]=useState<ColorScheme>("default"),{BLUE,RED,HIST_BLUE,HIST_RED}=SCHEMES[scheme],theme=THEMES[scheme];
  const [schemeTip, setSchemeTip] = useState<"" | ColorScheme | "nord">("");
  const areaRef=useRef<HTMLDivElement|null>(null),targetSpawnedAt=useRef(0),ignoredFirstReaction=useRef(false),hoveringTargetRef=useRef(false),prevRingActiveRef=useRef(false);
  const[running,setRunning]=useState(false),[finished,setFinished]=useState(false),[timeLeft,setTimeLeft]=useState(DURATION);
  const[score,setScore]=useState(0),scoreRef=useRef(0),[hitCount,setHitCount]=useState(0),hitRef=useRef(0),[miss,setMiss]=useState(0),missRef=useRef(0);
  const[streak,setStreak]=useState(0),[comboFlash,setComboFlash]=useState(false),[message,setMessage]=useState("");
  const[perfectBonus,setPerfectBonus]=useState(0),[showPerfectBonus,setShowPerfectBonus]=useState(false),perfectBonusRef=useRef(0);
  const[targetSize,setTargetSize]=useState(14),[target,setTarget]=useState<{x:number;y:number;color:Color}|null>(null);
  const[mode,setMode]=useState<Mode>("random"),[beepMode,setBeepMode]=useState<BeepMode>("miss");
  const[reactionSamples,setReactionSamples]=useState<ReactionSample[]>([]);
  const[glowMode,setGlowMode]=useState(false),[hoveringTarget,setHoveringTarget]=useState(false),[ringFlashId,setRingFlashId]=useState(0);
  const[pointerGuide,setPointerGuide]=useState(false);

  // --- bonus mode : HUSH·PAINTER ---
  const[extraMode,setExtraMode]=useState(false);
  const finishCardRef=useRef<HTMLDivElement|null>(null);
  const painterCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const painterCtxRef=useRef<CanvasRenderingContext2D|null>(null);
  const drawingRef=useRef(false);
  const erasingStrokeRef=useRef(false);
  const lastPtRef=useRef<{x:number;y:number}|null>(null);
  const auraStrokeRef=useRef(false);
  const marbleSeedRef=useRef(0);
  const[eraserMode,setEraserMode]=useState(false);
  const[savingFinish,setSavingFinish]=useState(false);
  const[savingPainter,setSavingPainter]=useState(false);
  const[userUid,setUserUid]=useState("");
  const[screenshotList,setScreenshotList]=useState<ScreenshotRecord[]>([]);
  const[screenshotLoading,setScreenshotLoading]=useState(false);
  const[screenshotError,setScreenshotError]=useState("");
  const[showScreenshotList,setShowScreenshotList]=useState(false);
  const[selectedScreenshot,setSelectedScreenshot]=useState<ScreenshotRecord|null>(null);
  const[deletingScreenshotId,setDeletingScreenshotId]=useState("");
  const[modalNavVisible,setModalNavVisible]=useState(false);
  const[modalNavEdge,setModalNavEdge]=useState<""|"left"|"right">("");
  const screenshotPanelRef=useRef<HTMLDivElement|null>(null);
  const screenshotToggleRef=useRef<HTMLButtonElement|null>(null);
  const modalImageRef=useRef<HTMLImageElement|null>(null);
  const suppressPainterPointerDownRef=useRef(false);
  const modalNavHideTimerRef=useRef<number|undefined>(undefined);
  const[paintScore,setPaintScore]=useState(0),paintScoreRef=useRef(0);
  const[paintStrokes,setPaintStrokes]=useState(0),paintStrokesRef=useRef(0);
  const paintAreaRef=useRef(0);
  const painterLineWidth=useMemo(()=>Math.max(1,Math.round(targetSize/3.5)),[targetSize]);
  const painterEraserLineWidth=useMemo(()=>Math.max(4,Math.round(painterLineWidth*2.2)),[painterLineWidth]);

  const reactionTimes=useMemo(()=>reactionSamples.map(s=>s.t),[reactionSamples]);
  const medianReaction=useMemo(()=>median(reactionTimes),[reactionTimes]);
  const minReaction=useMemo(()=>reactionTimes.length?Math.min(...reactionTimes):0,[reactionTimes]);
  const blueTimes=useMemo(()=>reactionSamples.filter(s=>s.color==="blue").map(s=>s.t),[reactionSamples]);
  const redTimes=useMemo(()=>reactionSamples.filter(s=>s.color==="red").map(s=>s.t),[reactionSamples]);
  const hist=useMemo(()=>buildHistogramByColor(blueTimes,redTimes,18),[blueTimes,redTimes]);
  const histMax=useMemo(()=>{if(!hist.blue.length)return 0;let m=0;for(let i=0;i<hist.bins;i++)m=Math.max(m,(hist.blue[i]??0)+(hist.red[i]??0));return m},[hist]);
  const screenshotKindForMode=extraMode?"painter":"finish";
  const visibleScreenshotList=useMemo(
    ()=>screenshotList.filter(item=>item.kind===screenshotKindForMode),
    [screenshotList,screenshotKindForMode]
  );
  const selectedScreenshotIndex=useMemo(
    ()=>selectedScreenshot?visibleScreenshotList.findIndex(s=>s.id===selectedScreenshot.id):-1,
    [selectedScreenshot,visibleScreenshotList]
  );
  const timeText=useMemo(()=>`${Math.ceil(timeLeft).toString().padStart(2,"0")}s`,[timeLeft]);
  const glowVars:React.CSSProperties&{"--glowBase"?:number}={"--glowBase":hoveringTarget?1.05:.82};
  const guideGridMajor=scheme==="dark"?"rgba(122,130,144,0.30)":rgba(BLUE,.16);
  const guideGridMinor=scheme==="dark"?"rgba(103,110,123,0.18)":rgba(BLUE,.08);
  const isNord=scheme==="dark";

  const flashMessage=(txt:string)=>{setMessage(txt);window.clearTimeout((flashMessage as any)._t);(flashMessage as any)._t=window.setTimeout(()=>setMessage(""),2800)};
  const playBeep=(freq:number,kind:"hit"|"miss"|"finish")=>{if(beepMode==="off")return;if(beepMode==="miss"&&kind!=="miss")return;const AudioCtx=window.AudioContext||(window as any).webkitAudioContext;if(!AudioCtx)return;const ctx=new AudioCtx(),osc=ctx.createOscillator(),g=ctx.createGain();osc.type="square";osc.frequency.value=freq;const now=ctx.currentTime;g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(.18,now+.002);osc.connect(g);g.connect(ctx.destination);osc.start();const dur=kind==="finish"?.18:.04;g.gain.linearRampToValueAtTime(.0001,now+dur);osc.stop(now+dur+.002);osc.onended=()=>{try{ctx.close()}catch{}}};
  const clearModalNavHideTimer=()=>{if(modalNavHideTimerRef.current!=null){window.clearTimeout(modalNavHideTimerRef.current);modalNavHideTimerRef.current=undefined}};
  const hideModalNav=()=>{clearModalNavHideTimer();setModalNavVisible(false);setModalNavEdge("")};
  const scheduleModalNavHide=()=>{clearModalNavHideTimer();modalNavHideTimerRef.current=window.setTimeout(()=>{setModalNavVisible(false);setModalNavEdge("");modalNavHideTimerRef.current=undefined},2000)};
  const openModalScreenshotAt=(index:number)=>{const item=visibleScreenshotList[index];if(item)setSelectedScreenshot(item)};
  const getAreaBackgroundColor=()=>{
    const area=areaRef.current;
    if(!area)return theme.area;
    const areaStyle=window.getComputedStyle(area);
    const bg=areaStyle.backgroundColor;
    if(bg&&bg!=="transparent"&&bg!=="rgba(0, 0, 0, 0)")return bg;
    const areaVar=areaStyle.getPropertyValue("--hp-area").trim();
    if(areaVar)return areaVar;
    const app=area.closest(".hp-app") as HTMLElement|null;
    if(app){
      const appStyle=window.getComputedStyle(app);
      const appBg=appStyle.backgroundColor;
      if(appBg&&appBg!=="transparent"&&appBg!=="rgba(0, 0, 0, 0)")return appBg;
      const appVar=appStyle.getPropertyValue("--hp-area").trim();
      if(appVar)return appVar;
    }
    return theme.area;
  };
  const parseCssRgb=(css:string)=>{
    const m=css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if(!m)return null;
    return [Math.round(Number(m[1])),Math.round(Number(m[2])),Math.round(Number(m[3]))] as const;
  };
  const cropDataUrl=async(dataUrl:string,crop:{x:number;y:number;width:number;height:number})=>{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=reject;
      img.src=dataUrl;
    });
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.floor(crop.width));
    canvas.height=Math.max(1,Math.floor(crop.height));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("2D context unavailable");
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return canvas.toDataURL("image/png");
  };
  const cropDataUrlByBackground=async(dataUrl:string,backgroundCss:string,padding=18,threshold=12)=>{
    const bg=parseCssRgb(backgroundCss);
    if(!bg)return dataUrl;
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=reject;
      img.src=dataUrl;
    });
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,image.naturalWidth||image.width);
    canvas.height=Math.max(1,image.naturalHeight||image.height);
    const ctx=canvas.getContext("2d");
    if(!ctx)return dataUrl;
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
    let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
    for(let y=0;y<canvas.height;y++){
      for(let x=0;x<canvas.width;x++){
        const i=(y*canvas.width+x)*4;
        const a=data[i+3]??0;
        if(a<8)continue;
        const dr=Math.abs((data[i]??0)-bg[0]);
        const dg=Math.abs((data[i+1]??0)-bg[1]);
        const db=Math.abs((data[i+2]??0)-bg[2]);
        if(Math.max(dr,dg,db)<=threshold)continue;
        if(x<minX)minX=x;
        if(y<minY)minY=y;
        if(x>maxX)maxX=x;
        if(y>maxY)maxY=y;
      }
    }
    if(maxX<minX||maxY<minY)return dataUrl;
    const x0=Math.max(0,minX-padding),y0=Math.max(0,minY-padding);
    const x1=Math.min(canvas.width-1,maxX+padding),y1=Math.min(canvas.height-1,maxY+padding);
    return cropDataUrl(dataUrl,{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1});
  };
  const resizeDataUrl=async(dataUrl:string,scale:number)=>{
    const s=Math.max(0.1,Math.min(1,scale));
    if(s===1)return dataUrl;
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=reject;
      img.src=dataUrl;
    });
    const w=Math.max(1,Math.floor((image.naturalWidth||image.width)*s));
    const h=Math.max(1,Math.floor((image.naturalHeight||image.height)*s));
    const canvas=document.createElement("canvas");
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("2D context unavailable");
    ctx.drawImage(image,0,0,w,h);
    return canvas.toDataURL("image/png");
  };
  const cropPainterCanvas=(canvas:HTMLCanvasElement,padding=8)=>{
    const ctx=canvas.getContext("2d");
    if(!ctx)return null;
    const src=ctx.getImageData(0,0,canvas.width,canvas.height);
    const data=src.data;
    let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
    for(let y=0;y<canvas.height;y++){
      for(let x=0;x<canvas.width;x++){
        const a=data[(y*canvas.width+x)*4+3]??0;
        if(a>0){
          if(x<minX)minX=x;
          if(y<minY)minY=y;
          if(x>maxX)maxX=x;
          if(y>maxY)maxY=y;
        }
      }
    }
    if(maxX<minX||maxY<minY)return null;
    const x0=Math.max(0,minX-padding),y0=Math.max(0,minY-padding);
    const x1=Math.min(canvas.width-1,maxX+padding),y1=Math.min(canvas.height-1,maxY+padding);
    return{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};
  };

  const loadScreenshotHistory=async(uid:string)=>{
    if(!uid)return;
    setScreenshotLoading(true);
    setScreenshotError("");
    try{
      const rows=await listScreenshotsByUid(uid,24);
      setScreenshotList(rows);
    }catch(error){
      console.error("Failed to list screenshots",error);
      const reason=error instanceof Error?error.message:String(error);
      setScreenshotError(reason);
    }finally{
      setScreenshotLoading(false);
    }
  };
  const onDeleteScreenshot=async(item:ScreenshotRecord)=>{
    if(deletingScreenshotId)return;
    setDeletingScreenshotId(item.id);
    try{
      await deleteScreenshotById(item.id);
      setScreenshotList(list=>list.filter(v=>v.id!==item.id));
      if(selectedScreenshot?.id===item.id)setSelectedScreenshot(null);
    }catch(error){
      console.error("Failed to delete screenshot",error);
      const reason=error instanceof Error?error.message:String(error);
      flashMessage(`delete failed: ${reason}`);
    }finally{
      setDeletingScreenshotId("");
    }
  };

  useEffect(()=>{
    (async()=>{
      try{
        const user=await ensureAnonymousUser();
        if(!user?.uid)throw new Error("anonymous auth is not ready");
        setUserUid(user.uid);
        await loadScreenshotHistory(user.uid);
      }catch(error){
        const reason=error instanceof Error?error.message:String(error);
        setMessage(`auth failed: ${reason}`);
      }
    })();
  },[]);

  useEffect(()=>{
    if(!showScreenshotList||selectedScreenshot)return;
    const onPointerDown=(ev:PointerEvent)=>{
      const target=ev.target as Node|null;
      if(!target)return;
      if(screenshotPanelRef.current?.contains(target))return;
      if(screenshotToggleRef.current?.contains(target))return;
      if(extraMode)suppressPainterPointerDownRef.current=true;
      setShowScreenshotList(false);
    };
    document.addEventListener("pointerdown",onPointerDown,true);
    return()=>document.removeEventListener("pointerdown",onPointerDown,true);
  },[showScreenshotList,extraMode,selectedScreenshot]);

  useEffect(()=>()=>clearModalNavHideTimer(),[]);

  useEffect(()=>{
    if(!selectedScreenshot)hideModalNav();
  },[selectedScreenshot]);
  useEffect(()=>{
    if(selectedScreenshot&&selectedScreenshot.kind!==screenshotKindForMode){
      setSelectedScreenshot(null);
    }
  },[selectedScreenshot,screenshotKindForMode]);

  const ringStroke=(c:Color)=>{const base=c==="blue"?BLUE:RED;const a=scheme==="dark"?1.0:0.92;return rgba(base,a)};
  const glowBg=(c:Color)=>{const base=c==="blue"?BLUE:RED;const k=scheme==="dark"?1.45:1.0;return `radial-gradient(circle,${rgba(base,.48*k)} 0%,${rgba(base,.30*k)} 42%,${rgba(base,.16*k)} 72%,${rgba(base,0)} 100%)`};
  const coreBg=(c:Color)=>{const base=c==="blue"?BLUE:RED;const k=scheme==="dark"?1.25:1.0;return `radial-gradient(circle,${rgba(base,.95*k)} 0%,${rgba(base,.66*k)} 35%,${rgba(base,.38*k)} 60%,${rgba(base,0)} 100%)`};

  const spawnTarget=()=>{setHoveringTarget(false);hoveringTargetRef.current=false;const area=areaRef.current;if(!area)return;const rect=area.getBoundingClientRect(),w=rect.width,h=rect.height,size=Math.max(2,Math.min(targetSize,Math.min(w,h))),x=Math.random()*Math.max(0,w-size),y=Math.random()*Math.max(0,h-size);
    const color:Color=mode==="left"?"blue":mode==="right"?"red":Math.random()<.5?"blue":"red";targetSpawnedAt.current=performance.now();setTarget({x,y,color})};

  const startGame=()=>{setShowScreenshotList(false);setComboFlash(false);setHitCount(0);hitRef.current=0;setScore(0);scoreRef.current=0;setMiss(0);missRef.current=0;setStreak(0);setTimeLeft(DURATION);setRunning(true);setFinished(false);setMessage("");setPerfectBonus(0);perfectBonusRef.current=0;setShowPerfectBonus(false);setReactionSamples([]);ignoredFirstReaction.current=false;spawnTarget()};

  const endGame=()=>{const missNow=missRef.current,hitNow=hitRef.current,scoreNow=scoreRef.current;
    if(missNow===0&&hitNow>0){const rate=Math.min(.6,.3+hitNow*.01),bonus=Math.max(50,Math.floor(scoreNow*rate));setPerfectBonus(bonus);perfectBonusRef.current=bonus;setShowPerfectBonus(false);setTimeout(()=>setShowPerfectBonus(true),220);
      setScore(()=>{const next=scoreNow+bonus;scoreRef.current=next;return next});flashMessage(`perfect run! +${bonus}`)}else flashMessage("finish!");
    playBeep(BEEP.FINISH,"finish");setRunning(false);setFinished(true);setTimeLeft(0)};

  useEffect(()=>{if(!running)return;const startedAt=performance.now();let raf=0;const tick=()=>{const elapsed=(performance.now()-startedAt)/1000,remain=Math.max(0,DURATION-elapsed);setTimeLeft(remain);if(remain<=0)return endGame();raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[running]);

  useEffect(()=>{const el=areaRef.current;if(!el)return;
    const update=(clientX:number,clientY:number)=>{if(!(running&&target)){if(hoveringTargetRef.current){hoveringTargetRef.current=false;setHoveringTarget(false)}return}
      const rect=el.getBoundingClientRect(),px=clientX-rect.left,py=clientY-rect.top,cx=target.x+targetSize/2,cy=target.y+targetSize/2,r=targetSize/2;
      const dx=px-cx,dy=py-cy,inside=dx*dx+dy*dy<=r*r;
      if(inside!==hoveringTargetRef.current){hoveringTargetRef.current=inside;setHoveringTarget(inside)}};
    const onMove=(ev:PointerEvent)=>update(ev.clientX,ev.clientY);
    const onLeave=()=>{if(!hoveringTargetRef.current)return;hoveringTargetRef.current=false;setHoveringTarget(false)};
    el.addEventListener("pointermove",onMove,{passive:true,capture:true});el.addEventListener("pointerleave",onLeave,{capture:true});
    return()=>{el.removeEventListener("pointermove",onMove,{capture:true}as any);el.removeEventListener("pointerleave",onLeave,{capture:true}as any)}
  },[running,target,targetSize]);

  useEffect(()=>{const ringActive=hoveringTarget&&!glowMode;if(ringActive&&!prevRingActiveRef.current)setRingFlashId(v=>v+1);prevRingActiveRef.current=ringActive},[hoveringTarget,glowMode]);

  const clearPainter=()=>{
    const c=painterCanvasRef.current,ctx=painterCtxRef.current;
    if(!c||!ctx)return;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,c.width,c.height);
    paintAreaRef.current=0;
    paintScoreRef.current=0;setPaintScore(0);
    paintStrokesRef.current=0;setPaintStrokes(0);
  };

  const onAreaDoubleClick=()=>{if(extraMode){clearPainter();return;}if(!running)startGame()};
  const onAreaMouseDown=(e:React.MouseEvent)=>{if(extraMode)return;if(!running)return;if(e.button===2)e.preventDefault();setMiss(m=>{const next=m+1;missRef.current=next;return next});setStreak(0);flashMessage("miss");playBeep(BEEP.MISS,"miss")};

  const onTargetMouseDown=(e:React.MouseEvent)=>{e.stopPropagation();if(!running||!target)return;
    const isBlueClick=e.button===0,isRedClick=e.button===2||(e.button===0&&e.ctrlKey),correctClick=target.color==="blue"?isBlueClick:isRedClick;
    if(!correctClick){setMiss(m=>{const next=m+1;missRef.current=next;return next});setStreak(0);flashMessage(target.color==="blue"?"blue = left":"red = right");playBeep(BEEP.MISS,"miss");return}
    if(target.color==="red")e.preventDefault();setComboFlash(true);window.setTimeout(()=>setComboFlash(false),120);
    setHitCount(h=>{const next=h+1;hitRef.current=next;return next});
    const rect=areaRef.current?.getBoundingClientRect(),areaW=rect?.width??1000,areaH=rect?.height??700;
    let rt:number|null=null;if(targetSpawnedAt.current>0){const v=(performance.now()-targetSpawnedAt.current)/1000;if(Number.isFinite(v)&&v>=0)rt=v}
    const isWarmup=!ignoredFirstReaction.current,nextStreak=streak+1,comboMul=1+Math.min(.5,(nextStreak-1)*.02);
    const basePoints=calcHitScore(targetSize,isWarmup?null:rt,areaW,areaH),points=Math.max(1,Math.floor(basePoints*comboMul));
    setScore(s=>{const next=s+points;scoreRef.current=next;return next});setStreak(nextStreak);
    if(rt!=null){if(isWarmup){ignoredFirstReaction.current=true;flashMessage("warm up")}else setReactionSamples(r=>[...r,{t:rt as number,color:target.color}])}
    spawnTarget();playBeep(BEEP.HIT,"hit")};

  const finishTitleColor=`color-mix(in srgb, ${BLUE} 85%, black)`;
  const painterTitleColor=`color-mix(in srgb, ${BLUE} 55%, ${RED})`;

  // Smooth marbling: return stroke color as HEX (#RRGGBB). Keeps aura/shadow logic simple.
  const painterColorFor=(btn:number)=>{
    if(mode==="left") return BLUE;
    if(mode==="right") return RED;

    // random: smooth blend using a slow oscillating phase
    marbleSeedRef.current += 0.18; // smaller = smoother transition
    const t = (Math.sin(marbleSeedRef.current) + 1) / 2; // 0..1

    // bias by button (left tends to blue, right tends to red)
    const bias = btn===2 ? 0.65 : 0.35;
    const k = Math.min(1, Math.max(0, t * 0.7 + bias * 0.3));

    const parse = (h:string)=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
    const [br,bg,bb] = parse(BLUE);
    const [rr,rg,rb] = parse(RED);
    const r = Math.round(br*(1-k) + rr*k);
    const g = Math.round(bg*(1-k) + rg*k);
    const b = Math.round(bb*(1-k) + rb*k);
    const to2 = (n:number)=>n.toString(16).padStart(2,"0");
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  };
  const ensurePainterCtx=()=>{
    const c=painterCanvasRef.current;
    if(!c) return null;

    // canvas can be remounted when switching modes; never keep a ctx bound to an old canvas
    let ctx=painterCtxRef.current;
    if(!ctx || (ctx as any).canvas!==c){
      ctx=c.getContext("2d");
      painterCtxRef.current=ctx;
    }
    return ctx;
  };

  useEffect(()=>{
    if(!extraMode)return;
    const area=areaRef.current,canvas=painterCanvasRef.current;if(!area||!canvas)return;
    const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    const resize=()=>{
      const r=area.getBoundingClientRect();
      const w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));
      const nextW=Math.floor(w*dpr),nextH=Math.floor(h*dpr);
      const canvas=painterCanvasRef.current;
      const ctx=ensurePainterCtx();
      if(!canvas||!ctx)return;

      let snapshot:ImageData|null=null;
      if(canvas.width>0&&canvas.height>0){
        try{snapshot=ctx.getImageData(0,0,canvas.width,canvas.height);}catch{}
      }

      if(canvas.width!==nextW||canvas.height!==nextH){
        canvas.width=nextW;canvas.height=nextH;
        canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.lineCap="round";ctx.lineJoin="round";
      }

      if(snapshot){
        const tmp=document.createElement("canvas");
        tmp.width=snapshot.width;tmp.height=snapshot.height;
        const tctx=tmp.getContext("2d");
        if(tctx){
          tctx.putImageData(snapshot,0,0);
          ctx.save();
          ctx.setTransform(1,0,0,1,0,0);
          ctx.clearRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(tmp,0,0,canvas.width,canvas.height);
          ctx.restore();
        }
      }
    };
    resize();
    const ro=new ResizeObserver(()=>resize());
    ro.observe(area);
    window.addEventListener("resize",resize,{passive:true});
    return()=>{ro.disconnect();window.removeEventListener("resize",resize as any)};
  },[extraMode]);

  const painterAddArea=(lenPx:number,widthPx:number)=>{
    const add=Math.max(0,lenPx)*Math.max(1,widthPx);
    paintAreaRef.current+=add;

    // painter score: 1pt per 200px-area, then x2 (requested)
    const raw=Math.floor(paintAreaRef.current/200);
    const nextScore=raw*2;

    if(nextScore!==paintScoreRef.current){
      paintScoreRef.current=nextScore;
      setPaintScore(nextScore);
    }
  };

  const toggleEraserMode=()=>{
    setEraserMode(v=>{
      const next=!v;
      flashMessage(next?"eraser mode on":"eraser mode off");
      return next;
    });
  };

  useEffect(()=>{
    if(!extraMode)return;
    const onKeyDown=(e:KeyboardEvent)=>{
      if(e.key!=="Shift"||e.repeat)return;
      e.preventDefault();
      toggleEraserMode();
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>window.removeEventListener("keydown",onKeyDown);
  },[extraMode]);

  const onPainterPointerDown=(e:React.PointerEvent)=>{
    if(!extraMode)return;
    if(suppressPainterPointerDownRef.current){
      suppressPainterPointerDownRef.current=false;
      e.preventDefault();
      return;
    }
    const canvas=painterCanvasRef.current,ctx=ensurePainterCtx();
    if(!canvas||!ctx)return;
    setShowScreenshotList(false);
    if(e.button===2)e.preventDefault();
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    drawingRef.current=true;
    erasingStrokeRef.current=eraserMode;
    auraStrokeRef.current=glowMode;
    marbleSeedRef.current=0;

    const r=canvas.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    lastPtRef.current={x,y};

    setPaintStrokes(s=>{const next=s+1;paintStrokesRef.current=next;return next});

    ctx.lineWidth=erasingStrokeRef.current?painterEraserLineWidth:painterLineWidth;
    if(erasingStrokeRef.current){
      ctx.globalCompositeOperation="destination-out";
      ctx.strokeStyle="rgba(0,0,0,1)";
      ctx.shadowColor="transparent";
      ctx.shadowBlur=0;
    }else{
      const hex=painterColorFor(e.button);
      ctx.globalCompositeOperation="source-over";
      ctx.strokeStyle=hex;
      if(auraStrokeRef.current){ctx.shadowColor=rgba(hex,0.5);ctx.shadowBlur=4.5;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
      else{ctx.shadowColor="transparent";ctx.shadowBlur=0;}
    }
    ctx.beginPath();
    ctx.moveTo(x,y);
  };

  const onPainterPointerMove=(e:React.PointerEvent)=>{
    if(!extraMode||!drawingRef.current)return;
    const canvas=painterCanvasRef.current,ctx=ensurePainterCtx();
    if(!canvas||!ctx)return;
    const r=canvas.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    const last=lastPtRef.current;
    if(!last){lastPtRef.current={x,y};return;}

    const dx=x-last.x,dy=y-last.y;const len=Math.hypot(dx,dy);

    if(erasingStrokeRef.current){
      ctx.globalCompositeOperation="destination-out";
      ctx.shadowColor="transparent";
      ctx.shadowBlur=0;
    }else{
      const hex=painterColorFor(e.buttons===2?2:0);
      ctx.globalCompositeOperation="source-over";
      ctx.strokeStyle=hex;
      if(auraStrokeRef.current){ctx.shadowColor=rgba(hex,0.5);ctx.shadowBlur=4.5;}
    }

    ctx.lineTo(x,y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x,y);

    lastPtRef.current={x,y};
    painterAddArea(len,erasingStrokeRef.current?painterEraserLineWidth:painterLineWidth);
  };

  const endPainterStroke=()=>{if(!extraMode)return;drawingRef.current=false;erasingStrokeRef.current=false;lastPtRef.current=null;const ctx=ensurePainterCtx();if(ctx){ctx.beginPath();ctx.shadowBlur=0;ctx.shadowColor="transparent";ctx.globalCompositeOperation="source-over";}};

  const toggleExtraMode=()=>{
    setExtraMode(v=>{
      const next=!v;
      if(next){
        setEraserMode(false);
        setRunning(false);
        setFinished(false);
        setTarget(null);
        setMessage("");

        // reset painter refs so the first stroke after switching always binds to the new canvas
        drawingRef.current=false;
        lastPtRef.current=null;
        painterCtxRef.current=null;
      }else{
        drawingRef.current=false;
        lastPtRef.current=null;
      }
      return next;
    });
  };

  const saveFinishCardScreenshot=async()=>{
    const card=finishCardRef.current;
    const area=areaRef.current;
    if(!card||!area||savingFinish)return;
    setSavingFinish(true);
    try{
      const user=await ensureAnonymousUser();
      if(!user?.uid) throw new Error("anonymous auth is not ready");
      const bg=getAreaBackgroundColor();
      const areaBase64=await elementToPngDataUrl(area,{backgroundColor:bg});
      const cropped=await cropDataUrlByBackground(areaBase64,bg,18,12);
      const base64=await resizeDataUrl(cropped,0.54);
      await saveScreenshot("finish",base64,{
        uid:user.uid,
        score,
        hits:hitCount,
        miss,
        median:medianReaction,
        best:minReaction,
        perfectBonus,
        scheme,
        mode,
        targetSize,
        glowMode,
        pointerGuide
      });
      await loadScreenshotHistory(user.uid);
      flashMessage("finish screenshot saved");
    }catch(error){
      console.error("Failed to save finish screenshot",error);
      const reason=error instanceof Error?error.message:String(error);
      flashMessage(`save failed: ${reason}`);
    }finally{
      setSavingFinish(false);
    }
  };

  const savePainterScreenshot=async()=>{
    const canvas=painterCanvasRef.current;
    if(!canvas||savingPainter)return;
    setSavingPainter(true);
    try{
      const user=await ensureAnonymousUser();
      if(!user?.uid) throw new Error("anonymous auth is not ready");
      const exportCanvas=document.createElement("canvas");
      const crop=cropPainterCanvas(canvas,10);
      if(crop){
        exportCanvas.width=crop.width;
        exportCanvas.height=crop.height;
      }else{
        exportCanvas.width=canvas.width;
        exportCanvas.height=canvas.height;
      }
      const exportCtx=exportCanvas.getContext("2d");
      if(!exportCtx)throw new Error("2D context unavailable");
      exportCtx.fillStyle=getAreaBackgroundColor();
      exportCtx.fillRect(0,0,exportCanvas.width,exportCanvas.height);
      if(crop)exportCtx.drawImage(canvas,crop.x,crop.y,crop.width,crop.height,0,0,crop.width,crop.height);
      else exportCtx.drawImage(canvas,0,0);
      const base64=exportCanvas.toDataURL("image/png");
      await saveScreenshot("painter",base64,{
        uid:user.uid,
        paintScore,
        paintStrokes,
        ink:Math.floor(paintAreaRef.current),
        eraserMode,
        scheme,
        mode,
        targetSize,
        glowMode,
        pointerGuide
      });
      await loadScreenshotHistory(user.uid);
      flashMessage("painter screenshot saved");
    }catch(error){
      console.error("Failed to save painter screenshot",error);
      const reason=error instanceof Error?error.message:String(error);
      flashMessage(`save failed: ${reason}`);
    }finally{
      setSavingPainter(false);
    }
  };

  return(
    <div className="hp-app min-h-screen w-full flex flex-col items-center p-4 text-xs" style={{...({["--hp-appTop" as any]:theme.appTop,["--hp-appBottom" as any]:theme.appBottom,["--hp-area" as any]:theme.area,["--hp-panel" as any]:theme.panel,["--hp-msg" as any]:theme.msg,["--hp-finish" as any]:theme.finish,["--hp-finishSolid" as any]:(isNord?"color-mix(in srgb, var(--hp-panel) 92%, #556277 8%)":"var(--hp-panel)"),["--hp-card" as any]:theme.card,["--hp-ink" as any]:theme.ink,["--hp-inkSoft" as any]:theme.inkSoft,["--hp-border" as any]:theme.border,["--hp-shadow" as any]:theme.shadow}as any)}}>
      <style>{`
        .hp-app{ color:var(--hp-ink); background: var(--hp-area); }
        .hp-panel{ background:var(--hp-panel); border:1px solid color-mix(in srgb, var(--hp-border) 75%, transparent); box-shadow:var(--hp-shadow); }
        .hp-panelNord{ background:color-mix(in srgb, var(--hp-panel) 92%, #556277 8%); border-color:color-mix(in srgb, var(--hp-border) 70%, rgba(216,222,233,0.32)); box-shadow:0 0.75px 2px rgba(8,12,18,0.30); }
        .hp-area{ background:var(--hp-area); border:none; box-shadow:none; }
        .hp-msg{background:var(--hp-msg); color:var(--hp-inkSoft); border:1px solid var(--hp-border); box-shadow:var(--hp-shadow);}
        .hp-input{background:var(--hp-card); color:var(--hp-ink); border:1px solid var(--hp-border);}
        .hp-finish{position:relative; overflow:hidden; border:1px solid color-mix(in srgb, var(--hp-border) 82%, var(--hp-ink) 18%); box-shadow:var(--hp-shadow); color:var(--hp-inkSoft);}
        .hp-finish::before{content:""; position:absolute; inset:0; background:var(--hp-finishSolid); z-index:0;}
        .hp-finish > *{position:relative; z-index:1;}
        .hp-finish .hp-card{background:var(--hp-area);}
        .hp-card{background:var(--hp-card); border:1px solid var(--hp-border); box-shadow:var(--hp-shadow);}
        .hp-switch{display:inline-flex; align-items:center; user-select:none;}
        .hp-settingsSwitch{display:inline-flex; align-items:center; height:22px;}
        .hp-switchBtn{position:relative;width:54px;height:22px;border-radius:999px;border:1px solid color-mix(in srgb, var(--hp-border) 70%, transparent);background:color-mix(in srgb, var(--hp-card) 85%, transparent);box-shadow:var(--hp-shadow);transition:transform 120ms ease, filter 180ms ease, background 220ms ease, border-color 220ms ease;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;}
        .hp-switchBtn:active{transform:scale(0.98);} .hp-switchBtn[aria-checked="true"]{background: color-mix(in srgb, #cfeee0 70%, var(--hp-card));border-color: color-mix(in srgb, #9fd6c8 65%, var(--hp-border));filter: drop-shadow(0 0 8px rgba(150, 210, 220, 0.45));}
        .hp-switchBtnGuide[aria-checked="true"]{background: color-mix(in srgb, #c9defe 72%, var(--hp-card));border-color: color-mix(in srgb, #89b5f6 62%, var(--hp-border));filter: drop-shadow(0 0 6px rgba(102, 156, 245, 0.38));}
        .hp-switchBtnErase[aria-checked="true"]{background: color-mix(in srgb, #f3c6ce 72%, var(--hp-card));border-color: color-mix(in srgb, #e09aaa 66%, var(--hp-border));filter: drop-shadow(0 0 8px rgba(232, 122, 145, 0.45));}
        .hp-switchBtn:focus-visible{outline:none; box-shadow:0 0 0 2px color-mix(in srgb, ${rgba(BLUE,.99)} 55%, transparent), var(--hp-shadow);} 
        .hp-switchLabel{position:relative;z-index:2;font-size:11px;letter-spacing:0.12em;text-transform:lowercase;font-weight:600;opacity:0.75;pointer-events:none;transition:color 220ms ease, text-shadow 220ms ease, opacity 220ms ease;}
        .hp-switchBtn[aria-checked="true"] .hp-switchLabel{opacity:1;color: var(--hp-ink);text-shadow: 0 0 4px rgba(255,255,255,0.55), 0 0 10px rgba(255,255,255,0.25);} 
        .hp-switchBtnNordText .hp-switchLabel{color:rgba(236,239,244,0.95);opacity:0.9;text-shadow:none;}
        .hp-switchBtnNordText[aria-checked="true"] .hp-switchLabel{color:#0f172a;opacity:1;text-shadow:none;}
        @keyframes ringRippleFade { 0% { opacity: 1; transform: translateZ(0) scale(1); } 100% { opacity: 0; transform: translateZ(0) scale(3.0); } }
        @keyframes glowAppear { from { opacity: 0; } to { opacity: var(--glowBase); } }
        @keyframes glowShimmer {0% { opacity: calc(var(--glowBase) * 0.55); transform: scale(3.50) translate(0px, 0px); filter: blur(2.3px); }22% { opacity: calc(var(--glowBase) * 1.25); transform: scale(3.50) translate(1px, -1px); filter: blur(2.9px); }50% { opacity: calc(var(--glowBase) * 0.50); transform: scale(3.30) translate(-1px, 1px); filter: blur(2.5px); }78% { opacity: calc(var(--glowBase) * 1.35); transform: scale(3.70) translate(2px, 0px); filter: blur(3.1px); }100% { opacity: calc(var(--glowBase) * 0.58); transform: scale(3.35) translate(-2px, -1px); filter: blur(2.6px); }}
      `}</style>

      <header className="w-full max-w-5xl mb-0 relative" style={{paddingLeft:0,height:26,minHeight:26,display:"flex",alignItems:"center",overflow:"hidden"}}>
        <h1 style={{margin:0,height:24,lineHeight:1,marginLeft:75,display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap"}}>
          <span
            onClick={toggleExtraMode}
            title="click to toggle bonus mode"
            style={{
              fontWeight: 600,
              letterSpacing: "0.18em",
              fontFamily: "Manrope, Inter, system-ui, sans-serif",
              cursor: "pointer",
              color: extraMode ? painterTitleColor : undefined,
              transition: "color 180ms ease"
            }}
          >
            HUSH·{extraMode ? "PAINTER" : "POINTER"}
          </span>
          <span aria-hidden="true" style={{opacity:0.45,padding:"0 6px",fontWeight:500,letterSpacing:"0.12em"}}>·</span>
          <span style={{fontWeight:400,letterSpacing:"0.32em",opacity:0.62,fontFamily:"Manrope, Inter, system-ui, sans-serif",textTransform:"lowercase"}}>{extraMode?"quiet strokes":"quiet precision"}</span>
        </h1>
        <div className="absolute select-none" style={{right:68,top:4,display:"flex",alignItems:"center",gap:54,marginRight:10}}>
          <div style={{display:"flex",gap:8}}>{(["default","moss","warm","dusk","dark"]as ColorScheme[]).map(s=>(
            <button key={s} onClick={()=>setScheme(s)} onPointerEnter={()=>setSchemeTip(s==="dark"?"nord":s)} onPointerLeave={()=>setSchemeTip("")} aria-label={`color scheme ${s}`} style={{width:12,height:12,borderRadius:"50%",background:s==="default"?SCHEMES.default.BLUE:s==="dark"?"#43566f":(s==="warm"?SCHEMES[s].RED:SCHEMES[s].BLUE),boxShadow:scheme===s?(isNord?"0 0 0 2px rgba(206,214,224,0.56), 0 0 0 4px rgba(129,161,193,0.24)":"0 0 0 2px rgba(90,80,60,0.35)"):(isNord?"0 0 0 1px rgba(206,214,224,0.20), 0 0.75px 2px rgba(15,23,42,0.38)":"0 0.5px 1.5px rgba(90,80,60,0.12)"),opacity:scheme===s?1:(isNord?0.74:0.65),transition:"opacity 160ms ease, box-shadow 160ms ease"}}/>
          ))}</div>
          <span style={{fontFamily:"Inter, system-ui, sans-serif",fontWeight:500,fontSize:11,letterSpacing:"0.06em",color:theme.inkSoft,opacity:.7}}>v1.8.3</span>
        </div>
      </header>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-4 gap-2 mb-0.5" style={{transform:"scale(0.86)",transformOrigin:"top center"}}>
        <div className={`hp-panel ${isNord?"hp-panelNord":""} rounded-2xl p-2.5 flex items-center justify-between min-h-[4.5rem]`}><div><div className="opacity-70">timeleft</div><div className="text-lg font-bold">{timeText}</div></div>
          <div className="flex items-center gap-2">
            {extraMode&&paintStrokes>0&&<button className="px-3 py-1.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50" style={{background:BLUE,boxShadow:theme.shadow}} onClick={savePainterScreenshot} disabled={savingPainter}>{savingPainter?"SAVING":"SAVE"}</button>}
            {!extraMode&&finished&&<button className="px-3 py-1.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50" style={{background:BLUE,boxShadow:theme.shadow}} onClick={saveFinishCardScreenshot} disabled={savingFinish}>{savingFinish?"SAVING":"SAVE"}</button>}
            <button className="px-3 py-1.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50" style={{background:extraMode?RED:BLUE,boxShadow:theme.shadow}} onClick={()=>{extraMode?clearPainter():startGame()}} disabled={running&&(!extraMode)}> {extraMode?"CLEAR":"START"} </button>
          </div>
        </div>

        <div className={`hp-panel ${isNord?"hp-panelNord":""} rounded-2xl p-2.5 flex items-center justify-between min-h-[4.5rem]`}><div><div className="opacity-70">score</div><div className="text-lg font-bold">{extraMode?paintScore:score}</div></div>
          <div className="text-center"><div className="opacity-70">{extraMode?"strokes":"hits"}</div><div className="text-lg font-bold">{extraMode?paintStrokes:hitCount}</div></div>
          <div className="text-right"><div className="opacity-70">{extraMode?"ink":"miss"}</div><div className="text-lg font-bold">{extraMode?Math.floor(paintAreaRef.current):miss}</div></div>
        </div>

        <div className={`hp-panel ${isNord?"hp-panelNord":""} rounded-2xl p-2.5 flex items-center justify-center min-h-[4.5rem]`}><div className="flex items-center">
          <div className="px-6 text-center"><div className="opacity-70">reaction</div><div className="text-lg font-bold">{medianReaction.toFixed(2)}<span className="opacity-70 ml-0.5">s</span></div></div>
          <div className="h-8 border-l" style={{borderColor:theme.border}}/>
          <div className="px-6 text-center"><div className="opacity-70">best</div><div className="text-lg font-bold" style={{color:theme.inkSoft}}>{minReaction.toFixed(2)}<span className="opacity-70 ml-0.5">s</span></div></div>
        </div></div>

        <div className={`hp-panel ${isNord?"hp-panelNord":""} rounded-2xl p-2.5 min-h-[4.5rem]`} style={{accentColor:BLUE}}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold">⚙️ settings for Trackball</div>
            {extraMode?(
              <button className="px-2 py-1 rounded hp-input" onClick={toggleEraserMode} title={eraserMode?"eraser on":"eraser off"} aria-label={eraserMode?"eraser on":"eraser off"} style={{opacity:1,minWidth:44,display:"inline-flex",alignItems:"center",justifyContent:"center",background:eraserMode?"color-mix(in srgb, #f3c6ce 72%, var(--hp-card))":"var(--hp-card)",borderColor:eraserMode?"color-mix(in srgb, #e09aaa 66%, var(--hp-border))":"var(--hp-border)",filter:eraserMode?"drop-shadow(0 0 8px rgba(232, 122, 145, 0.45))":"none",transition:"filter 180ms ease, background 220ms ease, border-color 220ms ease"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15.5 12.6 7a2 2 0 0 1 2.8 0l4.6 4.6a2 2 0 0 1 0 2.8l-5.2 5.1a2 2 0 0 1-1.4.6H8.8a2 2 0 0 1-1.4-.6L4 16.9a1 1 0 0 1 0-1.4Z"/>
                  <path d="M11.2 19.9 18 13.1"/>
                </svg>
              </button>
            ):(
              <button className="px-2 py-1 rounded hp-input" onClick={()=>setBeepMode(nextBeep)} title={beepMode==="all"?"beep":beepMode==="miss"?"miss":"off"} aria-label={beepMode==="all"?"beep":beepMode==="miss"?"miss":"off"} style={{opacity:beepMode==="off"?.5:1,minWidth:44,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                {beepMode==="off"?(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M23 9 17 15"/><path d="M17 9 23 15"/></svg>):beepMode==="miss"?(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a4 4 0 0 1 0 7"/></svg>):(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a4 4 0 0 1 0 7"/><path d="M19 6a8 8 0 0 1 0 12"/></svg>)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <input type="range" min={4} max={160} step={1} value={targetSize} onChange={e=>setTargetSize(parseInt(e.target.value))} className="flex-1 min-w-0"/>
            <input type="number" min={2} max={320} step={1} value={targetSize} onChange={e=>setTargetSize(Number.isFinite(+e.target.value)?Math.max(2,Math.min(320,+e.target.value)):targetSize)} className="w-16 px-1 py-0.5 rounded hp-input"/>
            <span className="text-xs">px</span>
            <span className="ml-auto hp-switch hp-settingsSwitch"><button type="button" className={`hp-switchBtn ${isNord?"hp-switchBtnNordText":""}`} role="switch" aria-label="aura" aria-checked={glowMode} onClick={()=>setGlowMode(v=>!v)}><span className="hp-switchLabel">aura</span></button></span>
          </div>
          <div className="flex items-center text-xs mb-1">
            <div className="flex items-center gap-2">
              <label><input type="radio" name="mode" checked={mode==="left"} onChange={()=>setMode("left")}/> left</label>
              <label><input type="radio" name="mode" checked={mode==="right"} onChange={()=>setMode("right")}/> right</label>
              <label><input type="radio" name="mode" checked={mode==="random"} onChange={()=>setMode("random")}/> random</label>
            </div>
            <span className="ml-auto hp-switch hp-settingsSwitch">
              <button type="button" className={`hp-switchBtn hp-switchBtnGuide ${isNord?"hp-switchBtnNordText":""}`} role="switch" aria-label="guide mode" aria-checked={pointerGuide} onClick={()=>setPointerGuide(v=>!v)}><span className="hp-switchLabel">guide</span></button>
            </span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl hp-msg rounded-xl px-2 py-1 min-h-[1.5rem] mb-0.5 flex items-center justify-between gap-2" style={{transform:"scale(0.86)",transformOrigin:"top center"}}>
        <span className="truncate">{message||(extraMode ? `double click: clear / drag: ${eraserMode?"eraser":"brush"} / top-right eraser icon or Shift to toggle` : (schemeTip?`scheme : ${schemeTip}`:""))}</span>
        <button
          ref={screenshotToggleRef}
          className="px-2 py-0.5 rounded hp-input text-[11px] shrink-0 disabled:opacity-60"
          onClick={()=>setShowScreenshotList(v=>!v)}
          disabled={screenshotLoading&&!showScreenshotList}
          aria-label={showScreenshotList?"hide saved screenshots":"show saved screenshots"}
        >
          {showScreenshotList?"hide shots":"show shots"}
        </button>
      </div>

      <div ref={areaRef} className="relative w-full flex-1 hp-area rounded-2xl overflow-hidden select-none" style={{width:"100vw",cursor:"crosshair",touchAction:"none"}} onDoubleClick={onAreaDoubleClick} onMouseDown={onAreaMouseDown} onContextMenu={e=>e.preventDefault()}>
        {showScreenshotList&&(
        <div
          ref={screenshotPanelRef}
          className={`absolute top-2 left-1/2 -translate-x-1/2 w-full max-w-5xl hp-panel ${isNord?"hp-panelNord":""} rounded-2xl px-3 py-2`}
          style={{transform:"scale(0.86)",transformOrigin:"top center",zIndex:28}}
          onMouseDown={(e)=>e.stopPropagation()}
          onDoubleClick={(e)=>e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">
              {extraMode?"saved Painter Shots":"saved Finish Card"}
            </div>
            <button
              className="px-2 py-1 rounded hp-input text-[11px] disabled:opacity-60"
              onClick={()=>loadScreenshotHistory(userUid)}
              disabled={!userUid||screenshotLoading}
            >
              {screenshotLoading?"loading...":"refresh"}
            </button>
          </div>
          {screenshotError&&<div className="text-[11px] mb-2" style={{color:RED}}>load failed: {screenshotError}</div>}
          {!screenshotError&&visibleScreenshotList.length===0&&!screenshotLoading&&<div className="text-[11px] opacity-70">no screenshot yet</div>}
          {visibleScreenshotList.length>0&&(
            <div className="flex gap-2 overflow-x-auto pb-1">
              {visibleScreenshotList.map(item=>(
                <div key={item.id} className="hp-card rounded-xl p-1.5 min-w-[140px] w-[140px] shrink-0 relative group">
                  <div className="relative">
                    <button className="block w-full" onClick={()=>setSelectedScreenshot(item)} aria-label={`open ${item.kind} screenshot`} style={{cursor:"zoom-in"}}>
                      <img src={item.image} alt={`${item.kind} screenshot`} className="w-full h-[82px] object-contain rounded-lg border" style={{borderColor:theme.border,background:theme.area}} />
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold">{formatShotKind(item.kind)}</div>
                  <div className="text-[10px] opacity-70">{formatDateTime(item.timestamp)}</div>
                  <button
                    className="absolute right-0 bottom-0 translate-x-[24%] translate-y-[24%] w-5 h-5 rounded-full text-[11px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    style={{background:"rgba(15,23,42,0.55)",color:"#f8fafc",border:"1px solid rgba(241,245,249,0.42)",pointerEvents:deletingScreenshotId===item.id?"none":"auto"}}
                    onMouseDown={(e)=>e.stopPropagation()}
                    onClick={(e)=>{e.stopPropagation();void onDeleteScreenshot(item)}}
                    disabled={deletingScreenshotId===item.id}
                    aria-label="delete screenshot"
                    title="delete screenshot"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {pointerGuide&&(
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex:1,
              backgroundImage:[
                `linear-gradient(to right, ${guideGridMajor} 1px, transparent 1px)`,
                `linear-gradient(to bottom, ${guideGridMajor} 1px, transparent 1px)`,
                `linear-gradient(to right, ${guideGridMinor} 1px, transparent 1px)`,
                `linear-gradient(to bottom, ${guideGridMinor} 1px, transparent 1px)`
              ].join(","),
              backgroundSize:"40px 40px, 40px 40px, 20px 20px, 20px 20px",
              backgroundPosition:"0 0, 0 0, 0 0, 0 0"
            }}
          />
        )}
        {extraMode&&(
          <canvas ref={painterCanvasRef} className="absolute inset-0" style={{zIndex:2,cursor:"crosshair"}} onPointerDown={onPainterPointerDown} onPointerMove={onPainterPointerMove} onPointerUp={endPainterStroke} onPointerCancel={endPainterStroke} onPointerLeave={endPainterStroke} onContextMenu={e=>e.preventDefault()} />
        )}
        {!extraMode&&!running&&!finished&&<div className="absolute inset-0 grid place-items-center font-bold text-[14px]" style={{color:BLUE}}>double click to start</div>}

        {finished && !extraMode && (
          <div className="absolute inset-0 grid place-items-center" style={{zIndex:12,transform:"translateY(-18px)",color:theme.inkSoft}}>
            <div ref={finishCardRef} className="text-center w-[min(560px,94vw)] rounded-3xl px-5 py-4 hp-finish" style={{transform:"scale(0.87)",transformOrigin:"center"}}>
              <div className="mb-2">
                <div className="h-2" />
                <div className="text-[14px] font-semibold tracking-[0.18em] opacity-70 mb-1">HUSH·POINTER</div>
                <div className="text-2xl font-bold tracking-tight mb-0" style={{color:finishTitleColor}}>finish!</div>

                {perfectBonus>0&&(
                  <div className="-mt-1 flex items-center justify-center"><div className="relative inline-flex items-center gap-2 px-3 py-1">
                    <span className="text-[14px] font-bold tracking-wide" style={{color:RED}}>perfect run!</span>
                    <span className="text-[14px] font-semibold" style={{color:RED}}>{showPerfectBonus&&<>+{perfectBonus}</>}</span>
                  </div></div>
                )}

                {hist.blue.length>0&&histMax>0&&(
                  <div className="mt-3">
                    <div className="relative" style={{height:72}}>
                      <div className="absolute left-0 right-0 bottom-0 h-px" style={{background:"rgba(100,116,139,0.28)"}} />
                      <div className="absolute inset-0 flex items-end gap-[2px] justify-center pb-[1px]">
                        {Array.from({length:hist.bins}).map((_,i)=>{const b=hist.blue[i]??0,r=hist.red[i]??0,total=b+r,totalH=Math.round((total/histMax)*72),bH=total>0?Math.max(1,Math.round((b/total)*totalH)):0,rH=Math.max(0,totalH-bH),from=hist.min+(i/hist.bins)*(hist.max-hist.min),to=hist.min+((i+1)/hist.bins)*(hist.max-hist.min);
                          return(
                            <div key={i} className="rounded-sm overflow-hidden flex flex-col justify-end" style={{width:`calc((100% - ${(hist.bins-1)*2}px) / ${hist.bins})`,minWidth:3,height:`${Math.max(1,totalH)}px`,boxShadow:theme.shadow}} title={`${from.toFixed(2)}–${to.toFixed(2)}s : blue ${b}, red ${r} (total ${total})`}>
                              {rH>0&&<div style={{height:`${rH}px`,background:HIST_RED,boxShadow:theme.shadow}} />}
                              {bH>0&&<div style={{height:`${bH}px`,background:HIST_BLUE,boxShadow:theme.shadow}} />}
                            </div>
                          )})}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[13px] opacity-70"><span>{hist.min.toFixed(2)}s</span><span>{hist.max.toFixed(2)}s</span></div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl hp-card py-2"><div className="opacity-70">hits</div><div className="text-lg font-bold" style={{color:BLUE}}>{hitCount}</div></div>
                  <div className="rounded-2xl hp-card py-2"><div className="opacity-70">miss</div><div className="text-lg font-bold" style={{color:BLUE}}>{miss}</div></div>
                  <div className="rounded-2xl hp-card py-2"><div className="opacity-70">score</div><div className="text-lg font-bold" style={{color:RED}}>{score}</div></div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-4 text-[0.95rem]">
                  <div className="rounded-xl hp-card px-3 py-2">median: <span className="font-semibold">{medianReaction.toFixed(2)}s</span></div>
                  <div className="rounded-xl hp-card px-3 py-2">best: <span className="font-semibold">{minReaction.toFixed(2)}s</span></div>
                </div>
              </div>
              <div className="mt-3 text-[0.8rem] opacity-70">double click to restart</div>
            </div>
          </div>
        )}

        {running&&target&&(
          <div className="absolute" style={{left:target.x,top:target.y,width:targetSize,height:targetSize}}>
            {hoveringTarget&&!glowMode&&(
              <div key={ringFlashId} className="pointer-events-none absolute" style={{left:-2,top:-2,width:targetSize+4,height:targetSize+4,zIndex:18,transformOrigin:"50% 50%",animation:"ringRippleFade 320ms ease-out forwards",willChange:"transform, opacity",backfaceVisibility:"hidden",contain:"paint"}}>
                <div className="absolute inset-0" style={{borderRadius:"50%",boxSizing:"border-box",border:`0.6px solid ${ringStroke(target.color)}`,transform:"translateZ(0)",backfaceVisibility:"hidden"}} />
              </div>
            )}
            {glowMode&&(
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{zIndex:5,background:glowBg(target.color),opacity:1,transformOrigin:"50% 50%",...glowVars,animation:"glowAppear 360ms ease-out forwards, glowShimmer 9200ms ease-in-out 360ms infinite"}} />
            )}
            <div className={`absolute inset-0 rounded-full transition-transform ${comboFlash?"scale-125":""}`} onMouseDown={onTargetMouseDown} style={{willChange:"transform, opacity, filter",zIndex:10,cursor:"crosshair",backgroundColor:target.color==="blue"?BLUE:RED,opacity:glowMode?(hoveringTarget?1:.04):1,filter:glowMode?(hoveringTarget?"blur(0.9px)":"blur(0.45px)"):"none",transition:"opacity 180ms ease, filter 500ms cubic-bezier(0.22, 1, 0.36, 1)"}} />
            {glowMode&&(
              <div className="absolute rounded-full pointer-events-none" style={{zIndex:15,width:hoveringTarget?targetSize:Math.max(2,Math.round(targetSize*.22)),height:hoveringTarget?targetSize:Math.max(2,Math.round(targetSize*.22)),left:"50%",top:"50%",background:coreBg(target.color),opacity:hoveringTarget?.35:1,transform:"translate(-50%, -50%)",transition:"width 9000ms cubic-bezier(0.22, 1, 0.36, 1), height 9000ms cubic-bezier(0.22, 1, 0.36, 1), opacity 3200ms ease-out"}} />
            )}
          </div>
        )}
      </div>

      {selectedScreenshot&&(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{zIndex:60,background:"rgba(9,12,18,0.62)"}}
          onMouseDown={()=>setSelectedScreenshot(null)}
          onMouseMove={(e)=>{
            const imageRect=modalImageRef.current?.getBoundingClientRect();
            if(!imageRect){hideModalNav();return;}
            const edge=Math.max(48,Math.min(96,imageRect.width*0.18));
            const x=e.clientX,y=e.clientY;
            const hasPrev=selectedScreenshotIndex>0;
            const hasNext=selectedScreenshotIndex>=0&&selectedScreenshotIndex<visibleScreenshotList.length-1;
            let hit:""|"left"|"right"="";
            const inY=y>=imageRect.top&&y<=imageRect.bottom;
            if(inY&&x>=imageRect.left&&x<=imageRect.left+edge&&hasPrev)hit="left";
            else if(inY&&x<=imageRect.right&&x>=imageRect.right-edge&&hasNext)hit="right";
            if(!hit){hideModalNav();return;}
            setModalNavVisible(true);
            setModalNavEdge(hit);
            scheduleModalNavHide();
          }}
          onMouseLeave={hideModalNav}
        >
          <div
            className="hp-panel rounded-2xl pt-1 px-1 pb-2"
            style={{maxWidth:"min(96vw,1200px)",maxHeight:"92vh"}}
            onMouseDown={(e)=>e.stopPropagation()}
          >
            <div className="relative inline-block">
              <img
                ref={modalImageRef}
                src={selectedScreenshot.image}
                alt={`${selectedScreenshot.kind} full screenshot`}
                className="block rounded-xl"
                style={{maxWidth:"min(92vw,1160px)",maxHeight:"86vh",objectFit:"contain",background:theme.area}}
              />
              {modalNavVisible&&modalNavEdge==="left"&&selectedScreenshotIndex>0&&(
                <button
                  className="absolute left-0 top-1/2 -translate-x-[33%] -translate-y-1/2 rounded-full w-11 h-11 text-2xl"
                  style={{zIndex:61,background:"rgba(15,23,42,0.46)",color:"#f8fafc",border:"1px solid rgba(241,245,249,0.36)"}}
                  onMouseDown={(e)=>e.stopPropagation()}
                  onClick={()=>openModalScreenshotAt(selectedScreenshotIndex-1)}
                  aria-label="previous screenshot"
                >
                  ‹
                </button>
              )}
              {modalNavVisible&&modalNavEdge==="right"&&selectedScreenshotIndex>=0&&selectedScreenshotIndex<visibleScreenshotList.length-1&&(
                <button
                  className="absolute right-0 top-1/2 translate-x-[33%] -translate-y-1/2 rounded-full w-11 h-11 text-2xl"
                  style={{zIndex:61,background:"rgba(15,23,42,0.46)",color:"#f8fafc",border:"1px solid rgba(241,245,249,0.36)"}}
                  onMouseDown={(e)=>e.stopPropagation()}
                  onClick={()=>openModalScreenshotAt(selectedScreenshotIndex+1)}
                  aria-label="next screenshot"
                >
                  ›
                </button>
              )}
            </div>
            <div className="mt-2 px-3 flex items-center justify-between text-[11px]" style={{color:theme.inkSoft}}>
              <span>{formatShotKind(selectedScreenshot.kind)}</span>
              <span>{formatDateTime(selectedScreenshot.timestamp)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
