import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase, supabaseConfigured } from "../lib/supabase";
import ConfirmDialog from "../components/ConfirmDialog";
import PostEditor, { BUCKET } from "./PostEditor";
import PostList from "./PostList";
import UsersPanel from "./UsersPanel";
import styles from "./AdminPage.module.css";

// The main app sets data-theme from the rider's saved setting; /admin mounts
// without App, so apply the same setting here or it's always dark.
const applySavedTheme = () => {
  try {
    const theme = JSON.parse(localStorage.getItem("dabus-settings") || "{}").theme;
    if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
  } catch {
    // unreadable settings — fall back to the default theme
  }
};

// ── Login ────────────────────────────────────────────────────────────────────

function LoginForm({ onError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) onError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
  };

  return (
    <form className={styles.loginCard} onSubmit={submit}>
      <img src="/dabus-icon-128.png" alt="" className={styles.loginIcon} />
      <h1 className={styles.loginTitle}>News admin</h1>
      <p className={styles.loginSub}>Sign in to post updates to the app.</p>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit" className={`${styles.primaryBtn} ${styles.fullWidth}`} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

// Editor dashboard at /admin. Talks to Supabase directly (auth + posts +
// storage). The rider app never loads this — main.jsx mounts it only for that
// path.
//
// Roles (enforced by RLS in supabase/0002_roles_and_trash.sql — the checks
// here only decide which buttons to show):
//   editor  write posts; edit / pin / end posts written by editors
//   admin   everything, plus Trash (delete / restore / delete forever) and
//           the Users screen for granting editor access
export default function AdminPage() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // { kind: "trash" | "purge", post } while a confirm dialog is open.
  const [confirm, setConfirm] = useState(null);
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [view, setView] = useState("posts"); // "posts" | "users" (admin only)
  // null = list view; { post: null } = new post; { post } = editing that post.
  const [editing, setEditing] = useState(null);

  useEffect(applySavedTheme, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setPosts([]);
        setPeople([]);
        setEditing(null);
        setView("posts");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("posts")
      .select("*")
      .order("pinned", { ascending: false })
      .order("starts_at", { ascending: false });
    setPostsLoading(false);
    setLoadedAt(Date.now());
    if (err) setError(err.message);
    else setPosts(data || []);
  }, []);

  // Profiles this account may see: everyone for the admin, the staff list for
  // editors. Used for "By …" on posts, read-only admin posts, and Users.
  const loadPeople = useCallback(async () => {
    const { data, error: err } = await supabase.from("profiles").select("id, email, role, created_at");
    setPeopleLoading(false);
    if (err) setError(err.message);
    else setPeople(data || []);
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("role, email").eq("id", session.user.id).single();
      if (cancelled) return;
      setProfile(data || { role: "viewer" });
      loadPosts();
      loadPeople();
    })();
    return () => {
      cancelled = true;
    };
  }, [session, loadPosts, loadPeople]);

  // Auto-dismiss notices.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  // Opening/closing the editor starts at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [editing]);

  // Updates/deletes that RLS refuses come back as "0 rows", not an error —
  // ask for the row back so a refusal is reported instead of looking saved.
  const changed = ({ data, error: err }) => {
    if (!err && data?.length) return true;
    setError(err ? err.message : "That didn't go through — you may not have permission, or the post changed.");
    return false;
  };

  const trashPost = async (p) => {
    setConfirm(null);
    const res = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id })
      .eq("id", p.id)
      .select("id");
    if (!changed(res)) return;
    setNotice("Moved to Trash");
    loadPosts();
  };

  const restorePost = async (p) => {
    const res = await supabase.from("posts").update({ deleted_at: null, deleted_by: null }).eq("id", p.id).select("id");
    if (!changed(res)) return;
    setNotice("Post restored");
    loadPosts();
  };

  const purgePost = async (p) => {
    setConfirm(null);
    const paths = (p.images || []).map((i) => i.path).filter(Boolean);
    const res = await supabase.from("posts").delete().eq("id", p.id).select("id");
    if (!changed(res)) return;
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    setNotice("Post deleted forever");
    loadPosts();
  };

  const endNow = async (p) => {
    const res = await supabase.from("posts").update({ ends_at: new Date().toISOString() }).eq("id", p.id).select("id");
    if (!changed(res)) return;
    setNotice("Post ended — it's no longer shown in the app");
    loadPosts();
  };

  const togglePin = async (p) => {
    const res = await supabase.from("posts").update({ pinned: !p.pinned }).eq("id", p.id).select("id");
    if (!changed(res)) return;
    setNotice(p.pinned ? "Unpinned" : "Pinned to top");
    loadPosts();
  };

  const isAdmin = profile?.role === "admin";
  const peopleById = useMemo(() => new Map(people.map((x) => [x.id, x])), [people]);

  // Editors can change any post except the admin's.
  const canModify = (post) => isAdmin || peopleById.get(post.created_by)?.role !== "admin";

  const authorLabel = (post) => {
    if (!post.created_by) return "";
    if (post.created_by === session?.user.id) return "you";
    const author = peopleById.get(post.created_by);
    return author?.email ? author.email.split("@")[0] : "";
  };

  if (!supabaseConfigured) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Admin isn't configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
      </div>
    );
  }

  const canEdit = profile && (profile.role === "editor" || profile.role === "admin");

  return (
    <div className={`${styles.page} ${editing ? styles.pageWide : ""}`}>
      {session && (
        <header className={styles.header}>
          <a href="/" className={styles.brand} title="Back to the app">
            <img src="/dabus-icon-128.png" alt="" />
            <span>News admin</span>
          </a>
          <div className={styles.who}>
            <span className={styles.whoEmail}>{session.user.email}</span>
            <button type="button" className={styles.secondaryBtn} onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </header>
      )}

      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {session === undefined && <p className={styles.empty}>Loading…</p>}

      {session === null && <LoginForm onError={setError} />}

      {session && profile && !canEdit && (
        <div className={styles.card}>
          <p>
            You're signed in, but this account doesn't have editor access yet. Ask Alex to enable it for{" "}
            <strong>{session.user.email}</strong>.
          </p>
        </div>
      )}

      {session && canEdit && editing && (
        <PostEditor
          key={editing.post?.id || "new"}
          user={session.user}
          post={editing.post}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            loadPosts();
          }}
          onCancel={() => setEditing(null)}
          onError={setError}
        />
      )}

      {session && canEdit && !editing && (
        <>
          {isAdmin && (
            <nav className={styles.tabs} aria-label="Admin sections">
              {[
                ["posts", "Posts"],
                ["users", "Users"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.tab} ${view === key ? styles.tabOn : ""}`}
                  aria-current={view === key ? "page" : undefined}
                  onClick={() => setView(key)}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
          <div className={styles.listHeader}>
            <h2 className={styles.viewTitle}>{isAdmin && view === "users" ? "Users" : "Posts"}</h2>
            {!(isAdmin && view === "users") && (
              <button type="button" className={styles.primaryBtn} onClick={() => setEditing({ post: null })}>
                + New post
              </button>
            )}
          </div>
          {isAdmin && view === "users" ? (
            <UsersPanel
              people={people}
              loading={peopleLoading}
              currentUserId={session.user.id}
              onChanged={(msg) => {
                setNotice(msg);
                loadPeople();
              }}
              onError={setError}
            />
          ) : !postsLoading && posts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No posts yet. Your first one shows up in the app's News tab right away.</p>
              <button type="button" className={styles.primaryBtn} onClick={() => setEditing({ post: null })}>
                Write the first post
              </button>
            </div>
          ) : (
            <PostList
              posts={posts}
              loading={postsLoading}
              now={loadedAt}
              isAdmin={isAdmin}
              canModify={canModify}
              authorLabel={authorLabel}
              onEdit={(post) => setEditing({ post })}
              onTrash={(post) => setConfirm({ kind: "trash", post })}
              onRestore={restorePost}
              onPurge={(post) => setConfirm({ kind: "purge", post })}
              onEndNow={endNow}
              onTogglePin={togglePin}
            />
          )}
        </>
      )}

      <div className={styles.toastSlot} role="status" aria-live="polite">
        {notice && <div className={styles.toast}>{notice}</div>}
      </div>

      {confirm?.kind === "trash" && (
        <ConfirmDialog
          title="Move this post to Trash?"
          message={`“${confirm.post.title}” disappears from the app right away. You can restore it from Trash.`}
          confirmLabel="Move to Trash"
          onConfirm={() => trashPost(confirm.post)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === "purge" && (
        <ConfirmDialog
          title="Delete this post forever?"
          message={`“${confirm.post.title}” and its photos will be permanently removed. This can't be undone.`}
          confirmLabel="Delete forever"
          onConfirm={() => purgePost(confirm.post)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
