//
// Globals
//
const requestURL = 'http://23.254.167.151:30000';
let language, recordId;
let sourceParse, targetParse;
let doneInOther = false;  // The sentences was already processed in another language.

//
// Helpers
//
function copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function byId(id) {
  return document.getElementById(id);
}

function get(obj, key, plug) {
  return obj.hasOwnProperty(key) ? obj[key] : plug;
}

//
// UD processing
//
function getUDWordLine(arr) {
  console.assert(arr.length === 10);
  return {
    ID:     arr[0],
    FORM:   arr[1],
    LEMMA:  arr[2],
    UPOS:   arr[3],
    XPOS:   arr[4],
    FEATS:  arr[5],
    HEAD:   arr[6],
    DEPREL: arr[7],
    DEPS:   arr[8],
    MISC:   arr[9]
  }
}

function getTriggerTokens(line) {
  if (line === 'Please add' || line === '[]')
    return [];
  else {
    line = line.slice(2, line.length-2);
    return line.split(', ');
  }
}

function getTacredParse(block) {
  const lines = block.split('\n');
  let result = {},
    wordLines = [];
  for (let line of lines) {
    line = line.trim();
    if (line.indexOf('# text = ') === 0)
      result.text = line.slice('# text = '.length);
    else if (line.indexOf('# id = ') === 0)
      result.id = line.slice('# id = '.length);
    else if (line.indexOf('# sent_id = ') === 0)
      result.sent_id = line.slice('# sent_id = '.length);
    else if (line.indexOf('# docid = ') === 0)
      result.docid = line.slice('# docid = '.length);
    else if (line.indexOf('# relation = ') === 0)
      result.relation = line.slice('# relation = '.length);
    else if (line.indexOf('# token = ') === 0)
      result.token = JSON.parse(line.slice('# token = '.length));
    else if (line.indexOf('# subj_start = ') === 0)
      result.subj_start = line.slice('# subj_start = '.length);
    else if (line.indexOf('# subj_end = ') === 0)
      result.subj_end = line.slice('# subj_end = '.length);
    else if (line.indexOf('# obj_start = ') === 0)
      result.obj_start = line.slice('# obj_start = '.length);
    else if (line.indexOf('# obj_end = ') === 0)
      result.obj_end = line.slice('# obj_end = '.length);
    else if (line.indexOf('# subj_type = ') === 0)
      result.subj_type = line.slice('# subj_type = '.length);
    else if (line.indexOf('# obj_type = ') === 0)
      result.obj_type = line.slice('# obj_type = '.length);
    else if (line.indexOf('# trigger_tokens = ') === 0)
      result.trigger_tokens = getTriggerTokens(line.slice('# trigger_tokens = '.length));
    else
      wordLines.push(getUDWordLine(line.split('\t')));
  }
  result.wordLines = wordLines;
  return result;
}

function getConlluMetaLine(lineName) {
  return `# ${lineName} = ${get(targetParse, lineName, '')}`;
}

/**
 * Converts trigger-token indices to contiguous spans.
 */
function convertTriggerTokens() {
  let result = [],
    tmp = [];
  for (const token of targetParse.trigger_tokens) {
    // Create a new span
    if (tmp.length !== 0 && parseInt(token) !== parseInt(tmp[tmp.length-1]) + 1) {
      result.push(copy(tmp));
      tmp.length = 0;
    }
    // Create a span from scratch or continue an old one.
    tmp.push(token);
  }
  if (tmp.length > 0)
    result.push(copy(tmp));
  return result;
}

function printConllu() {
  let tmp = [
      'docid', 'sent_id', 'id', 'text', 'relation',
      'subj_start', 'subj_end', 'obj_start', 'obj_end',
      'subj_type', 'obj_type'
  ].map(fieldName => getConlluMetaLine(fieldName));
  tmp.push(`# token = ${JSON.stringify(get(targetParse, 'token', '[]'))}`);
  tmp.push(`# trigger_tokens = ${JSON.stringify(convertTriggerTokens())}`);
  const wordLines = get(targetParse, 'wordLines', []);
  for (const line of wordLines)
    tmp.push(UDFields.map(field => line[field]).join('\t'));
  return tmp.join('\n');
}

//
// Communication with the backend
//
let getLanguage = () => byId('ko-radio').checked ? 'ko' : 'ru';

async function getSentenceById() {
  const language = getLanguage(),
      id = byId('id-input').value;
  if (id.trim() === '')
    return;
  const response = await fetch(`${requestURL}/${language}/byid/${id}`);
  await processResponse(response);
}

async function getNextSentence() {
  const language = getLanguage(),
    response = await fetch(`${requestURL}/${language}/nextsentence`);
  await processResponse(response);
}

async function processResponse(response) {
  if (!response.ok) {
    const error = await response.text();
    alert(`An error has been encountered: ${error}.`);
    return;
  }
  const data = await response.json();
  recordId = data.id;
  byId('discard-button').style.backgroundColor = data.done_in_other_lang ? 'red' : 'lightgrey';
  sourceParse = getTacredParse(data.source);
  targetParse = getTacredParse(data.target);
  m.redraw();
}

async function updateSentence() {
  const language = getLanguage(),
    response = await fetch(`${requestURL}/${language}/updatesentence`, {
      method: 'POST',
      body: JSON.stringify({
        id: targetParse.id,
        conllu: printConllu()
      }),
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  if (!response.ok) {
    const error = await response.text();
    alert(`Failed to update the data on the server: ${error}`);
    return;
  }
  getNextSentence();
}

async function discardSentence() {
  const language = getLanguage(),
      response = await fetch(`${requestURL}/${language}/discardsentence`, {
        method: 'POST',
        body: JSON.stringify({id: targetParse.id}),
        headers: {
          'Content-Type': 'text/plain'
        }
      });
  if (!response.ok) {
    const error = await response.text();
    alert(`Failed to update the data on the server: ${error}`);
    return;
  }
  getNextSentence();
}

document.addEventListener('DOMContentLoaded', async () => {
  byId('ko-radio').checked = true;
  m.mount(byId('sourceParse'), {view: () => m(parseComponent, {id: 'source'})});
  m.mount(byId('targetParse'), {view: () => m(parseComponent, {id: 'target'})});
  await getNextSentence();
  m.mount(byId('ud-edit'), UDVisualisationComponent)
  m.mount(byId('ud-table'), conlluTableComponent)
  m.redraw();
});