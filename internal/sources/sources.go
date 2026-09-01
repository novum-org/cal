// Package sources pulls month inputs from the places that already know them:
// the store, the Discord guild, the box the server runs on.
//
// The contract every source obeys is the same, and it is deliberately narrow:
// a source returns only the fields it actually measured. A field missing from
// a patch was not measured, which is not the same as measured at zero. A source
// that fails returns an empty patch and an error, never a plausible number.
package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"
)

// Patch maps engine input field names to measured values. Only fields the
// source actually knows appear.
type Patch map[string]float64

// ConfigField describes one setting a source needs, so the UI can render a form
// without knowing anything about the source itself.
type ConfigField struct {
	Key    string `json:"key"`
	Label  string `json:"label"`
	Hint   string `json:"hint,omitempty"`
	Secret bool   `json:"secret"`
}

// Source is one place month inputs can come from.
type Source interface {
	ID() string
	Name() string
	Description() string
	// Fields lists every engine input this source can ever fill. It is a
	// promise about the ceiling, not about any one month.
	Fields() []string
	ConfigFields() []ConfigField
	// Fetch returns what the source measured for the month, or an error. It
	// must never return a partially invented patch alongside an error. prev
	// carries the previous month's stored inputs, for the sources whose fields
	// are a difference rather than a level; most sources ignore it.
	Fetch(ctx context.Context, cfg json.RawMessage, month string, prev Patch) (Patch, error)
}

// Descriptor is the catalogue entry the frontend gets. It carries no secrets.
type Descriptor struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Fields      []string      `json:"fields"`
	Config      []ConfigField `json:"config"`
}

// Registry is the set of sources this build knows how to run.
type Registry struct {
	byID map[string]Source
}

func NewRegistry(list ...Source) *Registry {
	r := &Registry{byID: make(map[string]Source, len(list))}
	for _, s := range list {
		r.byID[s.ID()] = s
	}
	return r
}

// Default is the registry the server runs with.
func Default(client *http.Client) *Registry {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return NewRegistry(
		NewTebex(client),
		NewDiscord(client),
		NewMetrics(client),
	)
}

func (r *Registry) Get(id string) (Source, bool) {
	s, ok := r.byID[id]
	return s, ok
}

func (r *Registry) Describe() []Descriptor {
	out := make([]Descriptor, 0, len(r.byID))
	for _, s := range r.byID {
		out = append(out, Descriptor{
			ID:          s.ID(),
			Name:        s.Name(),
			Description: s.Description(),
			Fields:      s.Fields(),
			Config:      s.ConfigFields(),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// Origin records which source last filled a field, and with what. Keeping the
// pulled value is what lets the UI tell an untouched API value apart from a
// human override without a second flag to keep in sync.
type Origin struct {
	Source string  `json:"source"`
	Value  float64 `json:"value"`
	At     string  `json:"at"`
}

// Failure is one source that could not answer. It travels with the result
// instead of replacing it, so one dead source does not hide three live ones.
type Failure struct {
	Source string `json:"source"`
	Error  string `json:"error"`
}

// Result is one pull across several sources.
type Result struct {
	Patch    Patch             `json:"patch"`
	Origins  map[string]Origin `json:"origins"`
	Failures []Failure         `json:"failures"`
}

// Config is one session's settings for one source.
type Config struct {
	SourceID string
	Raw      json.RawMessage
}

// Pull runs the given configs and merges what they return. Sources run in the
// order given, and a later source wins a field an earlier one also filled;
// with the registry as it stands no two sources claim the same field.
func (r *Registry) Pull(ctx context.Context, month string, prev Patch, configs []Config) Result {
	res := Result{Patch: Patch{}, Origins: map[string]Origin{}, Failures: []Failure{}}
	at := time.Now().UTC().Format(time.RFC3339)
	for _, c := range configs {
		src, ok := r.Get(c.SourceID)
		if !ok {
			res.Failures = append(res.Failures, Failure{Source: c.SourceID, Error: "fuente desconocida"})
			continue
		}
		patch, err := src.Fetch(ctx, c.Raw, month, prev)
		if err != nil {
			res.Failures = append(res.Failures, Failure{Source: c.SourceID, Error: err.Error()})
			continue
		}
		allowed := allowedFields(src)
		for field, value := range patch {
			if _, ok := allowed[field]; !ok {
				// A source that returns a field it never declared is a bug in
				// the source, not permission to write anywhere in the month.
				continue
			}
			res.Patch[field] = value
			res.Origins[field] = Origin{Source: src.ID(), Value: value, At: at}
		}
	}
	return res
}

func allowedFields(s Source) map[string]struct{} {
	out := make(map[string]struct{}, len(s.Fields()))
	for _, f := range s.Fields() {
		out[f] = struct{}{}
	}
	return out
}

// monthRange turns YYYY-MM into the UTC half-open interval [start, end).
func monthRange(month string) (time.Time, time.Time, error) {
	start, err := time.Parse("2006-01", month)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("mes inválido: %s", month)
	}
	return start, start.AddDate(0, 1, 0), nil
}
