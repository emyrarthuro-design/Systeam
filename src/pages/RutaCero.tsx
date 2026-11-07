import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, ArrowUp, BookOpen, Check, ChevronRight, LockKeyhole,
  MessageCircle, Save, Sparkles
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';

type Message = { role: 'user' | 'assistant'; content: string };
type AgentId = 'cerebro-mercado' | 'contenido';
type ContentMode = 'pilares' | 'publicaciones' | 'sistema90';
type Workbook = {
  fortalezas?: string;
  puntoCero?: string;
  anguloOportunidad?: string;
  avatar?: string;
  tonoArquetipo?: string;
  pilares?: string;
  ideasContenido?: string;
  bio?: string;
  publicaciones?: string;
  ofertaLowTicket?: string;
  sistemaContenido90?: string;
};

const agents = [
  {
    id: 'cerebro-mercado', name: 'Cerebro de Mercado',
    detail: 'Cruza tus fortalezas con oportunidades comerciales.',
    week: 'Semana 1', available: true
  },
  {
    id: 'contenido', name: 'Agente de Contenido',
    detail: 'Pilares, bio, publicaciones y un sistema de 90 días.',
    week: 'Semanas 2 y 6', available: true
  },
  { id: 'oferta', name: 'Constructor de Oferta', detail: 'Low Ticket y Siguiente Nivel.', week: 'Semana 3', available: false },
  { id: 'clase', name: 'Diseñador de Clase', detail: 'Tu clase gratuita de venta.', week: 'Semana 4', available: false },
  { id: 'semilla', name: 'Agente de Lanzamiento Semilla', detail: 'Captación y audios de lanzamiento.', week: 'Semana 4', available: false },
  { id: 'objeciones', name: 'Práctica de Objeciones', detail: 'Ensaya conversaciones de venta.', week: 'Semana 5', available: false },
  { id: 'testimonios', name: 'Sistema de Testimonios y Prueba Social', detail: 'Transforma resultados reales en evidencia.', week: 'Semana 6', available: false },
  { id: 'expansion', name: 'Expansor de Oferta', detail: 'Alianzas, talleres y expansión.', week: 'Semana 6', available: false }
] as const;

const modes = [
  { id: 'pilares', name: 'Pilares', subtitle: '4 ideas por pilar: Educa, Conecta, Activa, Convierte' },
  { id: 'publicaciones', name: 'Publicaciones', subtitle: 'Bio y publicaciones con tu tono de marca' },
  { id: 'sistema90', name: 'Sistema 90 días', subtitle: 'Temas, formatos y frecuencia sostenible' }
] as const;

const greetings: Record<string, string> = {
  'cerebro-mercado': 'Hola, soy tu Cerebro de Mercado de Ruta Cero de Systeam. Cuéntame tus 2-3 fortalezas finalistas y, si quieres, tu Punto Cero. Vamos a encontrar tu Ángulo de Oportunidad.',
  'contenido-pilares': 'Hola, soy tu Agente de Contenido. Estamos en modo Pilares. ¿Cuáles son los 3-4 temas que validaste en clase y cuál es tu Avatar?',
  'contenido-publicaciones': 'Hola, soy tu Agente de Contenido. Vamos con tu Bio y Publicaciones. ¿Cuál es tu Avatar, tu tono y qué ideas quieres convertir en publicaciones?',
  'contenido-sistema90': 'Hola, soy tu Agente de Contenido. Vamos a construir un sistema de 90 días sostenible con tu Avatar, tu Low Ticket y tus Pilares.'
};

const fields: Array<{ key: keyof Workbook; label: string; hint: string; max: number; group: string }> = [
  { key: 'puntoCero', label: 'Mi Punto Cero', hint: 'Tu declaración inicial.', max: 1800, group: 'Identidad y oportunidad' },
  { key: 'fortalezas', label: 'Fortalezas finalistas', hint: 'Las fortalezas de tu Radar de Genio.', max: 1600, group: 'Identidad y oportunidad' },
  { key: 'anguloOportunidad', label: 'Ángulo de Oportunidad', hint: 'La diferenciación que construirás con Cerebro de Mercado.', max: 1800, group: 'Identidad y oportunidad' },
  { key: 'avatar', label: 'Avatar', hint: '¿A quién quieres ayudar? Incluye necesidades y contexto real.', max: 2500, group: 'Marca y contenido' },
  { key: 'tonoArquetipo', label: 'Tono y arquetipo', hint: 'Tu tono de voz y arquetipo de marca o cómo los describes.', max: 1800, group: 'Marca y contenido' },
  { key: 'pilares', label: 'Pilares temáticos', hint: 'Entre 3 y 4 temas validados en clase.', max: 2500, group: 'Marca y contenido' },
  { key: 'ideasContenido', label: 'Ideas por pilar', hint: 'Guarda el resultado del modo Pilares.', max: 10000, group: 'Marca y contenido' },
  { key: 'bio', label: 'Bio de marca', hint: 'Máximo 150 caracteres para la bio final.', max: 150, group: 'Marca y contenido' },
  { key: 'publicaciones', label: 'Publicaciones', hint: 'Guarda aquí tus copies y la bio generada.', max: 12000, group: 'Marca y contenido' },
  { key: 'ofertaLowTicket', label: 'Oferta Low Ticket', hint: 'Producto validado, útil para planificar el Sistema 90 días.', max: 3500, group: 'Oferta y plan 90 días' },
  { key: 'sistemaContenido90', label: 'Sistema de contenido de 90 días', hint: 'Frecuencia, temas y formatos sostenibles.', max: 14000, group: 'Oferta y plan 90 días' }
];

const outputFieldByMode: Record<ContentMode, keyof Workbook> = {
  pilares: 'ideasContenido',
  publicaciones: 'publicaciones',
  sistema90: 'sistemaContenido90'
};

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
  const [agentId, setAgentId] = useState<AgentId>('cerebro-mercado');
  const [contentMode, setContentMode] = useState<ContentMode>('pilares');
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [workbook, setWorkbook] = useState<Workbook>({});
  const [savedWorkbook, setSavedWorkbook] = useState<Workbook>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'workbook'>('chat');
  const [enrollEmail, setEnrollEmail] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const conversationKey = agentId === 'cerebro-mercado' ? agentId : 'contenido-' + contentMode;
  const activeAgent = agents.find(a => a.id === agentId)!;
  const activeMode = modes.find(m => m.id === contentMode)!;

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setError('');
    setMessages([]);
    setDraft('');
    const query = new URLSearchParams({ agentId });
    if (agentId === 'contenido') query.set('mode', contentMode);
    api('state?' + query.toString()).then(data => {
      if (!active) return;
      setAllowed(true);
      setWorkbook(data.workbook || {});
      setSavedWorkbook(data.workbook || {});
      setMessages(data.messages || []);
    }).catch((e: Error) => {
      if (!active) return;
      setAllowed(false);
      setError(e.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user?.uid, agentId, contentMode]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, activeTab, conversationKey]);

  async function saveWorkbook() {
    const changedFields: Record<string, string> = {};
    for (const field of fields) {
      if ((workbook[field.key] || '') !== (savedWorkbook[field.key] || '')) {
        changedFields[field.key] = workbook[field.key] || '';
      }
    }
    if (Object.keys(changedFields).length === 0) {
      setSuccess('Tu Workbook está actualizado.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const result = await api('workbook', { method: 'POST', body: JSON.stringify({ fields: changedFields }) });
      setWorkbook(result.workbook || {});
      setSavedWorkbook(result.workbook || {});
      setSuccess('Workbook guardado.');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function send() {
    const input = draft.trim();
    if (!input || busy || loading || input.length > 2400) return;
    const previous = messages;
    setBusy(true); setDraft(''); setError('');
    setMessages([...previous, { role: 'user', content: input }]);
    try {
      const data = await api('chat', {
        method: 'POST',
        body: JSON.stringify({ agentId, mode: agentId === 'contenido' ? contentMode : undefined, message: input })
      });
      setMessages(data.messages || []);
    } catch (e: any) {
      setMessages(previous);
      setDraft(input);
      setError(e.message);
    } finally { setBusy(false); }
  }

  async function saveFromReply(reply: string) {
    let field: keyof Workbook;
    let value = reply.trim();
    if (agentId === 'cerebro-mercado') {
      const plain = reply.replace(/[*_`]/g, '');
      const extracted = plain.match(/Podría diferenciarme ayudando a[^\n]{15,700}/i)?.[0]?.trim();
      if (!extracted) {
        setError('No encontré el Ángulo de Oportunidad en esa respuesta.');
        return;
      }
      value = extracted.replace(/^["“]|["”]$/g, '').trim();
      field = 'anguloOportunidad';
    } else {
      field = outputFieldByMode[contentMode];
    }
    const limit = fields.find(item => item.key === field)!.max;
    if (value.length > limit) {
      setError('El resultado supera el límite del Workbook. Guarda una versión resumida o edítalo antes.');
      return;
    }
    const patch: Record<string, string> = { [field]: value };
    if (agentId === 'contenido' && contentMode === 'publicaciones') {
      const clean = reply.replace(/\\*\\*/g, '');
      const bio = clean.match(/^\\s*BIO:\\s*(.+)$/im)?.[1]?.trim();
      if (bio && bio.length <= 150) patch.bio = bio;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const data = await api('workbook', { method: 'POST', body: JSON.stringify({ fields: patch }) });
      setWorkbook(old => ({ ...old, ...Object.fromEntries(Object.keys(patch).map(key => [key, data.workbook[key]])) }));
      setSavedWorkbook(old => ({ ...old, ...Object.fromEntries(Object.keys(patch).map(key => [key, data.workbook[key]])) }));
      setSuccess('Resultado guardado en el Workbook.');
      setActiveTab('workbook');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function enroll() {
    setBusy(true); setError(''); setSuccess('');
    try {
      await api('admin/enroll', { method: 'POST', body: JSON.stringify({ email: enrollEmail }) });
      setEnrollEmail('');
      setSuccess('Estudiante activado.');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  function chooseAgent(next: AgentId) {
    if (busy || saving) return;
    const dirty = fields.some(field => (workbook[field.key] || '') !== (savedWorkbook[field.key] || ''));
    if (dirty && !window.confirm('Tienes cambios sin guardar en tu Workbook. ¿Quieres cambiar de asistente y descartarlos?')) return;
    setAgentId(next);
    setActiveTab('chat');
  }
  function chooseMode(next: ContentMode) {
    if (busy || saving || next === contentMode) return;
    setContentMode(next);
    setActiveTab('chat');
  }

  return <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 md:py-12 text-white">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <Link to="/diagnostico" className="text-xs text-slate-400 hover:text-white inline-flex gap-2 items-center mb-4">
          <ArrowLeft size={14}/> Volver a mi espacio
        </Link>
        <p className="text-xs tracking-[0.3em] font-bold uppercase text-amber-500 mb-2">Systeam Global · Mentoría</p>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight">RUTA <span className="text-amber-500">CERO</span></h1>
        <p className="text-slate-400 mt-2 text-sm">Tus asistentes, conversaciones y ejercicios en un solo lugar.</p>
      </div>
      <span className="border border-amber-500/30 bg-amber-500/10 text-amber-400 rounded-full text-xs font-bold px-4 py-2">
        MVP · 2 asistentes
      </span>
    </div>

    {loading ? <div className="p-8 text-slate-400">Preparando tu espacio…</div> : !allowed ?
      <div className="max-w-xl border border-slate-700 bg-slate-900 rounded-xl p-8">
        <LockKeyhole size={32} className="text-amber-500 mb-4"/>
        <h2 className="text-xl font-bold mb-2">Acceso pendiente de activación</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">{error || 'Necesitas una inscripción activa a Ruta Cero.'}</p>
        <p className="text-slate-500 text-sm">Solicita al equipo Systeam que active tu cuenta de estudiante.</p>
        {isAdmin && <div className="mt-6 border-t border-slate-700 pt-5">
          <p className="text-xs text-amber-400 font-bold mb-3">Activación administrativa</p>
          <div className="flex gap-2 flex-wrap">
            <input type="email" value={enrollEmail} onChange={e => setEnrollEmail(e.target.value)} placeholder="estudiante@correo.com" className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 flex-1 min-w-[180px] text-sm"/>
            <button disabled={busy || !enrollEmail.trim()} onClick={enroll} className="bg-amber-500 text-black rounded-lg px-4 font-bold text-sm disabled:opacity-40">Activar estudiante</button>
          </div>
          {success && <p className="text-emerald-400 mt-3 text-sm">{success}</p>}
        </div>}
      </div>
    : <>
      <p className="text-slate-400 mb-5 text-sm">Hola{profile?.fullName ? ', ' + profile.fullName.split(' ')[0] : ''}. Cada asistente trabaja un ejercicio concreto de la metodología.</p>
      {isAdmin && <details className="border border-slate-700 rounded-xl mb-6 p-4">
        <summary className="cursor-pointer text-sm font-bold text-amber-400">Administrar acceso de estudiantes</summary>
        <div className="flex gap-2 flex-wrap mt-4">
          <input type="email" value={enrollEmail} onChange={e => setEnrollEmail(e.target.value)} placeholder="Correo registrado en Systeam" className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 flex-1 min-w-[220px] text-sm"/>
          <button onClick={enroll} disabled={busy || !enrollEmail.trim()} className="bg-amber-500 text-black rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40">Activar</button>
        </div>
      </details>}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        <aside className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3" aria-label="Asistentes de Ruta Cero">
          {agents.map(agent => <button
            key={agent.id}
            type="button"
            disabled={!agent.available || busy || saving}
            onClick={() => chooseAgent(agent.id as AgentId)}
            aria-pressed={agent.available && agentId === agent.id}
            className={'rounded-xl border p-4 text-left transition-colors ' +
              (!agent.available ? 'bg-slate-900/70 border-slate-800 opacity-55 cursor-not-allowed' :
                agentId === agent.id ? 'bg-amber-500/10 border-amber-500/60' : 'bg-slate-900/70 border-slate-700 hover:border-amber-500/50')}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] tracking-widest uppercase text-amber-400 font-bold">{agent.week}</span>
              {agent.available ? <Sparkles size={15} className="text-amber-400"/> : <LockKeyhole size={14} className="text-slate-500"/>}
            </div>
            <h3 className="text-sm font-bold">{agent.name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">{agent.detail}</p>
            <span className={'inline-flex gap-1 items-center text-[10px] mt-3 ' + (agent.available ? 'text-emerald-400' : 'text-slate-500')}>
              {agent.available ? 'Disponible' : 'Próximamente'}{agent.available && agentId === agent.id && <ChevronRight size={12}/>}
            </span>
          </button>)}
        </aside>

        <section className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden min-w-0">
          <div className="px-4 md:px-6 pt-5 flex gap-2 border-b border-slate-700 pb-4">
            <button onClick={() => setActiveTab('chat')} className={'px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ' +
              (activeTab === 'chat' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800')}>
              <MessageCircle size={16}/> Conversar
            </button>
            <button onClick={() => setActiveTab('workbook')} className={'px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ' +
              (activeTab === 'workbook' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800')}>
              <BookOpen size={16}/> Mi Workbook
            </button>
          </div>

          {activeTab === 'chat' ? <>
            <div className="px-4 md:px-6 py-4 border-b border-slate-800">
              <h2 className="font-bold">{activeAgent.name}</h2>
              <p className="text-slate-400 text-xs">{activeAgent.week} · Conversación individual</p>
              {agentId === 'contenido' && <div className="flex gap-2 flex-wrap mt-4" aria-label="Modo de trabajo">
                {modes.map(mode => <button
                  key={mode.id}
                  type="button"
                  onClick={() => chooseMode(mode.id)}
                  disabled={busy || saving}
                  aria-pressed={mode.id === contentMode}
                  className={'text-xs rounded-lg px-3 py-2 border font-bold ' +
                    (mode.id === contentMode ? 'bg-amber-500 text-slate-950 border-amber-500' : 'text-slate-300 border-slate-700 hover:border-amber-500/60')}
                >{mode.name}</button>)}
                <p className="text-slate-400 text-xs basis-full mt-1">{activeMode.subtitle}</p>
              </div>}
            </div>
            <div className="h-[430px] md:h-[520px] overflow-y-auto px-4 md:px-6 py-5 flex flex-col gap-4">
              {messages.length === 0 && <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-3 bg-slate-800 text-slate-200 leading-relaxed text-sm">
                  {greetings[conversationKey]}
                </div>
              </div>}
              {messages.map((m, i) => <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={'max-w-[92%] md:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words ' +
                  (m.role === 'user' ? 'bg-amber-500 text-slate-950 rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm')}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                  {m.role === 'assistant' && (agentId === 'contenido' ? m.content.length > 120 :
                    m.content.toLowerCase().includes('podría diferenciarme ayudando a')) &&
                    <button type="button" disabled={saving || busy} onClick={() => void saveFromReply(m.content)}
                      className="mt-3 flex items-center gap-2 text-amber-400 hover:text-amber-300 font-bold text-xs disabled:opacity-50">
                      <BookOpen size={14}/> Guardar este resultado en mi Workbook
                    </button>}
                </div>
              </div>)}
              {busy && <span className="text-xs text-slate-500">El asistente está elaborando una respuesta…</span>}
              <div ref={bottom}/>
            </div>
            <form onSubmit={e => { e.preventDefault(); void send(); }} className="p-3 md:p-5 border-t border-slate-700 flex items-end gap-3">
              <textarea rows={2} value={draft} maxLength={2400} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder={agentId === 'contenido' ? 'Escribe tu ejercicio o una pregunta…' : 'Escribe tus fortalezas o una pregunta…'}
                className="flex-1 min-w-0 resize-none rounded-xl bg-slate-800 border border-slate-700 p-3 outline-none focus:border-amber-500 text-sm"/>
              <button type="submit" disabled={!draft.trim() || busy || loading} aria-label="Enviar mensaje"
                className="bg-amber-500 text-black rounded-xl p-3 disabled:opacity-40"><ArrowUp size={20}/></button>
            </form>
            <p className="px-5 pb-4 text-[11px] text-slate-500">Esta versión no realiza búsquedas web. Valida las referencias y guarda sólo resultados que hayas revisado.</p>
          </> : <div className="p-5 md:p-7 space-y-6">
            <div>
              <h2 className="font-bold text-xl">Mi Workbook</h2>
              <p className="text-sm text-slate-400 mt-1">Tus avances alimentan los próximos ejercicios de Ruta Cero.</p>
            </div>
            {Array.from(new Set(fields.map(item => item.group))).map(group => <div key={group} className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 border-b border-slate-700 pb-2">{group}</h3>
              {fields.filter(item => item.group === group).map(field => <label className="block" key={field.key}>
                <span className="block font-bold text-sm mb-1">{field.label}</span>
                <span className="block text-xs text-slate-400 mb-2">{field.hint}</span>
                <textarea value={workbook[field.key] || ''} maxLength={field.max}
                  onChange={e => { setWorkbook(old => ({ ...old, [field.key]: e.target.value })); setSuccess(''); }}
                  rows={field.key === 'ideasContenido' || field.key === 'publicaciones' || field.key === 'sistemaContenido90' ? 6 : 3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm outline-none focus:border-amber-500 resize-y"/>
                <span className="block text-right text-[10px] text-slate-500">{(workbook[field.key] || '').length} / {field.max}</span>
              </label>)}
            </div>)}
            <button onClick={() => void saveWorkbook()} disabled={saving}
              className="bg-amber-500 text-slate-950 font-bold text-sm px-5 py-3 rounded-xl disabled:opacity-40 inline-flex items-center gap-2">
              {saving ? <Save size={16}/> : <Check size={16}/>} Guardar mi Workbook
            </button>
          </div>}
        </section>
      </div>
    </>}
    {success && <div role="status" className="mt-5 text-emerald-300 bg-emerald-950/40 border border-emerald-900 rounded-lg px-4 py-3 text-sm">{success}</div>}
    {error && allowed && <div role="alert" className="mt-5 text-rose-300 bg-rose-950/40 border border-rose-900 rounded-lg px-4 py-3 text-sm">{error}</div>}
  </div>;
}
