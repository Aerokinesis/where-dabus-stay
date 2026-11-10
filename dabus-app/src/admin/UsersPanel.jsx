import { useState } from "react";

import { supabase } from "../lib/supabase";
import styles from "./AdminPage.module.css";

const joined = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

// Admin-only: everyone with an account, and whether they can post. The admin
// role itself is never granted or removed here (see supabase/0002_*.sql).
export default function UsersPanel({ people, loading, currentUserId, onChanged, onError }) {
  const [savingId, setSavingId] = useState(null);

  const setRole = async (person, role) => {
    setSavingId(person.id);
    const { error } = await supabase.rpc("set_user_role", { target: person.id, new_role: role });
    setSavingId(null);
    if (error) return onError(error.message);
    onChanged(role === "editor" ? `${person.email} can now post` : `${person.email} no longer has access`);
  };

  if (loading && people.length === 0) return <p className={styles.empty}>Loading users…</p>;

  const order = { admin: 0, editor: 1, viewer: 2 };
  const sorted = [...people].sort(
    (a, b) => order[a.role] - order[b.role] || (a.email || "").localeCompare(b.email || ""),
  );

  return (
    <>
      <p className={styles.sectionHint}>
        Editors can write posts and edit, pin or end posts written by editors. Only you can edit your own posts, delete or
        restore, and change roles. New accounts are created in the Supabase dashboard and start with no access.
      </p>
      <ul className={styles.userList}>
        {sorted.map((person) => (
          <li key={person.id} className={styles.userRow}>
            <span className={styles.userText}>
              <span className={styles.userEmail}>
                {person.email || "(no email)"}
                {person.id === currentUserId && <span className={styles.userYou}> (you)</span>}
              </span>
              <span className={styles.postSub}>Joined {joined(person.created_at)}</span>
            </span>
            {person.role === "admin" ? (
              <span className={styles.roleBadge}>Admin</span>
            ) : (
              <select
                className={styles.roleSelect}
                value={person.role}
                disabled={savingId === person.id}
                onChange={(e) => setRole(person, e.target.value)}
                aria-label={`Role for ${person.email}`}
              >
                <option value="viewer">No access</option>
                <option value="editor">Editor</option>
              </select>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
