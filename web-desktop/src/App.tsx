import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Camera,
  Check,
  Clipboard,
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
  parseNumber,
  progressFromDoc,
  redeemInviteCode,
  rejectInviteRequest,
  safeDocId,
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
      return `O Firebase recusou este endereÃ§o (${host}). Adicione ${host} em Firebase Authentication > Settings > Authorized domains.`;
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "A chave apiKey do Firebase Web nÃ£o Ã© vÃ¡lida para este projeto.";
    case "auth/configuration-not-found":
      return "A configuraÃ§Ã£o do Firebase Auth nÃ£o foi encontrada. Confira se Email/Senha estÃ¡ ativado no Firebase Authentication.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email ou senha invÃ¡lidos.";
    case "auth/email-already-in-use":
      return "Este email jÃ¡ estÃ¡ cadastrado. Use Entrar.";
    case "auth/invalid-email":
      return "Email invÃ¡lido.";
    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    case "auth/network-request-failed":
      return "Falha de conexÃ£o com o Firebase. Verifique a internet e tente novamente.";
    case "permission-denied":
      return "O Firebase bloqueou o acesso aos dados. Confira as regras do Firestore para usuÃ¡rios autenticados.";
    case "failed-precondition":
      return "O Firestore pediu uma configuraÃ§Ã£o extra para esta consulta. Abra o console do navegador para ver o link de criaÃ§Ã£o do Ã­ndice.";
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
  return {
    uid,
    name: String(data?.name ?? "Sem nome"),
    email: String(data?.email ?? fallbackEmail),
    role: normalizeRole(data?.role),
    active: Boolean(data?.active ?? true),
    approved: Boolean(data?.approved ?? false),
    trainerId: typeof data?.trainerId === "string" ? data.trainerId : null,
    idade: typeof data?.idade === "number" ? data.idade : undefined,
    alturaCm: typeof data?.alturaCm === "number" ? data.alturaCm : undefined
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
    exercicios: rawExercises.map((item: unknown) => {
      const ex = item as Record<string, unknown>;
      const seriesRaw = Array.isArray(ex.series) ? ex.series : [];
      return {
        nomeExercicio: String(ex.nomeExercicio ?? "ExercÃ­cio"),
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
        query(collection(services.db, "users", target.uid, "treino_registros"), orderBy("createdAt", "desc")),
        (snap) => {
          setRecords(snap.docs.map((item) => workoutRecordFromDoc(item.id, item.data())));
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
        query(collection(services.db, "users", target.uid, "cardio"), orderBy("createdAt", "desc")),
        (snap) => {
          setCardio(snap.docs.map((item) => cardioFromDoc(item.id, item.data())));
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
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar cÃ³digos."))
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
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar notificaÃ§Ãµes."))
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
      (error) => notify("error", firebaseErrorMessage(error, "Erro ao carregar usuÃ¡rios."))
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
      notify("warn", "SeleÃ§Ã£o de aluno limpa.");
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
      <BlockedShell title="Conta bloqueada" message="Insira o cÃ³digo recebido para liberar o acesso." onLogout={handleLogout}>
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
            <p>ConfiguraÃ§Ã£o Firebase</p>
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
            Salvar configuraÃ§Ã£o
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
        notify("ok", "Conta criada. Insira o cÃ³digo para liberar.");
      }
    } catch (error) {
      notify(
        "error",
        firebaseErrorMessage(error, mode === "login" ? "NÃ£o foi possÃ­vel entrar." : "NÃ£o foi possÃ­vel criar a conta.")
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
          ConfiguraÃ§Ã£o Firebase
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
  const [requestQty, setRequestQty] = useState("5");

  async function saveStudentData(event: FormEvent) {
    event.preventDefault();
    const idade = Number(age);
    const alturaCm = parseNumber(height);
    if (!idade || idade < 10 || idade > 100 || alturaCm < 100 || alturaCm > 250) {
      notify("warn", "Preencha idade e altura vÃ¡lidas.");
      return;
    }

    await updateDoc(doc(services.db, "users", profile.uid), { idade, alturaCm });
    notify("ok", "Dados do aluno salvos.");
  }

  async function requestCodes(event: FormEvent) {
    event.preventDefault();
    const qty = Number(requestQty);
    if (!qty || qty < 1) {
      notify("warn", "Quantidade invÃ¡lida.");
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
      notify("warn", "NÃ£o hÃ¡ notificaÃ§Ãµes pendentes.");
      return;
    }

    await Promise.all(unread.map((item) => updateDoc(doc(services.db, "users", profile.uid, "notifications", item.id), { read: true })));
    notify("ok", "NotificaÃ§Ãµes marcadas como lidas.");
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
              <dd>{profile.approved ? "Liberado" : "Aguardando cÃ³digo"}</dd>
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
            <Metric label="Ãšltimo treino" value={latestRecord ? `${latestRecord.nomeTreino} Â· ${latestRecord.dataHora}` : "Sem registros"} />
            <Metric label="Ãšltimo peso" value={latestProgress ? `${latestProgress.pesoKg.toFixed(1)} kg` : "Sem registros"} />
            <Metric label="Ãšltimo cardio" value={latestCardio ? `${latestCardio.atividade} Â· ${latestCardio.tempoMin}min` : "Sem registros"} />
          </div>

          <article className="panel">
            <SectionTitle icon={Clipboard} title={`AtualizaÃ§Ãµes do treinador (${notifications.filter((item) => !item.read).length})`} />
            <div className="list compact-list">
              {notifications.length === 0 && <EmptyState title="Sem novas atualizaÃ§Ãµes" />}
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
            <SectionTitle icon={Clipboard} title="CÃ³digos de aluno" />
            <div className="code-grid">
              {inviteCodes.length === 0 && <EmptyState title="Sem cÃ³digos disponÃ­veis" />}
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

  if (profile.role !== "ALUNO") return <EmptyPage title="Treino disponÃ­vel para aluno" />;
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
                  {exercise.series} sÃ©ries Â· {exercise.repsMin}-{exercise.repsMax} reps Â· {exercise.descanso}
                </small>
              </div>
              <div className="series-grid">
                {Array.from({ length: exercise.series }, (_, serieIndex) => {
                  const serieNumero = serieIndex + 1;
                  const key = `${exIndex}-${serieNumero}`;
                  const current = seriesValues[key] ?? { kg: "", reps: "" };
                  return (
                    <div className="series-row" key={key}>
                      <span>SÃ©rie {serieNumero}</span>
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
      notify("warn", "Informe o nome do exercÃ­cio.");
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
      notify("warn", "SÃ©ries e repetiÃ§Ãµes precisam ser nÃºmeros inteiros maiores que zero.");
      return;
    }

    if (draftExercise.repsMin > draftExercise.repsMax) {
      notify("warn", "A repetiÃ§Ã£o mÃ­nima nÃ£o pode ser maior que a mÃ¡xima.");
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
      notify("warn", "Informe o treino e pelo menos um exercÃ­cio.");
      return;
    }

    const nextWorkoutId = safeDocId(trimmedName);
    if (workouts.some((workout) => workout.id !== editingId && workout.id === nextWorkoutId)) {
      notify("warn", "JÃ¡ existe outro treino com esse nome.");
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
      notify("error", firebaseErrorMessage(error, "NÃ£o foi possÃ­vel salvar o treino."));
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
      notify("error", firebaseErrorMessage(error, "NÃ£o foi possÃ­vel remover o treino."));
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
      notify("error", firebaseErrorMessage(error, "NÃ£o foi possÃ­vel atualizar a ordem dos treinos."));
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

  if (profile.role !== "TREINADOR") return <EmptyPage title="Montagem disponÃ­vel para treinador" />;
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
                  <strong>Editando exercÃ­cio</strong>
                  <button className="ghost-btn" onClick={cancelExerciseEdit} type="button">
                    <X size={16} />
   8ó^m¢G§²ÚîÆ­yØ[™^
HO‚ˆÜ˜ÈÈ[YÈ[^Ø›ÙÜ™\ÜÛÈ	Ú[™^
È_XHÙ^O^ÜÜ˜ßHÜ˜Ï^ÜÜ˜ßHÏˆˆ]ˆÛ\ÜÓ˜[YOHœİËY[\HˆÙ^O^Ú[™^O‘›İÏÙ]‚ˆ
_BˆÙ]‚ˆÜ›Ùš[Kœ›ÛHOOHSS“Èˆ	‰ˆ
ˆ]ÛˆÛ\ÜÓ˜[YOH™ÚÜİXˆ[™Ù\ˆˆÛÛXÚÏ^Ê
HOˆ[]QØÊØÊÙ\šXÙ\Ë™‹\Ù\œÈ‹\™Ù]ZYœ›ÙÜ™\ÜÛÈ‹][KšY
J_H\OH˜]Ûˆ‚ˆ˜\ÚˆÚ^™O^ÌMŸHÏ‚ˆ\YØ\‚ˆØ]Û‚ˆ
_BˆÙ]‚ˆ
J_BˆÙ]‚ˆØ\XÛO‚ˆÜÙXİ[Û‚ˆ
NÂŸB‚™[˜İ[ÛˆYZ[‘\Ú›Ø\™
ÂˆÙ\šXÙ\Ëˆ›Ùš[Kˆ[\Ù\œËˆ[š]T™\]Y\İËˆ›İYBŸNˆÂˆÙ\šXÙ\Îˆš\™X˜\ÙTÙ\šXÙ\ÎÂˆ›Ùš[Nˆ\Ù\”›Ùš[NÂˆ[\Ù\œÎˆ\Ù\”›Ùš[V×NÂˆ[š]T™\]Y\İÎˆ[š]T™\]Y\İ×NÂˆ›İYNˆ
Ú[™ˆ›İXÙVÈšÚ[™—K^ˆİš[™ÊHOˆ›ÚYÂŸJHÂˆÛÛœİÛ\İÛÙ\ËÙ]\İÛÙ\×HH\ÙTİ]Oİš[™Ö×OŠ×JNÂˆÛÛœİ˜Z[™\œÈH[\Ù\œË™š[\Š
\Ù\ŠHOˆ\Ù\‹œ›ÛHOOH•‘RSQÔˆŠNÂˆÛÛœİİY[ÈH[\Ù\œË™š[\Š
\Ù\ŠHOˆ\Ù\‹œ›ÛHOOHSS“ÈŠNÂ‚ˆ\Ş[˜È[˜İ[ÛˆÙ[™\˜]U˜Z[™\ÛÙJ
HÂˆHÂˆÛÛœİÛÙHH]ØZ]Ü™X]R[š]PÛÙJÙ\šXÙ\Ë•‘RSQÔˆ‹›Ùš[KZY[
NÂˆÙ]\İÛÙ\ÊØÛÙWJNÂˆ›İYJ›ÚÈ‹ğìÙYÛÈH™Z[˜YÜˆÙ\˜YËˆŠNÂˆHØ]Ú
\œ›ÜŠHÂˆ›İYJ™\œ›Üˆ‹
\œ›Üˆ\È\œ›ÜŠK›Y\ÜØYÙJNÂˆBˆB‚ˆ\Ş[˜È[˜İ[Ûˆ\›İ™J™\]Y\İˆ[š]T™\]Y\İ
HÂˆHÂˆÛÛœİÛÙ\ÈH]ØZ]\›İ™R[š]T™\]Y\İ
Ù\šXÙ\Ë™\]Y\İšY™\]Y\İ˜Z[™\•ZY™\]Y\İœ]K›Ùš[KZY
NÂˆÙ]\İÛÙ\ÊÛÙ\ÊNÂˆ›İYJ›ÚÈ‹”YYÈ\›İ˜YËˆŠNÂˆHØ]Ú
\œ›ÜŠHÂˆ›İYJ™\œ›Üˆ‹
\œ›Üˆ\È\œ›ÜŠK›Y\ÜØYÙJNÂˆBˆB‚ˆ\Ş[˜È[˜İ[Ûˆ™Z™Xİ
™\]Y\İˆ[š]T™\]Y\İ
HÂˆ]ØZ]™Z™Xİ[š]T™\]Y\İ
Ù\šXÙ\Ë™\]Y\İšY›Ùš[KZY
NÂˆ›İYJ›ÚÈ‹”YYÈ™Z™Z]YËˆŠNÂˆB‚ˆ™]\›ˆ
ˆÙXİ[ÛˆÛ\ÜÓ˜[YOHœØÜ™Y[ˆ‚ˆ]ˆÛ\ÜÓ˜[YOHœİ[[X\K\›İÈ‚ˆY]šXÈX™[H•™Z[˜YÜ™\Èˆ˜[YO^Ôİš[™Ê˜Z[™\œË›[™İ
_HÏ‚ˆY]šXÈX™[H[[›ÜÈˆ˜[YO^Ôİš[™ÊİY[Ë›[™İ
_HÏ‚ˆY]šXÈX™[H”YYÜÈ[™[\Èˆ˜[YO^Ôİš[™Ê[š]T™\]Y\İË›[™İ
_HÏ‚ˆÙ]‚‚ˆ]ˆÛ\ÜÓ˜[YOH™ÜšYÛÈ‚ˆ\XÛHÛ\ÜÓ˜[YOHœ[™[‚ˆ]ˆÛ\ÜÓ˜[YOHœ[™[ZXY[™ÈÜ]‚ˆÙXİ[Û•]HXÛÛ^ÔÚY[ÚXÚßH]OHğìÙYÛÜÈˆÏ‚ˆ]ÛˆÛ\ÜÓ˜[YOHœš[X\KXˆˆÛÛXÚÏ^ÙÙ[™\˜]U˜Z[™\ÛÙ_H\OH˜]Ûˆ‚ˆ\ÈÚ^™O^ÌNHÏ‚ˆ™Z[˜YÜ‚ˆØ]Û‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH˜ÛÙKYÜšY‚ˆÛ\İÛÙ\Ë›[™İOOH	‰ˆ[\Tİ]H]OH“™[š[HğìÙYÛÈÙ\˜YÈ™\İHÙ\ÜğèÛÈˆÏŸBˆÛ\İÛÙ\Ë›X\

ÛÙJHOˆ
ˆ]ÛˆÛ\ÜÓ˜[YOH˜ÛÙK\[ˆÙ^O^ØÛÙ_HÛÛXÚÏ^Ê
HOˆ˜]šYØ]Ü‹˜Û\›Ø\™ËÜš]U^
ÛÙJ_H\OH˜]Ûˆ‚ˆÛ\›Ø\™Ú^™O^ÌM_HÏ‚ˆØÛÙ_BˆØ]Û‚ˆ
J_BˆÙ]‚ˆØ\XÛO‚‚ˆ\XÛHÛ\ÜÓ˜[YOHœ[™[‚ˆÙXİ[Û•]HXÛÛ^ĞÛ\›Ø\™H]OH”YYÜÈˆÏ‚ˆ]ˆÛ\ÜÓ˜[YOH›\İ‚ˆÚ[š]T™\]Y\İË›[™İOOH	‰ˆ[\Tİ]H]OH”Ù[HYYÜÈ[™[\ÈˆÏŸBˆÚ[š]T™\]Y\İË›X\

™\]Y\İ
HOˆ
ˆ]ˆÛ\ÜÓ˜[YOH›\İ\›İÈˆÙ^O^Ü™\]Y\İšYO‚ˆ]‚ˆİ›Û™ÏÜ™\]Y\İ˜Z[™\“˜[Y_OÜİ›Û™Ï‚ˆÛX[Ü™\]Y\İœ]_HğìÙYÛÊÊOÜÛX[‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH˜Xİ[Û‹\›İÈYÚ‚ˆ]ÛˆÛ\ÜÓ˜[YOHœÙXÛÛ™\KXˆˆÛÛXÚÏ^Ê
HOˆ™Z™Xİ
™\]Y\İ
_H\OH˜]Ûˆ‚ˆ™Z™Z]\‚ˆØ]Û‚ˆ]ÛˆÛ\ÜÓ˜[YOHœš[X\KXˆˆÛÛXÚÏ^Ê
HOˆ\›İ™J™\]Y\İ
_H\OH˜]Ûˆ‚ˆ\›İ˜\‚ˆØ]Û‚ˆÙ]‚ˆÙ]‚ˆ
J_BˆÙ]‚ˆØ\XÛO‚ˆÙ]‚‚ˆ\XÛHÛ\ÜÓ˜[YOHœ[™[‚ˆÙXİ[Û•]HXÛÛ^Õ\Ù\œßH]OH•™Z[˜YÜ™\ÈˆÏ‚ˆ]ˆÛ\ÜÓ˜[YOH›\İ‚ˆİ˜Z[™\œË›X\

˜Z[™\ŠHOˆ
ˆ]ˆÛ\ÜÓ˜[YOH›\İ\›İÈˆÙ^O^İ˜Z[™\‹ZYO‚ˆ]‚ˆİ›Û™Ïİ˜Z[™\‹›˜[Y_OÜİ›Û™Ï‚ˆÛX[İ˜Z[™\‹™[XZ[OÜÛX[‚ˆÙ]‚ˆÜ[ˆÛ\ÜÓ˜[YO^İ˜Z[™\‹˜Xİ]™HÈ˜˜YÙHˆˆ˜˜YÙH]]YŸOİ˜Z[™\‹˜Xİ]™HÈ]]›Èˆˆ’[˜]]›ÈŸOÜÜ[‚ˆÙ]‚ˆ
J_BˆÙ]‚ˆØ\XÛO‚ˆÜÙXİ[Û‚ˆ
NÂŸB‚™[˜İ[Ûˆ™YY[PÛÙQ›Ü›JÈ\ŞKÛ”™YY[HNˆÈ\ŞNˆ›ÛÛX[ÈÛ”™YY[Nˆ
ÛÙNˆİš[™ÊHOˆ›ÚYJHÂˆÛÛœİØÛÙKÙ]ÛÙWHH\ÙTİ]JˆŠNÂˆ™]\›ˆ
ˆ›Ü›BˆÛ\ÜÓ˜[YOHœ™YY[KY›Ü›H‚ˆÛ”İX›Z]^Ê]™[
HOˆÂˆ]™[œ™]™[Y˜][

NÂˆYˆ
ÛÙKš[J
JHÛ”™YY[JÛÙJNÂˆ_Bˆ‚ˆ^[œ]X™[HğìÙYÛÈˆ˜[YO^ØÛÙ_HÛÚ[™ÙO^Ê˜[YJHOˆÙ]ÛÙJ˜[YKÕ\\Ø\ÙJ
J_HÏ‚ˆ]ÛˆÛ\ÜÓ˜[YOHœš[X\KXˆˆ\ØX›Y^Ø\Ş_H\OHœİX›Z]‚ˆÚXÚÈÚ^™O^ÌNHÏ‚ˆX™\˜\‚ˆØ]Û‚ˆÙ›Ü›O‚ˆ
NÂŸB‚™[˜İ[Ûˆ›ØÚÙYÚ[
Âˆ]KˆY\ÜØYÙKˆÚ[™[‹ˆÛ“ÙÛİ]ŸNˆÂˆ]Nˆİš[™ÎÂˆY\ÜØYÙNˆİš[™ÎÂˆÚ[™[Îˆ™XXİ”™XXİ›ÙNÂˆÛ“ÙÛİ]ˆ

HOˆ›ÚYÂŸJHÂˆ™]\›ˆ
ˆXZ[ˆÛ\ÜÓ˜[YOH˜]]\YÙH‚ˆÙXİ[ÛˆÛ\ÜÓ˜[YOH˜]]\[™[‚ˆ]ˆÛ\ÜÓ˜[YOH˜œ˜[™X›ØÚÈ‚ˆÜ[ˆÛ\ÜÓ˜[YOH˜œ˜[™[X\šÈ‚ˆÚY[ÚXÚÈÚ^™O^ÌHÏ‚ˆÜÜ[‚ˆ]‚ˆOİ]_OÚO‚ˆÛY\ÜØYÙ_OÜ‚ˆÙ]‚ˆÙ]‚ˆØÚ[™[ŸBˆ]ÛˆÛ\ÜÓ˜[YOH™ÚÜİXˆ[™Ù\ˆˆÛÛXÚÏ^ÛÛ“ÙÛİ]H\OH˜]Ûˆ‚ˆÙÓİ]Ú^™O^ÌMŸHÏ‚ˆØZ\‚ˆØ]Û‚ˆÜÙXİ[Û‚ˆÛXZ[‚ˆ
NÂŸB‚™[˜İ[Ûˆ^[œ]
ÂˆX™[ˆ˜[YKˆÛÚ[™ÙKˆ\HH^‹ˆ]]ĞÛÛ\]Kˆ\ØX›YH˜[ÙBŸNˆÂˆX™[ˆİš[™ÎÂˆ˜[YNˆİš[™ÎÂˆÛÚ[™ÙNˆ
˜[YNˆİš[™ÊHOˆ›ÚYÂˆ\OÎˆİš[™ÎÂˆ]]ĞÛÛ\]OÎˆİš[™ÎÂˆ\ØX›YÎˆ›ÛÛX[ÂŸJHÂˆ™]\›ˆ
ˆX™[Û\ÜÓ˜[YOH™šY[‚ˆÜ[ÛX™[OÜÜ[‚ˆ[œ]ˆ]]ĞÛÛ\]O^Ø]]ĞÛÛ\]_Bˆ\ØX›Y^Ù\ØX›YBˆ\O^İ\_Bˆ˜[YO^İ˜[Y_BˆÛÚ[™ÙO^Ê]™[
HOˆÛÚ[™ÙJ]™[\™Ù]˜[YJ_BˆÏ‚ˆÛX™[‚ˆ
NÂŸB‚™[˜İ[Ûˆš[R[œ]
ÈX™[ÛÚ[™ÙHNˆÈX™[ˆİš[™ÎÈÛÚ[™ÙNˆ
š[Nˆš[H[
HOˆ›ÚYJHÂˆ™]\›ˆ
ˆX™[Û\ÜÓ˜[YOH™šY[‚ˆÜ[ÛX™[OÜÜ[‚ˆ[œ]XØÙ\Hš[XYÙKÊˆˆ\OH™š[HˆÛÚ[™ÙO^Ê]™[
HOˆÛÚ[™ÙJ]™[\™Ù]™š[\ÏË–ÌHÏÈ[
_HÏ‚ˆÛX™[‚ˆ
NÂŸB‚™[˜İ[ÛˆÙXİ[Û•]JÈXÛÛˆXÛÛ‹]HNˆÈXÛÛˆ™XXİ‘[[Y[\NÈ]Nˆİš[™ÈJHÂˆ™]\›ˆ
ˆ]ˆÛ\ÜÓ˜[YOHœÙXİ[Û‹]]H‚ˆXÛÛˆÚ^™O^ÌN_HÏ‚ˆÏİ]_OÚÏ‚ˆÙ]‚ˆ
NÂŸB‚™[˜İ[ÛˆY]šXÊÈX™[˜[YHNˆÈX™[ˆİš[™ÎÈ˜[YNˆİš[™ÈJHÂˆ™]\›ˆ
ˆ\XÛHÛ\ÜÓ˜[YOH›Y]šXÈ‚ˆÜ[ÛX™[OÜÜ[‚ˆİ›Û™Ïİ˜[Y_OÜİ›Û™Ï‚ˆØ\XÛO‚ˆ
NÂŸB‚™[˜İ[Ûˆ[\Tİ]JÈ]HNˆÈ]Nˆİš[™ÈJHÂˆ™]\›ˆÛ\ÜÓ˜[YOH™[\K\İ]Hİ]_OÜÂŸB‚™[˜İ[Ûˆ[\TYÙJÈ]HNˆÈ]Nˆİš[™ÈJHÂˆ™]\›ˆ
ˆÙXİ[ÛˆÛ\ÜÓ˜[YOHœØÜ™Y[ˆ‚ˆ\XÛHÛ\ÜÓ˜[YOHœ[™[Ù[\‹\[™[‚ˆ[\Tİ]H]O^İ]_HÏ‚ˆØ\XÛO‚ˆÜÙXİ[Û‚ˆ
NÂŸB‚™[˜İ[ÛˆØY[™ÔØÜ™Y[ŠÈ^NˆÈ^ˆİš[™ÈJHÂˆ™]\›ˆ
ˆXZ[ˆÛ\ÜÓ˜[YOH˜]]\YÙH‚ˆÙXİ[ÛˆÛ\ÜÓ˜[YOH˜]]\[™[ØY[™ËXØ\™‚ˆÜ[ˆÛ\ÜÓ˜[YOH›ØY\ˆˆÏ‚ˆOİ^OÚO‚ˆÜÙXİ[Û‚ˆÛXZ[‚ˆ
NÂŸB‚™^ÜY˜][\Â