import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { analyzeOnboarding, getApiBaseUrl, isApiConfigured, verifyEvidence } from "./focuslockApi";
import { storage } from "./storage";

const screens = {
  BOOT: "boot",
  WELCOME: "welcome",
  ONBOARDING: "onboarding",
  LOADING: "loading",
  DASHBOARD: "dashboard",
  ADD_TASK: "add_task",
  LOCKED: "locked",
  CAMERA: "camera",
  RESULT: "result",
};

const taskCategories = [
  { id: "work", label: "Trabalho" },
  { id: "study", label: "Estudo" },
  { id: "physical", label: "Exercicio" },
  { id: "family", label: "Familia" },
  { id: "home", label: "Casa" },
];

const onboardingQuestions = [
  {
    id: "distraction",
    q: "Com que frequencia voce abandona tarefas por distracao?",
    opts: ["Raramente", "As vezes", "Com frequencia", "Automatico"],
  },
  {
    id: "impulse",
    q: "Voce pega o celular por impulso sem perceber?",
    opts: ["Nunca", "Ocasionalmente", "Bastante", "Sempre"],
  },
  {
    id: "procrastination",
    q: "Como voce lida com tarefas longas sem recompensa imediata?",
    opts: ["Foco bem", "Vou com esforco", "Procrastino muito", "Evito"],
  },
  {
    id: "goal",
    q: "O que voce quer recuperar com menos tela?",
    opts: ["Foco", "Trabalho", "Familia", "Saude"],
  },
  {
    id: "social",
    q: "O celular atrapalha momentos com pessoas proximas?",
    opts: ["Nunca", "Raramente", "Com frequencia", "Sempre"],
  },
  {
    id: "peak",
    q: "Seu melhor periodo de produtividade?",
    opts: ["Manha", "Tarde", "Noite", "Variavel"],
  },
];

function inferProfile(answers) {
  const distraction = answers.distraction || "As vezes";
  const impulse = answers.impulse || "Ocasionalmente";
  const procrastination = answers.procrastination || "Vou com esforco";
  const levelSignals = [
    distraction === "Automatico" || distraction === "Com frequencia",
    impulse === "Bastante" || impulse === "Sempre",
    procrastination === "Procrastino muito" || procrastination === "Evito",
  ].filter(Boolean).length;
  const level = levelSignals >= 2 ? "alto" : levelSignals === 1 ? "medio" : "baixo";

  return {
    tipo: level === "alto" ? "Mente Acelerada" : level === "medio" ? "Foco Intermitente" : "Foco Estruturado",
    subtitulo: "Controle real com friccao intencional.",
    nivel_impulsividade: level,
    nivel: level,
    pico_produtividade: answers.peak || "Manha",
    pico: answers.peak || "Manha",
    estrategia: "Defina blocos curtos, acione bloqueio real e valide conclusao com camera.",
    versao_onboarding: 1,
  };
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));
}

export default function FocusLockMobileApp() {
  const [screen, setScreen] = useState(screens.BOOT);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [emergencyLogs, setEmergencyLogs] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskEvidence, setNewTaskEvidence] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("work");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [trustCode, setTrustCode] = useState("1234");
  const [emergencyInput, setEmergencyInput] = useState("");
  const [emergencyTap, setEmergencyTap] = useState(0);
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const [verification, setVerification] = useState(null);
  const [loadMessage, setLoadMessage] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const emergencyTimerRef = useRef(null);
  const apiConfigured = isApiConfigured();
  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    (async () => {
      const [savedProfile, savedTasks, savedCode, savedHistory, savedEmergencyLogs] = await Promise.all([
        storage.get("fl:profile"),
        storage.get("fl:tasks", []),
        storage.get("fl:trustcode", "1234"),
        storage.get("fl:history", []),
        storage.get("fl:emergency_logs", []),
      ]);

      if (savedProfile) setProfile(savedProfile);
      if (savedTasks) setTasks(savedTasks);
      if (savedCode) setTrustCode(savedCode);
      if (savedHistory) setHistory(savedHistory);
      if (savedEmergencyLogs) setEmergencyLogs(savedEmergencyLogs);

      setScreen(savedProfile ? screens.DASHBOARD : screens.WELCOME);
    })();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const hhmm = `${hh}:${mm}`;
      const due = tasks.find((task) => !task.done && !task.triggered && task.time && task.time <= hhmm);
      if (due) {
        const updated = tasks.map((task) => (task.id === due.id ? { ...task, triggered: true } : task));
        setTasks(updated);
        storage.set("fl:tasks", updated);
        setActiveTask(due);
        setScreen(screens.LOCKED);
      }
    }, 20000);

    return () => clearInterval(id);
  }, [tasks]);

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);

  async function saveTasks(updated) {
    setTasks(updated);
    await storage.set("fl:tasks", updated);
  }

  async function saveHistory(updated) {
    setHistory(updated);
    await storage.set("fl:history", updated);
  }

  async function saveEmergencyLogs(updated) {
    setEmergencyLogs(updated);
    await storage.set("fl:emergency_logs", updated);
  }

  async function finishOnboarding() {
    setLoadMessage("Analisando seu perfil com IA...");
    setScreen(screens.LOADING);

    let nextProfile = inferProfile(answers);

    if (apiConfigured) {
      try {
        const response = await analyzeOnboarding(answers);
        if (response?.profile) {
          nextProfile = response.profile;
        }
      } catch (error) {
        Alert.alert("Onboarding com fallback", error.message || "Falha ao analisar onboarding na API.");
      }
    }

    setProfile(nextProfile);
    await storage.set("fl:profile", nextProfile);
    setOnboardingStep(0);
    setAnswers({});
    setScreen(screens.DASHBOARD);
  }

  function addTask() {
    if (!newTaskName || !newTaskTime || !newTaskEvidence) {
      Alert.alert("Campos obrigatorios", "Preencha nome, horario e evidencia esperada.");
      return;
    }

    if (!isValidTime(newTaskTime)) {
      Alert.alert("Horario invalido", "Use o formato HH:MM.");
      return;
    }

    const updated = [
      ...tasks,
      {
        id: String(Date.now()),
        name: newTaskName.trim(),
        evidence: newTaskEvidence.trim(),
        category: newTaskCategory,
        time: newTaskTime.trim(),
        done: false,
        triggered: false,
        createdAt: new Date().toISOString(),
      },
    ];

    saveTasks(updated);
    setNewTaskName("");
    setNewTaskEvidence("");
    setNewTaskCategory("work");
    setNewTaskTime("");
    setScreen(screens.DASHBOARD);
  }

  async function completeTaskByVerification(imageBase64) {
    if (!activeTask) return;

    if (!apiConfigured) {
      setVerification({
        aprovado: false,
        confianca: 0,
        mensagem: "API nao configurada no mobile. Defina EXPO_PUBLIC_API_BASE_URL.",
        motivo_rejeicao: "Sem backend de verificacao ativo.",
      });
      setScreen(screens.RESULT);
      return;
    }

    setLoadMessage("IA analisando evidencia...");
    setScreen(screens.LOADING);

    try {
      const response = await verifyEvidence({
        imageBase64,
        imageMimeType: "image/jpeg",
        activeTask,
        history,
        profile,
      });

      const result = response?.verification || {
        aprovado: false,
        confianca: 0,
        mensagem: "Resposta invalida da API.",
      };

      setVerification(result);

      const historyEntry = {
        id: String(Date.now()),
        tarefa_id: activeTask.id,
        tarefa_nome: activeTask.name,
        categoria: activeTask.category,
        aprovado: Boolean(result.aprovado),
        confianca: Number(result.confianca || 0),
        ocr_detectado: result.ocr_detectado || "",
        notas_aprendizado: result.notas_aprendizado || "",
        imagem_hash: result.image_hash || "",
        timestamp: new Date().toISOString(),
      };

      const nextHistory = [historyEntry, ...history].slice(0, 50);
      await saveHistory(nextHistory);

      if (result.aprovado) {
        const updated = tasks.map((task) => (task.id === activeTask.id ? { ...task, done: true } : task));
        await saveTasks(updated);
      }
    } catch (error) {
      setVerification({
        aprovado: false,
        confianca: 0,
        mensagem: error.message || "Falha ao verificar tarefa na API.",
        motivo_rejeicao: "Erro de comunicacao com backend.",
      });
    }

    setScreen(screens.RESULT);
  }

  function tapEmergencyZone() {
    const next = emergencyTap + 1;
    setEmergencyTap(next);
    if (emergencyTimerRef.current) clearTimeout(emergencyTimerRef.current);
    emergencyTimerRef.current = setTimeout(() => setEmergencyTap(0), 2500);
    if (next >= 7) {
      setEmergencyVisible(true);
      setEmergencyTap(0);
      if (emergencyTimerRef.current) clearTimeout(emergencyTimerRef.current);
    }
  }

  async function submitEmergencyUnlock() {
    if (emergencyInput === trustCode) {
      const entry = {
        id: String(Date.now()),
        tarefa_ativa: activeTask?.name || "",
        timestamp: new Date().toISOString(),
      };
      const nextLogs = [entry, ...emergencyLogs].slice(0, 100);
      await saveEmergencyLogs(nextLogs);
      setEmergencyInput("");
      setEmergencyVisible(false);
      setActiveTask(null);
      setScreen(screens.DASHBOARD);
      return;
    }

    Alert.alert("Codigo invalido");
    setEmergencyInput("");
  }

  if (screen === screens.BOOT) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Text style={styles.muted}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === screens.WELCOME) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.card}>
          <Text style={styles.brand}>FOCUSLOCK</Text>
          <Text style={styles.title}>Bloqueio real para foco real.</Text>
          <Text style={styles.muted}>Fluxo mobile com API real de onboarding e verificacao por imagem.</Text>
          {!apiConfigured && (
            <Text style={styles.warnText}>Defina EXPO_PUBLIC_API_BASE_URL no app mobile para ativar a IA.</Text>
          )}
          <Pressable style={styles.primaryBtn} onPress={() => setScreen(screens.ONBOARDING)}>
            <Text style={styles.primaryBtnText}>Iniciar onboarding</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === screens.LOADING) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.card}>
          <Text style={styles.titleSmall}>Processando</Text>
          <Text style={styles.muted}>{loadMessage || "Aguarde..."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === screens.ONBOARDING) {
    const q = onboardingQuestions[onboardingStep];
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.card}>
          <Text style={styles.muted}>{`Pergunta ${onboardingStep + 1}/${onboardingQuestions.length}`}</Text>
          <Text style={styles.titleSmall}>{q.q}</Text>
          {q.opts.map((opt) => (
            <Pressable
              key={opt}
              style={styles.optionBtn}
              onPress={() => {
                const next = { ...answers, [q.id]: opt };
                setAnswers(next);
                if (onboardingStep < onboardingQuestions.length - 1) {
                  setOnboardingStep(onboardingStep + 1);
                  return;
                }
                finishOnboarding();
              }}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (screen === screens.DASHBOARD) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollWrap}>
          <View style={styles.card}>
            <Text style={styles.brand}>PAINEL</Text>
            {profile && <Text style={styles.muted}>{`${profile.tipo} | pico: ${profile.pico || profile.pico_produtividade}`}</Text>}
            <Text style={styles.muted}>{apiConfigured ? `API: ${apiBaseUrl}` : "API: nao configurada"}</Text>
            <Text style={styles.muted}>{`Historico IA: ${history.length} verificacoes`}</Text>
            {tasks.length === 0 && <Text style={styles.muted}>Sem tarefas ainda.</Text>}
            {tasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View>
                  <Text style={styles.taskName}>{task.name}</Text>
                  <Text style={styles.muted}>{`${task.time} | ${task.category || "work"}`}</Text>
                  <Text style={styles.muted}>{task.evidence || "Sem evidencia"}</Text>
                </View>
                <Text style={styles.badge}>{task.done ? "feito" : "pendente"}</Text>
              </View>
            ))}
            <Pressable style={styles.primaryBtn} onPress={() => setScreen(screens.ADD_TASK)}>
              <Text style={styles.primaryBtnText}>Nova tarefa</Text>
            </Pressable>
            {pendingTasks.length > 0 && (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  const first = pendingTasks[0];
                  setActiveTask(first);
                  saveTasks(tasks.map((task) => (task.id === first.id ? { ...task, triggered: true } : task)));
                  setEmergencyVisible(false);
                  setEmergencyInput("");
                  setScreen(screens.LOCKED);
                }}
              >
                <Text style={styles.secondaryBtnText}>Simular bloqueio agora</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === screens.ADD_TASK) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollWrap}>
          <View style={styles.card}>
          <Text style={styles.titleSmall}>Nova tarefa</Text>
          <TextInput
            placeholder="Nome da tarefa"
            placeholderTextColor="#6b6478"
            value={newTaskName}
            onChangeText={setNewTaskName}
            style={styles.input}
          />
          <TextInput
            placeholder="Evidencia esperada (ex: livro aberto na pagina alvo)"
            placeholderTextColor="#6b6478"
            value={newTaskEvidence}
            onChangeText={setNewTaskEvidence}
            style={styles.input}
            multiline
          />
          <Text style={styles.muted}>Categoria</Text>
          <View style={styles.categoryWrap}>
            {taskCategories.map((category) => {
              const selected = category.id === newTaskCategory;
              return (
                <Pressable
                  key={category.id}
                  style={[styles.categoryBtn, selected && styles.categoryBtnActive]}
                  onPress={() => setNewTaskCategory(category.id)}
                >
                  <Text style={[styles.categoryText, selected && styles.categoryTextActive]}>{category.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            placeholder="Horario HH:MM"
            placeholderTextColor="#6b6478"
            value={newTaskTime}
            onChangeText={setNewTaskTime}
            style={styles.input}
          />
          <Pressable style={styles.primaryBtn} onPress={addTask}>
            <Text style={styles.primaryBtnText}>Salvar</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setScreen(screens.DASHBOARD)}>
            <Text style={styles.secondaryBtnText}>Voltar</Text>
          </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === screens.LOCKED && activeTask) {
    return (
      <SafeAreaView style={styles.rootLocked}>
        <StatusBar style="light" />
        <Pressable style={styles.emergencyZone} onPress={tapEmergencyZone} />
        <View style={styles.card}>
          <Text style={styles.lockTitle}>TELA BLOQUEADA</Text>
          <Text style={styles.titleSmall}>{activeTask.name}</Text>
          <Text style={styles.muted}>{`Categoria: ${activeTask.category || "work"}`}</Text>
          <Text style={styles.muted}>{`Evidencia: ${activeTask.evidence || "Nao definida"}`}</Text>
          <Text style={styles.muted}>Conclua a tarefa e prove com camera.</Text>
          {!apiConfigured && <Text style={styles.warnText}>API nao configurada. A verificacao nao sera executada.</Text>}
          <Pressable
            style={[styles.primaryBtn, !apiConfigured && styles.btnDisabled]}
            onPress={() => setScreen(screens.CAMERA)}
            disabled={!apiConfigured}
          >
            <Text style={styles.primaryBtnText}>Abrir camera</Text>
          </Pressable>
          <Text style={styles.muted}>Toque 7x no canto superior direito para abrir emergencia.</Text>
          {emergencyVisible && (
            <>
              <TextInput
                value={emergencyInput}
                onChangeText={setEmergencyInput}
                placeholder="Codigo emergencia"
                placeholderTextColor="#6b6478"
                style={styles.input}
                secureTextEntry
              />
              <Pressable style={styles.secondaryBtn} onPress={submitEmergencyUnlock}>
                <Text style={styles.secondaryBtnText}>Desbloquear emergencia</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (screen === screens.CAMERA) {
    if (!permission) {
      return (
        <SafeAreaView style={styles.root}>
          <StatusBar style="light" />
          <View style={styles.card}>
            <Text style={styles.muted}>Carregando permissao de camera...</Text>
          </View>
        </SafeAreaView>
      );
    }

    if (!permission.granted) {
      return (
        <SafeAreaView style={styles.root}>
          <StatusBar style="light" />
          <View style={styles.card}>
            <Text style={styles.muted}>Permita acesso a camera para verificar tarefa.</Text>
            <Pressable style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryBtnText}>Permitir camera</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.card}>
          <View style={styles.cameraWrap}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          </View>
          <Pressable
            style={styles.primaryBtn}
            onPress={async () => {
              const picture = await cameraRef.current?.takePictureAsync({ quality: 0.6, base64: true, skipProcessing: true });
              if (!picture?.base64) {
                Alert.alert("Falha na captura", "Nao foi possivel capturar a imagem para verificacao.");
                return;
              }
              completeTaskByVerification(picture.base64);
            }}
          >
            <Text style={styles.primaryBtnText}>Capturar e verificar</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setScreen(screens.LOCKED)}>
            <Text style={styles.secondaryBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === screens.RESULT && verification) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.card}>
          <Text style={styles.titleSmall}>{verification.aprovado ? "Tarefa validada" : "Reprovado"}</Text>
          <Text style={styles.muted}>{verification.mensagem}</Text>
          <Text style={styles.muted}>{`Confianca: ${verification.confianca}%`}</Text>
          {!verification.aprovado && verification.motivo_rejeicao && (
            <Text style={styles.warnText}>{verification.motivo_rejeicao}</Text>
          )}
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              if (verification.aprovado) {
                setActiveTask(null);
                setVerification(null);
                setEmergencyVisible(false);
                setEmergencyInput("");
                setScreen(screens.DASHBOARD);
                return;
              }
              setScreen(screens.LOCKED);
            }}
          >
            <Text style={styles.primaryBtnText}>{verification.aprovado ? "Voltar ao painel" : "Tentar novamente"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0c0b10",
    justifyContent: "center",
    padding: 16,
  },
  rootLocked: {
    flex: 1,
    backgroundColor: "#07060c",
    justifyContent: "center",
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollWrap: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#13121a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
    gap: 10,
  },
  brand: {
    color: "#e8552a",
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    color: "#ede8e0",
    fontSize: 28,
    fontWeight: "800",
  },
  titleSmall: {
    color: "#ede8e0",
    fontSize: 20,
    fontWeight: "700",
  },
  muted: {
    color: "#b6afc4",
  },
  warnText: {
    color: "#ff9e6a",
    fontSize: 12,
  },
  primaryBtn: {
    backgroundColor: "#e8552a",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  secondaryBtnText: {
    color: "#b6afc4",
    fontWeight: "600",
  },
  optionBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 12,
  },
  optionText: {
    color: "#ede8e0",
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ede8e0",
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryBtnActive: {
    borderColor: "#e8552a",
    backgroundColor: "rgba(232,85,42,0.18)",
  },
  categoryText: {
    color: "#b6afc4",
    fontSize: 12,
  },
  categoryTextActive: {
    color: "#ede8e0",
    fontWeight: "700",
  },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 10,
  },
  taskName: {
    color: "#ede8e0",
    fontWeight: "600",
  },
  badge: {
    color: "#e8552a",
    fontWeight: "700",
  },
  lockTitle: {
    color: "#ff6464",
    letterSpacing: 2,
    fontWeight: "700",
  },
  emergencyZone: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 64,
    height: 64,
    zIndex: 20,
  },
  cameraWrap: {
    width: "100%",
    height: 280,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
});
