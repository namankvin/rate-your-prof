import { createContext, useContext, useEffect, useState } from "react";
import { request } from "../services/api.js";
const DataContext = createContext(null);
export function DataProvider({ children }) {
  const [professors, setProfessors] = useState([]),
    [courses, setCourses] = useState([]),
    [departmentRecords, setDepartmentRecords] = useState([]);
  const [reviews, setReviews] = useState([]),
    [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refreshCatalog({ showLoading = false } = {}) {
    if (showLoading) setLoading(true);
    try {
      const data = await request("/catalog");
      setProfessors(data.professors);
      setCourses(data.courses);
      setDepartmentRecords(data.departments);
      setError("");
      setReviews((prev) =>
        prev.filter(
          (r) =>
            data.professors.some((p) => p.id === r.professorId) &&
            data.courses.some((c) => c.id === r.courseId),
        ),
      );
    } catch (failure) {
      setError(failure.message);
      throw failure;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refreshCatalog().catch(() => {});
  }, []);
  async function saveCatalog(kind, itemId, body) {
    await request(`/${kind}${itemId ? `/${itemId}` : ""}`, {
      method: itemId ? "PUT" : "POST",
      body,
    });
    await refreshCatalog();
  }
  async function deleteCatalog(kind, itemId) {
    await request(`/${kind}/${itemId}`, { method: "DELETE" });
    await refreshCatalog();
  }
  return (
    <DataContext.Provider
      value={{
        professors,
        courses,
        departmentRecords,
        departments: departmentRecords.map((d) => d.name),
        reviews,
        setReviews,
        reports,
        setReports,
        loading,
        error,
        refreshCatalog,
        saveCatalog,
        deleteCatalog,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
export function useData() {
  return useContext(DataContext);
}
