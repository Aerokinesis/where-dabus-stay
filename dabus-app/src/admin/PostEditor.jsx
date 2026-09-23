import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import { resizeImage } from "../lib/resizeImage";
import { CATEGORIES } from "../lib/posts";
import PostCard from "../components/PostCard";
import ConfirmDialog from "../components/ConfirmDialog";
import StopPicker from "./StopPicker";
import { API_BASE } from "../constants";
import styles from "./AdminPage.module.css";

export const BUCKET = "post-images";

// "2, 40 c" -> ["2", "40", "C"]; commas, spaces or newlines all separate.
const parseList = (str) => [
  ...new Set(
    (str || "")
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  ),
];

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time.
const toLocalInput = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Quick picks for "Hide after", measured from "Show from" so they still make
// sense for a post scheduled in the future.
const END_PRESETS = [
  { key: "none", label: "No end" },
  { key: "day", label: "End of that day" },
  { key: "3d", label: "3 days" },
  { key: "1w", label: "1 week" },
];

const presetEnd = (key, startsAt) => {
  const start = new Date(startsAt || Date.now());
  if (key === "none") return "";
  if (key === "day") {
    const d = new Date(start);
    d.setHours(23, 59, 0, 0);
    return toLocalInput(d);
  }
  const days = key === "3d" ? 3 : 7;
  return toLocalInput(new Date(start.getTime() + days * 864e5));
};

const formFromPost = (post) =>
  post
    ? {
        category: post.category,
        title: post.title || "",
        body: post.body || "",
        routes: (post.route_ids || []).join(", "),
        stops: [...(post.stop_ids || [])],
        link_url: post.link_url || "",
        pinned: !!post.pinned,
        starts_at: toLocalInput(post.starts_at),
        ends_at: toLocalInput(post.ends_at),
      }
    : {
        category: "service_change",
        title: "",
        body: "",
        routes: "",
        stops: [],
        link_url: "",
        pinned: false,
        starts_at: toLocalInput(new Date()),
        ends_at: "",
      };

let tempCounter = 0;
const tempId = () => `${Date.now()}-${++tempCounter}-${Math.random().toString(36).slice(2, 8)}`;

// Create or edit one post. Photos upload as soon as they're added (so the
// preview can show them); the post row itself is only written on Save.
//
// Storage bookkeeping, so nothing is orphaned or lost:
//   - photos uploaded in this session and then removed are deleted right away
//     (no saved post references them yet);
//   - photos that were already on the post and get removed are only deleted
//     AFTER the save succeeds — cancelling an edit leaves them intact;
//   - cancelling deletes everything uploaded in this session.
export default function PostEditor({ user, post, onSaved, onCancel, onError }) {
  const isEdit = !!post;
  const initialForm = useMemo(() => formFromPost(post), [post]);
  const initialImages = useMemo(
    () => (post?.images || []).map((img) => ({ ...img, id: img.path || img.url, isNew: false })),
    [post],
  );

  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState(initialImages);
  const [removedExisting, setRemovedExisting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // id -> { name, routes } for showing stop names; not part of the saved row.
  const [stopInfo, setStopInfo] = useState({});
  const titleRef = useRef(null);
  const newUploads = useRef(new Set());

  // New posts start in the title field. Not when editing — on a phone that
  // pops the keyboard over the post you opened to look at.
  useEffect(() => {
    if (!isEdit) titleRef.current?.focus();
  }, [isEdit]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const routeList = parseList(form.routes);
  const stopList = form.stops;
  const uploading = images.some((i) => i.uploading);
  const endsBeforeStart = form.ends_at && form.starts_at && new Date(form.ends_at) <= new Date(form.starts_at);

  const dirty =
    JSON.stringify(form) !== JSON.stringify(initialForm) ||
    images.length !== initialImages.length ||
    images.some((img, i) => img.url !== initialImages[i]?.url);

  // Editing a post with stops: fetch their names once so chips read
  // "#45 S Beretania St + Punchbowl St", not just "#45".
  useEffect(() => {
    const ids = initialForm.stops;
    if (!ids.length) return;
    const ctrl = new AbortController();
    fetch(`${API_BASE}/api/stops/lookup?ids=${ids.join(",")}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { stops: [] }))
      .then((d) => {
        const next = {};
        for (const st of d.stops || [])
          next[st.stop_id] = st.stop_name ? { name: st.stop_name, routes: st.routes } : { missing: true };
        setStopInfo((cur) => ({ ...next, ...cur }));
      })
      .catch(() => {}); // names are a nicety; numbers still work without them
    return () => ctrl.abort();
  }, [initialForm]);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const addFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    for (const file of files) {
      const id = tempId();
      const localUrl = URL.createObjectURL(file);
      setImages((imgs) => [...imgs, { id, url: localUrl, uploading: true, isNew: true }]);
      try {
        const blob = await resizeImage(file);
        const path = `${user.id}/${id}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        newUploads.current.add(path);
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        setImages((imgs) =>
          imgs.map((img) => (img.id === id ? { id, url: data.publicUrl, path, uploading: false, isNew: true } : img)),
        );
      } catch (err) {
        onError(`Photo upload failed: ${err.message}`);
        setImages((imgs) => imgs.filter((img) => img.id !== id));
      } finally {
        URL.revokeObjectURL(localUrl);
      }
    }
  };

  const removeImage = async (img) => {
    setImages((imgs) => imgs.filter((i) => i.id !== img.id));
    if (!img.path) return;
    if (img.isNew) {
      newUploads.current.delete(img.path);
      await supabase.storage.from(BUCKET).remove([img.path]);
    } else {
      setRemovedExisting((r) => [...r, img.path]);
    }
  };

  const moveImage = (from, to) =>
    setImages((imgs) => {
      if (to < 0 || to >= imgs.length) return imgs;
      const next = [...imgs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const discardAndClose = async () => {
    setConfirmDiscard(false);
    const paths = [...newUploads.current];
    newUploads.current.clear();
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    onCancel();
  };

  const requestCancel = () => (dirty ? setConfirmDiscard(true) : discardAndClose());

  const submit = async (e) => {
    e.preventDefault();
    if (uploading) return onError("Wait for photos to finish uploading.");
    if (endsBeforeStart) return onError("“Hide after” must be later than “Show from”.");

    setBusy(true);
    const row = {
      category: form.category,
      title: form.title.trim(),
      body: form.body.trim(),
      route_ids: routeList,
      stop_ids: stopList,
      images: images.map(({ url, path }) => ({ url, path })),
      link_url: form.link_url.trim() || null,
      pinned: form.pinned,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };

    const { error } = isEdit
      ? await supabase.from("posts").update(row).eq("id", post.id)
      : await supabase.from("posts").insert({ ...row, created_by: user.id });

    if (error) {
      setBusy(false);
      return onError(error.message);
    }
    newUploads.current.clear();
    if (removedExisting.length) await supabase.storage.from(BUCKET).remove(removedExisting);
    setBusy(false);
    onSaved(isEdit ? "Changes saved" : "Published");
  };

  // What riders will see, rebuilt on every keystroke.
  const preview = {
    id: "preview",
    category: form.category,
    title: form.title.trim(),
    body: form.body.trim(),
    route_ids: routeList,
    stop_ids: stopList,
    stops: stopList.map((id) => ({ id, name: stopInfo[id]?.name || null })),
    images: images.map(({ url, path }) => ({ url, path })),
    link_url: form.link_url.trim() || null,
    pinned: form.pinned,
    starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
  };

  const activePreset = END_PRESETS.find((p) => presetEnd(p.key, form.starts_at) === form.ends_at)?.key;

  return (
    <div className={styles.editorView}>
      <div className={styles.editorHeader}>
        <button type="button" className={styles.backBtn} onClick={requestCancel}>
          ‹ All posts
        </button>
        <h2 className={styles.viewTitle}>{isEdit ? "Edit post" : "New post"}</h2>
      </div>

      <div className={styles.editorGrid}>
        <form id="post-form" className={styles.form} onSubmit={submit} noValidate>
          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>What</legend>

            <div className={styles.field}>
              <span className={styles.label} id="type-label">Type</span>
              <div className={styles.segmented} role="radiogroup" aria-labelledby="type-label">
                {CATEGORIES.map((c) => (
                  <label key={c.key} className={`${styles.segment} ${form.category === c.key ? styles.segmentOn : ""}`}>
                    <input
                      type="radio"
                      name="category"
                      value={c.key}
                      checked={form.category === c.key}
                      onChange={set("category")}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>
                Title <span className={styles.count}>{form.title.length}/140</span>
              </span>
              <input ref={titleRef} type="text" maxLength={140} value={form.title} onChange={set("title")} required />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Details</span>
              <textarea
                rows={6}
                maxLength={4000}
                value={form.body}
                onChange={set("body")}
                placeholder="Leave a blank line between paragraphs."
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Link (optional)</span>
              <input type="url" value={form.link_url} onChange={set("link_url")} placeholder="https://…" />
            </label>
          </fieldset>

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Photos</legend>
            <label
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneOn : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
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
              <strong>Add photos</strong>
              <span>Drop images here or tap to choose. Large photos are shrunk automatically.</span>
            </label>
            {images.length > 0 && (
              <ul className={styles.thumbs}>
                {images.map((img, i) => (
                  <li key={img.id} className={styles.thumb}>
                    <div className={styles.thumbImg}>
                      <img src={img.url} alt="" />
                      {i === 0 && <span className={styles.coverBadge}>Cover</span>}
                      {img.uploading && <span className={styles.thumbBadge}>Uploading…</span>}
                    </div>
                    <div className={styles.thumbActions}>
                      <button type="button" onClick={() => moveImage(i, i - 1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`}>
                        ‹
                      </button>
                      <button type="button" onClick={() => removeImage(img)} aria-label={`Remove photo ${i + 1}`} className={styles.thumbRemove}>
                        ×
                      </button>
                      <button type="button" onClick={() => moveImage(i, i + 1)} disabled={i === images.length - 1} aria-label={`Move photo ${i + 1} later`}>
                        ›
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Where</legend>
            <p className={styles.sectionHint}>
              Optional. Adding routes or stops also shows this post as an alert on those routes and stops.
            </p>
            <label className={styles.field}>
              <span className={styles.label}>Routes</span>
              <input type="text" value={form.routes} onChange={set("routes")} placeholder="e.g. 2, 13, 40" inputMode="text" />
            </label>
            <div className={styles.field}>
              <span className={styles.label}>Stops</span>
              <StopPicker
                value={form.stops}
                onChange={(stops) => setForm((f) => ({ ...f, stops }))}
                info={stopInfo}
                onInfo={(more) => setStopInfo((cur) => ({ ...cur, ...more }))}
                routes={routeList}
              />
            </div>
          </fieldset>

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>When</legend>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Show from</span>
                <input type="datetime-local" value={form.starts_at} onChange={set("starts_at")} required />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Hide after</span>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={set("ends_at")}
                  min={form.starts_at}
                  aria-invalid={!!endsBeforeStart}
                />
              </label>
            </div>
            <div className={styles.presets} role="group" aria-label="Hide after presets">
              {END_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={activePreset === p.key}
                  className={`${styles.preset} ${activePreset === p.key ? styles.presetOn : ""}`}
                  onClick={() => setForm((f) => ({ ...f, ends_at: presetEnd(p.key, f.starts_at) }))}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {endsBeforeStart && <span className={styles.fieldError}>“Hide after” must be later than “Show from”.</span>}

            <label className={styles.toggle}>
              <input type="checkbox" checked={form.pinned} onChange={set("pinned")} />
              <span>
                <strong>Pin to top</strong>
                <span className={styles.toggleHint}>Keeps this above newer posts until unpinned.</span>
              </span>
            </label>
          </fieldset>
        </form>

        <aside className={styles.previewPane} aria-label="Preview">
          <h3 className={styles.previewTitle}>Preview</h3>
          <div className={styles.previewFrame}>
            <PostCard post={preview} preview />
          </div>
        </aside>
      </div>

      <div className={styles.actionBar}>
        <button type="button" className={styles.secondaryBtn} onClick={requestCancel}>
          Cancel
        </button>
        <button
          type="submit"
          form="post-form"
          className={styles.primaryBtn}
          disabled={busy || uploading || !form.title.trim()}
        >
          {busy ? "Saving…" : uploading ? "Uploading photos…" : isEdit ? "Save changes" : "Publish"}
        </button>
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard changes?"
          message={isEdit ? "Your edits to this post won't be saved." : "This post hasn't been published and will be lost."}
          confirmLabel="Discard"
          onConfirm={discardAndClose}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
}
