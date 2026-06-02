export type UserRole = 'student' | 'admin' | 'super_admin';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  country: string;
  role: UserRole;
  createdAt: string;
  diagnosticStatus?: DiagnosisStatus;
  isSystemUser?: boolean;
  tagId?: string | null;
}

export type DiagnosisStatus = 'pending' | 'in_progress' | 'not_started' | 'completed';

export interface Diagnosis {
  uid: string; // Updated from studentId to follow localStorage standard more easily
  status: DiagnosisStatus;
  currentBlock: number;
  answers: Record<string, any>;
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  startedAt?: string;
  userName?: string;
  userEmail?: string;
  analysis?: DiagnosisAnalysis;
  internalNote?: InternalNote;
}

export interface DiagnosisAnalysis {
  perfil_predominante: string;
  perfil_secundario: string;
  afinidad_predominante: number;
  razonamiento: {
    diagnostico_central: string;
    evidencias: { observacion: string; cita_alumno: string; bloque: number }[];
    contradicciones: string[];
    por_que_este_perfil_y_no_otro: string;
  };
  variables_scores: {
    AE: number;
    SE: number;
    CI: number;
    CA: number;
    CO: number;
    CC: number;
    SV: number;
    ES: number;
  };
  bloqueo_principal: string;
  oportunidad_principal: string;
  creencia_limitante_principal: string;
  prioridad_incubadora: string;
  primera_accion_sugerida: string;
  recomendaciones: string[];
  devolucion_personalizada: string;
}

export interface InternalNote {
  observaciones_crudas: string;
  banderas_rojas: string[];
  contradicciones_detectadas: string[];
  nivel_honestidad_percibida: string;
  urgencia_intervencion: string;
  enfoque_mentoria_primera_sesion: string;
  preguntas_para_indagar: string[];
}

export interface Invitation {
  id?: string;
  code: string;
  email: string;
  fullName: string;
  country: string;
  whatsapp?: string | null;
  status: 'pending' | 'activated' | 'expired';
  createdAt: string;
  createdBy: string;
  activatedAt: string | null;
  internalNotes: string;
  expiresAt: string;
  lastSentAt?: string | null;
  sentChannel?: 'whatsapp' | 'gmail' | 'manual' | null;
  isAdminInvite?: boolean;
}

export interface DiagnosisQuestion {
  id: string;
  label: string;
  type: 'text' | 'select' | 'scale';
  options?: string[];
  multiple?: boolean;
  condition?: {
    field: string;
    value: string | string[];
  };
}

export interface DiagnosisBlock {
  id: number;
  title: string;
  type: 'welcome' | 'questions';
  questions: DiagnosisQuestion[];
}


export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export interface ActivityLog {
  id?: string;
  timestamp: string;
  action: string; // e.g. 'delete_student', 'change_role'
  executorId: string;
  executorName: string;
  executorEmail: string;
  targetId?: string;
  targetEmail?: string;
  targetName?: string;
  details?: Record<string, any>;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface MentorClass {
  id: string;
  classNumber: number;
  title: string;
  description?: string;
  driveUrl: string;
  module?: string;
  createdAt: string;
  createdBy: string;
}


