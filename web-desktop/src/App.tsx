import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock3,
  Dumbbell,
  LogOut,
  Menu,
  Plus,
  RefreshCcw,
  Save,
  Settings,
  ShieldCheck,
  SquarePen,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  X
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  clearSavedConfig,
  initFirebase,
  readInitialConfig,
  saveConfig,
  type FirebaseServices,
  type WebFirebaseConfig
} from "./firebase";
import {
  approveInviteRequest,
  createInviteCode,
  deleteWorkoutPlan,
  formatDate,
  formatDateTime,
  mapWorkoutDoc,
  newId,
  parsePositiveWholeMinutes,
  parseNumber,
  progressFromDoc,
  redeemInviteCode,
  rejectInviteRequest,
  safeDocId,
  saveCardioGoal as saveCardioGoalInFirestore,
  saveWorkoutPlan,
  updateWorkoutOrder
} from "./firebaseApi";
import type {
  CardioRecord,
  ExercisePlan,
  ExerciseRecord,
  InviteRequest,
  NotificationItem,
  ProgressRecord,
  Role,
  TrainerStudent,
  UserProfile,
  WorkoutPlan,
  WorkoutRecord
} from "./types";

type TabKey = "perfil" | "treino" | "desempenho" | "montar" | "cardio" | "progresso" | "admin";

type Notice = {
  kind: "ok" | "warn" | "error";
  text: string;
};

function firebaseErrorMessage(error: unknown, fallback: string) {
  const data = error as { code?: unknown; message?: unknown };
  const code = typeof data?.code === "string" ? data.code : "";
  const message = typeof data?.message === "string" ? data.message : "";
  const host = window.location.hostname;

  switch (code) {
    case "auth/unauthorized-domain":
      return `O Firebase recusou este endereço (${host}). Adicione ${host} em Firebase Authentication > Settings > Authorized domains.`;
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "A chave apiKey do Firebase Web não é válida para este projeto.";
    case "auth/configuration-not-found":
      return "A configuração do Firebase Auth não foi encontrada. Confira se Email/Senha está ativado no Firebase Authentication.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email ou senha inválidos.";
    case "auth/email-already-in-use":
      return "Este email já está cadastrado. Use Entrar.";
    case "auth/invalid-email":
      return "Email inválido.";
    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    case "auth/network-request-failed":
      return "Falha de conexão com o Firebase. Verifique a internet e tente novamente.";
    case "permission-denied":
      return "O Firebase bloqueou o acesso aos dados. Confira as regras do Firestore para usuários autenticados.";
    case "failed-precondition":
      return "O Firestore pediu uma configuração extra para esta consulta. Abra o console do navegador para ver o link de criação do índice.";
    default:
      return message || fallback;
  }
}

const SELECTED_STUDENT_KEY = "meutreino.selectedStudent";
const emptyExercise: ExercisePlan = {
  nome: "",
  series: 3,
  repsMin: 8,
  repsMax: 12,
  descanso: "60s",
  tecnica: "-",
  rir: "-"
};

function normalizeRole(value: unknown): Role {
  const role = String(value ?? "ALUNO").toUpperCase();
  if (role === "TREINADOR" || role === "ADMIN") return role;
  return "ALUNO";
}

function profileFromDoc(uid: string, data: DocumentData | undefined, fallbackEmail = ""): UserProfile {
  const rawCreatedAt = data?.createdAt;
  const createdAt = typeof rawCreatedAt === "number"
    ? rawCreatedAt
    : typeof rawCreatedAt?.toMillis === "function"
      ? rawCreatedAt.toMillis()
      : typeof rawCreatedAt?.seconds === "number"
        ? rawCreatedAt.seconds * 1000
        : undefined;

  return {
    uid,
    name: String(data?.name ?? "Sem nome"),
    email: String(data?.email ?? fallbackEmail),
    role: normalizeRole(data?.role),
    active: Boolean(data?.active ?? true),
    approved: Boolean(data?.approved ?? false),
    trainerId: typeof data?.trainerId === "string" ? data.trainerId : null,
    idade: typeof data?.idade === "number" ? data.idade : undefined,
    alturaCm: typeof data?.alturaCm === "number" ? data.alturaCm : undefined,
    pesoKg: typeof data?.pesoKg === "number" ? data.pesoKg : undefined,
    createdAt,
    cardioMetaSemanalMin: Number(data?.cardioMetaSemanalMin ?? data?.metaSemanalCardioMin ?? data?.cardioGoalMin ?? 180)
  };
}

function workoutRecordFromDoc(id: string, data: DocumentData): WorkoutRecord {
  const rawExercises = Array.isArray(data.exercicios) ? data.exercicios : [];
  return {
    id,
    idLocal: String(data.idLocal ?? id),
    dataHora: String(data.dataHora ?? "-"),
    nomeTreino: String(data.nomeTreino ?? "Treino"),
    completo: Boolean(data.completo ?? false),
    createdAt: Number(data.createdAt ?? 0),
    duracaoSegundos: Number(data.duracaoSegundos ?? 0),
    exercicios: rawExercises.map((item: unknown) => {
      const ex = item as Record<string, unknown>;
      const seriesRaw = Array.isArray(ex.series) ? ex.series : [];
      return {
        nomeExercicio: String(ex.nomeExercicio ?? "Exercício"),
        series: seriesRaw.map((serie: unknown) => {
          const current = serie as Record<string, unknown>;
          return {
            serieNumero: Number(current.serieNumero ?? 0),
            kg: Number(current.kg ?? 0),
            reps: Number(current.reps ?? 0)
          };
        })
      };
    })
  };
}

function workoutRecordTime(record: WorkoutRecord) {
  if (Number.isFinite(record.createdAt) && record.createdAt > 0) return record.createdAt;
  return parsePtBrDate(record.dataHora)?.getTime() ?? 0;
}

function cardioFromDoc(id: string, data: DocumentData): CardioRecord {
  return {
    id: String(data.id ?? id),
    dataHora: String(data.dataHora ?? "-"),
    atividade: String(data.atividade ?? "Cardio"),
    tempoMin: Number(data.tempoMin ?? 0),
    ritmo: String(data.ritmo ?? "-"),
    createdAt: Number(data.createdAt ?? 0)
  };
}

function notificationFromDoc(id: string, data: DocumentData): NotificationItem {
  return {
    id,
    message: String(data.message ?? "Seu treino foi atualizado."),
    read: Boolean(data.read ?? false),
    createdAt: Number(data.createdAt ?? 0)
  };
}

function inviteRequestFromDoc(id: string, data: DocumentData): InviteRequest {
  return {
    id,
    trainerUid: String(data.trainerUid ?? ""),
    trainerName: String(data.trainerName ?? "Sem nome"),
    qty: Number(data.qty ?? 0),
    status: String(data.status ?? "PENDING"),
    createdAt: Number(data.createdAt ?? 0)
  };
}

function volumeForRecord(record: WorkoutRecord) {
  return record.exercicios.reduce(
    (total, ex) => total + ex.series.reduce((sum, serie) => sum + serie.kg * serie.reps, 0),
    0
  );
}

function formatWorkoutDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}

function readSelectedStudent(): TrainerStudent | null {
  const raw = localStorage.getItem(SELECTED_STUDENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TrainerStudent;
    return parsed.uid ? parsed : null;
  } catch {
    return null;
  }
}

function App() {
  const [services, setServices] = useState<FirebaseServices | null>(() => {
    const config = readInitialConfig();
    return config ? initFirebase(config) : null;
  });
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<TabKey>("perfil");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<TrainerStudent | null>(() => readSelectedStudent());
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [records, setRecords] = useState<WorkoutRecord[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [cardio, setCardio] = useState<CardioRecord[]>([]);
  const [students, setStudents] = useState<TrainerStudent[]>([]);
  const [inviteCodes, setInviteCodes] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [inviteRequests, setInviteRequests] = useState<InviteRequest[]>([]);
  const [busy, setBusy] = useState(false);

  function notify(kind: Notice["kind"], text: string) {
    setNotice({ kind, text });
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!services) {
      setAuthReady(true);
      return;
    }

    setAuthReady(false);
    return onAuthStateChanged(services.auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
  }, [services]);

  useEffect(() => {
    if (!services || !authUser) {
      setProfile(null);
      return;
    }

    return onSnapshot(
      doc(services.db, "users", authUser.uid),
      (snap) => {
        setProfile(profileFromDoc(authUser.uid, snap.data(), authUser.email ?? ""));
      },
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar perfil."))
    );
  }, [services, authUser]);

  useEffect(() => {
    if (!profile) return;
    setTab(profile.role === "ADMIN" ? "admin" : "perfil");
    if (profile.role !== "TREINADOR") {
      setSelectedStudent(null);
      localStorage.removeItem(SELECTED_STUDENT_KEY);
    }
  }, [profile?.uid, profile?.role]);

  const target = useMemo(() => {
    if (!profile) return null;
    if (profile.role === "ALUNO") return { uid: profile.uid, name: profile.name };
    if (profile.role === "TREINADOR" && selectedStudent) return selectedStudent;
    return null;
  }, [profile, selectedStudent]);

  useEffect(() => {
    if (!services || !target?.uid) {
      setWorkouts([]);
      setRecords([]);
      setProgress([]);
      setCardio([]);
      return;
    }

    const unsubs = [
      onSnapshot(
        collection(services.db, "users", target.uid, "treinos"),
        (snap) => {
          const list = snap.docs
            .map((item) => mapWorkoutDoc(item.id, item.data()))
            .sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome));
          setWorkouts(list);
        },
        (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar treinos."))
      ),
      onSnapshot(
        collection(services.db, "users", target.uid, "treino_registros"),
        (snap) => {
          setRecords(
            snap.docs
              .map((item) => workoutRecordFromDoc(item.id, item.data()))
              .sort((a, b) => workoutRecordTime(b) - workoutRecordTime(a))
          );
        },
        (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar desempenho."))
      ),
      onSnapshot(
        query(collection(services.db, "users", target.uid, "progresso"), orderBy("createdAt", "desc")),
        (snap) => {
          setProgress(snap.docs.map((item) => progressFromDoc(item.id, item.data())));
        },
        (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar progresso."))
      ),
      onSnapshot(
        collection(services.db, "users", target.uid, "cardio"),
        (snap) => {
          setCardio(
            snap.docs
              .map((item) => cardioFromDoc(item.id, item.data()))
              .sort((a, b) => formatCardioRecordTime(b) - formatCardioRecordTime(a))
          );
        },
        (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar cardio."))
      )
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [services, target?.uid]);

  useEffect(() => {
    if (!services || !profile || profile.role !== "TREINADOR") {
      setStudents([]);
      setInviteCodes([]);
      return;
    }

    const studentsQuery = query(collection(services.db, "users"), where("trainerId", "==", profile.uid));
    const codesQuery = query(collection(services.db, "invites"), where("type", "==", "ALUNO"), where("trainerUid", "==", profile.uid));

    const unsubscribeStudents = onSnapshot(
      studentsQuery,
      (snap) => {
        setStudents(
          snap.docs
            .map((item) => ({
              uid: item.id,
              name: String(item.data().name ?? "Sem nome"),
              email: String(item.data().email ?? "Sem email")
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      },
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar alunos."))
    );

    const unsubscribeCodes = onSnapshot(
      codesQuery,
      (snap) => {
        const available = snap.docs
          .filter((item) => {
            const data = item.data();
            return !data.usedAt && !data.usedByUid;
          })
          .map((item) => item.id)
          .sort();
        setInviteCodes(available);
      },
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar códigos."))
    );

    return () => {
      unsubscribeStudents();
      unsubscribeCodes();
    };
  }, [services, profile?.uid, profile?.role]);

  useEffect(() => {
    if (!services || !profile || profile.role !== "ALUNO") {
      setNotifications([]);
      return;
    }

    return onSnapshot(
      query(collection(services.db, "users", profile.uid, "notifications"), orderBy("createdAt", "desc")),
      (snap) => setNotifications(snap.docs.map((item) => notificationFromDoc(item.id, item.data()))),
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar notificações."))
    );
  }, [services, profile?.uid, profile?.role]);

  useEffect(() => {
    if (!services || profile?.role !== "ADMIN") {
      setAllUsers([]);
      setInviteRequests([]);
      return;
    }

    const unsubscribeUsers = onSnapshot(
      collection(services.db, "users"),
      (snap) => {
        setAllUsers(snap.docs.map((item) => profileFromDoc(item.id, item.data())));
      },
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar usuários."))
    );
    const unsubscribeRequests = onSnapshot(
      query(collection(services.db, "invite_requests"), where("status", "==", "PENDING")),
      (snap) => setInviteRequests(snap.docs.map((item) => inviteRequestFromDoc(item.id, item.data())).sort((a, b) => b.createdAt - a.createdAt)),
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar pedidos."))
    );

    return () => {
      unsubscribeUsers();
      unsubscribeRequests();
    };
  }, [services, profile?.role]);

  function handleStudentSelection(student: TrainerStudent | null) {
    setSelectedStudent(student);
    if (student) {
      localStorage.setItem(SELECTED_STUDENT_KEY, JSON.stringify(student));
      notify("ok", `Agora acompanhando: ${student.name}`);
    } else {
      localStorage.removeItem(SELECTED_STUDENT_KEY);
      notify("warn", "Seleção de aluno limpa.");
    }
  }

  function handleFirebaseSaved(config: WebFirebaseConfig) {
    saveConfig(config);
    setServices(initFirebase(config));
    notify("ok", "Firebase conectado.");
  }

  async function handleRedeem(code: string) {
    if (!services || !authUser) return;
    setBusy(true);
    try {
      const type = await redeemInviteCode(services, code, authUser.uid);
      notify("ok", `Conta liberada como ${type}.`);
    } catch (error) {
      notify("error", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (!services) return;
    await signOut(services.auth);
    setSelectedStudent(null);
    localStorage.removeItem(SELECTED_STUDENT_KEY);
  }

  if (!services) {
    return <FirebaseConfigScreen onSave={handleFirebaseSaved} />;
  }

  if (!authReady) {
    return <LoadingScreen text="Carregando" />;
  }

  if (!authUser) {
    return (
      <AuthScreen
        services={services}
        onResetConfig={() => {
          clearSavedConfig();
          window.location.reload();
        }}
        notify={notify}
      />
    );
  }

  if (!profile) {
    return <LoadingScreen text="Sincronizando perfil" />;
  }

  if (!profile.active) {
    return (
      <BlockedShell
        title="Conta desativada"
        message="Entre em contato com o administrador."
        onLogout={handleLogout}
      />
    );
  }

  if (!profile.approved && profile.role !== "ADMIN") {
    return (
      <BlockedShell title="Conta bloqueada" message="Insira o código recebido para liberar o acesso." onLogout={handleLogout}>
        <RedeemCodeForm busy={busy} onRedeem={handleRedeem} />
      </BlockedShell>
    );
  }

  return (
    <>
      <AppShell
        profile={profile}
        selectedTab={tab}
        selectedStudent={selectedStudent}
        target={target}
        onSelectTab={setTab}
        onLogout={handleLogout}
        onClearStudent={() => handleStudentSelection(null)}
        onResetConfig={() => {
          clearSavedConfig();
          window.location.reload();
        }}
      >
        {tab === "perfil" && (
          <ProfileView
            services={services}
            user={authUser}
            profile={profile}
            students={students}
            selectedStudent={selectedStudent}
            inviteCodes={inviteCodes}
            records={records}
            progress={progress}
            cardio={cardio}
            notifications={notifications}
            busy={busy}
            setBusy={setBusy}
            notify={notify}
            onSelectStudent={handleStudentSelection}
            onRedeem={handleRedeem}
          />
        )}
        {tab === "treino" && (
          <TrainingView
            services={services}
            profile={profile}
            target={target}
            workouts={workouts}
            notify={notify}
          />
        )}
        {tab === "desempenho" && <PerformanceView target={target} records={records} />}
        {tab === "montar" && (
          <WorkoutBuilderView
            services={services}
            profile={profile}
            target={target}
            workouts={workouts}
            notify={notify}
          />
        )}
        {tab === "cardio" && (
          <CardioView
            services={services}
            profile={profile}
            target={target}
            cardio={cardio}
            notify={notify}
          />
        )}
        {tab === "progresso" && (
          <ProgressView
            services={services}
            profile={profile}
            target={target}
            progress={progress}
            notify={notify}
          />
        )}
        {tab === "admin" && (
          <AdminDashboard
            services={services}
            profile={profile}
            allUsers={allUsers}
            inviteRequests={inviteRequests}
            notify={notify}
          />
        )}
      </AppShell>
      {notice && <div className={`toast toast-${notice.kind}`}>{notice.text}</div>}
    </>
  );
}

function FirebaseConfigScreen({ onSave }: { onSave: (config: WebFirebaseConfig) => void }) {
  const [form, setForm] = useState<WebFirebaseConfig>({
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  });
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const missing = Object.entries(form).filter(([, value]) => !value.trim());
    if (missing.length) {
      setError("Preencha todos os campos.");
      return;
    }
    onSave(form);
  }

  return (
    <main className="auth-page">
      <section className="auth-panel config-panel">
        <div className="brand-block">
          <span className="brand-mark">
            <Dumbbell size={28} />
          </span>
          <div>
            <h1>MeuTreino</h1>
            <p>Configuração Firebase</p>
          </div>
        </div>

        <form className="stack" onSubmit={submit}>
          <TextInput label="apiKey" value={form.apiKey} onChange={(apiKey) => setForm((current) => ({ ...current, apiKey }))} />
          <TextInput label="authDomain" value={form.authDomain} onChange={(authDomain) => setForm((current) => ({ ...current, authDomain }))} />
          <TextInput label="projectId" value={form.projectId} onChange={(projectId) => setForm((current) => ({ ...current, projectId }))} />
          <TextInput label="storageBucket" value={form.storageBucket} onChange={(storageBucket) => setForm((current) => ({ ...current, storageBucket }))} />
          <TextInput
            label="messagingSenderId"
            value={form.messagingSenderId}
            onChange={(messagingSenderId) => setForm((current) => ({ ...current, messagingSenderId }))}
          />
          <TextInput label="appId" value={form.appId} onChange={(appId) => setForm((current) => ({ ...current, appId }))} />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-btn" type="submit">
            <Save size={18} />
            Salvar configuração
          </button>
        </form>
      </section>
    </main>
  );
}

function AuthScreen({
  services,
  onResetConfig,
  notify
}: {
  services: FirebaseServices;
  onResetConfig: () => void;
  notify: (kind: Notice["kind"], text: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("ALUNO");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      notify("warn", "Preencha email e senha.");
      return;
    }

    if (mode === "register" && !name.trim()) {
      notify("warn", "Preencha o nome.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(services.auth, cleanEmail, cleanPassword);
      } else {
        const created = await createUserWithEmailAndPassword(services.auth, cleanEmail, cleanPassword);
        await setDoc(doc(services.db, "users", created.user.uid), {
          name: name.trim(),
          email: cleanEmail,
          role,
          active: true,
          approved: false,
          trainerId: null,
          createdAt: Date.now()
        });
        notify("ok", "Conta criada. Insira o código para liberar.");
      }
    } catch (error) {
      notify(
        "error",
        firebaseErrorMessage(error, mode === "login" ? "Não foi possível entrar." : "Não foi possível criar a conta.")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-block">
          <span className="brand-mark">
            <Dumbbell size={28} />
          </span>
          <div>
            <h1>MeuTreino</h1>
            <p>{mode === "login" ? "Entrar" : "Criar conta"}</p>
          </div>
        </div>

        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Entrar
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
            Criar conta
          </button>
        </div>

        <form className="stack" onSubmit={submit}>
          {mode === "register" && <TextInput label="Nome" value={name} onChange={setName} autoComplete="name" />}
          <TextInput label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          <TextInput label="Senha" value={password} onChange={setPassword} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && (
            <div className="role-picker" role="radiogroup" aria-label="Tipo de conta">
              <label>
                <input type="radio" checked={role === "ALUNO"} onChange={() => setRole("ALUNO")} />
                Aluno
              </label>
              <label>
                <input type="radio" checked={role === "TREINADOR"} onChange={() => setRole("TREINADOR")} />
                Treinador
              </label>
            </div>
          )}
          <button className="primary-btn" disabled={busy} type="submit">
            <Check size={18} />
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button className="ghost-btn" onClick={onResetConfig} type="button">
          <Settings size={16} />
          Configuração Firebase
        </button>
      </section>
    </main>
  );
}

function AppShell({
  profile,
  selectedTab,
  selectedStudent,
  target,
  children,
  onSelectTab,
  onLogout,
  onClearStudent,
  onResetConfig
}: {
  profile: UserProfile;
  selectedTab: TabKey;
  selectedStudent: TrainerStudent | null;
  target: TrainerStudent | { uid: string; name: string } | null;
  children: React.ReactNode;
  onSelectTab: (tab: TabKey) => void;
  onLogout: () => void;
  onClearStudent: () => void;
  onResetConfig: () => void;
}) {
  const nav = [
    { key: "perfil" as const, label: "Perfil", icon: UserRound, visible: profile.role !== "ADMIN" },
    { key: "treino" as const, label: "Treino", icon: Dumbbell, visible: profile.role === "ALUNO" },
    { key: "desempenho" as const, label: "Desempenho", icon: BarChart3, visible: profile.role !== "ADMIN" },
    { key: "montar" as const, label: "Montar treino", icon: SquarePen, visible: profile.role === "TREINADOR" },
    { key: "cardio" as const, label: "Cardio", icon: Activity, visible: profile.role !== "ADMIN" },
    { key: "progresso" as const, label: "Progresso", icon: Camera, visible: profile.role !== "ADMIN" },
    { key: "admin" as const, label: "Admin", icon: ShieldCheck, visible: profile.role === "ADMIN" }
  ].filter((item) => item.visible);
  const selectedLabel = nav.find((item) => item.key === selectedTab)?.label ?? (selectedTab === "admin" ? "Painel admin" : "MeuTreino");

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand-block compact">
          <span className="brand-mark">
            <Dumbbell size={24} />
          </span>
          <div>
            <h1>MeuTreino</h1>
            <p>{profile.role}</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Menu">
          {nav.map((item) => {
            const Icon = item.icon;
            const disabled = profile.role === "TREINADOR" && ["desempenho", "cardio", "progresso"].includes(item.key) && !selectedStudent;
            return (
              <button
                className={selectedTab === item.key ? "active" : ""}
                disabled={disabled}
                key={item.key}
                onClick={() => onSelectTab(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {selectedStudent && (
          <div className="selected-student">
            <Users size={17} />
            <span>Aluno: {selectedStudent.name}</span>
            <button aria-label="Limpar aluno" onClick={onClearStudent} type="button">
              <X size={15} />
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <button className="icon-text" onClick={onResetConfig} type="button">
            <Settings size={17} />
            Firebase
          </button>
          <button className="icon-text danger" onClick={onLogout} type="button">
            <LogOut size={17} />
            Sair
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{target && target.uid !== profile.uid ? `Acompanhando ${target.name}` : profile.name}</span>
            <h2>{selectedLabel}</h2>
          </div>
          <button className="mobile-menu" type="button" aria-label="Abrir menu lateral">
            <Menu size={20} />
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}

function ProfileView({
  services,
  user,
  profile,
  students,
  selectedStudent,
  inviteCodes,
  records,
  progress,
  cardio,
  notifications,
  busy,
  setBusy,
  notify,
  onSelectStudent,
  onRedeem
}: {
  services: FirebaseServices;
  user: User;
  profile: UserProfile;
  students: TrainerStudent[];
  selectedStudent: TrainerStudent | null;
  inviteCodes: string[];
  records: WorkoutRecord[];
  progress: ProgressRecord[];
  cardio: CardioRecord[];
  notifications: NotificationItem[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  notify: (kind: Notice["kind"], text: string) => void;
  onSelectStudent: (student: TrainerStudent | null) => void;
  onRedeem: (code: string) => void;
}) {
  const [age, setAge] = useState(profile.idade?.toString() ?? "");
  const [height, setHeight] = useState(profile.alturaCm?.toString() ?? "");
  const [weight, setWeight] = useState(profile.pesoKg?.toString() ?? progress[0]?.pesoKg?.toString() ?? "");
  const [requestQty, setRequestQty] = useState("5");

  async function saveStudentData(event: FormEvent) {
    event.preventDefault();
    const idade = Number(age);
    const alturaCm = parseNumber(height);
    const pesoKg = parseNumber(weight);
    if (!idade || idade < 10 || idade > 100 || alturaCm < 100 || alturaCm > 250 || pesoKg <= 0 || pesoKg > 500) {
      notify("warn", "Preencha idade, altura e peso válidos.");
      return;
    }

    await updateDoc(doc(services.db, "users", profile.uid), { idade, alturaCm, pesoKg });
    notify("ok", "Dados do aluno salvos.");
  }

  async function requestCodes(event: FormEvent) {
    event.preventDefault();
    const qty = Number(requestQty);
    if (!qty || qty < 1) {
      notify("warn", "Quantidade inválida.");
      return;
    }

    setBusy(true);
    try {
      await addDoc(collection(services.db, "invite_requests"), {
        trainerUid: profile.uid,
        trainerName: profile.name,
        qty,
        status: "PENDING",
        createdAt: Date.now(),
        reviewedAt: null,
        reviewedBy: null
      });
      notify("ok", "Pedido enviado.");
    } catch (error) {
      notify("error", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markNotificationsRead() {
    const unread = notifications.filter((item) => !item.read);
    if (!unread.length) {
      notify("warn", "Não há notificações pendentes.");
      return;
    }

    await Promise.all(unread.map((item) => updateDoc(doc(services.db, "users", profile.uid, "notifications", item.id), { read: true })));
    notify("ok", "Notificações marcadas como lidas.");
  }

  const latestRecord = records[0];
  const latestProgress = progress[0];
  const latestCardio = cardio[0];

  return (
    <section className="screen profile-screen">
      <div className="grid two">
        <article className="panel">
          <SectionTitle icon={UserRound} title="Perfil" />
          <dl className="profile-lines">
            <div>
              <dt>Nome</dt>
              <dd>{profile.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{profile.email || user.email}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{profile.role}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{profile.approved ? "Liberado" : "Aguardando código"}</dd>
            </div>
            <div>
              <dt>Plano</dt>
              <dd>{profile.active ? "Ativo" : "Inativo"}</dd>
            </div>
            <div>
              <dt>Desde</dt>
              <dd>{new Date(profile.createdAt ?? user.metadata.creationTime ?? Date.now()).getFullYear()}</dd>
            </div>
          </dl>
          {!profile.approved && <RedeemCodeForm busy={busy} onRedeem={onRedeem} />}
        </article>

        {profile.role === "ALUNO" && (
          <article className="panel">
            <SectionTitle icon={Activity} title="Dados do aluno" />
            <form className="inline-form" onSubmit={saveStudentData}>
              <TextInput label="Idade" value={age} onChange={setAge} type="number" />
              <TextInput label="Altura em cm" value={height} onChange={setHeight} type="number" />
              <TextInput label="Peso em kg" value={weight} onChange={setWeight} type="number" />
              <button className="primary-btn" type="submit">
                <Save size={18} />
                Salvar
              </button>
            </form>
          </article>
        )}
      </div>

      {profile.role === "ALUNO" && (
        <>
          <div className="summary-row">
            <Metric label="Último treino" value={latestRecord ? `${latestRecord.nomeTreino} · ${latestRecord.dataHora}` : "Sem registros"} />
            <Metric label="Último peso" value={latestProgress ? `${latestProgress.pesoKg.toFixed(1)} kg` : "Sem registros"} />
            <Metric label="Último cardio" value={latestCardio ? `${latestCardio.atividade} · ${latestCardio.tempoMin}min` : "Sem registros"} />
          </div>

          <article className="panel">
            <SectionTitle icon={Clipboard} title={`Atualizações do treinador (${notifications.filter((item) => !item.read).length})`} />
            <div className="list compact-list">
              {notifications.length === 0 && <EmptyState title="Sem novas atualizações" />}
              {notifications.slice(0, 4).map((item) => (
                <div className="list-row" key={item.id}>
                  <span>{item.message}</span>
                  <small>{item.read ? "Lida" : "Nova"}</small>
                </div>
              ))}
            </div>
            <button className="secondary-btn" onClick={markNotificationsRead} type="button">
              <Check size={17} />
              Marcar como lidas
            </button>
          </article>
        </>
      )}

      {profile.role === "TREINADOR" && (
        <div className="grid two">
          <article className="panel">
            <SectionTitle icon={Users} title="Meus alunos" />
            <div className="list">
              {students.length === 0 && <EmptyState title="Nenhum aluno vinculado" />}
              {students.map((student) => (
                <div className={`list-row ${selectedStudent?.uid === student.uid ? "selected" : ""}`} key={student.uid}>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{student.email}</small>
                  </div>
                  <button className="secondary-btn" onClick={() => onSelectStudent(student)} type="button">
                    <Users size={16} />
                    Acompanhar
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <SectionTitle icon={Clipboard} title="Códigos de aluno" />
            <div className="code-grid">
              {inviteCodes.length === 0 && <EmptyState title="Sem códigos disponíveis" />}
              {inviteCodes.map((code) => (
                <button className="code-pill" key={code} onClick={() => navigator.clipboard?.writeText(code)} type="button">
                  <Clipboard size={15} />
                  {code}
                </button>
              ))}
            </div>
            <form className="inline-form" onSubmit={requestCodes}>
              <TextInput label="Quantidade" value={requestQty} onChange={setRequestQty} type="number" />
              <button className="primary-btn" disabled={busy} type="submit">
                <Plus size={18} />
                Solicitar
              </button>
            </form>
          </article>
        </div>
      )}
    </section>
  );
}

function TrainingView({
  services,
  profile,
  target,
  workouts,
  notify
}: {
  services: FirebaseServices;
  profile: UserProfile;
  target: { uid: string; name: string } | TrainerStudent | null;
  workouts: WorkoutPlan[];
  notify: (kind: Notice["kind"], text: string) => void;
}) {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState("");
  const selectedWorkout = workouts.find((item) => item.id === selectedWorkoutId) ?? workouts[0];
  const [seriesValues, setSeriesValues] = useState<Record<string, { kg: string; reps: string }>>({});

  useEffect(() => {
    if (!selectedWorkout) return;
    const next: Record<string, { kg: string; reps: string }> = {};
    selectedWorkout.exercicios.forEach((exercise, exIndex) => {
      for (let serie = 1; serie <= exercise.series; serie += 1) {
        next[`${exIndex}-${serie}`] = { kg: "", reps: "" };
      }
    });
    setSeriesValues(next);
  }, [selectedWorkout?.id]);

  async function saveSession(completo: boolean) {
    if (!target || !selectedWorkout) return;
    const exercicios: ExerciseRecord[] = selectedWorkout.exercicios.map((exercise, exIndex) => ({
      nomeExercicio: exercise.nome,
      series: Array.from({ length: exercise.series }, (_, serieIndex) => {
        const serieNumero = serieIndex + 1;
        const current = seriesValues[`${exIndex}-${serieNumero}`] ?? { kg: "", reps: "" };
        return {
          serieNumero,
          kg: parseNumber(current.kg),
          reps: Math.round(parseNumber(current.reps))
        };
      })
    }));

    await setDoc(doc(services.db, "users", target.uid, "treino_registros", Date.now().toString()), {
      idLocal: newId("web-"),
      dataHora: formatDateTime(new Date()),
      nomeTreino: selectedWorkout.nome,
      completo,
      createdAt: Date.now(),
      exercicios
    });
    notify("ok", completo ? "Treino registrado." : "Treino salvo como incompleto.");
  }

  if (profile.role !== "ALUNO") return <EmptyPage title="Treino disponível para aluno" />;
  if (!selectedWorkout) return <EmptyPage title="Sem treino cadastrado" />;

  return (
    <section className="screen training-screen">
      <article className="panel">
        <div className="panel-heading split">
          <SectionTitle icon={Dumbbell} title="Treino" />
          <select value={selectedWorkout.id} onChange={(event) => setSelectedWorkoutId(event.target.value)}>
            {workouts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="exercise-stack">
          {selectedWorkout.exercicios.map((exercise, exIndex) => (
            <div className="exercise-box" key={`${exercise.nome}-${exIndex}`}>
              <div>
                <strong>{exercise.nome}</strong>
                <small>
                  {exercise.series} séries · {exercise.repsMin}-{exercise.repsMax} reps · {exercise.descanso}
                </small>
              </div>
              <div className="series-grid">
                {Array.from({ length: exercise.series }, (_, serieIndex) => {
                  const serieNumero = serieIndex + 1;
                  const key = `${exIndex}-${serieNumero}`;
                  const current = seriesValues[key] ?? { kg: "", reps: "" };
                  return (
                    <div className="series-row" key={key}>
                      <span>Série {serieNumero}</span>
                      <input
                        inputMode="decimal"
                        placeholder="kg"
                        value={current.kg}
                        onChange={(event) =>
                          setSeriesValues((values) => ({ ...values, [key]: { ...current, kg: event.target.value } }))
                        }
                      />
                      <input
                        inputMode="numeric"
                        placeholder="reps"
                        value={current.reps}
                        onChange={(event) =>
                          setSeriesValues((values) => ({ ...values, [key]: { ...current, reps: event.target.value } }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="action-row">
          <button className="secondary-btn" onClick={() => saveSession(false)} type="button">
            <X size={17} />
            Cancelar treino
          </button>
          <button className="primary-btn" onClick={() => saveSession(true)} type="button">
            <Check size={18} />
            Finalizar treino
          </button>
        </div>
      </article>
    </section>
  );
}

function WorkoutBuilderView({
  services,
  profile,
  target,
  workouts,
  notify
}: {
  services: FirebaseServices;
  profile: UserProfile;
  target: TrainerStudent | { uid: string; name: string } | null;
  workouts: WorkoutPlan[];
  notify: (kind: Notice["kind"], text: string) => void;
}) {
  const [editingId, setEditingId] = useState<string>("");
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<ExercisePlan[]>([]);
  const [draftExercise, setDraftExercise] = useState<ExercisePlan>(emptyExercise);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [movingWorkoutId, setMovingWorkoutId] = useState("");

  useEffect(() => {
    const current = workouts.find((item) => item.id === editingId);
    if (!current) return;
    setName(current.nome);
    setExercises(current.exercicios.map((exercise) => ({ ...exercise })));
    setEditingExerciseIndex(null);
    setDraftExercise(emptyExercise);
  }, [editingId, workouts]);

  function startNew() {
    setEditingId("");
    setName("");
    setExercises([]);
    setEditingExerciseIndex(null);
    setDraftExercise(emptyExercise);
  }

  function cancelExerciseEdit() {
    setEditingExerciseIndex(null);
    setDraftExercise(emptyExercise);
  }

  function editExercise(index: number) {
    const exercise = exercises[index];
    if (!exercise) return;
    setEditingExerciseIndex(index);
    setDraftExercise({ ...exercise });
  }

  function saveExerciseDraft() {
    const originalExercise = editingExerciseIndex === null ? null : exercises[editingExerciseIndex];
    const exerciseName = originalExercise?.nome ?? draftExercise.nome.trim();

    if (!exerciseName) {
      notify("warn", "Informe o nome do exercício.");
      return;
    }

    if (
      !Number.isInteger(draftExercise.series) ||
      !Number.isInteger(draftExercise.repsMin) ||
      !Number.isInteger(draftExercise.repsMax) ||
      draftExercise.series <= 0 ||
      draftExercise.repsMin <= 0 ||
      draftExercise.repsMax <= 0
    ) {
      notify("warn", "Séries e repetições precisam ser números inteiros maiores que zero.");
      return;
    }

    if (draftExercise.repsMin > draftExercise.repsMax) {
      notify("warn", "A repetição mínima não pode ser maior que a máxima.");
      return;
    }

    if (!draftExercise.descanso.trim() || !draftExercise.rir.trim()) {
      notify("warn", "Informe o descanso e o RIR.");
      return;
    }

    const nextExercise: ExercisePlan = {
      ...draftExercise,
      nome: exerciseName,
      descanso: draftExercise.descanso.trim(),
      tecnica: draftExercise.tecnica.trim() || "-",
      rir: draftExercise.rir.trim()
    };

    if (editingExerciseIndex !== null && originalExercise) {
      setExercises((current) =>
        current.map((exercise, index) => (index === editingExerciseIndex ? nextExercise : exercise))
      );
    } else {
      setExercises((current) => [...current, nextExercise]);
    }
    cancelExerciseEdit();
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault();
    if (!target) {
      notify("warn", "Selecione um aluno.");
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName || exercises.length === 0) {
      notify("warn", "Informe o treino e pelo menos um exercício.");
      return;
    }

    const nextWorkoutId = safeDocId(trimmedName);
    if (workouts.some((workout) => workout.id !== editingId && workout.id === nextWorkoutId)) {
      notify("warn", "Já existe outro treino com esse nome.");
      return;
    }

    const plan: WorkoutPlan = {
      id: nextWorkoutId,
      nome: trimmedName,
      ordem: workouts.find((item) => item.id === editingId)?.ordem ?? workouts.length,
      exercicios: exercises.map((exercise) => ({ ...exercise }))
    };

    setSavingPlan(true);
    try {
      const savedId = await saveWorkoutPlan(services, target.uid, profile.uid, plan, editingId || undefined);
      setName(trimmedName);
      setEditingId(savedId);
      notify("ok", editingId ? "Treino atualizado." : "Treino salvo.");
    } catch (error) {
      notify("error", firebaseErrorMessage(error, "Não foi possível salvar o treino."));
    } finally {
      setSavingPlan(false);
    }
  }

  async function removePlan(workout: WorkoutPlan) {
    if (!target) return;
    try {
      await deleteWorkoutPlan(services, target.uid, profile.uid, workout.nome);
      notify("ok", "Treino removido.");
      startNew();
    } catch (error) {
      notify("error", firebaseErrorMessage(error, "Não foi possível remover o treino."));
    }
  }

  async function movePlan(index: number, direction: -1 | 1) {
    if (!target || movingWorkoutId) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= workouts.length) return;

    const next = workouts.map((workout) => ({ ...workout }));
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const reordered = next.map((workout, order) => ({ ...workout, ordem: order }));

    setMovingWorkoutId(workouts[index].id);
    try {
      await updateWorkoutOrder(services, target.uid, profile.uid, reordered);
      notify("ok", "Ordem dos treinos atualizada.");
    } catch (error) {
      notify("error", firebaseErrorMessage(error, "Não foi possível atualizar a ordem dos treinos."));
    } finally {
      setMovingWorkoutId("");
    }
  }

  function moveExercise(index: number, direction: -1 | 1) {
    const next = [...exercises];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setExercises(next);
    setEditingExerciseIndex((current) => {
      if (current === index) return targetIndex;
      if (current === targetIndex) return index;
      return current;
    });
  }

  function removeExercise(index: number) {
    setExercises((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (editingExerciseIndex === index) {
      cancelExerciseEdit();
    } else if (editingExerciseIndex !== null && editingExerciseIndex > index) {
      setEditingExerciseIndex(editingExerciseIndex - 1);
    }
  }

  if (profile.role !== "TREINADOR") return <EmptyPage title="Montagem disponível para treinador" />;
  if (!target) return <EmptyPage title="Selecione um aluno no Perfil" />;

  return (
    <section className="screen builder-screen">
      <div className="grid builder-grid">
        <article className="panel">
          <div className="panel-heading split">
            <SectionTitle icon={SquarePen} title="Montar treino" />
            <button className="secondary-btn" onClick={startNew} type="button">
              <Plus size={17} />
              Novo
            </button>
          </div>

          <form className="stack" onSubmit={savePlan}>
            <TextInput label="Nome do treino" value={name} onChange={setName} />
            <div className="exercise-form">
              {editingExerciseIndex !== null && (
                <div className="exercise-edit-heading">
                  <strong>Editando exercício</strong>
                  <button className="ghost-btn" onClick={cancelExerciseEdit} type="button">
                    <X size={16} />
                    Cancelar edição
                  </button>
                </div>
              )}
              <TextInput
                disabled={editingExerciseIndex !== null}
                label="Exercício"
                value={draftExercise.nome}
                onChange={(nome) => setDraftExercise((current) => ({ ...current, nome }))}
              />
              <TextInput
                label="Séries"
                value={String(draftExercise.series)}
                onChange={(series) => setDraftExercise((current) => ({ ...current, series: Number(series) }))}
                type="number"
              />
              <TextInput
                label="Rep. mín."
                value={String(draftExercise.repsMin)}
                onChange={(repsMin) => setDraftExercise((current) => ({ ...current, repsMin: Number(repsMin) }))}
                type="number"
              />
              <TextInput
                label="Rep. máx."
                value={String(draftExercise.repsMax)}
                onChange={(repsMax) => setDraftExercise((current) => ({ ...current, repsMax: Number(repsMax) }))}
                type="number"
              />
              <TextInput label="Descanso" value={draftExercise.descanso} onChange={(descanso) => setDraftExercise((current) => ({ ...current, descanso }))} />
              <TextInput label="Técnica" value={draftExercise.tecnica} onChange={(tecnica) => setDraftExercise((current) => ({ ...current, tecnica }))} />
              <TextInput label="RIR" value={draftExercise.rir} onChange={(rir) => setDraftExercise((current) => ({ ...current, rir }))} />
              <button className="secondary-btn" onClick={saveExerciseDraft} type="button">
                {editingExerciseIndex === null ? <Plus size={17} /> : <Save size={17} />}
                {editingExerciseIndex === null ? "Adicionar" : "Salvar edição"}
              </button>
              {editingExerciseIndex !== null && (
                <p className="form-helper">O nome do exercício fica bloqueado durante a edição.</p>
              )}
            </div>

            <div className="exercise-stack compact">
              {exercises.map((exercise, index) => (
                <div className={`list-row ${editingExerciseIndex === index ? "selected" : ""}`} key={`${exercise.nome}-${index}`}>
                  <div>
                    <strong>{exercise.nome}</strong>
                    <small>
                      {exercise.series} séries · {exercise.repsMin}-{exercise.repsMax} reps · {exercise.descanso}
                    </small>
                  </div>
                  <div className="row-actions">
                    <button aria-label="Editar exercício" onClick={() => editExercise(index)} type="button">
                      <SquarePen size={16} />
                    </button>
                    <button aria-label="Subir exercício" disabled={index === 0} onClick={() => moveExercise(index, -1)} type="button">
                      <ArrowUp size={16} />
                    </button>
                    <button aria-label="Descer exercício" disabled={index === exercises.length - 1} onClick={() => moveExercise(index, 1)} type="button">
                      <ArrowDown size={16} />
                    </button>
                    <button aria-label="Remover" onClick={() => removeExercise(index)} type="button">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button className="primary-btn" disabled={savingPlan} type="submit">
              <Save size={18} />
              {savingPlan ? "Salvando..." : editingId ? "Atualizar treino" : "Salvar treino"}
            </button>
          </form>
        </article>

        <article className="panel">
          <SectionTitle icon={Dumbbell} title="Treinos salvos" />
          <div className="list">
            {workouts.length === 0 && <EmptyState title="Nenhum treino salvo" />}
            {workouts.map((workout, index) => (
              <div className="list-row workout-list-row" key={workout.id}>
                <div>
                  <strong>{workout.nome}</strong>
                  <small>{workout.exercicios.length} exercício(s)</small>
                </div>
                <div className="row-actions">
                  <button
                    aria-label={`Mover ${workout.nome} para cima`}
                    disabled={index === 0 || Boolean(movingWorkoutId)}
                    onClick={() => movePlan(index, -1)}
                    type="button"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label={`Mover ${workout.nome} para baixo`}
                    disabled={index === workouts.length - 1 || Boolean(movingWorkoutId)}
                    onClick={() => movePlan(index, 1)}
                    type="button"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button aria-label="Editar" onClick={() => setEditingId(workout.id)} type="button">
                    <SquarePen size={16} />
                  </button>
                  <button aria-label="Apagar" onClick={() => removePlan(workout)} type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function PerformanceView({ target, records }: { target: TrainerStudent | { uid: string; name: string } | null; records: WorkoutRecord[] }) {
  const chartData = records
    .slice(0, 10)
    .reverse()
    .map((record) => ({
      name: record.nomeTreino,
      volume: Math.round(volumeForRecord(record))
    }));
  const completed = records.filter((item) => item.completo).length;
  const totalVolume = records.reduce((total, item) => total + volumeForRecord(item), 0);

  if (!target) return <EmptyPage title="Selecione um aluno no Perfil" />;

  return (
    <section className="screen performance-screen">
      <div className="summary-row">
        <Metric label="Treinos" value={String(records.length)} />
        <Metric label="Completos" value={String(completed)} />
        <Metric label="Volume total" value={`${Math.round(totalVolume).toLocaleString("pt-BR")} kg`} />
      </div>

      <article className="panel chart-panel">
        <SectionTitle icon={BarChart3} title="Desempenho" />
        {chartData.length === 0 ? (
          <EmptyState title="Sem registros" />
        ) : (
          <ResponsiveContainer height={260} width="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="#203537" vertical={false} />
              <XAxis dataKey="name" stroke="#718681" tick={{ fill: "#9EB2AD", fontSize: 12 }} />
              <YAxis stroke="#718681" tick={{ fill: "#9EB2AD", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="volume" fill="#4EF0AE" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </article>

      <article className="panel">
        <SectionTitle icon={Clipboard} title="Histórico" />
        <div className="list">
          {records.length === 0 && <EmptyState title="Sem histórico" />}
          {records.map((record) => (
            <div className="list-row" key={record.id}>
              <div>
                <strong>{record.nomeTreino}</strong>
                <small>
                  {record.dataHora} · {record.completo ? "Completo" : "Incompleto"}
                  {record.duracaoSegundos > 0 ? ` · ${formatWorkoutDuration(record.duracaoSegundos)}` : ""}
                </small>
              </div>
              <span className="badge">{Math.round(volumeForRecord(record)).toLocaleString("pt-BR")} kg</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function parsePtBrDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2}))?/);
  if (match) {
    const [, day, month, year, hour = "0", minute = "0"] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function cardioRecordDate(record: CardioRecord) {
  const parsed = parsePtBrDate(record.dataHora);
  if (parsed) return parsed;
  return record.createdAt > 0 ? new Date(record.createdAt) : null;
}

function cardioDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function cardioStartOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function cardioAddDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function cardioInputNow() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatCardioWeek(start: Date) {
  const end = cardioAddDays(start, 6);
  const short = (date: Date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  return `${short(start)} – ${short(end)}`;
}

function formatCardioMonth(date: Date) {
  const value = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCardioRecordTime(record: CardioRecord) {
  return cardioRecordDate(record)?.getTime() ?? 0;
}

function CardioView({
  services,
  profile,
  target,
  cardio,
  notify
}: {
  services: FirebaseServices;
  profile: UserProfile;
  target: TrainerStudent | { uid: string; name: string } | null;
  cardio: CardioRecord[];
  notify: (kind: Notice["kind"], text: string) => void;
}) {
  const [atividade, setAtividade] = useState("");
  const [tempoMin, setTempoMin] = useState("30");
  const [ritmo, setRitmo] = useState("");
  const [date, setDate] = useState(cardioInputNow);
  const [weekStartMs, setWeekStartMs] = useState(() => cardioStartOfWeek(new Date()).getTime());
  const [chartDays, setChartDays] = useState(7);
  const [weeklyGoal, setWeeklyGoal] = useState(180);
  const [goalDraft, setGoalDraft] = useState("180");
  const [savingGoal, setSavingGoal] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonthMs, setCalendarMonthMs] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime());
  const [calendarSelectedKey, setCalendarSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setWeekStartMs(cardioStartOfWeek(new Date()).getTime());
    setCalendarMonthMs(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime());
    setCalendarSelectedKey(null);
    setHistoryOpen(false);
    setCalendarOpen(false);
    setWeeklyGoal(180);
    setGoalDraft("180");
  }, [target?.uid]);

  useEffect(() => {
    setGoalDraft(String(weeklyGoal));
  }, [weeklyGoal, target?.uid]);

  useEffect(() => {
    if (!target?.uid) return;
    let userGoal = 0;
    let configGoal = 0;
    let userGoalUpdatedAt = 0;
    let configGoalUpdatedAt = 0;
    const readMillis = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (!value || typeof value !== "object") return 0;
      const candidate = value as { toMillis?: () => number; seconds?: number };
      if (typeof candidate.toMillis === "function") return candidate.toMillis();
      return typeof candidate.seconds === "number" ? candidate.seconds * 1000 : 0;
    };
    const readGoal = (data: DocumentData | undefined) => {
      const value = Number(data?.cardioMetaSemanalMin ?? data?.metaSemanalCardioMin ?? data?.cardioGoalMin ?? 0);
      return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    };
    const applyLatestGoal = () => {
      const configIsLatest = configGoal > 0 && (
        (configGoalUpdatedAt === 0 && userGoalUpdatedAt === 0) ||
        configGoalUpdatedAt >= userGoalUpdatedAt ||
        userGoalUpdatedAt === 0
      );
      setWeeklyGoal(configIsLatest ? configGoal : userGoal || configGoal || 180);
    };

    const unsubscribeUser = onSnapshot(
      doc(services.db, "users", target.uid),
      (snap) => {
        userGoal = readGoal(snap.data());
        userGoalUpdatedAt = readMillis(snap.data()?.updatedAt);
        applyLatestGoal();
      },
      () => applyLatestGoal()
    );
    const unsubscribeConfig = onSnapshot(
      doc(services.db, "users", target.uid, "cardio_meta", "current"),
      (snap) => {
        configGoal = readGoal(snap.data());
        configGoalUpdatedAt = readMillis(snap.data()?.updatedAt);
        applyLatestGoal();
      },
      () => applyLatestGoal()
    );

    return () => {
      unsubscribeUser();
      unsubscribeConfig();
    };
  }, [services, target?.uid]);

  const sortedCardio = useMemo(
    () => cardio.slice().sort((a, b) => formatCardioRecordTime(b) - formatCardioRecordTime(a)),
    [cardio]
  );

  const recordsByDay = useMemo(() => {
    const grouped = new Map<string, CardioRecord[]>();
    sortedCardio.forEach((record) => {
      const recordDate = cardioRecordDate(record);
      if (!recordDate) return;
      const key = cardioDateKey(recordDate);
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    });
    return grouped;
  }, [sortedCardio]);

  const weekStart = new Date(weekStartMs);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = cardioAddDays(new Date(weekStartMs), index);
    const key = cardioDateKey(day);
    const dayRecords = recordsByDay.get(key) ?? [];
    return {
      date: day,
      key,
      label: day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      total: dayRecords.reduce((sum, item) => sum + item.tempoMin, 0),
      sessions: dayRecords.length
    };
  }), [weekStartMs, recordsByDay]);
  const weekTotal = weekDays.reduce((sum, day) => sum + day.total, 0);
  const weekSessions = weekDays.reduce((sum, day) => sum + day.sessions, 0);
  const goalPercent = weeklyGoal > 0 ? Math.min(100, Math.round((weekTotal / weeklyGoal) * 100)) : 0;
  const remaining = Math.max(weeklyGoal - weekTotal, 0);
  const currentWeekMs = cardioStartOfWeek(new Date()).getTime();

  const chartData = useMemo(() => Array.from({ length: chartDays }, (_, index) => {
    const day = cardioAddDays(new Date(), index - chartDays + 1);
    const dayRecords = recordsByDay.get(cardioDateKey(day)) ?? [];
    return {
      label: day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", ""),
      minutes: dayRecords.reduce((sum, item) => sum + item.tempoMin, 0)
    };
  }), [chartDays, recordsByDay]);

  const calendarMonth = new Date(calendarMonthMs);
  const calendarCells = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = cardioAddDays(first, -offset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = cardioAddDays(start, index);
      const key = cardioDateKey(day);
      const dayRecords = recordsByDay.get(key) ?? [];
      return {
        date: day,
        key,
        currentMonth: day.getMonth() === calendarMonth.getMonth(),
        total: dayRecords.reduce((sum, item) => sum + item.tempoMin, 0),
        sessions: dayRecords.length
      };
    });
  }, [calendarMonthMs, recordsByDay]);
  const calendarDayRecords = calendarSelectedKey ? recordsByDay.get(calendarSelectedKey) ?? [] : [];

  async function saveCardio(event: FormEvent) {
    event.preventDefault();
    if (!target || profile.role !== "ALUNO") return;
    const activityName = atividade.trim();
    const minutes = parsePositiveWholeMinutes(tempoMin);
    const selectedDate = new Date(date);
    if (!activityName) {
      notify("warn", "Informe a atividade.");
      return;
    }
    if (minutes === null) {
      notify("warn", "Informe um tempo válido em minutos.");
      return;
    }
    if (Number.isNaN(selectedDate.getTime())) {
      notify("warn", "Informe uma data válida.");
      return;
    }

    const id = newId("cardio-");
    try {
      await setDoc(doc(services.db, "users", target.uid, "cardio", id), {
        id,
        dataHora: formatDateTime(selectedDate),
        dataChave: formatDate(selectedDate),
        atividade: activityName,
        tempoMin: minutes,
        ritmo: ritmo.trim() || "—",
        createdAt: selectedDate.getTime()
      });
      setAtividade("");
      setRitmo("");
      setDate(cardioInputNow());
      notify("ok", "Cardio salvo.");
    } catch (error) {
      notify("error", firebaseErrorMessage(error, "Erro ao salvar cardio."));
    }
  }

  async function saveWeeklyGoal(event: FormEvent) {
    event.preventDefault();
    if (!target || profile.role !== "TREINADOR") return;

    const value = parsePositiveWholeMinutes(goalDraft);
    if (value === null) {
      notify("warn", "Informe uma meta semanal válida em minutos.");
      return;
    }

    setSavingGoal(true);
    try {
      await saveCardioGoalInFirestore(services, target.uid, value, profile.uid);
      setWeeklyGoal(value);
      setGoalDraft(String(value));
      notify("ok", `Meta semanal de cardio atualizada para ${target.name}.`);
    } catch (error) {
      notify("error", firebaseErrorMessage(error, "Erro ao atualizar a meta de cardio."));
    } finally {
      setSavingGoal(false);
    }
  }

  async function removeCardio(item: CardioRecord) {
    if (!target || profile.role !== "ALUNO") return;
    if (!window.confirm(`Apagar o registro de ${item.atividade} em ${item.dataHora}?`)) return;
    try {
      await deleteDoc(doc(services.db, "users", target.uid, "cardio", item.id));
      notify("ok", "Registro de cardio apagado.");
    } catch (error) {
      notify("error", firebaseErrorMessage(error, "Erro ao apagar cardio."));
    }
  }

  if (!target) return <EmptyPage title="Selecione um aluno no Perfil" />;

  return (
    <section className="screen cardio-screen cardio-dashboard">
      <article className="cardio-goal-card">
        <div
          className="cardio-goal-ring"
          style={{ "--cardio-goal-percent": `${goalPercent}%` } as CSSProperties}
          aria-label={`${goalPercent}% da meta semanal`}
        >
          <span><strong>{goalPercent}%</strong><small>da meta</small></span>
        </div>
        <div className="cardio-goal-main">
          <h3>Meta semanal de cardio</h3>
          <p>{remaining > 0 ? "Mantenha o ritmo! Você está no caminho certo." : "Meta semanal concluída."}</p>
          <div className="cardio-goal-track"><span style={{ width: `${goalPercent}%` }} /></div>
        </div>
        <div className="cardio-goal-numbers">
          <strong>{weekTotal}</strong><span> de {weeklyGoal} min</span>
          <small>{remaining > 0 ? `Faltam ${remaining} min` : "Meta concluída"}</small>
        </div>
        <img className="cardio-runner" src="/cardio-runner.png" alt="Pessoa correndo" />
      </article>

      {profile.role === "TREINADOR" && (
        <article className="cardio-dashboard-card cardio-goal-editor-card">
          <header className="cardio-card-heading"><Settings size={22} /><h3>Editar meta semanal do aluno</h3></header>
          <p className="cardio-goal-editor-help">Defina quantos minutos de cardio o aluno deve cumprir por semana. A alteração será refletida na web e no aplicativo Android.</p>
          <form className="cardio-goal-editor-form" onSubmit={saveWeeklyGoal}>
            <label className="cardio-goal-editor-field">
              <span>Meta semanal (minutos)</span>
              <input
                min="1"
                step="1"
                inputMode="numeric"
                type="number"
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
                onWheel={(event) => {
                  event.preventDefault();
                  event.currentTarget.blur();
                }}
              />
            </label>
            <button className="cardio-save-button" disabled={savingGoal} type="submit">
              <Save size={18} />
              {savingGoal ? "Salvando..." : "Salvar meta"}
            </button>
          </form>
        </article>
      )}

      <div className="cardio-dashboard-grid cardio-dashboard-grid-top">
        <article className="cardio-dashboard-card cardio-register-card">
          <header className="cardio-card-heading"><Activity size={23} /><h3>Registrar cardio</h3></header>
          {profile.role === "ALUNO" ? (
            <form className="cardio-register-form" onSubmit={saveCardio}>
              <label className="cardio-field cardio-field-activity">
                <span>Atividade</span>
                <input value={atividade} onChange={(event) => setAtividade(event.target.value)} placeholder="Ex.: Esteira, Corrida, Bike..." />
              </label>
              <label className="cardio-field">
                <span>Tempo min</span>
                <span className="cardio-input-with-icon"><Clock3 size={17} /><input min="1" step="1" inputMode="numeric" type="number" value={tempoMin} onChange={(event) => setTempoMin(event.target.value)} onWheel={(event) => { event.preventDefault(); event.currentTarget.blur(); }} /></span>
              </label>
              <label className="cardio-field">
                <span>Ritmo</span>
                <span className="cardio-input-with-icon"><Activity size={17} /><input value={ritmo} onChange={(event) => setRitmo(event.target.value)} placeholder="—" /></span>
              </label>
              <label className="cardio-field cardio-field-date">
                <span>Data</span>
                <span className="cardio-input-with-icon"><CalendarDays size={17} /><input value={date} onChange={(event) => setDate(event.target.value)} type="datetime-local" /></span>
              </label>
              <button className="cardio-save-button" type="submit"><Save size={18} /> Salvar</button>
            </form>
          ) : (
            <div className="cardio-readonly-message">
              <Activity size={28} />
              <div><strong>Acompanhamento do aluno</strong><span>Os registros são feitos pelo aluno e aparecem aqui automaticamente.</span></div>
            </div>
          )}
        </article>

        <article className="cardio-dashboard-card cardio-chart-card">
          <header className="cardio-card-heading cardio-card-heading-split">
            <span><TrendingUp size={22} /><h3>Evolução de cardio (min)</h3></span>
            <select aria-label="Período do gráfico" value={chartDays} onChange={(event) => setChartDays(Number(event.target.value))}>
              <option value={7}>Últimos 7 dias</option>
              <option value={14}>Últimos 14 dias</option>
              <option value={30}>Últimos 30 dias</option>
            </select>
          </header>
          <div className="cardio-chart-wrap">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={chartData} margin={{ top: 18, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cardioAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#20efb2" stopOpacity={0.48} />
                    <stop offset="100%" stopColor="#20efb2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#173638" strokeDasharray="3 5" vertical />
                <XAxis dataKey="label" stroke="#77928d" tick={{ fill: "#9eb2ad", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="#77928d" tick={{ fill: "#9eb2ad", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0d2224", border: "1px solid rgba(78,240,174,.55)", borderRadius: 12, color: "#f3f8f6" }}
                  formatter={(value) => [`${Number(value)} min`, "Cardio"]}
                />
                <Area activeDot={{ r: 6, fill: "#f3f8f6", stroke: "#20efb2", strokeWidth: 3 }} dataKey="minutes" fill="url(#cardioAreaGradient)" stroke="#20efb2" strokeWidth={3} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <div className="cardio-dashboard-grid cardio-dashboard-grid-bottom">
        <article className="cardio-dashboard-card cardio-week-card">
          <header className="cardio-card-heading cardio-card-heading-split">
            <span><CalendarDays size={22} /><h3>Calendário semanal</h3></span>
            <div className="cardio-week-controls">
              <button type="button" onClick={() => setWeekStartMs((current) => cardioAddDays(new Date(current), -7).getTime())} aria-label="Semana anterior"><ChevronLeft size={18} /></button>
              <strong>{formatCardioWeek(weekStart)}</strong>
              <button disabled={weekStartMs >= currentWeekMs} type="button" onClick={() => setWeekStartMs((current) => cardioAddDays(new Date(current), 7).getTime())} aria-label="Próxima semana"><ChevronRight size={18} /></button>
            </div>
            <button className="cardio-text-button" type="button" onClick={() => setCalendarOpen(true)}>Ver calendário completo <CalendarDays size={17} /></button>
          </header>
          <div className="cardio-week-days">
            {weekDays.map((day) => (
              <button
                className={`cardio-week-day ${day.total > 0 ? "has-cardio" : ""} ${day.key === cardioDateKey(new Date()) ? "is-today" : ""}`}
                key={day.key}
                onClick={() => {
                  setCalendarMonthMs(new Date(day.date.getFullYear(), day.date.getMonth(), 1).getTime());
                  setCalendarSelectedKey(day.key);
                  setCalendarOpen(true);
                }}
                type="button"
              >
                <strong>{day.label}</strong>
                <span>{day.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                <i><b>{day.total > 0 ? day.total : "—"}</b><small>min</small></i>
                <em>{day.sessions > 0 ? "✓" : ""}</em>
              </button>
            ))}
          </div>
          <div className="cardio-week-summary">
            <span><Clock3 size={22} /><small>Total da semana</small><strong>{weekTotal} min</strong></span>
            <span><Activity size={22} /><small>Total de sessões</small><strong>{weekSessions} {weekSessions === 1 ? "sessão" : "sessões"}</strong></span>
          </div>
        </article>

        <article className="cardio-dashboard-card cardio-history-card">
          <header className="cardio-card-heading cardio-card-heading-split">
            <span><Clipboard size={22} /><h3>Registros anteriores</h3></span>
            <button className="cardio-text-button" type="button" onClick={() => setHistoryOpen(true)}>Ver todos <ChevronRight size={17} /></button>
          </header>
          <div className="cardio-history-head"><span>Atividade</span><span>Data</span><span>Tempo</span><span>Ritmo</span><span /></div>
          <div className="cardio-history-list">
            {sortedCardio.length === 0 && <p className="cardio-empty">Sem cardio registrado.</p>}
            {sortedCardio.slice(0, 4).map((item) => (
              <div className="cardio-history-row" key={item.id}>
                <strong><Activity size={18} />{item.atividade}</strong>
                <span>{item.dataHora}</span>
                <span><Clock3 size={16} />{item.tempoMin} min</span>
                <span><Activity size={16} />{item.ritmo}</span>
                {profile.role === "ALUNO" ? <button type="button" aria-label={`Apagar ${item.atividade}`} onClick={() => void removeCardio(item)}><Trash2 size={17} /></button> : <i />}
              </div>
            ))}
          </div>
        </article>
      </div>

      {historyOpen && (
        <div className="cardio-dialog-backdrop" onMouseDown={() => setHistoryOpen(false)}>
          <article className="cardio-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Todos os registros de cardio">
            <header><div><small>HISTÓRICO COMPLETO</small><h2>Todos os registros de cardio</h2></div><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Fechar"><X size={22} /></button></header>
            <div className="cardio-dialog-records">
              {sortedCardio.length === 0 && <p className="cardio-empty">Sem cardio registrado.</p>}
              {sortedCardio.map((item) => (
                <div className="cardio-history-row" key={item.id}>
                  <strong><Activity size={18} />{item.atividade}</strong><span>{item.dataHora}</span><span><Clock3 size={16} />{item.tempoMin} min</span><span><Activity size={16} />{item.ritmo}</span>
                  {profile.role === "ALUNO" ? <button type="button" aria-label={`Apagar ${item.atividade}`} onClick={() => void removeCardio(item)}><Trash2 size={17} /></button> : <i />}
                </div>
              ))}
            </div>
          </article>
        </div>
      )}

      {calendarOpen && (
        <div className="cardio-dialog-backdrop" onMouseDown={() => setCalendarOpen(false)}>
          <article className="cardio-dialog cardio-calendar-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Calendário completo de cardio">
            <header><div><small>CALENDÁRIO COMPLETO</small><h2>Histórico de cardio</h2></div><button type="button" onClick={() => setCalendarOpen(false)} aria-label="Fechar"><X size={22} /></button></header>
            <div className="cardio-calendar-toolbar">
              <button type="button" onClick={() => setCalendarMonthMs(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1).getTime())}><ChevronLeft size={20} /></button>
              <strong>{formatCardioMonth(calendarMonth)}</strong>
              <button type="button" onClick={() => setCalendarMonthMs(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1).getTime())}><ChevronRight size={20} /></button>
            </div>
            <div className="cardio-full-calendar">
              {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((label) => <span className="cardio-calendar-weekday" key={label}>{label}</span>)}
              {calendarCells.map((day) => (
                <button
                  className={`${day.currentMonth ? "" : "is-outside"} ${day.total > 0 ? "has-cardio" : ""} ${calendarSelectedKey === day.key ? "is-selected" : ""}`}
                  key={day.key}
                  onClick={() => setCalendarSelectedKey(day.key)}
                  type="button"
                >
                  <span>{day.date.getDate()}</span>{day.total > 0 && <small>{day.total} min</small>}
                </button>
              ))}
            </div>
            <div className="cardio-calendar-detail">
              <h3>{calendarSelectedKey ? `Registros de ${calendarSelectedKey.split('-').reverse().join('/')}` : "Selecione um dia"}</h3>
              {calendarSelectedKey && calendarDayRecords.length === 0 && <p>Sem cardio registrado neste dia.</p>}
              {calendarDayRecords.map((item) => <p key={item.id}><strong>{item.atividade}</strong><span>{item.tempoMin} min · {item.ritmo} · {item.dataHora.slice(11)}</span></p>)}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function ProgressView({
  services,
  profile,
  target,
  progress,
  notify
}: {
  services: FirebaseServices;
  profile: UserProfile;
  target: TrainerStudent | { uid: string; name: string } | null;
  progress: ProgressRecord[];
  notify: (kind: Notice["kind"], text: string) => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pesoKg, setPesoKg] = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({ frente: null, lado: null, costas: null });
  const [busy, setBusy] = useState(false);

  async function uploadPhoto(uid: string, id: string, name: string, file: File | null) {
    if (!file) return null;
    const storageRef = ref(services.storage, `users/${uid}/progresso/${id}/${name}.jpg`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async function saveProgress(event: FormEvent) {
    event.preventDefault();
    if (!target) return;
    const parsedWeight = parseNumber(pesoKg);
    if (!parsedWeight) {
      notify("warn", "Informe o peso.");
      return;
    }

    setBusy(true);
    try {
      const id = newId("prog-");
      const [fotoFrenteUri, fotoLadoUri, fotoCostasUri] = await Promise.all([
        uploadPhoto(target.uid, id, "frente", files.frente),
        uploadPhoto(target.uid, id, "lado", files.lado),
        uploadPhoto(target.uid, id, "costas", files.costas)
      ]);
      await setDoc(doc(services.db, "users", target.uid, "progresso", id), {
        id,
        data: formatDate(new Date(`${date}T12:00:00`)),
        pesoKg: parsedWeight,
        fotoFrenteUri,
        fotoLadoUri,
        fotoCostasUri,
        createdAt: Date.now()
      });
      setPesoKg("");
      setFiles({ frente: null, lado: null, costas: null });
      notify("ok", "Progresso salvo.");
    } catch (error) {
      notify("error", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!target) return <EmptyPage title="Selecione um aluno no Perfil" />;

  return (
    <section className="screen progress-screen">
      {profile.role === "ALUNO" && (
        <article className="panel">
          <SectionTitle icon={Camera} title="Registrar progresso" />
          <form className="inline-form wide" onSubmit={saveProgress}>
            <label className="field">
              <span>Data</span>
              <input value={date} onChange={(event) => setDate(event.target.value)} type="date" />
            </label>
            <TextInput label="Peso kg" value={pesoKg} onChange={setPesoKg} />
            <FileInput label="Frente" onChange={(file) => setFiles((current) => ({ ...current, frente: file }))} />
            <FileInput label="Lado" onChange={(file) => setFiles((current) => ({ ...current, lado: file }))} />
            <FileInput label="Costas" onChange={(file) => setFiles((current) => ({ ...current, costas: file }))} />
            <button className="primary-btn" disabled={busy} type="submit">
              <Save size={18} />
              Salvar
            </button>
          </form>
        </article>
      )}

      <article className="panel">
        <SectionTitle icon={Clipboard} title="Progresso" />
        <div className="progress-grid">
          {progress.length === 0 && <EmptyState title="Sem progresso registrado" />}
          {progress.map((item) => (
            <div className="progress-card" key={item.id}>
              <div className="progress-meta">
                <strong>{item.data}</strong>
                <span>{item.pesoKg.toFixed(1)} kg</span>
              </div>
              <div className="photo-row">
                {[item.fotoFrenteUri, item.fotoLadoUri, item.fotoCostasUri].map((src, index) =>
                  src ? <img alt={`Progresso ${index + 1}`} key={src} src={src} /> : <div className="photo-empty" key={index}>Foto</div>
                )}
              </div>
              {profile.role === "ALUNO" && (
                <button className="ghost-btn danger" onClick={() => deleteDoc(doc(services.db, "users", target.uid, "progresso", item.id))} type="button">
                  <Trash2 size={16} />
                  Apagar
                </button>
              )}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function AdminDashboard({
  services,
  profile,
  allUsers,
  inviteRequests,
  notify
}: {
  services: FirebaseServices;
  profile: UserProfile;
  allUsers: UserProfile[];
  inviteRequests: InviteRequest[];
  notify: (kind: Notice["kind"], text: string) => void;
}) {
  const [lastCodes, setLastCodes] = useState<string[]>([]);
  const trainers = allUsers.filter((user) => user.role === "TREINADOR");
  const students = allUsers.filter((user) => user.role === "ALUNO");

  async function generateTrainerCode() {
    try {
      const code = await createInviteCode(services, "TREINADOR", profile.uid, null);
      setLastCodes([code]);
      notify("ok", "Código de treinador gerado.");
    } catch (error) {
      notify("error", (error as Error).message);
    }
  }

  async function approve(request: InviteRequest) {
    try {
      const codes = await approveInviteRequest(services, request.id, request.trainerUid, request.qty, profile.uid);
      setLastCodes(codes);
      notify("ok", "Pedido aprovado.");
    } catch (error) {
      notify("error", (error as Error).message);
    }
  }

  async function reject(request: InviteRequest) {
    await rejectInviteRequest(services, request.id, profile.uid);
    notify("ok", "Pedido rejeitado.");
  }

  return (
    <section className="screen">
      <div className="summary-row">
        <Metric label="Treinadores" value={String(trainers.length)} />
        <Metric label="Alunos" value={String(students.length)} />
        <Metric label="Pedidos pendentes" value={String(inviteRequests.length)} />
      </div>

      <div className="grid two">
        <article className="panel">
          <div className="panel-heading split">
            <SectionTitle icon={ShieldCheck} title="Códigos" />
            <button className="primary-btn" onClick={generateTrainerCode} type="button">
              <Plus size={18} />
              Treinador
            </button>
          </div>
          <div className="code-grid">
            {lastCodes.length === 0 && <EmptyState title="Nenhum código gerado nesta sessão" />}
            {lastCodes.map((code) => (
              <button className="code-pill" key={code} onClick={() => navigator.clipboard?.writeText(code)} type="button">
                <Clipboard size={15} />
                {code}
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <SectionTitle icon={Clipboard} title="Pedidos" />
          <div className="list">
            {inviteRequests.length === 0 && <EmptyState title="Sem pedidos pendentes" />}
            {inviteRequests.map((request) => (
              <div className="list-row" key={request.id}>
                <div>
                  <strong>{request.trainerName}</strong>
                  <small>{request.qty} código(s)</small>
                </div>
                <div className="action-row tight">
                  <button className="secondary-btn" onClick={() => reject(request)} type="button">
                    Rejeitar
                  </button>
                  <button className="primary-btn" onClick={() => approve(request)} type="button">
                    Aprovar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="panel">
        <SectionTitle icon={Users} title="Treinadores" />
        <div className="list">
          {trainers.map((trainer) => (
            <div className="list-row" key={trainer.uid}>
              <div>
                <strong>{trainer.name}</strong>
                <small>{trainer.email}</small>
              </div>
              <span className={trainer.active ? "badge" : "badge muted"}>{trainer.active ? "Ativo" : "Inativo"}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function RedeemCodeForm({ busy, onRedeem }: { busy: boolean; onRedeem: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form
      className="redeem-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim()) onRedeem(code);
      }}
    >
      <TextInput label="Código" value={code} onChange={(value) => setCode(value.toUpperCase())} />
      <button className="primary-btn" disabled={busy} type="submit">
        <Check size={18} />
        Liberar
      </button>
    </form>
  );
}

function BlockedShell({
  title,
  message,
  children,
  onLogout
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
  onLogout: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-block">
          <span className="brand-mark">
            <ShieldCheck size={28} />
          </span>
          <div>
            <h1>{title}</h1>
            <p>{message}</p>
          </div>
        </div>
        {children}
        <button className="ghost-btn danger" onClick={onLogout} type="button">
          <LogOut size={16} />
          Sair
        </button>
      </section>
    </main>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        autoComplete={autoComplete}
        disabled={disabled}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FileInput({ label, onChange }: { label: string; onChange: (file: File | null) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input accept="image/*" type="file" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
    </label>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="section-title">
      <Icon size={19} />
      <h3>{title}</h3>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({ title }: { title: string }) {
  return <p className="empty-state">{title}</p>;
}

function EmptyPage({ title }: { title: string }) {
  return (
    <section className="screen">
      <article className="panel center-panel">
        <EmptyState title={title} />
      </article>
    </section>
  );
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <main className="auth-page">
      <section className="auth-panel loading-card">
        <span className="loader" />
        <h1>{text}</h1>
      </section>
    </main>
  );
}

export default App;
