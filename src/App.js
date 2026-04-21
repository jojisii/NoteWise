import { useState, useEffect, useRef } from "react";

// https://console.groq.com
const API_KEY = "gsk_your_key";

const STORAGE_KEY = "notewise_notes";

const C = {
  bg:       "#130d1c",
  surface:  "#1e1530",
  surface2: "#2a1d40",
  border:   "#3d2d58",
  pink:     "#f2acd0",
  lavender: "#c4a0f0",
  text:     "#f4eeff",
  muted:    "#9b88b8",
  danger:   "#e88fa0",
};

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("ru-RU");
}

const COMPETITORS = [
  { name: "✦ NoteWise (наш)", rag: "yes",     agent: "yes",     sources: "yes",     privacy: "yes",     price: "Бесплатно",  ease: "yes",     highlight: true  },
  { name: "Notion AI",         rag: "partial", agent: "yes",     sources: "no",      privacy: "partial", price: "$10/мес",    ease: "partial", highlight: false },
  { name: "Obsidian + плагин", rag: "yes",     agent: "partial", sources: "partial", privacy: "yes",     price: "Бесплатно",  ease: "no",      highlight: false },
  { name: "Mem.ai",            rag: "yes",     agent: "yes",     sources: "no",      privacy: "no",      price: "$14.99/мес", ease: "yes",     highlight: false },
  { name: "ChatGPT + файлы",   rag: "partial", agent: "yes",     sources: "no",      privacy: "no",      price: "$20/мес",    ease: "yes",     highlight: false },
  { name: "Apple Notes",       rag: "no",      agent: "no",      sources: "no",      privacy: "yes",     price: "Бесплатно",  ease: "yes",     highlight: false },
];

const AUDIENCE = [
  { icon: "📚", title: "Студенты и аспиранты", desc: "Конспектируют лекции и хотят быстро синтезировать информацию перед экзаменом" },
  { icon: "💼", title: "Knowledge workers",    desc: "Менеджеры, аналитики, консультанты — накапливают рабочие знания и быстро к ним обращаются" },
  { icon: "🔬", title: "Исследователи",        desc: "Ведут заметки по статьям и экспериментам, задают вопросы по накопленной базе знаний" },
  { icon: "✍️", title: "Авторы и журналисты",  desc: "Хранят идеи, черновики, источники и используют AI для структурирования материала" },
];

function Badge({ val }) {
  const map = {
    yes:     { bg: "rgba(168,216,176,0.15)", color: "#a8d8b0", label: "Да" },
    no:      { bg: "rgba(232,143,160,0.15)", color: "#e88fa0", label: "Нет" },
    partial: { bg: "rgba(196,160,240,0.15)", color: "#c4a0f0", label: "Частично" },
  };
  const s = map[val] || map.no;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontFamily: "monospace" }}>
      {s.label}
    </span>
  );
}

export default function App() {
  const [page, setPage]               = useState("notes");
  const [notes, setNotes]             = useState([]);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState({ title: "", tag: "", body: "" });
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [thinking, setThinking]       = useState(false);
  const [hoveredNote, setHoveredNote] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setNotes(JSON.parse(saved));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function saveNote() {
    if (!form.title.trim() || !form.body.trim()) return;
    const note = {
      id:    Date.now(),
      title: form.title.trim(),
      body:  form.body.trim(),
      tag:   form.tag.trim() || "общее",
      date:  formatDate(Date.now()),
    };
    const next = [note, ...notes];
    setNotes(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setShowModal(false);
    setForm({ title: "", tag: "", body: "" });
  }

  function deleteNote(id) {
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function sendMsg() {
    if (thinking || !input.trim()) return;
    const q = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    setThinking(true);

    try {
      const ctx = notes.length > 0
        ? notes.map((n, i) => `[Заметка ${i + 1}: "${n.title}" (тег: ${n.tag})]\n${n.body}`).join("\n\n---\n\n")
        : "Заметок нет.";

      const systemPrompt =
        `Ты очень умный персональный AI-ассистент. Вот заметки пользователя:\n\n${ctx}\n\n` +
        `СТРОГИЕ ПРАВИЛА:\n` +
        `1. Используй заметки как основной контекст для ответа.\n` +
        `2. Применяй свои знания для полезного развёрнутого ответа.\n` +
        `3. Если в заметке список продуктов — предложи конкретные рецепты и блюда.\n` +
        `4. Если чего-то не хватает — скажи что добавить в заметки.\n` +
        `5. ВАЖНО: отвечай ТОЛЬКО на русском языке. Категорически запрещено использовать китайские, японские, корейские и любые другие иностранные символы.\n` +
        `6. В самом конце ответа ОБЯЗАТЕЛЬНО напиши строку в точно таком формате:\n` +
        `SOURCES:["название заметки 1","название заметки 2"]\n` +
        `Перечисли ВСЕ заметки которые использовал — их может быть несколько. Не пропускай эту строку.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": "Bearer " + API_KEY,
        },
        body: JSON.stringify({
          model:      "llama-3.3-70b-versatile",
          max_tokens: 1000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: q },
          ],
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages(prev => [...prev, { role: "ai", content: "Ошибка Groq: " + data.error.message }]);
        setThinking(false);
        return;
      }

      const raw  = data.choices?.[0]?.message?.content || "Нет ответа.";
      let text   = raw;
      let sources = [];
      const match = raw.match(/SOURCES:\[([^\]]*)\]/);
      if (match) {
        text = raw.replace(/SOURCES:\[([^\]]*)\]/, "").trim();
        try { sources = JSON.parse("[" + match[1] + "]"); } catch (e) {}
      }
      setMessages(prev => [...prev, { role: "ai", content: text, sources }]);

    } catch (e) {
      setMessages(prev => [...prev, {
        role: "ai",
        content: "Ошибка подключения: " + e.message + "\n\nПроверьте:\n1. API_KEY в строке 8\n2. Интернет-соединение",
      }]);
    }
    setThinking(false);
  }

  const S = {
    app:        { display: "flex", height: "100vh", fontFamily: "'Segoe UI', sans-serif", background: C.bg, color: C.text, overflow: "hidden" },
    sidebar:    { width: 215, minWidth: 215, background: C.surface, borderRight: "1px solid " + C.border, display: "flex", flexDirection: "column" },
    logo:       { padding: "20px 18px 14px", borderBottom: "1px solid " + C.border },
    logoTitle:  { fontSize: 18, fontWeight: 700, color: C.pink, letterSpacing: -0.3 },
    logoSub:    { fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: 1.5, textTransform: "uppercase" },
    nav:        { padding: "12px 8px", flex: 1 },
    navBtn:     (a) => ({ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "none", background: a ? "rgba(242,172,208,0.12)" : "none", color: a ? C.pink : C.muted, fontSize: 13, cursor: "pointer", borderRadius: 8, marginBottom: 2, textAlign: "left" }),
    sideBottom: { padding: "14px 8px", borderTop: "1px solid " + C.border },
    main:       { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    topbar:     { padding: "14px 24px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface },
    pageTitle:  { fontSize: 13, fontWeight: 500, color: C.muted, letterSpacing: 1 },
    btnPrimary: { padding: "7px 16px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${C.pink},${C.lavender})`, color: "#1a0d2e", fontSize: 12, cursor: "pointer", fontWeight: 700 },
    content:    { flex: 1, overflowY: "auto", padding: 24 },
    grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 },
    card:       (h) => ({ background: C.surface, border: `1px solid ${h ? C.lavender : C.border}`, borderRadius: 12, padding: 16, transition: "all 0.2s", position: "relative", boxShadow: h ? "0 4px 20px rgba(196,160,240,0.15)" : "none" }),
    noteDate:   { fontSize: 10, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "monospace" },
    noteTitle:  { fontSize: 15, fontWeight: 600, margin: "6px 0 8px", lineHeight: 1.4, color: C.text },
    notePreview:{ fontSize: 12, color: C.muted, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" },
    noteTag:    { display: "inline-block", fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(196,160,240,0.15)", color: C.lavender, marginTop: 10, fontFamily: "monospace" },
    overlay:    { position: "fixed", inset: 0, background: "rgba(10,5,20,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
    modal:      { background: C.surface, border: "1px solid " + C.border, borderRadius: 16, padding: 24, width: "90%", maxWidth: 520 },
    label:      { fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 },
    inp:        { width: "100%", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" },
    textarea:   { width: "100%", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", minHeight: 130, boxSizing: "border-box", lineHeight: 1.6 },
    msgUser:    { alignSelf: "flex-end", maxWidth: "72%", background: "rgba(242,172,208,0.10)", border: "1px solid rgba(242,172,208,0.25)", borderRadius: 12, padding: "10px 14px", fontSize: 13, lineHeight: 1.6 },
    msgAI:      { alignSelf: "flex-start", maxWidth: "72%", background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: "10px 14px", fontSize: 13, lineHeight: 1.6 },
    msgLabel:   (u) => ({ fontSize: 10, color: u ? C.pink : C.lavender, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 5 }),
    sectionLbl: { fontSize: 10, color: C.pink, letterSpacing: 2, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 },
    auCard:     { background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 16 },
  };

  return (
    <div style={S.app}>

      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoTitle}>✦ NoteWise</div>
          <div style={S.logoSub}>AI · RAG Agent</div>
        </div>
        <nav style={S.nav}>
          {[["notes","◈","Заметки"],["chat","◎","AI Агент"],["analytics","◇","Аналитика"]].map(([id,icon,label]) => (
            <button key={id} style={S.navBtn(page===id)} onClick={() => setPage(id)}>
              <span style={{ fontSize:15, width:18, textAlign:"center" }}>{icon}</span>
              {label}
              {id==="notes" && (
                <span style={{ marginLeft:"auto", fontSize:11, background:C.surface2, padding:"2px 7px", borderRadius:10, color:C.muted }}>
                  {notes.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div style={S.sideBottom}>
          <button style={S.navBtn(false)} onClick={() => setShowModal(true)}>
            <span style={{ fontSize:15, color:C.pink }}>✦</span> Новая заметка
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={S.main}>
        <div style={S.topbar}>
          <span style={S.pageTitle}>{page==="notes"?"ЗАМЕТКИ":page==="chat"?"AI АГЕНТ":"АНАЛИТИКА"}</span>
          {page==="notes" && <button style={S.btnPrimary} onClick={() => setShowModal(true)}>+ Добавить</button>}
        </div>

        {/* ЗАМЕТКИ */}
        {page==="notes" && (
          <div style={S.content}>
            {notes.length===0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:C.muted }}>
                <div style={{ fontSize:44, marginBottom:14 }}>◈</div>
                <div style={{ fontSize:18, fontWeight:600, color:C.text, marginBottom:8 }}>Пока нет заметок</div>
                <div style={{ fontSize:13, lineHeight:1.6 }}>Создайте первую заметку — AI агент будет<br/>отвечать на вопросы на её основе</div>
                <button style={{ ...S.btnPrimary, marginTop:20, padding:"10px 22px", fontSize:13 }} onClick={() => setShowModal(true)}>
                  Создать заметку
                </button>
              </div>
            ) : (
              <div style={S.grid}>
                {notes.map(n => (
                  <div key={n.id} style={S.card(hoveredNote===n.id)}
                    onMouseEnter={() => setHoveredNote(n.id)}
                    onMouseLeave={() => setHoveredNote(null)}>
                    <button onClick={() => deleteNote(n.id)}
                      style={{ position:"absolute", top:10, right:10, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13, padding:"2px 6px" }}>
                      ✕
                    </button>
                    <div style={S.noteDate}>{n.date}</div>
                    <div style={S.noteTitle}>{n.title}</div>
                    <div style={S.notePreview}>{n.body}</div>
                    <span style={S.noteTag}>{n.tag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ЧАТ */}
        {page==="chat" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ background:"rgba(196,160,240,0.08)", border:"1px solid rgba(196,160,240,0.22)", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.lavender, lineHeight:1.6 }}>
                ◎ AI агент анализирует ваши <strong>{notes.length}</strong> заметок и отвечает на их основе!
              </div>
              {notes.length===0 && (
                <div style={{ background:"rgba(232,143,160,0.08)", border:"1px solid rgba(232,143,160,0.2)", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.danger }}>
                  ⚠ Сначала создайте заметки на странице «Заметки».
                </div>
              )}
              {messages.map((m,i) => (
                <div key={i} style={m.role==="user" ? S.msgUser : S.msgAI}>
                  <div style={S.msgLabel(m.role==="user")}>{m.role==="user"?"Вы":"NoteWise AI"}</div>
                  <div style={{ whiteSpace:"pre-wrap" }}>{m.content}</div>
                  {m.sources?.length>0 && (
                    <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid "+C.border, fontSize:11, color:C.muted }}>
                      Источники: {m.sources.map((s,si) => (
                        <span key={si} style={{ display:"inline-block", padding:"2px 8px", background:"rgba(242,172,208,0.12)", borderRadius:20, color:C.pink, margin:2, fontFamily:"monospace" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {thinking && (
                <div style={S.msgAI}>
                  <div style={S.msgLabel(false)}>NoteWise AI</div>
                  <span style={{ display:"inline-flex", gap:4 }}>
                    {[0,0.2,0.4].map((d,i) => (
                      <span key={i} style={{ width:6, height:6, borderRadius:"50%", background:C.lavender, display:"inline-block", animation:`bounce 1.2s ${d}s infinite` }} />
                    ))}
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ padding:"14px 24px", borderTop:"1px solid "+C.border, display:"flex", gap:10, alignItems:"flex-end", background:C.surface }}>
              <textarea
                style={{ ...S.textarea, minHeight:44, maxHeight:120, resize:"none", flex:1 }}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Задайте вопрос по вашим заметкам..."
                rows={1}
                onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}}
              />
              <button style={{ ...S.btnPrimary, padding:"10px 18px" }} onClick={sendMsg} disabled={thinking}>
                Спросить
              </button>
            </div>
          </div>
        )}

        {/* АНАЛИТИКА */}
        {page==="analytics" && (
          <div style={{ ...S.content, maxWidth:900 }}>
            <div style={S.sectionLbl}>Концепция проекта</div>
            <div style={{ fontSize:22, fontWeight:700, marginBottom:6, color:C.text }}>NoteWise — персональный AI агент для заметок</div>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.7, marginBottom:28 }}>
              Приложение позволяет создавать заметки и задавать вопросы AI агенту, который формирует ответы на основе сохранённых заметок (RAG — Retrieval-Augmented Generation). Никаких галлюцинаций — только ваши знания, усиленные интеллектом.
            </div>

            <div style={{ ...S.sectionLbl, marginBottom:12 }}>Целевая аудитория</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14, marginBottom:32 }}>
              {AUDIENCE.map((a,i) => (
                <div key={i} style={S.auCard}>
                  <div style={{ fontSize:24, marginBottom:10 }}>{a.icon}</div>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:6, color:C.text }}>{a.title}</div>
                  <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{a.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ ...S.sectionLbl, marginBottom:12 }}>Сравнительный анализ конкурентов</div>
            <div style={{ overflowX:"auto", marginBottom:32 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
                <thead>
                  <tr>
                    {["Продукт","RAG","AI агент","Источники","Приватность","Цена","Простота"].map(h => (
                      <th key={h} style={{ background:C.surface2, padding:"10px 14px", textAlign:"left", fontWeight:500, fontSize:11, letterSpacing:0.8, textTransform:"uppercase", color:C.muted, borderBottom:"1px solid "+C.border }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPETITORS.map((c,i) => (
                    <tr key={i} style={{ background:c.highlight?"rgba(242,172,208,0.05)":"transparent" }}>
                      <td style={{ padding:"11px 14px", borderBottom:"1px solid rgba(61,45,88,0.5)", color:c.highlight?C.pink:C.text, fontWeight:c.highlight?700:400 }}>{c.name}</td>
                      {["rag","agent","sources","privacy"].map(k => (
                        <td key={k} style={{ padding:"11px 14px", borderBottom:"1px solid rgba(61,45,88,0.5)" }}><Badge val={c[k]} /></td>
                      ))}
                      <td style={{ padding:"11px 14px", borderBottom:"1px solid rgba(61,45,88,0.5)", color:C.muted }}>{c.price}</td>
                      <td style={{ padding:"11px 14px", borderBottom:"1px solid rgba(61,45,88,0.5)" }}><Badge val={c.ease} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ ...S.sectionLbl, marginBottom:12 }}>Технологический стек</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
              {[
                ["⚛️","Frontend","React + Hooks, localStorage, адаптивный интерфейс"],
                ["🧠","AI / RAG","Groq API (llama-3.3-70b), контекстная передача заметок, prompt engineering"],
                ["🗄️","Хранилище","localStorage — данные сохраняются в браузере между сессиями"],
                ["🔒","Приватность","Данные хранятся локально, в API уходит только запрос + заметки"],
              ].map(([icon,title,desc],i) => (
                <div key={i} style={S.auCard}>
                  <div style={{ fontSize:24, marginBottom:10 }}>{icon}</div>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:6, color:C.text }}>{title}</div>
                  <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* МОДАЛКА */}
      {showModal && (
        <div style={S.overlay} onClick={e => { if(e.target===e.currentTarget) setShowModal(false); }}>
          <div style={S.modal}>
            <div style={{ fontSize:20, fontWeight:700, color:C.pink, marginBottom:20 }}>Новая заметка</div>
            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Заголовок</label>
              <input style={S.inp} value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Название заметки..." />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Тег</label>
              <input style={S.inp} value={form.tag} onChange={e => setForm(f=>({...f,tag:e.target.value}))} placeholder="работа, личное, идеи..." />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Содержимое</label>
              <textarea style={S.textarea} value={form.body} onChange={e => setForm(f=>({...f,body:e.target.value}))} placeholder="Введите текст заметки..." />
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
              <button style={{ padding:"8px 16px", borderRadius:8, border:"1px solid "+C.border, background:"none", color:C.text, fontSize:13, cursor:"pointer" }}
                onClick={() => setShowModal(false)}>
                Отмена
              </button>
              <button style={S.btnPrimary} onClick={saveNote}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-7px)}}`}</style>
    </div>
  );
}
