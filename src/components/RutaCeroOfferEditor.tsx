import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, ShieldCheck } from 'lucide-react';

type PriceExperience = 'first' | 'experienced' | '';
type OfferStage = 'lowTicket' | 'siguienteNivel';
type RecordData = Record<string, any>;
type Props = {
  offers: { lowTicket?: RecordData | null; siguienteNivel?: RecordData | null };
  lastAssistantReply?: string;
  api: (path: string, options?: RequestInit) => Promise<any>;
  onSaved: (data: { workbook: Record<string, string>; offers: Props['offers'] }) => void;
};
type Draft = {
  name: string;
  format: string;
  includes: string;
  transformation: string;
  bonus: string;
  objection1: string;
  response1: string;
  objection2: string;
  response2: string;
  reason: string;
  price: string;
};
const blank: Draft = {
  name: '', format: '', includes: '', transformation: '', bonus: '',
  objection1: '', response1: '', objection2: '', response2: '',
  reason: '', price: ''
};
const lowFields = [
  ['name', 'Nombre memorable', 'Ejemplo: Tu primer plan de acción'],
  ['format', 'Formato', 'Taller en vivo, guía acompañada, workshop, etc.'],
  ['includes', 'Qué incluye', 'Entregables, duración y alcance concreto'],
  ['transformation', 'Transformación concreta', 'Qué podrá hacer la persona después, sin prometer resultados'],
  ['bonus', 'Bono que atiende la objeción principal', 'Un extra útil y relacionado con la oferta'],
  ['objection1', 'Objeción 1', 'Duda real que podría surgir'],
  ['response1', 'Respuesta honesta 1', 'Cómo la aclararás sin promesas exageradas'],
  ['objection2', 'Objeción 2', 'Otra duda real'],
  ['response2', 'Respuesta honesta 2', 'Cómo responderías esa inquietud']
] as const;
const nextFields = [
  ['name', 'Nombre del Siguiente Nivel', 'Una solución más profunda'],
  ['format', 'Formato', 'Programa, membresía, acompañamiento, etc.'],
  ['includes', 'Qué incluye', 'Qué recibe quien ya compró el Low Ticket'],
  ['transformation', 'Transformación siguiente', 'Cuál es el avance adicional'],
  ['reason', 'Por qué es el siguiente paso', 'Conexión lógica con el primer producto']
] as const;

function draftFromSaved(data: RecordData | null | undefined): Draft {
  if (!data) return { ...blank };
  return {
    ...blank,
    ...Object.fromEntries(Object.keys(blank).map(k => [k, k === 'price' ? String(data.price ?? '') : String(data[k] ?? '')]))
  } as Draft;
}
function extractSuggestion(text: string, stage: OfferStage): Partial<Draft> {
  const cleanLines = text.replace(/\*\*/g, '').split(/\r?\n/).map(x => x.trim().replace(/^[-•]\s*/, ''));
  const labels: Partial<Record<keyof Draft, string>> = stage === 'lowTicket' ? {
    name: 'Nombre', format: 'Formato', includes: 'Incluye',
    transformation: 'Transformación', bonus: 'Bono',
    objection1: 'Objeción 1', response1: 'Respuesta 1',
    objection2: 'Objeción 2', response2: 'Respuesta 2',
    price: 'Precio'
  } : {
    name: 'Nombre', format: 'Formato', includes: 'Incluye',
    transformation: 'Transformación', reason: 'Razón para avanzar',
    price: 'Precio'
  };
  const draft: Partial<Draft> = {};
  for (const [key, label] of Object.entries(labels)) {
    const line = cleanLines.find(x => x.toLocaleLowerCase().startsWith(label!.toLocaleLowerCase() + ':'));
    if (!line) continue;
    const value = line.slice(label!.length + 1).trim();
    if (!value) continue;
    if (key === 'price') {
      const match = value.match(/\$?\s*(\d+(?:[.,]\d{1,2})?)/);
      if (match) draft.price = match[1].replace(',', '.');
    } else {
      (draft as any)[key] = value;
    }
  }
  return draft;
}

export default function RutaCeroOfferEditor({ offers, lastAssistantReply = '', api, onSaved }: Props) {
  const [stage, setStage] = useState<OfferStage>('lowTicket');
  const [experience, setExperience] = useState<PriceExperience>('');
  const [low, setLow] = useState<Draft>({ ...blank });
  const [next, setNext] = useState<Draft>({ ...blank });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setLow(draftFromSaved(offers.lowTicket));
    setNext(draftFromSaved(offers.siguienteNivel));
    setExperience(offers.lowTicket?.experience === 'first' || offers.lowTicket?.experience === 'experienced'
      ? offers.lowTicket.experience : '');
  }, [offers.lowTicket, offers.siguienteNivel]);
  const lowPrice = Number(offers.lowTicket?.price || 0);
  const current = stage === 'lowTicket' ? low : next;
  const setCurrent = stage === 'lowTicket' ? setLow : setNext;
  const band = experience === 'first' ? { min: 7, max: 27 }
    : experience === 'experienced' ? { min: 27, max: 100 } : null;
  const labels = stage === 'lowTicket' ? lowFields : nextFields;
  async function save() {
    setError(''); setNotice(''); setBusy(true);
    try {
      const { price, ...rest } = current;
      const response = await api('offers', {
        method: 'POST',
        body: JSON.stringify({
          stage,
          ...(stage === 'lowTicket' ? { experience } : {}),
          offer: { ...rest, price: price.trim() === '' ? null : Number(price) }
        })
      });
      onSaved(response);
      setNotice(stage === 'lowTicket'
        ? 'Low Ticket validado y guardado. Ahora puedes construir el Siguiente Nivel.'
        : 'Siguiente Nivel validado y guardado en tu Workbook.');
      if (stage === 'lowTicket') setStage('siguienteNivel');
    } catch (e: any) { setError(e.message || 'No se pudo guardar la oferta.'); }
    finally { setBusy(false); }
  }
  return <div className="p-5 md:p-7 space-y-5 text-sm">
    <div className="flex items-start gap-3">
      <ClipboardList className="text-amber-400 shrink-0" size={24}/>
      <div>
        <h2 className="text-xl font-black">Mis ofertas</h2>
        <p className="text-slate-400 mt-1">Completa tu propuesta tras hablar con Constructor de Oferta. Los precios se verifican antes de guardar.</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => { setStage('lowTicket'); setError(''); }}
        className={'px-4 py-2 rounded-lg font-bold border ' + (stage === 'lowTicket' ? 'bg-amber-500 text-black border-amber-500' : 'border-slate-700 text-slate-200')}>
        1. Low Ticket {offers.lowTicket && <CheckCircle2 size={14} className="inline ml-1"/>}
      </button>
      <button type="button" disabled={busy || !offers.lowTicket} onClick={() => { setStage('siguienteNivel'); setError(''); }}
        className={'px-4 py-2 rounded-lg font-bold border disabled:opacity-40 ' + (stage === 'siguienteNivel' ? 'bg-amber-500 text-black border-amber-500' : 'border-slate-700 text-slate-200')}>
        2. Siguiente Nivel {offers.siguienteNivel && <CheckCircle2 size={14} className="inline ml-1"/>}
      </button>
    </div>

    {stage === 'lowTicket' && <div className="space-y-2">
      <label className="block font-bold" htmlFor="rc-experience">¿Ya has vendido algo antes?</label>
      <select id="rc-experience" value={experience} onChange={e => setExperience(e.target.value as PriceExperience)}
        className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg">
        <option value="">Selecciona tu experiencia</option>
        <option value="first">No, esta sería mi primera venta</option>
        <option value="experienced">Sí, ya tengo experiencia vendiendo</option>
      </select>
      <p className="text-amber-400 text-xs">{band
        ? `Precio permitido: $${band.min}–$${band.max} USD.`
        : 'Primero selecciona tu experiencia para conocer el rango permitido.'}</p>
    </div>}
    {stage === 'siguienteNivel' && <p className="text-amber-400 bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg text-xs">
      Tu Low Ticket validado cuesta ${lowPrice.toFixed(2)} USD. El Siguiente Nivel debe costar entre $${(lowPrice * 3).toFixed(2)} y $${(lowPrice * 10).toFixed(2)} USD.
    </p>}

    {lastAssistantReply && <button type="button" onClick={() => {
      setCurrent(old => ({ ...old, ...extractSuggestion(lastAssistantReply, stage) }));
      setNotice('Se copiaron los campos reconocidos de la última respuesta. Revísalos antes de guardar.');
    }} className="border border-amber-500/40 text-amber-400 px-3 py-2 rounded-lg text-xs font-bold hover:bg-amber-500/10">
      Tomar datos de la última respuesta del asistente
    </button>}
    <div className="grid gap-4">
      {labels.map(([key, label, hint]) => <label key={key} className="block">
        <span className="font-semibold block mb-1">{label}</span>
        <span className="text-slate-500 text-xs block mb-2">{hint}</span>
        {key === 'name' || key === 'format' ? <input value={current[key]} maxLength={key === 'name' ? 140 : 250}
          onChange={e => setCurrent(old => ({ ...old, [key]: e.target.value }))}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3" />
          : <textarea rows={2} value={current[key]} maxLength={key === 'includes' ? 900 : 500}
            onChange={e => setCurrent(old => ({ ...old, [key]: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 resize-y"/>}
      </label>)}
      <label className="block">
        <span className="font-semibold block mb-2">Precio en USD</span>
        <input type="number" step="0.01" min={stage === 'lowTicket' ? (band?.min || 7) : lowPrice * 3}
          max={stage === 'lowTicket' ? (band?.max || 100) : lowPrice * 10}
          value={current.price} onChange={e => setCurrent(old => ({ ...old, price: e.target.value }))}
          placeholder="Ejemplo: 17" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3"/>
      </label>
    </div>
    <button type="button" disabled={busy || (stage === 'lowTicket' && !experience) || (stage === 'siguienteNivel' && !offers.lowTicket)}
      onClick={() => void save()}
      className="bg-amber-500 text-slate-950 font-black px-5 py-3 rounded-lg disabled:opacity-40 flex items-center gap-2">
      <ShieldCheck size={18}/> {busy ? 'Verificando…' : 'Validar y guardar ' + (stage === 'lowTicket' ? 'Low Ticket' : 'Siguiente Nivel')}
    </button>
    {error && <p role="alert" className="text-rose-300 bg-rose-950/30 border border-rose-900 rounded-lg p-3">{error}</p>}
    {notice && <p role="status" className="text-emerald-300 bg-emerald-950/30 border border-emerald-900 rounded-lg p-3">{notice}</p>}
    {stage === 'lowTicket' && offers.lowTicket && <p className="text-emerald-400 text-xs">Tu Low Ticket está validado. Si cambias sus detalles, el Siguiente Nivel se invalidará y tendrás que revisarlo nuevamente.</p>}
  </div>;
}
