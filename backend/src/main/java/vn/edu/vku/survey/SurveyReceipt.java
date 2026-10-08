package vn.edu.vku.survey;

import java.time.Instant;
import java.util.UUID;

public record SurveyReceipt(UUID id, Instant receivedAt, boolean duplicate) {}
