package engine

import (
	"fmt"
	"strings"
)

func pct(n float64, digits int) string {
	return fmt.Sprintf("%.*f%%", digits, n)
}

func ratio(n *float64) string {
	if n == nil {
		return "n/d"
	}
	return fmt.Sprintf("%.1f", *n)
}

func monthsLabel(n *float64) string {
	if n == nil {
		return "n/d"
	}
	return fmt.Sprintf("%.1f meses", *n)
}

func shareOf(part, total float64) string {
	if total <= 0 {
		return "0.0%"
	}
	return pct((part/total)*100, 1)
}

func mdRow(label string, amount, total float64) string {
	return fmt.Sprintf("| %s | %s | %s |", label, FormatUSD(amount), shareOf(amount, total))
}

func ToMarkdown(r Result, spaceName string) string {
	if spaceName == "" {
		spaceName = r.Policy.Name
	}
	i := r.Inputs
	a := r.Allocation
	total := r.TotalAllocated
	band := "sin banda, no se cubrió infra"
	if r.Band != nil {
		band = r.Band.Label
	}
	var b strings.Builder
	fmt.Fprintf(&b, "# %s %s (%s)\n\n", spaceName, i.Month, i.Stage)
	fmt.Fprintf(&b, "- Banda: %s\n", band)
	fmt.Fprintf(&b, "- Cash in: %s | Infra: %s | Sobrante: %s\n", FormatUSD(i.CashInMonth), FormatUSD(i.InfraCostMonth), FormatUSD(r.Remaining))
	fmt.Fprintf(&b, "- Cash on hand al inicio: %s\n", FormatUSD(i.CashOnHandStart))
	fmt.Fprintf(&b, "- Runway: %s\n", monthsLabel(r.RunwayMonths))
	fmt.Fprintf(&b, "- EF: %s de %s (%s)\n", FormatUSD(r.EFAfter), FormatUSD(r.EFCap), pct(r.EFProgressPct, 1))
	fmt.Fprintf(&b, "- TPS arriba de 19: %s | Uptime: %s\n", pct(i.TPSPctAbove19, 1), pct(i.UptimePctMonth, 2))
	fmt.Fprintf(&b, "- Discord: %v (%v neto) | Jugadores únicos semana: %v | Concurrentes promedio: %v\n", i.DiscordMembers, i.DiscordNetGrowthMonth, i.UniquePlayersWeek, i.ConcurrentAvg)
	fmt.Fprintf(&b, "- Discord por jugador: %s\n\n", ratio(r.Health.DiscordRatio))
	b.WriteString("| Rubro | USD | % del cash in |\n| --- | ---: | ---: |\n")
	b.WriteString(mdRow("Infra", a.Infra, total) + "\n")
	b.WriteString(mdRow("EF fill", a.EFFill, total) + "\n")
	b.WriteString(mdRow("Product", a.Product, total) + "\n")
	b.WriteString(mdRow("Growth", a.Growth, total) + "\n")
	b.WriteString(mdRow("People", a.People, total) + "\n")
	b.WriteString(mdRow("Reserva de infra", a.InfraBuffer, total) + "\n")
	b.WriteString(mdRow("Sin asignar", a.Unallocated, total) + "\n\n")
	b.WriteString("## Reglas que aplicaron\n")
	if len(r.Alerts) == 0 {
		b.WriteString("- Ninguna regla especial.\n")
	} else {
		for _, al := range r.Alerts {
			fmt.Fprintf(&b, "- [%s] %s\n", al.Rule, al.Message)
		}
	}
	if notes := strings.TrimSpace(i.Notes); notes != "" {
		b.WriteString("\n## Notas\n")
		b.WriteString(notes)
		b.WriteByte('\n')
	}
	b.WriteByte('\n')
	return b.String()
}
