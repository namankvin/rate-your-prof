import { createContext, useContext, useEffect, useState } from "react";
import { request } from "../services/api.js";
const DataContext = createContext(null);
function withReviewSummary(records, reviews, field) {
  return records.map((record) => {
    const matches = reviews.filter((review) => review[field] === record.id);
    return {
      ...record,
      reviewCount: matches.length,
      rating: matches.length
        ? matches.reduce((sum, review) => sum + review.rating, 0) /
          matches.length
        : null,
    };
  });
}
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
      const [data, reviewData] = await Promise.all([
        request("/catalog"),
        request("/reviews"),
      ]);
      setProfessors(data.professors);
      setCourses(data.courses);
      setDepartmentRecords(data.departments);
      setError("");
      setReviews(reviewData.reviews);
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
        professors: withReviewSummary(professors, reviews, "professorId"),
        courses: withReviewSummary(courses, reviews, "courseId"),
        departmentRecords,
        departments: departmentRecords.map((d) => d.name),
        reviews,
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
