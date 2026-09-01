package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/novum-org/cal/internal/sources"
	"github.com/novum-org/cal/internal/store"
)

// pullTimeout bounds one pull across every configured source. A store that
// never answers must not hold the request open forever.
const pullTimeout = 30 * time.Second

// sourceState is what the browser is allowed to know about a session's ingest
// config: that it exists, and the values of the fields that are not secret.
// Secret values are never sent back, not even masked, because a mask that can
// be diffed is still a leak.
type sourceState struct {
	sources.Descriptor
	Configured bool            `json:"configured"`
	Values     map[string]any  `json:"values"`
	Secrets    map[string]bool `json:"secrets_set"`
}

func (s *Server) listSourceCatalogue(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.Sources.Describe())
}

func (s *Server) listSourceConfigs(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	if _, err := s.Store.SpaceForUser(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	out := []sourceState{}
	for _, d := range s.Sources.Describe() {
		state := sourceState{Descriptor: d, Values: map[string]any{}, Secrets: map[string]bool{}}
		raw, err := s.Store.SourceConfig(id, d.ID)
		if err == nil {
			state.Configured = true
			var stored map[string]any
			if json.Unmarshal(raw, &stored) == nil {
				for _, field := range d.Config {
					value, ok := stored[field.Key]
					if !ok {
						continue
					}
					if field.Secret {
						state.Secrets[field.Key] = value != "" && value != nil
						continue
					}
					state.Values[field.Key] = value
				}
			}
		}
		out = append(out, state)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) putSourceConfig(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	sourceID := chi.URLParam(r, "sourceId")
	src, ok := s.Sources.Get(sourceID)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "fuente desconocida"})
		return
	}
	// Credentials are the one thing an editor cannot set. Only the owner.
	if err := s.Store.RequireOwner(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	var incoming map[string]any
	if err := json.NewDecoder(r.Body).Decode(&incoming); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}

	// An empty secret means "leave the one you have", so editing the guild id
	// does not silently wipe the bot token.
	merged := map[string]any{}
	if raw, err := s.Store.SourceConfig(id, sourceID); err == nil {
		_ = json.Unmarshal(raw, &merged)
	}
	for _, field := range src.ConfigFields() {
		value, sent := incoming[field.Key]
		if !sent {
			continue
		}
		if field.Secret && (value == nil || value == "") {
			continue
		}
		merged[field.Key] = value
	}

	raw, err := json.Marshal(merged)
	if err != nil {
		writeErr(w, err)
		return
	}
	if err := s.Store.SetSourceConfig(id, sourceID, raw); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"source": sourceID})
}

func (s *Server) deleteSourceConfig(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	sourceID := chi.URLParam(r, "sourceId")
	if err := s.Store.RequireOwner(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	if err := s.Store.DeleteSourceConfig(id, sourceID); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type pullBody struct {
	// Sources limits the pull to these ids. Empty means every configured one.
	Sources []string `json:"sources"`
}

// pullSources runs the session's configured sources and hands back what they
// measured. It writes nothing: the patch lands in the form, the person looks at
// it, and the month is saved only if they want it.
func (s *Server) pullSources(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	month := chi.URLParam(r, "month")
	if _, err := s.Store.SpaceForUser(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	var b pullBody
	_ = json.NewDecoder(r.Body).Decode(&b)

	configs, err := s.Store.SourceConfigs(id)
	if err != nil {
		writeErr(w, err)
		return
	}
	if len(b.Sources) > 0 {
		wanted := map[string]struct{}{}
		for _, sourceID := range b.Sources {
			wanted[sourceID] = struct{}{}
		}
		kept := configs[:0]
		for _, c := range configs {
			if _, ok := wanted[c.SourceID]; ok {
				kept = append(kept, c)
			}
		}
		configs = kept
	}
	if len(configs) == 0 {
		writeJSON(w, http.StatusOK, sources.Result{
			Patch:   sources.Patch{},
			Origins: map[string]sources.Origin{},
			Failures: []sources.Failure{
				{Source: "", Error: "no hay ninguna fuente configurada en esta sesión"},
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), pullTimeout)
	defer cancel()
	res := s.Sources.Pull(ctx, month, previousInputs(s.Store, id, month), configs)
	writeJSON(w, http.StatusOK, res)
}

// previousInputs is the month before this one, as a flat patch, for the sources
// whose fields are a difference rather than a level. A month that was never
// saved contributes nothing, which is why growth stays absent instead of
// arriving as the full member count.
func previousInputs(st *store.Store, spaceID, month string) sources.Patch {
	prev, err := previousMonthKey(month)
	if err != nil {
		return nil
	}
	m, err := st.GetMonth(spaceID, prev)
	if err != nil || m.Revision == 0 {
		return nil
	}
	return sources.Patch{
		"cash_in_month":       m.Inputs.CashInMonth,
		"discord_members":     m.Inputs.DiscordMembers,
		"unique_players_week": m.Inputs.UniquePlayersWeek,
	}
}

func previousMonthKey(month string) (string, error) {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return "", err
	}
	return t.AddDate(0, -1, 0).Format("2006-01"), nil
}

// checkOrigins drops anything the registry cannot vouch for: an unknown source,
// or a field that source does not declare. A client cannot label a number it
// typed as one Tebex reported.
func (s *Server) checkOrigins(in map[string]sources.Origin) map[string]sources.Origin {
	if len(in) == 0 {
		return nil
	}
	out := map[string]sources.Origin{}
	for field, origin := range in {
		src, ok := s.Sources.Get(origin.Source)
		if !ok {
			continue
		}
		for _, declared := range src.Fields() {
			if declared == field {
				out[field] = origin
				break
			}
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
