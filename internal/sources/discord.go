package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const discordAPI = "https://discord.com/api/v10"

// Discord reads the guild's member count. Growth is the difference against the
// previous month's stored count, so it only appears when there is a previous
// month to subtract; a first month reports the level and stays quiet about the
// change, because there is no change to report yet.
type Discord struct {
	client *http.Client
	base   string
}

func NewDiscord(client *http.Client) *Discord { return &Discord{client: client, base: discordAPI} }

func (d *Discord) ID() string   { return "discord" }
func (d *Discord) Name() string { return "Discord" }
func (d *Discord) Description() string {
	return "Miembros del server de Discord, y el crecimiento contra el mes anterior."
}
func (d *Discord) Fields() []string {
	return []string{"discord_members", "discord_net_growth_month"}
}

func (d *Discord) ConfigFields() []ConfigField {
	return []ConfigField{
		{Key: "bot_token", Label: "Token del bot", Hint: "El bot tiene que estar en el server", Secret: true},
		{Key: "guild_id", Label: "ID del server", Hint: "Click derecho en el server > Copiar ID"},
	}
}

type discordConfig struct {
	BotToken string `json:"bot_token"`
	GuildID  string `json:"guild_id"`
}

type discordGuild struct {
	ApproximateMemberCount *float64 `json:"approximate_member_count"`
}

func (d *Discord) Fetch(ctx context.Context, raw json.RawMessage, _ string, prev Patch) (Patch, error) {
	var cfg discordConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("config de Discord ilegible")
	}
	if strings.TrimSpace(cfg.BotToken) == "" {
		return nil, fmt.Errorf("falta el token del bot")
	}
	if strings.TrimSpace(cfg.GuildID) == "" {
		return nil, fmt.Errorf("falta el ID del server")
	}

	endpoint := fmt.Sprintf("%s/guilds/%s?with_counts=true", d.base, url.PathEscape(cfg.GuildID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bot "+cfg.BotToken)
	res, err := d.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("no se pudo hablar con Discord: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	switch res.StatusCode {
	case http.StatusOK:
	case http.StatusUnauthorized:
		return nil, fmt.Errorf("Discord rechazó el token del bot")
	case http.StatusForbidden:
		return nil, fmt.Errorf("el bot no tiene acceso a ese server")
	case http.StatusNotFound:
		return nil, fmt.Errorf("no existe un server con ese ID, o el bot no está adentro")
	default:
		return nil, fmt.Errorf("Discord respondió %d", res.StatusCode)
	}

	var guild discordGuild
	if err := json.NewDecoder(res.Body).Decode(&guild); err != nil {
		return nil, fmt.Errorf("Discord devolvió algo que no se entiende")
	}
	// with_counts=true is what fills this. Without it the field is absent, and
	// an absent count is not zero members.
	if guild.ApproximateMemberCount == nil {
		return nil, fmt.Errorf("Discord no devolvió el conteo de miembros")
	}

	patch := Patch{"discord_members": *guild.ApproximateMemberCount}
	if before, ok := prev["discord_members"]; ok && before > 0 {
		patch["discord_net_growth_month"] = *guild.ApproximateMemberCount - before
	}
	return patch, nil
}
