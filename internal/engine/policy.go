package engine

import (
	"strings"
	"time"
)

func ptr(n float64) *float64 { return &n }

func maxF(n float64) *float64 { return &n }

func currentMonthUTC() string {
	return time.Now().UTC().Format("2006-01")
}

// NovumPreset is today's bands, buckets, stages, and knobs as data.
func NovumPreset() Policy {
	return Policy{
		Name: "Novum",
		Buckets: []Bucket{
			{ID: "infra", Label: "Infra", Note: "Se paga antes que nada"},
			{ID: "ef", Label: "EF fill", Note: "Aporte al fondo de emergencia"},
			{ID: "product", Label: "Product", Note: "Server, mundo, herramientas"},
			{ID: "growth", Label: "Growth", Note: "Difusión, solo con la casa en orden"},
			{ID: "people", Label: "People", Note: "Bonos y reparto, solo con ganancia"},
			{ID: "infra_buffer", Label: "Reserva de infra", Note: "Growth frenado por salud del server"},
			{ID: "unallocated", Label: "Sin asignar", Note: "Queda en la caja, lo decidís vos"},
		},
		Bands: []Band{
			{ID: "micro", Label: "$0 a $99", Min: 0, Max: maxF(99.99), Shares: map[string]float64{"ef": 1, "product": 0, "growth": 0, "people": 0}},
			{ID: "mid", Label: "$100 a $499", Min: 100, Max: maxF(499.99), Shares: map[string]float64{"ef": 0.2, "product": 0.5, "growth": 0.3, "people": 0}},
			{ID: "large", Label: "$500 a $1999", Min: 500, Max: maxF(1999.99), Shares: map[string]float64{"ef": 0.2, "product": 0.4, "growth": 0.25, "people": 0.15}},
			{ID: "mega", Label: "$2000 o más", Min: 2000, Max: nil, Shares: map[string]float64{"ef": 0.2, "product": 0.35, "growth": 0.25, "people": 0.2}},
		},
		Stages: map[string]StageRule{
			"alpha": {TPSMin: 95, UptimeMin: nil},
			"beta":  {TPSMin: 97, UptimeMin: ptr(99.0)},
			"v1":    {TPSMin: 98, UptimeMin: ptr(99.5)},
		},
		InfraID:                "infra",
		EFID:                   "ef",
		ProductID:              "product",
		GrowthID:               "growth",
		PeopleID:               "people",
		InfraBufferID:          "infra_buffer",
		UnallocatedID:          "unallocated",
		DiscordPerPlayerMax:    8,
		ConcurrentHigh:         20,
		InfraHealthUptimeFloor: 99.0,
		MinRunwayMonths:        2,
		CharterEFShare:         0.20,
		StageGates:             true,
		CommunityRatio:         true,
		LoadPressure:           true,
		PeopleFromProfit:       true,
		EFCap:                  true,
	}
}

// GenericPreset is the starting point for a server that is not Novum: the same
// infra-first shape, but none of Novum's numbers. One band instead of four, no
// stage gates, no community or load rules, and every threshold at zero so it
// alerts on nothing until the operator sets their own floors.
func GenericPreset() Policy {
	return Policy{
		Name: "Generic",
		Buckets: []Bucket{
			{ID: "infra", Label: "Infra", Note: "Se paga antes que nada"},
			{ID: "ef", Label: "Fondo de emergencia", Note: "Colchón para meses malos"},
			{ID: "product", Label: "Producto", Note: "El juego y sus herramientas"},
			{ID: "growth", Label: "Crecimiento", Note: "Traer gente nueva"},
			{ID: "people", Label: "Equipo", Note: "Bonos y reparto"},
			{ID: "infra_buffer", Label: "Reserva de infra", Note: "Crecimiento frenado por el server"},
			{ID: "unallocated", Label: "Sin asignar", Note: "Queda en la caja"},
		},
		Bands: []Band{
			{
				ID: "todo", Label: "Todo el sobrante", Min: 0, Max: nil,
				Shares: map[string]float64{"ef": 0.2, "product": 0.4, "growth": 0.2, "people": 0.2},
			},
		},
		Stages: map[string]StageRule{
			"alpha": {TPSMin: 0, UptimeMin: nil},
			"beta":  {TPSMin: 0, UptimeMin: nil},
			"v1":    {TPSMin: 0, UptimeMin: nil},
		},
		InfraID:                "infra",
		EFID:                   "ef",
		ProductID:              "product",
		GrowthID:               "growth",
		PeopleID:               "people",
		InfraBufferID:          "infra_buffer",
		UnallocatedID:          "unallocated",
		DiscordPerPlayerMax:    0,
		ConcurrentHigh:         0,
		InfraHealthUptimeFloor: 0,
		MinRunwayMonths:        0,
		CharterEFShare:         0.20,
		StageGates:             false,
		CommunityRatio:         false,
		LoadPressure:           false,
		PeopleFromProfit:       true,
		EFCap:                  true,
	}
}

// Preset describes a policy a session can start from or reset to.
type Preset struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

var Presets = []Preset{
	{
		ID:          "novum",
		Name:        "Novum",
		Description: "Bandas por tramo, gates por etapa y reglas de comunidad y carga.",
	},
	{
		ID:          "generic",
		Name:        "Genérico",
		Description: "Una banda, sin gates ni umbrales. Para llenar con los números propios.",
	},
}

// PresetByID falls back to Novum, which is what CreateSpace has always done for
// an unknown preset name.
func PresetByID(id string) Policy {
	if strings.EqualFold(id, "generic") {
		return GenericPreset()
	}
	return NovumPreset()
}

func PickBand(policy Policy, remainingUSD float64) Band {
	if len(policy.Bands) == 0 {
		return Band{ID: "none", Label: "none", Shares: map[string]float64{}}
	}
	for i := len(policy.Bands) - 1; i >= 0; i-- {
		band := policy.Bands[i]
		if remainingUSD >= band.Min {
			return band
		}
	}
	return policy.Bands[0]
}

func DefaultInputs() Inputs {
	return Inputs{
		Month:          currentMonthUTC(),
		InfraCostMonth: 35,
		EFTargetMonths: 6,
		TPSPctAbove19:  100,
		UptimePctMonth: 100,
		Stage:          "alpha",
	}
}
