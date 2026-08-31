package engine

import "time"

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

func GenericPreset() Policy {
	p := NovumPreset()
	p.Name = "Generic"
	return p
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
