package engine

type AlertLevel string

const (
	AlertRed  AlertLevel = "red"
	AlertWarn AlertLevel = "warn"
	AlertInfo AlertLevel = "info"
)

type Alert struct {
	Rule    string     `json:"rule"`
	Level   AlertLevel `json:"level"`
	Message string     `json:"message"`
}

type Inputs struct {
	Month                 string  `json:"month"`
	CashInMonth           float64 `json:"cash_in_month"`
	CashOnHandStart       float64 `json:"cash_on_hand_start"`
	InfraCostMonth        float64 `json:"infra_cost_month"`
	EFCurrent             float64 `json:"ef_current"`
	EFTargetMonths        float64 `json:"ef_target_months"`
	TPSPctAbove19         float64 `json:"tps_pct_above_19"`
	UptimePctMonth        float64 `json:"uptime_pct_month"`
	DiscordMembers        float64 `json:"discord_members"`
	DiscordNetGrowthMonth float64 `json:"discord_net_growth_month"`
	UniquePlayersWeek     float64 `json:"unique_players_week"`
	ConcurrentAvg         float64 `json:"concurrent_avg"`
	Stage                 string  `json:"stage"`
	Notes                 string  `json:"notes"`
}

type StageRule struct {
	TPSMin    float64  `json:"tps_min"`
	UptimeMin *float64 `json:"uptime_min"`
}

type Band struct {
	ID      string             `json:"id"`
	Label   string             `json:"label"`
	Min     float64            `json:"min"`
	Max     *float64           `json:"max"`
	Shares  map[string]float64 `json:"shares"`
}

type Bucket struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Note  string `json:"note"`
}

type Policy struct {
	Name                   string               `json:"name"`
	Buckets                []Bucket             `json:"buckets"`
	Bands                  []Band               `json:"bands"`
	Stages                 map[string]StageRule `json:"stages"`
	InfraID                string               `json:"infra_id"`
	EFID                   string               `json:"ef_id"`
	ProductID              string               `json:"product_id"`
	GrowthID               string               `json:"growth_id"`
	PeopleID               string               `json:"people_id"`
	InfraBufferID          string               `json:"infra_buffer_id"`
	UnallocatedID          string               `json:"unallocated_id"`
	DiscordPerPlayerMax    float64              `json:"discord_per_player_max"`
	ConcurrentHigh         float64              `json:"concurrent_high"`
	InfraHealthUptimeFloor float64              `json:"infra_health_uptime_floor"`
	MinRunwayMonths        float64              `json:"min_runway_months"`
	CharterEFShare         float64              `json:"charter_ef_share"`
	StageGates             bool                 `json:"stage_gates"`
	CommunityRatio         bool                 `json:"community_ratio"`
	LoadPressure           bool                 `json:"load_pressure"`
	PeopleFromProfit       bool                 `json:"people_from_profit"`
	EFCap                  bool                 `json:"ef_cap"`
}

type Health struct {
	TPSOk         bool     `json:"tps_ok"`
	UptimeOk      bool     `json:"uptime_ok"`
	LoadPressure  bool     `json:"load_pressure"`
	InfraHealthy  bool     `json:"infra_healthy"`
	GrowthBlocked bool     `json:"growth_blocked"`
	DiscordRatio  *float64 `json:"discord_ratio"`
}

type Allocation struct {
	Infra       float64 `json:"infra"`
	EFFill      float64 `json:"ef_fill"`
	Product     float64 `json:"product"`
	Growth      float64 `json:"growth"`
	People      float64 `json:"people"`
	InfraBuffer float64 `json:"infra_buffer"`
	Unallocated float64 `json:"unallocated"`
}

type Result struct {
	Inputs          Inputs             `json:"inputs"`
	Policy          Policy             `json:"policy"`
	Band            *Band              `json:"band"`
	Remaining       float64            `json:"remaining"`
	InfraShortfall  float64            `json:"infra_shortfall"`
	Allocation      Allocation         `json:"allocation"`
	ByID            map[string]float64 `json:"by_id"`
	EFCap           float64            `json:"ef_cap"`
	EFAfter         float64            `json:"ef_after"`
	EFProgressPct   float64            `json:"ef_progress_pct"`
	EFCharterTarget float64            `json:"ef_charter_target"`
	RunwayMonths    *float64           `json:"runway_months"`
	Health          Health             `json:"health"`
	Alerts          []Alert            `json:"alerts"`
	TotalAllocated  float64            `json:"total_allocated"`
}

func (a Allocation) Sum() float64 {
	return a.Infra + a.EFFill + a.Product + a.Growth + a.People + a.InfraBuffer + a.Unallocated
}
