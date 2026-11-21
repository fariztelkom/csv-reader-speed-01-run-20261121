// Fast drop-in for csv-reader 1.0.0.
//
// Same broken-row policy as the house reader, but the scanner works on UTF-16 code units with
// charCodeAt() and slices whole fields out of the input instead of appending one character at a
// time. Two module-scoped scalars carry a field's end reason and the number of characters a junk
// read appended, so no result objects are allocated per field.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

let T = '';
let LEN = 0;
let ERR = [];
let ROWS = [];
let COLS = null;
let WIDTH = -1;
let POS = 0;
let LINE = 1;
let RL = 1;
let RR = null;

// Set by the two field readers: how the field ended, and how many chars its tail read kept.
let ended = END;
let added = 0;

function error(code) {
  ERR.push({ code, line: RL, row: RR });
}

// Reads unquoted text starting at `start`, seeded with `initial`, up to a comma, line break or the
// end of the input. A CR not followed by LF is dropped and reported. Returns the field's value.
function unquoted(start, initial) {
  let value = initial;
  let parts = null;
  let seg = start;
  let i = start;
  while (i < LEN) {
    const c = T.charCodeAt(i);
    if (c === 44) { // ,
      let tail = T.slice(seg, i);
      if (parts !== null) { parts.push(tail); tail = parts.join(''); }
      value = initial + tail;
      POS = i + 1;
      ended = COMMA;
      added = value.length - initial.length;
      return value;
    }
    if (c === 10) { // LF
      let tail = T.slice(seg, i);
      if (parts !== null) { parts.push(tail); tail = parts.join(''); }
      value = initial + tail;
      POS = i + 1;
      LINE++;
      ended = LINE_BREAK;
      added = value.length - initial.length;
      return value;
    }
    if (c === 13) { // CR
      if (i + 1 < LEN && T.charCodeAt(i + 1) === 10) { // CRLF
        let tail = T.slice(seg, i);
        if (parts !== null) { parts.push(tail); tail = parts.join(''); }
        value = initial + tail;
        POS = i + 2;
        LINE++;
        ended = LINE_BREAK;
        added = value.length - initial.length;
        return value;
      }
      error('stray_cr');
      if (parts === null) parts = [];
      parts.push(T.slice(seg, i));
      i++;
      seg = i;
      continue;
    }
    i++;
  }
  let tail = T.slice(seg, LEN);
  if (parts !== null) { parts.push(tail); tail = parts.join(''); }
  value = initial + tail;
  POS = LEN;
  ended = END;
  added = value.length - initial.length;
  return value;
}

// Reads a quoted field whose opening quote is at POS.
function quoted() {
  const open = POS;
  const openLine = LINE;
  let parts = null;
  let seg = open + 1;
  let i = seg;
  let close = -1;
  while (i < LEN) {
    const c = T.charCodeAt(i);
    if (c === 34) { // "
      if (i + 1 < LEN && T.charCodeAt(i + 1) === 34) { // doubled quote
        if (parts === null) parts = [];
        parts.push(T.slice(seg, i));
        parts.push('"');
        i += 2;
        seg = i;
        continue;
      }
      close = i;
      i++;
      break;
    }
    if (c === 13) { // CRLF and lone CR inside quotes are each one LF
      if (parts === null) parts = [];
      parts.push(T.slice(seg, i));
      parts.push('\n');
      LINE++;
      i += (i + 1 < LEN && T.charCodeAt(i + 1) === 10) ? 2 : 1;
      seg = i;
      continue;
    }
    if (c === 10) LINE++;
    i++;
  }
  if (close < 0) {
    // Never closed: the quote is a literal character, and the text after it is read again.
    POS = open + 1;
    LINE = openLine;
    error('unterminated_quote');
    return unquoted(open + 1, '"');
  }
  let value;
  if (parts === null) value = T.slice(seg, close);
  else { parts.push(T.slice(seg, close)); value = parts.join(''); }
  POS = i;
  if (POS >= LEN) { ended = END; return value; }
  const c = T.charCodeAt(POS);
  if (c === 44) { POS++; ended = COMMA; return value; }
  if (c === 10) { POS++; LINE++; ended = LINE_BREAK; return value; }
  if (c === 13 && POS + 1 < LEN && T.charCodeAt(POS + 1) === 10) {
    POS += 2;
    LINE++;
    ended = LINE_BREAK;
    return value;
  }
  // Anything between the closing quote and the delimiter is appended as it stands.
  const junk = unquoted(POS, value);
  if (added > 0) error('quote_junk');
  return junk;
}

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  T = String(input.text);
  LEN = T.length;
  const header = input.header === true;
  ERR = [];
  ROWS = [];
  COLS = null;
  WIDTH = -1;
  POS = T.charCodeAt(0) === 0xFEFF ? 1 : 0;
  LINE = 1;
  RL = 1;
  RR = null;

  for (;;) {
    // Lines with no characters are no records.
    while (POS < LEN) {
      const c = T.charCodeAt(POS);
      if (c === 10) { POS++; LINE++; }
      else if (c === 13 && POS + 1 < LEN && T.charCodeAt(POS + 1) === 10) { POS += 2; LINE++; }
      else break;
    }
    if (POS >= LEN) break;

    RL = LINE;
    RR = header && COLS === null ? null : ROWS.length;
    const fields = [];
    let wasQuoted = false;
    do {
      wasQuoted = T.charCodeAt(POS) === 34;
      fields.push(wasQuoted ? quoted() : unquoted(POS, ''));
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !wasQuoted) continue;

    if (WIDTH < 0) WIDTH = fields.length;
    if (header && COLS === null) { COLS = fields; continue; }
    if (fields.length < WIDTH) {
      ERR.push({ code: 'short_row', line: RL, row: RR, fields: fields.length });
      while (fields.length < WIDTH) fields.push('');
    } else if (fields.length > WIDTH) {
      ERR.push({ code: 'long_row', line: RL, row: RR, extra: fields.splice(WIDTH) });
    }
    ROWS.push(fields);
  }
  return { columns: header ? (COLS ?? []) : null, rows: ROWS, errors: ERR };
}
