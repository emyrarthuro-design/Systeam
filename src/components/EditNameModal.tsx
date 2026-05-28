import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface EditNameModalProps {
  userId: string;
  currentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (newName: string) => void;
}

export default function EditNameModal({ userId, currentName, isOpen, onClose, onSaved }: EditNameModalProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(currentName);
  }, [currentName, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    if (trimmed === currentName.trim()) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), { fullName: trimmed });
      const diagRef = doc(db, 'diagnostics', userId);
      const diagSnap = await getDoc(diagRef);
      if (diagSnap.exists()) {
        await updateDoc(diagRef, { userName: trimmed });
      }
      toast.success('Nombre actualizado');
      onSaved(trimmed);
      onClose();
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error updating name:', err);
      toast.error('Error al actualizar el nombre');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-sys-bg border border-sys-border rounded-sm p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Editar nombre completo</h2>
          <button onClick={onClose} className="text-sys-text-mut hover:text-white">
            <X size={18} />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-sys-input border border-sys-border rounded-sm px-3 py-2 text-sm mb-6 focus:outline-none focus:border-sys-accent"
          placeholder="Nombre completo"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-geometric-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-geometric-primary disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
