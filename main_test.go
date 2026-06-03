package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type fakeRow struct {
	values []any
	err    error
}

func (r fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	for i := range dest {
		switch d := dest[i].(type) {
		case *string:
			*d = r.values[i].(string)
		case *time.Time:
			*d = r.values[i].(time.Time)
		}
	}
	return nil
}

func TestDecodeJSONBody_EmptyBodyDefaultsToObject(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(""))
	var payload enrollmentPayload

	if err := decodeJSONBody(req, &payload); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}

func TestDecodeJSONBody_PayloadTooLarge(t *testing.T) {
	tooLarge := strings.Repeat("a", maxBodyBytes+1)
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(tooLarge))
	var payload map[string]any

	err := decodeJSONBody(req, &payload)
	if err == nil {
		t.Fatal("expected payload too large error")
	}
	if err != errPayloadTooLarge {
		t.Fatalf("expected errPayloadTooLarge, got %v", err)
	}
}

func TestWriteJSON(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeJSON(recorder, http.StatusCreated, map[string]string{"status": "accepted"})

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", recorder.Code)
	}

	var payload map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if payload["status"] != "accepted" {
		t.Fatalf("expected accepted, got %q", payload["status"])
	}
}

func TestScanEnrollment(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	trace, err := scanEnrollment(fakeRow{values: []any{"tx-1", "hash-1", now, "bff-customer", "core_received"}})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if trace.TransactionID != "tx-1" || trace.CustomerEmailHash != "hash-1" {
		t.Fatalf("unexpected trace: %+v", trace)
	}
}

func TestMustEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example")
	value, err := mustEnv("DATABASE_URL")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if value != "postgres://example" {
		t.Fatalf("unexpected env value: %s", value)
	}
}
