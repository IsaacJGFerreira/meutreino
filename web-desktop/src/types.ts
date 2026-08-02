export type Role = "ALUNO" | "TREINADOR" | "ADMIN";

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  approved: boolean;
  trainerId?: string | null;
  idade?: number;
  alturaCm?: number;
  pesoKg?: number;
  createdAt?: number;
  cardioMetaSemanalMin?: number;
};

export type ExercisePlan = {
  nome: string;
  series: number;
  repsMin: number;
  repsMax: number;
  descanso: string;
  tecnica: string;
  rir: string;
};

export type WorkoutPlan = {
  id: string;
  nome: string;
  ordem: number;
  exercicios: ExercisePlan[];
};

export type SeriesRecord = {
  serieNumero: number;
  kg: number;
  reps: number;
};

export type ExerciseRecord = {
  nomeExercicio: string;
  series: SeriesRecord[];
};

export type WorkoutRecord = {
  id: string;
  idLocal: string;
  dataHora: string;
  nomeTreino: string;
  completo: boolean;
  createdAt: number;
  duracaoSegundos: number;
  exercicios: ExerciseRecord[];
};

export type ProgressRecord = {
  id: string;
  data: string;
  pesoKg: number;
  fotoFrenteUri?: string | null;
  fotoLadoUri?: string | null;
  fotoCostasUri?: string | null;
  createdAt: number;
};

export type CardioRecord = {
  id: string;
  dataHora: string;
  atividade: string;
  tempoMin: number;
  ritmo: string;
  createdAt: number;
};

export type TrainerStudent = {
  uid: string;
  name: string;
  email: string;
};

export type InviteRequest = {
  id: string;
  trainerUid: string;
  trainerName: string;
  qty: number;
  status: string;
  createdAt: number;
};

export type NotificationItem = {
  id: string;
  message: string;
  read: boolean;
  createdAt: number;
};
