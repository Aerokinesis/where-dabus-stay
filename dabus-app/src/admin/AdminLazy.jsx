import { lazy } from "react";

// Code-split entry for the editor dashboard: the Supabase client and the
// admin UI only download when someone actually visits /admin.
const AdminPage = lazy(() => import("./AdminPage.jsx"));

export default AdminPage;
