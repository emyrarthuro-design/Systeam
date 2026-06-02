import React, { useState, useEffect } from 'react';
import { fetchClasses, createClass, updateClass, deleteClass } from '../../lib/db';
import { useAuth } from '../../components/AuthProvider';
import { Plus, Pencil, Trash2, Check, X, Video, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminClasses() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [classNumber, setClassNumber] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [moduleName, setModuleName] = useState('');

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadClasses = async () => {
    setLoading(true);
    const data = await fetchClasses();
    setClasses(data);
    setLoading(false);
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const resetForm = () => {
    setClassNumber('');
    setTitle('');
    setDescription('');
    setDriveUrl('');
    setModuleName('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (classNumber === '' || classNumber === null) {
      toast.error('El número de clase es obligatorio');
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('El título es obligatorio');
      return;
    }
    const trimmedUrl = driveUrl.trim();
    if (!trimmedUrl) {
      toast.error('El link de Google Drive es obligatorio');
      return;
    }

    setSaving(true);
    const classPayload = {
      classNumber: Number(classNumber),
      title: trimmedTitle,
      description: description.trim(),
      driveUrl: trimmedUrl,
      module: moduleName.trim()
    };

    if (editingId) {
      const ok = await updateClass(editingId, classPayload);
      if (ok) {
        toast.success('Clase actualizada');
        resetForm();
        loadClasses();
      } else {
        toast.error('Error al actualizar la clase');
      }
    } else {
      const id = await createClass({
        ...classPayload,
        createdBy: profile?.uid || 'unknown'
      });
      if (id) {
        toast.success('Clase creada');
        resetForm();
        loadClasses();
      } else {
        toast.error('Error al crear la clase');
      }
    }
    setSaving(false);
  };

  const startEdit = (cls: any) => {
    setEditingId(cls.id);
    setClassNumber(cls.classNumber);
    setTitle(cls.title);
    setDescription(cls.description || '');
    setDriveUrl(cls.driveUrl);
    setModuleName(cls.module || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteClass(id);
    if (ok) {
      toast.success('Clase eliminada');
      setConfirmDelete(null);
      loadClasses();
    } else {
      toast.error('Error al eliminar la clase');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-sans flex items-center gap-2">
          <Video className="text-sys-accent" size={24} /> Clases Grabadas
        </h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-geometric-primary flex items-center gap-2">
            <Plus size={16} /> Nueva clase
          </button>
        )}
      </div>

      {showForm && (
        <div className="card-geometric">
          <h2 className="text-lg font-bold mb-4">{editingId ? 'Editar clase' : 'Nueva clase'}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-sys-text-mut mb-2">Número de clase</label>
                <input
                  type="number"
                  value={classNumber}
                  onChange={e => setClassNumber(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-sys-input border border-sys-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sys-accent text-sys-text-main"
                  placeholder="Ej: 1"
                  min="1"
                  autoFocus
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase text-sys-text-mut mb-2">Módulo (Opcional)</label>
                <input
                  type="text"
                  value={moduleName}
                  onChange={e => setModuleName(e.target.value)}
                  className="w-full bg-sys-input border border-sys-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sys-accent text-sys-text-main"
                  placeholder="Ej: Módulo 1: Fundamentos"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-sys-text-mut mb-2">Título de la Clase</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-sys-input border border-sys-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sys-accent text-sys-text-main"
                placeholder="Ej: Introducción al programa y metodología"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-sys-text-mut mb-2">Descripción (Opcional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-sys-input border border-sys-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sys-accent min-h-[80px] text-sys-text-main"
                placeholder="Ej: En esta sesión revisamos las bases para configurar tu posicionamiento."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-sys-text-mut mb-2">Link de Google Drive</label>
              <input
                type="url"
                value={driveUrl}
                onChange={e => setDriveUrl(e.target.value)}
                className="w-full bg-sys-input border border-sys-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sys-accent text-sys-text-main"
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={resetForm} disabled={saving} className="btn-geometric-secondary disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-geometric-primary disabled:opacity-50">
                {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card-geometric">
        {loading ? (
          <p className="text-sm text-sys-text-mut">Cargando clases...</p>
        ) : classes.length === 0 ? (
          <div className="text-center py-8">
            <PlayCircle size={32} className="text-sys-text-mut mx-auto mb-3" />
            <p className="text-sm text-sys-text-mut">Aún no hay clases cargadas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map(cls => (
              <div key={cls.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-sys-input rounded-sm border border-sys-border gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-sys-accent/10 border border-sys-accent/30 text-sys-accent text-xs font-bold px-2.5 py-1 rounded-sm flex-shrink-0">
                    Clase {cls.classNumber}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-sys-text-main font-sans">{cls.title}</h4>
                      {cls.module && (
                        <span className="text-[10px] bg-sys-border border border-sys-border px-1.5 py-0.5 rounded-sm uppercase font-bold text-sys-text-mut">
                          {cls.module}
                        </span>
                      )}
                    </div>
                    {cls.description && (
                      <p className="text-xs text-sys-text-mut line-clamp-2 max-w-2xl">{cls.description}</p>
                    )}
                    <a
                      href={cls.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sys-accent hover:underline flex items-center gap-1 inline-flex mt-1"
                    >
                      <PlayCircle size={12} /> Ver en Google Drive
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {confirmDelete === cls.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-sys-text-mut mr-1">¿Eliminar?</span>
                      <button onClick={() => handleDelete(cls.id)} className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded-sm">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="p-1.5 text-sys-text-mut hover:text-white">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => startEdit(cls)} className="p-2 text-sys-text-mut hover:text-sys-accent hover:bg-sys-accent/10 rounded-sm transition-colors" title="Editar clase">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setConfirmDelete(cls.id)} className="p-2 text-sys-text-mut hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-colors" title="Eliminar clase">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
