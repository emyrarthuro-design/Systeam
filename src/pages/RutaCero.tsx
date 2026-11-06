import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ArrowUp, BookOpen, Check, LockKeyhole, MessageCircle, Save, Sparkles } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';

type Message = { role: 'user' | 'assistant'; content: string };
type Workbook = { fortalezas?: string; puntoCero?: string; anguloOportunidad?: string };

const agents = [
  { id: 'cerebro-mercado', name: 'Cerebro de Mercado', detail: 'Valida tus fortalezas y construye tu Ángulo de Oportunidad', week: 'Semana 1', available: true },
  { id: 'contenido', name: 'Agente de Contenido', detail: 'Pilares, publicaciones y plan de 90 días', week: 'Semanas 2 y 6' },
  { id: 'oferta', name: 'Constructor de Oferta', detail: 'Low Ticket y Siguiente Nivel', week: 'Semana 3' },
  { id: 'clase', name: 'Diseñador de Clase', detail: 'Tu clase gratuita de venta', week: 'Semana 4' },
  { id: 'semilla', name: 'Agente de Lanzamiento Semilla', detail: 'Captación y audios para el lanzamiento', week: 'Semana 4' },
  { id: 'objeciones', name: 'Práctica de Objeciones', detail: 'Ensaya tus conversaciones de venta', week: 'Semana 5' },
  { id: 'testimonios', name: 'Sistema de Testimonios y Prueba Social', detail: 'Resultados reales convertidos en evidencia', week: 'Semana 6' },
  { id: 'expansion', name: 'Expansor de Oferta', detail: 'Alianzas, talleres y expansión', week: 'Semana 6' }
];
const initial: Workbook = { fortalezas: '', puntoCero: '', anguloOportunidad: '' };
const greeting = 'Hola, soy tu Cerebro de Mercado de Ruta Cero de Systeam. Cuéntame tus 2-3 fortalezas finalistas del Radar de Genio (y, si quieres, tu Punto Cero) para que construyamos juntos tu Ángulo de Oportunidad.';

async function api(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Necesitas iniciar sesión.');
  const response = await fetch('/api/ruta-cero/' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No fue posible completar la solicitud.');
  return data;
}
export default function RutaCero() {
  const { user, isAdmin, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [workbook, setWorkbook] = useState<Workbook>(initial);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'workbook'>('chat');
  const [enrollEmail, setEnrollEmail] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api('state').then(data => {
      setAllowed(true);
      setWorkbook({ ...initial, ...(data.workbook || {}) });
      setMessages(data.messages || []);
    }).catch(e => {
      setAllowed(false);
      setError(e.message);
    }).finally(() => setLoading(false));
  }, [user?.uid]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, activeTab]);

  async function saveWorkbook() {
    setSaving(true); setError(''); setSuccess(false);
    try {
      const result = await api('workbook', { method: 'POST', body: JSON.stringify({ fields: workbook }) });
      setWorkbook({ ...initial, ...result.workbook });
      setSuccess(true);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy || text.length > 2400) return;
    setBusy(true); setDraft(''); setError('');
    const previous = messages;
    setMessages([...previous, { role: 'user', content: text }]);
    try {
      const data = await api('chat', { method: 'POST', body: JSON.stringify({ agentId: 'cerebro-mercado', message: text }) });
      setMessages(data.messages);
    } catch (e: any) {
      setMessages(previous);
      setDraft(text);
      setError(e.message);
    } finally { setBusy(false); }
  }

  async function enroll() {
    setBusy(true); setError(''); setSuccess(false);
    try {
      await api('admin/enroll', { method: 'POST', body: JSON.stringify({ email: enrollEmail }) });
      setEnrollEmail(''); setSuccess(true);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 md:py-12 text-white">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <Link to="/diagnostico" className="text-xs text-slate-400 hover:text-white inline-flex gap-2 items-center mb-4"><ArrowLeft size={14}/> Volver a mi espacio</Link>
        <p className="text-xs tracking-[0.3em] font-bold uppercase text-amber-500 mb-2">Systeam Global · Mentoría</p>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight">RUTA <span className="text-amber-500">CERO</span></h1>
        <p className="text-slate-400 mt-2 text-sm">Tu espacio de trabajo con asistentes de inteligencia artificial.</p>
      </div>
      <span className="border border-amber-500/30 bg-amber-500/10 text-amber-400 rounded-full text-xs font-bold px-4 py-2">MVP · Primer asistente</span>
    </div>

    {loading ? <div className="p-8 text-slate-400">Preparando tu espacio…</div> : !allowed ? <div className="max-w-xl border border-slate-700 bg-slate-900 rounded-xl p-8">
      <LockKeyhole size={32} className="text-amber-500 mb-4"/>
      <h2 className="text-xl font-bold mb-2">Acceso pendiente de activación</h2>
      <p className="text-slate-300 text-sm leading-relaxed mb-4">{error || 'Necesitas una inscripción activa a Ruta Cero.'}</p>
      <p className="text-slate-500 text-sm">Solicita al equipo Systeam que active tu cuenta de estudiante.</p>
      {isAdmin && <div className="mt-6 border-t border-slate-700 pt-5">
        <p className="text-xs text-amber-400 font-bold mb-3">Activación administrativa (correo registrado en Systeam)</p>
        <div className="flex gap-2 flex-wrap"><input type="email" value={enrollEmail} onChange={e => setEnrollEmail(e.target.value)} placeholder="estudiante@correo.com" className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 flex-1 min-w-[180px] text-sm"/><button disabled={busy || !enrollEmail.trim()} onClick={enroll} className="bg-amber-500 text-black rounded-lg px-4 font-bold text-sm disabled:opacity-40">Activar estudiante</button></div>
        {success && <p className="text-emerald-400 mt-3 text-sm">Estudiante activado.</p>}
      </div>}
    </div> : <>
      <p className="text-slate-400 mb-5 text-sm">Hola{profile?.fullName ? ', ' + profile.fullName.split(' ')[0] : ''}. Cada asistente te ayuda a completar un ejercicio concreto.</p>
      {isAdmin && <details className="border border-slate-700 rounded-xl mb-6 p-4">
        <summary className="cursor-pointer text-sm font-bold text-amber-400">Administrar acceso de estudiantes</summary>
        <div className="flex gap-2 flex-wrap mt-4"><input type="email" value={enrollEmail} onChange={e=>setEnrollEmail(e.target.value)} placeholder="Correo registrado en Systeam" className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 flex-1 min-w-[220px] text-sm"/><button onClick={enroll} disabled={busy || !enrollEmail.trim()} className="bg-amber-500 text-black rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40">Activar</button></div>
      </details>}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        <aside className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {agents.map(agent => <div key={agent.id} className={'rounded-xl border p-4 ' + (agent.available ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-900/70 border-slate-800 opacity-65')}>
            <div className="flex justify-between items-center mb-2"><span className="text-[10px] tracking-widest uppercase text-amber-400 font-bold">{agent.week}</span>{agent.available ? <Sparkles size={15} className="text-amber-400"/> : <LockKeyhole size={14} className="text-slate-500"/>}</div>
            <h3 className="text-sm font-bold">{agent.name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">{agent.detail}</p>
            <span className={'inline-block text-[10px] mt-3 ' + (agent.available ? 'text-emerald-400' : 'text-slate-500')}>{agent.available ? 'Disponible' : 'Próximamente'}</span>
          </div>)}
        </aside>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden min-w-0">
          <div className="px-4 md:px-6 pt-5 flex gap-2 border-b border-slate-700 pb-4">
            <button onClick={()=>setActiveTab('chat')} className={'px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 '+(activeTab==='chat'?'bg-amber-500 text-slate-950':'text-slate-400 hover:bg-slate-800')}><MessageCircle size={16}/> Conversar</button>
            <button onClick={()=>setActiveTab('workbook')} className={'px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 '+(activeTab==='workbook'?'bg-amber-500 text-slate-950':'text-slate-400 hover:bg-slate-800')}><BookOpen size={16}/> Mi Workbook</button>
          </div>
          {activeTab==='chat' ? <>
            <div className="px-4 md:px-6 py-4 border-b border-slate-800"><h2 className="font-bold">Cerebro de Mercado</h2><p className="text-slate-400 text-xs">Semana 1 · Día 2 · Conversación individual y privada</p></div>
            <div className="h-[430px] md:h-[540px] overflow-y-auto px-4 md:px-6 py-5 flex flex-col gap-4">
              {messages.length===0 && <div className="flex justify-start"><div className="max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-3 bg-slate-800 text-slate-200 leading-relaxed text-sm">{greeting}</div></div>}
              {messages.map((m,i)=><div key={i} className={'flex '+(m.role==='user'?'justify-end':'justify-start')}><div className={'max-w-[92%] md:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words '+(m.role==='user'?'bg-amber-500 text-slate-950 rounded-tr-sm':'bg-slate-800 text-slate-200 rounded-tl-sm')}><ReactMarkdown>{m.content}</ReactMarkdown></div></div>)}
              {busy && <span className="text-xs text-slate-500">El asistente está elaborando una respuesta…</span>}
              <div ref={bottom}/>
            </div>
            <form onSubmit={e=>{e.preventDefault();void send();}} className="p-3 md:p-5 border-t border-slate-700 flex items-end gap-3">
              <textarea rows={2} value={draft} maxLength={2400} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder="Escribe tus fortalezas o una pregunta…" className="flex-1 min-w-0 resize-none rounded-xl bg-slate-800 border border-slate-700 p-3 outline-none focus:border-amber-500 text-sm"/>
              <button type="submit" disabled={!draft.trim()||busy} aria-label="Enviar mensaje" className="bg-amber-500 text-black rounded-xl p-3 disabled:opacity-40"><ArrowUp size={20}/></button>
            </form>
            <div className="px-5 pb-4 text-[11px] text-slate-500">Las referencias de mercado son orientativas. Este MVP todavía no realiza búsquedas web.</div>
          </> : <div className="p-5 md:p-7 space-y-6">
            <div><h2 className="font-bold text-xl">Mi Workbook</h2><p className="text-sm text-slate-400 mt-1">Guarda los ejercicios que compartirás con tus próximos asistentes.</p></div>
            {([
              ['fortalezas','Mis fortalezas finalistas','Escribe las 2-3 fortalezas de tu Radar de Genio.',1600],
              ['puntoCero','Mi Punto Cero','Tu declaración personal, si ya la tienes.',1800],
              ['anguloOportunidad','Mi Ángulo de Oportunidad','Podría diferenciarme ayudando a [audiencia] con [problema] de una forma que [mi diferencial].',1800]
            ] as const).map(([key,title,hint,max])=><label className="block" key={key}><span className="block font-bold text-sm mb-1">{title}</span><span className="block text-xs text-slate-400 mb-2">{hint}</span><textarea value={workbook[key]||''} maxLength={max} onChange={e=>{setWorkbook(old=>({...old,[key]:e.target.value}));setSuccess(false);}} rows={4} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm outline-none focus:border-amber-500 resize-y"/></label>)}
            <button onClick={saveWorkbook} disabled={saving} className="bg-amber-500 text-slate-950 font-bold text-sm px-5 py-3 rounded-xl disabled:opacity-40 inline-flex items-center gap-2">{saving?<Save size={16}/>:<Check size={16}/>} Guardar mi Workbook</button>
            {success && <span className="ml-3 text-emerald-400 text-sm">Guardado correctamente</span>}
          </div>}
        </section>
      </div>
    </>}
    {error && allowed && <div role="alert" className="mt-5 text-rose-300 bg-rose-950/40 border border-rose-900 rounded-lg px-4 py-3 text-sm">{error}</div>}
  </div>;
}
