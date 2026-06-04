'use client';
import { useEffect, useRef, useState } from 'react';

type ModeId = string;
type ModelId = string;

interface Mode {
  id: ModeId; name: string; desc: string; prompt: string;
  styles: string[]; fixedModel: string | null;
}
interface FontOpt { id: string; label: string }
interface Asset { id: string; url: string; original_name: string; size: number }
interface Task {
  id: string; zone_id: string; asset_id: string;
  model: ModelId; ratio: string; quality: string; mode_id: ModeId;
  extra_prompt: string | null;
  styles: string[]; font: any;
  letter: string | null; seed: number | null;
  status: 'pending'|'running'|'succeeded'|'failed';
  error_message: string | null; output_url: string | null;
  winner: boolean; created_at: number; updated_at: number;
}

interface Zone {
  id: string;            // 前端生成
  asset: Asset;
  ratio: string;
  quality: string;
  count: number;
  extraPrompt: string;
  styles: string[];
  font: { family?: string; weight?: string; case?: string; custom?: string };
  variants: Task[];
}

const RATIOS = ['1:1','3:4','4:3','2:3','3:2','4:5','5:4','9:16','16:9'];
const QUALITIES = ['1K','2K','4K'];

function uid(){ return Math.random().toString(36).slice(2,10); }

export default function Home(){
  const [modes, setModes] = useState<Mode[]>([]);
  const [fonts, setFonts] = useState<{families: FontOpt[]; weights: FontOpt[]; cases: FontOpt[]}>({families:[],weights:[],cases:[]});
  const [globalMode, setGlobalMode] = useState<ModeId>('bg-similar');
  const [model, setModel] = useState<ModelId>('gemini-3-pro-image-preview');
  const [market, setMarket] = useState<string>('EN');
  const [zones, setZones] = useState<Zone[]>([]);
  const [toast, setToast] = useState<string>('');
  const [promptModal, setPromptModal] = useState<Mode | null>(null);
  const [cmZoneId, setCmZoneId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载方向定义 + 字体定义
  useEffect(() => {
    fetch('/api/modes').then(r=>r.json()).then(j=>{
      setModes(j.modes || []);
      setFonts(j.fonts || {families:[],weights:[],cases:[]});
    });
  }, []);

  // 轮询所有 zone 的任务状态
  useEffect(() => {
    if (zones.length === 0) return;
    const t = setInterval(async () => {
      // 检查每个 zone 是否有 pending/running
      for (const zone of zones){
        const hasInflight = zone.variants.some(v => v.status === 'pending' || v.status === 'running');
        if (!hasInflight) continue;
        try {
          const res = await fetch(`/api/tasks?zone_id=${zone.id}`);
          const j = await res.json();
          const fresh: Task[] = j.tasks || [];
          setZones(prev => prev.map(z => z.id === zone.id
            ? { ...z, variants: mergeVariants(z.variants, fresh) }
            : z
          ));
        } catch (e) { /* 忽略轮询错误 */ }
      }
    }, 2500);
    return () => clearInterval(t);
  }, [zones]);

  function showToast(msg: string){
    setToast(msg);
    setTimeout(()=>setToast(''), 1600);
  }

  // 上传参考图
  async function handleUpload(files: FileList | File[]){
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '上传失败');
      const newZones: Zone[] = (j.assets || []).map((a: Asset) => ({
        id: uid(),
        asset: a,
        ratio: '4:5',
        quality: '1K',
        count: 3,
        extraPrompt: '',
        styles: [],
        font: { family:'', weight:'', case:'as-is', custom:'' },
        variants: [],
      }));
      setZones(prev => [...prev, ...newZones]);
      showToast(`已上传 ${newZones.length} 张`);
    } catch(e: any){
      showToast(e.message);
    }
  }

  // 创建变体
  async function runZone(zoneId: string){
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    showToast(`开始生成 ${zone.count} 张`);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: zone.id,
          asset_id: zone.asset.id,
          model,
          ratio: zone.ratio,
          quality: zone.quality,
          mode_id: globalMode,
          extra_prompt: zone.extraPrompt,
          styles: zone.styles,
          font: zone.font,
          market,
          count: zone.count,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '生成失败');
      // 立即拉一次最新任务状态
      const tres = await fetch(`/api/tasks?zone_id=${zone.id}`);
      const tj = await tres.json();
      setZones(prev => prev.map(z => z.id === zone.id
        ? { ...z, variants: tj.tasks || [] }
        : z
      ));
    } catch(e: any){
      showToast(e.message);
    }
  }

  function removeZone(zoneId: string){
    setZones(prev => prev.filter(z => z.id !== zoneId));
  }

  function updateZone(zoneId: string, patch: Partial<Zone>){
    setZones(prev => prev.map(z => z.id === zoneId ? { ...z, ...patch } : z));
  }

  async function pickVariant(taskId: string){
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pick' }),
    });
    // 立即更新本地状态（避免等轮询）
    setZones(prev => prev.map(z => ({
      ...z,
      variants: z.variants.map(v => v.id === taskId ? { ...v, winner: !v.winner } : v),
    })));
  }

  async function regenVariant(taskId: string){
    showToast('重新生成中…');
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regen', market }),
    });
    // 标记为 running 让轮询接管
    setZones(prev => prev.map(z => ({
      ...z,
      variants: z.variants.map(v => v.id === taskId ? { ...v, status: 'running', output_url: null } : v),
    })));
  }

  async function deleteVariant(taskId: string){
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    setZones(prev => prev.map(z => ({
      ...z,
      variants: z.variants.filter(v => v.id !== taskId),
    })));
  }

  // 拖入 / 粘贴
  useEffect(()=>{
    function onPaste(e: ClipboardEvent){
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const items = Array.from(e.clipboardData?.items || []).filter(i => i.type.startsWith('image/'));
      const files = items.map(i => i.getAsFile()).filter(Boolean) as File[];
      if (files.length) handleUpload(files);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // 全局统计
  const allVariants = zones.flatMap(z => z.variants);
  const sRun = allVariants.filter(v => v.status==='pending' || v.status==='running').length;
  const sOk = allVariants.filter(v => v.status==='succeeded').length;
  const sErr = allVariants.filter(v => v.status==='failed').length;
  const sWin = allVariants.filter(v => v.winner).length;
  const downloadCount = sWin || sOk;

  function downloadAll(){
    let list = allVariants.filter(v => v.winner);
    if (!list.length) list = allVariants.filter(v => v.status==='succeeded');
    if (!list.length) return showToast('暂无可下载');
    list.forEach((v,i)=>{
      if (!v.output_url) return;
      setTimeout(()=>{
        const a = document.createElement('a');
        a.href = v.output_url!;
        a.download = `${v.letter || 'X'}_${v.mode_id}.png`;
        a.target = '_blank';
        document.body.appendChild(a); a.click(); a.remove();
      }, i*120);
    });
    showToast(`开始下载 ${list.length} 张`);
  }

  async function retryFailed(){
    const fails = allVariants.filter(v => v.status==='failed');
    if (!fails.length) return showToast('没有失败的变体');
    fails.forEach(v => regenVariant(v.id));
  }

  const currentMode = modes.find(m => m.id === globalMode);
  const customizingZone = zones.find(z => z.id === cmZoneId);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="mark">B</div>
          <div className="nm">BIBLE GROUP</div>
        </div>
        <div className="model-bar">
          <span className="lab">MODEL</span>
          <select value={model} onChange={e=>setModel(e.target.value)}>
            <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>
            <option value="openai/gpt-image-2">openai/gpt-image-2</option>
          </select>
        </div>
        <div className="model-bar">
          <span className="lab">MARKET</span>
          <select value={market} onChange={e=>setMarket(e.target.value)}>
            <option value="EN">EN · English</option>
            <option value="ES">ES · Español</option>
            <option value="PT">PT · Português</option>
            <option value="FR">FR · Français</option>
          </select>
        </div>
      </header>

      <main>
        <section className="global-bar">
          <div className="gb-block">
            <span className="gb-lab">默认方向 · 单选 <span className="hint">全部参考图共用 · 点定制看 prompt</span></span>
            <div className="gb-mode-chips">
              {modes.map(m => (
                <button
                  key={m.id}
                  className={'gb-chip' + (globalMode===m.id?' on':'')}
                  onClick={()=>setGlobalMode(m.id)}
                >
                  {m.name}
                  <span className="info" onClick={e=>{e.stopPropagation(); setPromptModal(m);}}>定制</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="stats">
          <span className="pill">参考图: <b>{zones.length}</b></span>
          <span className="pill">变体: <b>{allVariants.length}</b></span>
          <span className="pill run">生成中: <b>{sRun}</b></span>
          <span className="pill ok">已完成: <b>{sOk}</b></span>
          <span className="pill err">失败: <b>{sErr}</b></span>
          <span className="pill win">中选: <b>{sWin}</b></span>
          <div className="right">
            <button onClick={retryFailed}>↻ 重试失败</button>
            <button className="dl" onClick={downloadAll}>⬇ 下载中选({downloadCount})</button>
          </div>
        </section>

        {zones.length === 0 ? (
          <section className="empty-hint">
            <div className="big">⬆</div>
            <div className="ttl">点右上角 <b>+ 上传参考图</b> 开始</div>
            <div className="des">支持 JPG · PNG · WEBP · 拖入或粘贴(⌘V)也行 · 每张参考图独立配置、独立并发生成</div>
          </section>
        ) : (
          zones.map((zone, idx) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              idx={idx}
              currentModeName={currentMode?.name || ''}
              fonts={fonts}
              onRemove={()=>removeZone(zone.id)}
              onUpdate={(patch)=>updateZone(zone.id, patch)}
              onRun={()=>runZone(zone.id)}
              onPick={pickVariant}
              onRegen={regenVariant}
              onDelete={deleteVariant}
              onCustomize={()=>setCmZoneId(zone.id)}
            />
          ))
        )}
      </main>

      <button
        className="upload-fab"
        onClick={()=>fileInputRef.current?.click()}
        onDragOver={e=>{e.preventDefault();(e.currentTarget as HTMLElement).classList.add('drag');}}
        onDragLeave={e=>(e.currentTarget as HTMLElement).classList.remove('drag')}
        onDrop={e=>{
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove('drag');
          if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
        }}
      >
        <span className="ico">+</span>
        <span className="lbl">上传参考图</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{display:'none'}}
        onChange={e=>{
          if (e.target.files?.length) handleUpload(e.target.files);
          e.target.value = '';
        }}
      />

      <div className={'toast' + (toast?' show':'')}>{toast}</div>

      {promptModal && (
        <div className="mask show" onClick={e=>{if(e.target===e.currentTarget)setPromptModal(null);}}>
          <div className="modal">
            <button className="close" onClick={()=>setPromptModal(null)}>×</button>
            <h3>{promptModal.name}</h3>
            <div className="sub">{promptModal.desc}</div>
            <div className="prompt-view">
              <span className="lbl">内置 PROMPT</span>
              <div>{promptModal.prompt}</div>
            </div>
          </div>
        </div>
      )}

      {customizingZone && (
        <CustomizeModal
          zone={customizingZone}
          mode={currentMode}
          fonts={fonts}
          onSave={(styles, font) => {
            updateZone(customizingZone.id, { styles, font });
            setCmZoneId(null);
            showToast('已保存');
          }}
          onClose={()=>setCmZoneId(null)}
        />
      )}
    </>
  );
}

// 合并任务列表 - 用 fresh 替换 prev 中相同 id 的项,保持顺序,新增的接到末尾
function mergeVariants(prev: Task[], fresh: Task[]): Task[] {
  const freshMap = new Map(fresh.map(t => [t.id, t]));
  const merged: Task[] = [];
  for (const v of prev){
    merged.push(freshMap.get(v.id) || v);
    freshMap.delete(v.id);
  }
  freshMap.forEach(t => merged.push(t));
  // 按 created_at 排序
  return merged.sort((a,b) => a.created_at - b.created_at);
}

/* === 任务分区卡片 === */
function ZoneCard(props: {
  zone: Zone; idx: number; currentModeName: string;
  fonts: any;
  onRemove: ()=>void; onUpdate: (p: Partial<Zone>)=>void;
  onRun: ()=>void; onPick: (id:string)=>void;
  onRegen: (id:string)=>void; onDelete: (id:string)=>void;
  onCustomize: ()=>void;
}){
  const { zone, idx, currentModeName } = props;
  const okCnt = zone.variants.filter(v=>v.status==='succeeded').length;
  const runCnt = zone.variants.filter(v=>v.status==='running'||v.status==='pending').length;
  const hasFontCustom = zone.font && (zone.font.family || zone.font.custom);

  return (
    <div className="task-zone">
      <div className="tz-ref">
        <div className="tz-flag">● REFERENCE {idx+1}</div>
        <div className="tz-canvas">
          <img src={zone.asset.url} alt=""/>
          <button className="tz-x" onClick={()=>{
            if (confirm(`移除参考图 ${idx+1} 和它的 ${zone.variants.length} 个变体？`)) props.onRemove();
          }}>×</button>
        </div>
        <div className="tz-name" title={zone.asset.original_name}>{zone.asset.original_name}</div>

        <div className="tz-sz-row">
          <span className="tz-sz-lab">输出比例</span>
          <div className="tz-chips">
            {RATIOS.map(r => (
              <button key={r}
                className={'tz-chip'+(zone.ratio===r?' on':'')}
                onClick={()=>props.onUpdate({ratio:r})}
              >{r}</button>
            ))}
          </div>
        </div>

        <div className="tz-sz-row">
          <span className="tz-sz-lab">图片大小</span>
          <div className="tz-chips">
            {QUALITIES.map(q => (
              <button key={q}
                className={'tz-chip'+(zone.quality===q?' on':'')}
                onClick={()=>props.onUpdate({quality:q})}
              >{q}</button>
            ))}
          </div>
        </div>

        <div className="tz-sz-row">
          <span className="tz-sz-lab">补充 Prompt · 这张参考图所有变体共用</span>
          <textarea
            className="tz-extra-ta"
            placeholder="可选..."
            value={zone.extraPrompt}
            onChange={e=>props.onUpdate({extraPrompt:e.target.value})}
          />
        </div>

        <div className="tz-sz-row">
          <span className="tz-sz-lab">生成几条 · 追加生成不覆盖旧的</span>
          <div className="tz-stepper">
            <button onClick={()=>props.onUpdate({count: Math.max(1, zone.count-1)})} disabled={zone.count<=1}>−</button>
            <span className="tz-cnt-v">{zone.count}</span>
            <button onClick={()=>props.onUpdate({count: Math.min(10, zone.count+1)})} disabled={zone.count>=10}>+</button>
          </div>
        </div>

        {(zone.styles.length || hasFontCustom) ? (
          <div className="tz-sz-row">
            <span className="tz-sz-lab">风格 / 字体定制</span>
            <div className="tz-mini-tags">
              {zone.styles.map(s => <span key={s} className="tz-mini-tag style">{s}</span>)}
              {hasFontCustom && <span className="tz-mini-tag font">Aa {zone.font.custom || zone.font.family}</span>}
            </div>
          </div>
        ) : null}

        <button className="tz-customize" onClick={props.onCustomize}>⚙ 风格 / 字体定制</button>
        <button className="tz-run" onClick={props.onRun}>
          生成 {zone.count} 张 · {currentModeName}
        </button>
      </div>

      <div className="tz-variants">
        <div className="tz-head">
          <span className="label">变体</span>
          <span className="count">{okCnt} 完成 · {runCnt} 生成中 · {zone.variants.length} 总</span>
        </div>
        {zone.variants.length === 0 ? (
          <div className="tz-empty">设置好比例 / 大小 / Prompt 后,点左侧"生成"按钮<br/>变体会出现在这里,生成期间你可以上传其他参考图同时开跑</div>
        ) : (
          <div className="tz-grid">
            {zone.variants.map(v => (
              <VariantCard key={v.id} v={v}
                onPick={()=>props.onPick(v.id)}
                onRegen={()=>props.onRegen(v.id)}
                onDelete={()=>props.onDelete(v.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VariantCard({ v, onPick, onRegen, onDelete }: {
  v: Task; onPick: ()=>void; onRegen: ()=>void; onDelete: ()=>void;
}){
  const status = v.status==='succeeded' ? <span className="vc-status ok">完成</span>
    : v.status==='running' ? <span className="vc-status run">生成中</span>
    : v.status==='failed' ? <span className="vc-status err">失败</span>
    : <span className="vc-status pen">排队</span>;
  return (
    <div className={'vc'+(v.winner?' winner':'')}>
      <div className="vc-head">
        <span className="vc-letter"><span className="l">{v.letter || '?'}</span>{v.mode_id}</span>
        {status}
      </div>
      <div className="vc-canvas">
        {v.winner && <div className="win-flag">★ WIN</div>}
        {v.output_url
          ? <img src={v.output_url} alt=""/>
          : v.status==='running' || v.status==='pending'
          ? <div className="skeleton"></div>
          : <div className="placeholder">{v.status==='failed' ? `失败:${(v.error_message||'').slice(0,40)}` : '等待'}</div>
        }
      </div>
      <div className="vc-meta">
        <span className="tag">{v.ratio}</span>
        <span className="tag">{v.quality}</span>
      </div>
      <div className="vc-actions">
        <button onClick={()=>{ if(v.output_url) window.open(v.output_url,'_blank'); }}>查看</button>
        <button onClick={onRegen}>重生</button>
        <button onClick={onDelete}>删除</button>
      </div>
      <button className={'vc-pick'+(v.winner?' on':'')} onClick={onPick}>
        {v.winner ? '✓ 已中选' : '☆ 标为 Winner'}
      </button>
    </div>
  );
}

/* === 风格 / 字体定制浮层 === */
function CustomizeModal({ zone, mode, fonts, onSave, onClose }: {
  zone: Zone; mode: Mode | undefined;
  fonts: { families: FontOpt[]; weights: FontOpt[]; cases: FontOpt[] };
  onSave: (styles: string[], font: any) => void; onClose: ()=>void;
}){
  const [styles, setStyles] = useState<string[]>(zone.styles);
  const [font, setFont] = useState<any>(zone.font || {family:'',weight:'',case:'as-is',custom:''});

  function toggleStyle(s: string){
    setStyles(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s]);
  }

  return (
    <div className="mask show" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal">
        <button className="close" onClick={onClose}>×</button>
        <h3>风格 / 字体定制</h3>
        <div className="sub">参考图: {zone.asset.original_name} · 当前方向: {mode?.name || ''}</div>

        {mode && mode.styles.length > 0 && (
          <div style={{marginTop:14}}>
            <div className="cm-lab">风格预设 · 多选 · <span style={{color:'var(--brand)'}}>仅本张参考图</span></div>
            <div className="cm-chips">
              {mode.styles.map(s => (
                <button key={s} className={'cm-chip'+(styles.includes(s)?' on':'')} onClick={()=>toggleStyle(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{marginTop:18}}>
          <div className="cm-lab">字体定制 · 仅本张参考图</div>
          <div className="cm-grid">
            <div>
              <label>字体类别</label>
              <select value={font.family||''} onChange={e=>setFont({...font, family:e.target.value})}>
                <option value="">— 不指定 —</option>
                {fonts.families.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label>字重</label>
              <select value={font.weight||''} onChange={e=>setFont({...font, weight:e.target.value})}>
                <option value="">— 不指定 —</option>
                {fonts.weights.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label>大小写</label>
              <select value={font.case||'as-is'} onChange={e=>setFont({...font, case:e.target.value})}>
                {fonts.cases.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginTop:8}}>
            <label className="cm-lab">指定字体名称(覆盖类别)</label>
            <input className="cm-input" type="text" placeholder="如:Bebas Neue、思源宋体 Bold"
              value={font.custom||''}
              onChange={e=>setFont({...font, custom:e.target.value})}
            />
          </div>
        </div>

        <div className="cm-actions">
          <button className="cm-clear" onClick={()=>{
            setStyles([]);
            setFont({family:'',weight:'',case:'as-is',custom:''});
          }}>清空所有</button>
          <button className="cm-save" onClick={()=>onSave(styles, font)}>保存</button>
        </div>
      </div>
    </div>
  );
}
