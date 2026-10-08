package vn.edu.vku.survey;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles("test")
class SurveyIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    SurveyService service;

    SurveyRequest request(UUID id, int rating, String notes) {
        return new SurveyRequest(
            id,
            Instant.parse("2026-10-08T05:00:00Z"),
            "Tòa A",
            2,
            "A201",
            SurveyRequest.Category.PROJECTOR,
            rating,
            notes
        );
    }

    MockMultipartFile metadata(SurveyRequest r) throws Exception {
        return new MockMultipartFile(
            "metadata",
            "metadata.json",
            "application/json",
            mapper.writeValueAsBytes(r)
        );
    }

    @BeforeEach
    void clear() {
        String database = jdbc.queryForObject("SELECT current_database()", String.class);
        if (database == null || !database.endsWith("_test")) throw new IllegalStateException(
            "Integration tests require a separate database ending in _test"
        );
        jdbc.update("DELETE FROM surveys");
    }

    @Test
    void savesAndDeduplicates() throws Exception {
        var r = request(UUID.randomUUID(), 4, "Tốt");
        mvc.perform(multipart("/api/surveys").file(metadata(r)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.duplicate").value(false));
        mvc.perform(multipart("/api/surveys").file(metadata(r)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(true));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM surveys", Integer.class)).isEqualTo(1);
    }

    @Test
    void rejectsConflictingId() throws Exception {
        UUID id = UUID.randomUUID();
        service.receive(request(id, 4, "Tốt"), null);
        mvc.perform(multipart("/api/surveys").file(metadata(request(id, 5, "Khác")))).andExpect(
            status().isConflict()
        );
    }

    @Test
    void requiresDefectNotes() throws Exception {
        mvc.perform(
            multipart("/api/surveys").file(metadata(request(UUID.randomUUID(), 1, "")))
        ).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM surveys", Integer.class)).isZero();
    }

    @Test
    void rejectsInvalidImage() throws Exception {
        mvc.perform(
            multipart("/api/surveys")
                .file(metadata(request(UUID.randomUUID(), 4, "")))
                .file(
                    new MockMultipartFile("photo", "x.png", "image/png", "not an image".getBytes())
                )
        ).andExpect(status().isBadRequest());
    }

    @Test
    void savesAndServesPhoto() throws Exception {
        var imageBuffer = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(
            new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB),
            "png",
            imageBuffer
        );
        byte[] image = imageBuffer.toByteArray();
        UUID id = UUID.randomUUID();
        mvc.perform(
            multipart("/api/surveys")
                .file(metadata(request(id, 4, "")))
                .file(new MockMultipartFile("photo", "x.png", "image/png", image))
        ).andExpect(status().isCreated());
        mvc.perform(get("/api/surveys/" + id + "/photo"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.IMAGE_PNG))
            .andExpect(content().bytes(image));
    }

    @Test
    void concurrentDuplicateCreatesOneRow() throws Exception {
        var r = request(UUID.randomUUID(), 4, "Tốt");
        try (var executor = Executors.newFixedThreadPool(4)) {
            var futures = new ArrayList<Future<SurveyReceipt>>();
            for (int i = 0; i < 4; i++) futures.add(
                executor.submit(() -> service.receive(r, null))
            );
            for (var f : futures) assertThat(f.get().id()).isEqualTo(r.id());
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM surveys", Integer.class)).isEqualTo(1);
    }

    @Test
    void corsAllowsConfiguredOriginOnly() throws Exception {
        mvc.perform(
            options("/api/surveys")
                .header("Origin", "http://localhost:4173")
                .header("Access-Control-Request-Method", "POST")
        )
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4173"));
        mvc.perform(
            options("/api/surveys")
                .header("Origin", "https://untrusted.example")
                .header("Access-Control-Request-Method", "POST")
        ).andExpect(status().isForbidden());
    }

    @Test
    void healthChecksDatabase() throws Exception {
        mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }
}
