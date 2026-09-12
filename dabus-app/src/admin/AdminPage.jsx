import { useCallback, useEffect, useState } from "react";

import { supabase, supabaseConfigured } from "../lib/supabase";
import { resizeImage } from "../lib/resizeImage";
import ImageCarousel from "../components/ImageCarousel";
import ConfirmDialog from "../components/ConfirmDialog";
import styles from "./AdminPage.module.css";

const CATEGORIES = [
  { key: "service_change", label: "Service change" },
  { key: "event", label: "Event" },
  { key: "volunteer", label: "Volunteer" },
  { key: "otr_update", label: "OTR update" },
];

const BUCKET = "post-images";

// "2, 40, C" -> ["2", "40", "C"]; also accepts spaces/newlines as separators.
const parseList = (str) =>
  [...new Set(
    (str || "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )];

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time.
const toLocalInput = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EMPTY_FORM = {
  category: "service_change",
  title: "",
  body: "",
  routes: "",
  stops: "",
  link_url: "",
  pinned: false,
  starts_at: toLocalInput(new Date()),
  ends_at: "",
};

const formatWhen = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

const postStatus = (p) => {
  const now = Date.now();
  if (new Date(p.starts_at).getTime() > now) return "scheduled";
  if (p.ends_at && new Date(p.ends_at).getTime() <= now) return "expired";
  return "live";
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
    if (error) onError(error.message);
  };

  return (
    <form className={styles.card} onSubmit={submit}>
      <h2 className={styles.cardTitle}>Sign in</h2>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit" className={styles.primaryBtn} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

// ── Post editor ──────────────────────────────────────────────────────────────

function PostForm({ user, onSaved, onError }) {
  const [form, setForm] = useState(EMPTY_FORM);
  // Each: { url, path, uploading }
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const addFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    for (const file of files) {
      const localUrl = URL.createObjectURL(file);
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setImages((imgs) => [...imgs, { id: tempId, url: localUrl, uploading: true }]);
      try {
        const blob = await resizeImage(file);
        const path = `${user.id}/${tempId}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        setImages((imgs) =>
          imgs.map((img) =>
            img.id === tempId ? { id: tempId, url: data.publicUrl, path, uploading: false } : img,
          ),
        );
      } catch (err) {
        onError(`Image upload failed: ${err.message}`);
        setImages((imgs) => imgs.filter((img) => img.id !== tempId));
      } finally {
        URL.revokeObjectURL(localUrl);
      }
    }
  };

  const removeImage = async (img) => {
    setImages((imgs) => imgs.filter((i) => i.id !== img.id));
    if (img.path) await supabase.storage.from(BUCKET).remove([img.path]);
  };

  const moveImage = (from, to) => {
    setImages((imgs) => {
      if (to < 0 || to >= imgs.length) return imgs;
      const next = [...imgs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (images.some((i) => i.uploading)) return onError("Wait for images to finish uploading.");
    setBusy(true);
    const row = {
      category: form.category,
      title: form.title.trim(),
      body: form.body.trim(),
      route_ids: parseList(form.routes),
      stop_ids: parseList(form.stops),
      images: images.map(({ url, path }) => ({ url, path })),
      link_url: form.link_url.trim() || null,
      pinned: form.pinned,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      created_by: user.id,
    };
    const { error } = await supabase.from("posts").insert(row);
    setBusy(false);
    if (error) return onError(error.message);
    setForm({ ...EMPTY_FORM, starts_at: toLocalInput(new Date()) });
    setImages([]);
    onSaved();
  };

  const isAlert = parseList(form.routes).length > 0 || parseList(form.stops).length > 0;

  return (
    <form className={styles.card} onSubmit={submit}>
      <h2 className={styles.cardTitle}>New post</h2>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Type</span>
          <select value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className={`${styles.field} ${styles.checkbox}`}>
          <input type="checkbox" checked={form.pinned} onChange={set("pinned")} />
          <span>Pin to top</span>
        </label>
      </div>

      <label className={styles.field}>
        <span>Title</span>
        <input type="text" maxLength={140} value={form.title} onChange={set("title")} required />
      </label>

      <label className={styles.field}>
        <span>Details</span>
        <textarea rows={5} maxLength={4000} value={form.body} onChange={set("body")} placeholder="Blank line between paragraphs." />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Routes affected</span>
          <input type="text" value={form.routes} onChange={set("routes")} placeholder="e.g. 2, 13, 40" />
        </label>
        <label className={styles.field}>
          <span>Stop numbers</span>
          <input type="text" value={form.stops} onChange={set("stops")} placeholder="e.g. 4511, 986" />
        </label>
      </div>
      <p className={styles.hint}>
        {isAlert
          ? "This post will also appear as an alert on those routes / stops in the app."
          : "Leave routes and stops empty for a general announcement (feed only)."}
      </p>

      <label className={styles.field}>
        <span>Link (optional)</span>
        <input type="url" value={form.link_url} onChange={set("link_url")} placeholder="https://…" />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Show from</span>
          <input type="datetime-local" value={form.starts_at} onChange={set("starts_at")} required />
        </label>
        <label className={styles.field}>
          <span>Hide after (optional)</span>
          <input type="datetime-local" value={form.ends_at} onChange={set("ends_at")} min={form.starts_at} />
        </label>
      </div>

      <div className={styles.field}>
        <span>Photos</span>
        <label
          className={styles.dropzone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span>Drop images here or tap to choose. They're resized automatically.</span>
        </label>
        {images.length > 0 && (
          <ul className={styles.thumbs}>
            {images.map((img, i) => (
              <li key={img.id} className={styles.thumb}>
                <img src={img.url} alt="" />
                {img.uploading && <span className={styles.thumbBadge}>Uploading…</span>}
                <div className={styles.thumbActions}>
                  <button type="button" onClick={() => moveImage(i, i - 1)} disabled={i === 0} aria-label="Move earlier">‹</button>
                  <button type="button" onClick={() => removeImage(img)} aria-label="Remove image">×</button>
                  <button type="button" onClick={() => moveImage(i, i + 1)} disabled={i === images.length - 1} aria-label="Move later">›</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="submit" className={styles.primaryBtn} disabled={busy}>
        {busy ? "Publishing…" : "Publish"}
      </button>
    </form>
  );
}

// ── Post list ────────────────────────────────────────────────────────────────

function PostList({ posts, onDelete, onEndNow, onTogglePin }) {
  if (posts.length === 0) return <p className={styles.empty}>No posts yet.</p>;
  return (
    <ul className={styles.list}>
      {posts.map((p) => {
        const status = postStatus(p);
        return (
          <li key={p.id} className={styles.post}>
            {p.images?.length > 0 && (
              <div className={styles.postImages}>
                <ImageCarousel images={p.images} alt={p.title} />
              </div>
            )}
            <div className={styles.postBody}>
              <div className={styles.postMeta}>
                <span className={`${styles.status} ${styles[`status_${status}`]}`}>{status}</span>
                <span className={styles.postCat}>
                  {CATEGORIES.find((c) => c.key === p.category)?.label || p.category}
                </span>
                {p.pinned && <span className={styles.postCat}>Pinned</span>}
              </div>
              <strong className={styles.postTitle}>{p.title}</strong>
              {(p.route_ids?.length > 0 || p.stop_ids?.length > 0) && (
                <span className={styles.postTargets}>
                  {p.route_ids?.length > 0 && `Routes ${p.route_ids.join(", ")}`}
                  {p.route_ids?.length > 0 && p.stop_ids?.length > 0 && " · "}
                  {p.stop_ids?.length > 0 && `Stops ${p.stop_ids.join(", ")}`}
                </span>
              )}
              <span className={styles.postWhen}>
                {formatWhen(p.starts_at)}
                {p.ends_at ? ` → ${formatWhen(p.ends_at)}` : " → no end"}
              </span>
              <div className={styles.postActions}>
                <button type="button" onClick={() => onTogglePin(p)}>
                  {p.pinned ? "Unpin" : "Pin"}
                </button>
                {status === "live" && (
                  <button type="button" onClick={() => onEndNow(p)}>End now</button>
                )}
                <button type="button" className={styles.danger} onClick={() => onDelete(p)}>
                  Delete
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

// Editor dashboard at /admin. Talks to Supabase directly (auth + posts +
// storage); RLS enforces that only editor/admin profiles can write. The
// public app never loads this — main.jsx mounts it only for that path.
export default function AdminPage() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Auth session tracking. Signing out also clears the editor state here so
  // the profile/posts effect below never has to setState synchronously.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setPosts([]);
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
    if (err) setError(err.message);
    else setPosts(data || []);
  }, []);

  // Once signed in: load profile (for role) and posts.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", session.user.id)
        .single();
      if (cancelled) return;
      setProfile(data || { role: "viewer" });
      loadPosts();
    })();
    return () => {
      cancelled = true;
    };
  }, [session, loadPosts]);

  // Auto-dismiss notices.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  const deletePost = async (p) => {
    setConfirmDelete(null);
    const paths = (p.images || []).map((i) => i.path).filter(Boolean);
    const { error: err } = await supabase.from("posts").delete().eq("id", p.id);
    if (err) return setError(err.message);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    setNotice("Post deleted");
    loadPosts();
  };

  const endNow = async (p) => {
    const { error: err } = await supabase
      .from("posts")
      .update({ ends_at: new Date().toISOString() })
      .eq("id", p.id);
    if (err) return setError(err.message);
    setNotice("Post hidden");
    loadPosts();
  };

  const togglePin = async (p) => {
    const { error: err } = await supabase.from("posts").update({ pinned: !p.pinned }).eq("id", p.id);
    if (err) return setError(err.message);
    loadPosts();
  };

  if (!supabaseConfigured) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>
          Admin isn't configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
        </p>
      </div>
    );
  }

  const canEdit = profile && (profile.role === "editor" || profile.role === "admin");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/dabus-icon.png" alt="" />
          <h1>Announcements admin</h1>
        </div>
        {session && (
          <div className={styles.who}>
            <span>{session.user.email}</span>
            <button type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        )}
      </header>

      {error && (
        <div className={styles.error} role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      {notice && <div className={styles.notice} role="status">{notice}</div>}

      {session === undefined && <p className={styles.empty}>Loading…</p>}

      {session === null && <LoginForm onError={setError} />}

      {session && profile && !canEdit && (
        <div className={styles.card}>
          <p>
            You're signed in, but this account doesn't have editor access yet. Ask
            Alex to enable it for <strong>{session.user.email}</strong>.
          </p>
        </div>
      )}

      {session && canEdit && (
        <>
          <PostForm
            user={session.user}
            onSaved={() => {
              setNotice("Published");
              loadPosts();
            }}
            onError={setError}
          />
          <section>
            <h2 className={styles.sectionTitle}>All posts</h2>
            <PostList
              posts={posts}
              onDelete={setConfirmDelete}
              onEndNow={endNow}
              onTogglePin={togglePin}
            />
          </section>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this post?"
          message={`"${confirmDelete.title}" will be removed for everyone. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => deletePost(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
