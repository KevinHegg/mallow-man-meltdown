# prompt12 — UI legibility pass (phone-first)

Two real bugs from Kevin's iPhone (portrait, tall aspect):

1. **The rooftop windows read as UI.** The four lit arched windows on the
   building facade below the roof look like mysterious yellow ovals —
   floating pills with no architectural context. On a tall phone screen
   the fourth one sits directly behind the SHAKE button, making the
   whole corner confusing. Fix: make them unambiguously *architecture* —
   real window frames, sills, and wall around them — or restyle them so
   they cannot be mistaken for buttons or indicators. Decorative art must
   never look interactive.
2. **Flight controls hidden by art.** In flight mode the on-screen
   controls (BOOST/SHAKE) can be covered by the city silhouette /
   decorative art at the screen edges. Fix: interactive controls always
   render above all decorative art, at every supported aspect. Audit both
   scenes: nothing decorative may occlude anything interactive.

Also in scope, same theme:
- **Hopper pips are nearly invisible.** The blaster's ammo dots above
  SHAKE barely register. Make hopper state legible at a glance — visible
  pips or a small hopper meter near the blaster/SHAKE.

General rule going forward (add to the working notes, not DESIGN.md):
interactive elements on top, decorative art never occludes them, and
every scene gets a screenshot check at 540×960 *and* a tall-phone aspect
(19.5:9, e.g. 390×844 logical) before a prompt is called done.

Acceptance: at both aspects, in flight and on the roof — windows read as
windows, SHAKE/pips/boost fully visible and unoccluded, no decorative
art overlapping any control; zero console errors. Then write
prompts/prompt12-response.md per the protocol and commit.
