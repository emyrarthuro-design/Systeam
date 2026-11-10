import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { learningRequest as request } from '../lib/rutaCeroLearning';
import { DELIVERABLE_EXTENSIONS, lessons, MAX_DELIVERABLE_BYTES } from '../rutaCeroCurriculum';

type Status = 'started' | 'submitted' | 'changes' | 'approved';
type Work = { id: string; lessonId: string; studentEmail: string; status: Status; version: number; submittedAt?: string;
  link?: string; file?: { name: string }; feedback?: string };
type Access = { student: boolean; reviewer: boolean; admin: boolean; filesEnabled: boolean; progress: Work[] };
type ReviewPage = { progress: Work[]; nextCursor: string | null };
const statusLabels = { started: 'En curso', submitted: 'Entregado', changes: 'Ajustes solicitados', approved: 'Aprobado' };
const panel = 'rounded-2xl border border-sys-border bg-sys-card p-5';
const button = 'btn-geometric-secondary disabled:opacity-50';

const put = (body: object): RequestInit => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const message = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un problema. Intenta nuevamente.';

function Artifact({ work }: { work: Work }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function download() {
    if (!work.file) return;
    setBusy(true);
    setError('');
    try {
      const response = await request('/file/' + encodeURIComponent(work.id) + '?version=' + work.version);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = work.file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <div className="text-sm">
    {work.link && <a className="font-semibold text-sys-accent underline" href={work.link} target="_blank" rel="noopener noreferrer">Abrir enlace de entrega</a>}
    {work.file && <button className="font-semibold text-sys-accent underline" disabled={busy} onClick={() => void download()}>Descargar {work.file.name}</button>}
    {error && <p className="mt-1 text-sys-error" role="alert">{error}</p>}
  </div>;
}

function ClassCard({ lesson, item, filesEnabled, refresh, selected }: {
  lesson: typeof lessons[number]; item?: Work; filesEnabled: boolean; refresh: () => Promise<void>; selected: boolean;
}) {
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const path = '/classes/' + lesson.id;
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selected) card.current?.focus();
  }, [selected]);

  async function save(action: 'start' | 'submit') {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (action === 'submit' && file) {
        if (file.size > MAX_DELIVERABLE_BYTES) throw new Error('El archivo supera los 10 MB.');
        await request(path + '/file', { method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file });
      } else {
        await request(path, put({ action, ...(action === 'submit' && { link }) }));
      }
      if (action === 'submit') {
        setLink('');
        setFile(null);
        setFormKey(key => key + 1);
      }
      await refresh();
      setNotice(action === 'submit' ? 'Entregable guardado.' : 'Avance guardado.');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }

  const date = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(lesson.date));
  return <article ref={card} tabIndex={-1} aria-label={lesson.title}
    className={panel + (selected ? ' ring-2 ring-sys-accent' : '')}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-sys-text-sec">Clase {lesson.day} · {date}</p>
      <span className="rounded-full bg-sys-input px-3 py-1 text-xs font-semibold text-sys-accent">{item ? statusLabels[item.status] : 'Pendiente'}</span>
    </div>
    <h3 className="mt-2 text-lg font-bold">{lesson.title}</h3>
    <p className="mt-2 text-sm text-sys-text-sec">{lesson.deliverable}</p>
    {item && <div className="mt-3"><Artifact work={item} /></div>}
    {item?.feedback && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-sys-input p-3 text-sm">Comentario del profesor: {item.feedback}</p>}
    {item?.status !== 'approved' && <form key={formKey} className="mt-4 grid gap-3" onSubmit={event => { event.preventDefault(); void save('submit'); }}>
      <label className="grid gap-1 text-sm">Enlace del entregable
        <input type="url" value={link} onChange={event => setLink(event.target.value)} disabled={busy || !!file}
          maxLength={2048} placeholder="https://…" className="input-geometric" />
      </label>
      {filesEnabled && <label className="grid gap-1 text-sm">O adjunta un archivo de hasta 10 MB
        <input type="file" accept={DELIVERABLE_EXTENSIONS.map(extension => '.' + extension).join(',')}
          disabled={busy || !!link.trim()} onChange={event => setFile(event.target.files?.[0] || null)} className="input-geometric" />
      </label>}
      <div className="flex flex-wrap gap-2">
        {!item && <button type="button" className={button} disabled={busy} onClick={() => void save('start')}>Marcar en curso</button>}
        <button className="btn-geometric-primary" disabled={busy || (!file && !link.trim())}>
          {item?.version ? 'Enviar nueva versión' : 'Entregar'}
        </button>
      </div>
    </form>}
    {error && <p className="mt-2 text-sm text-sys-error" role="alert">{error}</p>}
    {notice && <p className="mt-2 text-sm text-sys-success" role="status">{notice}</p>}
  </article>;
}

function ReviewCard({ item, refresh }: { item: Work; refresh: () => Promise<void> }) {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function review(status: 'approved' | 'changes') {
    setBusy(true);
    setError('');
    try {
      await request('/reviews/' + encodeURIComponent(item.id), put({ status, version: item.version, feedback }));
      setFeedback('');
      await refresh();
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <article className={panel}>
    <p className="text-sm text-sys-text-sec">{item.studentEmail} · {statusLabels[item.status]}</p>
    {item.submittedAt && <time className="text-xs text-sys-text-sec" dateTime={item.submittedAt}>
      Entregado el {new Date(item.submittedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })}
    </time>}
    <h3 className="mb-2 mt-1 font-bold">{lessons.find(lesson => lesson.id === item.lessonId)?.title || item.lessonId}</h3>
    <Artifact work={item} />
    {item.feedback && <p className="mt-2 whitespace-pre-wrap text-sm">{item.feedback}</p>}
    {item.status === 'submitted' && <div className="mt-3 grid gap-3">
      <label className="grid gap-1 text-sm">Comentario para el estudiante
        <textarea rows={3} maxLength={2000} value={feedback} onChange={event => setFeedback(event.target.value)} className="input-geometric" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="btn-geometric-primary" disabled={busy} onClick={() => void review('approved')}>Aprobar</button>
        <button className={button} disabled={busy || !feedback.trim()} onClick={() => void review('changes')}>Pedir ajustes</button>
      </div>
    </div>}
    {error && <p className="mt-2 text-sm text-sys-error" role="alert">{error}</p>}
  </article>;
}

function TeacherAccess() {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await request('/teachers', put({ email, active: action !== 'remove' }));
      setNotice(action === 'remove' ? 'Acceso de profesor retirado.' : 'Acceso de profesor habilitado.');
      setEmail('');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <form onSubmit={event => void submit(event)} className={panel}>
    <h2 className="font-bold">Acceso de profesores</h2>
    <p className="mt-1 text-sm text-sys-text-sec">Habilita el correo verificado que el profesor usa en Systeam. Podrá revisar todas las entregas de Ruta Cero.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <input type="email" aria-label="Correo del profesor" required value={email} onChange={event => setEmail(event.target.value)}
        placeholder="profesor@correo.com" className="input-geometric min-w-56 flex-1" />
      <button className="btn-geometric-primary" value="add" disabled={busy}>Habilitar</button>
      <button className={button} value="remove" disabled={busy}>Retirar acceso</button>
    </div>
    {notice && <p role="status" className="mt-2 text-sm text-sys-success">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-sys-error">{error}</p>}
  </form>;
}

export default function RutaCeroLearning() {
  const [searchParams] = useSearchParams();
  const linkedLesson = lessons.find(lesson => lesson.id === searchParams.get('clase'));
  const [access, setAccess] = useState<Access | null>(null);
  const [week, setWeek] = useState(linkedLesson?.week ?? 1);
  const [view, setView] = useState<'route' | 'review'>('route');
  const [reviews, setReviews] = useState<ReviewPage>({ progress: [], nextCursor: null });
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [loadingReviews, setLoadingReviews] = useState(false);

  async function refresh() {
    setAccess(await (await request('')).json() as Access);
  }
  async function loadReviews(cursor?: string) {
    setError('');
    setLoadingReviews(true);
    try {
      const page: ReviewPage = await (await request('/reviews' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''))).json();
      setReviews(previous => ({ ...page, progress: cursor ? [...previous.progress, ...page.progress] : page.progress }));
    } catch (error) { setError(message(error)); } finally { setLoadingReviews(false); }
  }
  useEffect(() => {
    let cancelled = false;
    request('').then(response => response.json() as Promise<Access>).then(data => {
      if (cancelled) return;
      setAccess(data);
      if (!data.student && data.reviewer) setView('review');
    }).catch(error => { if (!cancelled) setError(message(error)); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (access?.reviewer && view === 'review') void loadReviews(); }, [access?.reviewer, view]);

  if (!access) return <div className="mx-auto max-w-5xl px-4 py-10">
    <h1 className="text-2xl font-bold">Mi ruta</h1>
    <p className="mt-3 text-sys-text-sec" role={error ? 'alert' : 'status'}>{error || 'Cargando tu ruta…'}</p>
    {error && <Link className="mt-4 inline-block text-sys-accent underline" to="/crear-cuenta">Activar mi inscripción</Link>}
  </div>;
  const delivered = access.progress.filter(item => item.version > 0).length;
  const approved = access.progress.filter(item => item.status === 'approved').length;
  const selected = lessons.filter(lesson => lesson.week === week);
  const reviewItems = reviews.progress.filter(item => item.studentEmail.toLowerCase().includes(filter.toLowerCase().trim()));
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
    <p className="text-xs font-bold uppercase tracking-widest text-sys-accent">Programa de seis semanas</p>
    <h1 className="mb-2 mt-2 text-4xl font-bold">{view === 'route' ? 'Mi ruta' : 'Entregas y revisiones'}</h1>
    <p className="mb-5 text-sys-text-sec">{view === 'route' ? 'Registra lo que construyes en clase y entrega tus avances.' : 'Revisa los avances del grupo y devuelve comentarios a cada estudiante.'}</p>
    {access.student && access.reviewer && <div className="mb-5 flex gap-2">
      <button className={button} aria-pressed={view === 'route'} onClick={() => setView('route')}>Mi ruta</button>
      <button className={button} aria-pressed={view === 'review'} onClick={() => setView('review')}>Panel de profesores</button>
    </div>}
    {view === 'route' && access.student && <>
      <div className={panel}>
        <p className="font-semibold">{delivered} de {lessons.length} entregables enviados · {approved} aprobados</p>
        <progress className="mt-3 h-2 w-full accent-sys-accent" value={delivered} max={lessons.length} aria-label="Entregables enviados" />
      </div>
      <nav className="my-5 flex flex-wrap gap-2" aria-label="Semanas">
        {Array.from({ length: 6 }, (_, index) => index + 1).map(value => (
          <button key={value} className={button} aria-pressed={week === value} onClick={() => setWeek(value)}>Semana {value}</button>
        ))}
      </nav>
      <h2 className="mb-1 text-2xl font-bold">{selected[0].weekTitle}</h2>
      <p className="mb-4 text-sm text-sys-text-sec">Mentor: {selected[0].teacher}</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {selected.map(lesson => <ClassCard key={lesson.id} lesson={lesson} item={access.progress.find(item => item.lessonId === lesson.id)}
          filesEnabled={access.filesEnabled} refresh={refresh} selected={linkedLesson?.id === lesson.id} />)}
      </div>
    </>}
    {view === 'review' && access.reviewer && <div className="grid gap-4">
      {access.admin && <TeacherAccess />}
      <label className="grid max-w-md gap-1 text-sm">Buscar estudiante por correo
        <input className="input-geometric" value={filter} onChange={event => setFilter(event.target.value)} />
      </label>
      {loadingReviews && <p role="status">Cargando entregas…</p>}
      {error && <p role="alert" className="text-sys-error">{error}</p>}
      {!loadingReviews && !error && !reviewItems.length && <p className="text-sys-text-sec">No hay avances para mostrar.</p>}
      {reviewItems.map(item => <ReviewCard key={item.id + ':' + item.version} item={item} refresh={() => loadReviews()} />)}
      {reviews.nextCursor && <button className={button} disabled={loadingReviews} onClick={() => void loadReviews(reviews.nextCursor!)}>Cargar más</button>}
    </div>}
  </div>;
}
