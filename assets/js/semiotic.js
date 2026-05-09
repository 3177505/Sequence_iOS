const TOPOLOGIES = [
  {
    lines: ['top-edge', 'bottom-edge', 'left-edge', 'right-edge', 'diag-main', 'diag-cross'],
    nodes: ['node-tl', 'node-tr', 'node-bl', 'node-br'],
  },
  {
    lines: ['top-edge', 'right-edge', 'diag-main'],
    nodes: ['node-tl', 'node-tr', 'node-br'],
  },
  {
    lines: ['left-edge', 'bottom-edge', 'diag-cross'],
    nodes: ['node-tl', 'node-bl', 'node-br'],
  },
  {
    lines: ['top-edge', 'bottom-edge', 'diag-main'],
    nodes: ['node-tl', 'node-tr', 'node-br', 'node-bl'],
  },
  {
    lines: ['left-edge', 'right-edge', 'diag-main', 'diag-cross'],
    nodes: ['node-tl', 'node-tr', 'node-bl', 'node-br'],
  },
];

const RESEARCH_KEYS = [
  '4_Research/10_Absurd',
  '4_Research/3_Carnivalesque',
  '4_Research/13_Lunapark',
  '4_Research/14_Carneval_PrevraceniRadu',
  '4_Research/15_CarnivalOfCrisis',
  '4_Research/21_ModernJester',
  '4_Research/11_Trolling',
  '4_Research/17_Manosphere',
  '4_Research/2_Grotta',
  '4_Research/4_Mannerist',
  '4_Research/7_assemblage',
  '4_Research/8_ Abjection',
  '4_Research/12_Scapegoat',
  '4_Research/19_Doadland',
  '4_Research/9_Return',
  '4_Research/1_Cyclical',
  '4_Research/18_Sabotage',
  '4_Research/5_AITendencies',
  '4_Research/6_NeuralDecay',
  '4_Research/22_LowResolution',
  '4_Research/23_MacroMicro',
];

const researchDiagramWords = {
  '4_Research/10_Absurd': {
    labels: { tl: 'grotesk', tr: 'smích', bl: 'tělo', br: 'filtr' },
    outer: { top: 'grotesknost', bottom: 'užitečné tělo', left: 'hranice hybridu', right: 'grotesk normální' },
  },
  '4_Research/3_Carnivalesque': {
    labels: { tl: 'masopust', tr: 'memy', bl: 'tělo', br: 'Bachtin' },
    outer: { top: 'zvrácení řádu', bottom: 'úřední morálka', left: 'liturgický rám', right: 'karneval bez náměstí' },
  },
  '4_Research/13_Lunapark': {
    labels: { tl: 'atrakce', tr: 'kolotoč', bl: 'zábava', br: 'společenské tělo' },
    outer: { top: 'předlunapark', bottom: 'slow living', left: 'adrenalin', right: 'IP parky' },
  },
  '4_Research/14_Carneval_PrevraceniRadu': {
    labels: { tl: 'pravidlo zevnitř', tr: 'taktika', bl: 'králování bláznů', br: 'neposlušnost' },
    outer: { top: 'předepsaná realita', bottom: 'operační logika', left: 'legální pořádek', right: 'hacktivismus' },
  },
  '4_Research/15_CarnivalOfCrisis': {
    labels: { tl: 'smích', tr: 'hrůza', bl: 'hybrid', br: 'výkon' },
    outer: { top: 'karneval krize', bottom: 'terapie', left: 'karneval za moru', right: 'utrpení jako spektákl' },
  },
  '4_Research/21_ModernJester': {
    labels: { tl: 'šašek', tr: 'král', bl: 'nepříjemné', br: 'situace systému' },
    outer: { top: 'hierarchie rozházené', bottom: 'profesionální řeč', left: 'dvorní šašek', right: 'stand-up' },
  },
  '4_Research/11_Trolling': {
    labels: { tl: 'satira', tr: 'raid', bl: 'tržiště', br: 'shitpost' },
    outer: { top: 'provokace z okraje', bottom: 'etika pozitivity', left: 'anonymita', right: 'Discord' },
  },
  '4_Research/17_Manosphere': {
    labels: { tl: 'spolek', tr: 'incel', bl: 'systém', br: 'alfa řeč' },
    outer: { top: 'manosphere', bottom: 'emancipace', left: 'mužské spolky', right: '4chan' },
  },
  '4_Research/2_Grotta': {
    labels: { tl: 'URL', tr: 'IRL', bl: 'jeskyně', br: 'deep web' },
    outer: { top: 'dark mode', bottom: 'flat design', left: 'jeskyně v zahradě', right: 'generované zátoky' },
  },
  '4_Research/4_Mannerist': {
    labels: { tl: 'úzkost proporcí', tr: 'hyperdetail', bl: 'styl', br: 'zděděný vzorec' },
    outer: { top: 'nadháněná forma', bottom: 'klasická harmonie', left: 'dvorská gesta', right: 'style transfer' },
  },
  '4_Research/7_assemblage': {
    labels: { tl: 'fragment', tr: 'box', bl: 'Cornell', br: 'Kiefer' },
    outer: { top: 'koláž', bottom: 'jedna forma', left: 'dada, surrealismus', right: 'scan sutin' },
  },
  '4_Research/8_ Abjection': {
    labels: { tl: 'proklatý předmět', tr: 'hraniční', bl: 'deodand', br: 'cenzura záběru' },
    outer: { top: 'vina na věci', bottom: 'trestní osoba', left: 'očištění předmětu', right: 'důkaz' },
  },
  '4_Research/12_Scapegoat': {
    labels: { tl: 'cancel', tr: 'kampaň', bl: 'roh beránka', br: 'emblém' },
    outer: { top: 'obětní beranek', bottom: 'presumpce neviny', left: 'oběť v komunitě', right: 'reputace' },
  },
  '4_Research/19_Doadland': {
    labels: { tl: 'propad stroje', tr: 'koruna', bl: 'obec', br: 'common law' },
    outer: { top: 'věc jako viník', bottom: 'osoba ne věc', left: 'zabavení věci', right: 'skrytá vina' },
  },
  '4_Research/9_Return': {
    labels: { tl: 'zlatý věk', tr: 'singularita', bl: 'hodnoty', br: 'ideologie' },
    outer: { top: 'narativní magnet', bottom: 'žádný happy end', left: 'mesianismus', right: 'retraditionalizace' },
  },
  '4_Research/18_Sabotage': {
    labels: { tl: 'náhoda', tr: 'loop', bl: 'tichý odpor', br: 'špatná data' },
    outer: { top: 'sabotáž obsahu', bottom: 'JIT korporát', left: 'fabrika', right: 'ransomware' },
  },
  '4_Research/5_AITendencies': {
    labels: { tl: 'interpolace', tr: 'LLM', bl: 'tkalcovský vzor', br: 'diffusion' },
    outer: { top: 'styl stroje', bottom: 'autorství', left: 'programové umění', right: 'syntetický hlas' },
  },
  '4_Research/6_NeuralDecay': {
    labels: { tl: 'glitch', tr: 'latent space', bl: 'šum', br: 'komprese' },
    outer: { top: 'decay jako výraz', bottom: 'HDR jako norma', left: 'filmová degradace', right: 'chyba jako podpis' },
  },
  '4_Research/1_Cyclical': {
    labels: { tl: 'kalendář', tr: 'feed', bl: 'masopust', br: 'pinball' },
    outer: { top: 'pinball bez katarze', bottom: 'pokrok jako přímka', left: 'cyklický čas', right: 'sezónní obsah' },
  },
  '4_Research/22_LowResolution': {
    labels: { tl: 'VHS', tr: 'TikTok', bl: 'trezor', br: 'pirátství' },
    outer: { top: 'chudý obraz', bottom: '8K status', left: 'široké šíření', right: 'přecompress' },
  },
  '4_Research/23_MacroMicro': {
    labels: { tl: 'eroze', tr: 'dilatace', bl: 'mikroskop', br: 'veduta' },
    outer: { top: 'jiná měřítka', bottom: 'jedna pravda', left: 'stejný materiál', right: 'street view' },
  },
};

const states = RESEARCH_KEYS.map((key, i) => ({
  ...TOPOLOGIES[i % 5],
  labels: researchDiagramWords[key].labels,
  outer: researchDiagramWords[key].outer,
}));

const lineIds = ['top-edge', 'bottom-edge', 'left-edge', 'right-edge', 'diag-main', 'diag-cross'];
const nodeIds = ['node-tl', 'node-tr', 'node-bl', 'node-br'];
const labelTl = document.getElementById('label-tl');
const labelTr = document.getElementById('label-tr');
const labelBl = document.getElementById('label-bl');
const labelBr = document.getElementById('label-br');
const labelOuterTop = document.getElementById('label-outer-top');
const labelOuterBottom = document.getElementById('label-outer-bottom');
const labelOuterLeft = document.getElementById('label-outer-left');
const labelOuterRight = document.getElementById('label-outer-right');
const stateLabel = document.getElementById('state-label');
const togglePlay = document.getElementById('toggle-play');
const nextStateButton = document.getElementById('next-state');

let currentState = 0;
let playing = true;
let intervalId = null;

function setActive(elements, activeIds) {
  elements.forEach((id) => {
    const element = document.getElementById(id);
    const isActive = activeIds.includes(id);
    element.classList.toggle('active', isActive);
  });
}

function applyState(index) {
  const state = states[index];
  setActive(lineIds, state.lines);
  setActive(nodeIds, state.nodes);
  labelTl.textContent = state.labels.tl;
  labelTr.textContent = state.labels.tr;
  labelBl.textContent = state.labels.bl;
  labelBr.textContent = state.labels.br;
  labelOuterTop.textContent = state.outer.top;
  labelOuterBottom.textContent = state.outer.bottom;
  labelOuterLeft.textContent = state.outer.left;
  labelOuterRight.textContent = state.outer.right;
  stateLabel.textContent = `${index + 1} / ${states.length}`;
}

function nextState() {
  currentState = (currentState + 1) % states.length;
  applyState(currentState);
}

function startAuto() {
  stopAuto();
  intervalId = setInterval(nextState, 5200);
}

function stopAuto() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

togglePlay.addEventListener('click', () => {
  playing = !playing;
  togglePlay.textContent = playing ? 'pauza' : 'přehrát';
  if (playing) {
    startAuto();
  } else {
    stopAuto();
  }
});

nextStateButton.addEventListener('click', () => {
  nextState();
});

applyState(currentState);
startAuto();

function loadGlossary() {
  const dl = document.getElementById('glossary-root');
  if (!dl) return;
  fetch('/public/api-public-tree/glossary.json', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((data) => {
      const entries = data.entries || [];
      for (const e of entries) {
        const dt = document.createElement('dt');
        dt.textContent = e.term || '';
        const dd = document.createElement('dd');
        dd.textContent = e.definition || '';
        dl.appendChild(dt);
        dl.appendChild(dd);
      }
    })
    .catch(() => {});
}

loadGlossary();
