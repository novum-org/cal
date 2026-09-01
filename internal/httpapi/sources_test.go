package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/novum-org/cal/internal/sources"
	"github.com/novum-org/cal/internal/store"
)

// metricsServer stands in for the JSON a VPS publishes.
func metricsServer(t *testing.T, body string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestSourceCatalogueIsPublicToMembers(t *testing.T) {
	h := newServer(t)
	c, _ := owner(t, h)
	list := decode[[]sources.Descriptor](t, c.mustDo(http.MethodGet, "/api/sources", nil, http.StatusOK))
	if len(list) != 3 {
		t.Fatalf("catalogue has %d sources", len(list))
	}

	anon := &client{t: t, h: h}
	if rec := anon.do(http.MethodGet, "/api/sources", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anon read the catalogue: %d", rec.Code)
	}
}

// The whole point of server-side ingest is that the token never comes back out.
func TestSecretsNeverComeBackToTheBrowser(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)

	c.mustDo(http.MethodPut, fmt.Sprintf("/api/sessions/%s/sources/discord", sp.ID),
		map[string]string{"bot_token": "super-secret-token", "guild_id": "42"}, http.StatusOK)

	rec := c.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/sources", sp.ID), nil, http.StatusOK)
	if body := rec.Body.String(); strings.Contains(body, "super-secret-token") {
		t.Fatalf("the bot token came back in the config listing: %s", body)
	}

	list := decode[[]struct {
		ID         string          `json:"id"`
		Configured bool            `json:"configured"`
		Values     map[string]any  `json:"values"`
		Secrets    map[string]bool `json:"secrets_set"`
	}](t, rec)
	for _, s := range list {
		if s.ID != "discord" {
			continue
		}
		if !s.Configured {
			t.Fatal("discord is not marked configured")
		}
		if s.Values["guild_id"] != "42" {
			t.Fatalf("the non-secret value did not survive: %v", s.Values)
		}
		if !s.Secrets["bot_token"] {
			t.Fatal("the UI cannot tell that a token is set")
		}
	}
}

// Editing the guild id must not silently wipe the token that is already there.
func TestEmptySecretKeepsTheStoredOne(t *testing.T) {
	h, st := newServerWithStore(t)
	c, sp := owner(t, h)
	path := fmt.Sprintf("/api/sessions/%s/sources/discord", sp.ID)

	c.mustDo(http.MethodPut, path, map[string]string{"bot_token": "t0ken", "guild_id": "42"}, http.StatusOK)
	c.mustDo(http.MethodPut, path, map[string]string{"bot_token": "", "guild_id": "99"}, http.StatusOK)

	raw, err := st.SourceConfig(sp.ID, "discord")
	if err != nil {
		t.Fatal(err)
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		t.Fatal(err)
	}
	if cfg["bot_token"] != "t0ken" {
		t.Fatalf("token was clobbered: %v", cfg)
	}
	if cfg["guild_id"] != "99" {
		t.Fatalf("guild id did not update: %v", cfg)
	}
}

func TestOnlyOwnerSetsCredentials(t *testing.T) {
	h := newServer(t)
	own, sp := owner(t, h)
	inv := decode[struct {
		Invite store.Invite `json:"invite"`
	}](t, own.mustDo(http.MethodPost, "/api/sessions/"+sp.ID+"/members",
		map[string]string{"email": "bob@novum.gg", "role": "editor"}, http.StatusCreated)).Invite
	bob := &client{t: t, h: h}
	bob.mustDo(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password2"}, http.StatusCreated)

	path := fmt.Sprintf("/api/sessions/%s/sources/discord", sp.ID)
	bob.mustDo(http.MethodPut, path, map[string]string{"bot_token": "x", "guild_id": "1"}, http.StatusForbidden)
	bob.mustDo(http.MethodDelete, path, nil, http.StatusForbidden)
	// An editor can still see which sources exist and run a pull.
	bob.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/sources", sp.ID), nil, http.StatusOK)
}

// A pull fills only what the source measured, and touches nothing else.
func TestPullReturnsAPartialPatchAndSavesNothing(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	metrics := metricsServer(t, `{"month":"2026-07","uptime_pct_month":99.4,"tps_pct_above_19":98.1}`)

	before := healthyMonth("2026-07")
	before.UptimePctMonth = 12
	saveMonth(c, sp.ID, "2026-07", before, 0)

	c.mustDo(http.MethodPut, fmt.Sprintf("/api/sessions/%s/sources/metrics", sp.ID),
		map[string]string{"url": metrics.URL}, http.StatusOK)

	res := decode[sources.Result](t, c.mustDo(http.MethodPost,
		fmt.Sprintf("/api/sessions/%s/months/2026-07/pull", sp.ID), nil, http.StatusOK))

	if len(res.Patch) != 2 {
		t.Fatalf("patch = %v, want only the two measured fields", res.Patch)
	}
	if res.Patch["uptime_pct_month"] != 99.4 {
		t.Fatalf("patch = %v", res.Patch)
	}
	if _, ok := res.Patch["cash_in_month"]; ok {
		t.Fatal("the pull filled a field no configured source knows")
	}
	if res.Origins["uptime_pct_month"].Source != "metrics" {
		t.Fatalf("origin = %v", res.Origins["uptime_pct_month"])
	}

	stored := decode[store.Month](t, c.mustDo(http.MethodGet,
		fmt.Sprintf("/api/sessions/%s/months/2026-07", sp.ID), nil, http.StatusOK))
	if stored.Inputs.UptimePctMonth != 12 {
		t.Fatal("the pull wrote to the month instead of handing back a patch")
	}
}

// A dead source is an error the person sees, never an invented number.
func TestPullFailureIsVisibleAndEmpty(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	dead := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(dead.Close)

	c.mustDo(http.MethodPut, fmt.Sprintf("/api/sessions/%s/sources/metrics", sp.ID),
		map[string]string{"url": dead.URL}, http.StatusOK)

	res := decode[sources.Result](t, c.mustDo(http.MethodPost,
		fmt.Sprintf("/api/sessions/%s/months/2026-08/pull", sp.ID), nil, http.StatusOK))
	if len(res.Patch) != 0 {
		t.Fatalf("a failing source still produced numbers: %v", res.Patch)
	}
	if len(res.Failures) != 1 {
		t.Fatalf("failures = %v", res.Failures)
	}
}

func TestPullWithNothingConfiguredSaysSo(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	res := decode[sources.Result](t, c.mustDo(http.MethodPost,
		fmt.Sprintf("/api/sessions/%s/months/2026-08/pull", sp.ID), nil, http.StatusOK))
	if len(res.Failures) != 1 || len(res.Patch) != 0 {
		t.Fatalf("res = %+v", res)
	}
}

// Origins are a claim about provenance, so the server only stores the ones it
// can verify against the registry.
func TestForgedOriginsAreDropped(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	saveMonth(c, sp.ID, "2026-09", healthyMonth("2026-09"), 0)
	m := decode[store.Month](t, c.mustDo(http.MethodGet,
		fmt.Sprintf("/api/sessions/%s/months/2026-09", sp.ID), nil, http.StatusOK))

	rec := c.mustDo(http.MethodPut, fmt.Sprintf("/api/sessions/%s/months/2026-09", sp.ID),
		map[string]any{
			"inputs":   healthyMonth("2026-09"),
			"revision": m.Revision,
			"sources": map[string]sources.Origin{
				// tebex really does fill this one
				"cash_in_month": {Source: "tebex", Value: 1180},
				// tebex has no idea what the uptime was
				"uptime_pct_month": {Source: "tebex", Value: 100},
				// and this source does not exist at all
				"concurrent_avg": {Source: "made-up", Value: 5},
			},
		}, http.StatusOK)
	saved := decode[store.Month](t, rec)

	if _, ok := saved.Sources["cash_in_month"]; !ok {
		t.Fatal("a real origin was dropped")
	}
	if _, ok := saved.Sources["uptime_pct_month"]; ok {
		t.Fatal("tebex was allowed to claim a field it does not declare")
	}
	if _, ok := saved.Sources["concurrent_avg"]; ok {
		t.Fatal("an unknown source was allowed to claim a field")
	}
}
