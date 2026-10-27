Append the contents of character-limit-blocks.js to the END of the app's
main JavaScript file (js/app.js here). It replaces nothing.

BLOCK 1  GLOBAL INPUT LENGTH CAP     — the ruled directive, byte-identical.
                                       Never adapt it per app.
BLOCK 2  CHARACTER LIMIT FEEDBACK    — the per-field counter UI.
                                       Additive; delete it and the cap still works.

Preconditions (STOP on any mismatch):
  P1  'GLOBAL INPUT LENGTH CAP' must NOT already appear in the file.
  P2  'maxlength' must appear nowhere in the app.
  P3  no attachShadow and no <iframe> on a surface holding text fields.

After applying:  grep -c 'GLOBAL INPUT LENGTH CAP (family drop-in'  ->  1
(a plain grep for 'GLOBAL INPUT LENGTH CAP' returns 2 — the header and
 the END comment both contain the phrase.)
