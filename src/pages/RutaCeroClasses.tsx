import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { lessons } from '../rutaCeroCurriculum';
import { learningRequest } from '../lib/rutaCeroLearning';

type Library = { videos: Record<string, string>; admin: boolean; student: boolean };
const button = 'btn-geometric-secondary disabled:opacity-50';
const youtubeLink = (id: string) => 'https://www.youtube.com/watch?v=' + id;
const lessonDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const weekStarts = lessons.filter(lesson => lesson.day === 1);

function VideoEditor({ lessonId, videoId, onSave }: {
  lessonId: string; videoId?: string; onSave: (id: string | null) => void;
}) {
  const [url, setUrl] = useState(videoId ? youtubeLink(videoId) : '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function save(value: string | null) {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await learningRequest('/recordings/' + lessonId, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: value })
      });
      const { videoId: nextId }: { videoId: string | null } = await result.json();
      setUrl(nextId ? youtubeLink(nextId) : '');
      onSave(nextId);
      setNotice(nextId ? 'Video publicado.' : 'Video retirado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el video.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (url.trim()) void save(url.trim());
  }

  return <form onSubmit={submit} className="mt-5 border-t border-sys-border pt-4">
    <label className="grid gap-1 text-sm">Enlace de YouTube
      <input type="url" value={url} onChange={event => setUrl(event.target.value)} required maxLength={2048}
        placeholder="https://www.youtube.com/watch?v=..." className="input-geometric" />
    </label>
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="btn-geometric-primary" disabled={busy || !url.trim()}>{videoId ? 'Actualizar enlace' : 'Publicar video'}</button>
      {videoId && <button type="button" className={button} disabled={busy} onClick={() => void save(null)}>Retirar video</button>}
    </div>
    {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-sys-error">{error}</p>}
  </form>;
}

export default function RutaCeroClasses() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(lessons[0].id);

  useEffect(() => {
    const controller = new AbortController();
    learningRequest('/recordings', { signal: controller.signal })
      .then(response => response.json() as Promise<Library>)
      .then(data => { if (!controller.signal.aborted) setLibrary(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);

  const selected = lessons.find(lesson => lesson.id === selectedId) ?? lessons[0];
  const weekLessons = lessons.filter(lesson => lesson.week === selected.week);
  const videoId = library?.videos[selected.id];

  function saveVideo(id: string | null) {
    setLibrary(current => {
      if (!current) return current;
      const videos = { ...current.videos };
      if (id) videos[selected.id] = id;
      else delete videos[selected.id];
      return { ...current, videos };
    });
  }

  return <section className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
    <p className="text-xs font-bold uppercase tracking-widest text-sys-accent">Programa de seis semanas</p>
    <h1 className="mb-2 mt-2 text-4xl font-bold">Clases de Ruta Cero</h1>
    <p className="mb-5 text-sys-text-sec">Encuentra las clases de cada semana y mira los videos cuando estén disponibles.</p>
    {!library ? <p role={error ? 'alert' : 'status'}>{error || 'Cargando clases…'}</p> : <>
      <nav className="my-5 flex flex-wrap gap-2" aria-label="Semanas de clases">
        {weekStarts.map(lesson =>
          <button key={lesson.week} className={button} aria-pressed={selected.week === lesson.week}
            onClick={() => setSelectedId(lesson.id)}>Semana {lesson.week}</button>
        )}
      </nav>
      <h2 className="mb-3 text-xl font-bold">{selected.weekTitle}</h2>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="min-w-0 rounded-2xl border border-sys-border bg-sys-card p-4 sm:p-5">
          <p className="text-sm text-sys-text-sec">{lessonDate.format(new Date(selected.date))} · {selected.teacher}</p>
          <h3 className="mb-3 mt-1 text-2xl font-bold">{selected.title}</h3>
          {videoId ?
            <iframe key={videoId} title={selected.title} src={'https://www.youtube.com/embed/' + videoId + '?playsinline=1'}
              className="aspect-video min-h-[200px] w-full rounded-xl border-0" referrerPolicy="strict-origin-when-cross-origin"
              allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            : <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed border-sys-border bg-sys-bg p-5 text-center text-sys-text-sec">
              El video de esta clase aún no está publicado.
            </div>}
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            {videoId && <a className="text-sys-accent underline" href={youtubeLink(videoId)} target="_blank" rel="noreferrer">Abrir en YouTube</a>}
            {library.student && <Link className="text-sys-accent underline" to={'/?clase=' + selected.id}>Ir a la actividad</Link>}
          </div>
          {library.admin && <VideoEditor key={selected.id} lessonId={selected.id} videoId={videoId} onSave={saveVideo} />}
        </article>
        <nav aria-label="Clases de la semana" className="grid gap-2">
          {weekLessons.map(lesson => <button key={lesson.id} aria-pressed={selected.id === lesson.id}
            className={button + ' w-full text-left'} onClick={() => setSelectedId(lesson.id)}>
            <span className="block">{lesson.title}</span>
            <span className="block text-xs text-sys-text-sec">{library.videos[lesson.id] ? 'Disponible' : 'Por publicar'}</span>
          </button>)}
        </nav>
      </div>
    </>}
  </section>;
}
