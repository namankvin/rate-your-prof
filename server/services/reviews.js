import { randomUUID } from "node:crypto";
import { transaction } from "../db.js";
import { HttpError, requireValue } from "../lib/errors.js";
import { id, text } from "../lib/validation.js";
import { ratingLabels, reviewTags } from "../../shared/reviewOptions.js";

export function validateReview(body) {
  const professorId = id(body.professorId),
    courseId = id(body.courseId);
  requireValue(
    typeof body.semester === "string" &&
      /^(Spring|Autumn) 20\d{2}$/.test(body.semester),
    "Choose a valid semester and year.",
  );
  requireValue(
    Number(body.semester.slice(-4)) <= new Date().getFullYear() &&
      !(
        body.semester === `Autumn ${new Date().getFullYear()}` &&
        new Date().getMonth() < 6
      ),
    "Choose a semester that has started.",
  );
  requireValue(
    Array.isArray(body.ratings) &&
      body.ratings.length === ratingLabels.length &&
      body.ratings.every(
        (value) => Number.isInteger(value) && value >= 1 && value <= 5,
      ),
    "Rate all six categories from 1 to 5.",
  );
  requireValue(
    Array.isArray(body.tags) &&
      body.tags.length <= 5 &&
      new Set(body.tags).size === body.tags.length &&
      body.tags.every((tag) => reviewTags.includes(tag)),
    "Choose up to five different tags from the list.",
  );
  requireValue(
    body.confirmed === true,
    "Confirm this review reflects your personal experience.",
  );
  const reviewText = text(body.text ?? "", "Review", 1000, true);
  requireValue(
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(reviewText),
    "Remove unsupported control characters from your review.",
  );
  return {
    professorId,
    courseId,
    semester: body.semester,
    ratings: body.ratings,
    tags: body.tags,
    text: reviewText,
  };
}

export function createReviewService(pool, auth) {
  async function list() {
    const [rows] =
      await pool.query(`SELECT r.id, r.professor_id, r.course_id, r.semester, r.ratings, r.review_text, r.tags, r.created_at, d.name AS department
      FROM reviews r JOIN professors p ON p.id = r.professor_id JOIN departments d ON d.id = p.department_id
      ORDER BY r.created_at DESC, r.id`);
    return rows.map((row) => {
      const ratings =
        typeof row.ratings === "string" ? JSON.parse(row.ratings) : row.ratings;
      return {
        id: row.id,
        professorId: row.professor_id,
        courseId: row.course_id,
        semester: row.semester,
        ratings,
        rating: ratings[5],
        text: row.review_text,
        tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
        date: new Date(row.created_at).toISOString().slice(0, 10),
        department: row.department,
      };
    });
  }
  async function submit(user, body) {
    requireValue(
      user.role === "student",
      "Only student accounts can submit reviews.",
      403,
    );
    const review = validateReview(body),
      reviewId = randomUUID();
    try {
      await transaction(pool, async (connection) => {
        // Lock the teaching assignment until the review is committed.
        const [links] = await connection.execute(
          "SELECT 1 FROM professor_courses WHERE professor_id = ? AND course_id = ? FOR SHARE",
          [review.professorId, review.courseId],
        );
        requireValue(
          links.length > 0,
          "This professor does not teach the selected course.",
        );
        const key = await auth.reviewIdentity(
          user.id,
          review.professorId,
          review.courseId,
          connection,
        );
        await connection.execute(
          "INSERT INTO reviews (id, professor_id, course_id, context_key, semester, ratings, review_text, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            reviewId,
            review.professorId,
            review.courseId,
            key,
            review.semester,
            JSON.stringify(review.ratings),
            review.text,
            JSON.stringify(review.tags),
          ],
        );
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY")
        throw new HttpError(
          409,
          "You have already reviewed this professor for this course.",
          "REVIEW_EXISTS",
        );
      throw error;
    }
    return { id: reviewId, message: "Your anonymous review has been saved." };
  }
  return { list, submit };
}
