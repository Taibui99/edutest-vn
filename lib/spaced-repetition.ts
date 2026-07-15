/**
 * Thuật toán SM-2 (SuperMemo 2) - dùng để tính khi nào nên ôn lại 1 thẻ flashcard,
 * dựa trên mức độ nhớ của người học. Đây là thuật toán nền tảng mà Anki và nhiều
 * app flashcard nổi tiếng dùng.
 *
 * quality: điểm đánh giá mức độ nhớ, thang 0-5. Ở UI mình rút gọn thành 3 nút:
 *  - "Quên" -> quality = 1  (thẻ sẽ quay lại ôn ngay hôm sau)
 *  - "Khó"  -> quality = 3  (nhớ được nhưng khó khăn, tăng khoảng cách ít)
 *  - "Dễ"   -> quality = 5  (nhớ tốt, tăng khoảng cách ôn xa hơn nhiều)
 */

export type SpacedRepetitionState = {
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
};

export function calculateNextReview(
  state: SpacedRepetitionState,
  quality: number,
): SpacedRepetitionState & { nextReviewAt: Date } {
  let { easinessFactor, intervalDays, repetitions } = state;

  if (quality < 3) {
    // Quên bài - reset về đầu, ôn lại sau 1 ngày
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easinessFactor);
    }
    repetitions += 1;
  }

  easinessFactor =
    easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easinessFactor = Math.max(easinessFactor, 1.3); // không để hệ số quá thấp

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

  return { easinessFactor, intervalDays, repetitions, nextReviewAt };
}
