package vn.edu.vku.survey;

import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class PhotoStorage {

    private final Path directory;

    public PhotoStorage(@Value("${app.upload-dir}") String directory) {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    public record Photo(byte[] bytes, String extension) {}

    public Photo read(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) return null;
        if (file.getSize() > 4L * 1024 * 1024) throw new ApiException(
            HttpStatus.PAYLOAD_TOO_LARGE,
            "Ảnh tối đa 4 MB."
        );
        byte[] bytes = file.getBytes();
        boolean png =
            bytes.length > 8 &&
            bytes[0] == (byte) 0x89 &&
            bytes[1] == 0x50 &&
            bytes[2] == 0x4e &&
            bytes[3] == 0x47;
        boolean jpeg =
            bytes.length > 3 &&
            bytes[0] == (byte) 0xff &&
            bytes[1] == (byte) 0xd8 &&
            bytes[2] == (byte) 0xff;
        if (!png && !jpeg) throw new ApiException(
            HttpStatus.BAD_REQUEST,
            "Chỉ nhận ảnh JPEG hoặc PNG hợp lệ."
        );
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Không đọc được ảnh."
            );
            var reader = readers.next();
            try {
                reader.setInput(input);
                if (
                    (long) reader.getWidth(0) * reader.getHeight(0) > 20_000_000
                ) throw new ApiException(HttpStatus.BAD_REQUEST, "Kích thước ảnh quá lớn.");
                if (reader.read(0) == null) throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Ảnh không hợp lệ."
                );
            } finally {
                reader.dispose();
            }
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ảnh bị lỗi hoặc không đọc được.");
        }
        return new Photo(bytes, png ? "png" : "jpg");
    }

    public String save(UUID id, Photo photo, String hash) throws IOException {
        if (photo == null) return null;
        Files.createDirectories(directory);
        String name = id + "-" + hash + "." + photo.extension();
        Path target = directory.resolve(name);
        if (!Files.exists(target)) {
            Path temporary = Files.createTempFile(directory, "upload-", ".tmp");
            try {
                Files.write(temporary, photo.bytes());
                Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
            } finally {
                Files.deleteIfExists(temporary);
            }
        }
        return name;
    }

    public Path path(String name) {
        Path file = directory.resolve(name).normalize();
        if (!file.startsWith(directory)) throw new ApiException(
            HttpStatus.BAD_REQUEST,
            "Đường dẫn ảnh không hợp lệ."
        );
        return file;
    }
}
