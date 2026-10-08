package vn.edu.vku.survey;

import jakarta.validation.Valid;
import java.io.IOException;
import java.util.*;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class SurveyController {

    private final SurveyService service;
    private final PhotoStorage storage;
    private final JdbcTemplate jdbc;

    public SurveyController(SurveyService service, PhotoStorage storage, JdbcTemplate jdbc) {
        this.service = service;
        this.storage = storage;
        this.jdbc = jdbc;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        jdbc.queryForObject("SELECT 1", Integer.class);
        return Map.of("status", "UP", "database", "PostgreSQL");
    }

    @PostMapping(value = "/surveys", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SurveyReceipt> receive(
        @Valid @RequestPart("metadata") SurveyRequest request,
        @RequestPart(value = "photo", required = false) MultipartFile photo
    ) throws IOException {
        var result = service.receive(request, photo);
        return ResponseEntity.status(result.duplicate() ? HttpStatus.OK : HttpStatus.CREATED).body(
            result
        );
    }

    @GetMapping("/surveys/{id}/photo")
    public ResponseEntity<Resource> photo(@PathVariable UUID id) {
        var path = storage.path(service.photoPath(id));
        var resource = new FileSystemResource(path);
        if (!resource.exists()) throw new ApiException(
            HttpStatus.NOT_FOUND,
            "Không tìm thấy file ảnh."
        );
        return ResponseEntity.ok()
            .contentType(
                path.toString().endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG
            )
            .header("X-Content-Type-Options", "nosniff")
            .body(resource);
    }
}
