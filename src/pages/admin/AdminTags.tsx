import React, { useState, useEffect } from 'react';
import { fetchTags, createTag, updateTag, deleteTag } from '../../lib/db';
import { useAuth } from '../../components/AuthProvider';
import { Plus, Pencil, Trash2, Check, X, Tag as TagIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = [
  { name: 'Rojo', value: 'red', bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30' },
  { name: 'Naranja', value: 'orange', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  { name: 'Ámbar', value: 'amber', bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30' },
  { name: 'Verde', value: 'green', bg: 'bg-green-500', text: 'text-green-400', border: 'border-green-500/30' },
  { name: 'Azul', value: 'blue', bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' },
  { name: 'Índigo', value: 'indigo', bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  { name: 'Violeta', value: 'violet', bg: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-500/30' },
  { name: 'Rosa', value: 'pink', bg: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500/30' }
];

export function getColorClasses(colorValue: string) {
  return COLORS.find(c => c.value === colorValue) || COLORS[2];
}

export default function AdminTags() {
  const { profile } = useAuth();
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('amber');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadTags = async () => {
    setLoading(true);
    const data = await fetchTags();
    setTags(data);
    setLoading(false);
  };

  useEffect(() => { loadTags(); }, []);

  const resetForm = () => {
    setName('');
    setColor('amber');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    if (editingId) {
      const ok = await updateTag(editingId, { name: trimmed, color });
      if (ok) {
        toast.success('Etiqueta actualizada');
        resetForm();
        loadTags();
      } else {
        toast.error('Error al actualizar');
      }
    } else {
      const id = await createTag({
        name: trimmed,
        color,
        createdBy: profile?.uid || 'unknown',
        createdByName: profile?.fullName || 'Admin'
      });
      if (id) {
        toast.success('Etiqueta creada');
        resetForm();
        loadTags();
      } else {
        toast.error('Error al crear');
      }
    }
    setSaving(false);
  };

  const startEdit = (tag: any) => {
    setEditingId(tag.id);
    setName(tag.name);
    setColor(tag.color);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteTag(id);
    if (ok) {
      toast.success('Etiqueta eliminada');
      setConfirmDelete(null);
      loadTags();
    } else {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-sans">Etiquetas</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-geometric-primary flex items-center gap-2">
            <Plus size={16} /> Nueva etiqueta
          </button>
        )}
      </div>

      {showForm && (
        <div className="card-geometric">
          <h2 className="text-lg font-bold mb-4">{editingId ? 'Editar etiqueta' : 'Nueva etiqueta'}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-sys-text-mut mb-2">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-sys-input border border-sys-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sys-accent"
                placeholder="Ej: Instagram Ads, Referido, LinkedIn"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-sys-text-mut mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={`w-10 h-10 rounded-sm ${c.bg} transition-all ${color === c.value ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                    title={c.name}
                  >
                    {color === c.value && <Check size={16} className="text-white mx-auto" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={resetForm} disabled={saving} className="btn-geometric-secondary disabled:opacity-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-geometric-primary disabled:opacity-50">
                {saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card-geometric">
        {loading ? (
          <p className="text-sm text-sys-text-mut">Cargando...</p>
        ) : tags.length === 0 ? (
          <div className="text-center py-8">
            <TagIcon size={32} className="text-sys-text-mut mx-auto mb-3" />
            <p className="text-sm text-sys-text-mut">Aún no hay etiquetas creadas.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => {
              const cc = getColorClasses(tag.color);
              return (
                <div key={tag.id} className="flex items-center justify-between p-3 bg-sys-input rounded-sm border border-sys-border">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-sm border ${cc.border} ${cc.text} text-xs font-bold`}>
                      <span className={`w-2 h-2 rounded-full ${cc.bg}`}></span>
                      {tag.name}
                    </span>
                    <span className="text-xs text-sys-text-mut">Creada por {tag.createdByName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {confirmDelete === tag.id ? (
                      <>
                        <span className="text-xs text-sys-text-mut">¿Eliminar?</span>
                        <button onClick={() => handleDelete(tag.id)} className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded-sm">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="p-1.5 text-sys-text-mut hover:text-white">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(tag)} className="p-2 text-sys-text-mut hover:text-sys-accent hover:bg-sys-accent/10 rounded-sm">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(tag.id)} className="p-2 text-sys-text-mut hover:text-red-500 hover:bg-red-500/10 rounded-sm">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
