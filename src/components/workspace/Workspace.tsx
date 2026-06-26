import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Sparkles, Plus, LayoutDashboard, Bookmark, Wrench,
  Send, Globe, ShieldCheck, LogOut, MessageSquare, MoreHorizontal,
  Pencil, Trash2, BookmarkPlus, BookmarkMinus,
} from "lucide-react";
import { toast } from "sonner";

type Mode = "chat" | "research" | "factcheck";

type Conversation = {
  id: string;
  title: string;
  mode: Mode;
  updated_at: string;
  is_saved: boolean;
};

const MODE_META: Record<Mode, { label: string; icon: typeof Globe; placeholder: string }> = {
  chat:      { label: "Chat",       icon: MessageSquare, placeholder: "Ask anything..." },
  research:  { label: "Research",   icon: Globe,         placeholder: "What would you like me to research?" },
  factcheck: { label: "Fact Check", icon: ShieldCheck,   placeholder: "Paste a claim to fact-check..." },
};

type NavKey = "dashboard" | "saved" | "tools";

export function Workspace() {
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("there");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      if (profile?.display_name) setDisplayName(profile.display_name);
      await refreshConversations();
    })();
  }, []);

  async function refreshConversations() {
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,mode,updated_at,is_saved")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); return; }
    setConversations((data ?? []) as Conversation[]);
  }

  async function loadConversation(id: string) {
    setLoadingConv(true);
    const { data, error } = await supabase
      .from("messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); setLoadingConv(false); return; }
    const conv = conversations.find(c => c.id === id);
    if (conv) setMode(conv.mode);
    setInitialMessages(
      (data ?? []).map(m => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text", text: m.content }],
      } as UIMessage))
    );
    setActiveId(id);
    setLoadingConv(false);
  }

  function newChat(nextMode: Mode = mode) {
    setActiveId(null);
    setInitialMessages([]);
    setMode(nextMode);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/auth");
  }

  async function toggleSaved(conv: Conversation) {
    const next = !conv.is_saved;
    const { error } = await supabase.from("conversations").update({ is_saved: next }).eq("id", conv.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Saved to Saved Research" : "Removed from Saved Research");
    await refreshConversations();
  }

  async function deleteConversation(conv: Conversation) {
    if (!confirm(`Delete "${conv.title}"? This cannot be undone.`)) return;
    await supabase.from("messages").delete().eq("conversation_id", conv.id);
    const { error } = await supabase.from("conversations").delete().eq("id", conv.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Conversation deleted");
    if (activeId === conv.id) newChat();
    await refreshConversations();
  }

  function openRename(conv: Conversation) {
    setRenameTarget(conv);
    setRenameValue(conv.title);
  }

  async function submitRename() {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) return;
    const { error } = await supabase.from("conversations").update({ title }).eq("id", renameTarget.id);
    if (error) { toast.error(error.message); return; }
    setRenameTarget(null);
    await refreshConversations();
  }

  const filteredConversations = useMemo(() => {
    if (nav === "saved") return conversations.filter(c => c.is_saved);
    return conversations;
  }, [conversations, nav]);

  function handleNav(key: NavKey) {
    setNav(key);
    if (key === "dashboard") {
      newChat("chat");
    } else if (key === "saved") {
      // just filter; don't reset chat
    } else if (key === "tools") {
      toast.message("Pick a mode", { description: "Chat · Research · Fact Check" });
    }
  }

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      <Sidebar
        displayName={displayName}
        userEmail={userEmail}
        conversations={filteredConversations}
        activeId={activeId}
        activeNav={nav}
        onNav={handleNav}
        onSelect={loadConversation}
        onNew={() => { setNav("dashboard"); newChat(); }}
        onSignOut={signOut}
        onToggleSaved={toggleSaved}
        onRename={openRename}
        onDelete={deleteConversation}
      />
      <ChatPane
        key={activeId ?? "new"}
        mode={mode}
        setMode={setMode}
        activeId={activeId}
        setActiveId={setActiveId}
        initialMessages={initialMessages}
        displayName={displayName}
        onConversationsChanged={refreshConversations}
        loading={loadingConv}
        currentConv={conversations.find(c => c.id === activeId) ?? null}
        onToggleSaved={toggleSaved}
      />

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename conversation</DialogTitle></DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitRename(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={submitRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Sidebar ---------------- */
function Sidebar(props: {
  displayName: string; userEmail: string;
  conversations: Conversation[]; activeId: string | null;
  activeNav: NavKey; onNav: (k: NavKey) => void;
  onSelect: (id: string) => void; onNew: () => void; onSignOut: () => void;
  onToggleSaved: (c: Conversation) => void;
  onRename: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
}) {
  const { displayName, userEmail, conversations, activeId, activeNav, onNav, onSelect, onNew, onSignOut, onToggleSaved, onRename, onDelete } = props;
  const navItems: { key: NavKey; icon: typeof LayoutDashboard; label: string }[] = [
    { key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { key: "saved",     icon: Bookmark,        label: "Saved Research" },
    { key: "tools",     icon: Wrench,          label: "Tools" },
  ];
  return (
    <aside className="w-72 shrink-0 border-r border-border bg-sidebar flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <div className="font-bold leading-tight">InsightAI</div>
          <div className="text-xs text-muted-foreground">Research Assistant</div>
        </div>
      </div>

      <div className="px-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary-soft text-primary font-medium text-sm hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" /> New Research
        </button>
      </div>

      <nav className="px-3 mt-4 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNav(item.key)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition",
              activeNav === item.key
                ? "bg-primary-soft text-primary font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 mt-5 flex-1 min-h-0 flex flex-col">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1.5">
          {activeNav === "saved" ? "Saved Research" : "Recent"}
        </div>
        <ScrollArea className="flex-1 min-h-32">
          <div className="space-y-0.5 pr-1">
            {conversations.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-3">
                {activeNav === "saved" ? "No saved research yet." : "No conversations yet."}
              </div>
            )}
            {conversations.map(c => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg pr-1 transition",
                  activeId === c.id ? "bg-primary-soft" : "hover:bg-sidebar-accent"
                )}
              >
                <button
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm truncate flex items-center gap-2",
                    activeId === c.id ? "text-primary font-medium" : "text-sidebar-foreground/80"
                  )}
                  title={c.title}
                >
                  {c.is_saved && <Bookmark className="h-3 w-3 shrink-0 fill-current" />}
                  <span className="truncate">{c.title}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 p-1 rounded hover:bg-background/60 text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onToggleSaved(c)}>
                      {c.is_saved
                        ? <><BookmarkMinus className="h-4 w-4 mr-2" /> Unsave</>
                        : <><BookmarkPlus className="h-4 w-4 mr-2" /> Save research</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRename(c)}>
                      <Pencil className="h-4 w-4 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(c)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-auto p-3 space-y-3">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-primary-soft to-accent">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">Pro Plan</div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Unlimited research, advanced tools and more.</p>
          <Button size="sm" className="w-full rounded-lg">Upgrade Now</Button>
        </div>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sidebar-accent transition">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
          </div>
          <button onClick={onSignOut} className="text-muted-foreground hover:text-foreground" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ---------------- Chat Pane ---------------- */
function ChatPane(props: {
  mode: Mode; setMode: (m: Mode) => void;
  activeId: string | null; setActiveId: (id: string) => void;
  initialMessages: UIMessage[];
  displayName: string;
  onConversationsChanged: () => Promise<void>;
  loading: boolean;
  currentConv: Conversation | null;
  onToggleSaved: (c: Conversation) => void;
}) {
  const { mode, setMode, activeId, setActiveId, initialMessages, displayName, onConversationsChanged, loading, currentConv, onToggleSaved } = props;
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const [input, setInput] = useState("");
  const persistedIdsRef = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)));
  const convRef = useRef<string | null>(activeId);
  useEffect(() => { convRef.current = activeId; }, [activeId]);

  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport,
    onError: (err) => toast.error(err.message),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    (async () => {
      if (status === "streaming" || status === "submitted") return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let convId = convRef.current;
      const newOnes = messages.filter(m => !persistedIdsRef.current.has(m.id));
      if (newOnes.length === 0) return;

      if (!convId) {
        const firstUser = newOnes.find(m => m.role === "user");
        if (!firstUser) return;
        const text = getText(firstUser);
        const title = text.slice(0, 60) || "New conversation";
        const { data, error } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, mode, title })
          .select("id").single();
        if (error) { toast.error(error.message); return; }
        convId = data.id;
        convRef.current = convId;
        setActiveId(convId);
      }

      const rows = newOnes
        .map(m => ({
          conversation_id: convId!,
          user_id: user.id,
          role: m.role,
          content: getText(m),
        }))
        .filter(r => r.content.length > 0);

      if (rows.length > 0) {
        const { error } = await supabase.from("messages").insert(rows);
        if (error) { toast.error(error.message); return; }
        newOnes.forEach(m => persistedIdsRef.current.add(m.id));
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId!);
        await onConversationsChanged();
      }
    })();
  }, [status, messages, mode, setActiveId, onConversationsChanged]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    await sendMessage({ text }, { body: { mode } });
  }

  const meta = MODE_META[mode];
  const isLoading = status === "streaming" || status === "submitted";

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-background">
      <header className="px-8 py-5 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Good day, {displayName}! 👋</h1>
          <p className="text-sm text-muted-foreground">How can I help you with your research today?</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary rounded-full p-1">
            {(Object.keys(MODE_META) as Mode[]).map(m => {
              const Icon = MODE_META[m].icon;
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition",
                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {MODE_META[m].label}
                </button>
              );
            })}
          </div>
          {currentConv && (
            <button
              onClick={() => onToggleSaved(currentConv)}
              className={cn(
                "h-9 px-3 rounded-lg border border-border flex items-center gap-1.5 text-xs font-medium transition",
                currentConv.is_saved ? "bg-primary-soft text-primary border-primary/30" : "text-muted-foreground hover:bg-secondary"
              )}
              title={currentConv.is_saved ? "Unsave" : "Save research"}
            >
              <Bookmark className={cn("h-4 w-4", currentConv.is_saved && "fill-current")} />
              {currentConv.is_saved ? "Saved" : "Save"}
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {loading && <div className="text-sm text-muted-foreground">Loading conversation…</div>}
          {!loading && messages.length === 0 && (
            <EmptyState mode={mode} />
          )}
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3 items-start">
              <div className="h-7 w-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 pt-2">
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-primary/80 animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 pb-6">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto bg-card border border-border rounded-2xl p-3 shadow-sm">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={meta.placeholder}
            className="border-0 shadow-none focus-visible:ring-0 px-2 text-base"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between mt-1">
            <div className="flex gap-1">
              {(Object.keys(MODE_META) as Mode[]).map(m => {
                const Icon = MODE_META[m].icon;
                return (
                  <button type="button" key={m} onClick={() => setMode(m)}
                    className={cn("px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition",
                      mode === m ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary")}>
                    <Icon className="h-3.5 w-3.5" /> {MODE_META[m].label}
                  </button>
                );
              })}
            </div>
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="rounded-xl">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-3">
          InsightAI may make mistakes. Always verify important information.
        </p>
      </div>
    </main>
  );
}

function getText(m: UIMessage): string {
  return (m.parts ?? [])
    .map(p => (p.type === "text" ? (p as { type: "text"; text: string }).text : ""))
    .join("");
}

function MessageBubble({ message }: { message: UIMessage }) {
  const text = getText(message);
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-primary-soft text-foreground rounded-2xl rounded-tr-md px-4 py-3 text-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 items-start">
      <div className="h-7 w-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 bg-card border border-border rounded-2xl rounded-tl-md px-5 py-4 text-sm leading-relaxed">
        <Markdown text={text} />
      </div>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc pl-5 space-y-1 my-2">
          {listBuf.map((l, i) => <li key={i}>{renderInline(l)}</li>)}
        </ul>
      );
      listBuf = [];
    }
  };
  lines.forEach((line, idx) => {
    if (/^[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^[-*]\s+/, ""));
    } else {
      flushList();
      if (/^###\s+/.test(line)) out.push(<h3 key={idx} className="font-semibold mt-3 mb-1">{line.replace(/^###\s+/, "")}</h3>);
      else if (/^##\s+/.test(line)) out.push(<h2 key={idx} className="font-semibold text-base mt-4 mb-1.5">{line.replace(/^##\s+/, "")}</h2>);
      else if (/^#\s+/.test(line)) out.push(<h1 key={idx} className="font-bold text-lg mt-4 mb-2">{line.replace(/^#\s+/, "")}</h1>);
      else if (line.trim() === "") out.push(<div key={idx} className="h-2" />);
      else out.push(<p key={idx} className="my-1">{renderInline(line)}</p>);
    }
  });
  flushList();
  return <>{out}</>;
}

function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="px-1 py-0.5 bg-muted rounded text-[0.85em]">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

function EmptyState({ mode }: { mode: Mode }) {
  const samples: Record<Mode, string[]> = {
    chat: ["Explain quantum entanglement simply", "Write a polite follow-up email", "Brainstorm startup names for a fitness app"],
    research: ["Summarize the latest research on intermittent fasting", "Compare React Server Components vs SSR", "What are the leading EV battery technologies in 2026?"],
    factcheck: ["Is the claim that coffee causes dehydration true?", "Did Einstein fail math in school?", "Does the Great Wall of China cover 5,500 miles?"],
  };
  const Icon = MODE_META[mode].icon;
  return (
    <div className="text-center py-10">
      <div className="h-14 w-14 mx-auto rounded-2xl bg-primary-soft text-primary flex items-center justify-center mb-4">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold">Start a new {MODE_META[mode].label.toLowerCase()}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-6">Try one of these examples</p>
      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
        {samples[mode].map((s, i) => (
          <div key={i} className="text-left text-sm p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition cursor-default">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
