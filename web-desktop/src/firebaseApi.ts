import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  type Transaction
} from "firebase/firestore";
import type { FirebaseServices } from "./firebase";
import type { ExercisePlan, ProgressRecord, WorkoutPlan } from "./types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const MIN_CARDIO_MINUTES = 1;
export const MAX_CARDIO_MINUTES = 2_147_483_647;

export function safeDocId(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "") || "treino_sem_nome"
  );
}

export function newId(prefix = "") {
  const cryptoId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}${cryptoId}`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function parsePositiveWholeMinutes(value: unknown): number | null {
  const parsed = typeof value === "number"
    ? value
    : Number(String(value ?? "").trim().replace(",", "."));

  if (!Number.isSafeInteger(parsed) || parsed < MIN_CARDIO_MINUTES || parsed > MAX_CARDIO_MINUTES) {
    return null;
  }

  return parsed;
}

/**
 * Persists the cardio goal in both locations consumed by the Android and web
 * clients. The batch keeps the two documents in sync when the Firestore rules
 * allow both writes; the individual fallback preserves compatibility with
 * deployments that only allow one of the legacy paths.
 */
export async function saveCardioGoal(
  services: FirebaseServices,
  targetUid: string,
  goalMinutes: number,
  updatedBy?: string | null
) {
  const value = parsePositiveWholeMinutes(goalMinutes);
  if (value === null) {
    throw new Error("Informe uma meta semanal válida em minutos.");
  }

  const now = Date.now();
  const rootRef = doc(services.db, "users", targetUid);
  const configRef = doc(services.db, "users", targetUid, "cardio_meta", "current");
  const rootPayload = {
    cardioMetaSemanalMin: value,
    metaSemanalCardioMin: value,
    cardioGoalMin: value,
    updatedAt: now
  };
  const configPayload = {
    ...rootPayload,
    ...(updatedBy ? { updatedBy } : {})
  };

  const batch = writeBatch(services.db);
  batch.set(rootRef, rootPayload, { merge: true });
  batch.set(configRef, configPayload, { merge: true });

  try {
    await batch.commit();
    return value;
  } catch (batchError) {
    // Older Firestore rules in the wild may allow only one of the two paths.
    // Keep the canonical write usable there while readers select the newest
    // document by updatedAt.
    const errors: unknown[] = [batchError];
    let persisted = false;

    try {
      await updateDoc(rootRef, rootPayload);
      persisted = true;
    } catch (error) {
      errors.push(error);
    }

    try {
      await setDoc(configRef, configPayload, { merge: true });
      persisted = true;
    } catch (error) {
      errors.push(error);
    }

    if (persisted) return value;
    throw errors[errors.length - 1] ?? batchError;
  }
}

export function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mapWorkoutDoc(id: string, data: Record<string, unknown>): WorkoutPlan {
  const exercises = Array.isArray(data.exercicios) ? data.exercicios : [];

  return {
    id,
    nome: String(data.nome ?? "Treino"),
    ordem: Number(data.ordem ?? 9999),
    exercicios: exercises.map((item) => {
      const ex = item as Record<string, unknown>;
      return {
        nome: String(ex.nome ?? "Exercício"),
        series: Number(ex.series ?? 0),
        repsMin: Number(ex.repsMin ?? 0),
        repsMax: Number(ex.repsMax ?? 0),
        descanso: String(ex.descanso ?? "-"),
        tecnica: String(ex.tecnica ?? "-"),
        rir: String(ex.rir ?? "-")
      };
    })
  };
}

export function workoutPayload(
  plan: WorkoutPlan,
  targetUid: string,
  createdBy: string,
  createdAt = Date.now()
) {
  return {
    nome: plan.nome,
    ordem: plan.ordem ?? 0,
    exercicios: plan.exercicios.map((ex: ExercisePlan) => ({
      nome: ex.nome,
      series: Number(ex.series || 0),
      repsMin: Number(ex.repsMin || 0),
      repsMax: Number(ex.repsMax || 0),
      descanso: ex.descanso || "-",
      tecnica: ex.tecnica || "-",
      rir: ex.rir || "-"
    })),
    assignedTo: targetUid,
    createdBy,
    createdAt,
    updatedAt: Date.now()
  };
}

function addWorkoutNotificationToTransaction(
  tx: Transaction,
  services: FirebaseServices,
  targetUid: string,
  currentUid: string,
  message: string,
  now: number
) {
  const noteRef = doc(collection(services.db, "users", targetUid, "notifications"));
  const profileRef = doc(services.db, "users", targetUid);

  tx.set(noteRef, {
    type: "TREINO_ATUALIZADO",
    message,
    read: false,
    createdAt: now,
    fromUid: currentUid
  });
  tx.set(
    profileRef,
    {
      lastWorkoutUpdateAt: now,
      lastWorkoutUpdateMessage: message,
      updatedAt: now
    },
    { merge: true }
  );
}

export async function saveWorkoutPlan(
  services: FirebaseServices,
  targetUid: string,
  currentUid: string,
  plan: WorkoutPlan,
  previousWorkoutId?: string
) {
  const nextWorkoutId = safeDocId(plan.nome);
  const previousId = previousWorkoutId?.trim() || null;
  const nextRef = doc(services.db, "users", targetUid, "treinos", nextWorkoutId);
  const now = Date.now();

  await runTransaction(services.db, async (tx) => {
    let previousName: string | null = null;
    let createdAt = now;

    if (previousId) {
      const previousRef = doc(services.db, "users", targetUid, "treinos", previousId);
      const previousSnap = await tx.get(previousRef);
      if (!previousSnap.exists()) throw new Error("O treino original não foi encontrado.");

      const previousData = previousSnap.data();
      previousName = String(previousData.nome ?? plan.nome);
      const storedCreatedAt = Number(previousData.createdAt);
      if (Number.isFinite(storedCreatedAt) && storedCreatedAt > 0) createdAt = storedCreatedAt;

      if (previousId !== nextWorkoutId) {
        const collisionSnap = await tx.get(nextRef);
        if (collisionSnap.exists()) throw new Error("Já existe outro treino com esse nome.");
      }
    } else {
      const existingSnap = await tx.get(nextRef);
      if (existingSnap.exists()) throw new Error("Já existe outro treino com esse nome.");
    }

    const payload = workoutPayload(plan, targetUid, currentUid, createdAt);
    if (previousId === nextWorkoutId) {
      tx.set(nextRef, payload, { merge: true });
    } else {
      tx.set(nextRef, payload);
    }

    if (previousId && previousId !== nextWorkoutId) {
      tx.delete(doc(services.db, "users", targetUid, "treinos", previousId));
    }

    if (targetUid !== currentUid) {
      const message = !previousId
        ? `Seu treinador adicionou o treino "${plan.nome}".`
        : previousName && previousName !== plan.nome
          ? `Seu treinador renomeou o treino "${previousName}" para "${plan.nome}".`
          : `Seu treinador atualizou o treino "${plan.nome}". Confira as mudanças.`;
      addWorkoutNotificationToTransaction(tx, services, targetUid, currentUid, message, now);
    }
  });

  return nextWorkoutId;
}

export async function updateWorkoutOrder(
  services: FirebaseServices,
  targetUid: string,
  currentUid: string,
  workouts: WorkoutPlan[]
) {
  if (workouts.length === 0) return;

  const now = Date.now();
  const batch = writeBatch(services.db);
  workouts.forEach((workout, index) => {
    batch.set(
      doc(services.db, "users", targetUid, "treinos", workout.id),
      { ordem: index, updatedAt: now },
      { merge: true }
    );
  });

  if (targetUid !== currentUid) {
    const message = "Seu treinador reorganizou a ordem dos seus treinos.";
    const noteRef = doc(collection(services.db, "users", targetUid, "notifications"));
    batch.set(noteRef, {
      type: "TREINO_ATUALIZADO",
      message,
      read: false,
      createdAt: now,
      fromUid: currentUid
    });
    batch.set(
      doc(services.db, "users", targetUid),
      {
        lastWorkoutUpdateAt: now,
        lastWorkoutUpdateMessage: message,
        updatedAt: now
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function deleteWorkoutPlan(
  services: FirebaseServices,
  targetUid: string,
  currentUid: string,
  workoutName: string
) {
  await deleteDoc(doc(services.db, "users", targetUid, "treinos", safeDocId(workoutName)));

  if (targetUid !== currentUid) {
    await registerWorkoutNotification(
      services,
      targetUid,
      currentUid,
      `Seu treinador removeu o treino "${workoutName}".`
    );
  }
}

export async function registerWorkoutNotification(
  services: FirebaseServices,
  targetUid: string,
  currentUid: string,
  message: string
) {
  const now = Date.now();
  const base = doc(services.db, "users", targetUid);
  const noteRef = doc(collection(services.db, "users", targetUid, "notifications"));

  const batch = writeBatch(services.db);
  batch.set(noteRef, {
    type: "TREINO_ATUALIZADO",
    message,
    read: false,
    createdAt: now,
    fromUid: currentUid
  });
  batch.set(
    base,
    {
      lastWorkoutUpdateAt: now,
      lastWorkoutUpdateMessage: message,
      updatedAt: now
    },
    { merge: true }
  );
  await batch.commit();
}

export async function redeemInviteCode(services: FirebaseServices, codeRaw: string, uid: string) {
  const code = codeRaw.trim().toUpperCase();
  const inviteRef = doc(services.db, "invites", code);
  let trainerUidForLink: string | null = null;

  const type = await runTransaction(services.db, async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error("Código não existe.");

    const invite = inviteSnap.data();
    if (invite.usedAt) throw new Error("Código já foi usado.");

    const inviteType = String(invite.type ?? "");
    const userRef = doc(services.db, "users", uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("Perfil do usuário não existe.");

    const userRole = String(userSnap.data().role ?? "").trim().toUpperCase();

    if (inviteType === "TREINADOR") {
      if (userRole !== "TREINADOR") throw new Error("Este código é para TREINADOR.");
      tx.update(userRef, { approved: true });
    } else if (inviteType === "ALUNO") {
      if (userRole !== "ALUNO") throw new Error("Este código é para ALUNO.");
      const trainerUid = String(invite.trainerUid ?? "");
      if (!trainerUid) throw new Error("Convite de aluno sem treinador.");
      trainerUidForLink = trainerUid;
      tx.update(userRef, {
        approved: true,
        trainerId: trainerUid
      });
    } else {
      throw new Error("Tipo de convite desconhecido.");
    }

    tx.update(inviteRef, {
      usedAt: Date.now(),
      usedByUid: uid
    });

    return inviteType;
  });

  if (type === "ALUNO" && trainerUidForLink) {
    const userSnap = await getDoc(doc(services.db, "users", uid));
    const user = userSnap.data() ?? {};
    await setDoc(doc(services.db, "trainers", trainerUidForLink, "students", uid), {
      uid,
      name: user.name ?? "Sem nome",
      email: user.email ?? "Sem email",
      active: user.active ?? true,
      approved: user.approved ?? true,
      linkedAt: Date.now()
    });
  }

  return type;
}

function generateCode(size = 6) {
  return Array.from({ length: size }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}

export async function createInviteCode(
  services: FirebaseServices,
  type: "TREINADOR" | "ALUNO",
  adminUid: string,
  trainerUid: string | null
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateCode();
    const ref = doc(services.db, "invites", code);

    try {
      await runTransaction(services.db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) throw new Error("COLLISION");
        tx.set(ref, {
          type,
          trainerUid,
          createdBy: adminUid,
          createdAt: Date.now(),
          usedAt: null,
          usedByUid: null
        });
      });
      return code;
    } catch (error) {
      if ((error as Error).message !== "COLLISION") throw error;
    }
  }

  throw new Error("Não foi possível gerar um código livre.");
}

export async function approveInviteRequest(
  services: FirebaseServices,
  requestId: string,
  trainerUid: string,
  qty: number,
  adminUid: string
) {
  const codes: string[] = [];
  for (let index = 0; index < qty; index += 1) {
    codes.push(await createInviteCode(services, "ALUNO", adminUid, trainerUid));
  }

  const batch = writeBatch(services.db);
  const reqRef = doc(services.db, "invite_requests", requestId);
  batch.update(reqRef, {
    status: "APPROVED",
    reviewedAt: Date.now(),
    reviewedBy: adminUid
  });
  codes.forEach((code) => {
    batch.set(doc(services.db, "invite_requests", requestId, "codes", code), {
      code,
      createdAt: Date.now()
    });
  });
  await batch.commit();
  return codes;
}

export async function rejectInviteRequest(services: FirebaseServices, requestId: string, adminUid: string) {
  await updateDoc(doc(services.db, "invite_requests", requestId), {
    status: "REJECTED",
    reviewedAt: Date.now(),
    reviewedBy: adminUid
  });
}

export function progressFromDoc(id: string, data: Record<string, unknown>): ProgressRecord {
  return {
    id: String(data.id ?? id),
    data: String(data.data ?? "-"),
    pesoKg: Number(data.pesoKg ?? 0),
    fotoFrenteUri: typeof data.fotoFrenteUri === "string" ? data.fotoFrenteUri : null,
    fotoLadoUri: typeof data.fotoLadoUri === "string" ? data.fotoLadoUri : null,
    fotoCostasUri: typeof data.fotoCostasUri === "string" ? data.fotoCostasUri : null,
    createdAt: Number(data.createdAt ?? 0)
  };
}
