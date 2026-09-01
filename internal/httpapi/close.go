package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type reopenBody struct {
	Revision int `json:"revision"`
}

// reopenMonth takes a closed month back to planned so its inputs can be fixed.
// The plan and the actuals stay on the row: reopening is permission to edit,
// not an undo of the close.
func (s *Server) reopenMonth(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	month := chi.URLParam(r, "month")
	if _, err := s.Store.SpaceForUser(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	var b reopenBody
	_ = json.NewDecoder(r.Body).Decode(&b)
	m, err := s.Store.ReopenMonth(u.ID, id, month, b.Revision)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func (s *Server) listMonthComments(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	month := chi.URLParam(r, "month")
	if _, err := s.Store.SpaceForUser(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	list, err := s.Store.ListMonthComments(id, month)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

type commentBody struct {
	Body string `json:"body"`
}

func (s *Server) addMonthComment(w http.ResponseWriter, r *http.Request) {
	u := mustUser(r)
	id := chi.URLParam(r, "id")
	month := chi.URLParam(r, "month")
	if _, err := s.Store.SpaceForUser(id, u.ID); err != nil {
		writeErr(w, err)
		return
	}
	var b commentBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	c, err := s.Store.AddMonthComment(u.ID, id, month, b.Body)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, c)
}
