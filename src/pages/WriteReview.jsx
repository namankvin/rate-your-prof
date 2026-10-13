import { useState } from "react";
import {
  Avatar,
  Link,
  PageHeading,
  Tag,
  EmptyState,
} from "../components/UI.jsx";
import Icon from "../components/Icon.jsx";
import { ratingLabels, reviewTags } from "../data/formOptions.js";
import { request } from "../services/api.js";
import { useData } from "../context/DataContext.jsx";

function StarInput({ label, value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-input-row">
      <span>{label}</span>
      <div
        className="star-input"
        role="group"
        aria-label={label}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            aria-label={`${label}: ${n} out of 5`}
            aria-pressed={value === n}
            className={n <= (hover || value) ? "filled" : ""}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        ))}
        <span>{value || "—"}</span>
      </div>
    </div>
  );
}
export default function WriteReview({ params }) {
  const { professors, courses, setReviews } = useData();
  const requestedCourse = params.get("course");
  const [professorId, setProfessorId] = useState(
    params.get("professor") ||
      (requestedCourse
        ? professors.find((p) => p.courses.includes(requestedCourse))?.id || ""
        : ""),
  );
  const [courseId, setCourseId] = useState(requestedCourse || "");
  const [semester, setSemester] = useState("Autumn 2026");
  const [ratings, setRatings] = useState([0, 0, 0, 0, 0, 0]);
  const [text, setText] = useState("");
  const [tags, setTags] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const professor = professors.find((p) => p.id === professorId);
  const availableCourses = courses.filter((c) =>
    professor?.courses.includes(c.id),
  );
  if (!professors.length)
    return (
      <div className="container page narrow">
        <PageHeading title="Write a review" />
        <EmptyState
          title="No professors added yet"
          description="Reviews will be available after professor profiles and teaching assignments are added."
        />
      </div>
    );
  function toggleTag(tag) {
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length < 5
          ? [...prev, tag]
          : prev,
    );
  }
  async function submit(e) {
    e.preventDefault();
    if (!professor || !availableCourses.some((c) => c.id === courseId))
      return setError("Choose a professor and a course they teach.");
    if (ratings.some((r) => r === 0))
      return setError("Please rate all six categories before submitting.");
    if (!confirmed)
      return setError(
        "Please confirm this review reflects your personal experience.",
      );
    setBusy(true);
    setError("");
    try {
      await request(
        `/auth/review-eligibility?professorId=${encodeURIComponent(professorId)}&courseId=${encodeURIComponent(courseId)}`,
      );
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
      return;
    }
    const today = new Date();
    setReviews((prev) => [
      {
        id: `preview-${Date.now()}`,
        professorId,
        courseId,
        department: professor.department,
        semester,
        date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
        rating: ratings[5],
        ratings,
        text: text.trim(),
        tags,
        helpful: 0,
      },
      ...prev,
    ]);
    setSubmitted(true);
    setBusy(false);
    window.scrollTo(0, 0);
  }
  if (submitted)
    return (
      <div className="container page narrow">
        <div className="success-card panel">
          <span className="success-icon">
            <Icon name="check" size={34} />
          </span>
          <div className="eyebrow">A PERSPECTIVE WORTH SHARING</div>
          <h1>Thanks for passing it on.</h1>
          <p>
            Your demo review has been added to this preview. It will reset when
            you refresh the browser.
          </p>
          <Link
            className="button primary"
            to={`/professors/${professorId}/reviews`}
          >
            See your review <Icon name="arrow" size={18} />
          </Link>
          <Link className="text-link" to="/professors">
            Back to professors
          </Link>
        </div>
      </div>
    );
  return (
    <div className="container page">
      <Link
        className="back-link"
        to={professor ? `/professors/${professor.id}` : "/professors"}
      >
        <Icon name="back" size={16} />
        Back to {professor ? "profile" : "professors"}
      </Link>
      <PageHeading
        eyebrow="YOUR PERSPECTIVE MATTERS"
        title="Pass your experience on."
        description="A thoughtful review can make someone else’s semester a little better."
      />
      <div className="write-layout">
        <form onSubmit={submit} className="panel review-form">
          <div className="form-section">
            <h3>
              <span className="form-number">01</span>Set the scene
            </h3>
            <div className="form-grid">
              <label>
                Professor
                <select
                  aria-label="Professor"
                  required
                  value={professorId}
                  onChange={(e) => {
                    setProfessorId(e.target.value);
                    setCourseId("");
                  }}
                >
                  <option value="">Select a professor</option>
                  {professors.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Course
                <select
                  aria-label="Course"
                  required
                  disabled={!professor}
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  <option value="">Select a course</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Semester
              <select
                aria-label="Semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                {[
                  "Autumn 2026",
                  "Spring 2026",
                  "Autumn 2025",
                  "Spring 2025",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {professor && (
              <div className="selected-professor">
                <Avatar professor={professor} size="small-avatar" />
                <div>
                  <strong>{professor.name}</strong>
                  <span>{professor.department}</span>
                </div>
                <Icon name="check" size={18} />
              </div>
            )}
          </div>
          <div className="form-section">
            <h3>
              <span className="form-number">02</span>Your classroom experience
            </h3>
            <p className="muted small">
              1 = low · 5 = high. For workload, 5 means very heavy.
            </p>
            <div className="rating-inputs">
              {ratingLabels.map((label, i) => (
                <StarInput
                  label={label}
                  value={ratings[i]}
                  key={label}
                  onChange={(value) =>
                    setRatings((prev) =>
                      prev.map((r, index) => (i === index ? value : r)),
                    )
                  }
                />
              ))}
            </div>
          </div>
          <div className="form-section">
            <h3>
              <span className="form-number">03</span>Put it in your own words
            </h3>
            <label>
              Your anonymous review <span className="muted">(optional)</span>
              <textarea
                rows={5}
                maxLength={1000}
                placeholder="What helped you learn? What should future students know? Be specific, constructive, and kind."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <div className="character-count">{text.length} / 1,000</div>
            <label>
              Choose up to 5 tags{" "}
              <span className="muted">({tags.length}/5)</span>
            </label>
            <div className="tags selectable-tags">
              {reviewTags.map((t) => (
                <Tag
                  key={t}
                  selected={tags.includes(t)}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </Tag>
              ))}
            </div>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this review is honest and based on my personal experience.
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="submit-row">
            <span>
              <Icon name="lock" size={15} />
              Shared as “Anonymous student”
            </span>
            <button type="submit" disabled={busy} className="button primary">
              {busy ? "Checking account…" : "Preview review"}{" "}
              <Icon name="arrow" size={17} />
            </button>
          </div>
        </form>
        <aside className="review-aside">
          <section className="panel guidance-card">
            <span className="icon-tile">
              <Icon name="shield" size={26} />
            </span>
            <h3>Honest. Helpful. Human.</h3>
            <p>
              The best reviews give the next student something they can actually
              use.
            </p>
            <ul>
              <li>
                Talk about teaching, course content, and your learning
                experience.
              </li>
              <li>Include specific, constructive examples.</li>
              <li>
                Keep names, contact details, and personal information out.
              </li>
              <li>
                Different experiences are okay. Respect the person behind the
                lecture.
              </li>
            </ul>
            <Link to="/guidelines" className="text-link">
              Read our guidelines <Icon name="arrow" size={16} />
            </Link>
          </section>
          <div className="preview-note">
            <Icon name="info" size={18} />
            <p>
              <strong>Frontend preview</strong>Your signed-in account is checked
              by the backend. This review is a temporary preview. Persistent
              submissions and duplicate enforcement belong to Module 3.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
