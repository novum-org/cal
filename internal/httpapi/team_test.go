package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/novum-org/cal/internal/store"
)

// client is one browser: it keeps whatever session cookie the server handed it.
type client struct {
	t      *testing.T
	h      http.Handler
	cookie *http.Cookie
}

func newServer(t *testing.T) http.Handler {
	t.Helper()
	h, _ := newServerWithStore(t)
	return h
}

// newServerWithStore also hands back the store, for the tests that need to look
// at what actually landed on disk rather than at what the API said.
func newServerWithStore(t *testing.T) (http.Handler, *store.Store) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return New(st, Config{Signup: "setup"}).Router(), st
}

func (c *client) do(method, path string, body any) *httptest.ResponseRecorder {
	c.t.Helper()
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	for _, ck := range rec.Result().Cookies() {
		if ck.Name == cookieName && ck.Value != "" {
			c.cookie = ck
		}
	}
	return rec
}

func (c *client) mustDo(method, path string, body any, want int) *httptest.ResponseRecorder {
	c.t.Helper()
	rec := c.do(method, path, body)
	if rec.Code != want {
		c.t.Fatalf("%s %s: got %d want %d: %s", method, path, rec.Code, want, rec.Body.String())
	}
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var out T
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode %s: %v", rec.Body.String(), err)
	}
	return out
}

// owner sets up the first account and one space, the state every team test starts from.
func owner(t *testing.T, h http.Handler) (*client, store.Space) {
	t.Helper()
	c := &client{t: t, h: h}
	c.mustDo(http.MethodPost, "/api/auth/setup",
		map[string]string{"email": "owner@novum.gg", "password": "password1"}, http.StatusCreated)
	rec := c.mustDo(http.MethodPost, "/api/sessions",
		map[string]string{"name": "Novum", "preset": "novum"}, http.StatusCreated)
	return c, decode[store.Space](t, rec)
}

func TestInviteRedeemJoinsSpace(t *testing.T) {
	h := newServer(t)
	own, sp := owner(t, h)

	rec := own.mustDo(http.MethodPost, "/api/sessions/"+sp.ID+"/members",
		map[string]string{"email": "bob@novum.gg", "role": "editor"}, http.StatusCreated)
	inv := decode[struct {
		Invite store.Invite `json:"invite"`
	}](t, rec).Invite
	if inv.Code == "" || inv.Email != "bob@novum.gg" {
		t.Fatalf("invite %+v", inv)
	}

	// The signup screen can read who the invite is for without being logged in.
	anon := &client{t: t, h: h}
	look := decode[map[string]string](t,
		anon.mustDo(http.MethodGet, "/api/auth/invites/"+inv.Code, nil, http.StatusOK))
	if look["email"] != "bob@novum.gg" || look["space_name"] != "Novum" {
		t.Fatalf("lookup %+v", look)
	}

	bob := &client{t: t, h: h}
	user := decode[store.User](t, bob.mustDo(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password2"}, http.StatusCreated))
	if user.Email != "bob@novum.gg" {
		t.Fatalf("user %+v", user)
	}

	spaces := decode[[]store.Space](t, bob.mustDo(http.MethodGet, "/api/sessions", nil, http.StatusOK))
	if len(spaces) != 1 || spaces[0].ID != sp.ID || spaces[0].Role != "editor" {
		t.Fatalf("bob sees %+v", spaces)
	}
}

func TestInviteCodeIsSingleUse(t *testing.T) {
	h := newServer(t)
	own, sp := owner(t, h)
	inv := decode[struct {
		Invite store.Invite `json:"invite"`
	}](t, own.mustDo(http.MethodPost, "/api/sessions/"+sp.ID+"/members",
		map[string]string{"email": "bob@novum.gg"}, http.StatusCreated)).Invite

	bob := &client{t: t, h: h}
	bob.mustDo(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password2"}, http.StatusCreated)

	// Second redemption of the same code must not mint another account.
	mallory := &client{t: t, h: h}
	if rec := mallory.do(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password3"}); rec.Code < 400 {
		t.Fatalf("reused code accepted: %d %s", rec.Code, rec.Body.String())
	}
}

func TestRevokedInviteCannotRedeem(t *testing.T) {
	h := newServer(t)
	own, sp := owner(t, h)
	inv := decode[struct {
		Invite store.Invite `json:"invite"`
	}](t, own.mustDo(http.MethodPost, "/api/sessions/"+sp.ID+"/members",
		map[string]string{"email": "bob@novum.gg"}, http.StatusCreated)).Invite

	own.mustDo(http.MethodDelete, "/api/sessions/"+sp.ID+"/invites/"+inv.Code, nil, http.StatusNoContent)

	anon := &client{t: t, h: h}
	if rec := anon.do(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password2"}); rec.Code < 400 {
		t.Fatalf("revoked code accepted: %d", rec.Code)
	}
}

func TestExistingAccountJoinsDirectly(t *testing.T) {
	h := newServer(t)
	own, sp := owner(t, h)
	inv := decode[struct {
		Invite store.Invite `json:"invite"`
	}](t, own.mustDo(http.MethodPost, "/api/sessions/"+sp.ID+"/members",
		map[string]string{"email": "bob@novum.gg"}, http.StatusCreated)).Invite
	bob := &client{t: t, h: h}
	bob.mustDo(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password2"}, http.StatusCreated)

	// Bob now has an account, so a second space adds him instead of inviting.
	second := decode[store.Space](t, own.mustDo(http.MethodPost, "/api/sessions",
		map[string]string{"name": "DiplomaticaMC", "preset": "generic"}, http.StatusCreated))
	rec := own.mustDo(http.MethodPost, "/api/sessions/"+second.ID+"/members",
		map[string]string{"email": "bob@novum.gg", "role": "editor"}, http.StatusOK)
	got := decode[map[string]json.RawMessage](t, rec)
	if _, ok := got["member"]; !ok {
		t.Fatalf("expected a member, got %s", rec.Body.String())
	}

	spaces := decode[[]store.Space](t, bob.mustDo(http.MethodGet, "/api/sessions", nil, http.StatusOK))
	if len(spaces) != 2 {
		t.Fatalf("bob should be in two sessions, got %+v", spaces)
	}
}

func TestEditorCannotManageTeam(t *testing.T) {
	h := newServer(t)
	own, sp := owner(t, h)
	inv := decode[struct {
		Invite store.Invite `json:"invite"`
	}](t, own.mustDo(http.MethodPost, "/api/sessions/"+sp.ID+"/members",
		map[string]string{"email": "bob@novum.gg", "role": "editor"}, http.StatusCreated)).Invite
	bob := &client{t: t, h: h}
	bob.mustDo(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password2"}, http.StatusCreated)

	if rec := bob.do(http.MethodPost, "/api/sessions/"+sp.ID+"/members",
		map[string]string{"email": "eve@novum.gg"}); rec.Code != http.StatusForbidden {
		t.Fatalf("editor added a member: %d %s", rec.Code, rec.Body.String())
	}
	// But an editor still sees the team and can work the month.
	bob.mustDo(http.MethodGet, "/api/sessions/"+sp.ID+"/members", nil, http.StatusOK)
}

func TestOwnerCannotBeRemoved(t *testing.T) {
	h := newServer(t)
	own, sp := owner(t, h)
	members := decode[[]store.Member](t,
		own.mustDo(http.MethodGet, "/api/sessions/"+sp.ID+"/members", nil, http.StatusOK))
	if len(members) != 1 || members[0].Role != "owner" {
		t.Fatalf("members %+v", members)
	}
	if rec := own.do(http.MethodDelete,
		"/api/sessions/"+sp.ID+"/members/"+members[0].UserID, nil); rec.Code < 400 {
		t.Fatalf("owner removed itself: %d", rec.Code)
	}
}

func TestOutsiderCannotSeeSpace(t *testing.T) {
	h := newServer(t)
	_, sp := owner(t, h)
	anon := &client{t: t, h: h}
	if rec := anon.do(http.MethodGet, "/api/sessions/"+sp.ID+"/members", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anon read members: %d", rec.Code)
	}
}

// Two editors, one month: the second save with a stale revision is refused
// rather than silently overwriting the first. (#12)
func TestStaleRevisionRejected(t *testing.T) {
	h := newServer(t)
	own, sp := owner(t, h)
	inv := decode[struct {
		Invite store.Invite `json:"invite"`
	}](t, own.mustDo(http.MethodPost, "/api/sessions/"+sp.ID+"/members",
		map[string]string{"email": "bob@novum.gg", "role": "editor"}, http.StatusCreated)).Invite
	bob := &client{t: t, h: h}
	bob.mustDo(http.MethodPost, "/api/auth/redeem",
		map[string]string{"code": inv.Code, "password": "password2"}, http.StatusCreated)

	path := "/api/sessions/" + sp.ID + "/months/2026-03"
	loaded := decode[store.Month](t, own.mustDo(http.MethodGet, path, nil, http.StatusOK))

	save := func(c *client, cashIn float64, rev int) *httptest.ResponseRecorder {
		in := loaded.Inputs
		in.Month = "2026-03"
		in.CashInMonth = cashIn
		return c.do(http.MethodPut, path, map[string]any{"inputs": in, "revision": rev})
	}

	first := decode[store.Month](t, mustCode(t, save(own, 500, loaded.Revision), http.StatusOK))
	if first.Revision <= loaded.Revision {
		t.Fatalf("revision did not advance: %d -> %d", loaded.Revision, first.Revision)
	}

	// Bob still holds the revision he loaded before the owner saved.
	stale := save(bob, 999, loaded.Revision)
	if stale.Code != http.StatusConflict {
		t.Fatalf("stale save allowed: %d %s", stale.Code, stale.Body.String())
	}

	after := decode[store.Month](t, bob.mustDo(http.MethodGet, path, nil, http.StatusOK))
	if after.Inputs.CashInMonth != 500 {
		t.Fatalf("owner's save was clobbered: %v", after.Inputs.CashInMonth)
	}

	// Reloading gives him the current revision, and then he can overwrite on purpose.
	mustCode(t, save(bob, 999, after.Revision), http.StatusOK)
}

func mustCode(t *testing.T, rec *httptest.ResponseRecorder, want int) *httptest.ResponseRecorder {
	t.Helper()
	if rec.Code != want {
		t.Fatalf("got %d want %d: %s", rec.Code, want, rec.Body.String())
	}
	return rec
}
