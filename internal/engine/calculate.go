package engine

import (
	"fmt"
	"math"
)

func share(band Band, id string) float64 {
	if band.Shares == nil {
		return 0
	}
	return band.Shares[id]
}

func RunwayMonths(in Inputs) *float64 {
	if in.InfraCostMonth <= 0 {
		return nil
	}
	left := in.CashOnHandStart + in.CashInMonth - in.InfraCostMonth
	v := left / in.InfraCostMonth
	return &v
}

func EvaluateHealth(in Inputs, policy Policy, runway *float64) Health {
	rule, ok := policy.Stages[in.Stage]
	if !ok {
		rule = StageRule{TPSMin: 0, UptimeMin: nil}
	}
	tpsOk := in.TPSPctAbove19 >= rule.TPSMin
	uptimeOk := true
	if rule.UptimeMin != nil {
		uptimeOk = in.UptimePctMonth >= *rule.UptimeMin
	}
	var discordRatio *float64
	if in.UniquePlayersWeek > 0 {
		r := in.DiscordMembers / in.UniquePlayersWeek
		discordRatio = &r
	}
	loadPressure := policy.LoadPressure && !tpsOk && in.ConcurrentAvg >= policy.ConcurrentHigh
	infraHealthy := !loadPressure &&
		in.UptimePctMonth >= policy.InfraHealthUptimeFloor &&
		(runway == nil || *runway >= policy.MinRunwayMonths)
	ratioBad := policy.CommunityRatio && discordRatio != nil && *discordRatio > policy.DiscordPerPlayerMax
	stageFail := policy.StageGates && (!tpsOk || !uptimeOk)
	return Health{
		TPSOk:         tpsOk,
		UptimeOk:      uptimeOk,
		LoadPressure:  loadPressure,
		InfraHealthy:  infraHealthy,
		GrowthBlocked: stageFail || ratioBad,
		DiscordRatio:  discordRatio,
	}
}

func progress(value, cap int64) float64 {
	if cap <= 0 {
		return 100
	}
	p := float64(value) / float64(cap) * 100
	if p > 100 {
		return 100
	}
	if p < 0 {
		return 0
	}
	return p
}

func charterTarget(in Inputs, efCapCents int64, share float64) float64 {
	accumulated := ToCents(in.CashOnHandStart + in.CashInMonth)
	capped := int64(math.Round(float64(accumulated) * share))
	if capped > efCapCents {
		capped = efCapCents
	}
	return ToUSD(capped)
}

func emptyAllocation(infra float64) Allocation {
	return Allocation{Infra: infra}
}

func namedAllocation(by map[string]float64, policy Policy, infraUSD float64) Allocation {
	return Allocation{
		Infra:       infraUSD,
		EFFill:      by[policy.EFID],
		Product:     by[policy.ProductID],
		Growth:      by[policy.GrowthID],
		People:      by[policy.PeopleID],
		InfraBuffer: by[policy.InfraBufferID],
		Unallocated: by[policy.UnallocatedID],
	}
}

func Calculate(in Inputs, policy Policy) Result {
	alerts := make([]Alert, 0, 8)
	cashIn := ToCents(in.CashInMonth)
	infraCost := ToCents(in.InfraCostMonth)
	efCurrent := ToCents(in.EFCurrent)
	efCap := int64(0)
	if infraCost > 0 {
		efCap = int64(math.Round(float64(infraCost) * in.EFTargetMonths))
		if efCap < 0 {
			efCap = 0
		}
	}
	runway := RunwayMonths(in)
	health := EvaluateHealth(in, policy, runway)
	shortfall := infraCost - cashIn
	if shortfall < 0 {
		shortfall = 0
	}

	resultBase := func(band *Band, remaining, shortUSD float64, alloc Allocation, efAfter int64, by map[string]float64) Result {
		return Result{
			Inputs:          in,
			Policy:          policy,
			Band:            band,
			Remaining:       remaining,
			InfraShortfall:  shortUSD,
			Allocation:      alloc,
			ByID:            by,
			EFCap:           ToUSD(efCap),
			EFAfter:         ToUSD(efAfter),
			EFProgressPct:   progress(efAfter, efCap),
			EFCharterTarget: charterTarget(in, efCap, policy.CharterEFShare),
			RunwayMonths:    runway,
			Health:          health,
			Alerts:          alerts,
			TotalAllocated:  ToUSD(cashIn),
		}
	}

	if shortfall > 0 {
		alerts = append(alerts, Alert{
			Rule:  "R1",
			Level: AlertRed,
			Message: fmt.Sprintf(
				"No alcanza para infra: faltan %s. Todo lo que entró va a infra y no queda nada para repartir, así que Product, Growth y People quedan en 0.",
				FormatUSD(ToUSD(shortfall)),
			),
		})
		pushContextAlerts(&alerts, in, policy, health, runway)
		by := map[string]float64{policy.InfraID: ToUSD(cashIn)}
		return resultBase(nil, 0, ToUSD(shortfall), emptyAllocation(ToUSD(cashIn)), efCurrent, by)
	}

	remaining := cashIn - infraCost
	band := PickBand(policy, ToUSD(remaining))
	bandCopy := band
	alerts = append(alerts, Alert{
		Rule:  "B0",
		Level: AlertInfo,
		Message: fmt.Sprintf(
			"Banda %s: después de pagar infra quedan %s para repartir.",
			band.Label,
			FormatUSD(ToUSD(remaining)),
		),
	})

	efRoom := efCap - efCurrent
	if efRoom < 0 {
		efRoom = 0
	}
	efShare := int64(math.Floor(float64(remaining) * share(band, policy.EFID)))
	if !policy.EFCap {
		efShare = 0
	}
	efFill := efShare
	if efFill > efRoom {
		efFill = efRoom
	}
	efOverflow := efShare - efFill
	if policy.EFCap && efShare > 0 && efRoom == 0 {
		alerts = append(alerts, Alert{
			Rule:  "R2",
			Level: AlertInfo,
			Message: fmt.Sprintf(
				"El EF ya está en el tope de %s (%.0f meses de infra). No se llena más y esa parte queda sin asignar.",
				FormatUSD(ToUSD(efCap)),
				in.EFTargetMonths,
			),
		})
	} else if policy.EFCap && efOverflow > 0 {
		alerts = append(alerts, Alert{
			Rule:  "R2",
			Level: AlertInfo,
			Message: fmt.Sprintf(
				"El EF se llena hasta el tope de %s y sobran %s de esa parte, que quedan sin asignar.",
				FormatUSD(ToUSD(efCap)),
				FormatUSD(ToUSD(efOverflow)),
			),
		})
	}

	product := int64(math.Floor(float64(remaining) * share(band, policy.ProductID)))
	growth := int64(math.Floor(float64(remaining) * share(band, policy.GrowthID)))
	people := int64(math.Floor(float64(remaining) * share(band, policy.PeopleID)))
	infraBuffer := int64(0)

	if growth > 0 && health.GrowthBlocked {
		target := "Product"
		if !health.InfraHealthy {
			target = "reserva de infra"
		}
		if health.InfraHealthy {
			product += growth
		} else {
			infraBuffer += growth
		}
		pushGrowthAlerts(&alerts, in, policy, health, FormatUSD(ToUSD(growth)), target)
		growth = 0
	}

	if policy.PeopleFromProfit {
		profitAfterEf := remaining - efFill
		if profitAfterEf < 0 {
			profitAfterEf = 0
		}
		if people > profitAfterEf {
			people = profitAfterEf
		}
		if share(band, policy.PeopleID) > 0 && people == 0 {
			alerts = append(alerts, Alert{
				Rule:    "R6",
				Level:   AlertWarn,
				Message: "People queda en 0: después de infra y del aporte al EF no sobra ganancia para bonos ni reparto.",
			})
		}
	}

	unallocated := remaining - efFill - product - growth - people - infraBuffer
	efAfter := efCurrent + efFill
	pushContextAlerts(&alerts, in, policy, health, runway)
	charter := charterTarget(in, efCap, policy.CharterEFShare)
	if efFill > 0 && ToUSD(efAfter) > charter {
		alerts = append(alerts, Alert{
			Rule:  "I4",
			Level: AlertInfo,
			Message: fmt.Sprintf(
				"Con este aporte el EF queda en %s, arriba del objetivo de la carta (%s, 20%% del cash acumulado). No rompe ninguna regla, pero conviene tenerlo presente.",
				FormatUSD(ToUSD(efAfter)),
				FormatUSD(charter),
			),
		})
	}

	by := map[string]float64{
		policy.InfraID:       ToUSD(infraCost),
		policy.EFID:          ToUSD(efFill),
		policy.ProductID:     ToUSD(product),
		policy.GrowthID:      ToUSD(growth),
		policy.PeopleID:      ToUSD(people),
		policy.InfraBufferID: ToUSD(infraBuffer),
		policy.UnallocatedID: ToUSD(unallocated),
	}
	alloc := namedAllocation(by, policy, ToUSD(infraCost))
	return resultBase(&bandCopy, ToUSD(remaining), 0, alloc, efAfter, by)
}

func pushGrowthAlerts(alerts *[]Alert, in Inputs, policy Policy, health Health, moved, target string) {
	rule := policy.Stages[in.Stage]
	if !health.TPSOk {
		*alerts = append(*alerts, Alert{
			Rule:  "R3",
			Level: AlertWarn,
			Message: fmt.Sprintf(
				"Growth queda en 0: el TPS estuvo arriba de 19 solo el %v%% del tiempo y %s pide %v%%. Esos %s van a %s.",
				in.TPSPctAbove19, in.Stage, rule.TPSMin, moved, target,
			),
		})
	}
	if !health.UptimeOk && rule.UptimeMin != nil {
		*alerts = append(*alerts, Alert{
			Rule:  "R3",
			Level: AlertWarn,
			Message: fmt.Sprintf(
				"Growth queda en 0: el uptime del mes fue %v%% y %s pide %v%%. Esos %s van a %s.",
				in.UptimePctMonth, in.Stage, *rule.UptimeMin, moved, target,
			),
		})
	}
	if health.DiscordRatio != nil && *health.DiscordRatio > policy.DiscordPerPlayerMax {
		*alerts = append(*alerts, Alert{
			Rule:  "R4",
			Level: AlertWarn,
			Message: fmt.Sprintf(
				"Growth queda en 0: hay %.1f miembros de Discord por cada jugador único de la semana y el máximo es %v. El problema es de conversión y retención, no de publicidad. Esos %s van a %s.",
				*health.DiscordRatio, policy.DiscordPerPlayerMax, moved, target,
			),
		})
	}
	if health.LoadPressure {
		*alerts = append(*alerts, Alert{
			Rule:  "R5",
			Level: AlertWarn,
			Message: fmt.Sprintf(
				"Promedio de %v concurrentes con el TPS por debajo del mínimo. No se gasta en Growth para meterle más carga a un server que ya no da: esa plata queda como reserva de infra.",
				in.ConcurrentAvg,
			),
		})
	}
}

func pushContextAlerts(alerts *[]Alert, in Inputs, policy Policy, health Health, runway *float64) {
	if runway != nil && *runway < policy.MinRunwayMonths {
		*alerts = append(*alerts, Alert{
			Rule:  "I1",
			Level: AlertRed,
			Message: fmt.Sprintf(
				"Runway de %.1f meses, por debajo del piso de %v. La infra se considera en riesgo hasta que eso mejore.",
				*runway, policy.MinRunwayMonths,
			),
		})
	}
	if in.UptimePctMonth < policy.InfraHealthUptimeFloor {
		*alerts = append(*alerts, Alert{
			Rule:  "I2",
			Level: AlertWarn,
			Message: fmt.Sprintf(
				"Uptime de %v%%, abajo del piso de salud de infra (%v%%). Primero se arregla el server.",
				in.UptimePctMonth, policy.InfraHealthUptimeFloor,
			),
		})
	}
	if health.DiscordRatio == nil && in.DiscordMembers > 0 {
		*alerts = append(*alerts, Alert{
			Rule:    "I3",
			Level:   AlertInfo,
			Message: "No hay jugadores únicos cargados en la semana, así que la relación Discord por jugador no se puede medir.",
		})
	}
}
