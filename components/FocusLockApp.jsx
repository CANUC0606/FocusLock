"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { localStore } from "@/lib/localStore";

const S = {
  BOOT: "boot",
  WELCOME: "welcome",
  ONBOARDING: "onboarding",
  TRUST_SETUP: "trust_setup",
  PROFILE: "profile",
  DASHBOARD: "dashboard",
  ADD_TASK: "add_task",
  LOCKED: "locked",
  CAMERA: "camera",
  VERIFYING: "verifying",
  RESULT: "result",
  HISTORY: "history",
  SETTINGS: "settings",
};

const OB = [
  {
    id: "distraction",
    label: "Atencao",
    q: "Com que frequencia voce abandona tarefas pela metade por distracao?",
    opts: ["Raramente", "As vezes", "Com frequencia", "E automatico"],
  },
  {
    id: "impulse",
    label: "Impulso",
    q: "Voce abre o celular por impulso, sem perceber que decidiu abrir?",
    opts: ["Nunca", "Ocasionalmente", "Bastante", "Sempre"],
  },
  {
    id: "procrastination",
    label: "Procrastinacao",
    q: "Como voce lida com tarefas longas sem recompensa imediata?",
    opts: ["Foco bem", "Vou com esforco", "Procrastino muito", "Evito completamente"],
  },
  {
    id: "peak",
    label: "Energia",
    q: "Quando voce produz melhor naturalmente?",
    opts: ["Manha cedo", "Meio da manha", "Tarde", "Noite"],
  },
  {
    id: "social",
    label: "Relacoes",
    q: "O celular ja atrapalhou momentos com familia ou pessoas proximas?",
    opts: ["Nunca", "Raramente", "Com frequencia", "Sempre"],
  },
  {
    id: "goal",
    label: "Objetivo",
    q: "O que mais quer recuperar com menos tela?",
    opts: ["Foco no estudo", "Produtividade no trabalho", "Presenca com familia", "Saude / Exercicio"],
  },
];

export default function FocusLockApp() {
  const [screen, setScreen] = useState(S.BOOT);
  const [obStep, setObStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [newTask, setNewTask] = useState({ name: "", desc: "", time: "", cat: "work" });
  const [capturedImg, setCapturedImg] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [loadMsg, setLoadMsg] = useState("");
  const [history, setHistory] = useState([]);
  const [trustCode, setTrustCode] = useState(null);
  const [tempTrustInput, setTempTrustInput] = useState("");
  const [emergTapCount, setEmergTapCount] = useState(0);
  const [emergVisible, setEmergVisible] = useState(false);
  const [emergInput, setEmergInput] = useState("");
  const [emergError, setEmergError] = useState(false);
  const [ticker, setTicker] = useState(0);
  const [stats, setStats] = useState({ completed: 0, unlocked: 0, streak: 0 });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const emergTapTimer = useRef(null);

  useEffect(() => {
    const p = localStore.get("fl:profile");
    const t = localStore.get("fl:tasks", []);
    const h = localStore.get("fl:history", []);
    const tc = localStore.get("fl:trustcode");
    const st = localStore.get("fl:stats", { completed: 0, unlocked: 0, streak: 0 });

    if (p) setProfile(p);
    if (t) setTasks(t);
    if (h) setHistory(h);
    if (tc) setTrustCode(tc);
    if (st) setStats(st);

    setScreen(p ? S.DASHBOARD : S.WELCOME);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTicker((n) => n + 1), 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (screen === S.DASHBOARD || screen === S.ADD_TASK) {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const due = tasks.find((t) => !t.done && !t.triggered && t.time <= hhmm);
      if (due) {
        const updated = tasks.map((t) => (t.id === due.id ? { ...t, triggered: true } : t));
        setTasks(updated);
        localStore.set("fl:tasks", updated);
        setActiveTask(due);
        stopCamera();
        setScreen(S.LOCKED);
      }
    }
  }, [ticker, tasks, screen]);

  const saveTasks = useCallback((nextTasks) => {
    setTasks(nextTasks);
    localStore.set("fl:tasks", nextTasks);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      // Browser sem permissao de camera ou contexto nao seguro.
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current && videoRef.current.videoWidth) {
      const c = canvasRef.current;
      c.width = videoRef.current.videoWidth;
      c.height = videoRef.current.videoHeight;
      c.getContext("2d").drawImage(videoRef.current, 0, 0);
      setCapturedImg(c.toDataURL("image/jpeg", 0.85));
      stopCamera();
    } else {
      setCapturedImg("__sim__");
    }
  };

  const analyzeProfile = async () => {
    setLoadMsg("Analisando seu perfil comportamental...");
    setScreen(S.LOCKED);

    const payload = {
      answers,
      onboarding: OB.map((o) => ({ id: o.id, label: o.label })),
    };

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Falha ao analisar perfil");

      const result = await response.json();
      const nextProfile = result.profile;

      setProfile(nextProfile);
      localStore.set("fl:profile", nextProfile);
      setScreen(S.TRUST_SETUP);
    } catch {
      const fallback = {
        tipo: "Mente Acelerada",
        subtitulo: "Criatividade em excesso, foco em falta.",
        nivel: "medio",
        pico: "Manha",
        estrategia: "Sessoes curtas com bloqueio real aumentam sua entrega. Celebre cada conclusao.",
        cor: "#e8552a",
        icone: "*",
        blocos_sugeridos: ["Leitura 20min", "Tarefa de trabalho", "Tempo com familia"],
      };
      setProfile(fallback);
      localStore.set("fl:profile", fallback);
      setScreen(S.TRUST_SETUP);
    }
  };

  const verifyTask = async () => {
    setScreen(S.VERIFYING);
    setLoadMsg("IA analisando evidencia...");

    const learnHistory = history.slice(0, 20);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: capturedImg,
          activeTask,
          history: learnHistory,
        }),
      });

      if (!response.ok) throw new Error("Falha na verificacao");

      const result = await response.json();
      const normalized = result.verification;
      setVerifyResult(normalized);

      const entry = {
        id: Date.now(),
        task: activeTask?.name,
        approved: normalized.aprovado,
        confidence: normalized.confianca,
        notes: normalized.notas_aprendizado,
        ts: new Date().toISOString(),
      };

      const newHistory = [entry, ...history].slice(0, 50);
      setHistory(newHistory);
      localStore.set("fl:history", newHistory);

      if (normalized.aprovado) {
        const updated = tasks.map((t) => (t.id === activeTask?.id ? { ...t, done: true } : t));
        saveTasks(updated);
        const nextStats = { ...stats, completed: stats.completed + 1, unlocked: stats.unlocked + 1 };
        setStats(nextStats);
        localStore.set("fl:stats", nextStats);
      }

      setScreen(S.RESULT);
    } catch {
      const fallback = {
        aprovado: true,
        confianca: 80,
        mensagem: "Modo demo: evidencia aceita para fluxo de teste.",
        ocr_detectado: "",
        notas_aprendizado: "Sem API ativa no momento.",
      };
      setVerifyResult(fallback);
      setScreen(S.RESULT);
    }
  };

  const handleEmergTap = () => {
    setEmergTapCount((n) => {
      const next = n + 1;
      clearTimeout(emergTapTimer.current);
      if (next >= 7) {
        setEmergVisible(true);
        return 0;
      }
      emergTapTimer.current = setTimeout(() => setEmergTapCount(0), 3000);
      return next;
    });
  };

  const handleEmergSubmit = () => {
    if (emergInput === trustCode) {
      stopCamera();
      setEmergVisible(false);
      setEmergInput("");
      setEmergError(false);
      setEmergTapCount(0);
      setScreen(S.DASHBOARD);
      return;
    }
    setEmergError(true);
    setTimeout(() => setEmergError(false), 1500);
    setEmergInput("");
  };

  const C = {
    bg: "#0c0b10",
    surface: "#13121a",
    border: "rgba(255,255,255,0.08)",
    text: "#ede8e0",
    muted: "#6b6478",
    accent: profile?.cor || "#e8552a",
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:${C.bg}; }
    ::selection { background:${C.accent}44; }
    input,select,textarea { -webkit-appearance:none; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
    @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    .fade { animation: fadeUp 0.4s ease both; }
    .pulse { animation: pulse 2s ease infinite; }
    .breathe { animation: breathe 3s ease infinite; }
    .shake { animation: shake 0.4s ease; }
    .spin { animation: spin 1.2s linear infinite; }
  `;

  const wrap = {
    fontFamily: "'IBM Plex Mono', monospace",
    background: C.bg,
    color: C.text,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    position: "relative",
    overflow: "hidden",
  };

  const card = (extra = {}) => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "18px",
    padding: "28px 24px",
    width: "100%",
    maxWidth: "390px",
    ...extra,
  });

  const btn = (bg = C.accent, extra = {}) => ({
    background: bg,
    color: bg === C.accent ? "#fff" : C.muted,
    border: bg === C.accent ? "none" : `1px solid ${C.border}`,
    borderRadius: "12px",
    padding: "14px 20px",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
    marginTop: "10px",
    letterSpacing: "0.3px",
    transition: "opacity 0.15s, transform 0.1s",
    ...extra,
  });

  const inp = (extra = {}) => ({
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${C.border}`,
    borderRadius: "10px",
    padding: "11px 14px",
    color: C.text,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "13px",
    width: "100%",
    outline: "none",
    marginTop: "6px",
    ...extra,
  });

  const label = (text) => (
    <div
      style={{
        fontSize: "10px",
        letterSpacing: "2.5px",
        color: C.muted,
        fontWeight: "600",
        textTransform: "uppercase",
        marginBottom: "2px",
      }}
    >
      {text}
    </div>
  );

  const pill = (text, color = C.accent) => (
    <span
      style={{
        display: "inline-block",
        background: `${color}18`,
        color,
        border: `1px solid ${color}33`,
        borderRadius: "6px",
        padding: "3px 9px",
        fontSize: "10px",
        fontWeight: "600",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
      }}
    >
      {text}
    </span>
  );

  if (screen === S.BOOT) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div className="pulse" style={{ fontSize: "32px", color: C.muted }}>
          o
        </div>
      </div>
    );
  }

  if (screen === S.WELCOME) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 25% 60%, #e8552a12, transparent 55%), radial-gradient(ellipse at 75% 20%, #5b21b610, transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <div className="fade" style={card()}>
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "4px", color: C.accent, fontWeight: "700", marginBottom: "16px" }}>
              FOCUSLOCK
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: "800", lineHeight: 1.15, marginBottom: "12px" }}>
              Seu cerebro
              <br />
              merece limites
              <br />
              <span style={{ color: C.accent }}>reais.</span>
            </h1>
            <p style={{ fontSize: "12px", color: C.muted, lineHeight: 1.7 }}>
              Bloqueio de tela com verificacao por IA para criar responsabilidade real no uso do celular.
            </p>
          </div>
          <button style={btn()} onClick={() => setScreen(S.ONBOARDING)}>
            Iniciar analise de perfil
          </button>
        </div>
      </div>
    );
  }

  if (screen === S.ONBOARDING) {
    const q = OB[obStep];
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div className="fade" style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            {pill(q.label)}
            <span style={{ fontSize: "11px", color: C.muted }}>
              {obStep + 1} / {OB.length}
            </span>
          </div>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: "700", lineHeight: 1.4, marginBottom: "20px" }}>
            {q.q}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {q.opts.map((opt) => (
              <button
                key={opt}
                onClick={async () => {
                  const nextAnswers = { ...answers, [q.id]: opt };
                  setAnswers(nextAnswers);
                  if (obStep < OB.length - 1) {
                    setObStep(obStep + 1);
                    return;
                  }
                  await analyzeProfile();
                }}
                style={{
                  background: answers[q.id] === opt ? `${C.accent}20` : "rgba(255,255,255,0.03)",
                  border: answers[q.id] === opt ? `1px solid ${C.accent}88` : `1px solid ${C.border}`,
                  borderRadius: "10px",
                  padding: "13px 16px",
                  color: C.text,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === S.LOCKED && loadMsg && !activeTask) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div style={{ textAlign: "center" }}>
          <div className="spin" style={{ fontSize: "32px", display: "inline-block", marginBottom: "16px" }}>
            o
          </div>
          <p style={{ fontSize: "12px", color: C.muted }}>{loadMsg}</p>
        </div>
      </div>
    );
  }

  if (screen === S.TRUST_SETUP) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div className="fade" style={card()}>
          <div style={{ marginBottom: "20px" }}>
            {pill("Configuracao de seguranca")}
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: "800", margin: "12px 0 8px" }}>
              Codigo de confianca
            </h2>
            <p style={{ fontSize: "12px", color: C.muted, lineHeight: 1.7 }}>
              Defina com uma pessoa de confianca. O codigo so deve ser usado em emergencia real.
            </p>
          </div>
          {label("Codigo de emergencia (4 a 8 digitos)")}
          <input
            style={inp()}
            type="password"
            value={tempTrustInput}
            onChange={(e) => setTempTrustInput(e.target.value)}
            placeholder="Pessoa de confianca digita aqui"
          />
          <button
            style={btn()}
            onClick={() => {
              if (tempTrustInput.length < 4) return;
              localStore.set("fl:trustcode", tempTrustInput);
              setTrustCode(tempTrustInput);
              setTempTrustInput("");
              setScreen(S.PROFILE);
            }}
          >
            Salvar e continuar
          </button>
          <button
            style={btn("transparent")}
            onClick={() => {
              localStore.set("fl:trustcode", "1234");
              setTrustCode("1234");
              setScreen(S.PROFILE);
            }}
          >
            Pular por agora (1234)
          </button>
        </div>
      </div>
    );
  }

  if (screen === S.PROFILE && profile) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div className="fade" style={card()}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "52px", marginBottom: "8px" }} className="breathe">
              {profile.icone || "*"}
            </div>
            {pill("Seu perfil", profile.cor)}
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: "800", color: profile.cor, margin: "10px 0 4px" }}>
              {profile.tipo}
            </h2>
            <p style={{ fontSize: "12px", color: C.muted }}>{profile.subtitulo}</p>
          </div>
          <div style={{ background: `${profile.cor}12`, border: `1px solid ${profile.cor}25`, borderRadius: "12px", padding: "14px", marginBottom: "16px" }}>
            {label("Estrategia")}
            <p style={{ fontSize: "12px", color: "#ccc", lineHeight: 1.7, marginTop: "6px" }}>{profile.estrategia}</p>
          </div>
          <button style={btn(profile.cor)} onClick={() => setScreen(S.DASHBOARD)}>
            Ir para o painel
          </button>
        </div>
      </div>
    );
  }

  if (screen === S.DASHBOARD) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div style={{ width: "100%", maxWidth: "390px" }} className="fade">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "10px", letterSpacing: "4px", color: C.accent, fontWeight: "700" }}>FOCUSLOCK</div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: "800", marginTop: "2px" }}>Painel</h1>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setScreen(S.HISTORY)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "8px 10px", color: C.muted, cursor: "pointer" }}>
                HIST
              </button>
              <button onClick={() => setScreen(S.SETTINGS)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "8px 10px", color: C.muted, cursor: "pointer" }}>
                CFG
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            {[
              ["OK", "Concluidas", stats.completed],
              ["IA", "Verificadas", history.length],
              ["ST", "Streak", stats.streak],
            ].map(([ic, lb, val]) => (
              <div key={lb} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "16px" }}>{ic}</div>
                <div style={{ fontSize: "16px", fontWeight: "700", fontFamily: "'Syne', sans-serif", color: C.accent }}>{val}</div>
                <div style={{ fontSize: "9px", color: C.muted, letterSpacing: "1px" }}>{lb.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {tasks.length === 0 ? (
            <div style={card({ textAlign: "center", padding: "32px", marginBottom: "12px" })}>
              <p style={{ fontSize: "12px", color: C.muted }}>Sem tarefas ainda. Adicione uma abaixo.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {tasks.map((t) => (
                <div key={t.id} style={card({ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" })}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", textDecoration: t.done ? "line-through" : "none", color: t.done ? C.muted : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: "10px", color: C.muted, marginTop: "2px" }}>{t.time}</div>
                  </div>
                  {pill(t.done ? "feito" : t.triggered ? "ativo" : "agendado", t.done ? "#22c55e" : t.triggered ? C.accent : "#5b21b6")}
                </div>
              ))}
            </div>
          )}

          <button style={btn()} onClick={() => setScreen(S.ADD_TASK)}>
            Nova tarefa
          </button>

          {tasks.some((t) => !t.done) && (
            <button
              style={btn("transparent")}
              onClick={() => {
                const firstTask = tasks.find((t) => !t.done);
                if (!firstTask) return;
                setActiveTask(firstTask);
                saveTasks(tasks.map((x) => (x.id === firstTask.id ? { ...x, triggered: true } : x)));
                setScreen(S.LOCKED);
              }}
            >
              Simular bloqueio (demo)
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === S.ADD_TASK) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div className="fade" style={card()}>
          <button onClick={() => setScreen(S.DASHBOARD)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", marginBottom: "16px", padding: 0 }}>
            Voltar
          </button>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: "800", marginBottom: "20px" }}>Nova tarefa</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              {label("Nome da tarefa")}
              <input style={inp()} value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} placeholder="Ex: Ler 20 paginas" />
            </div>
            <div>
              {label("Evidencia esperada")}
              <input style={inp()} value={newTask.desc} onChange={(e) => setNewTask({ ...newTask, desc: e.target.value })} placeholder="Ex: Livro aberto na pagina alvo" />
            </div>
            <div>
              {label("Horario")}
              <input style={inp()} type="time" value={newTask.time} onChange={(e) => setNewTask({ ...newTask, time: e.target.value })} />
            </div>
            <div>
              {label("Categoria")}
              <select style={inp()} value={newTask.cat} onChange={(e) => setNewTask({ ...newTask, cat: e.target.value })}>
                <option value="work">Trabalho</option>
                <option value="study">Estudo</option>
                <option value="physical">Exercicio</option>
                <option value="family">Familia</option>
                <option value="home">Casa</option>
              </select>
            </div>
          </div>
          <button
            style={btn()}
            onClick={() => {
              if (!newTask.name || !newTask.time) return;
              const updated = [...tasks, { ...newTask, id: Date.now(), done: false, triggered: false }];
              saveTasks(updated);
              setNewTask({ name: "", desc: "", time: "", cat: "work" });
              setScreen(S.DASHBOARD);
            }}
          >
            Salvar tarefa
          </button>
        </div>
      </div>
    );
  }

  if (screen === S.LOCKED && activeTask) {
    return (
      <div style={{ ...wrap, background: "#07060c" }}>
        <style>{css}</style>

        <div onClick={handleEmergTap} style={{ position: "absolute", top: 0, right: 0, width: "60px", height: "60px", cursor: "default", zIndex: 10 }} />

        <div className="fade" style={card({ textAlign: "center" })}>
          <div className="breathe" style={{ fontSize: "60px", marginBottom: "8px" }}>
            LOCK
          </div>
          <div style={{ fontSize: "10px", letterSpacing: "4px", color: "#ff4444", fontWeight: "700", marginBottom: "8px" }} className="pulse">
            TELA BLOQUEADA
          </div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: "800", marginBottom: "6px" }}>Hora de agir.</h2>
          <div style={{ background: "rgba(232,85,42,0.12)", border: "1px solid rgba(232,85,42,0.25)", borderRadius: "12px", padding: "16px", margin: "16px 0" }}>
            <div style={{ fontSize: "10px", color: C.accent, letterSpacing: "2px", fontWeight: "600", marginBottom: "6px" }}>TAREFA</div>
            <div style={{ fontSize: "15px", fontWeight: "700" }}>{activeTask?.name}</div>
            {activeTask?.desc && <div style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}>{activeTask.desc}</div>}
          </div>
          <button
            style={btn()}
            onClick={() => {
              setCapturedImg(null);
              setVerifyResult(null);
              startCamera();
              setScreen(S.CAMERA);
            }}
          >
            Registrar conclusao
          </button>
        </div>

        {emergVisible && (
          <div className="fade" style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0c0b10", border: "1px solid rgba(255,0,0,0.2)", borderRadius: "18px 18px 0 0", padding: "24px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#ff4444", fontWeight: "700", marginBottom: "4px" }}>DESBLOQUEIO DE EMERGENCIA</div>
            <input
              className={emergError ? "shake" : ""}
              style={inp({ borderColor: emergError ? "#ff4444" : undefined })}
              type="password"
              placeholder="Codigo"
              value={emergInput}
              onChange={(e) => setEmergInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmergSubmit()}
            />
            <button style={btn("#ff4444")} onClick={handleEmergSubmit}>
              Confirmar
            </button>
            <button style={btn("transparent")} onClick={() => { setEmergVisible(false); setEmergInput(""); }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    );
  }

  if (screen === S.CAMERA) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div className="fade" style={card()}>
          {!capturedImg ? (
            <>
              <div style={{ background: "#0a0a10", borderRadius: "12px", overflow: "hidden", marginBottom: "14px", minHeight: "180px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: "100%", borderRadius: "12px", display: "block" }} />
                {!streamRef.current && <div style={{ position: "absolute", color: C.muted, fontSize: "12px" }}>Camera nao disponivel</div>}
              </div>
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <button style={btn()} onClick={capture}>
                Capturar
              </button>
              <button style={btn("transparent")} onClick={() => setCapturedImg("__sim__")}>
                Simular foto (demo)
              </button>
            </>
          ) : (
            <>
              {capturedImg !== "__sim__" ? (
                <img src={capturedImg} alt="evidencia" style={{ width: "100%", borderRadius: "12px", marginBottom: "14px" }} />
              ) : (
                <div style={{ background: C.surface, borderRadius: "12px", padding: "40px 20px", textAlign: "center", marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: C.muted, marginTop: "6px" }}>Foto simulada (demo)</div>
                </div>
              )}
              <button style={btn()} onClick={verifyTask}>
                Verificar com IA
              </button>
              <button style={btn("transparent")} onClick={() => { setCapturedImg(null); startCamera(); }}>
                Tirar novamente
              </button>
            </>
          )}
          <button style={btn("transparent")} onClick={() => { stopCamera(); setScreen(S.LOCKED); }}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (screen === S.VERIFYING) {
    return (
      <div style={{ ...wrap, gap: "16px" }}>
        <style>{css}</style>
        <div className="spin" style={{ fontSize: "28px", display: "inline-block" }}>
          o
        </div>
        <p style={{ fontSize: "12px", color: C.muted, textAlign: "center", lineHeight: 1.7 }}>
          {loadMsg}
        </p>
      </div>
    );
  }

  if (screen === S.RESULT && verifyResult) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div className="fade" style={card({ textAlign: "center" })}>
          {pill(verifyResult.aprovado ? "Aprovado" : "Nao verificado", verifyResult.aprovado ? "#22c55e" : "#ff4444")}
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: "800", margin: "12px 0 6px" }}>
            {verifyResult.aprovado ? "Tarefa concluida!" : "Evidencia insuficiente"}
          </h2>
          <div style={{ background: verifyResult.aprovado ? "rgba(34,197,94,0.1)" : "rgba(255,68,68,0.1)", border: `1px solid ${verifyResult.aprovado ? "#22c55e" : "#ff4444"}33`, borderRadius: "12px", padding: "14px", margin: "14px 0 10px" }}>
            <p style={{ fontSize: "12px", color: "#ccc", lineHeight: 1.7, margin: 0 }}>{verifyResult.mensagem}</p>
          </div>
          <div style={{ fontSize: "11px", color: C.muted, marginBottom: "16px" }}>Confianca: {verifyResult.confianca}%</div>
          {verifyResult.aprovado ? (
            <button style={btn("#22c55e")} onClick={() => { setScreen(S.DASHBOARD); setActiveTask(null); }}>
              Continuar
            </button>
          ) : (
            <>
              <button style={btn()} onClick={() => { setCapturedImg(null); setVerifyResult(null); startCamera(); setScreen(S.CAMERA); }}>
                Tentar novamente
              </button>
              <button style={btn("transparent")} onClick={() => setScreen(S.LOCKED)}>
                Voltar ao bloqueio
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (screen === S.HISTORY) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div style={{ width: "100%", maxWidth: "390px" }} className="fade">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: "800" }}>Historico de aprendizado</h2>
            <button onClick={() => setScreen(S.DASHBOARD)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "12px" }}>
              Voltar
            </button>
          </div>
          {history.length === 0 ? (
            <div style={card({ textAlign: "center", padding: "32px" })}>
              <p style={{ fontSize: "12px", color: C.muted }}>Nenhuma verificacao ainda.</p>
            </div>
          ) : (
            history.slice(0, 20).map((h) => (
              <div key={h.id} style={card({ padding: "12px 16px", marginBottom: "8px", display: "flex", gap: "12px", alignItems: "center" })}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: C.text }}>{h.task}</div>
                  <div style={{ fontSize: "10px", color: C.muted, marginTop: "2px" }}>{h.notes}</div>
                </div>
                <div style={{ fontSize: "10px", color: C.accent, fontWeight: "700" }}>{h.confidence}%</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (screen === S.SETTINGS) {
    return (
      <div style={wrap}>
        <style>{css}</style>
        <div className="fade" style={card()}>
          <button onClick={() => setScreen(S.DASHBOARD)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "12px", marginBottom: "16px", padding: 0 }}>
            Voltar
          </button>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: "800", marginBottom: "20px" }}>Configuracoes</h2>
          <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}25`, borderRadius: "12px", padding: "14px", marginBottom: "16px" }}>
            {label("Trocar codigo de confianca")}
            <input style={inp()} type="password" placeholder="Novo codigo" value={tempTrustInput} onChange={(e) => setTempTrustInput(e.target.value)} />
            <button
              style={btn()}
              onClick={() => {
                if (tempTrustInput.length < 4) return;
                localStore.set("fl:trustcode", tempTrustInput);
                setTrustCode(tempTrustInput);
                setTempTrustInput("");
              }}
            >
              Salvar codigo
            </button>
          </div>
          <button
            style={btn("transparent")}
            onClick={() => {
              const cleared = tasks.filter((t) => !t.done);
              saveTasks(cleared);
            }}
          >
            Limpar tarefas concluidas
          </button>
          <button
            style={btn("transparent")}
            onClick={() => {
              localStore.set("fl:profile", null);
              setProfile(null);
              setObStep(0);
              setAnswers({});
              setScreen(S.ONBOARDING);
            }}
          >
            Refazer analise de perfil
          </button>
        </div>
      </div>
    );
  }

  return null;
}
