package engine

import (
	"math"
	"testing"
)

func healthy(over Inputs) Inputs {
	base := DefaultInputs()
	base.TPSPctAbove19 = 100
	base.UptimePctMonth = 100
	base.ConcurrentAvg = 5
	base.UniquePlayersWeek = 50
	base.DiscordMembers = 100
	return merge(base, over)
}

func merge(base, over Inputs) Inputs {
	if over.Month != "" {
		base.Month = over.Month
	}
	if over.CashInMonth != 0 {
		base.CashInMonth = over.CashInMonth
	}
	if over.CashOnHandStart != 0 {
		base.CashOnHandStart = over.CashOnHandStart
	}
	if over.InfraCostMonth != 0 {
		base.InfraCostMonth = over.InfraCostMonth
	}
	if over.EFCurrent != 0 {
		base.EFCurrent = over.EFCurrent
	}
	if over.EFTargetMonths != 0 {
		base.EFTargetMonths = over.EFTargetMonths
	}
	if over.TPSPctAbove19 != 0 {
		base.TPSPctAbove19 = over.TPSPctAbove19
	}
	if over.UptimePctMonth != 0 {
		base.UptimePctMonth = over.UptimePctMonth
	}
	if over.DiscordMembers != 0 {
		base.DiscordMembers = over.DiscordMembers
	}
	if over.DiscordNetGrowthMonth != 0 {
		base.DiscordNetGrowthMonth = over.DiscordNetGrowthMonth
	}
	if over.UniquePlayersWeek != 0 {
		base.UniquePlayersWeek = over.UniquePlayersWeek
	}
	if over.ConcurrentAvg != 0 {
		base.ConcurrentAvg = over.ConcurrentAvg
	}
	if over.Stage != "" {
		base.Stage = over.Stage
	}
	if over.Notes != "" {
		base.Notes = over.Notes
	}
	return base
}

func run(t *testing.T, over Inputs) Result {
	t.Helper()
	return Calculate(healthy(over), NovumPreset())
}

func hasRule(r Result, id string) bool {
	for _, a := range r.Alerts {
		if a.Rule == id {
			return true
		}
	}
	return false
}

func TestPickBand(t *testing.T) {
	p := NovumPreset()
	cases := []struct {
		n  float64
		id string
	}{
		{0, "micro"}, {99.99, "micro"}, {100, "mid"}, {499.99, "mid"},
		{500, "large"}, {1999.99, "large"}, {2000, "mega"},
	}
	for _, c := range cases {
		if got := PickBand(p, c.n).ID; got != c.id {
			t.Fatalf("pickBand(%v)=%s want %s", c.n, got, c.id)
		}
	}
}

func TestMidBand(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 235, InfraCostMonth: 35, EFTargetMonths: 6})
	if r.Band == nil || r.Band.ID != "mid" {
		t.Fatalf("band %+v", r.Band)
	}
	if r.Remaining != 200 {
		t.Fatalf("remaining %v", r.Remaining)
	}
	if r.Allocation.EFFill != 40 || r.Allocation.Product != 100 || r.Allocation.Growth != 60 || r.Allocation.People != 0 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
}

func TestLargeBandPaysPeople(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 1035, InfraCostMonth: 35})
	if r.Band.ID != "large" {
		t.Fatalf("band %s", r.Band.ID)
	}
	if r.Allocation.EFFill != 200 || r.Allocation.Product != 400 || r.Allocation.Growth != 250 || r.Allocation.People != 150 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
}

func TestMegaBand(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 3000, InfraCostMonth: 1000})
	if r.Band.ID != "mega" {
		t.Fatalf("band %s", r.Band.ID)
	}
	if r.Allocation.EFFill != 400 || r.Allocation.Product != 700 || r.Allocation.Growth != 500 || r.Allocation.People != 400 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
}

func TestMicroBandToEF(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 85, InfraCostMonth: 35})
	if r.Band.ID != "micro" {
		t.Fatalf("band %s", r.Band.ID)
	}
	if r.Allocation.EFFill != 50 || r.Allocation.Product != 0 || r.Allocation.Unallocated != 0 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
}

func TestMicroBandEFFull(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 85, InfraCostMonth: 35, EFCurrent: 210})
	if r.Allocation.EFFill != 0 || r.Allocation.Unallocated != 50 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
}

func TestR1Shortfall(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 20, InfraCostMonth: 35})
	if r.InfraShortfall != 15 || r.Allocation.Infra != 20 || r.Band != nil {
		t.Fatalf("shortfall result %+v alloc %+v", r.InfraShortfall, r.Allocation)
	}
	if !hasRule(r, "R1") {
		t.Fatal("missing R1")
	}
}

func TestExactlyCoveringInfra(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 35, InfraCostMonth: 35})
	if r.InfraShortfall != 0 || r.Remaining != 0 || r.Allocation.Unallocated != 0 {
		t.Fatalf("got remaining=%v unalloc=%v short=%v", r.Remaining, r.Allocation.Unallocated, r.InfraShortfall)
	}
}

func TestEFCapValue(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 500, InfraCostMonth: 35, EFTargetMonths: 6})
	if r.EFCap != 210 {
		t.Fatalf("ef_cap %v", r.EFCap)
	}
}

func TestEFCapOverflow(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 1035, InfraCostMonth: 35, EFCurrent: 150})
	if r.Allocation.EFFill != 60 || r.EFAfter != 210 || r.Allocation.Unallocated != 140 {
		t.Fatalf("alloc %+v after %v", r.Allocation, r.EFAfter)
	}
	if !hasRule(r, "R2") {
		t.Fatal("missing R2")
	}
}

func TestFullEFToBuffer(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 1035, InfraCostMonth: 35, EFCurrent: 210})
	if r.Allocation.EFFill != 0 || r.Allocation.Unallocated != 200 || r.EFProgressPct != 100 {
		t.Fatalf("alloc %+v pct %v", r.Allocation, r.EFProgressPct)
	}
}

func TestR3TPSToProduct(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 1035, InfraCostMonth: 35, TPSPctAbove19: 94})
	if r.Allocation.Growth != 0 || r.Allocation.Product != 650 || r.Allocation.InfraBuffer != 0 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
	if !hasRule(r, "R3") {
		t.Fatal("missing R3")
	}
}

func TestAlphaIgnoresUptimeBetaDoesNot(t *testing.T) {
	low := Inputs{CashInMonth: 1035, InfraCostMonth: 35, UptimePctMonth: 99.4}
	alpha := run(t, merge(low, Inputs{Stage: "alpha"}))
	if alpha.Allocation.Growth != 250 {
		t.Fatalf("alpha growth %v", alpha.Allocation.Growth)
	}
	beta := run(t, merge(low, Inputs{Stage: "beta", TPSPctAbove19: 99}))
	if beta.Allocation.Growth != 250 {
		t.Fatalf("beta growth %v", beta.Allocation.Growth)
	}
	v1 := run(t, merge(low, Inputs{Stage: "v1", TPSPctAbove19: 99}))
	if v1.Allocation.Growth != 0 {
		t.Fatalf("v1 growth %v", v1.Allocation.Growth)
	}
}

func TestUnhealthyInfraParksGrowth(t *testing.T) {
	r := run(t, Inputs{
		CashInMonth: 1035, InfraCostMonth: 35, Stage: "v1",
		TPSPctAbove19: 99, UptimePctMonth: 98.5,
	})
	if r.Allocation.Growth != 0 || r.Allocation.InfraBuffer != 250 || r.Allocation.Product != 400 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
}

func TestR4CommunityRatio(t *testing.T) {
	r := run(t, Inputs{
		CashInMonth: 1035, InfraCostMonth: 35,
		DiscordMembers: 500, UniquePlayersWeek: 50,
	})
	if r.Health.DiscordRatio == nil || *r.Health.DiscordRatio != 10 {
		t.Fatalf("ratio %+v", r.Health.DiscordRatio)
	}
	if r.Allocation.Growth != 0 || r.Allocation.Product != 650 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
	if !hasRule(r, "R4") {
		t.Fatal("missing R4")
	}
}

func TestRatioSkippedWithoutPlayers(t *testing.T) {
	in := healthy(Inputs{CashInMonth: 1035, InfraCostMonth: 35})
	in.UniquePlayersWeek = 0
	r := Calculate(in, NovumPreset())
	if r.Health.DiscordRatio != nil {
		t.Fatalf("ratio %+v", r.Health.DiscordRatio)
	}
	if r.Allocation.Growth != 250 {
		t.Fatalf("growth %v", r.Allocation.Growth)
	}
	if !hasRule(r, "I3") {
		t.Fatal("missing I3")
	}
}

func TestR5LoadPressure(t *testing.T) {
	r := run(t, Inputs{
		CashInMonth: 1035, InfraCostMonth: 35,
		TPSPctAbove19: 90, ConcurrentAvg: 40,
	})
	if !r.Health.LoadPressure || r.Health.InfraHealthy {
		t.Fatalf("health %+v", r.Health)
	}
	if r.Allocation.Growth != 0 || r.Allocation.InfraBuffer != 250 {
		t.Fatalf("alloc %+v", r.Allocation)
	}
	if !hasRule(r, "R5") {
		t.Fatal("missing R5")
	}
}

func TestHighConcurrencyAlone(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 1035, InfraCostMonth: 35, ConcurrentAvg: 40})
	if r.Health.LoadPressure || r.Allocation.Growth != 250 {
		t.Fatalf("health %+v alloc %+v", r.Health, r.Allocation)
	}
}

func TestPeopleFromProfit(t *testing.T) {
	for _, cash := range []float64{535, 700, 1035, 2035, 5000} {
		r := run(t, Inputs{CashInMonth: cash, InfraCostMonth: 35})
		if r.Allocation.People > r.Remaining-r.Allocation.EFFill {
			t.Fatalf("people %v exceeds profit for cash %v", r.Allocation.People, cash)
		}
	}
}

func TestNoLeftoverNoPeople(t *testing.T) {
	r := run(t, Inputs{CashInMonth: 35, InfraCostMonth: 35})
	if r.Allocation.People != 0 {
		t.Fatalf("people %v", r.Allocation.People)
	}
}

func TestRunway(t *testing.T) {
	r := run(t, Inputs{CashOnHandStart: 100, CashInMonth: 200, InfraCostMonth: 50})
	if r.RunwayMonths == nil || *r.RunwayMonths != 5 {
		t.Fatalf("runway %+v", r.RunwayMonths)
	}
}

func TestNoInfraNoRunway(t *testing.T) {
	in := healthy(Inputs{})
	in.InfraCostMonth = 0
	r := Calculate(in, NovumPreset())
	if r.RunwayMonths != nil {
		t.Fatalf("runway %+v", r.RunwayMonths)
	}
}

func TestShortRunwayFlagged(t *testing.T) {
	r := run(t, Inputs{CashOnHandStart: 0, CashInMonth: 70, InfraCostMonth: 35})
	if !hasRule(r, "I1") {
		t.Fatal("missing I1")
	}
}

func TestRowsAddUp(t *testing.T) {
	cases := []Inputs{
		{CashInMonth: 0, InfraCostMonth: 35},
		{CashInMonth: 20, InfraCostMonth: 35},
		{CashInMonth: 85.37, InfraCostMonth: 35},
		{CashInMonth: 333.33, InfraCostMonth: 35.55, EFCurrent: 12.5},
		{CashInMonth: 1234.56, InfraCostMonth: 47.89, TPSPctAbove19: 80},
		{CashInMonth: 9999.99, InfraCostMonth: 120.01, EFCurrent: 700},
	}
	for _, c := range cases {
		r := run(t, c)
		if math.Abs(r.Allocation.Sum()-r.Inputs.CashInMonth) > 0.005 {
			t.Fatalf("sum %v != cash %v alloc %+v", r.Allocation.Sum(), r.Inputs.CashInMonth, r.Allocation)
		}
	}
}

func TestGenericPolicyDifferentShares(t *testing.T) {
	p := NovumPreset()
	p.Name = "Diplomatica"
	p.Bands = []Band{
		{ID: "only", Label: "todo", Min: 0, Shares: map[string]float64{"ef": 0, "product": 1, "growth": 0, "people": 0}},
	}
	in := healthy(Inputs{CashInMonth: 135, InfraCostMonth: 35})
	r := Calculate(in, p)
	if r.Allocation.Product != 100 || r.Allocation.Growth != 0 || r.Allocation.EFFill != 0 {
		t.Fatalf("generic alloc %+v", r.Allocation)
	}
	if math.Abs(r.Allocation.Sum()-135) > 0.005 {
		t.Fatalf("sum %v", r.Allocation.Sum())
	}
}
