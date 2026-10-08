package vn.edu.vku.survey;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.security.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class SurveyService {

    private final JdbcTemplate jdbc;
    private final PhotoStorage storage;
    private final ObjectMapper mapper;

    public SurveyService(JdbcTemplate jdbc, PhotoStorage storage, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.mapper = mapper;
    }

    @Transactional
    public SurveyReceipt receive(SurveyRequest request, MultipartFile file) throws IOException {
        var normalized = new SurveyRequest(
            request.id(),
            request.createdAt(),
            request.building().strip(),
            request.floor(),
            request.room().strip(),
            request.category(),
            request.rating(),
            request.notes().strip()
        );
        var photo = storage.read(file);
        String hash;
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            digest.update(mapper.writeValueAsBytes(normalized));
            if (photo != null) digest.update(photo.bytes());
            hash = HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        var existing = jdbc.queryForList(
            "SELECT received_at,payload_hash FROM surveys WHERE id=?",
            request.id()
        );
        if (!existing.isEmpty()) return receipt(existing.getFirst(), request.id(), hash, true);
        String photoPath = storage.save(request.id(), photo, hash);
        int inserted = jdbc.update(
            """
            INSERT INTO surveys(id,building,floor,room,category,rating,notes,created_at,photo_path,payload_hash)
            VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING
            """,
            request.id(),
            normalized.building(),
            normalized.floor(),
            normalized.room(),
            normalized.category().name(),
            normalized.rating(),
            normalized.notes(),
            Timestamp.from(normalized.createdAt()),
            photoPath,
            hash
        );
        var row = jdbc.queryForMap(
            "SELECT received_at,payload_hash FROM surveys WHERE id=?",
            request.id()
        );
        return receipt(row, request.id(), hash, inserted == 0);
    }

    private SurveyReceipt receipt(
        Map<String, Object> row,
        UUID id,
        String hash,
        boolean duplicate
    ) {
        if (!hash.equals(row.get("payload_hash"))) throw new ApiException(
            HttpStatus.CONFLICT,
            "UUID đã được dùng cho nội dung khác. Phiếu chưa được đồng bộ."
        );
        return new SurveyReceipt(id, ((Timestamp) row.get("received_at")).toInstant(), duplicate);
    }

    public String photoPath(UUID id) {
        var rows = jdbc.queryForList("SELECT photo_path FROM surveys WHERE id=?", id);
        if (rows.isEmpty() || rows.getFirst().get("photo_path") == null) throw new ApiException(
            HttpStatus.NOT_FOUND,
            "Phiếu không có ảnh."
        );
        return rows.getFirst().get("photo_path").toString();
    }
}
