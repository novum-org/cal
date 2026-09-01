package httpapi

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/novum-org/cal/internal/engine"
	"github.com/novum-org/cal/internal/store"
)

// saveMonth puts one month of inputs and hands back the stored row.
func saveMonth(c *client, spaceID, month string, in engine.Inputs, rev int) store.Month {
	c.t.Helper()
	rec := c.mustDo(http.MethodPut,
		fmt.Sprintf("/api/sessions/%s/months/%s", spaceID, month),
		map[string]any{"inputs": in, "revision": rev}, http.StatusOK)
	return decode[store.Month](c.t, rec)
}

func healthyMonth(month string) engine.Inputs {
	return engine.Inputs{
		Month:             month,
		CashInMonth:       1180,
		CashOnHandStart:   400,
		InfraCostMonth:    35,
		EFTargetMonths:    6,
		TPSPctAbove19:     99,
		UptimePctMonth:    99.9,
		UniquePlayersWeek: 40,
		DiscordMembers:    120,
		ConcurrentAvg:     8,
		Stage:             "alpha",
	}
}

// The plan is a snapshot of the policy that produced it, so editing the policy
// afterwards must not rewrite what the month says was decided.
func TestPlanSnapshotsThePolicyItUsed(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	saveMonth(c, sp.ID, "2026-01", healthyMonth("2026-01"), 0)

	rec := c.mustDo(http.MethodPost,
		fmt.Sprintf("/api/sessions/%s/months/2026-01/plan", sp.ID), nil, http.StatusOK)
	planned := decode[store.Month](t, rec)
	if planned.Planned == nil {
		t.Fatal("plan did not store a result")
	}
	if planned.Planned.Policy.Name != "Novum" {
		t.Fatalf("plan kept policy %q", planned.Planned.Policy.Name)
	}
	if planned.Status != store.StatusPlanned {
		t.Fatalf("status %q", planned.Status)
	}
	before := planned.Planned.Allocation

	c.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/preset", sp.ID),
		map[string]any{"preset": "generic", "revision": sp.Revision}, http.StatusOK)

	rec = c.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/months/2026-01", sp.ID), nil, http.StatusOK)
	after := decode[store.Month](t, rec)
	if after.Planned.Policy.Name != "Novum" {
		t.Fatalf("swapping the session preset rewrote the snapshot to %q", after.Planned.Policy.Name)
	}
	if after.Planned.Allocation != before {
		t.Fatal("snapshot allocation changed under the month")
	}
}

func TestClosedMonthRejectsInputEdits(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	saveMonth(c, sp.ID, "2026-02", healthyMonth("2026-02"), 0)

	rec := c.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/months/2026-02", sp.ID), nil, http.StatusOK)
	m := decode[store.Month](t, rec)

	rec = c.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-02/close", sp.ID),
		map[string]any{"actuals": map[string]float64{"infra": 35, "product": 400}, "revision": m.Revision},
		http.StatusOK)
	closed := decode[store.Month](t, rec)
	if closed.Status != store.StatusClosed {
		t.Fatalf("status %q", closed.Status)
	}

	edited := healthyMonth("2026-02")
	edited.CashInMonth = 9999
	c.mustDo(http.MethodPut, fmt.Sprintf("/api/sessions/%s/months/2026-02", sp.ID),
		map[string]any{"inputs": edited, "revision": closed.Revision}, http.StatusConflict)

	rec = c.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/months/2026-02", sp.ID), nil, http.StatusOK)
	still := decode[store.Month](t, rec)
	if still.Inputs.CashInMonth != 1180 {
		t.Fatalf("closed month took the edit: %v", still.Inputs.CashInMonth)
	}
}

// Reopening is permission to edit, not an undo: the plan and the actuals stay.
func TestReopenKeepsPlanAndActuals(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	saveMonth(c, sp.ID, "2026-03", healthyMonth("2026-03"), 0)
	rec := c.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/months/2026-03", sp.ID), nil, http.StatusOK)
	m := decode[store.Month](t, rec)

	rec = c.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-03/close", sp.ID),
		map[string]any{"actuals": map[string]float64{"infra": 35, "growth": 120}, "revision": m.Revision},
		http.StatusOK)
	closed := decode[store.Month](t, rec)

	rec = c.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-03/reopen", sp.ID),
		map[string]any{"revision": closed.Revision}, http.StatusOK)
	open := decode[store.Month](t, rec)

	if open.Status != store.StatusPlanned {
		t.Fatalf("reopened to %q", open.Status)
	}
	if open.Planned == nil {
		t.Fatal("reopen dropped the plan")
	}
	if open.Actuals["growth"] != 120 {
		t.Fatalf("reopen dropped the actuals: %v", open.Actuals)
	}

	edited := healthyMonth("2026-03")
	edited.CashInMonth = 1200
	saveMonth(c, sp.ID, "2026-03", edited, open.Revision)
}

func TestCommentsSurviveTheClose(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	saveMonth(c, sp.ID, "2026-04", healthyMonth("2026-04"), 0)
	rec := c.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/months/2026-04", sp.ID), nil, http.StatusOK)
	m := decode[store.Month](t, rec)

	c.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-04/comments", sp.ID),
		map[string]string{"body": "el VPS subió a 40"}, http.StatusCreated)

	rec = c.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-04/close", sp.ID),
		map[string]any{"actuals": map[string]float64{"infra": 40}, "revision": m.Revision}, http.StatusOK)
	closed := decode[store.Month](t, rec)

	// Commenting a closed month is allowed; it is the input edit that is not.
	c.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-04/comments", sp.ID),
		map[string]string{"body": "cerrado con el costo real"}, http.StatusCreated)

	rec = c.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/months/2026-04/comments", sp.ID), nil, http.StatusOK)
	list := decode[[]store.MonthComment](t, rec)
	if len(list) != 2 {
		t.Fatalf("got %d comments", len(list))
	}
	if list[0].Email != "owner@novum.gg" {
		t.Fatalf("comment author %q", list[0].Email)
	}

	rec = c.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/months/2026-04", sp.ID), nil, http.StatusOK)
	if decode[store.Month](t, rec).Revision != closed.Revision {
		t.Fatal("commenting bumped the month revision")
	}
}

func TestEmptyCommentRejected(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	saveMonth(c, sp.ID, "2026-05", healthyMonth("2026-05"), 0)
	c.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-05/comments", sp.ID),
		map[string]string{"body": "   "}, http.StatusBadRequest)
}

func TestOutsiderCannotCommentOrReopen(t *testing.T) {
	h := newServer(t)
	c, sp := owner(t, h)
	saveMonth(c, sp.ID, "2026-06", healthyMonth("2026-06"), 0)

	// A real second account, with a space of its own, so this proves membership
	// is checked and not merely that the request was unauthenticated.
	otherSpace := decode[store.Space](t, c.mustDo(http.MethodPost, "/api/sessions",
		map[string]string{"name": "Otra", "preset": "generic"}, http.StatusCreated))
	inv := decode[struct {
		Invite store.Invite `json:"invite"`
	}](t, c.mustDo(http.MethodPost, "/api/sessions/"+otherSpace.ID+"/members",
		map[string]string{"email": "outsider@example.com", "role": "editor"}, http.StatusCreated)).Invite
	other := &client{t: t, h: h}
	other.mustDo(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password2"}, http.StatusCreated)

	other.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-06/comments", sp.ID),
		map[string]string{"body": "hola"}, http.StatusNotFound)
	other.mustDo(http.MethodPost, fmt.Sprintf("/api/sessions/%s/months/2026-06/reopen", sp.ID),
		map[string]any{"revision": 1}, http.StatusNotFound)
	other.mustDo(http.MethodGet, fmt.Sprintf("/api/sessions/%s/months/2026-06/comments", sp.ID),
		nil, http.StatusNotFound)
}
