import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · InsightAI" },
      { name: "description", content: "Sign in to your InsightAI research workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const isSignUp = mode === "signup";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-soft via-background to-primary-soft p-4">
      <div className="auth-shell">
        {/* Sign In Form (left when signin) */}
        <div
          className="auth-panel left-0 flex items-center justify-center p-10 bg-card"
          style={{ transform: isSignUp ? "translateX(100%)" : "translateX(0)", opacity: isSignUp ? 0 : 1 }}
        >
          <FormBlock
            title="Sign In"
            fields={["email", "password"]}
            email={email} setEmail={setEmail}
            password={password} setPassword={setPassword}
            name={name} setName={setName}
            loading={loading}
            onSubmit={handleSubmit}
            cta="Sign In"
          />
        </div>

        {/* Sign Up Form (right when signup) */}
        <div
          className="auth-panel left-0 flex items-center justify-center p-10 bg-card"
          style={{ transform: isSignUp ? "translateX(100%)" : "translateX(0)", opacity: isSignUp ? 1 : 0, pointerEvents: isSignUp ? "auto" : "none" }}
        >
          <FormBlock
            title="Create Account"
            fields={["name", "email", "password"]}
            email={email} setEmail={setEmail}
            password={password} setPassword={setPassword}
            name={name} setName={setName}
            loading={loading}
            onSubmit={handleSubmit}
            cta="Sign Up"
          />
        </div>

        {/* Overlay panel */}
        <div
          className="auth-panel right-0 text-primary-foreground p-10 flex flex-col items-center justify-center text-center"
          style={{
            background: "linear-gradient(135deg, oklch(0.62 0.21 280), oklch(0.50 0.20 290))",
            transform: isSignUp ? "translateX(-100%)" : "translateX(0)",
            borderTopLeftRadius: isSignUp ? "0" : "6rem",
            borderBottomLeftRadius: isSignUp ? "0" : "6rem",
            borderTopRightRadius: isSignUp ? "6rem" : "0",
            borderBottomRightRadius: isSignUp ? "6rem" : "0",
            transition: "all 700ms cubic-bezier(0.65, 0, 0.35, 1)",
          }}
        >
          <Sparkles className="h-10 w-10 mb-4 opacity-90" />
          <h2 className="text-3xl font-bold mb-3">
            {isSignUp ? "Welcome Back!" : "Hello, Friend!"}
          </h2>
          <p className="text-sm opacity-90 mb-8 max-w-xs">
            {isSignUp
              ? "Already have an account? Sign in to continue your research."
              : "Register with your personal details to unlock InsightAI's full research workspace."}
          </p>
          <button
            type="button"
            onClick={() => setMode(isSignUp ? "signin" : "signup")}
            className="rounded-full border-2 border-white/90 px-10 py-2.5 text-sm font-semibold tracking-wider hover:bg-white/10 transition"
          >
            {isSignUp ? "SIGN IN" : "SIGN UP"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormBlock(props: {
  title: string;
  fields: string[];
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  name: string; setName: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  cta: string;
}) {
  const { title, fields, email, setEmail, password, setPassword, name, setName, loading, onSubmit, cta } = props;
  return (
    <form onSubmit={onSubmit} className="w-full max-w-xs space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg">InsightAI</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-xs text-muted-foreground mb-4">Use your email to continue</p>
      {fields.includes("name") && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <Button type="submit" disabled={loading} className="w-full rounded-full mt-2 h-11">
        {loading ? "Please wait…" : cta.toUpperCase()}
      </Button>
    </form>
  );
}
