package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// Metrics reads a JSON document the box publishes. There is no agreed exporter
// for Minecraft server health, so instead of guessing somebody else's payload
// this defines the smallest one that answers the engine's questions and lets
// the operator produce it however they like: a cron job writing a file behind
// nginx, a Spark exporter, a plugin endpoint.
//
// Every field is optional. A document that only knows uptime fills only uptime.
// The one thing it may not do is fill a field it did not measure, which is why
// the payload uses pointers and a missing key stays missing.
type Metrics struct {
	client *http.Client
}

func NewMetrics(client *http.Client) *Metrics { return &Metrics{client: client} }

func (m *Metrics) ID() string   { return "metrics" }
func (m *Metrics) Name() string { return "Métricas del server" }
func (m *Metrics) Description() string {
	return "Un JSON que publica tu VPS con TPS, uptime y jugadores. Todos los campos son opcionales."
}
func (m *Metrics) Fields() []string {
	return []string{"tps_pct_above_19", "uptime_pct_month", "unique_players_week", "concurrent_avg"}
}

func (m *Metrics) ConfigFields() []ConfigField {
	return []ConfigField{
		{Key: "url", Label: "URL del JSON", Hint: "https://tu-vps/metrics/2026-09.json o un endpoint que reciba ?month="},
		{Key: "token", Label: "Token (opcional)", Hint: "Se manda como Authorization: Bearer", Secret: true},
	}
}

type metricsConfig struct {
	URL   string `json:"url"`
	Token string `json:"token"`
}

// metricsDoc is the contract. Pointers on purpose: nil means not measured.
type metricsDoc struct {
	Month             string   `json:"month"`
	TPSPctAbove19     *float64 `json:"tps_pct_above_19"`
	UptimePctMonth    *float64 `json:"uptime_pct_month"`
	UniquePlayersWeek *float64 `json:"unique_players_week"`
	ConcurrentAvg     *float64 `json:"concurrent_avg"`
}

func (m *Metrics) Fetch(ctx context.Context, raw json.RawMessage, month string, _ Patch) (Patch, error) {
	var cfg metricsConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("config de métricas ilegible")
	}
	target := strings.TrimSpace(cfg.URL)
	if target == "" {
		return nil, fmt.Errorf("falta la URL del JSON de métricas")
	}
	target = strings.ReplaceAll(target, "{month}", month)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, fmt.Errorf("URL inválida")
	}
	if cfg.Token != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}
	res, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer las métricas: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("las métricas respondieron %d", res.StatusCode)
	}

	var doc metricsDoc
	if err := json.NewDecoder(res.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("el JSON de métricas no tiene el formato esperado")
	}
	// Stale data is worse than no data: a document that says it is about
	// another month is refused rather than quietly used for this one.
	if doc.Month != "" && doc.Month != month {
		return nil, fmt.Errorf("el JSON es de %s, no de %s", doc.Month, month)
	}

	patch := Patch{}
	for field, value := range map[string]*float64{
		"tps_pct_above_19":    doc.TPSPctAbove19,
		"uptime_pct_month":    doc.UptimePctMonth,
		"unique_players_week": doc.UniquePlayersWeek,
		"concurrent_avg":      doc.ConcurrentAvg,
	} {
		if value != nil {
			patch[field] = *value
		}
	}
	if len(patch) == 0 {
		return nil, fmt.Errorf("el JSON no traía ninguna métrica conocida")
	}
	return patch, nil
}
