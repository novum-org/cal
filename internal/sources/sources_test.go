package sources

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func ctx() context.Context { return context.Background() }

func cfg(t *testing.T, v any) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func serve(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv
}

const tebexPayments = `[
  {"amount":"10.00","date":"2026-08-31 23:59:59","status":"Complete","currency":"USD"},
  {"amount":"25.50","date":"2026-09-02 10:00:00","status":"Complete","currency":"USD"},
  {"amount":"14.50","date":"2026-09-20 10:00:00","status":"Complete","currency":"USD"},
  {"amount":"99.00","date":"2026-09-21 10:00:00","status":"Refund","currency":"USD"},
  {"amount":"77.00","date":"2026-10-01 00:00:00","status":"Complete","currency":"USD"}
]`

// Only completed payments dated inside the month count, and the month boundary
// is half-open on both ends.
func TestTebexSumsOnlyTheMonth(t *testing.T) {
	srv := serve(t, http.StatusOK, tebexPayments)
	tb := NewTebex(srv.Client())
	tb.base = srv.URL

	got, err := tb.Fetch(ctx(), cfg(t, tebexConfig{Secret: "s"}), "2026-09", nil)
	if err != nil {
		t.Fatal(err)
	}
	if got["cash_in_month"] != 40 {
		t.Fatalf("cash_in_month = %v, want 40", got["cash_in_month"])
	}
	if len(got) != 1 {
		t.Fatalf("Tebex filled fields it does not know: %v", got)
	}
}

func TestTebexAppliesDeclaredFee(t *testing.T) {
	srv := serve(t, http.StatusOK, tebexPayments)
	tb := NewTebex(srv.Client())
	tb.base = srv.URL

	got, err := tb.Fetch(ctx(), cfg(t, tebexConfig{Secret: "s", FeePct: 10}), "2026-09", nil)
	if err != nil {
		t.Fatal(err)
	}
	if got["cash_in_month"] != 36 {
		t.Fatalf("cash_in_month = %v, want 36", got["cash_in_month"])
	}
}

// A rejected secret must not become "the store made zero this month".
func TestTebexRejectedSecretIsAnErrorNotZero(t *testing.T) {
	srv := serve(t, http.StatusUnauthorized, `{"error":"nope"}`)
	tb := NewTebex(srv.Client())
	tb.base = srv.URL

	got, err := tb.Fetch(ctx(), cfg(t, tebexConfig{Secret: "wrong"}), "2026-09", nil)
	if err == nil {
		t.Fatal("want an error")
	}
	if got != nil {
		t.Fatalf("want an empty patch, got %v", got)
	}
}

func TestDiscordMembersAndGrowth(t *testing.T) {
	srv := serve(t, http.StatusOK, `{"id":"1","approximate_member_count":150}`)
	d := NewDiscord(srv.Client())
	d.base = srv.URL

	first, err := d.Fetch(ctx(), cfg(t, discordConfig{BotToken: "t", GuildID: "1"}), "2026-09", nil)
	if err != nil {
		t.Fatal(err)
	}
	if first["discord_members"] != 150 {
		t.Fatalf("members = %v", first["discord_members"])
	}
	if _, ok := first["discord_net_growth_month"]; ok {
		t.Fatal("growth reported with no previous month to compare against")
	}

	second, err := d.Fetch(ctx(), cfg(t, discordConfig{BotToken: "t", GuildID: "1"}), "2026-10",
		Patch{"discord_members": 120})
	if err != nil {
		t.Fatal(err)
	}
	if second["discord_net_growth_month"] != 30 {
		t.Fatalf("growth = %v, want 30", second["discord_net_growth_month"])
	}
}

// without with_counts the field is absent, and absent is not zero members.
func TestDiscordMissingCountIsAnError(t *testing.T) {
	srv := serve(t, http.StatusOK, `{"id":"1","name":"Novum"}`)
	d := NewDiscord(srv.Client())
	d.base = srv.URL

	if _, err := d.Fetch(ctx(), cfg(t, discordConfig{BotToken: "t", GuildID: "1"}), "2026-09", nil); err == nil {
		t.Fatal("want an error")
	}
}

func TestMetricsFillsOnlyWhatItMeasured(t *testing.T) {
	srv := serve(t, http.StatusOK, `{"month":"2026-09","uptime_pct_month":99.7,"concurrent_avg":8.5}`)
	m := NewMetrics(srv.Client())

	got, err := m.Fetch(ctx(), cfg(t, metricsConfig{URL: srv.URL}), "2026-09", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("patch = %v, want only the two measured fields", got)
	}
	if got["uptime_pct_month"] != 99.7 || got["concurrent_avg"] != 8.5 {
		t.Fatalf("patch = %v", got)
	}
	if _, ok := got["tps_pct_above_19"]; ok {
		t.Fatal("filled a field the document did not carry")
	}
}

// A document from another month is refused rather than quietly reused.
func TestMetricsRefusesTheWrongMonth(t *testing.T) {
	srv := serve(t, http.StatusOK, `{"month":"2026-08","uptime_pct_month":100}`)
	m := NewMetrics(srv.Client())

	if _, err := m.Fetch(ctx(), cfg(t, metricsConfig{URL: srv.URL}), "2026-09", nil); err == nil {
		t.Fatal("want an error")
	}
}

func TestMetricsDownIsNotFullUptime(t *testing.T) {
	srv := serve(t, http.StatusInternalServerError, `boom`)
	m := NewMetrics(srv.Client())

	got, err := m.Fetch(ctx(), cfg(t, metricsConfig{URL: srv.URL}), "2026-09", nil)
	if err == nil {
		t.Fatal("want an error")
	}
	if got != nil {
		t.Fatalf("want an empty patch, got %v", got)
	}
}

// One dead source must not hide the live one, and neither may write a field it
// never declared.
func TestPullMergesAndReportsFailuresSeparately(t *testing.T) {
	up := serve(t, http.StatusOK, `{"month":"2026-09","tps_pct_above_19":98.5}`)
	down := serve(t, http.StatusInternalServerError, `nope`)

	tb := NewTebex(down.Client())
	tb.base = down.URL
	reg := NewRegistry(NewMetrics(up.Client()), tb)

	res := reg.Pull(ctx(), "2026-09", nil, []Config{
		{SourceID: "metrics", Raw: cfg(t, metricsConfig{URL: up.URL})},
		{SourceID: "tebex", Raw: cfg(t, tebexConfig{Secret: "s"})},
		{SourceID: "ghost", Raw: json.RawMessage(`{}`)},
	})

	if res.Patch["tps_pct_above_19"] != 98.5 {
		t.Fatalf("live source lost: %v", res.Patch)
	}
	if _, ok := res.Patch["cash_in_month"]; ok {
		t.Fatal("dead source still wrote a number")
	}
	if len(res.Failures) != 2 {
		t.Fatalf("failures = %v, want tebex and ghost", res.Failures)
	}
	if res.Origins["tps_pct_above_19"].Source != "metrics" {
		t.Fatalf("origin = %v", res.Origins["tps_pct_above_19"])
	}
}

// The registry is what the frontend renders a config form from, so it must
// describe every source without leaking a secret value.
func TestDescribeListsFieldsAndMarksSecrets(t *testing.T) {
	list := Default(nil).Describe()
	if len(list) != 3 {
		t.Fatalf("got %d sources", len(list))
	}
	for _, d := range list {
		if len(d.Fields) == 0 {
			t.Fatalf("%s declares no fields", d.ID)
		}
	}
	secrets := map[string]bool{}
	for _, d := range list {
		for _, c := range d.Config {
			secrets[d.ID+"."+c.Key] = c.Secret
		}
	}
	for _, key := range []string{"tebex.secret", "discord.bot_token", "metrics.token"} {
		if !secrets[key] {
			t.Fatalf("%s is not marked secret", key)
		}
	}
}
