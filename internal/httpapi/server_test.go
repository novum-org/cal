package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/novum-org/cal/internal/store"
)

func TestAuthSessionPreview(t *testing.T) {
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	s := New(st, Config{Signup: "setup"})
	h := s.Router()

	body, _ := json.Marshal(map[string]string{"email": "a@b.co", "password": "password1"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/setup", bytes.NewReader(body))
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("setup %d %s", rec.Code, rec.Body.String())
	}
	cookies := rec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("no cookie")
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/sessions", bytes.NewReader([]byte(`{"name":"Novum","preset":"novum"}`)))
	req.AddCookie(cookies[0])
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("space %d %s", rec.Code, rec.Body.String())
	}
	var sp store.Space
	if err := json.Unmarshal(rec.Body.Bytes(), &sp); err != nil {
		t.Fatal(err)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/sessions/"+sp.ID+"/preview", bytes.NewReader([]byte(
		`{"inputs":{"month":"2026-01","cash_in_month":1035,"infra_cost_month":35,"ef_target_months":6,"tps_pct_above_19":100,"uptime_pct_month":100,"unique_players_week":50,"discord_members":100,"concurrent_avg":5,"stage":"alpha"}}`,
	)))
	req.AddCookie(cookies[0])
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("preview %d %s", rec.Code, rec.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	alloc, _ := out["allocation"].(map[string]any)
	if alloc["people"] != float64(150) {
		t.Fatalf("people %+v body %s", alloc, rec.Body.String())
	}
}
