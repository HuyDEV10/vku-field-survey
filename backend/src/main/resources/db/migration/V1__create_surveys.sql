CREATE TABLE surveys (
    id UUID PRIMARY KEY,
    building VARCHAR(100) NOT NULL,
    floor INTEGER NOT NULL CHECK (floor BETWEEN -5 AND 100),
    room VARCHAR(30) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('HARDWARE','PROJECTOR','AC','ELECTRICAL','FURNITURE')),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    notes VARCHAR(2000) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    photo_path VARCHAR(200),
    payload_hash CHAR(64) NOT NULL
);
CREATE INDEX idx_surveys_received_at ON surveys(received_at DESC);
