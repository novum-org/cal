package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/novum-org/cal/internal/engine"
	"github.com/novum-org/cal/internal/store"
)

// inviteTTL is how long a code stays good. Long enough to reach someone over
// the weekend, short enough that a leaked link goes cold.
const inviteTTL = 14 * 24 * time.Hour

type memberBody struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (s *Server) listMembers(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	list, err := s.Store.ListMembers(chi.URLParam(r, "id"), u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// addMember joins an existing account, or writes an invite when the address has
// no account yet. One endpoint, because the caller only knows an email and
// should not have to guess which case they are in.
func (s *Server) addMember(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	var b memberBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	member, err := s.Store.AddMemberByEmail(id, u.ID, b.Email, b.Role)
	if err == nil {
		writeJSON(w, http.StatusOK, map[string]any{"member": member})
		return
	}
	if !errors.Is(err, store.ErrNotFound) {
		writeErr(w, err)
		return
	}
	inv, err := s.Store.CreateInvite(id, u.ID, b.Email, b.Role, inviteTTL)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"invite": inv})
}

func (s *Server) removeMember(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	if err := s.Store.RemoveMember(chi.URLParam(r, "id"), u.ID, chi.URLParam(r, "userId")); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listInvites(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	list, err := s.Store.ListInvites(chi.URLParam(r, "id"), u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) revokeInvite(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	if err := s.Store.RevokeInvite(chi.URLParam(r, "id"), u.ID, chi.URLParam(r, "code")); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// getInvite is public: the signup screen needs to show who the invite is for
// and what they are joining before asking for a password. It returns no code
// the caller did not already have.
func (s *Server) getInvite(w http.ResponseWriter, r *http.Request) {
	inv, err := s.Store.InviteByCode(chi.URLParam(r, "code"))
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"email":      inv.Email,
		"space_name": inv.SpaceName,
	})
}

type redeemBody struct {
	Code     string `json:"code"`
	Password string `json:"password"`
}

func (s *Server) redeemInvite(w http.ResponseWriter, r *http.Request) {
	var b redeemBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	u, err := s.Store.RedeemInvite(b.Code, b.Password)
	if err != nil {
		writeErr(w, err)
		return
	}
	s.setSession(w, u.ID)
	writeJSON(w, http.StatusCreated, u)
}

// listPresets is the menu behind "empezar de nuevo con otra política".
func (s *Server) listPresets(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, engine.Presets)
}

type presetBody struct {
	Preset   string `json:"preset"`
	Revision int    `json:"revision"`
}

// applyPreset replaces the policy and nothing else. Months keep their inputs,
// their actuals, and the policy snapshot they were closed with.
func (s *Server) applyPreset(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	sp, err := s.Store.SpaceForUser(id, u.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	var b presetBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	sp.Policy = engine.PresetByID(b.Preset)
	out, err := s.Store.UpdateSpace(u.ID, sp, b.Revision)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}
