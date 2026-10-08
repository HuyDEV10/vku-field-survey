package vn.edu.vku.survey;

import java.io.IOException;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class ApiErrors {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> custom(ApiException e) {
        return ResponseEntity.status(e.status).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> invalid(MethodArgumentNotValidException e) {
        return ResponseEntity.badRequest().body(
            Map.of("message", e.getBindingResult().getAllErrors().getFirst().getDefaultMessage())
        );
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MissingServletRequestPartException.class,
    })
    ResponseEntity<?> malformed(Exception e) {
        return ResponseEntity.badRequest().body(
            Map.of("message", "Thiếu hoặc sai định dạng metadata của phiếu.")
        );
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<?> tooLarge(Exception e) {
        return ResponseEntity.status(413).body(
            Map.of("message", "Ảnh tối đa 4 MB, tổng yêu cầu tối đa 5 MB.")
        );
    }

    @ExceptionHandler(IOException.class)
    ResponseEntity<?> io(IOException e) {
        return ResponseEntity.status(503).body(
            Map.of("message", "Chưa lưu được ảnh. Phiếu vẫn nằm trong hàng đợi để thử lại.")
        );
    }
}
