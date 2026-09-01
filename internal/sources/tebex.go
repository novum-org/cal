package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const tebexAPI = "https://plugin.tebex.io"

// Tebex reads completed payments from the store and sums the ones that landed
// in the month.
//
// The plugin API does not report Tebex's cut on a payment, so summing amounts
// gives gross, not net. Rather than call gross "net" and be quietly wrong, the
// operator states their fee percentage from their own agreement and it is
// applied here, visibly, with the gross still in the log.
type Tebex struct {
	client *http.Client
	base   string
}

func NewTebex(client *http.Client) *Tebex { return &Tebex{client: client, base: tebexAPI} }

func (t *Tebex) ID() string   { return "tebex" }
func (t *Tebex) Name() string { return "Tebex" }
func (t *Tebex) Description() string {
	return "Ventas de la tienda, netas de la comisión que declares."
}
func (t *Tebex) Fields() []string { return []string{"cash_in_month"} }

func (t *Tebex) ConfigFields() []ConfigField {
	return []ConfigField{
		{Key: "secret", Label: "Secret de la tienda", Hint: "Tebex > Game Servers > Secret Key", Secret: true},
		{
			Key:   "fee_pct",
			Label: "Comisión de Tebex (%)",
			Hint:  "La API no informa la comisión. Poné la de tu acuerdo o dejá 0 para cargar el bruto.",
		},
	}
}

type tebexConfig struct {
	Secret string  `json:"secret"`
	FeePct float64 `json:"fee_pct"`
}

type tebexPayment struct {
	Amount   json.Number `json:"amount"`
	Date     string      `json:"date"`
	Status   string      `json:"status"`
	Currency string      `json:"currency"`
}

func (t *Tebex) Fetch(ctx context.Context, raw json.RawMessage, month string, _ Patch) (Patch, error) {
	var cfg tebexConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("config de Tebex ilegible")
	}
	if strings.TrimSpace(cfg.Secret) == "" {
		return nil, fmt.Errorf("falta el secret de Tebex")
	}
	if cfg.FeePct < 0 || cfg.FeePct >= 100 {
		return nil, fmt.Errorf("la comisión tiene que estar entre 0 y 100")
	}
	start, end, err := monthRange(month)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.base+"/payments?limit=100", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Tebex-Secret", cfg.Secret)
	res, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("no se pudo hablar con Tebex: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("Tebex rechazó el secret")
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Tebex respondió %d", res.StatusCode)
	}
	var payments []tebexPayment
	if err := json.NewDecoder(res.Body).Decode(&payments); err != nil {
		return nil, fmt.Errorf("Tebex devolvió algo que no se entiende")
	}

	gross := 0.0
	for _, p := range payments {
		if !strings.EqualFold(p.Status, "Complete") {
			continue
		}
		at, err := tebexDate(p.Date)
		if err != nil {
			continue
		}
		if at.Before(start) || !at.Before(end) {
			continue
		}
		amount, err := strconv.ParseFloat(p.Amount.String(), 64)
		if err != nil {
			continue
		}
		gross += amount
	}
	return Patch{"cash_in_month": round2(gross * (1 - cfg.FeePct/100))}, nil
}

// Tebex has shipped both of these shapes for payment dates.
func tebexDate(s string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02 15:04:05", time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("fecha ilegible: %s", s)
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }
