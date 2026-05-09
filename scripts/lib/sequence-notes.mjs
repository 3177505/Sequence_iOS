export const researchGalleryLabelOrder = [
  '4_Research/3_Carnivalesque',
  '4_Research/13_Lunapark',
  '4_Research/14_Carneval_PrevraceniRadu',
  '4_Research/15_CarnivalOfCrisis',
  '4_Research/21_ModernJester',
  '4_Research/11_Trolling',
  '4_Research/2_Grotta',
  '4_Research/4_Mannerist',
  '4_Research/10_Absurd',
  '4_Research/8_ Abjection',
  '4_Research/7_assemblage',
  '4_Research/16_PaedomorphicAlterations',
  '4_Research/12_Scapegoat',
  '4_Research/19_Doadland',
  '4_Research/9_Return',
  '4_Research/18_Sabotage',
  '4_Research/1_Cyclical',
  '4_Research/17_Manosphere',
  '4_Research/20_adulteration',
  '4_Research/5_AITendencies',
  '4_Research/6_NeuralDecay',
  '4_Research/22_LowResolution',
  '4_Research/23_MacroMicro',
  '4_Research/24_LaughingStock',
  '4_Research/25_Depese',
  '4_Research/26_Lolcow',
  '4_Research/27_PhotogrammetryRig',
  '4_Research/28_MoralBankruptcy',
  '4_Research/29_BakhtinianInversion',
  '4_Research/30_SlotMachine',
  '4_Research/31_Staccato',
  '4_Research/32_StimmingToys',
  '4_Research/33_Toys',
  '4_Research/34_WheelOfFortune',
  '4_Research/35_KuleshovEffect',
];

export const researchPairPresets = [
  {
    id: 'scapegoat-lolcow',
    left: '4_Research/12_Scapegoat',
    right: '4_Research/26_Lolcow',
  },
];

export const defaultResearchPairId = 'scapegoat-lolcow';

export const researchGalleryIntro = {
  title: 'In points',
  rows: [
    'opakující se logika převrácení řádu, viny a spásy v digitální době  význam a čas nejsou lineární "feed", ale cyklický a přepisovatelný narative',
    'seskupené jevy, fenomény co pracují s řády co ovládají společnost, současné téma ja tematizovat jakým způsobem media proměnují chování celeho lidsva',
    'nejak na to nahlizet z sirsiho hlediska,… macro micro ',
    'mapa překlápějících se významů, nelineární příběh..  dvojice historie ↔ současnost, protipóly a krátké teze',
    'karneval a převrácení řádu, groteskno a absurditu, obětní kozla / vinu přenesenou na věc (deodand, cancel), návraty a narativ spásy, trolling a moderní šašek, krizi jako karneval, sabotáž a smyčky, nízké rozlišení / "chudý obraz", makro versus mikro v digitálním materiálu, AI a manýrismus\u2026.',
    'morálka a moc přepisují přes tělo, věc, obraz nebo algoritmus',
    'pozorování evoluce… typ jevu (karneval, vina, spasení, degradace obrazu) mění semédii a dobou -> rozpoznatelná logik',
    'cyklus / smyčka vs lineární čas; feed, pinball bez katarze ',
    'párování historické / současné osy, k grottě jako URL vs IRL,..',
    'krizi jako karnevalu, narativech spásy a "great again", ale i do ztvárnění u moderního šaška ',
  ],
};

export const researchLabelMeta = {
  '4_Research/1_Cyclical': {
    note: [
      'Lineární čas vs cyklický.',
      'Menstruační cyklus ... návrat ... pinball jako smyčka.',
    ].join('\n\n'),
    bibliografie: [
      'Bachtin (1965) Rabelais ... lidový smích.'
    ],
    protipol:
      'Pokrok jako přímka ... rituální návraty berou jako pověry.',
    casovaOsa: [
      {
        historical: 'Kalendáře, masopusty.',
        contemporary:
          'Feed, sezónní obsah, pinball bez katarze.',
      },
    ],
  },
  '4_Research/2_Grotta': {
    note: [
      'Únik do jeskyně, do URL světa mimo IRL. ... URL svět vs IRL.',
      'AI manýrismus ... vizuální historie na síti nelineárně??',
      'Grotto ... jeskynný/umělý podzemní rámec.',
    ].join('\n\n'),
    protipol: 'White cube, flat design ... žádná temnota jeskyně.',
    casovaOsa: [
      {
        historical: 'Barok, grotesca, jeskyně v zahradách.',
        contemporary: 'Dark mode, deep web metafora, generované zátoky.',
      },
    ],
  },
  '4_Research/3_Carnivalesque': {
    note:
      'Dočasné zvrácení řádu, výměna krále za šaška ... Bachtin.',
    protipol: 'Úřední morálka ... bezpečná zábava.',
    casovaOsa: [
      {
        historical: 'Masopusty.. liturgie.',
        contemporary: 'Memy, cancel, stream ... subculture URL/IRL.',
      },
    ],
  },
  '4_Research/4_Mannerist': {
    note:
      'Nadháněná forma, úzkost proporcí ... styl vs zděděné vzorce.',
    protipol: 'Klasická harmonie jako jediná norma.',
    casovaOsa: [
      {
        historical: 'Manýrismus 16. stol., dvorská gesta.',
        contemporary: 'Style transfer, filtry, hyperdetail.',
      },
    ],
  },
  '4_Research/5_AITendencies': {
    note: 'Generativní AI ... styl stroje, interpolace.',
    protipol: 'Autorství, ruční práce ... protiváha modelu.',
    casovaOsa: [
      {
        historical: 'Tkalcovské vzory, programové umění 60.',
        contemporary: 'LLM, diffusion, syntetické hlasy.',
      },
    ],
  },
  '4_Research/6_NeuralDecay': {
    note: 'Klingemann ... decay, glitch jako výraz.',
    bibliografie: [
      'Klingemann ... GAN, decay.'
    ],
    protipol: 'Čistý HDR realismus jako standard.',
    casovaOsa: [
      {
        historical: 'Filmová degradace, šum TV.',
        contemporary: 'Latent space, komprese ... chyba jako podpis.',
      },
    ],
  },
  '4_Research/7_assemblage': {
    note: [
      'Joseph Cornell ... boxy, fragmenty, tichá nostalgie.',
      'Anselm Kiefer ... hrubá hmota, historie a traumata v materiálu.',
    ].join('\n\n'),
    protipol: 'Jeden autor jedna forma, čistý minimalismus.',
    casovaOsa: [
      {
        historical: 'Dada, surrealismus, Cornell.',
        contemporary: 'Moodboardy, scan sutin, koláž z modelů.',
      },
    ],
  },
  '4_Research/8_ Abjection': {
    note: [
      'Proklatý předmět, který způsobil smrt nebo nese vinu.',
      'Grotesknost v předmětech, které mají moc ... morální odpovědnost přenesená na věc.',
    ].join('\n\n'),
    protipol: 'Právo trestá lidi, ne věci ... čistá estetika.',
    casovaOsa: [
      {
        historical: 'Deodand, očištění předmětu.',
        contemporary: 'Důkazy, cenzura záběrů.',
      },
    ],
  },
  '4_Research/9_Return': {
    note: [
      '„Make X Great Again“ ... návrat ke zlatému věku. Technologické spasení ... AI, blockchain jako vykoupení. Náboženské spasení ... tradiční hodnoty jako záchrana. Národní spasení ... etnická a kulturní čistota.',
      'Odklon od hodnot k ideologii: hodnoty jsou otevřené principy, ideologie uzavřený systém s příběhem o spáse.',
      'Performativní rituál.',
      'Spása jako narativní magnet.',
    ].join('\n\n'),
    protipol:
      'Pluralismus, žádný jeden happy end ... žádné velké příběhy.',
    casovaOsa: [
      {
        historical: 'Milénijní hnutí, mesianismy 19.–20. stol.',
        contemporary:
          'Tech-bro eschatologie (singularita), národní populismus, retraditionalizace jako politický produkt.',
      },
    ],
  },
  '4_Research/10_Absurd': {
    note: [
      'Grotesk, smích, galerie, tělo.',
      'Stelarc ... tělo jako médium.',
      'Fraser ... instituce, výkon.',
    ].join('\n\n'),
    protipol: 'Užitečné tělo, produktivita ... absurdita luxus.',
    casovaOsa: [
      {
        historical: 'Divadlo absurda 50.',
        contemporary: 'Sítě, implantáty, filtry ... grotesk normální.',
      },
    ],
  },
  '4_Research/11_Trolling': {
    note:
      'Trolling a memy jako karnevalické metody dneška ... provokace z anonymního okraje.',
    protipol:
      'Etika pozitivity, moderované komunity a „bezpečné“ diskuzní normy jako protitlak.',
    casovaOsa: [
      {
        historical: 'Satira, tisk, tržiště.',
        contemporary: 'Discord, raid, shitpost ... politika.',
      },
    ],
  },
  '4_Research/12_Scapegoat': {
    displayTitle: 'Obětní kozel — vina, cancel, přenesený terč',
    note: [
      'Cancel, obětní beranek.',
      'Deodand ... věc jako viník.',
      'Spasitel jako náhradní oběť?',
      'Roh beranka ... symbol viny nese jiný.. emblematicky predmet',
    ].join('\n\n'),
    protipol: 'Presumpce neviny, férový proces.',
    casovaOsa: [
      {
        historical: 'Oběť v komunitě, soudní deodand.',
        contemporary: 'Kampaně, reputace, cancel.',
      },
    ],
  },
  '4_Research/13_Lunapark': {
    note: 'Mýtus předlunaparku ... zábava jako zrcadlo společenského těla.',
    protipol: 'Kritika dopamine.. addiction.',
    casovaOsa: [
      {
        historical: 'Výstavy, panoptika 19. stol.',
        contemporary: 'IP parky, VR, gamifikace města.',
      },
    ],
  },
  '4_Research/14_Carneval_PrevraceniRadu': {
    note:
      'Porušování pravidel ... operační logika uvnitř předepsané reality.',
    protipol:
      'Legální pořádek ...',
    casovaOsa: [
      {
        historical: 'Králování bláznů v masopustu.',
        contemporary: 'Hacktivismus, grey zone, neposlušnost.',
      },
    ],
  },
  '4_Research/15_CarnivalOfCrisis': {
    displayTitle: 'Karneval krize — masky, protest; smích a hrůza současně',
    note: [
      'Karneval krize ... smích a hrůza současně.',
      '„Skutečná hodnota“ ... troubení, katharsis, polidštění… hybrid výkonu.',
    ].join('\n\n'),
    casovaOsa: [
      {
        historical: 'Karneval za moru.',
        contemporary: 'Převleky na protestech proti vládě.',
      },
    ],
  },
  '4_Research/16_PaedomorphicAlterations': {
    note: [
      'V biologii: dospělci si ponechají znaky typické dříve jen pro mláďata nebo juvenilní fáze.',
      'Jev, kdy dospělí jedinci drží larvální či mladistvé rysy; neotenie.',
      'Pedomorfní úpravy ... estetika „ne dospělosti“.',
    ].join('\n\n'),
    casovaOsa: [
      {
        historical: 'Baby-face v reklamě.',
        contemporary: 'Filtry mládí, kawaii, AI obličeje.',
      },
    ],
  },
  '4_Research/17_Manosphere': {
    note:
      'Kritika a protipól k internetové subkultuře manosphere.',
    protipol:
      '...obrana ... rozlišit systém vs misogynie.',
    casovaOsa: [
      {
        historical: 'Mužské spolky vs emancipace.',
        contemporary: 'Reddit/4chan, incel, alfa algoritmy.',
      },
    ],
  },
  '4_Research/18_Sabotage': {
    note: [
      'Sabotáž jako náhoda.',
      'Algoritmy, diskriminace, sebevraždy.',
      'Sabotovat obsah.',
      'Loops.'
    ].join('\n\n'),
    protipol: 'Korporát ... nebo ne.',
    casovaOsa: [
      {
        historical: 'Fabriky, tichý odpor.',
        contemporary: 'Quiet quitting (hustle culture by doing only the required duties), ransomware.',
      },
    ],
  },
  '4_Research/19_Doadland': {
    note:
      'Deodand ... objekty, které způsobily smrt a byly zabavené ve prospěch státu.',
    protipol:
      'Moderní právo zodpovědnosti osob...',
    casovaOsa: [
      {
        historical: 'Common law, propad stroje.',
        contemporary: 'SOcialn media, algoritmus skryta vina.',
      },
    ],
  },
  '4_Research/20_adulteration': {
    note:
      'Adulterace ... pančování, nečistota směsi; pravda materiálu pod výrobkem.',
    protipol:
      'Certifikace původu, blockchainové „proof“ a marketing čistoty ... proti narrative falše.',
    casovaOsa: [
      {
        historical: 'Pravé české..',
        contemporary: 'Deepfake, nafouknutá realita.',
      },
    ],
  },
  '4_Research/21_ModernJester': {
    note: [
      'https://www.jesterplanet.com/the-modern-jester/',
      'Komik, ironie ... politický komentář.',
      'Král a šašek prohodí role ve videu.',
      'Pléróma ... smích regeneruje i ničí; současná oslava současně degraduje.',
      'Říct nahlas nepříjemné.',
      'Vyvolává situace, které systém nechce.',
      'Grotesk ... hierarchie rozházené.',
    ].join('\n\n'),
    bibliografie: [
      'Bachtin (1965) Rabelais.',
      'Otto (2001) Fools Are Everywhere.',
    ],
    protipol: 'Profesionální komunikace, žádný risk.',
    casovaOsa: [
      {
        historical: 'Dvorní šašci.',
        contemporary: 'Stand-up, YouTube satira, clown protesty.',
      },
    ],
  },
  '4_Research/22_LowResolution': {
    note: [
      'Nízké rozlišení, degradace, široce šířené digitální obrazy.',
      '„Chudý obraz“ (Hito Steyerl) ... degradace není jen ztráta, ale i osvobození od archivu, autorského práva, „trezorů kinematografie“.',
    ].join('\n\n'),
    bibliografie: ['Steyerl (2012) Poor Image. e-flux.'],
    protipol: '8K HDR jako status.',
    casovaOsa: [
      {
        historical: 'VHS, pirátství.',
        contemporary: 'Memy, přecompress TikTok.',
      },
    ],
  },
  '4_Research/23_MacroMicro': {
    note: [
      'Dilatace',
      'Eroze pixelů ',
      'Makro versus mikro perspektiva ... stejný materiál, jiná měřítka významu.',
      "let img; function preload(){img=loadImage('/assets/bricks.jpg');} function setup(){createCanvas(100,100);image(img,0,0);filter(ERODE);}",
      "let img; function preload(){img=loadImage('/assets/bricks.jpg');} function setup(){createCanvas(100,100);image(img,0,0);filter(DILATE);}",
    ].join('\n\n'),
    bibliografie: ['Reas & Fry (2007) Processing ... ERODE DILATE.'],
    protipol: 'Jedno správné rozlišení, jedna pravda.',
    casovaOsa: [
      {
        historical: 'Mikroskop vs veduta.',
        contemporary: 'Zoom, satelit, street view, morfologie pixelů.',
      },
    ],
  },
  '4_Research/24_LaughingStock': {
    note: [
      'Laughing stock: veřejné ponížení jako zábava. Smích jako nástroj moci i obrany.',
      'Fassbinder: „exploitability of feelings“ — emoce jako věc, kterou lze vytěžit (stát, vztah, publikum).',
      'Karnevalický režim: dovoleno se smát, ale někdo musí nést roli oběti.',
    ].join('\n\n'),
    protipol: 'Důstojnost, soukromí, empatie bez publika.',
    casovaOsa: [
      {
        historical: 'Pranýř, kabaret, freak show.',
        contemporary: 'Lol content, reaction economy, veřejné shaming formáty.',
      },
    ],
  },
  '4_Research/25_Depese': {
    note: [
      'Deposed / sesazený: ztráta statusu jako narativní stroj. Převrácení hierarchie není osvobození, ale přesměrování moci.',
      'Outsider jako optika společnosti: kdo je vyhozen, ukazuje pravidla uvnitř.',
    ].join('\n\n'),
    protipol: 'Stabilní legitimita, meritokratický mýtus bez pádu.',
    casovaOsa: [
      {
        historical: 'Sesazení panovníka, revoluce, exil.',
        contemporary: 'Deplatforming, reputační pád, “cancel” jako rituál.',
      },
    ],
  },
  '4_Research/26_Lolcow': {
    displayTitle: 'Lolcow — veřejný terč; publikum se krmí konfliktem a smíchem',
    note: [
      'Lolcow: figurína pro kolektivní pobavení, která se „krmí“ pozorností a konfliktem.',
      'Blízko scapegoat: vina a frustrace se přelévá do jedné osoby (nebo avataru).',
      'Fassbinder: moc v intimních vztazích i v publiku — kontrola přes stud, lásku, výsměch.',
      'Mechanika: publikum si bere „právo“ definovat normu tím, že ukazuje odchylku; oběť je držena při životě cyklem pozornosti.',
      'Vazba na CarnivalOfCrisis: smích je současně ventil i trest; karneval přepíná na cruelty, když potřebuje oběť.',
    ].join('\n\n'),
    protipol: 'Solidarita s outsiderem, odmítnutí publika jako spoluúčasti.',
    casovaOsa: [
      {
        historical: 'Dvorní terč, klaun jako hromosvod.',
        contemporary: 'Streamers, parasocial hate, komentářové stáje.',
      },
    ],
  },
  '4_Research/27_PhotogrammetryRig': {
    note: [
      'Rig / zařízení na snímání těla nebo objektu: technika jako rituál důkazu.',
      'Tělo (nebo věc) se stává datem. Indexicalita „tohle je pravda“ přes sken.',
      'Makro/mikro: stejný objekt, jiná vrstva významu podle rozlišení a účelu.',
      'Změna moci: kdo vlastní rig, vlastní perspektivu; normalizuje, co je „správný“ tvar, gesto, povrch.',
      'Sken jako karneval bez masky: místo převleku je tu přesnost — ale i ta je estetická a politická (co se měří, co se ignoruje).',
    ].join('\n\n'),
    protipol: 'Improvizace, subjektivní kresba, paměť bez důkazu.',
    casovaOsa: [
      {
        historical: 'Fotografie jako důkaz, měření, antropometrie.',
        contemporary: 'Photogrammetry, NeRF, digitální dvojče, forenzní estetika.',
      },
    ],
  },
  '4_Research/28_MoralBankruptcy': {
    note: [
      'Morální bankrot: normalizované selhání hodnot v rámci systému (instituce, třída, národ).',
      'Fassbinder: poválečná morální zkaženost + buržoazní pokrytectví; “respektabilita” jako maska.',
      'Everyday fascism: rodina, přátelství, práce — malé moci, které dělají velký režim.',
    ].join('\n\n'),
    protipol: 'Sebereflexe, odpovědnost, etika bez PR.',
    casovaOsa: [
      {
        historical: 'Poválečné “čisté štíty”, kolektivní zapomínání.',
        contemporary: 'Brand morality, greenwashing, “values” jako marketing.',
      },
    ],
  },
  '4_Research/29_BakhtinianInversion': {
    note: [
      'Bachtin: převrácení řádu, smích, tělo, dialog. Inversion jako dočasné okno, které systém paradoxně potřebuje.',
      'Nejen anarchie: inversion je mechanismus, jak přesměrovat tlak a znovu upevnit normu.',
    ].join('\n\n'),
    protipol: 'Jednosměrná autorita, monolog, “proper” řeč bez těla.',
    casovaOsa: [
      {
        historical: 'Masopust, karnevalové licence.',
        contemporary: 'Memy, parodie institucí, ironie jako politická technika.',
      },
    ],
  },
  '4_Research/30_SlotMachine': {
    note: [
      'Slot machine: náhodná odměna, opakování, “sweet spot” — feed jako hazardní rozhraní.',
      'Smyčka bez katarze: návrat není spasení, jen další spin.',
      'Kapitalismus emocí: pozornost a afekt jako měna (kdo koho “využívá” a kdo to platí tělem).',
    ].join('\n\n'),
    protipol: 'Záměr, pomalost, smysluplná odměna mimo náhodu.',
    casovaOsa: [
      {
        historical: 'Mechanický automat, arkády.',
        contemporary: 'Infinite scroll, loot boxes, engagement algoritmy.',
      },
    ],
  },
};

export const materialCloudNote = '';

export const inspirationCloudNotes = {
  pinball: [
    'Pinball ... žádné spasení, jen opakování.',
    'Sweet spot, napětí.',
    'Skluzavky jako symbol loopu hedonismu.',
  ].join('\n\n'),
  inspo: [
    'Inspo mimo projekt.',
    'Prazdny okamžik než se význam zmeni.',
    'Kancelářský grotesk ... absurdita pracovního rituálu.',
  ].join('\n\n'),
};

export const semioticGlossary = [
  {
    term: 'Karneval (Bachtin)',
    definition:
      'Dočasné zvrácení řádu: smích a tělo proti úřední morálce; karneval jako schválené okno chaosu, ne jen bezpečná zábava.',
  },
  {
    term: 'Převrácení řádu',
    definition:
      'Porušování pravidel zevnitř předepsané reality; převrácení jako taktika, ne čistá anarchie. Protipól: legální pořádek jako jediný přípustný rám.',
  },
  {
    term: 'Grotesknost',
    definition:
      'Grotesk a hybrid na hranici těla a instituce; smích, galerie, výkon. Protipól: užitečné tělo a produktivita jako norma.',
  },
  {
    term: 'Abjekce',
    definition:
      'Proklatý předmět na hranici čistoty; morální síla a vina přenesená na věc či obraz. Protipól: právo trestá osoby, ne předměty.',
  },
  {
    term: 'Obětní kozel',
    definition:
      'Vina soustředěná na jednoho; cancel, reputace a ritualizované vyloučení. Protipól: presumpce neviny a férový proces.',
  },
  {
    term: 'Deodand',
    definition:
      'Věc propadá koruně nebo obci, protože „způsobila“ smrt; předmoderní právo. Protipól: zodpovědnost osob, ne strojů ani algoritmů.',
  },
  {
    term: 'Chudý obraz',
    definition:
      'Nízké rozlišení a široké šíření; degradace jako únik z trezoru kinematografie a patentní čistoty (Steyerl). Protipól: 8K HDR jako status.',
  },
  {
    term: 'Cyklus / smyčka',
    definition:
      'Opakující se rituál proti lineárnímu pokroku; feed a replay bez katarze. Protipól: čas jako přímka a „překonání“ minulosti.',
  },
  {
    term: 'Makro × mikro',
    definition:
      'Stejný materiál, jiná měřítka významu; dilatace a eroze pixelu, zoom versus celé plátno. Protipól: jediné správné rozlišení.',
  },
  {
    term: 'Spása (narativ)',
    definition:
      'Návrat ke zlatému věku, technologické nebo národní vykoupení; ideologie uzavírá hodnoty do příběhu o spáse. Protipól: pluralismus bez jednoho happy endu.',
  },
  {
    term: 'Heterarchie pojmů',
    definition:
      'Žádný jediný střed diagramu; význam drží síť aktivních hran a uzlů, ne pyramida s jednou pravdou nahoře.',
  },
];

export function buildGlossaryPayload() {
  return { entries: semioticGlossary };
}
