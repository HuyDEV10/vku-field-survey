package vn.edu.vku.survey;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

public record SurveyRequest(
    @NotNull UUID id,
    @NotNull Instant createdAt,
    @NotBlank @Size(max = 100) String building,
    @NotNull @Min(-5) @Max(100) Integer floor,
    @NotBlank @Size(max = 30) String room,
    @NotNull Category category,
    @NotNull @Min(1) @Max(5) Integer rating,
    @NotNull @Size(max = 2000) String notes
) {
    public enum Category {
        HARDWARE,
        PROJECTOR,
        AC,
        ELECTRICAL,
        FURNITURE,
    }

    @AssertTrue(message = "Ghi chú lỗi bắt buộc khi đánh giá 1–2 sao.")
    public boolean isDefectDescribed() {
        return rating == null || rating > 2 || (notes != null && !notes.isBlank());
    }
}
