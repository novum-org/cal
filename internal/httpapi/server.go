package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/novum-org/cal/internal/engine"
	"github.com/novum-org/cal/internal/sources"
	"github.com/novum-org/cal/internal/store"
)

const cookieName = "cal_session"

type Config struct {
	Signup       string // "invite" | "setup"
	AdminEmail   string
	AdminPass    string
	CookieSecure bool
	WebDir       string
}

type Server struct {
	Store   *store.Store
	Config  Config
	Sources *sources.Registry
}

func New(st *store.Store, cfg Config) *Server {
	if cfg.Signup == "" {
		cfg.Signup = "setup"
	}
	return &Server{Store: st, Config: cfg, Sources: sources.Default(nil)}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(s.cors)

	r.Get("/api/health", s.health)
	r.Get("/api/auth/status", s.authStatus)
	r.Post("/api/auth/setup", s.setup)
	r.Post("/api/auth/login", s.login)
	r.Post("/api/auth/logout", s.logout)
	r.Get("/api/auth/me", s.me)
	r.Get("/api/auth/invites/{code}", s.getInvite)
	r.Post("/api/auth/redeem", s.redeemInvite)

	r.Group(func(r chi.Router) {
		r.Use(s.requireAuth)
		r.Get("/api/sessions", s.listSpaces)
		r.Post("/api/sessions", s.createSpace)
		r.Get("/api/sessions/{id}", s.getSpace)
		r.Patch("/api/sessions/{id}", s.patchSpace)
		r.Get("/api/presets", s.listPresets)
		r.Post("/api/sessions/{id}/preset", s.applyPreset)
		r.Get("/api/sessions/{id}/members", s.listMembers)
		r.Post("/api/sessions/{id}/members", s.addMember)
		r.Delete("/api/sessions/{id}/members/{userId}", s.removeMember)
		r.Get("/api/sessions/{id}/invites", s.listInvites)
		r.Delete("/api/sessions/{id}/invites/{code}", s.revokeInvite)
		r.Get("/api/sessions/{id}/months", s.listMonths)
		r.Get("/api/sessions/{id}/months/{month}", s.getMonth)
		r.Put("/api/sessions/{id}/months/{month}", s.putMonth)
		r.Post("/api/sessions/{id}/preview", s.preview)
		r.Post("/api/sessions/{id}/months/{month}/plan", s.planMonth)
		r.Post("/api/sessions/{id}/months/{month}/close", s.closeMonth)
		r.Post("/api/sessions/{id}/months/{month}/reopen", s.reopenMonth)
		r.Get("/api/sessions/{id}/months/{month}/comments", s.listMonthComments)
		r.Post("/api/sessions/{id}/months/{month}/comments", s.addMonthComment)
		r.Post("/api/sessions/{id}/months/{month}/pull", s.pullSources)
		r.Get("/api/sources", s.listSourceCatalogue)
		r.Get("/api/sessions/{id}/sources", s.listSourceConfigs)
		r.Put("/api/sessions/{id}/sources/{sourceId}", s.putSourceConfig)
		r.Delete("/api/sessions/{id}/sources/{sourceId}", s.deleteSourceConfig)
		r.Get("/api/export", s.exportDump)
		r.Post("/api/import", s.importDump)
	})

	if s.Config.WebDir != "" {
		s.mountWeb(r, s.Config.WebDir)
	}
	return r
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) mountWeb(r chi.Router, dir string) {
	root := http.Dir(dir)
	fileServer := http.FileServer(root)
	r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if strings.HasPrefix(req.URL.Path, "/api/") {
			http.NotFound(w, req)
			return
		}
		path := strings.TrimPrefix(req.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		f, err := root.Open(path)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) || os.IsNotExist(err) {
				req.URL.Path = "/"
				http.ServeFile(w, req, dir+"/index.html")
				return
			}
		} else {
			_ = f.Close()
		}
		fileServer.ServeHTTP(w, req)
	}))
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}

func (s *Server) authStatus(w http.ResponseWriter, _ *http.Request) {
	n, err := s.Store.UserCount()
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"setup_needed": n == 0 && s.Config.Signup != "invite",
		"signup":       s.Config.Signup,
	})
}

func (s *Server) Bootstrap() error {
	n, err := s.Store.UserCount()
	if err != nil || n > 0 {
		return err
	}
	if s.Config.AdminEmail == "" || s.Config.AdminPass == "" {
		return nil
	}
	_, err = s.Store.CreateUser(s.Config.AdminEmail, s.Config.AdminPass)
	return err
}

type creds struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) setup(w http.ResponseWriter, r *http.Request) {
	n, err := s.Store.UserCount()
	if err != nil {
		writeErr(w, err)
		return
	}
	if n > 0 || s.Config.Signup == "invite" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "setup disabled"})
		return
	}
	var c creds
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	u, err := s.Store.CreateUser(c.Email, c.Password)
	if err != nil {
		writeErr(w, err)
		return
	}
	s.setSession(w, u.ID)
	writeJSON(w, http.StatusCreated, u)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var c creds
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	u, err := s.Store.Authenticate(c.Email, c.Password)
	if err != nil {
		writeErr(w, err)
		return
	}
	s.setSession(w, u.ID)
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(cookieName); err == nil {
		_ = s.Store.DeleteAuth(c.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name: cookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u, err := s.userFromRequest(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) setSession(w http.ResponseWriter, userID string) {
	token, err := s.Store.CreateAuth(userID, 14*24*time.Hour)
	if err != nil {
		writeErr(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.Config.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((14 * 24 * time.Hour).Seconds()),
	})
}

func (s *Server) userFromRequest(r *http.Request) (store.User, error) {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return store.User{}, store.ErrUnauthorized
	}
	return s.Store.UserByToken(c.Value)
}

type ctxKey struct{}

var userCtxKey = ctxKey{}

func withUser(ctx context.Context, u store.User) context.Context {
	return context.WithValue(ctx, userCtxKey, u)
}

func mustUser(r *http.Request) store.User {
	u, _ := r.Context().Value(userCtxKey).(store.User)
	return u
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, err := s.userFromRequest(r)
		if err != nil {
			writeErr(w, store.ErrUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(withUser(r.Context(), u)))
	})
}

func (s *Server) listSpaces(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	list, err := s.Store.ListSpaces(u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

type createSpaceBody struct {
	Name   string `json:"name"`
	Preset string `json:"preset"`
}

func (s *Server) createSpace(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	var b createSpaceBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	sp, err := s.Store.CreateSpace(u.ID, b.Name, b.Preset)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sp)
}

func (s *Server) getSpace(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	sp, err := s.Store.SpaceForUser(chi.URLParam(r, "id"), u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sp)
}

type patchSpaceBody struct {
	Name     *string        `json:"name"`
	Policy   *engine.Policy `json:"policy"`
	Archived *bool          `json:"archived"`
	Revision int            `json:"revision"`
}

func (s *Server) patchSpace(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	sp, err := s.Store.SpaceForUser(id, u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	var b patchSpaceBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	if b.Name != nil {
		sp.Name = *b.Name
	}
	if b.Policy != nil {
		sp.Policy = *b.Policy
	}
	if b.Archived != nil {
		sp.Archived = *b.Archived
	}
	out, err := s.Store.UpdateSpace(u.ID, sp, b.Revision)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) listMonths(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	if _, err := s.Store.SpaceForUser(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	list, err := s.Store.ListMonths(id)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) getMonth(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	month := chi.URLParam(r, "month")
	if _, err := s.Store.SpaceForUser(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	m, err := s.Store.GetMonth(id, month)
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusOK, store.Month{
			SpaceID: id,
			Month:   month,
			Inputs:  defaultInputs(month),
			Status:  "draft",
		})
		return
	}
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

type putMonthBody struct {
	Inputs   engine.Inputs      `json:"inputs"`
	Actuals  map[string]float64 `json:"actuals"`
	Revision int                `json:"revision"`
	// Sources is what the last pull reported, echoed back so the saved month
	// remembers which numbers came from an API. It is checked against the
	// registry before it is stored, so it can only ever say that a real source
	// filled a field that source declares.
	Sources map[string]sources.Origin `json:"sources"`
}

func (s *Server) putMonth(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	month := chi.URLParam(r, "month")
	if _, err := s.Store.SpaceForUser(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	var b putMonthBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	b.Inputs.Month = month
	// A closed month is a record, not a draft. Editing its inputs would leave
	// the plan snapshot describing numbers that are no longer there, so the
	// write is refused and the caller is told to reopen instead.
	if cur, err := s.Store.GetMonth(id, month); err == nil && cur.Status == store.StatusClosed {
		writeErr(w, store.ErrMonthClosed)
		return
	}
	m, err := s.Store.UpsertMonth(u.ID, store.Month{
		SpaceID: id, Month: month, Inputs: b.Inputs, Actuals: b.Actuals,
		Sources: s.checkOrigins(b.Sources), Status: store.StatusDraft,
	}, b.Revision)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

type previewBody struct {
	Inputs engine.Inputs `json:"inputs"`
}

func (s *Server) preview(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	sp, err := s.Store.SpaceForUser(id, u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	var b previewBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	res := engine.Calculate(b.Inputs, sp.Policy)
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) planMonth(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	month := chi.URLParam(r, "month")
	sp, err := s.Store.SpaceForUser(id, u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	m, err := s.Store.GetMonth(id, month)
	if err != nil {
		writeErr(w, err)
		return
	}
	res := engine.Calculate(m.Inputs, sp.Policy)
	m.Planned = &res
	m.Status = store.StatusPlanned
	out, err := s.Store.UpsertMonth(u.ID, m, m.Revision)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type closeBody struct {
	Actuals  map[string]float64 `json:"actuals"`
	Revision int                `json:"revision"`
}

func (s *Server) closeMonth(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	month := chi.URLParam(r, "month")
	sp, err := s.Store.SpaceForUser(id, u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	m, err := s.Store.GetMonth(id, month)
	if err != nil {
		writeErr(w, err)
		return
	}
	var b closeBody
	_ = json.NewDecoder(r.Body).Decode(&b)
	if m.Planned == nil {
		res := engine.Calculate(m.Inputs, sp.Policy)
		m.Planned = &res
	}
	if b.Actuals != nil {
		m.Actuals = b.Actuals
	}
	m.Status = store.StatusClosed
	rev := m.Revision
	if b.Revision != 0 {
		rev = b.Revision
	}
	out, err := s.Store.UpsertMonth(u.ID, m, rev)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) exportDump(w http.ResponseWriter, _ *http.Request) {
	d, err := s.Store.Export()
	if err != nil {
		writeErr(w, err)
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="cal-dump.json"`)
	writeJSON(w, http.StatusOK, d)
}

func (s *Server) importDump(w http.ResponseWriter, r *http.Request) {
	var d store.Dump
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	if d.Version == 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "v1 snapshot: create a session and PUT the month instead"})
		return
	}
	if err := s.Store.Import(d); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}

func defaultInputs(month string) engine.Inputs {
	in := engine.DefaultInputs()
	if month != "" {
		in.Month = month
	}
	return in
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrUnauthorized):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	case errors.Is(err, store.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	case errors.Is(err, store.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "conflict"})
	case errors.Is(err, store.ErrStaleRevision):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "stale revision"})
	case errors.Is(err, store.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
	case errors.Is(err, store.ErrMonthClosed):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "El mes está cerrado. Reabrilo para editarlo."})
	case errors.Is(err, store.ErrInvalid):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
	}
}
